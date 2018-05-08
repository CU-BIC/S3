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
from datetime import datetime as dt
from shapely.geometry import Point
import argparse

parser = argparse.ArgumentParser()
parser.add_argument('-a', '--api_key', help = 'Your Google API key.', required = True)
parser.add_argument('-c', '--coords', help = 'The coordinates bounding the search region.', required = True)
parser.add_argument('-d', '--epsilon', help = 'The distance between search points in meters; epsilon in the paper (eg: 1000 for 1km.', type = float, required = True)
parser.add_argument('-lat', '--restart_lat', help = 'The latitude from where to restart sampling.', type = float, default = 999.0)
parser.add_argument('-lon', '--restart_lon', help = 'The longitude from where to restart sampling.', type = float, default = 999.0)
parser.add_argument('-x', '--width', help = 'The image width for the Google Street View images. Max: 640.', required = False, default = 640)
parser.add_argument('-y', '--height', help = 'The image height for the Google Street View images. Max: 640', required = False, default = 360)
parser.add_argument('-w', '--walk_steps', help = 'The number of steps to take in the walk algorithm.', required = False, default = 1)
parser.add_argument('-log', '--log_file', help = 'The log file.', default = dt.now().strftime("%Y-%m-%d_%H-%M-%S") + '.log')
parser.add_argument('-v', '--verbose', help = 'Increase output verbosity.', action = 'store_true')
parser.add_argument('-e', '--exclusions', nargs='*', help = 'Path to files containing excluding regions.', default = [])
parser.add_argument('-o', '--output_dir', help = 'The destination directory to save all the images.', required = True)
args = parser.parse_args()

# ---------------------------------
def search_area(regional_polygon, city_exclusions, skip_distance):
	"""
	Iterates over a regional polygon bounding box area by applying a consistently spaced grid of points.
	Iterates from W-->E and N-->S starting at the NW coordinate and ending at the SE corner.
	The bounding_box defines the N,S latitudes and E,W longitudes bounding the search region.
	The skip_distance defines the spatial separation (in meters) between the grid points.
	Calls the validation methods passing on each lat, lon pair.
	Verifies that points do not co-occur in any of the city-exclusions.
	:param: regional_polygons has the bounds as an ordered tuple with entries [S, W, N, E] of a regional bounding box.
	:param: city_exclusions is a list of Polygons to check against for inclusion points.
	:param: skip_distance is the spatial 'jump' distance between points in meters.
	Ex: search_area([47.0, -72.0, 42.0, -75.0], 1000)
	"""
	bounding_box = regional_polygon.bounds
	cur_lat = bounding_box[2] # N   Start -->|.......|
	cur_lon = bounding_box[1] # W		 |.......|
	end_lat = bounding_box[0] # S		 |.......|	
	end_lon = bounding_box[3] # E		 |.......| <-- End
	
	# Pick up from the restart coords is necessary...
	if args.restart_lat < 999.0: cur_lat = args.restart_lat
	if args.restart_lon < 999.0: cur_lon = args.restart_lon

	if args.verbose: print 'Resetting coordinates to (lat,lon): (' + str(cur_lat) + ',' + str(cur_lon) + ')'
	
	batch_list = [] # For snapping to roads with the optimized API calls...	
	while cur_lat > end_lat:# Reset to Western Edge and teleport down
		cur_lat, cur_lon = S3.teleport(cur_lat, bounding_box[1], S3.SOUTH, skip_distance)
		
		if args.verbose: '--- Shift Latitude Down ---\nCurrent Coords: (lat,lon) = (' + str(cur_lat) + ',' + str(cur_lon) + ')'
		while cur_lon < end_lon:
			
			# Teleport to the next point
			cur_lat, cur_lon = S3.teleport(cur_lat, cur_lon, S3.EAST, skip_distance)			
			if args.verbose: print '(' + str(cur_lat) + ', ' + str(cur_lon) + ')'
			
			# Check if Point in the polygon and outside of cities. Also check if coords are over water or not.
			regional_valid = S3.regional_validity(Point(cur_lat, cur_lon), regional_polygon, city_exclusions)
			land_valid = S3.land_validity(cur_lat, cur_lon)

			# TODO :: Save these validity data for regional summary statistics.
			print 'Region Valid: ' + str(regional_valid)
			print 'Land Valid: ' + str(land_valid)

			# Add to the batch for downstream processing!
			if regional_valid and land_valid:
				batch_list.append((cur_lat, cur_lon))

			# Keep filling the batch process until 100 coordinates...
			if len(batch_list) != S3.BATCH_LIMIT: 
				print 'Batch Size: ' + str(len(batch_list))
				continue
			
			# For the 100 coords, get the nearest roads, perform walk algo, & save images...
			S3.process_batch_coordinates(S3.google_snap_to_nearest_road_batch(batch_list))
			batch_list = [] # Reset for the next round...

	# End of the loops. If any remaining coords in the batch, process them:
	if len(batch_list) != 0: S3.process_batch_coordinates(S3.google_snap_to_nearest_road_batch(batch_list))
	

def main():
	# Set the API key for usage in the S# module...
	S3.API_KEY = args.api_key
	S3.IMG_DIR = args.output_dir
	S3.VERBOSE = args.verbose
	S3.IMAGE_WIDTH  = args.width
	S3.IMAGE_HEIGHT = args.height
	S3.NUM_STEPS = args.walk_steps

	# Get Regional Bounds, and pass the exclusion cities to get their polygons 
	search_region, exclude = S3.get_regional_polygon(args.coords, args.exclusions)

	print search_region
	# Begin the sampling procedure!
	search_area(search_region, exclude, args.epsilon)

if __name__ == "__main__":
	main()
	if args.verbose: print 'Execution Complete!~'
