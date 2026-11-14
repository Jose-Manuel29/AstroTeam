# ==============================================================================
# AstroTeam - GDAL PowerShell Script (Windows)
# Converte GeoTIFFs pesados de NASA Moon Trek a texturas Web para Three.js
# ==============================================================================

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BaseDir = Split-Path -Parent $ScriptDir
$RawDir = Join-Path $BaseDir "raw_data"
$OutDir = Join-Path $BaseDir "output\textures"
$PublicDir = Join-Path (Split-Path -Parent $BaseDir) "public\textures"

# Crear directorios
New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
if (Test-Path (Split-Path -Parent $PublicDir)) {
    New-Item -ItemType Directory -Path $PublicDir -Force | Out-Null
}

$DemIn = Join-Path $RawDir "lola_dem_south_pole.tif"
$DemOut = Join-Path $OutDir "displacement_lola_2k.png"

$SkinIn = Join-Path $RawDir "lroc_wac_south_pole.tif"
$SkinOut = Join-Path $OutDir "skin_wac_2k.webp"

Write-Host ">>> AstroTeam: Procesando texturas lunares con GDAL..." -ForegroundColor Cyan

# Procesar DEM
if (Test-Path $DemIn) {
    Write-Host "[+] Convirtiendo LOLA DEM a PNG normalizado (2048x2048)..." -ForegroundColor Green
    & gdal_translate -of PNG -outsize 2048 2048 -scale $DemIn $DemOut
    if (Test-Path $PublicDir) { Copy-Item $DemOut (Join-Path $PublicDir "displacement_lola_2k.png") -Force }
} else {
    Write-Host "[-] DEM no encontrado en $DemIn" -ForegroundColor Yellow
}

# Procesar Skin
if (Test-Path $SkinIn) {
    Write-Host "[+] Convirtiendo LROC WAC a WEBP 80% (2048x2048)..." -ForegroundColor Green
    & gdal_translate -of WEBP -outsize 2048 2048 -co "QUALITY=80" $SkinIn $SkinOut
    if (Test-Path $PublicDir) { Copy-Item $SkinOut (Join-Path $PublicDir "skin_wac_2k.webp") -Force }
} else {
    Write-Host "[-] Skin no encontrado en $SkinIn" -ForegroundColor Yellow
}

Write-Host "[✓] Proceso finalizado." -ForegroundColor Cyan
