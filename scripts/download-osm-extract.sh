#!/bin/sh
set -eu

EXTRACT_URL="${OSM_EXTRACT_URL:-https://download.openstreetmap.fr/extracts/oceania/australia/new_south_wales-latest.osm.pbf}"
OSRM_DIR="./data/osrm"
NOMINATIM_DIR="./data/nominatim"
TARGET_FILE="${OSRM_DIR}/map.osm.pbf"

mkdir -p "${OSRM_DIR}" "${NOMINATIM_DIR}"

if [ -f "${TARGET_FILE}" ]; then
  echo "OSM extract already exists at ${TARGET_FILE}"
  cp -f "${TARGET_FILE}" "${NOMINATIM_DIR}/map.osm.pbf"
  exit 0
fi

echo "Downloading OSM extract from ${EXTRACT_URL}"
curl -L --fail --retry 3 -o "${TARGET_FILE}" "${EXTRACT_URL}"
cp -f "${TARGET_FILE}" "${NOMINATIM_DIR}/map.osm.pbf"
