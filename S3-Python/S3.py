#!/usr/bin/python
####################################
# systematic_streetview_sampler.py #
#        Author: Kevin Dick        #
#           Version: 3.0           #
#                                  #
#  This script iterates over the   #
#  bounding box region, evaluating #
#  each sampled coordinated for    #
#  water, the nearest roadway, the #
#  streetview panorama, and grabs  #
#  various images...               #
####################################
import os, sys
import math
import urllib, urllib2
import json
import requests
from shapely.geometry import Point
from shapely.geometry import Polygon
from shapely.geometry.polygon import LinearRing
from scipy import ndimage
import cStringIO
import subprocess


# Default Parameters - To be user-specified and overwritten...
API_KEY       = ''
IMG_DIR       = './'
IMAGE_WIDTH   = '640'
IMAGE_HEIGHT  = '360'
DEFAULT_PITCH = 0 
NUM_STEPS     = 1    # Acquire a Single point at each location...
VERBOSE       = False

# Constants - Must be left unchanged!
GOOGLE_BLUE = (163, 203, 255) # Hopefully this wont change...
BATCH_LIMIT = 100             # Google Roads API batch limit
EARTH_RADIUS = 6371.001       # On average...
NORTH, EAST, SOUTH, WEST = 0, 90, 180, 270
 

def write_to_file(target_file, data):
        f_write = open(target_file, 'a')
        f_write.write(data + '\n')
        f_write.close()

def load_coordinates(filename):
	""" load_coordinates
	Loads from file the lat,lon coordinate pairs.
	Input: The file path + name
	Output: List of lat,lon tuples
	"""
	coordinates = []
	f = open(filename, 'r')
	for line in f:
		lon = float(line.split(',')[0])
                lat = float(line.split(',')[1])
		coordinates.append((lat, lon))
	return coordinates

def get_regional_polygon(region_file, cities_files):
	""" get_regional_polygon
	Loads the coordinates of the boundingbox of a search region and creates a Polygon object.
	Also loads each city/region to exlude.
	Input: The search region filename, a list of filenames for exclusion
	Output: A Polygon object of the bounding search region, a list of Polygon objects for each exlusion.
	"""
	region_poly = Polygon(load_coordinates(region_file))

	# Iterated over list of cities files to exclude
	city_exclusions = []
	for city_file in cities_files:
		city_polygon = Polygon(load_coordinates(city_file))
		city_exclusions.append(city_polygon)

	return region_poly, city_exclusions

def teleport(start_lat, start_lon, bearing, distance):
	"""
    	Input: Start lat, lon, the bearing (usually Cardinal, in degrees), and distance in m.
    	Output: The lat, lon at the teleportation point
    	"""
    	# Convert the current lat, lon, bearing to radians
    	start_lat = math.radians(start_lat)
    	start_lon = math.radians(start_lon)
    	bearing = math.radians(bearing)
	distance /= 1000 # Cast to Kms

	# Compute new values using radians, and convert back to degrees
	end_lat = math.asin(math.sin(start_lat) * math.cos(distance / EARTH_RADIUS) + \
	                    math.cos(start_lat) * math.sin(distance / EARTH_RADIUS) * math.cos(bearing))
	end_lon = start_lon + math.atan2(math.sin(bearing) * math.sin(distance / EARTH_RADIUS) * math.cos(start_lat), \
        	                         math.cos(distance / EARTH_RADIUS) - math.sin(start_lat) * math.sin(end_lat))
    	end_lat = math.degrees(end_lat)
	end_lon = math.degrees(end_lon)

	return end_lat, end_lon

def regional_validity(query_point, regional_inclusion, regional_exclusions):
	""" regional_validity
	Returns whether a coordinate point is inside a polygon and outside of excluded regions.
	Input: A Point object, a Polygon Object of the inclusion region; a list of Polygon Objects of excluded regions.
	Output: True if the query point is both inside the regional polygon and outside all exlusions; False otherwise.
	"""
	if query_point.within(regional_inclusion):
        	# Check if the point co-occurs with city areas...
                for city in regional_exclusions:
                	if query_point.within(city):
                        	return False
		return True
	return False

def land_validity(lat, lon):
	""" land_validity
	Returns whether a lat,lon pair are over land (not over water) or not.
	Input: A latitude and longitude value.
	Output: True if the coordinates are NOT over water, False otherwise.
	"""
	r, g, b = google_check_over_water(lat, lon)
        if (r, g, b) == GOOGLE_BLUE: return False
	return True

def get_forward_path_images(coord_path, path_ref):
	""" get_forward_path_images
	Iterates over all coordinate points in a series and acquires the forward-facing google street view image.
	Input: List of lat,lon,heading tuples corresponding to a walked series of adjacent panoramas; path reference id for this unique series.
	Output: None. Saves all the files to the IMG_DIR
	"""
	for step in range(1, len(coord_path)): # Ignore the initial point with non-meaningful heading...
        	step_lat      = str(coord_path[step][0])
                step_lon      = str(coord_path[step][1])
                step_heading  = str(coord_path[step][2])
                write_to_file(true_file, step_lat + ',' + step_lon + ',truepnt_' + str(true_count) + '_step_' + str(step))

                # Create Unique Filename
                filename = IMG_DIR + 'img_ref_' + str(path_ref) + '_stp_' + str(step) + '_lat_' + step_lat + '_lon_' + step_lon + '_hdg_' + str(step_heading) + '.jpg'

                # Here we now grab the image and build up our automatic dataset!
                if VERBOSE: print 'Saving Image : ' + filename
		request_and_save(IMAGE_WIDTH, IMAGE_HEIGHT, step_lat, step_lon, step_heading, DEFAULT_PITCH, API_KEY, filename)


def get_bidirectional_path_images(coord_path, path_ref):
        """ get_bidirectional_path_images
        Iterates over all coordinate points in a series and acquires both the forward-facing and rear-facing google street view image.
        Input: List of lat,lon,heading tuples corresponding to a walked series of adjacent panoramas; path reference id for this unique series.
        Output: None. Saves all the files to the IMG_DIR
        """
        for step in range(0, len(coord_path)): # Ignore the initial point with non-meaningful heading...'
                step_lat      = str(coord_path[step][0])
                step_lon      = str(coord_path[step][1])
                step_hdg_f    = str(coord_path[step][2])
		step_hdg_r    = str(float(step_hdg_f) + 180)

                # Create Unique Filename
                filename_f = IMG_DIR + 'img_ref_' + str(path_ref) + '_stp_' + str(step) + '_lat_' + step_lat + '_lon_' + step_lon + '_hdg_' + str(step_hdg_f) + '.jpg'
		filename_r = IMG_DIR + 'img_ref_' + str(path_ref) + '_stp_' + str(step) + '_lat_' + step_lat + '_lon_' + step_lon + '_hdg_' + str(step_hdg_r) + '.jpg'
                
		# Here we now grab the image and build up our automatic dataset!
                if VERBOSE: print 'Saving Images : ' + filename_f + '\t' + filename_r
                request_and_save(IMAGE_WIDTH, IMAGE_HEIGHT, step_lat, step_lon, step_hdg_f, DEFAULT_PITCH, API_KEY, filename_f)
		request_and_save(IMAGE_WIDTH, IMAGE_HEIGHT, step_lat, step_lon, step_hdg_r, DEFAULT_PITCH, API_KEY, filename_r)


def process_batch_coordinates(roads_list):
	""" process_batch_coordinates
	For the coordinate input we run the walk_algorithm and acquire corresponding images.
	Input: List of lat,lon pairs corresponding to roads.
	Output: None; all images are saved to IMG_DIR.
	"""
	for coord in roads_list:
        	if coord == None:
                        #write_to_file(false_file, str(cur_lon) + ',' + str(cur_lat) + ',false_pnt' + str(false_count))
                        continue
		# Unpack, get path coordinates, grab corresponding Street View images!
                road_lat, road_lon = coord
                path = walk_algorithm(road_lat, road_lon, NUM_STEPS)
                get_bidirectional_path_images(path, 0) # TODO: Put a reference counter here...

def google_check_over_water(lat, lon):
	query = 'http://maps.googleapis.com/maps/api/staticmap?center=' + \
		 str(lat) + ',' + str(lon) + \
		 '&zoom=' + str(20) + '&size=1x1&maptype=roadmap&sensor=false&key=' + API_KEY
	
	# Submit Query, Obtain response, format as image, return R,G,B components
	try:
		f = cStringIO.StringIO(urllib2.urlopen(query).read())
	except urllib2.HTTPError:
		print 'GOOGLE Static Maps API LIMIT\nRestart the search at the following coordiantes: (' + str(lat) + ', ' + str(lon) + ')'
		email_notification()
                sys.exit(0)
		
	image = ndimage.imread(f, mode='RGB')[0][0]
        return image[0], image[1], image[2]

# Legacy. Kept around for one-off API calls...
def google_snap_to_nearest_road(lat, lon):
	"""google_snap_to_nearest_road
	Calls the Google Roads API which returns the coordinates of the nearest road to a lat,lon point.
	CAUTION: Consumes one request of the 2500 Request/Day limit of the Free developper api.
	"""
	query = 'https://roads.googleapis.com/v1/nearestRoads?' + \
		'points=' + str(lat) + ',' + str(lon) + \
		'&key=' + API_KEY
	response = json.loads(requests.get(query).text)
        
	if not response: # Empty dictionaries evaluate to False
		return None, None
	try:	
		road_lat = float(response['snappedPoints'][0]['location']['latitude'])
		road_lon = float(response['snappedPoints'][0]['location']['longitude'])
		return road_lat, road_lon

	except KeyError: # Likely due to hitting the limits of the Google Roads API
		print 'GOOGLE ROADS API LIMIT\nRestart the search at the following coordiantes: (' + str(lat) + ', ' + str(lon) + ')'
		sys.exit(0)
	
def google_snap_to_nearest_road_batch(latlon_list):
        """ google_snap_to_nearrest_road_batch
        Optimizes the calls to the Google Roads API by submitting batches of 100 lat,lon pairs at a time.
        Need to extract the corresponding results from the returned JSON object.
        Input: A list of 100 tuples of lat,lon pairs
        Output: A list of 100 new tuples of lat,lon pairs corresponding to nearest roads.
		The last if multiple snapped roads; None if nothing returned.
        """
        points = '|'.join([str(coord[0]) + ',' + str(coord[1]) for coord in latlon_list])
        query = 'https://roads.googleapis.com/v1/nearestRoads?' + \
                'points=' + points + \
                '&key=' + API_KEY
        response = json.loads(requests.get(query).text)
        response_list = [None] * len(latlon_list) # Initialize output list...
        for r in response['snappedPoints']:
        	response_list[r['originalIndex']] = (r['location']['latitude'], r['location']['longitude'])

	return response_list

def coordinate_distance(lat1, lon1, lat2, lon2):
	""" coordinate_distance
	Computes the Equirectangular approximation of the distance between two coordinate points.
	Returns: Distance, d, in planar space.
	"""
	x = (lon2 - lon1) * math.cos((lat1 + lat2) / 2)
	y = lat2 - lat1
	d = math.sqrt(x ** 2 + y ** 2) * EARTH_RADIUS
	return d

def walk_algorithm(start_lat, start_lon, num_steps):
	""" walk_algorithm
	
	Returns: An array of tuples with each lat,lon,heading relative to the prior.
	"""
	cur_lat = start_lat
	cur_lon = start_lon
	
	path = [(cur_lat, cur_lon, 0)] # Initialize a dummy heading to remain consistent
	while num_steps > 0:
		num_steps -= 1
		data = adjacent_points(cur_lat, cur_lon)
		
		# Get matching lists for each element...
		keys, headings, panos, coords = process_data(data)
		
		# Prevent Cycles: If the lat,lon pair already exist on the path, remove it...
		# CAUTION: This becomes a bottleneck when creating long paths! ==> O(n^2) comparisons...
		for prior_lat, prior_lon, prior_heading in path:
			if (prior_lat, prior_lon) in coords: coords.remove((prior_lat, prior_lon))
		
		# Theoretically there will always be a remaining coordinate on a mapped bi-directional road...
		# Otherwise we hit a dead-end or more specifically, the end of the mapping.
		if not coords: return path # The list is empty so simply return the existing path

		# Select the coordinate pair that maximizes the distance from the prior point
		dists = [abs(coordinate_distance(cur_lat, cur_lon, x[0], x[1])) for x in coords]
		idx = dists.index(max(dists))
		
		# Grab the new coords and heading based on the mazimizing distance from index, idx
		cur_lat, cur_lon = coords[idx]
		heading = headings[idx]		
		path.append((cur_lat, cur_lon, heading))
		
	# Uncomment to check out path...
	#for i in range(len(path)): print str(i) + ',' + str(path[i][0]) + ',' + str(path[i][1]) + ',' + str(path[i][2])
	return path

def process_data(stream_output):
	""" process_data
	Processes the streamed output of the adjacent_points function which calls the get_next_panorama.js function.
	Reformatting the output of that script will require updating the data handling here...
	Currently, the output stream is ordered as:
	key:#
	heading:#
	pano:char(array)
	...
	latlon:###,###
	latlon:###,###

	The key and latlon pair orderings are conserved.

	TODO :: Rewrite the output to JSON and simply parse it here...
	"""
	# TODO :: Intelligently utilize and track the pano ids and key ids
	# Naively just grabbing the latlon pairs here and their corresponding headings...
	as_list = stream_output.split('\n')
	keys     = []
	headings = []
	panos    = []
	coords   = []
	for elem in as_list: # There is a non-zero probability these terms end up in the pano id...~
		if   'key'     in elem: keys.append(int(elem.split(':')[1]))
		elif 'heading' in elem: headings.append(float(elem.split(':')[1]))
		elif 'pano'    in elem: panos.append(elem.split(':')[1])
		elif 'latlon'  in elem: coords.append((float(elem.split(':')[1].split(',')[0]), float(elem.split(':')[1].split(',')[1])))
		# Otherwise simply skip over

	# Our arrays are now populated and the indecies match one another!
	return keys, headings, panos, coords

def adjacent_points(cur_lat, cur_lon):
	""" adjacent_points
	Get the adjacent panoramas, choose the one maximimizing distance from prior
	In the first point case, the priors will also be the current so first point is chosen
	Uses: StreetViewPanoramaLocation.getLocation()

	Currently requires a 3 second window for the aquisition of each set of adjacent points due to the JSDOM.
	The get_next_panorama.js can likely be improved - 3 seconds is acceptable for the present purposes.
	"""
	args = ['node', './javascript_panoramas/get_next_panorama.js', str(cur_lat), str(cur_lon)]
        process = subprocess.Popen(args, stdout = subprocess.PIPE, stderr = subprocess.PIPE)
        output = process.communicate()[0]
	return output

def google_check_image_existence(width, height, lat, lon, heading, pitch):
	"""check_image_existence
	Submits a Google API query to verify whether an image exists at the
	specified parameters. Useful when getting the starter coordinates
	for the curated dataset. 
	RETURN: True if image is present, False if not.
	"""
	query = 'https://maps.googleapis.com/maps/api/streetview/metadata?size=' + \
		 str(width) + 'x' + str(height) + \
		 '&location=' + str(lat) + ',' + str(lon) + \
		 '&heading='  + str(heading) + '&pitch=' + str(pitch) + \
		 '&key=' + API_KEY
	response = json.loads(requests.get(query).text)
	print 'JSON Status Field: ' + response['status']

def request_and_save(width, height, lat, lon, heading, pitch, key, filename):
	query = 'https://maps.googleapis.com/maps/api/streetview?size=' + \
		str(width) + 'x' + str(height) + \
	        '&location=' + str(lat) + ',' + str(lon) + \
	        '&heading=' + str(heading) + '&pitch=' + str(pitch) + \
	        '&key=' + str(key)
	urllib.urlretrieve(query, filename)

def email_notification():
	""" email_notification
	Useful for alerting when an API_LIMIT is hit.
	Set up with your own SMTP server!
	"""
	import smtplib, base64
	server = smtplib.SMTP('', 587)
	server.login("")
	msg = "API LIMIT HIT!" 
	server.sendmail("api_limiter@google.com", "your_email@here.com", msg)
