#!/usr/bin/env bash
# ==============================================================================
# AstroTeam - GDAL CLI Pipeline for Lunar South Pole (NASA Space Apps 2026)
# Processes heavy GeoTIFFs into Web-ready textures for Three.js:
# 1. Color Texture: WEBP (Quality 80, 2048x2048)
# 2. Displacement Map: 8-bit grayscale PNG normalized with -scale (2048x2048)
# 3. Normal Map: RGB PNG from gdaldem hillshade (2048x2048)
# ==============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$BASE_DIR")"

RAW_DIR="$BASE_DIR/raw_data"
OUT_DIR="$BASE_DIR/output/textures"
PUBLIC_DIR="$PROJECT_ROOT/public/textures"
TMP_DIR="/tmp/astroteam_gdal_build"

DEM_IN="$RAW_DIR/LRO_LOLA_DEM_SPole75_30mp_v04_EQ.tif"
WAC_IN="$RAW_DIR/LRO_WAC_Mosaic_Global_303ppd_v02.tif"

SRS="+proj=stere +lat_0=-90 +lon_0=0 +k=1 +x_0=0 +y_0=0 +R=1737400 +units=m +no_defs"
EXTENT="-450000 -450000 450000 450000"
SIZE="2048 2048"

mkdir -p "$OUT_DIR"
mkdir -p "$PUBLIC_DIR"
mkdir -p "$TMP_DIR"

echo "=== AstroTeam: Reprojecting DEM and WAC to South Pole Stereographic ==="
gdalwarp -overwrite -t_srs "$SRS" -te $EXTENT -ts $SIZE -r bilinear "$DEM_IN" "$TMP_DIR/dem_stere.tif"
gdalwarp -overwrite -t_srs "$SRS" -te $EXTENT -ts $SIZE -r bilinear "$WAC_IN" "$TMP_DIR/wac_stere.tif"

echo "=== 1. Generating Color Texture (WEBP, Quality 80) ==="
gdal_translate -b 1 -b 1 -b 1 -of WEBP -co QUALITY=80 "$TMP_DIR/wac_stere.tif" "$OUT_DIR/skin_wac_2k.webp"

echo "=== 2. Generating Displacement Map (PNG, Normalized 8-bit) ==="
gdal_translate -of PNG -scale -ot Byte "$TMP_DIR/dem_stere.tif" "$OUT_DIR/displacement_lola_2k.png"

echo "=== 3. Generating Normal Map (gdaldem hillshade) ==="
gdaldem hillshade -az 90 -alt 45 -s 1 -z 1 "$TMP_DIR/dem_stere.tif" "$TMP_DIR/hs_x.tif"
gdaldem hillshade -az 0 -alt 45 -s 1 -z 1 "$TMP_DIR/dem_stere.tif" "$TMP_DIR/hs_y.tif"
gdaldem hillshade -az 0 -alt 89 -s 1 -z 1 "$TMP_DIR/dem_stere.tif" "$TMP_DIR/hs_z.tif"
gdalbuildvrt -separate "$TMP_DIR/hs_normal.vrt" "$TMP_DIR/hs_x.tif" "$TMP_DIR/hs_y.tif" "$TMP_DIR/hs_z.tif"
gdal_translate -of PNG "$TMP_DIR/hs_normal.vrt" "$OUT_DIR/normal_lola_2k.png"

echo "=== 4. Syncing to public/textures/ ==="
cp "$OUT_DIR/skin_wac_2k.webp" "$PUBLIC_DIR/"
cp "$OUT_DIR/displacement_lola_2k.png" "$PUBLIC_DIR/"
cp "$OUT_DIR/normal_lola_2k.png" "$PUBLIC_DIR/"

# Clean aliases for easy imports in Three.js
cp "$OUT_DIR/skin_wac_2k.webp" "$PUBLIC_DIR/lunar_color.webp"
cp "$OUT_DIR/displacement_lola_2k.png" "$PUBLIC_DIR/lunar_displacement.png"
cp "$OUT_DIR/normal_lola_2k.png" "$PUBLIC_DIR/lunar_normal.png"

rm -rf "$TMP_DIR"
echo "=== AstroTeam: Texture Pipeline Finished Successfully! ==="
