////////////////////////////////
//    get_next_panorama.js    //
//     Author: Kevin Dick     //
//                            //
// Sets up a JSDOM env. to run//
// the Google Javascript API  //
// to request panoramas and   //
// obtian the links to the    //
// adjacent panoramas.        //
// Prints data to STDOUT to be//
// captured by a calling      //
// script or visualized...    //
////////////////////////////////

// Usage: $ node get_next_panorama.js <LATITUDE> <LONGITUDE> <API_KEY>
// Calling StreetView API Using NodeJS
// Emulation of the HTML Enviroment achieved using JSDOM Environment
// References: 
//	https://stackoverflow.com/questions/41958271/load-google-maps-api-in-jsdom
//	https://stackoverflow.com/questions/47084618/next-panorama-id-in-street-view
//


var LATITUDE  = process.argv[2];
var LONGITUDE = process.argv[3];
var SEARCH_RADIUS = 50; // TODO :: Ibid...
var KILL_TIMEOUT = 3000; // TODO :: Temorarily use this to kill JSDOM...


function get_next_panoramae(lat, lon, api_key) {
    const jsdom = require("jsdom");
    const { JSDOM } = jsdom;

    const dom = new JSDOM(`
    <!DOCTYPE html>
    <html>
        <body>
            <div id="map"></div>
            <script>
		var api_key = ''; // YOUR API KEY HERE!

                function initMap() {
		    	// Search to get the nearest Panorama around the lat,lon coordinates within 50 meters distance radius...
		    	var service  = new google.maps.StreetViewService();
		    	var panorama = service.getPanorama({location: {lat: ${lat}, lng: ${lon}}, radius: 50}, process_streetview_data);	
                }

		function process_streetview_data(data, status) {
			if (status == 'OK') {
				for (var key in data.links) { 
					// The link heading value corresponds to the original point (i.e. rear-facing)
					// To be forward-facing in our step, we add 180. Google manages 360+ cases by casting back to [0,360] range.
					var heading = data.links[key].heading + 180;
					var pano_id = data.links[key].pano;
					console.log('key:' + key)
					console.log('heading:' + heading);
					console.log('pano:'    + pano_id);
			
					// Get Location Data for this Panorama based on its Pano_Id
					var link_service  = new google.maps.StreetViewService();
					var link_panorama = link_service.getPanorama({pano: pano_id}, print_lat_lon);		
		    		}
				return;
		  	};
		}

		function print_lat_lon(data, status) {
			if (status == 'OK') {
				// TODO :: Figure out why the lat,lon values keep coming back as 'undefined'...
				// This is a temporary patch fix for now...
				var lat = JSON.stringify(data.location.latLng).split(',')[0].split(':')[1].replace('}', '');
				var lon = JSON.stringify(data.location.latLng).split(',')[1].split(':')[1].replace('}', '');
				console.log('latlon:' + lat + ',' + lon);
				return;
			};
		}

                function loadScript(url, callback) {
                	var head = document.getElementsByTagName('head')[0];
                   	var script = document.createElement('script');
                    	script.type = 'text/javascript';
                    	script.src = url;

                    	// Fire the loading
                    	head.appendChild(script);

                    	// Then bind the event to the callback function.
                    	// There are several events for cross browser compatibility.
                    	script.onreadystatechange = callback;
                    	script.onload = callback;
                }

                loadScript("https://maps.googleapis.com/maps/api/js?key=" + api_key, initMap);
            </script>
        </body>
    </html>
    `, {
        runScripts: "dangerously",
        resources: "usable"
    });
}

get_next_panoramae(LATITUDE, LONGITUDE, API_KEY);
// Kill the process after 3 seconds...
// TODO :: Figure out why the JSDOM Hangs... This inexplicable killing is inelegant.
// Must find a better way to terminate the JSDOM in a timely manner after retrieving lat,lon pairs!
setTimeout(function(){ process.exit(); }, KILL_TIMEOUT);
