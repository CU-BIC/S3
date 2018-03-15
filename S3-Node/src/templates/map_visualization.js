module.exports =
`
<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="initial-scale=1.0, user-scalable=no">
    <meta charset="utf-8">
    <title>Simple markers</title>
    <style>
      /* Always set the map height explicitly to define the size of the div
       * element that contains the map. */
      #map {
        height: 100%;
      }
      /* Optional: Makes the sample page fill the window. */
      html, body {
        height: 100%;
        margin: 0;
        padding: 0;
      }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script>

      function initMap() {
        var myLatLng = %s;
        var myPolygon = %s;


        var map = new google.maps.Map(document.getElementById('map'), {
          zoom: 4,
          center: myLatLng.coords[0]
        });

        myLatLng.coords.forEach(function(x, i) {
          new google.maps.Marker({
                    position: x,
                    map: map,
                    title: i
          });
        });

var bermudaTriangle = new google.maps.Polygon({
          paths: myPolygon.coords,
          strokeColor: '#FF0000',
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: '#FF0000',
          fillOpacity: 0.35
        });
        bermudaTriangle.setMap(map);


      }
    </script>
    <script async defer
    src="https://maps.googleapis.com/maps/api/js?key=%s&callback=initMap">
    </script>
  </body>
</html>
`;
