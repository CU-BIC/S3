
const math = require('mathjs');
const Coordinates = require('./coordinates');

const EARTH_RAD = 6371.001;

const bearings = {
  'N': 0,
  'S': 180,
  'W': 270,
  'E': 90,
};

function degToRad(degAngle) {
  return Math.PI*degAngle/180.0;
}

function radToDeg(radAngle) {
  return radAngle*180/Math.PI;
}

function haversineDistance(c1, c2) {

  const dLat = degToRad(c2.getLat() - c1.getLat())
  const dLng = degToRad(c2.getLng() - c1.getLng())

  const a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(degToRad(c1.getLat())) * Math.cos(degToRad(c2.getLat())) * Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return EARTH_RAD * c * 1000; // For the distance in meters
}


function delta(coordinates, bearing, distance) {

  const lng = degToRad(coordinates.getLng());
  const lat = degToRad(coordinates.getLat());
  const radBearing = degToRad(bearing);
  const ratio = distance/(1000*EARTH_RAD);

  const newLat = math.asin(math.sin(lat) * math.cos(ratio) + math.cos(lat) * math.sin(ratio) * math.cos(radBearing));
  const newLng = lng + Math.atan2(math.sin(radBearing) * math.sin(ratio) * math.cos(lat), math.cos(ratio) - math.sin(lat) * math.sin(newLat));

  return new Coordinates(radToDeg(newLat), radToDeg(newLng));
}

module.exports = {
  haversineDistance,
  delta,
  bearings,
}
