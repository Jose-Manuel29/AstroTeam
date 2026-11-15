"""Upsert the six DEM-derived sites and their horizon profiles to Supabase."""

import csv
import math
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.supabase_client import SupabaseError, upsert_rows
from scripts.extract_dem_profiles import DATA_DIR, OUTPUT_DIR, read_sites

MISSION = "Artemis III - Polo Sur Lunar"
UPSERT_BATCH_SIZE = 500


def _read_boolean(value, column):
    normalized = value.strip().lower()
    if normalized == "true":
        return True
    if normalized == "false":
        return False
    raise ValueError(f"Invalid {column} value in Horizons timeline.")


def load_seed_rows():
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
            altitude_km = float(row["observer_altitude_km"])
        except (KeyError, TypeError, ValueError) as error:
            raise ValueError(f"Invalid DEM elevation row for '{site_id}'.") from error
        if not math.isfinite(altitude_km):
            raise ValueError(f"Non-finite DEM elevation for '{site_id}'.")
        elevations[site_id] = altitude_km

    expected_ids = {site["site_id"] for site in sites}
    if set(elevations) != expected_ids:
        raise ValueError("DEM elevation summary does not match the site catalog.")

    with (OUTPUT_DIR / "horizons_timeline.csv").open(
        newline="", encoding="utf-8"
    ) as stream:
        timeline_rows = list(csv.DictReader(stream))
    visibility_counts = {
        site_id: {"total": 0, "sunlit": 0, "earth_visible": 0}
        for site_id in expected_ids
    }
    for row in timeline_rows:
        site_id = row["site_id"]
        if site_id not in visibility_counts:
            raise ValueError(f"Unknown site '{site_id}' in Horizons timeline.")
        counts = visibility_counts[site_id]
        counts["total"] += 1
        counts["sunlit"] += _read_boolean(row["sol_estado_luz"], "sol_estado_luz")
        counts["earth_visible"] += _read_boolean(
            row["linea_vista_directa"], "linea_vista_directa"
        )
    if not timeline_rows or any(
        counts["total"] == 0 for counts in visibility_counts.values()
    ):
        raise ValueError("Horizons timeline must contain rows for all six sites.")

    site_rows = []
    profile_rows = []
    for site in sites:
        site_id = site["site_id"]
        counts = visibility_counts[site_id]
        site_rows.append(
            {
                "id": site_id,
                "mision": MISSION,
                "nombre": site["display_name"],
                "latitud": site["latitude_deg"],
                "longitud": site["longitude_east_deg"],
                "altitud_km": elevations[site_id],
                "pct_luz_solar": round(
                    100.0 * counts["sunlit"] / counts["total"], 2
                ),
                "pct_vista_tierra": round(
                    100.0 * counts["earth_visible"] / counts["total"], 2
                ),
                "default_horizon_elevation_deg": 0.0,
            }
        )

        profile_path = (
            OUTPUT_DIR
            / site["output_dir"]
            / f'{site_id}_horizon_profile.csv'
        )
        with profile_path.open(newline="", encoding="utf-8") as stream:
            reader = csv.DictReader(stream)
            if reader.fieldnames != ["site_id", "azimuth_deg", "elevation_deg"]:
                raise ValueError(f"Unexpected profile columns for '{site_id}'.")
            rows = list(reader)
        if len(rows) != 360:
            raise ValueError(f"Expected 360 horizon points for '{site_id}'.")

        seen_azimuths = set()
        for row in rows:
            try:
                azimuth = float(row["azimuth_deg"])
                elevation = float(row["elevation_deg"])
            except (TypeError, ValueError) as error:
                raise ValueError(f"Invalid horizon point for '{site_id}'.") from error
            if (
                row["site_id"] != site_id
                or not math.isfinite(azimuth)
                or not math.isfinite(elevation)
                or not 0.0 <= azimuth < 360.0
                or azimuth in seen_azimuths
            ):
                raise ValueError(f"Invalid or duplicate horizon point for '{site_id}'.")
            seen_azimuths.add(azimuth)
            profile_rows.append(
                {
                    "site_id": site_id,
                    "azimuth_deg": azimuth,
                    "elevation_deg": elevation,
                }
            )
        if seen_azimuths != set(range(360)):
            raise ValueError(f"Profile azimuths are incomplete for '{site_id}'.")

    return site_rows, profile_rows


def main():
    try:
        site_rows, profile_rows = load_seed_rows()
        upsert_rows("lunar_sites", site_rows, "id")
        for offset in range(0, len(profile_rows), UPSERT_BATCH_SIZE):
            upsert_rows(
                "site_horizon_profile",
                profile_rows[offset : offset + UPSERT_BATCH_SIZE],
                "site_id,azimuth_deg",
            )
    except (OSError, ValueError, SupabaseError) as error:
        raise SystemExit(f"Could not seed DEM sites into Supabase: {error}") from error

    print(
        f"Seed complete: {len(site_rows)} sites and "
        f"{len(profile_rows)} horizon points."
    )


if __name__ == "__main__":
    main()
