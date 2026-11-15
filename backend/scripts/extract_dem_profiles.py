"""Extract site elevations and terrain-horizon profiles from NASA LOLA DEMs."""

import argparse
import csv
import math
from pathlib import Path

import numpy as np
import rasterio
from rasterio.warp import transform
from rasterio.windows import Window

BACKEND_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BACKEND_DIR / "data"
RAW_DATA_DIR = BACKEND_DIR / "raw_data"
OUTPUT_DIR = BACKEND_DIR / "datos"
SITES_CSV = DATA_DIR / "analysis_sites.csv"
LOW_RES_DEM = RAW_DATA_DIR / "LDEM_60S_120MPP_ADJ.tiff"
HIGH_RES_DEM = RAW_DATA_DIR / "LDEM_80S_80MPP_ADJ.tiff"

MOON_RADIUS_M = 1_737_400.0
AZIMUTH_STEP_DEG = 1.0
RAY_SAMPLE_STEP_M = 80.0
# The DEM relief range implies terrain horizons under 240 km on this lunar sphere.
MAX_RANGE_M = 250_000.0


def read_sites(path):
    sites = []
    seen_ids = set()
    with path.open(newline="", encoding="utf-8-sig") as stream:
        for row in csv.DictReader(stream):
            try:
                site = {
                    "site_id": row["site_id"].strip(),
                    "display_name": row["display_name"].strip(),
                    "latitude_deg": float(row["latitude_deg"]),
                    "longitude_east_deg": float(row["longitude_east_deg"]),
                    "observer_height_m": float(row["observer_height_m"]),
                    "output_dir": row["output_dir"].strip(),
                }
            except (KeyError, TypeError, ValueError) as error:
                raise ValueError("Invalid site row in the analysis-sites CSV.") from error
            if (
                not site["site_id"]
                or not site["display_name"]
                or not site["output_dir"]
                or site["output_dir"] in {".", ".."}
                or Path(site["output_dir"]).is_absolute()
                or "/" in site["output_dir"]
                or "\\" in site["output_dir"]
                or site["site_id"] in seen_ids
                or not -90.0 <= site["latitude_deg"] <= 90.0
                or not 0.0 <= site["longitude_east_deg"] <= 360.0
                or site["observer_height_m"] < 0.0
            ):
                raise ValueError(f"Invalid or duplicate site '{site['site_id']}'.")
            seen_ids.add(site["site_id"])
            sites.append(site)
    if not sites:
        raise ValueError("The analysis-sites CSV contains no sites.")
    return sites


def destination_points(latitude_deg, longitude_east_deg, azimuth_deg, distances_m):
    """Return spherical great-circle destinations for north-clockwise azimuths."""
    lat1 = math.radians(latitude_deg)
    lon1 = math.radians(longitude_east_deg)
    azimuth = np.radians(np.asarray(azimuth_deg, dtype=np.float64))
    delta = np.asarray(distances_m, dtype=np.float64) / MOON_RADIUS_M
    if azimuth.ndim:
        azimuth = azimuth[:, np.newaxis]
        delta = delta[np.newaxis, :]
    sin_azimuth = np.sin(azimuth)
    cos_azimuth = np.cos(azimuth)

    sin_lat2 = (
        math.sin(lat1) * np.cos(delta)
        + math.cos(lat1) * np.sin(delta) * cos_azimuth
    )
    lat2 = np.arcsin(np.clip(sin_lat2, -1.0, 1.0))
    lon2 = lon1 + np.arctan2(
        sin_azimuth * np.sin(delta) * math.cos(lat1),
        np.cos(delta) - math.sin(lat1) * np.sin(lat2),
    )
    return np.degrees(lat2), np.mod(np.degrees(lon2), 360.0)


def line_of_sight_elevation_deg(terrain_height_m, observer_radius_m, distance_m):
    central_angle = np.asarray(distance_m, dtype=np.float64) / MOON_RADIUS_M
    target_radius = MOON_RADIUS_M + np.asarray(
        terrain_height_m, dtype=np.float64
    )
    return np.degrees(
        np.arctan2(
            target_radius * np.cos(central_angle) - observer_radius_m,
            target_radius * np.sin(central_angle),
        )
    )


def _project_coordinates(dataset, longitude_east_deg, latitude_deg):
    longitudes = np.asarray(longitude_east_deg, dtype=float).ravel()
    latitudes = np.asarray(latitude_deg, dtype=float).ravel()
    xs, ys = transform(
        dataset.crs.geodetic_crs,
        dataset.crs,
        longitudes.tolist(),
        latitudes.tolist(),
    )
    return np.asarray(xs), np.asarray(ys)


def _sample_projected(dataset, xs, ys):
    xs = np.asarray(xs, dtype=np.float64).ravel()
    ys = np.asarray(ys, dtype=np.float64).ravel()
    values = np.full(len(xs), np.nan, dtype=np.float64)
    fractional_cols, fractional_rows = (~dataset.transform) @ (xs, ys)
    fractional_cols -= 0.5
    fractional_rows -= 0.5
    cols = np.floor(fractional_cols).astype(np.int64)
    rows = np.floor(fractional_rows).astype(np.int64)
    inside = (
        (cols >= 0)
        & (cols + 1 < dataset.width)
        & (rows >= 0)
        & (rows + 1 < dataset.height)
    )
    indices = np.flatnonzero(inside)
    if not len(indices):
        return values

    col_start, col_stop = int(cols[indices].min()), int(cols[indices].max()) + 2
    row_start, row_stop = int(rows[indices].min()), int(rows[indices].max()) + 2
    window = Window(
        col_start,
        row_start,
        col_stop - col_start,
        row_stop - row_start,
    )
    data = dataset.read(1, window=window, masked=True)
    rows_local = rows[indices] - row_start
    cols_local = cols[indices] - col_start
    v00 = data[rows_local, cols_local]
    v10 = data[rows_local, cols_local + 1]
    v01 = data[rows_local + 1, cols_local]
    v11 = data[rows_local + 1, cols_local + 1]
    raw = [
        np.asarray(np.ma.getdata(value), dtype=np.float64)
        for value in (v00, v10, v01, v11)
    ]
    valid = np.ones(len(indices), dtype=bool)
    for sampled, raw_values in zip((v00, v10, v01, v11), raw):
        valid &= ~np.ma.getmaskarray(sampled) & np.isfinite(raw_values)

    dx = fractional_cols[indices] - cols[indices]
    dy = fractional_rows[indices] - rows[indices]
    interpolated = (
        raw[0] * (1.0 - dx) * (1.0 - dy)
        + raw[1] * dx * (1.0 - dy)
        + raw[2] * (1.0 - dx) * dy
        + raw[3] * dx * dy
    )
    values[indices[valid]] = interpolated[valid]
    return values


def sample_dem(dataset, longitude_east_deg, latitude_deg):
    xs, ys = _project_coordinates(dataset, longitude_east_deg, latitude_deg)
    return _sample_projected(dataset, xs, ys)


def _bilinear_sample(dataset, longitude_east_deg, latitude_deg):
    xs, ys = _project_coordinates(
        dataset, [longitude_east_deg], [latitude_deg]
    )
    return float(_sample_projected(dataset, xs, ys)[0])


def site_elevation(site, low_res, high_res):
    if site["latitude_deg"] <= -80.0:
        elevation = _bilinear_sample(
            high_res, site["longitude_east_deg"], site["latitude_deg"]
        )
        if math.isfinite(elevation):
            return elevation, HIGH_RES_DEM.name
    elevation = _bilinear_sample(
        low_res, site["longitude_east_deg"], site["latitude_deg"]
    )
    if not math.isfinite(elevation):
        raise ValueError(f"No valid DEM elevation at '{site['site_id']}'.")
    return elevation, LOW_RES_DEM.name


def _ray_heights(site, azimuths_deg, distances_m, low_res, high_res):
    latitudes, longitudes = destination_points(
        site["latitude_deg"],
        site["longitude_east_deg"],
        azimuths_deg,
        distances_m,
    )
    latitudes = np.asarray(latitudes).ravel()
    longitudes = np.asarray(longitudes).ravel()
    heights = np.full(len(latitudes), np.nan, dtype=np.float64)
    high_indices = np.flatnonzero(latitudes <= -80.0)
    if len(high_indices):
        high_values = sample_dem(
            high_res, longitudes[high_indices], latitudes[high_indices]
        )
        heights[high_indices] = high_values

    missing = np.flatnonzero(~np.isfinite(heights))
    if len(missing):
        low_values = sample_dem(
            low_res, longitudes[missing], latitudes[missing]
        )
        heights[missing] = low_values

    if not np.isfinite(heights).all():
        missing_indices = np.flatnonzero(~np.isfinite(heights))
        missing_count = len(missing_indices)
        raise ValueError(
            f"DEM coverage has {missing_count} missing samples across the "
            f"horizon rays from '{site['site_id']}'."
        )
    return heights.reshape(len(azimuths_deg), len(distances_m))


def build_horizon_profile(site, ground_elevation_m, low_res, high_res):
    distances_m = np.arange(
        RAY_SAMPLE_STEP_M,
        MAX_RANGE_M + RAY_SAMPLE_STEP_M / 2,
        RAY_SAMPLE_STEP_M,
    )
    surface_radius = MOON_RADIUS_M + ground_elevation_m
    observer_radius = surface_radius + site["observer_height_m"]
    geometric_horizon = -math.degrees(
        math.acos(surface_radius / observer_radius)
    )
    profile = []
    azimuths = np.arange(0.0, 360.0, AZIMUTH_STEP_DEG)
    heights = _ray_heights(site, azimuths, distances_m, low_res, high_res)
    elevations = line_of_sight_elevation_deg(
        heights, observer_radius, distances_m[np.newaxis, :]
    )
    profile.extend(
        {
            "azimuth_deg": float(azimuth_deg),
            "elevation_deg": round(
                max(geometric_horizon, float(elevation_max)), 4
            ),
        }
        for azimuth_deg, elevation_max in zip(
            azimuths, np.max(elevations, axis=1)
        )
    )
    return profile


def extract_profiles(sites, low_res_path, high_res_path):
    results = []
    with rasterio.open(low_res_path) as low_res, rasterio.open(high_res_path) as high_res:
        if low_res.count != 1 or high_res.count != 1:
            raise ValueError("Each LOLA DEM must contain exactly one elevation band.")
        if low_res.crs != high_res.crs:
            raise ValueError("The 60S and 80S DEMs use different coordinate systems.")

        for site in sites:
            ground_elevation_m, source = site_elevation(site, low_res, high_res)
            profile = build_horizon_profile(
                site, ground_elevation_m, low_res, high_res
            )
            results.append(
                {
                    "site": site,
                    "ground_elevation_m": ground_elevation_m,
                    "observer_altitude_km": (
                        ground_elevation_m + site["observer_height_m"]
                    )
                    / 1000.0,
                    "elevation_dem": source,
                    "profile": profile,
                }
            )
    return results


def write_results(results, output_root, overwrite=False):
    summary_path = output_root / "dem_site_elevations.csv"
    output_paths = [
        summary_path,
        *[
            output_root
            / result["site"]["output_dir"]
            / f'{result["site"]["site_id"]}_horizon_profile.csv'
            for result in results
        ],
    ]
    existing = [path for path in output_paths if path.exists()]
    if existing and not overwrite:
        raise FileExistsError(
            "Output already exists; use --overwrite to replace only these files: "
            + ", ".join(str(path) for path in existing)
        )

    output_root.mkdir(parents=True, exist_ok=True)
    with summary_path.open("w", newline="", encoding="utf-8") as stream:
        fields = [
            "site_id",
            "display_name",
            "latitude_deg",
            "longitude_east_deg",
            "ground_elevation_m",
            "observer_height_m",
            "observer_altitude_km",
            "elevation_dem",
            "profile_azimuth_step_deg",
            "profile_max_range_km",
        ]
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader()
        for result in results:
            site = result["site"]
            writer.writerow(
                {
                    "site_id": site["site_id"],
                    "display_name": site["display_name"],
                    "latitude_deg": site["latitude_deg"],
                    "longitude_east_deg": site["longitude_east_deg"],
                    "ground_elevation_m": round(result["ground_elevation_m"], 3),
                    "observer_height_m": site["observer_height_m"],
                    "observer_altitude_km": round(
                        result["observer_altitude_km"], 6
                    ),
                    "elevation_dem": result["elevation_dem"],
                    "profile_azimuth_step_deg": AZIMUTH_STEP_DEG,
                    "profile_max_range_km": MAX_RANGE_M / 1000.0,
                }
            )

    for result in results:
        site_dir = output_root / result["site"]["output_dir"]
        site_dir.mkdir(parents=True, exist_ok=True)
        profile_path = (
            site_dir / f'{result["site"]["site_id"]}_horizon_profile.csv'
        )
        with profile_path.open("w", newline="", encoding="utf-8") as stream:
            writer = csv.DictWriter(
                stream, fieldnames=["site_id", "azimuth_deg", "elevation_deg"]
            )
            writer.writeheader()
            for row in result["profile"]:
                writer.writerow({"site_id": result["site"]["site_id"], **row})


def main():
    parser = argparse.ArgumentParser(
        description="Extract DEM site elevations and terrain horizon profiles."
    )
    parser.add_argument("--sites", type=Path, default=SITES_CSV)
    parser.add_argument("--dem-60s", type=Path, default=LOW_RES_DEM)
    parser.add_argument("--dem-80s", type=Path, default=HIGH_RES_DEM)
    parser.add_argument("--output-root", type=Path, default=OUTPUT_DIR)
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Replace only this script's summary and profile CSV outputs.",
    )
    args = parser.parse_args()

    for path in (args.sites, args.dem_60s, args.dem_80s):
        if not path.is_file():
            raise SystemExit(f"Required input file not found: {path}")

    try:
        sites = read_sites(args.sites)
        results = extract_profiles(sites, args.dem_60s, args.dem_80s)
        write_results(results, args.output_root, overwrite=args.overwrite)
    except (OSError, ValueError, rasterio.errors.RasterioError) as error:
        raise SystemExit(f"DEM profile extraction failed: {error}") from error

    for result in results:
        print(
            f'{result["site"]["site_id"]}: '
            f'{result["ground_elevation_m"]:.2f} m; '
            f'{len(result["profile"])} azimuths'
        )
    print(f"DEM site summary and profiles saved under {args.output_root}.")


if __name__ == "__main__":
    main()
