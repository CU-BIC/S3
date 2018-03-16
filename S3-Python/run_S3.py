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
import S3
import os, sys
import datetime
import argparse

parser = argparse.ArgumentParser()
parser.add_argument('coords', type = argparse.FileType('r', encoding = 'UTF-8'), required=True)
parser.add_argument("restart_lat", "-lat", type = float, help = "The Latitude to restart sampling", default = 999.0)
parser.add_argument("restart_lon", "-lon", type = float, help = "The Longitude to restart sampling", defaulth = 999.0)
parser.add_argument("-v", "--verbosity", action = "count", default = 0)
args = parser.parse_args()


# Summary Files :: -----------------
NOW        = datetime.datetime.now().strftime("%Y-%m-%d_%H-%M-%S")

EXCLUSIONS = [] # List of filenames containing regions to exclude...

# ---------------------------------
def search_area(regional_polygon, city_exclusions, skip_distance):
	"""
	Iterates over a regional polygon bounding box area by applying a consistently spaced grid of points.
	Iterates from W-->E and N-->S starting at the NW coordinate and ending at the SE corner.
	The bounding_box defines the N,S latitudes and E,W longitudes bounding the search region.
	The skip_distance defines the spatial separation (in meters) between the grid points.
	Calls the validation methods passing on each lat, lon pair.
	Verifies that points do not co-occur in any of the city-exclusions.
	:param: BoundingBox is an ordered tuple with entries [S, W, N, E] of a regional bounding box.
	:param: city_exclusions is a list of Polygons to check against for inclusion points.
	:param: skip_distance is the spatial 'jump' distance between points in meters.
	Ex: search_area([47.0, -72.0, 42.0, -75.0], 1000)
	"""
	bounding_box = regional_polygon.bounds
	cur_lat = bounding_box[2] # N   Start -->|.......|
	cur_lon = bounding_box[1] # W		 |.......|
	end_lat = bounding_box[0] # S		 |.......|	
	end_lon = bounding_box[3] # E		 |.......| <-- End
	num_grid = 0 # Used to count the number of points

	# Useful when picking up where left off...
	# ===================
	#cur_lat = RESTART_LAT
	#cur_lon = RESTART_LON
	# ===================

	if VERBOSE:
		print 'Current Coords: (lat,lon) = (' + str(cur_lat) + ',' + str(cur_lon) + ')'
		print 'End Coords: (lat,lon) = (' + str(end_lat) + ',' + str(end_lon) + ')'
	
	batch_list = [] # For snapping to roads...	
	while cur_lat > end_lat:# Reset to Western Edge and teleport down
		cur_lat, cur_lon = teleport(cur_lat, bounding_box[1], S, skip_distance)
		if VERBOSE: '--- Shift Latitude Down ---\nCurrent Coords: (lat,lon) = (' + str(cur_lat) + ',' + str(cur_lon) + ')'
		while cur_lon < end_lon:
			num_grid += 1

			# Teleport to the next point
			cur_lat, cur_lon = teleport(cur_lat, cur_lon, E, skip_distance)			
			if VERBOSE: print str(num_grid) + ' :\t(' + str(cur_lat) + ', ' + str(cur_lon) + ')'
			
			# Check if Point in the polygon and outside of cities. Also check if coords are over water or not.
			regional_valid = regional_validity(Point(cur_lat, cur_lon), regional_polygon, city_exclusions)
			land_valid = land_validity(cur_lat, cur_lon)

			# TODO :: Save these validity data for regional summary statistics.

			# Add to the batch for downstream processing!
			if regional_valid and land_valid:
				batch_list.append((cur_lat, cur_lon))

			# Keep filling the batch process until 100 coordinates...
			if len(batch_list) != BATCH_LIMIT: continue
			
			# For the 100 coords, get the nearest roads, perform walk algo, & save images...
			process_batch_coordinates(google_snap_to_nearest_road_batch(batch_list))
			batch_list = [] # Reset for the next round...

	# End of the loops. If any remaining coords in the batch, process them:
	if len(batch_list) != 0: process_batch_coordinates(google_snap_to_nearest_road_batch(batch_list))
	
	print 'TRUE COUNT = ', true_count
	print 'FALSE_COUNT = ', false_count	

def main():
	# Get Regional Bounds, and pass the exclusion cities
	regional_polygon, city_exclusions = get_regional_polygon(ONTARIO_FILE, CITY_EXCLUSIONS)
	search_area(regional_polygon, city_exclusions, RESOLUTION)

if __name__ == "__main__":
	main()
	if VERBOSE: print 'Execution Complete!~'
