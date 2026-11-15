"""Fetch hourly JPL Horizons data and upsert it into Supabase."""

import argparse
import math
import sys
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

backend_root = Path(__file__).resolve().parent.parent
if str(backend_root) not in sys.path:
    sys.path.insert(0, str(backend_root))

from app.horizons import HorizonsError, build_site_timeline, fetch_observer_ephemeris
from app.supabase_client import SupabaseError, select_rows, upsert_rows

TIMELINE_BATCH_SIZE = 250


def _parse_start(value):
    if value is None:
        return datetime.now(timezone.utc).replace(
            minute=0, second=0, microsecond=0
        )
    try:
        start = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise ValueError("--start-utc debe ser una fecha ISO 8601.") from error
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    return start.astimezone(timezone.utc).replace(minute=0, second=0, microsecond=0)


def _load_sites(site_id=None):
    params = {
        "select": (
            "id,nombre,latitud,longitud,altitud_km,"
            "default_horizon_elevation_deg"
        ),
        "order": "id.asc",
    }
    if site_id:
        params["id"] = f"eq.{site_id}"
    sites = select_rows("lunar_sites", params)
    if not sites:
        if site_id:
            raise ValueError(f"No existe el sitio '{site_id}' en lunar_sites.")
        raise ValueError("lunar_sites no tiene sitios para sincronizar.")

    profiles = defaultdict(list)
    for site in sites:
        profile_site_id = site["id"]
        offset = 0
        while True:
            profile_rows = select_rows(
                "site_horizon_profile",
                {
                    "select": "site_id,azimuth_deg,elevation_deg",
                    "site_id": f"eq.{profile_site_id}",
                    "order": "azimuth_deg.asc",
                    "limit": "1000",
                    "offset": str(offset),
                },
            )
            for row in profile_rows:
                try:
                    azimuth = float(row["azimuth_deg"])
                    elevation = float(row["elevation_deg"])
                except (KeyError, TypeError, ValueError) as error:
                    raise ValueError(
                        f"Perfil topográfico inválido para '{profile_site_id}'."
                    ) from error
                if (
                    not math.isfinite(azimuth)
                    or not math.isfinite(elevation)
                    or not 0.0 <= azimuth < 360.0
                ):
                    raise ValueError(
                        f"Elevación o azimut inválido en el perfil '{profile_site_id}'."
                    )
                profiles[profile_site_id].append(
                    {"azimuth": azimuth, "elevation_deg": elevation}
                )
            if len(profile_rows) < 1000:
                break
            offset += len(profile_rows)

    for site in sites:
        site_id_value = site["id"]
        try:
            latitude = float(site["latitud"])
            longitude = float(site["longitud"])
            elevation_km = float(site["altitud_km"])
            default_horizon = float(site["default_horizon_elevation_deg"])
        except (KeyError, TypeError, ValueError) as error:
            raise ValueError(
                f"Coordenadas o elevación de horizonte inválidas para '{site_id_value}'."
            ) from error
        if (
            not all(
                math.isfinite(value)
                for value in (latitude, longitude, elevation_km, default_horizon)
            )
            or not -90.0 <= latitude <= 90.0
            or not -180.0 <= longitude <= 360.0
        ):
            raise ValueError(
                f"Coordenadas o elevación de horizonte inválidas para '{site_id_value}'."
            )
        profile = profiles.get(site_id_value, [])
        if len(profile) < 3:
            raise ValueError(
                f"El sitio '{site_id_value}' necesita al menos 3 puntos "
                "en site_horizon_profile."
            )
        if len({point["azimuth"] for point in profile}) != len(profile):
            raise ValueError(
                f"El sitio '{site_id_value}' tiene azimuts topográficos duplicados."
            )
        site["horizon_profile"] = profile
    return sites


def generate_rows(sites, start_utc, days):
    stop_utc = start_utc + timedelta(days=days) - timedelta(hours=1)
    rows = []
    for site in sites:
        site_id = site["id"]
        longitude = float(site["longitud"])
        latitude = float(site["latitud"])
        elevation_km = float(site["altitud_km"])

        print(f"Consultando Horizons para {site_id}: Sol y Tierra...")
        sun_rows = fetch_observer_ephemeris(
            "10",
            longitude,
            latitude,
            elevation_km,
            start_utc,
            stop_utc,
            include_range=True,
        )
        earth_rows = fetch_observer_ephemeris(
            "399",
            longitude,
            latitude,
            elevation_km,
            start_utc,
            stop_utc,
            include_range=True,
        )
        rows.extend(
            build_site_timeline(
                site_id,
                sun_rows,
                earth_rows,
                site["horizon_profile"],
                float(site["default_horizon_elevation_deg"]),
            )
        )
    return rows


def summarize_site_visibility(rows):
    counts = defaultdict(lambda: {"total": 0, "sunlit": 0, "earth_visible": 0})
    for row in rows:
        counts[row["site_id"]]["total"] += 1
        counts[row["site_id"]]["sunlit"] += int(row["sol_estado_luz"])
        counts[row["site_id"]]["earth_visible"] += int(row["linea_vista_directa"])

    summaries = []
    for site_id, count in sorted(counts.items()):
        if count["total"] == 0:
            continue
        summaries.append(
            {
                "id": site_id,
                "pct_luz_solar": round(100.0 * count["sunlit"] / count["total"], 2),
                "pct_vista_tierra": round(
                    100.0 * count["earth_visible"] / count["total"], 2
                ),
            }
        )
    return summaries


def main():
    parser = argparse.ArgumentParser(
        description="Genera y guarda telemetría horaria desde JPL Horizons."
    )
    parser.add_argument("--site-id", help="Sincroniza solo este id de lunar_sites.")
    parser.add_argument(
        "--start-utc",
        help="Inicio ISO 8601 (por defecto, la hora UTC actual redondeada).",
    )
    parser.add_argument(
        "--days",
        type=int,
        default=30,
        choices=range(1, 31),
        metavar="{1..30}",
        help="Duración en días; por defecto 30.",
    )
    args = parser.parse_args()

    try:
        start_utc = _parse_start(args.start_utc)
        sites = _load_sites(args.site_id)
        rows = generate_rows(sites, start_utc, args.days)
        for offset in range(0, len(rows), TIMELINE_BATCH_SIZE):
            upsert_rows(
                "site_cronograma",
                rows[offset : offset + TIMELINE_BATCH_SIZE],
                "site_id,fecha_hora",
            )
        upsert_rows(
            "lunar_sites",
            summarize_site_visibility(rows),
            "id",
        )
    except (HorizonsError, SupabaseError, ValueError) as error:
        raise SystemExit(f"No se pudo sincronizar Horizons: {error}") from error

    print(
        f"Sincronización terminada: {len(sites)} sitios, {len(rows)} puntos, "
        f"desde {start_utc.isoformat()}."
    )


if __name__ == "__main__":
    main()
