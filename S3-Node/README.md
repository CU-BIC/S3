# S3.js (beta)

S3.js is the Node implementation of the Systematic Street View Sampling algorithm presented at the
Computer and Robot Vision 2018 conference.

This implementation of the S3 algorithm comprises the following features:

* Retrieval of images for a polygon defined as part of a GeoJSON file
* Logging (is a particular coordinate on land, does it snap to road, etc.)

## Requirements

* Node.js (v8.0+) + npm
* A valid Google account

## Instructions

1. First, you will need to activate the following APIs using the <a href="https://docs.google.com/presentation/d/10_oUTTb5iWLxlSnIrugUWkeGq5XVyiDwuzMBQ7OVasg/edit?usp=sharing">Google Cloud API dashboard</a>: 

* Google Roads API
* Google Javascript API
* Google Maps Static API
* Google Street View API

To activate the APIs and retrieve an API key, click on <i>Library</i> in the left side bar (under <i>APIs & Services</i>) and search for and enable the APIs listed above. You will need to create a project first. The process is illustrated in an <a href="http://bioinf.sce.carleton.ca/public/S3-Account-Creation.mp4">example video</a>.

2. Clone the repository somewhere and change directories to the Node version.

```
git clone https://github.com/CU-BIC/S3.git && cd S3/S3-Node && npm install
```

4. Create a JSON file with you API key(s) in the following format.

```
{
  "apiKeys": [
    "<PUT YOUR API KEY HERE>"
  ]
}
```

4. Get you OpenStreetMaps JSON document for the region of interest

Note that the algorithm requires a OpenStreetMaps JSON document as an input. They have the following structure:

```
{
    "place_id":"179282995",
    "licence":"Data © OpenStreetMap contributors, ODbL 1.0. https:\/\/osm.org\/copyright",
    "osm_type":"relation",
    "osm_id":"324211",
    "boundingbox":[
        "43.5802533",
        "43.8554425",
        "-79.6392727",
        "-79.1132193"
    ],
    "lat":"43.653963",
    "lon":"-79.387207",
    "display_name":"Toronto, Ontario, Canada",
    "class":"place",
    "type":"city",
    "importance":0.28401925973806,
    "icon":"https:\/\/nominatim.openstreetmap.org\/images\/mapicons\/poi_place_city.p.20.png",
    "address":{
        "city":"Toronto",
        "state":"Ontario",
        "country":"Canada",
        "country_code":"ca"
    },
    "geojson":{
        "type":"Polygon",
        "coordinates":[
          ...
        ]
    }
}
```

They can be downloaded using the Nominatim API. We might be able to modify the code so that it accepts different formats in the future if time permits.

You can obtain the JSON for your city of interest like so:
```
curl -o <OUTPUT_PATH> "https://nominatim.openstreetmap.org/search/<REGION OF INTEREST>/?format=json&addressdetails=1&polygon_geojson=1" 
```

Your file will contain an array with multiple such entries, so to find which one is right, I suggest going to https://www.openstreetmap.org/search?query=REGION_OF_INTEREST_HERE
and looking at the different results. The order corresponds with that of the JSON file, so identify the index of the right one and extract the right entry from the 
json file (start counting from zero). Acceptable geojson types are "Polygon" and "Multipolygon", not "Point".

5. Run the <i>run_s3.js</i> script to start data collection.
```
node run_s3.js -r <path to the GeoJSON file> \
-e <sampling resolution> \
-f <file prefix> \
-n <number of headings> \
-d <path to destination folder> \
-k <path to json file with API key(s)> \
-i <index of correct entry in json file>
```

