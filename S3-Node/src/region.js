/**
 * Contains the Region class corresponding to a polygon of interest.
 *
 * @file   This file exports the Region class.
 * @author Francois Charih <francois.charih@carleton.ca>
 * @since  11-03-18
 */

const Polygon = require('polygon'); // Replace with d3-polygon
const Vec2 = require('vec2'); // Replace with d3-polygon
const promisify = require('util').promisify;
const getPixels = promisify(require('get-pixels'));
const Coordinates = require('./coordinates');

class Region {

  /**
   * Constructor for the Region class.
   * @param {object} osmObject The OpenStreetMap object which can be downloaded from nominatim.
   */
  constructor(osmObject) {
    this._validateOsmObject(osmObject);
    this._osmObject = osmObject;
    this._boundingBox = osmObject.boundingbox;
    this._region_name = osmObject.address;
    this._polygon = new Polygon(osmObject.geojson.coordinates[0]);
  }

  /**
   * Returns the polygon defining the region.
   * @returns {Polygon} The polygon defining the region.
   */
  getPolygon() {
    return this._polygon;
  }

  getGmapPolygon() {
    return this._osmObject.geojson.coordinates[0].map(pair => new Coordinates(pair).toGmaps());
  }

  /**
   * Return the bounding box defining the region in the form: [y_min, y_max, x_min, x_max].
   * @returns {array} The coordinates defining the bounding box of the region (in degrees).
   */
  getBoundingBox() {
    return this._boundingBox;
  }

  /**
   * The southernmost point of the bounding box.
   * @returns {float} Southernmost point of the bounding box (in degrees).
   */
  getMinLat() {
    return this._boundingBox[0];
  }

  /**
   * The northernmost point of the bounding box.
   * @returns {float} Northernmost point of the bounding box (in degrees).
   */
  getMaxLat() {
    return this._boundingBox[1];
  }

  /**
   * The westmost point of the bounding box.
   * @returns {float} Westmost point of the bounding box (in degrees).
   */
  getMinLng() {
    return this._boundingBox[2];
  }

  /**
   * The eastmost point of the bounding box.
   * @returns {float} Eastmost point of the bounding box (in degrees).
   */
  getMaxLng() {
    return this._boundingBox[3];
  }


  /**
   * Returns the coordinates of a corner of the bounding box.
   * @param {string} corner Directions of the corner (e.g. 'NW', 'NE', 'SW', 'SE')
   * @returns {array} Coordinates of the corner in the form [lon, lat].
   * @throws {} 
   */
  getCornerCoordinates(corner) {
    switch(corner) {
    case 'NW':
      return new Coordinates([this.getMinLng(), this.getMaxLat()]);
    case 'NE':
      return new Coordinates([this.getMaxLng(), this.getMaxLat()]);
    case 'SW':
      return new Coordinates([this.getMinLng(), this.getMinLat()]);
    case 'SE':
      return new Coordinates([this.getMaxLng(), this.getMinLat()]);
    default:
      throw new Error('The allowable corners are "NW", "NE", "SW" or "SE".');
    }
  }


  /**
   * Verifies whether a set of coordinates is contained within the Polygon corresponding to the region.
   * @param {array} coordinates Coordinates in the form [lon, lat].
   * @returns {bool} Whether the coordinates are located within the polygon.
   */
  polygonContains(coordinates) {
    const contained = this._polygon.containsPoint(Vec2(coordinates.asArray()));
    return contained;
  }

  /**
   * Checks whether a coordinates pair is located within the region's bounding box.
   * @param {array} coordinates Coordinate pair of the form [lon, lat].
   * @returns {bool} Whether the coordinates are located within the region's bounding box.
   */
  boundingBoxContains(coordinates) {
    const lng = coordinates.getLng();
    const lat = coordinates.getLat();
    const latWithinBBox = lat >= this.getMinLat() && lat <= this.getMaxLat();
    const lngWithinBBox = lng >= this.getMinLng() && lng <= this.getMaxLng();
    return latWithinBBox && lngWithinBBox;
  }

  /**
   * Checks whether the coordinates correspond to a location where a photo could be taken (i.e. within the polygon
   * and not within water).
   * @param {array} coordinates Coordinates in the form [lon, lat].
   * @param {string} apiKey The API key to make a call to Static Maps to check for water.
   * @returns {} 
   */
  async isValidPosition(coordinates, apiKey) {
    // Check if the coordinates are within the polygon

    const coordinatesOutOfRegion = !this.polygonContains(coordinates);


    if(coordinatesOutOfRegion) return false;

    const inWater = await this._isInWater(coordinates, apiKey);
    return !inWater;
  }


  // TODO move this to the API section.
  /**
   * Makes a call to the Static Maps API to check whether a coordinates pair is in water.
   * @param {array} coordinates Coordinate pair of the form [lon, lat].
   * @param {string} apiKey API key used to make the call.
   * @returns {bool} Whether the coordinates are in water.
   */
  async _isInWater(coordinates, apiKey) {
    const waterQuery = `http://maps.googleapis.com/maps/api/staticmap?center=${coordinates.asString()}&zoom=20`
          + `&size=1x1&maptype=roadmap&sensor=false&key=${apiKey}`;
    const pixels = await getPixels(waterQuery);
    return pixels.data[0] === 163 && pixels.data[1] === 203 && pixels.data[2] === 255;
  }

  /**
   * Checks whether all the necessary data is available to instantiate the Region object.
   * @param {Object} osmObject The OpenStreetMap object returned by Nominatim.
   * @throws {Error} Throws an error if the object is missing keys necessary to collect imagery or important metadata.
   */
  _validateOsmObject(osmObject) {
    const expectedKeys = [
      'place_id',
      'boundingbox',
      'geojson',
      'lat',
      'lon',
      'class',
      'type',
      'importance',
      'address',
    ];

    if (!expectedKeys.every(key => osmObject[key])) {
      throw new Error('There are missing keys in the OpenStreetMap object passed to the Region constructor.');
    }
  }
};

module.exports = Region;
