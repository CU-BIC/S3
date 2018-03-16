
const Coordinates = require('./coordinates');
const fetchSnappedCoordinates = require('./apis').fetchSnappedCoordinates;

class CoordinatesBatch {

  constructor() {
    this._coordinates = [];
    this._coordinatesSnapped = false;
  }

  empty() {
    this._coordinates = [];
    this._coordinatesSnapped = false;
  }

  store(batch) {
    this._coordinates = [...this._coordinates, ...batch.getCoordinates()];
  }

  add(coordinates) {
    this._coordinates.push(coordinates.clone());
  }

  isEmpty() {
    return this.getBatchSize() === 0;
  }

  isFull() {
    return this._coordinates.length === 100; //BATCH LIMIT
  }

  getBatchSize() {
    return this._coordinates.length;
  }

  getCoordinates() {
    return this._coordinates.map(coord => coord.clone());
  }

  async fetchPanoramas({ panoramaFetchFunction }) {
    for(let i = 0; i < this.getBatchSize(); i++) {
      await this._coordinates[i].fetchPanorama({ panoramaFetchFunction });
    }
  }

  async snapCoordinates({ apiKey }) {
    try {
        const snappedCoordinates = await fetchSnappedCoordinates({
          coordinates: this.getCoordinates(),
          apiKey,
        });

      this._coordinates = snappedCoordinates;
      this._coordinatesSnapped = true;
    } catch (err) {
      throw err;
    }
  }
}

module.exports = CoordinatesBatch;
