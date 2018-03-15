

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

  toGmaps() {
    return { lat: this._lat, lng: this._lng };
  }

  isInRegionBBox(region) {
    return region.boundingBoxContains(this);
  }

  isInRegionPolygon(region) {
    return region.containsCoordinates(this);
  }
}

module.exports = Coordinates;
