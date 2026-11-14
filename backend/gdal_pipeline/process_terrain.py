#!/usr/bin/env python3
"""
AstroTeam - NASA LOLA DEM & LROC WAC 3D Texture Preprocessing Pipeline
=====================================================================
Processes raw scientific GeoTIFFs (LOLA DEM & LROC WAC Global Mosaic) into 
synchronized web-ready textures for React Three Fiber (Three.js):
1. Color Texture: WEBP (Quality 80, 2048x2048)
2. Displacement Map: Normalized 8-bit PNG (2048x2048, no lossy compression)
3. Normal Map: RGB PNG (2048x2048, extracted with gdaldem hillshade)

Both rasters are aligned to the exact same South Pole Stereographic projection
and bounding box to ensure 1:1 vertex-to-pixel mapping.
"""

import os
import sys
import shutil
import argparse
import subprocess
import tempfile
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BASE_DIR.parent
RAW_DATA_DIR = BASE_DIR / "raw_data"
OUTPUT_TEXTURES_DIR = BASE_DIR / "output" / "textures"
PUBLIC_TEXTURES_DIR = PROJECT_ROOT / "public" / "textures"

# Moon 2000 South Pole Stereographic CRS (R = 1,737,400 m, Center at South Pole -90°)
LUNAR_SOUTH_POLE_SRS = (
    "+proj=stere +lat_0=-90 +lon_0=0 +k=1 +x_0=0 +y_0=0 +R=1737400 +units=m +no_defs"
)

# Bounding box in meters: [-450km, -450km, 450km, 450km] (~75°S to 90°S coverage)
DEFAULT_EXTENT = [-450000, -450000, 450000, 450000]


def run_cmd(cmd: list[str], desc: str) -> None:
    print(f"\n[+] {desc}")
    print(f"    {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"[!] Warning/Error executing command:\n{result.stderr.strip()}", file=sys.stderr)
        if not any(ignorable in result.stderr for ignorable in ["PROJ: stere: Invalid latitude", "libnetcdf"]):
            raise RuntimeError(f"Command failed with code {result.returncode}: {' '.join(cmd)}")
    else:
        print(f"[✓] Completed: {desc}")


def check_gdal() -> None:
    for tool in ["gdalwarp", "gdal_translate", "gdaldem", "gdalbuildvrt"]:
        if shutil.which(tool) is None:
            raise RuntimeError(f"Required GDAL CLI tool '{tool}' not found in PATH.")


def find_default_raw_files() -> tuple[Path | None, Path | None]:
    dem_path = None
    skin_path = None

    if RAW_DATA_DIR.exists():
        for f in RAW_DATA_DIR.iterdir():
            if not f.name.endswith(".tif"):
                continue
            name_lower = f.name.lower()
            if "dem" in name_lower or "lola" in name_lower:
                dem_path = f
            elif "wac" in name_lower or "skin" in name_lower or "mosaic" in name_lower:
                skin_path = f

    return dem_path, skin_path


def main():
    parser = argparse.ArgumentParser(description="AstroTeam GDAL Terrain Pipeline for Lunar South Pole")
    parser.add_argument("--dem", type=str, default=None, help="Input LOLA DEM GeoTIFF")
    parser.add_argument("--skin", type=str, default=None, help="Input LROC WAC Mosaic GeoTIFF")
    parser.add_argument("--size", type=int, default=2048, help="Output texture square resolution (default: 2048)")
    parser.add_argument("--quality", type=int, default=80, help="WEBP quality for color texture (default: 80)")
    parser.add_argument("--extent", nargs=4, type=float, default=DEFAULT_EXTENT, help="Bounding box xmin ymin xmax ymax in meters")
    parser.add_argument("--outdir", type=str, default=str(OUTPUT_TEXTURES_DIR), help="Output textures folder")
    parser.add_argument("--public-dir", type=str, default=str(PUBLIC_TEXTURES_DIR), help="Next.js public textures folder")

    args = parser.parse_args()

    check_gdal()

    default_dem, default_skin = find_default_raw_files()
    dem_file = Path(args.dem) if args.dem else default_dem
    skin_file = Path(args.skin) if args.skin else default_skin

    if not dem_file or not dem_file.exists():
        sys.exit(f"[-] DEM file not found at {dem_file}. Please check backend/raw_data/.")
    if not skin_file or not skin_file.exists():
        sys.exit(f"[-] Skin file not found at {skin_file}. Please check backend/raw_data/.")

    out_dir = Path(args.outdir)
    public_dir = Path(args.public_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    public_dir.mkdir(parents=True, exist_ok=True)

    print("=" * 75)
    print("      AstroTeam - Lunar South Pole 3D Texture Pipeline (GDAL)")
    print("=" * 75)
    print(f" DEM Input:    {dem_file}")
    print(f" Skin Input:   {skin_file}")
    print(f" Target SRS:   Lunar South Pole Stereographic (+lat_0=-90, R=1737400m)")
    print(f" Bounding Box: {args.extent}")
    print(f" Resolution:   {args.size}x{args.size}")
    print(f" Output Dir:   {out_dir}")
    print(f" Public Dir:   {public_dir}")

    xmin, ymin, xmax, ymax = args.extent

    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir)
        warped_dem = tmp_path / "dem_stere.tif"
        warped_wac = tmp_path / "wac_stere.tif"

        # -------------------------------------------------------------------------
        # Step 1: Reproject LOLA DEM to Lunar South Pole Stereographic projection
        # -------------------------------------------------------------------------
        run_cmd([
            "gdalwarp", "-overwrite",
            "-t_srs", LUNAR_SOUTH_POLE_SRS,
            "-te", str(xmin), str(ymin), str(xmax), str(ymax),
            "-ts", str(args.size), str(args.size),
            "-r", "bilinear",
            str(dem_file), str(warped_dem)
        ], "Warping LOLA DEM to South Pole Stereographic CRS")

        # -------------------------------------------------------------------------
        # Step 2: Reproject LROC WAC to the exact same Bounding Box & CRS
        # -------------------------------------------------------------------------
        run_cmd([
            "gdalwarp", "-overwrite",
            "-t_srs", LUNAR_SOUTH_POLE_SRS,
            "-te", str(xmin), str(ymin), str(xmax), str(ymax),
            "-ts", str(args.size), str(args.size),
            "-r", "bilinear",
            str(skin_file), str(warped_wac)
        ], "Warping LROC WAC Mosaic to South Pole Stereographic CRS")

        # -------------------------------------------------------------------------
        # Step 3: Color Texture (WEBP, Quality 80)
        # -------------------------------------------------------------------------
        color_out = out_dir / "skin_wac_2k.webp"
        run_cmd([
            "gdal_translate",
            "-b", "1", "-b", "1", "-b", "1",  # Expand 1-band grayscale to 3-band RGB for WEBP driver
            "-of", "WEBP",
            "-co", f"QUALITY={args.quality}",
            str(warped_wac), str(color_out)
        ], "Converting WAC Skin to WEBP (Quality 80)")

        # -------------------------------------------------------------------------
        # Step 4: Displacement Map (8-bit grayscale PNG normalized with -scale)
        # -------------------------------------------------------------------------
        disp_out = out_dir / "displacement_lola_2k.png"
        run_cmd([
            "gdal_translate",
            "-of", "PNG",
            "-scale",
            "-ot", "Byte",
            str(warped_dem), str(disp_out)
        ], "Converting LOLA DEM to normalized 8-bit PNG Displacement Map")

        # -------------------------------------------------------------------------
        # Step 5: Normal Map (RGB PNG extracted via gdaldem hillshade)
        # X: Azimuth 90° (East-West light gradient -> Tangent Space X)
        # Y: Azimuth 0°  (North-South light gradient -> Tangent Space Y)
        # Z: Azimuth 0°, Altitude 89° (Zenith lighting -> Tangent Space Z)
        # -------------------------------------------------------------------------
        hs_x = tmp_path / "hs_x.tif"
        hs_y = tmp_path / "hs_y.tif"
        hs_z = tmp_path / "hs_z.tif"
        hs_vrt = tmp_path / "hs_normal.vrt"
        normal_out = out_dir / "normal_lola_2k.png"

        run_cmd(["gdaldem", "hillshade", "-az", "90", "-alt", "45", "-s", "1", "-z", "1", str(warped_dem), str(hs_x)], "Extracting Normal X (Azimuth 90°)")
        run_cmd(["gdaldem", "hillshade", "-az", "0", "-alt", "45", "-s", "1", "-z", "1", str(warped_dem), str(hs_y)], "Extracting Normal Y (Azimuth 0°)")
        run_cmd(["gdaldem", "hillshade", "-az", "0", "-alt", "89", "-s", "1", "-z", "1", str(warped_dem), str(hs_z)], "Extracting Normal Z (Zenith 89°)")
        run_cmd(["gdalbuildvrt", "-separate", str(hs_vrt), str(hs_x), str(hs_y), str(hs_z)], "Combining RGB Normal Map VRT")
        run_cmd(["gdal_translate", "-of", "PNG", str(hs_vrt), str(normal_out)], "Writing Normal Map PNG")

        # -------------------------------------------------------------------------
        # Step 6: Sync to public/textures/
        # -------------------------------------------------------------------------
        print("\n[+] Syncing generated textures to public/textures/ directory...")
        for src_file in [color_out, disp_out, normal_out]:
            dst_file = public_dir / src_file.name
            shutil.copy2(src_file, dst_file)
            print(f"    -> [Synced] {dst_file} ({os.path.getsize(dst_file) / 1024:.1f} KB)")

            # Also provide clean aliases for easy frontend imports:
            # skin_wac_2k.webp -> lunar_color.webp
            # displacement_lola_2k.png -> lunar_displacement.png
            # normal_lola_2k.png -> lunar_normal.png
            alias_name = None
            if "skin" in src_file.name or "wac" in src_file.name:
                alias_name = "lunar_color.webp"
            elif "displacement" in src_file.name or "dem" in src_file.name:
                alias_name = "lunar_displacement.png"
            elif "normal" in src_file.name:
                alias_name = "lunar_normal.png"

            if alias_name:
                alias_dst = public_dir / alias_name
                shutil.copy2(src_file, alias_dst)
                print(f"    -> [Alias]  {alias_dst}")

    print("\n" + "=" * 75)
    print(" [✓] PIPELINE COMPLETED SUCCESSFULLY!")
    print(f" Textures available in: {public_dir}")
    print("=" * 75)


if __name__ == "__main__":
    main()
