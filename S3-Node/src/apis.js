const axios = require('axios');
const fs = require('fs');
const Coordinates = require('./coordinates.js');
const APILimitError = require('./errors.js').APILimitError;

// CONSTANTS
const BATCH_LIMIT = 100;

// FUNCTIONS
async function fetchSnappedCoordinates({ coordinates, apiKey }) {
  const formattedCoordinates = coordinates
        .map(pair => pair.asString())
        .join('|');
  const query = `https://roads.googleapis.com/v1/nearestRoads?points=${formattedCoordinates}&key=${apiKey}`;

  try {
    const response =  await axios.get(query);
    const snappedPoints = [...new Set(response.data.snappedPoints)] // Some points appear to be duplicates...
          .map(point => new Coordinates(point.location.latitude, point.location.longitude));
    return snappedPoints;
  } catch (err) {
    if (err.response.code === 429) {
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
};
