#!/usr/bin/python
###########################
#    get_city_bounds.py   #
#    Author: Kevin Dick   #
#                         #
# Downloads and saves the #
# city bound coordinates  #
# as a .CSV file...       #
###########################
import os, sys
import json, urllib
import argparse

parser = argparse.ArgumentParser()
parser.add_argument('-s', '--search_string', help = 'The search string for the city of interest. Ex: "London, United Kingdom"', required = True)
parser.add_argument('-o', '--output_file', help = 'The destination file for the coordinates in CSV format.', required = True)
args = parser.parse_args()

SEARCH_NAME = args.search_string
OUTPUT_FILE = args.output_file

#------------------------------------------
def write_to_file(target_file, data):
        f_write = open(target_file, 'a')
        f_write.write(data + '\n')
        f_write.close()
#-------------------------------------------

def write_city_to_file(city_file, json_data):
	# Overwrite if allready exists...
	f = open(city_file, 'w')
	f.close()
	
	west, east, north, south = 0, 360, -360, 0
	pnt_count = 0
	for coord in json_data:
		pnt_count += 1
		lon = float(coord[0])
		lat = float(coord[1])
		if lat >= west: west = lat
		if lat <= east: east = lat
		if lon >= north: north = lon
		if lon <= south: south = lon
		write_to_file(city_file, str(lon) + ',' + str(lat) + ',pnt' + str(pnt_count))
	
	print 'North: ' + str(north)
	print 'East: ' + str(east)
	print 'South: ' + str(south)
	print 'West: ' + str(west)
	
	
def get_city_bounds(city_search):
	query = 'http://nominatim.openstreetmap.org/search?q=' + \
		city_search.replace(' ', '%20') + \
		'&format=json&polygon=1'
	response = json.loads(urllib.urlopen(query).read())
	return response[0]['polygonpoints']

if __name__ == "__main__":
    write_city_to_file(OUTPUT_FILE, get_city_bounds(SEARCH_NAME))
