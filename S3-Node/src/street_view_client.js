/**
 * Contains the Google Client that is used to interact with the Google Street View API.
 *
 * @file   This file exports the Google Street View API capable of interfacing with Google's Street View API.
 * @author Francois Charih <francois.charih@carleton.ca>
 * @since  11-03-18
 */

const JSDOM = require('jsdom').JSDOM;

/**
 * Returns a Google Street View client object.
 *
 * @param {string} apiKey
 * @returns {Object} GoogleStreetView client
 */
function GSVClient({ apiKey }) {
  return new Promise((resolve, reject) => {
      //const deasync = require('deasync');
  const timeLaunch = new Date().getTime();
  const dom = new JSDOM(`
<!DOCTYPE html>
    <html>
        <body></body>
    <script>

       /* Function that loads the GSV client JS */
       window.loadScript = function (url, callback) {
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

     /* Load the script */
     window.getClient = function (callback) {
      loadScript("https://maps.googleapis.com/maps/api/js?key=${apiKey}", function() { var client = new google.maps.StreetViewService(); callback(client); })
    }
    </script>
    </html>
`, { runScripts: 'dangerously', resources: 'usable' });

  // Point Node's window namespace to the Virtual DOM's
  global.window = dom.window;

  // To make this pseudo-synchronous, loop until the client is ready
  // Note: this is not particularly elegant, but since the client is instantiated
  // once for every API key, it is an acceptable solution.
  var clientReady = false;
    window.getClient(function(client) { window.client = client; resolve(client); })
  })
}


module.exports = GSVClient;
