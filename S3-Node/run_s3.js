const GoogleCar = require('./src/google_car');
const parser = require('./src/arg_parser.js');
const apiKeys = require('./api_keys.json').apiKeys; // TODO the file should be passed in as an argument
const readFileSync = require('fs').readFileSync;

// Create a little parser so that we can pass some argzzzz to dat small script.
const args = parser.parseArgs();

// Open the file with the OSM JSON corresponding to the region (for now, assume the first object is the city)
const region = JSON.parse(readFileSync(args.region))[0];

// Create a Google Car
const car = new GoogleCar({
  region: region,
  apiKeys: apiKeys,
  stopDistance: args.resolution,
  verbose: true,
  headings: 4, // 1, 2 or 4
  settings: {
    mode: 'images', // 'images' for image download, or 'panorama' just to obtain the panoramas (and lat/lng) to download...
    filesPrefix: args.file_prefix,
    destination: args.destination,
    width: 640,
    height: 360,
    fov: 90,
    pitch: 0,
  },
});

// Start dat car and let it collect dem images
car.start();
