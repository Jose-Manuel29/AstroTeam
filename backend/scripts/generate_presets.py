"""
LEGACY SCRIPT: generates static JSON and synthetic horizon data; it is not part
of the JPL Horizons -> Supabase production workflow. Do not use its outputs as
scientific data or execute its legacy SQL seed.

Script to generate and precalculate data for the 6 featured lunar sites (sitios estrella).
Exports:
  1. output/preset_sites.json (Sites metadata, NASA scientific constants & current snapshot)
  2. output/preset_sites_timeline.json (30-day hourly time-series for the frontend time-slider)
  3. output/supabase_seed.sql (Ready-to-run PostgreSQL schema and inserts for Supabase)

Run directly via:
    python scripts/generate_presets.py
"""

import sys
import json
from pathlib import Path
from datetime import datetime, timezone, timedelta

# Ensure app modules are importable
backend_root = Path(__file__).resolve().parent.parent
if str(backend_root) not in sys.path:
    sys.path.insert(0, str(backend_root))

from app.terrain import generate_synthetic_horizon_profile, calculate_visibility_and_countdowns, interpolate_horizon_elevation
from app.ephemeris import get_selenographic_ephemeris, compute_topocentric_target

OUTPUT_DIR = backend_root / "output"
DATA_DIR = backend_root / "data"
PUBLIC_DATA_DIR = backend_root.parent / "public" / "data"

OUTPUT_FILE = OUTPUT_DIR / "preset_sites.json"
TIMELINE_FILE = OUTPUT_DIR / "preset_sites_timeline.json"
SUPABASE_SQL_FILE = OUTPUT_DIR / "supabase_seed.sql"

SPEED_OF_LIGHT_KM_S = 299792.458

PRESET_SITES_METADATA = [
    {
        "id": "shackleton-rim",
        "name": "Borde del Cráter Shackleton",
        "category": "Polo Sur / Candidato Artemis",
        "lat": -89.90,
        "lon": 0.00,
        "elevation_m": 4200.0,
        "slope_deg": 14.5,
        "ice_probability_pct": 85.0,
        "annual_sunlight_pct": 86.2,
        "description": "Ubicado casi exactamente en el Polo Sur Lunar. Presenta picos con iluminación solar cuasi-permanente y un interior en sombra eterna (PSR) con ricas reservas de hielo de agua.",
        "site_type": "polar_crater_rim",
        "base_horizon_deg": 2.2,
        "earth_los_available": True,
    },
    {
        "id": "malapert-massif",
        "name": "Montaña Malapert (Macizo)",
        "category": "Polo Sur / Relé de Comunicaciones",
        "lat": -85.99,
        "lon": 2.91,
        "elevation_m": 5000.0,
        "slope_deg": 9.2,
        "ice_probability_pct": 20.0,
        "annual_sunlight_pct": 89.4,
        "description": "Pico de luz casi eterna elevado a 5,000 metros. Mantiene una línea de visión directa continua con la Tierra, lo que lo convierte en el sitio ideal para la estación repetidora de telecomunicaciones de Artemis.",
        "site_type": "mountain_massif",
        "base_horizon_deg": 1.4,
        "earth_los_available": True,
    },
    {
        "id": "connecting-ridge",
        "name": "Cresta de Conexión (Connecting Ridge)",
        "category": "Polo Sur / Corredor de Tránsito",
        "lat": -89.44,
        "lon": 222.00,
        "elevation_m": 2100.0,
        "slope_deg": 6.8,
        "ice_probability_pct": 45.0,
        "annual_sunlight_pct": 82.0,
        "description": "Cresta estratégica que conecta los cráteres Shackleton y de Gerlache. Proporciona condiciones excelentes de energía solar y rutas viables para rovers de superficie.",
        "site_type": "connecting_ridge",
        "base_horizon_deg": 1.8,
        "earth_los_available": True,
    },
    {
        "id": "faustini-rim",
        "name": "Borde del Cráter Faustini",
        "category": "Polo Sur / Recursos Volátiles",
        "lat": -87.30,
        "lon": 77.00,
        "elevation_m": 1800.0,
        "slope_deg": 18.0,
        "ice_probability_pct": 92.0,
        "annual_sunlight_pct": 74.5,
        "description": "Borde circumpolar sur con gradientes térmicos extremos. Entorno clave para estudiar la acumulación de volátiles lunares y la interacción con el regolito polar.",
        "site_type": "polar_crater_rim",
        "base_horizon_deg": 2.8,
        "earth_los_available": True,
    },
    {
        "id": "apollo-11",
        "name": "Apolo 11 (Statio Tranquillitatis)",
        "category": "Histórico / Llanura Ecuatorial",
        "lat": 0.67408,
        "lon": 23.47297,
        "elevation_m": -1200.0,
        "slope_deg": 1.8,
        "ice_probability_pct": 0.0,
        "annual_sunlight_pct": 50.0,
        "description": "Primer alunizaje tripulado en la historia humana (20 de julio de 1969). Llanura basáltica del Mar de la Tranquilidad con ciclo diurno regular de 29.5 días terrestres y la Tierra siempre visible en el cielo.",
        "site_type": "mare_plain",
        "base_horizon_deg": 0.3,
        "earth_los_available": True,
    },
    {
        "id": "oceanus-procellarum",
        "name": "Océano de las Tormentas (Oceanus Procellarum)",
        "category": "Mar Lunar / Zona Occidental",
        "lat": 18.00,
        "lon": -64.00,
        "elevation_m": -2000.0,
        "slope_deg": 1.2,
        "ice_probability_pct": 0.0,
        "annual_sunlight_pct": 50.0,
        "description": "La mayor planicie lunar (mare) en la cara visible. Sitio histórico de sondas robóticas y referencia para comparar condiciones ecuatoriales/templadas de iluminación frente a los polos.",
        "site_type": "mare_plain",
        "base_horizon_deg": 0.2,
        "earth_los_available": True,
    },
]


def generate_preset_sites_data(now_utc: datetime):
    """Calculates sites metadata, current status, and 30-day hourly timeline."""
    print(f"[*] Generating preset sites data at {now_utc.isoformat()}...")

    # Calculate global ephemeris snapshot
    eph = get_selenographic_ephemeris(now_utc)
    libration_summary = {
        "sub_earth_lat": round(eph["sub_earth_lat"], 3),
        "sub_earth_lon": round(eph["sub_earth_lon"], 3),
        "sub_solar_lat": round(eph["sub_solar_lat"], 3),
        "sub_solar_lon": round(eph["sub_solar_lon"], 3),
        "earth_distance_km": round(eph["earth_distance_km"], 1),
        "sun_distance_au": round(eph["sun_distance_au"], 5),
        "earth_phase_angle_deg": round(eph["earth_phase_angle_deg"], 2),
    }

    sites_output = []
    horizons_cache = {}

    for meta in PRESET_SITES_METADATA:
        print(f" -> Processing site: {meta['name']} ({meta['id']})")
        # 1. Generate realistic terrain horizon profile
        horizon = generate_synthetic_horizon_profile(
            site_type=meta["site_type"],
            base_elevation=meta["base_horizon_deg"],
            num_points=36,
        )
        horizons_cache[meta["id"]] = horizon

        # 2. Topocentric targets with Latency
        sun_topo = compute_topocentric_target(
            eph["vec_m2s_sel"], "Sun", meta["lat"], meta["lon"], meta["elevation_m"]
        )
        sun_mask = interpolate_horizon_elevation(sun_topo["azimuth_deg"], horizon, meta["base_horizon_deg"])
        sun_topo["is_above_terrain_horizon"] = sun_topo["elevation_deg"] > sun_mask

        earth_topo = compute_topocentric_target(
            eph["vec_m2e_sel"], "Earth", meta["lat"], meta["lon"], meta["elevation_m"]
        )
        earth_mask = interpolate_horizon_elevation(earth_topo["azimuth_deg"], horizon, meta["base_horizon_deg"])
        earth_topo["is_above_terrain_horizon"] = earth_topo["elevation_deg"] > earth_mask

        # 3. Visibility and countdowns
        visibility = calculate_visibility_and_countdowns(
            lat_deg=meta["lat"],
            lon_deg=meta["lon"],
            elevation_m=meta["elevation_m"],
            horizon_profile=horizon,
            current_dt=now_utc,
            default_horizon_deg=meta["base_horizon_deg"],
        )

        site_entry = {
            "id": meta["id"],
            "name": meta["name"],
            "category": meta["category"],
            "lat": meta["lat"],
            "lon": meta["lon"],
            "elevation_m": meta["elevation_m"],
            "slope_deg": meta["slope_deg"],
            "ice_probability_pct": meta["ice_probability_pct"],
            "annual_sunlight_pct": meta["annual_sunlight_pct"],
            "description": meta["description"],
            "default_horizon_elevation_deg": meta["base_horizon_deg"],
            "horizon_profile": horizon,
            "current_status": {
                "timestamp_utc": now_utc.isoformat(),
                "sun": sun_topo,
                "earth": earth_topo,
                "visibility": visibility.model_dump(),
            },
        }
        sites_output.append(site_entry)

    # 4. Generate 30-Day Hourly Timeline (720 hours for time-slider)
    print("\n[*] Precalculating 30-day hourly timeline (720 steps per site)...")
    timeline_output = {}
    hours_to_forecast = 720  # 30 days
    step_h = 2  # Step of 2 hours gives 360 points per site (super smooth and lightweight)

    for meta in PRESET_SITES_METADATA:
        site_id = meta["id"]
        horizon = horizons_cache[site_id]
        def_mask = meta["base_horizon_deg"]
        site_points = []

        for step in range(0, hours_to_forecast + 1, step_h):
            step_dt = now_utc + timedelta(hours=step)
            step_eph = get_selenographic_ephemeris(step_dt)

            # Sun
            s_topo = compute_topocentric_target(step_eph["vec_m2s_sel"], "Sun", meta["lat"], meta["lon"], meta["elevation_m"])
            s_mask = interpolate_horizon_elevation(s_topo["azimuth_deg"], horizon, def_mask)
            is_sunlit = s_topo["elevation_deg"] > s_mask

            # Earth
            e_topo = compute_topocentric_target(step_eph["vec_m2e_sel"], "Earth", meta["lat"], meta["lon"], meta["elevation_m"])
            e_mask = interpolate_horizon_elevation(e_topo["azimuth_deg"], horizon, def_mask)
            earth_los = e_topo["elevation_deg"] > e_mask

            dist_km = e_topo["distance_km"]
            rtt_sec = round((2.0 * dist_km) / SPEED_OF_LIGHT_KM_S, 3)

            site_points.append({
                "timestamp_utc": step_dt.isoformat(),
                "hour_offset": step,
                "sun_elevation_deg": s_topo["elevation_deg"],
                "sun_azimuth_deg": s_topo["azimuth_deg"],
                "is_sunlit": is_sunlit,
                "earth_elevation_deg": e_topo["elevation_deg"],
                "earth_azimuth_deg": e_topo["azimuth_deg"],
                "earth_los": earth_los,
                "earth_distance_km": dist_km,
                "latency_rtt_sec": rtt_sec,
                "earth_phase_angle_deg": round(step_eph["earth_phase_angle_deg"], 2),
            })

        timeline_output[site_id] = site_points

    # 5. Generate Supabase Seed SQL
    print("\n[*] Generating Supabase SQL seed file...")
    sql_lines = [
        "-- AstroTeam - Supabase Seed Script for NASA Space Apps 2026",
        "-- Copy and paste this directly into Supabase SQL Editor\n",
        "DROP TABLE IF EXISTS site_telemetry_timeline CASCADE;",
        "DROP TABLE IF EXISTS lunar_sites CASCADE;\n",
        "CREATE TABLE lunar_sites (",
        "  id TEXT PRIMARY KEY,",
        "  name TEXT NOT NULL,",
        "  category TEXT NOT NULL,",
        "  lat NUMERIC NOT NULL,",
        "  lon NUMERIC NOT NULL,",
        "  elevation_m NUMERIC NOT NULL,",
        "  slope_deg NUMERIC,",
        "  ice_probability_pct NUMERIC,",
        "  annual_sunlight_pct NUMERIC,",
        "  description TEXT",
        ");\n",
        "CREATE TABLE site_telemetry_timeline (",
        "  id BIGSERIAL PRIMARY KEY,",
        "  site_id TEXT REFERENCES lunar_sites(id),",
        "  timestamp_utc TIMESTAMPTZ NOT NULL,",
        "  sun_elevation_deg NUMERIC NOT NULL,",
        "  sun_azimuth_deg NUMERIC NOT NULL,",
        "  is_sunlit BOOLEAN NOT NULL,",
        "  earth_elevation_deg NUMERIC NOT NULL,",
        "  earth_azimuth_deg NUMERIC NOT NULL,",
        "  earth_los BOOLEAN NOT NULL,",
        "  earth_distance_km NUMERIC NOT NULL,",
        "  latency_rtt_sec NUMERIC NOT NULL,",
        "  earth_phase_angle_deg NUMERIC",
        ");\n",
        "CREATE INDEX idx_telemetry_time ON site_telemetry_timeline(site_id, timestamp_utc);\n",
        "-- Insert Sites",
    ]

    for site in sites_output:
        desc_escaped = site['description'].replace("'", "''")
        sql_lines.append(
            f"INSERT INTO lunar_sites (id, name, category, lat, lon, elevation_m, slope_deg, ice_probability_pct, annual_sunlight_pct, description) "
            f"VALUES ('{site['id']}', '{site['name']}', '{site['category']}', {site['lat']}, {site['lon']}, {site['elevation_m']}, {site['slope_deg']}, {site['ice_probability_pct']}, {site['annual_sunlight_pct']}, '{desc_escaped}');"
        )

    sql_lines.append("\n-- Insert Sample Telemetry Timeline (First 72 hours per site)")
    for site_id, points in timeline_output.items():
        for p in points[:36]:  # Insert first 72 hours into SQL seed
            is_sun = "TRUE" if p["is_sunlit"] else "FALSE"
            e_los = "TRUE" if p["earth_los"] else "FALSE"
            sql_lines.append(
                f"INSERT INTO site_telemetry_timeline (site_id, timestamp_utc, sun_elevation_deg, sun_azimuth_deg, is_sunlit, earth_elevation_deg, earth_azimuth_deg, earth_los, earth_distance_km, latency_rtt_sec, earth_phase_angle_deg) "
                f"VALUES ('{site_id}', '{p['timestamp_utc']}', {p['sun_elevation_deg']}, {p['sun_azimuth_deg']}, {is_sun}, {p['earth_elevation_deg']}, {p['earth_azimuth_deg']}, {e_los}, {p['earth_distance_km']}, {p['latency_rtt_sec']}, {p['earth_phase_angle_deg']});"
            )

    full_sites_payload = {
        "metadata": {
            "generated_at": now_utc.isoformat(),
            "count": len(sites_output),
            "libration_snapshot": libration_summary,
            "ephemeris_engine": "Skyfield DE421 + IAU 2015 WGCCRE Lunar Frame",
        },
        "sites": sites_output,
    }

    full_timeline_payload = {
        "metadata": {
            "generated_at": now_utc.isoformat(),
            "forecast_duration_hours": hours_to_forecast,
            "step_hours": step_h,
            "sites_count": len(timeline_output),
        },
        "timelines": timeline_output,
    }

    return full_sites_payload, full_timeline_payload, "\n".join(sql_lines)


def main():
    now_utc = datetime.now(timezone.utc)
    sites_json, timeline_json, sql_script = generate_preset_sites_data(now_utc)

    # 1. Save Sites JSON
    for target in [OUTPUT_FILE, DATA_DIR / "preset_sites.json"]:
        target.parent.mkdir(parents=True, exist_ok=True)
        with open(target, "w", encoding="utf-8") as f:
            json.dump(sites_json, f, indent=2, ensure_ascii=False)
        print(f"[✓] Saved sites metadata to: {target}")

    # 2. Save Timeline JSON
    for target in [TIMELINE_FILE, DATA_DIR / "preset_sites_timeline.json"]:
        target.parent.mkdir(parents=True, exist_ok=True)
        with open(target, "w", encoding="utf-8") as f:
            json.dump(timeline_json, f, indent=2, ensure_ascii=False)
        print(f"[✓] Saved 30-day timeline to: {target}")

    # 3. Save Supabase SQL
    with open(SUPABASE_SQL_FILE, "w", encoding="utf-8") as f:
        f.write(sql_script)
    print(f"[✓] Saved Supabase SQL script to: {SUPABASE_SQL_FILE}")

    # 4. Auto-sync to Next.js public/data/ if directory exists
    if PUBLIC_DATA_DIR.parent.exists():
        PUBLIC_DATA_DIR.mkdir(parents=True, exist_ok=True)
        with open(PUBLIC_DATA_DIR / "preset_sites.json", "w", encoding="utf-8") as f:
            json.dump(sites_json, f, indent=2, ensure_ascii=False)
        with open(PUBLIC_DATA_DIR / "preset_sites_timeline.json", "w", encoding="utf-8") as f:
            json.dump(timeline_json, f, indent=2, ensure_ascii=False)
        print(f"[✓] Auto-synced all JSONs to Next.js frontend: {PUBLIC_DATA_DIR}")


if __name__ == "__main__":
    main()
