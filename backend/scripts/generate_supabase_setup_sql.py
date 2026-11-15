"""Build one idempotent SQL file with the migration and current lunar datasets."""

import argparse
import csv
import math
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from scripts.extract_dem_profiles import DATA_DIR, OUTPUT_DIR, read_sites

MIGRATION_PATH = BACKEND_DIR / "scripts" / "supabase_horizons_migration.sql"
OUTPUT_PATH = OUTPUT_DIR / "supabase_horizons_setup.sql"
MISSION = "Artemis III - Polo Sur Lunar"
INSERT_BATCH_SIZE = 250

TIMELINE_COLUMNS = (
    "site_id",
    "fecha_hora",
    "sol_elevacion",
    "sol_azimut",
    "sol_estado_luz",
    "sol_parte_visible",
    "sol_disco_completo_visible",
    "tierra_elevacion",
    "tierra_azimut",
    "linea_vista_directa",
    "tierra_parte_visible",
    "tierra_disco_completo_visible",
    "distancia_km",
    "latencia_seg",
    "angulo_fase",
)


def _quote_text(value):
    return "'" + str(value).replace("'", "''") + "'"


def _sql_number(value, label):
    number = float(value)
    if not math.isfinite(number):
        raise ValueError(f"{label} must be finite.")
    return format(number, ".15g")


def _sql_boolean(value, label):
    if isinstance(value, bool):
        return "TRUE" if value else "FALSE"
    normalized = str(value).strip().lower()
    if normalized == "true":
        return "TRUE"
    if normalized == "false":
        return "FALSE"
    raise ValueError(f"{label} must be a boolean.")


def _read_csv(path, expected_fields=None):
    with path.open(newline="", encoding="utf-8") as stream:
        reader = csv.DictReader(stream)
        if expected_fields and reader.fieldnames != expected_fields:
            raise ValueError(f"Unexpected columns in {path.name}.")
        return list(reader)


def _load_inputs():
    sites = read_sites(DATA_DIR / "analysis_sites.csv")
    site_ids = {site["site_id"] for site in sites}
    elevation_rows = _read_csv(OUTPUT_DIR / "dem_site_elevations.csv")
    elevations = {row["site_id"]: row for row in elevation_rows}
    if len(elevations) != len(elevation_rows) or set(elevations) != site_ids:
        raise ValueError("DEM elevation summary does not match the site catalog.")

    profile_rows = []
    for site in sites:
        site_id = site["site_id"]
        path = (
            OUTPUT_DIR
            / site["output_dir"]
            / f'{site_id}_horizon_profile.csv'
        )
        rows = _read_csv(
            path, ["site_id", "azimuth_deg", "elevation_deg"]
        )
        azimuths = set()
        for row in rows:
            azimuth = float(row["azimuth_deg"])
            if (
                row["site_id"] != site_id
                or not math.isfinite(azimuth)
                or not 0 <= azimuth < 360
                or azimuth in azimuths
            ):
                raise ValueError(f"Invalid horizon profile for '{site_id}'.")
            azimuths.add(azimuth)
            profile_rows.append(
                (
                    _quote_text(site_id),
                    _sql_number(azimuth, "azimuth_deg"),
                    _sql_number(row["elevation_deg"], "elevation_deg"),
                )
            )
        if len(rows) != 360 or azimuths != set(range(360)):
            raise ValueError(f"Profile must contain 360 azimuths for '{site_id}'.")

    timeline_rows = _read_csv(OUTPUT_DIR / "horizons_timeline.csv")
    if not timeline_rows:
        raise ValueError("Horizons timeline CSV is empty.")
    timeline_by_site = defaultdict(list)
    seen_timestamps = set()
    for row in timeline_rows:
        if set(row) != set(TIMELINE_COLUMNS):
            raise ValueError("Horizons timeline CSV has an unexpected schema.")
        site_id = row["site_id"]
        if site_id not in site_ids:
            raise ValueError(f"Unknown timeline site '{site_id}'.")
        try:
            timestamp = datetime.fromisoformat(row["fecha_hora"].replace("Z", "+00:00"))
        except ValueError as error:
            raise ValueError(f"Invalid timestamp for '{site_id}'.") from error
        if timestamp.tzinfo is None:
            raise ValueError(f"Timeline timestamp for '{site_id}' must include a timezone.")
        key = (site_id, timestamp.astimezone().isoformat())
        if key in seen_timestamps:
            raise ValueError(f"Duplicate timeline timestamp for '{site_id}'.")
        seen_timestamps.add(key)
        timeline_by_site[site_id].append(row)

    if set(timeline_by_site) != site_ids:
        raise ValueError("Horizons timeline does not contain all six sites.")
    point_counts = {len(rows) for rows in timeline_by_site.values()}
    if len(point_counts) != 1:
        raise ValueError("Horizons timeline sites have different point counts.")
    return sites, elevations, profile_rows, timeline_by_site


def _insert_statements(table, columns, rows, conflict, update_columns):
    statements = []
    quoted_columns = ", ".join(columns)
    for offset in range(0, len(rows), INSERT_BATCH_SIZE):
        batch = rows[offset : offset + INSERT_BATCH_SIZE]
        values = ",\n".join(
            "(" + ", ".join(row) + ")" for row in batch
        )
        updates = ", ".join(
            f"{column} = EXCLUDED.{column}" for column in update_columns
        )
        statements.append(
            f"INSERT INTO public.{table} ({quoted_columns}) VALUES\n"
            f"{values}\nON CONFLICT ({conflict}) DO UPDATE SET {updates};"
        )
    return statements


def generate_sql():
    sites, elevations, profile_rows, timeline_by_site = _load_inputs()
    site_rows = []
    site_visibility = {}
    for site_id, rows in timeline_by_site.items():
        point_count = len(rows)
        site_visibility[site_id] = (
            round(
                100
                * sum(row["sol_estado_luz"].lower() == "true" for row in rows)
                / point_count,
                2,
            ),
            round(
                100
                * sum(row["linea_vista_directa"].lower() == "true" for row in rows)
                / point_count,
                2,
            ),
        )

    for site in sites:
        site_id = site["site_id"]
        sunlight_pct, earth_pct = site_visibility[site_id]
        site_rows.append(
            (
                _quote_text(site_id),
                _quote_text(MISSION),
                _quote_text(site["display_name"]),
                _sql_number(site["latitude_deg"], "latitude_deg"),
                _sql_number(site["longitude_east_deg"], "longitude_east_deg"),
                _sql_number(
                    elevations[site_id]["observer_altitude_km"],
                    "observer_altitude_km",
                ),
                _sql_number(sunlight_pct, "pct_luz_solar"),
                _sql_number(earth_pct, "pct_vista_tierra"),
                "0.0",
            )
        )

    timeline_values = []
    for row in (row for rows in timeline_by_site.values() for row in rows):
        values = []
        for column in TIMELINE_COLUMNS:
            value = row[column]
            if column == "site_id":
                values.append(_quote_text(value))
            elif column == "fecha_hora":
                values.append(f"{_quote_text(value)}::timestamptz")
            elif column in {
                "sol_estado_luz",
                "sol_parte_visible",
                "sol_disco_completo_visible",
                "linea_vista_directa",
                "tierra_parte_visible",
                "tierra_disco_completo_visible",
            }:
                values.append(_sql_boolean(value, column))
            else:
                values.append(_sql_number(value, column))
        timeline_values.append(tuple(values))

    sql = [
        "-- Generated from the current DEM profile and JPL Horizons CSV outputs.",
        "-- Idempotent: applies additive schema changes and upserts, without deleting rows.",
        "BEGIN;",
        MIGRATION_PATH.read_text(encoding="utf-8").rstrip(),
        "",
        "-- DEM-derived site catalog",
        *_insert_statements(
            "lunar_sites",
            [
                "id",
                "mision",
                "nombre",
                "latitud",
                "longitud",
                "altitud_km",
                "pct_luz_solar",
                "pct_vista_tierra",
                "default_horizon_elevation_deg",
            ],
            site_rows,
            "id",
            [
                "mision",
                "nombre",
                "latitud",
                "longitud",
                "altitud_km",
                "pct_luz_solar",
                "pct_vista_tierra",
                "default_horizon_elevation_deg",
            ],
        ),
        "",
        "-- DEM-derived site horizon profiles",
        *_insert_statements(
            "site_horizon_profile",
            ["site_id", "azimuth_deg", "elevation_deg"],
            profile_rows,
            "site_id, azimuth_deg",
            ["elevation_deg"],
        ),
        "",
        "-- Terrain-aware hourly JPL Horizons timeline",
        *_insert_statements(
            "site_cronograma",
            list(TIMELINE_COLUMNS),
            timeline_values,
            "site_id, fecha_hora",
            [column for column in TIMELINE_COLUMNS if column not in {"site_id", "fecha_hora"}],
        ),
        "COMMIT;",
        "",
    ]
    return "\n".join(sql)


def main():
    parser = argparse.ArgumentParser(
        description="Generate a single Supabase SQL setup/seed file."
    )
    parser.add_argument("--output", type=Path, default=OUTPUT_PATH)
    parser.add_argument("--overwrite", action="store_true")
    args = parser.parse_args()

    if args.output.exists() and not args.overwrite:
        raise SystemExit(
            f"Output exists; use --overwrite to replace it: {args.output}"
        )
    try:
        sql = generate_sql()
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(sql, encoding="utf-8")
    except (OSError, KeyError, TypeError, ValueError) as error:
        raise SystemExit(f"Could not generate Supabase setup SQL: {error}") from error

    print(f"Generated Supabase SQL setup file: {args.output} ({len(sql)} characters)")


if __name__ == "__main__":
    main()
