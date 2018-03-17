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
const promisify = require('util').promisify;
const mkdir = promisify(require('fs').mkdir);
const exists = promisify(require('fs').exists);
const exec = promisify(require('child_process').exec);
const fs = require('fs');
const axios = require('axios');
const util = require('util');
const path = require('path');
const api = require('./apis');
const visualizationTemplate = require('./templates/map_visualization');
const Coordinates = require('./coordinates');
const CoordinatesBatch = require('./coordinates_batch');

function sleep(ms){
  return new Promise(resolve=>{
    setTimeout(resolve,ms)
  })
}

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
    this._unprocessedBatch = new CoordinatesBatch();
    this._processedBatch = new CoordinatesBatch();
    this._region = new Region(region);
    this._current_coordinates = this._region.getCornerCoordinates('NW');
    this._stopDistance = stopDistance;
    this._apiKeys = apiKeys;
    this._currentKeyIndex = 0;
    this._panoramas = [];
    this._verbose = verbose;
    this._regionFullyCovered = false;
    this._settings = settings;
  }

  getUnprocessedBatch() {
    return this._unprocessedBatch;
  }

  getProcessedBatch() {
    return this._processedBatch;
  }

  _setGSVClient() {
    this._GSVClient = GSVClient({ apiKey: this.getCurrentApiKey() });
    this.fetchPanoramaFunction = ({ coordinates, radius }) => {
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

  async _initializeStructure() {
    try {
      if(await exists(path.resolve(this.getSettings().destination))) {
        await exec(`rm -rf ${path.resolve(this.getSettings().destination)}`);
      }
      await mkdir(path.resolve(this.getSettings().destination));
      await mkdir(path.join(this.getSettings().destination, '/images'));
    } catch (err) {
      console.log(err)
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

  /**
   * Moves the current position of the car.
   * @param {array} coordinates Coordinates in the form [lon, lat] where the car should move.
   * @throws {Error} Error thrown when the car attempts to drive outside the bounds of its region.
   */
  driveTo(coordinates) {
    if (!this._region.boundingBoxContains(coordinates)) {
      throw new Error(`Trying to drive outside the region\'s bounding box... The region is bounded by the coordinates: ${this._region.getCornerCoordinates('NW').toString()},`
                      + `${this._region.getCornerCoordinates('NE').toString()}, ${this._region.getCornerCoordinates('SW').toString()}, ${this._region.getCornerCoordinates('SE').toString()}` +
                     ` but you are attempting to drive to ${coordinates.toString()}`);
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
    fs.writeFileSync(path.resolve(this._settings.destination, this._settings.filesPrefix + '_panoramas.json'), JSON.stringify({ panoramas: this._processedPanoramas }));
    this.createVisualization();
    this.createSummary();
    this.createApiLog();
    this.saveJsonLog();
  }

  createVisualization() {
    const coordinatesString = JSON.stringify({ coords: this.getProcessedBatch().getCoordinates()
                                               .filter(coord => coord._snappedCoordinates)
                                               .filter(coord => coord._panorama)
                                               .map(coord => coord._snappedCoordinates.toGmaps()) });
    const regionPolygon = JSON.stringify({ coords: this._region.getGmapPolygon() });
    fs.writeFileSync(path.join(this.getSettings().destination, 'viz.html'), util.format(visualizationTemplate, coordinatesString, regionPolygon, this.getCurrentApiKey()));
  }

  createSummary() {
    fs.writeFileSync(path.resolve(this.getSettings().destination, 'log.txt'), this._logMessages.join('\n'));
  }

  saveJsonLog() {
    const log = JSON.stringify(this.getProcessedBatch().getCoordinates().map(coord => coord.serialize()));
    fs.writeFileSync(path.resolve(this.getSettings().destination, 'output.json'), log);
  }

  createApiLog() {
    let fileContent = 'original_latitude,original_longitude,within_region,in_water,snapped_latitude,snapped_longitude,streetview_available\n';
    fileContent += this.getProcessedBatch()
          .getCoordinates()
          .map(coord => coord.asCsvLine())
          .join('\n');
    fs.writeFileSync(path.resolve(this.getSettings().destination, 'output.csv'), fileContent);
  }

  _doneDriving() {
    this._regionFullyCovered = true;
  }

  isDoneDriving() {
    return this._regionFullyCovered;
  }

  async isAtValidCoordinates() {
    return await this._region.isValidPosition({ coordinates: this.getCurrentCoordinates(), apiKey: this.getCurrentApiKey() });
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

  emptyBatchAndDriveTo(coordinates) {
    this._unprocessedBatch.empty();
    this.driveTo(coordinates);
  }

  storeProcessedBatch() {
    this._processedBatch.store(this.getUnprocessedBatch());
    this._unprocessedBatch.empty();
  }

  async start() {
    await this._setGSVClient();
    this.log('Initialize folder for the image collection...');
    await this._initializeStructure();

    this.log('Start driving...');
    while(!this.isDoneDriving()) {
      const startCoordinates = this.getCurrentCoordinates();
      try {
        await this.collectBatch();
        if(this.getUnprocessedBatch().isEmpty()) continue;
        await this.getUnprocessedBatch().snapCoordinates({ apiKey: this.getCurrentApiKey() });
        await this.getUnprocessedBatch().fetchPanoramas({ panoramaFetchFunction: this.fetchPanoramaFunction,
                                                          radius: 50 }); // TODO change this ugly parameter
        // TODO download the images
        this.storeProcessedBatch();
        this.log(`Completed (approx.): ${this.getProcessedBatch().getBatchSize()/this._region.getTotalNumPoints(this._stopDistance)}%...`);
      } catch (err) {
        if (err.code === 'API_LIMIT') {
          this.changeApiKey();
          this.emptyBatchAndDriveTo(startCoordinates);
          continue;
        }
        this.stopDriving();
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
  async collectBatch() {
    while(!this.getUnprocessedBatch().isFull()) {

      try {
        if(this.isDoneDriving()) break;
        if(await this.getCurrentCoordinates().isGoodSeed({ region: this._region, apiKey: this.getCurrentApiKey() })) {
          this.getUnprocessedBatch().add(this.getCurrentCoordinates().clone());
        } else {
          this.getProcessedBatch().add(this.getCurrentCoordinates().clone());
        }
        this.drive();
      } catch (err) {
        throw err;
      }
    }
  }

  /**
   * The car drives in a W -> E, N -> S fashion. If the Google Car reaches the eastmost bound
   * of the bounding box, it checks if it can move south and continue driving.
   * @returns {bool} Returns true if the car is done driving (cannot drive further within the region).
   */
  drive() {

    const nextCoordinates = delta(this.getCurrentCoordinates(), bearings['E'], this._stopDistance);

    if(nextCoordinates.isInRegionBBox(this._region)) {
      this.driveTo(nextCoordinates);
    } else {
      // Compute the coordinates on the same lat but, at the western end of the BBox
      const west = new Coordinates(this.getCurrentCoordinates().getLat(), this._region.getMinLng());
      // ... and move south!
      const southWest = delta(west, bearings['S'], this._stopDistance);
      if (southWest.isInRegionBBox(this._region)) {
        this.driveTo(southWest);
      } else {
        this._doneDriving();
      }
      return;
    }
  }
}

module.exports = GoogleCar;
