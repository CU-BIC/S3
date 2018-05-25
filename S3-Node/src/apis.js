const axios = require('axios');
const fs = require('fs');
const Coordinates = require('./coordinates.js');
const ndarray = require('ndarray');
const PNG = require('pngjs').PNG;
const APILimitError = require('./errors.js').APILimitError;

// CONSTANTS
const BATCH_LIMIT = 100;

function decodePng(image) {
  return new Promise((resolve, reject) => {
    const png = new PNG();
    png.parse(image, (err, data) => {
      if (err) reject(err);
      const array = ndarray(new Uint8Array(data.data), [data.width|0, data.height|0, 4], [4, 4*data.width|0, 1], 0);
      resolve(array);
    });
  });
}

// FUNCTIONS
async function checkForWater({ coordinates, apiKey }) {
  const query = `http://maps.googleapis.com/maps/api/staticmap?center=${coordinates.asString()}&zoom=20`
        + `&size=1x1&maptype=roadmap&sensor=false&key=${apiKey}`;
  try {
    const response = await axios.get(query, {responseType: 'arraybuffer'});
    const image = await decodePng(response.data);
    const inWater = parseInt(image.data[0]) === 163 && parseInt(image.data[1]) === 203 && parseInt(image.data[2]) === 255;
    return inWater;

  } catch (err) {
    if(err.response.status === 403) {
      const error = new APILimitError('Static Maps', apiKey);
      throw error;
    } else {
      throw err;
    }
  }
}


async function fetchSnappedCoordinates({ coordinates, apiKey }) {
  const formattedCoordinates = coordinates
        .map(pair => pair.asString())
        .join('|');
  const query = `https://roads.googleapis.com/v1/nearestRoads?points=${formattedCoordinates}&key=${apiKey}`;
  try {
    const response =  await axios.get(query);

    const snappedPointsDict = {};
    [...new Set(response.data.snappedPoints)].forEach(snapped => {
      snappedPointsDict[snapped.originalIndex - 1] = new Coordinates(snapped.location.latitude, snapped.location.longitude);
    });

    const snappedPoints = coordinates.map((unsnappedPoint, i) => {
      if(snappedPointsDict[i]) {
        unsnappedPoint.setSnappedCoordinates(snappedPointsDict[i]);
        return unsnappedPoint;
      } else {
        unsnappedPoint.setSnappedCoordinates(null);
        return unsnappedPoint;
      }
    });
    return snappedPoints;
  } catch (err) {
    if (err.response.code === 400) {
      console.log('error 400')
      console.log(err);
    } else if (err.response.code === 429) {
      throw new APILimitError('Roads', apiKey);
    } else {
      throw err;
    }
  }
}

async function fetchImages({ coordinates, settings, apiKey, heading }) {
  const { width, height, pitch, fov, destination, filesPrefix } = settings; //TODO allow for multiple headings

  const query = `https://maps.googleapis.com/maps/api/streetview?size=${width}x${height}&location=${coordinates.asString()}&fov=${fov}&heading=${heading}&pitch=${pitch}&key=${apiKey}`;
  const requestParams = {
    responseType:'stream',
  };
  try {
    const response = await axios.get(query, requestParams);
    response.data.pipe(fs.createWriteStream(`${destination}/images/${filesPrefix}_${coordinates.getLat()}_${coordinates.getLng()}_${heading}.jpg`));
    return;
  } catch(err) {
    if(err.response.status === 429) {
      throw new APILimitError('Street View', apiKey);
    }
    throw err;
  }
}

module.exports = {
  BATCH_LIMIT,
  fetchSnappedCoordinates,
  fetchImages,
  checkForWater,
};
