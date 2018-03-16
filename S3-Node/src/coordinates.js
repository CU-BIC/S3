

class Coordinates {

  constructor(latOrArray, lng) {
    if(latOrArray.constructor === Array) {
      this._lat = latOrArray[1];
      this._lng = latOrArray[0];
    } else if (latOrArray.constructor === Object) {
      this._lat = latOrArray.lat;
      this._lng = latOrArray.lng;
    } else {
      this._lat = latOrArray;
      this._lng = lng;
    }
    this._isInPolygon = null;
    this._isInWater = null;
    this._snappedCoordinates = null;
    this._panorama = null;
  }

  clone() {
    let clone = new Coordinates(this._lat, this._lng);
    clone._isInPolygon = this._isInPolygon;
    clone._isInWater = this._isInWater;
    this._panorama = this._panorama && {...this._panorama};
    if (this._snappedCoordinates){
      clone._snappedCoordinates = new Coordinates(this._snappedCoordinates.getLat(), this._snappedCoordinates.getLng());
    }
    return clone;
  }

  async fetchPanorama({ panoramaFetchFunction, radius }) {
    try {
      const panorama = await panoramaFetchFunction({ coordinates: this, radius });
      if(panorama && panorama.status !== 'ZERO_RESULTS') {
        this._panorama = panorama;
      }  
    } catch (err) {
      throw err;
    }
  }

  toString() {
    return `(${this.asString()})`;
  }

  getLat() {
    return this._lat;
  }

  getLng() {
    return this._lng;
  }

  asArray() {
    return [this._lng, this._lat];
  }

  asString() {
    return `${this._lat},${this._lng}`;
  }

  asCsvLine() {
    return `${this.asString()},${this._isInPolygon},${this._isInWater},${this.getSnappedCoordinates() ? this.getSnappedCoordinates().asString() : 'null,null'},NOTIMP`;
  }

  setSnappedCoordinates(snappedCoordinates) {
    this._snappedCoordinates = snappedCoordinates && snappedCoordinates.clone();
  }

  getSnappedCoordinates() {
    return this._snappedCoordinates;
  }

  hasSnappedCoordinates() {
    return this._snappedCoordinates !== null;
  }

  toGmaps() {
    return { lat: this._lat, lng: this._lng };
  }

  isInRegionBBox(region) {
    return region.boundingBoxContains(this);
  }

  isInRegionPolygon(region) {
      return region.polygonContains(this);
  }

  async isInWater({ region, apiKey }) {
      return await region._isInWater({ coordinates: this, apiKey });
  }

  async isGoodSeed({ region, apiKey }) {
    const inPolygon = this.isInRegionPolygon(region);
    this._isInPolygon = inPolygon;

    if(!inPolygon) return false;

    const inWater = await !this.isInWater({ region, apiKey });
    this._isInWater = inWater;
    return !inWater;
  }

  setProperty(property, value) {
    this[property] = value;
  }
}

module.exports = Coordinates;
