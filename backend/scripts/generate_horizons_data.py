"""Generate a local CSV of terrain-aware hourly JPL Horizons data."""

import argparse
import csv
import math
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.horizons import (
    HorizonsError,
    build_site_timeline,
    fetch_observer_ephemeris,
)
from scripts.extract_dem_profiles import DATA_DIR, OUTPUT_DIR, read_sites

DEFAULT_OUTPUT = OUTPUT_DIR / "horizons_timeline.csv"


def parse_start(value):
    if value is None:
        return datetime.now(timezone.utc).replace(
            minute=0, second=0, microsecond=0
        )
    try:
        start = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise ValueError("--start-utc must be an ISO 8601 timestamp.") from error
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    return start.astimezone(timezone.utc).replace(
        minute=0, second=0, microsecond=0
    )


def load_site_inputs():
    sites = read_sites(DATA_DIR / "analysis_sites.csv")
    with (OUTPUT_DIR / "dem_site_elevations.csv").open(
        newline="", encoding="utf-8"
    ) as stream:
        elevation_rows = list(csv.DictReader(stream))
    elevations = {}
    for row in elevation_rows:
        site_id = row["site_id"]
        if site_id in elevations:
            raise ValueError(f"Duplicate DEM elevation row for '{site_id}'.")
        try:
            elevation = float(row["observer_altitude_km"])
        except (KeyError, TypeError, ValueError) as error:
            raise ValueError(f"Invalid DEM elevation row for '{site_id}'.") from error
        if not math.isfinite(elevation):
            raise ValueError(f"Non-finite DEM elevation for '{site_id}'.")
        elevations[site_id] = elevation

    if set(elevations) != {site["site_id"] for site in sites}:
        raise ValueError("DEM elevation summary does not match the site catalog.")

    result = []
    for source in sites:
        site_id = source["site_id"]
        profile_path = (
            OUTPUT_DIR
            / source["output_dir"]
            / f'{site_id}_horizon_profile.csv'
        )
        with profile_path.open(newline="", encoding="utf-8") as stream:
            reader = csv.DictReader(stream)
            if reader.fieldnames != ["site_id", "azimuth_deg", "elevation_deg"]:
                raise ValueError(f"Unexpected horizon profile columns for '{site_id}'.")
            rows = list(reader)

        profile = []
        seen_azimuths = set()
        for row in rows:
            try:
                azimuth = float(row["azimuth_deg"])
                elevation = float(row["elevation_deg"])
            except (KeyError, TypeError, ValueError) as error:
                raise ValueError(f"Invalid horizon profile for '{site_id}'.") from error
            if (
                row["site_id"] != site_id
                or not math.isfinite(azimuth)
                or not math.isfinite(elevation)
                or not 0.0 <= azimuth < 360.0
                or azimuth in seen_azimuths
            ):
                raise ValueError(f"Invalid or duplicate horizon profile for '{site_id}'.")
            seen_azimuths.add(azimuth)
            profile.append({"azimuth": azimuth, "elevation_deg": elevation})
        if len(profile) != 360 or seen_azimuths != set(range(360)):
            raise ValueError(f"Profile must contain all 360 azimuths for '{site_id}'.")

        result.append(
            {
                "id": site_id,
                "latitud": source["latitude_deg"],
                "longitud": source["longitude_east_deg"],
                "altitud_km": elevations[site_id],
                "default_horizon_elevation_deg": 0.0,
                "horizon_profile": profile,
            }
        )
    return result


def generate_rows(sites, start_utc, days):
    stop_utc = start_utc + timedelta(days=days) - timedelta(hours=1)
    rows = []
    for site in sites:
        print(f"Querying JPL Horizons for {site['id']}: Sun and Earth...")
        sun_rows = fetch_observer_ephemeris(
            "10",
            site["longitud"],
            site["latitud"],
            site["altitud_km"],
            start_utc,
            stop_utc,
            include_range=True,
        )
        earth_rows = fetch_observer_ephemeris(
            "399",
            site["longitud"],
            site["latitud"],
            site["altitud_km"],
            start_utc,
            stop_utc,
            include_range=True,
        )
        site_rows = build_site_timeline(
            site["id"],
            sun_rows,
            earth_rows,
            site["horizon_profile"],
            site["default_horizon_elevation_deg"],
        )
        if len(site_rows) != days * 24:
            raise HorizonsError(
                f"Horizons returned {len(site_rows)} points for '{site['id']}', "
                f"expected {days * 24}."
            )
        rows.extend(site_rows)
    return rows


def main():
    parser = argparse.ArgumentParser(
        description="Generate hourly Horizons CSV using local DEM-derived profiles."
    )
    parser.add_argument("--site-id", help="Generate data for one canonical site.")
    parser.add_argument("--start-utc", help="ISO 8601 start time; defaults to current hour.")
    parser.add_argument("--days", type=int, default=30, choices=range(1, 31))
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--overwrite", action="store_true")
    args = parser.parse_args()

    try:
        start_utc = parse_start(args.start_utc)
        sites = load_site_inputs()
        if args.site_id:
            sites = [site for site in sites if site["id"] == args.site_id]
            if not sites:
                raise ValueError(f"Unknown site id '{args.site_id}'.")
        rows = generate_rows(sites, start_utc, args.days)
        if args.output.exists() and not args.overwrite:
            raise FileExistsError(
                f"Output exists; use --overwrite to replace it: {args.output}"
            )
        args.output.parent.mkdir(parents=True, exist_ok=True)
        fields = list(rows[0].keys())
        with args.output.open("w", newline="", encoding="utf-8") as stream:
            writer = csv.DictWriter(stream, fieldnames=fields)
            writer.writeheader()
            writer.writerows(rows)
    except (HorizonsError, OSError, ValueError) as error:
        raise SystemExit(f"Horizons CSV generation failed: {error}") from error

    print(
        f"Generated {len(rows)} hourly rows from {start_utc.isoformat()} "
        f"for {len(sites)} site(s): {args.output}"
    )


if __name__ == "__main__":
    main()
