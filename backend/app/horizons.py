"""JPL Horizons observer ephemerides and terrain-aware timeline conversion."""

import csv
import io
import math
import time
from datetime import datetime, timezone
from typing import Dict, List

import requests

from app.terrain import (
    EARTH_RADIUS_KM,
    SUN_RADIUS_KM,
    interpolate_horizon_elevation,
    target_disk_visibility,
)

HORIZONS_URL = "https://ssd.jpl.nasa.gov/api/horizons.api"
SPEED_OF_LIGHT_KM_S = 299792.458


class HorizonsError(RuntimeError):
    pass


def _number(value: str, field: str) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError) as error:
        raise HorizonsError(f"Horizons returned an invalid {field} value.") from error
    if not math.isfinite(number):
        raise HorizonsError(f"Horizons returned a non-finite {field} value.")
    return number


def parse_observer_result(result: str, include_range: bool) -> List[Dict]:
    try:
        table = result.split("$$SOE", 1)[1].split("$$EOE", 1)[0]
    except IndexError as error:
        raise HorizonsError("Horizons response has no ephemeris table.") from error

    observations = []
    for fields in csv.reader(io.StringIO(table)):
        fields = [field.strip() for field in fields]
        if not fields or not fields[0]:
            continue
        if len(fields) < (9 if include_range else 5):
            raise HorizonsError("Horizons returned an incomplete ephemeris row.")
        try:
            timestamp = datetime.strptime(
                fields[0], "%Y-%b-%d %H:%M"
            ).replace(tzinfo=timezone.utc)
        except ValueError as error:
            raise HorizonsError(
                f"Horizons returned an invalid UTC timestamp: {fields[0]}."
            ) from error

        observation = {
            "timestamp": timestamp,
            "azimuth_deg": _number(fields[3], "azimuth"),
            "elevation_deg": _number(fields[4], "elevation"),
        }
        if include_range:
            observation.update(
                {
                    "distance_km": _number(fields[5], "range"),
                    "one_way_light_time_minutes": _number(fields[7], "light time"),
                    "phase_angle_deg": _number(fields[8], "phase angle"),
                }
            )
        observations.append(observation)

    if not observations:
        raise HorizonsError("Horizons returned no ephemeris points.")
    return observations


def fetch_observer_ephemeris(
    target_id: str,
    longitude_deg: float,
    latitude_deg: float,
    elevation_km: float,
    start_utc: datetime,
    stop_utc: datetime,
    include_range: bool,
) -> List[Dict]:
    quantities = "4,20,21,24" if include_range else "4"
    site_coords = "{:.8f},{:.8f},{:.6f}".format(
        longitude_deg % 360.0,
        latitude_deg,
        elevation_km,
    )
    params = {
        "format": "json",
        "COMMAND": target_id,
        "OBJ_DATA": "NO",
        "MAKE_EPHEM": "YES",
        "EPHEM_TYPE": "OBSERVER",
        "CENTER": "coord@301",
        "COORD_TYPE": "GEODETIC",
        "SITE_COORD": site_coords,
        "START_TIME": start_utc.strftime("%Y-%m-%d %H:%M"),
        "STOP_TIME": stop_utc.strftime("%Y-%m-%d %H:%M"),
        "STEP_SIZE": "1 h",
        "TIME_TYPE": "UT",
        "TIME_ZONE": "+00:00",
        "TIME_DIGITS": "MINUTES",
        "CAL_TYPE": "GREGORIAN",
        "QUANTITIES": quantities,
        "RANGE_UNITS": "KM",
        "CSV_FORMAT": "YES",
    }

    last_error = None
    for attempt in range(3):
        try:
            response = requests.get(HORIZONS_URL, params=params, timeout=45)
            response.raise_for_status()
            payload = response.json()
            if "error" in payload:
                raise HorizonsError(f"Horizons rejected the request: {payload['error']}")
            result = payload.get("result")
            if not isinstance(result, str):
                raise HorizonsError("Horizons response is missing its result table.")
            return parse_observer_result(result, include_range)
        except HorizonsError:
            raise
        except (requests.RequestException, ValueError) as error:
            last_error = error
            if attempt < 2:
                time.sleep(2 ** attempt)
    raise HorizonsError("Could not retrieve ephemerides from JPL Horizons.") from last_error


def build_site_timeline(
    site_id: str,
    sun_rows: List[Dict],
    earth_rows: List[Dict],
    horizon_profile: List[Dict[str, float]],
    default_horizon_deg: float,
) -> List[Dict]:
    if len(sun_rows) != len(earth_rows):
        raise HorizonsError(f"Different Sun/Earth point counts for site '{site_id}'.")

    timeline = []
    for sun, earth in zip(sun_rows, earth_rows):
        if sun["timestamp"] != earth["timestamp"]:
            raise HorizonsError(f"Sun/Earth timestamps do not match for site '{site_id}'.")

        sun_horizon = interpolate_horizon_elevation(
            sun["azimuth_deg"], horizon_profile, default_horizon_deg
        )
        earth_horizon = interpolate_horizon_elevation(
            earth["azimuth_deg"], horizon_profile, default_horizon_deg
        )
        sun_visibility = target_disk_visibility(
            sun["elevation_deg"],
            sun_horizon,
            sun["distance_km"],
            SUN_RADIUS_KM,
        )
        earth_visibility = target_disk_visibility(
            earth["elevation_deg"],
            earth_horizon,
            earth["distance_km"],
            EARTH_RADIUS_KM,
        )
        one_way_latency_sec = earth["one_way_light_time_minutes"] * 60.0
        if earth["distance_km"] <= 0 or one_way_latency_sec < 0:
            raise HorizonsError(
                f"Horizons returned invalid range/light-time for site '{site_id}'."
            )
        if abs(
            one_way_latency_sec
            - earth["distance_km"] / SPEED_OF_LIGHT_KM_S
        ) > 0.1:
            raise HorizonsError(
                f"Horizons range/light-time mismatch for site '{site_id}'."
            )

        timeline.append(
            {
                "site_id": site_id,
                "fecha_hora": sun["timestamp"].isoformat(timespec="seconds"),
                "sol_elevacion": sun["elevation_deg"],
                "sol_azimut": sun["azimuth_deg"],
                "sol_estado_luz": sun_visibility["center_visible"],
                "sol_parte_visible": sun_visibility["any_part_visible"],
                "sol_disco_completo_visible": sun_visibility["full_disk_visible"],
                "tierra_elevacion": earth["elevation_deg"],
                "tierra_azimut": earth["azimuth_deg"],
                "linea_vista_directa": earth_visibility["center_visible"],
                "tierra_parte_visible": earth_visibility["any_part_visible"],
                "tierra_disco_completo_visible": earth_visibility["full_disk_visible"],
                "distancia_km": earth["distance_km"],
                "latencia_seg": one_way_latency_sec,
                "angulo_fase": earth["phase_angle_deg"],
            }
        )
    return timeline
