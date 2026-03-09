#!/bin/sh
set -eu

cd /data

if [ ! -f map.osm.pbf ]; then
  echo "Expected /data/map.osm.pbf to exist before OSRM preprocessing"
  exit 1
fi

if [ -f map.osrm ] && [ -f map.osrm.partition ] && [ -f map.osrm.customize ] && [ -f map.osrm.cells ]; then
  echo "OSRM dataset already prepared"
  exit 0
fi

rm -f map.osrm*

osrm-extract -p /opt/car.lua /data/map.osm.pbf
osrm-partition /data/map.osrm
osrm-customize /data/map.osrm
