# ==============================================================================
# AstroTeam - GDAL CLI Pipeline for NASA Space Apps 2026
# Converte GeoTIFFs pesados de NASA Moon Trek a texturas Web para Three.js
# ==============================================================================

# 1. Crear directorios de salida
mkdir -p ../output/textures
mkdir -p ../../public/textures

# 2. Convertir DEM (LOLA) a PNG de 8-bits normalizado (Displacement Map)
# REGLA: Nunca usar compresión con pérdida (JPG/WEBP) en el DEM para evitar escalones 3D.
gdal_translate \
  -of PNG \
  -outsize 2048 2048 \
  -scale \
  ../raw_data/lola_dem_south_pole.tif \
  ../output/textures/displacement_lola_2k.png

# 3. Convertir Mosaico Visual (LROC WAC) a WEBP comprimido al 80% (Skin / Color)
gdal_translate \
  -of WEBP \
  -outsize 2048 2048 \
  -co "QUALITY=80" \
  ../raw_data/lroc_wac_south_pole.tif \
  ../output/textures/skin_wac_2k.webp

# 4. Copiar texturas al frontend de Next.js (si existe la carpeta public)
cp ../output/textures/displacement_lola_2k.png ../../public/textures/
cp ../output/textures/skin_wac_2k.webp ../../public/textures/

echo "Procesamiento de texturas completado."
