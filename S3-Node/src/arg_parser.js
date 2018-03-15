
const ArgumentParser = require('argparse').ArgumentParser;

const parser = new ArgumentParser({
  addHelp: true,
  version: '0.0.1',
  description: 'Parser for S3\'s Google Car',
});

parser.addArgument(
  ['-r', '--region'],
  {
    help: 'The region to cover. This should be an OpenStreetMap object in the JSON format.',
    type: 'string',
    required: true,
  }
);

parser.addArgument(
  ['-e', '--resolution'],
  {
    help: 'The resolution of the sampling; in other words the spacing of the sampling grid.',
    type: 'float',
    required: true,
  }
);

parser.addArgument(
  ['-f', '--file-prefix'],
  {
    help: 'The prefix of that files related to this search should have.',
    required: false,
    defaultValue: '',
  }
);

parser.addArgument(
  ['-n', '--headings'],
  {
    help: 'The prefix of that files related to this search should have.',
    defaultValue: 2,
    choices: [1, 2, 4],
    type: 'int',
    required: false,
  }
);

/*
parser.addArgument(
  ['-v', '--verbose'],
  {
    help: 'Whether car coordinates and other information should be printed to the console.',
    defaultValue: false,
    required: false,
  }
);
*/

parser.addArgument(
  ['-d', '--destination'],
  {
    help: 'The directory in which the files related to this search should be saved.',
    defaultValue: false,
    type: 'string',
    required: true,
  }
);

module.exports = parser;
