"""
GDAL Terrain Processing Pipeline for NASA Space Apps 2026.
Converts scientific raw GeoTIFFs (LOLA DEM & LROC WAC) into Web-ready textures
for React Three Fiber / Three.js (PNG 8-bit displacement and WEBP skin).

Usage:
    python gdal_pipeline/process_terrain.py --dem raw_data/lola_dem.tif --skin raw_data/wac_mosaic.tif
"""

import os
import sys
import shutil
import argparse
import subprocess
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
RAW_DATA_DIR = BASE_DIR / "raw_data"
OUTPUT_TEXTURES_DIR = BASE_DIR / "output" / "textures"
PUBLIC_TEXTURES_DIR = BASE_DIR.parent / "public" / "textures"


def check_gdal_installed() -> bool:
    """Verifies if gdal_translate is available in the system PATH."""
    return shutil.which("gdal_translate") is not None


def process_dem(input_path: Path, output_path: Path, size: int = 2048, bbox=None) -> bool:
    """
    Converts 16/32-bit elevation GeoTIFF (LOLA DEM) to normalized 8-bit grayscale PNG.
    Rule: Never use WEBP/JPG for DEM because lossy compression creates geometric staircases.
    Command: gdal_translate -of PNG -outsize {size} {size} -scale {input} {output}
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "gdal_translate",
        "-of", "PNG",
        "-outsize", str(size), str(size),
        "-scale",  # Normalizes min/max lunar elevation to 0-255 grayscale
    ]

    if bbox:
        # ulx, uly, lrx, lry
        cmd.extend(["-projwin", str(bbox[0]), str(bbox[1]), str(bbox[2]), str(bbox[3])])

    cmd.extend([str(input_path), str(output_path)])

    print(f"\n[+] Processing DEM (Displacement Map):")
    print(f"    {' '.join(cmd)}")
    try:
        res = subprocess.run(cmd, check=True, capture_output=True, text=True)
        print(f"[✓] Successfully generated DEM texture: {output_path}")
        return True
    except subprocess.CalledProcessError as e:
        print(f"[!] Error processing DEM: {e.stderr}")
        return False


def process_skin(input_path: Path, output_path: Path, size: int = 2048, quality: int = 80, bbox=None) -> bool:
    """
    Converts visual mosaic GeoTIFF (LROC WAC) to highly compressed WEBP.
    Command: gdal_translate -of WEBP -outsize {size} {size} -co "QUALITY={quality}" {input} {output}
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "gdal_translate",
        "-of", "WEBP",
        "-outsize", str(size), str(size),
        "-co", f"QUALITY={quality}",
    ]

    if bbox:
        cmd.extend(["-projwin", str(bbox[0]), str(bbox[1]), str(bbox[2]), str(bbox[3])])

    cmd.extend([str(input_path), str(output_path)])

    print(f"\n[+] Processing Skin (Color Mosaic):")
    print(f"    {' '.join(cmd)}")
    try:
        res = subprocess.run(cmd, check=True, capture_output=True, text=True)
        print(f"[✓] Successfully generated Skin texture: {output_path}")
        return True
    except subprocess.CalledProcessError as e:
        print(f"[!] Error processing Skin: {e.stderr}")
        return False


def main():
    parser = argparse.ArgumentParser(description="NASA Moon Trek GeoTIFF to 3D Web Textures Pipeline")
    parser.add_argument("--dem", type=str, default=str(RAW_DATA_DIR / "lola_dem_south_pole.tif"), help="Path to input LOLA DEM .tif")
    parser.add_argument("--skin", type=str, default=str(RAW_DATA_DIR / "lroc_wac_south_pole.tif"), help="Path to input LROC WAC .tif")
    parser.add_argument("--size", type=int, default=2048, help="Output texture square resolution (default: 2048)")
    parser.add_argument("--quality", type=int, default=80, help="WEBP compression quality (default: 80)")
    parser.add_argument("--outdir", type=str, default=str(OUTPUT_TEXTURES_DIR), help="Output folder")
    parser.add_argument("--sync-public", action="store_true", default=True, help="Also copy processed textures to ../public/textures/ if folder exists")

    args = parser.parse_args()

    print("=" * 70)
    print("   AstroTeam - NASA LOLA & LROC 3D Texture Preprocessing Pipeline")
    print("=" * 70)

    if not check_gdal_installed():
        print("\n[!] WARNING: 'gdal_translate' not found in system PATH.")
        print("    To run GDAL on Windows:")
        print("      - Option A: Install OSGeo4W (https://trac.osgeo.org/osgeo4w/)")
        print("      - Option B: conda install -c conda-forge gdal")
        print("      - Option C: Docker: docker run --rm -v ${PWD}:/data osgeo/gdal ...")
        print("    Alternatively, use the shell script: gdal_pipeline/commands.sh")
        return

    out_dir = Path(args.outdir)
    dem_in = Path(args.dem)
    skin_in = Path(args.skin)

    if dem_in.exists():
        dem_out = out_dir / "displacement_lola_2k.png"
        success_dem = process_dem(dem_in, dem_out, size=args.size)
        if success_dem and args.sync_public and PUBLIC_TEXTURES_DIR.parent.exists():
            PUBLIC_TEXTURES_DIR.mkdir(parents=True, exist_ok=True)
            shutil.copy2(dem_out, PUBLIC_TEXTURES_DIR / dem_out.name)
            print(f"    -> Synced to public: {PUBLIC_TEXTURES_DIR / dem_out.name}")
    else:
        print(f"[-] DEM file not found at: {dem_in}")
        print("    Download 'LRO LOLA DEM, 75 deg v4, S Pole' GeoTIFF into raw_data/")

    if skin_in.exists():
        skin_out = out_dir / "skin_wac_2k.webp"
        success_skin = process_skin(skin_in, skin_out, size=args.size, quality=args.quality)
        if success_skin and args.sync_public and PUBLIC_TEXTURES_DIR.parent.exists():
            PUBLIC_TEXTURES_DIR.mkdir(parents=True, exist_ok=True)
            shutil.copy2(skin_out, PUBLIC_TEXTURES_DIR / skin_out.name)
            print(f"    -> Synced to public: {PUBLIC_TEXTURES_DIR / skin_out.name}")
    else:
        print(f"[-] Skin file not found at: {skin_in}")
        print("    Download 'LRO WAC Mosaic, S Pole v2' GeoTIFF into raw_data/")

    print("\n[✓] Pipeline execution finished.")


if __name__ == "__main__":
    main()
