/**
 * Contains the class corresponding to a GoogleCar Object. This car figuratively drives
 * within the region of interest, accumulates pictures, and periodically "develops" them
 * (requests the pictures from Google's APIs).
 *
 * @file   This file exports the GoogleCar class.
 * @author Francois Charih <francois.charih@carleton.ca>
 * @since  11-03-18
 */

const Polygon = require('polygon').Polygon; // Replace with d3-polygon
const Region = require('./region');
const delta = require('./utils').delta;
const bearings = require('./utils').bearings;
const BATCH_LIMIT = require('./apis').BATCH_LIMIT;
const GSVClient = require('./street_view_client');
const promisify = require('bluebird').promisify;
const mkdir = promisify(require('fs').mkdir);
const exists = promisify(require('fs').exists);
const fs = require('fs');
const axios = require('axios');
const util = require('util');
const path = require('path');
const api = require('./apis');
const visualizationTemplate = require('./templates/map_visualization');
const Coordinates = require('./coordinates');

class GoogleCar {

  /**
   * Constructor for the GoogleCar object.
   * @param {Region object} region (region to be photographed by the Google Car)
   * @param {float} stopDistance (distance of the stops on the grid)
   * @param {array} apiKeys (array of API keys for Google's APIs)
   * @param {bool} verbose If true, the GoogleCar will log its position to the console. // TODO create different modes "track", "log", etc...
   */
  constructor({ region, stopDistance, apiKeys, verbose, settings }) {
    this._logMessages = [];
    this._region = new Region(region);
    this._current_coordinates = this._region.getCornerCoordinates('NW');
    this._stopDistance = stopDistance;
    this._apiKeys = apiKeys;
    this._currentKeyIndex = 0;
    this._unsnappedCoordinates = [];
    this._snappedCoordinates = [];
    this._panoramas = [];
    this._processedPanoramas = [];
    this._processedCoordinates = [];
    this._verbose = verbose;
    this._regionFullyCovered = false;
    this._settings = settings;
    this._setGSVClient();
    this._validateSettings();
  }

  _setGSVClient() {
    this._GSVClient = GSVClient({ apiKey: this.getCurrentApiKey() });
    this._fetchPanorama = ({ coordinates, radius }) => {
        return new Promise((resolve, reject) => {
          this._GSVClient.getPanorama({
            location: coordinates.toGmaps(),
            radius: radius }, resolve);
          });
    }
  }

  getSettings() {
    return this._settings;
  }

  _validateSettings() {
    // TODO
    return;
  }

  async _initializeStructure() {
    try {
      if(!await exists(path.resolve(this.getSettings().destination))) {
        await mkdir(path.resolve(this.getSettings().destination));
        await mkdir(path.join(this.getSettings().destination, '/images'));
      }
    } catch (err) {
      throw new Error('Error occured while attempting to create the directory structure... The car will stop.');
    }
  }

  /**
   * Returns the currents coordinates of the Google Car.
   * @returns {array} coordinates
   */
  getCurrentCoordinates() {
    return this._current_coordinates;
  }

  /**
   * Returns the API key currently in use by the Google Car.
   * @returns {string} API key in use
   */
  getCurrentApiKey() {
    return this._apiKeys[this._currentKeyIndex];
  }

  getUnsnappedCoordinates() {
    return this._unsnappedCoordinates;
  }

  storeUnsnappedCoordinates(coordinates) {
    this._unsnappedCoordinates.push(coordinates);
  }

  getSnappedCoordinates() {
    return this._snappedCoordinates;
  }

  getPanoramas() {
    return this._panoramas;
  }

  /**
   * Moves the current position of the car.
   * @param {array} coordinates Coordinates in the form [lon, lat] where the car should move.
   * @throws {Error} Error thrown when the car attempts to drive outside the bounds of its region.
   */
  driveTo(coordinates) {
    if (!this._region.boundingBoxContains(coordinates)) {
      throw new Error('Trying to drive outside the region\'s bounding box...');
    }

    this._current_coordinates = coordinates;
  }

  isVerbose() {
    return this._verbose;
  }

  /**
   * Changes the current API key in use by the Google Car.
   * @throws {} Error is thrown if only one API key is provided, as the key cannot be changed.
   */
  changeApiKey() {

    this.log('Attempting to change the API key...');

    if(this._apiKeys.length === 1) throw new Error('Cannot change API key. Only one was provided');

    this._currentKeyIndex += 1; // Simply move onto the next key.

    if(this._currentKeyIndex === this._apiKeys.length) {
      throw new Error('All API keys were consumed.');
    }

    // Reset the GSVClient
    this._setGSVClient();

      this.log(`Changed the API key to ${this.getCurrentApiKey()}...`);
  }

  log(message) {
    const messageWithTime = `${new Date().toISOString()}: ${message}`;
    this._logMessages.push(messageWithTime);
    if(this.isVerbose()) console.log(messageWithTime);
  }

  async stopDriving() {
    this.log('Finished driving...');
    this._purgeCoordinates();
    fs.writeFileSync(path.resolve(this._settings.destination, this._settings.filesPrefix + '_panoramas.json'), JSON.stringify({ panoramas: this._processedPanoramas }));
    this.createVisualization();
    this.createSummary();
  }

  createVisualization() {
    const coordinatesString = JSON.stringify({ coords: this._processedCoordinates.map(coord => coord.toGmaps()) });
    const regionPolygon = JSON.stringify({ coords: this._region.getGmapPolygon() });
    fs.writeFileSync(path.join(this.getSettings().destination, 'viz.html'), util.format(visualizationTemplate, coordinatesString, regionPolygon, this.getCurrentApiKey()));
  }

  createSummary() {
    fs.writeFileSync(path.resolve(this.getSettings().destination, 'log.txt'), this._logMessages.join('\n'));
  }

  async _storeSnappedCoordinates() {
    const snappedCoordinates = await api.fetchSnappedCoordinates({
      coordinates: this.getUnsnappedCoordinates(),
      apiKey: this.getCurrentApiKey(),
    });
    this._snappedCoordinates = snappedCoordinates;
  }

  _purgeCoordinates() {
    this._processedCoordinates = [
      ...this._processedCoordinates,
      ...this.getSnappedCoordinates(),
    ];
    this._processedPanoramas = [
      ...this._processedPanoramas,
      ...this._panoramas,
    ];
    this._unsnappedCoordinates = [];
    this._snappedCoordinates = [];
    this._panoramas = [];
  }

  _doneDriving() {
    this._regionFullyCovered = true;
  }

  _isDoneDriving() {
    return this._regionFullyCovered;
  }

  async isAtValidCoordinates() {
    return await this._region.isValidPosition(this.getCurrentCoordinates(),  this.getCurrentApiKey());
  }

  async _downloadImages() {
    const panoramas = this.getPanoramas();
    for(let i = 0; i < panoramas.length; i++) {
      const coord = JSON.parse(JSON.stringify(panoramas[i].location.latLng));

      // Just take the first heading of the first link in the list of links as a reference
      const firstHeading = panoramas[i].links[0].heading;

      // Compute the desired headings
      let headings = [firstHeading];

      if(this.getSettings().headings === 2) {
        headings.push(headings[0] + 180);
      }

      if(this.getSettings().headings === 4) {
        headings.push(headings[0] + 90);
        headings.push(headings[0] - 90);
      }

      // Fetch the images for this panorama
      for(let h = 0; h < headings.length; h++) {
        await api.fetchImages({
          coordinates: new Coordinates(coord),
          settings: this.getSettings(),
          apiKey: this.getCurrentApiKey(),
          heading: headings[h],
        })
      }
    }
  }

  async _fetchPanoramas() {
    // look at https://developers.google.com/maps/documentation/streetview/metadata
    let panoramas = [];
    const snappedCoordinates = this.getSnappedCoordinates();
    for(let i = 0; i < snappedCoordinates.length; i++) {
      let panorama = await this._fetchPanorama({ coordinates: snappedCoordinates[i], radius: 50 });
      panoramas.push(panorama);
    }

    // add every non-empty panorama to the list anf download the images using one of the two
    // headings at random and using +90 deg, 180 deg, 270
    this._panoramas = panoramas.filter(panorama => panorama && panorama.status !== 'ZERO_RESULTS');
  }

  async start() {

    this.log('Initialize folder for the image collection.');
    if(this._settings.mode === 'images') {
      await this._initializeStructure();
    }

    this.log('Start driving...');

    // Every loop iteration corresponds to a batch of BATCH_LIMIT coordinates...
    // because we batch requests to snap-to-road in batches of size BATCH_LIMIT.
    while(!this._isDoneDriving()) {
      const startCoordinates = this.getCurrentCoordinates();
      try {
          await this._collectUnsnappedCoordinates();
          await this._storeSnappedCoordinates();
          await this._fetchPanoramas();
          if(this._settings.mode === 'images') {
            await this._downloadImages();
          }
          await this._purgeCoordinates();
      } catch (err) {
        if (err.code === 'APILIMIT') {
          // Purge the arrays containing the coordinates collected throughout this iteration
          // and drive back to the start of the batch and restart from there.
          this._unsnappedCoordinates = [];
          this._snappedCoordinates = [];
          this._panoramas = [];
          this.driveTo(startCoordinates);
          continue;
        }
        this.log(`Car stopped unnexpectedly after position ${startCoordinates.asString()} following an unknown error.`);
        throw err;
      }
    }

    await this.stopDriving();
    return;
  }

  /**
   * Collects a batch of images.
   */
  async _collectUnsnappedCoordinates() {

    // Coordinates that should be snapped to road
    this.storeUnsnappedCoordinates(this.getCurrentCoordinates());

    // Keep collecting unsnapped coordinates until the batch limit is reached
    while(this.getUnsnappedCoordinates().length < BATCH_LIMIT - 1) { // TODO replace with variable for batch size

      // Move the car
      this.drive();

      // Break and stop moving if the ccar has covered the entire region
      if(this._isDoneDriving()) break;

      // Check if the coordinates are valid (within the polygon defining the region and not in water)
      if(await this.isAtValidCoordinates()) {
        this.storeUnsnappedCoordinates(this.getCurrentCoordinates()); // TODO change this... For the visualization..
      }
    }

  }

  /**
   * The car drives in a W -> E, N -> S fashion. If the Google Car reaches the eastmost bound
   * of the bounding box, it checks if it can move south and continue driving.
   * @returns {bool} Returns true if the car is done driving (cannot drive further within the region).
   */
  drive() {
    // Try to move east
    const newCoordinates = delta(this.getCurrentCoordinates(), bearings['E'], this._stopDistance);

    if(this._region.boundingBoxContains(newCoordinates)) {
      this.driveTo(newCoordinates);
    } else {
      // Check if you can move one latitude distance down and move all the way to the western bound...
      // If this location is not within the bounding box of the region, we are done driving...
      const oneLatDown = delta(new Coordinates(this.getCurrentCoordinates().getLat(), this._region.getMinLng()), bearings['S'], this._stopDistance);
      if (this._region.boundingBoxContains(oneLatDown)) {
        this.driveTo(oneLatDown);
      } else {
        this._doneDriving(); // Done driving...
      }
      return;
    }
  }
}

module.exports = GoogleCar;
