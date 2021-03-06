const GoogleCar = require('./src/google_car');
const parser = require('./src/arg_parser.js');
const readFileSync = require('fs').readFileSync;
const resolve = require('path').resolve;

// Create a little parser so that we can pass some argzzzz to dat small script.
const args = parser.parseArgs();

// Open the file with the OSM JSON corresponding to the region (for now, assume the first object is the city)
const region = JSON.parse(readFileSync(resolve(args.region)))[args.index];

// Create a Google Car
const car = new GoogleCar({
  region: region,
  apiKeys: require(resolve(args.keys)).apiKeys,
  stopDistance: args.resolution,
  verbose: true,
  headings: args.headings,
  settings: {
    mode: args.mode, 
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
