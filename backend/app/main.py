"""
FastAPI Backend Application for AstroTeam Lunar Explorer.
Provides RESTful endpoints for lunar ephemerides, libration,
terrain horizon masks, and solar/Earth visibility countdowns.
"""

import math
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from dateutil import parser as date_parser

from app.schemas import (
    PresetSite,
    SiteStatusResponse,
    CustomSiteRequest,
    SiteTimelineResponse,
    TimeSeriesPoint,
    LibrationData,
    CelestialTarget,
    SiteCoordinates,
)
from app.ephemeris import (
    get_selenographic_ephemeris,
    compute_topocentric_target,
    get_skyfield_data,
)
from app.terrain import (
    EARTH_RADIUS_KM,
    SUN_RADIUS_KM,
    calculate_visibility_and_countdowns,
    interpolate_horizon_elevation,
    generate_synthetic_horizon_profile,
    target_disk_visibility,
)
from app.supabase_client import SupabaseError, select_rows

app = FastAPI(
    title="AstroTeam Lunar Backend API",
    description="High-precision lunar ephemerides, solar illumination, and Earth line-of-sight tracking service.",
    version="1.0.0",
)

# CORS Configuration for Frontend integration (Vite, Next.js, React, Vue, etc.)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SITE_SELECT = (
    "id,mision,nombre,latitud,longitud,altitud_km,"
    "pct_luz_solar,pct_vista_tierra"
)
SITE_DETAIL_SELECT = f"{SITE_SELECT},default_horizon_elevation_deg"


def _supabase_select(table: str, params: dict) -> list:
    """Read rows from a public Supabase table via PostgREST."""
    try:
        return select_rows(table, params)
    except SupabaseError as error:
        raise HTTPException(status_code=error.status_code, detail=str(error)) from error


def _get_site(site_id: str) -> dict:
    rows = _supabase_select(
        "lunar_sites",
        {"select": SITE_DETAIL_SELECT, "id": f"eq.{site_id}", "limit": "1"},
    )
    if not rows:
        raise HTTPException(status_code=404, detail=f"Site '{site_id}' not found.")
    return rows[0]


def _get_horizon_profile(site_id: str) -> list:
    rows = _supabase_select(
        "site_horizon_profile",
        {
            "select": "azimuth_deg,elevation_deg",
            "site_id": f"eq.{site_id}",
            "order": "azimuth_deg.asc",
        },
    )
    if len(rows) < 3:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Site '{site_id}' has no usable terrain horizon profile.",
        )

    profile = []
    try:
        for row in rows:
            azimuth = float(row["azimuth_deg"])
            elevation = float(row["elevation_deg"])
            if (
                not math.isfinite(azimuth)
                or not math.isfinite(elevation)
                or not 0.0 <= azimuth < 360.0
            ):
                raise ValueError("Invalid horizon point.")
            profile.append({"azimuth": azimuth, "elevation_deg": elevation})
    except (KeyError, TypeError, ValueError) as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Supabase returned an invalid terrain horizon profile.",
        ) from error
    if len({point["azimuth"] for point in profile}) != len(profile):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Supabase returned duplicate horizon azimuths.",
        )
    return profile


def _parse_utc_timestamp(value: str, field_name: str) -> datetime:
    try:
        parsed = date_parser.isoparse(value)
    except (TypeError, ValueError) as error:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid {field_name}; expected an ISO 8601 timestamp.",
        ) from error
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


@app.on_event("startup")
async def startup_event():
    """Initialize the ephemeris engine."""
    try:
        get_skyfield_data()
    except Exception:
        pass


@app.get("/", tags=["Health"])
def root():
    """Root endpoint for health and service status."""
    now_utc = datetime.now(timezone.utc)
    return {
        "status": "online",
        "service": "AstroTeam Lunar Ephemeris & Terrain API",
        "version": "1.0.0",
        "current_time_utc": now_utc.isoformat(),
        "docs_url": "/docs",
    }


@app.get("/api/sites", tags=["Sites"])
def list_preset_sites():
    """Returns the site catalog stored in Supabase."""
    rows = _supabase_select(
        "lunar_sites",
        {"select": SITE_SELECT, "order": "nombre.asc"},
    )
    return {"sites": rows}


@app.get("/api/sites/{site_id}", response_model=SiteStatusResponse, tags=["Sites"])
def get_site_status(
    site_id: str,
    timestamp_utc: Optional[str] = Query(None, description="ISO timestamp (e.g., 2026-11-14T12:00:00Z). Defaults to now.")
):
    """
    Returns real-time astronomical and terrain visibility status for a preset site.
    Includes current solar and Earth azimuth/elevation, libration, and sunrise/sunset countdowns.
    """
    site_data = _get_site(site_id)

    # Parse target datetime
    if timestamp_utc:
        try:
            target_dt = date_parser.isoparse(timestamp_utc)
            if target_dt.tzinfo is None:
                target_dt = target_dt.replace(tzinfo=timezone.utc)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid ISO timestamp format.")
    else:
        target_dt = datetime.now(timezone.utc)

    # Astronomical calculations
    eph = get_selenographic_ephemeris(target_dt)
    lat = float(site_data["latitud"])
    lon = float(site_data["longitud"])
    elevation_m = float(site_data["altitud_km"]) * 1000.0
    horizon_profile = _get_horizon_profile(site_id)
    try:
        default_mask = float(site_data["default_horizon_elevation_deg"])
    except (KeyError, TypeError, ValueError) as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Site '{site_id}' has no default terrain horizon elevation.",
        ) from error

    # Topocentric Sun
    sun_topo = compute_topocentric_target(
        eph["vec_m2s_sel"], "Sun", lat, lon, elevation_m
    )
    sun_mask = interpolate_horizon_elevation(sun_topo["azimuth_deg"], horizon_profile, default_mask)
    sun_topo["is_above_terrain_horizon"] = sun_topo["elevation_deg"] > sun_mask
    sun_disk_visibility = target_disk_visibility(
        sun_topo["elevation_deg"],
        sun_mask,
        sun_topo["distance_km"],
        SUN_RADIUS_KM,
    )
    sun_topo["is_any_part_visible"] = sun_disk_visibility["any_part_visible"]
    sun_topo["is_full_disk_visible"] = sun_disk_visibility["full_disk_visible"]

    # Topocentric Earth
    earth_topo = compute_topocentric_target(
        eph["vec_m2e_sel"], "Earth", lat, lon, elevation_m
    )
    earth_mask = interpolate_horizon_elevation(earth_topo["azimuth_deg"], horizon_profile, default_mask)
    earth_topo["is_above_terrain_horizon"] = earth_topo["elevation_deg"] > earth_mask
    earth_disk_visibility = target_disk_visibility(
        earth_topo["elevation_deg"],
        earth_mask,
        earth_topo["distance_km"],
        EARTH_RADIUS_KM,
    )
    earth_topo["is_any_part_visible"] = earth_disk_visibility["any_part_visible"]
    earth_topo["is_full_disk_visible"] = earth_disk_visibility["full_disk_visible"]

    # Countdowns
    visibility = calculate_visibility_and_countdowns(
        lat_deg=lat,
        lon_deg=lon,
        elevation_m=elevation_m,
        horizon_profile=horizon_profile,
        current_dt=target_dt,
        default_horizon_deg=default_mask,
    )

    return SiteStatusResponse(
        site_id=site_data["id"],
        name=site_data["nombre"],
        timestamp_utc=target_dt.isoformat(),
        coordinates=SiteCoordinates(
            lat=lat,
            lon=lon,
            elevation_m=elevation_m,
        ),
        sun=CelestialTarget(**sun_topo),
        earth=CelestialTarget(**earth_topo),
        libration=LibrationData(
            sub_earth_lat=round(eph["sub_earth_lat"], 3),
            sub_earth_lon=round(eph["sub_earth_lon"], 3),
            sub_solar_lat=round(eph["sub_solar_lat"], 3),
            sub_solar_lon=round(eph["sub_solar_lon"], 3),
            earth_distance_km=round(eph["earth_distance_km"], 1),
            sun_distance_au=round(eph["sun_distance_au"], 5),
            earth_phase_angle_deg=round(eph["earth_phase_angle_deg"], 2),
        ),
        visibility=visibility,
        horizon_profile=horizon_profile,
    )


@app.get("/api/sites/{site_id}/timeline", response_model=SiteTimelineResponse, tags=["Sites"])
def get_site_timeline(
    site_id: str,
    start_time_utc: Optional[str] = Query(None, description="Optional ISO timestamp filter."),
    hours: int = Query(720, ge=1, le=720, description="Optional duration in hours (up to 30 days)"),
    step_hours: float = Query(1.0, ge=0.5, le=24.0, description="Optional sampling interval in hours"),
):
    """
    Returns the stored time-series for a site, loaded from Supabase in one request.
    """
    rows = _supabase_select(
        "site_cronograma",
        {
            "select": (
                "site_id,fecha_hora,sol_elevacion,sol_azimut,sol_estado_luz,"
                "sol_parte_visible,sol_disco_completo_visible,"
                "tierra_elevacion,tierra_azimut,linea_vista_directa,"
                "tierra_parte_visible,tierra_disco_completo_visible,"
                "distancia_km,latencia_seg,angulo_fase,"
                "lunar_sites!inner(nombre)"
            ),
            "site_id": f"eq.{site_id}",
            "order": "fecha_hora.asc",
            "limit": "1000",
        },
    )
    if not rows:
        raise HTTPException(
            status_code=404,
            detail=f"No timeline rows found for site '{site_id}'.",
        )

    site_relation = rows[0].get("lunar_sites")
    if not isinstance(site_relation, dict) or not site_relation.get("nombre"):
        raise HTTPException(
            status_code=502,
            detail="Supabase timeline rows are missing the related site name.",
        )
    site_name = site_relation["nombre"]

    start_dt = (
        _parse_utc_timestamp(start_time_utc, "start_time_utc")
        if start_time_utc
        else None
    )
    end_dt = start_dt.timestamp() + hours * 3600 if start_dt else None
    step_seconds = step_hours * 3600
    points = []
    for row in rows:
        try:
            point_dt = _parse_utc_timestamp(row["fecha_hora"], "fecha_hora")
            sun_elevation = float(row["sol_elevacion"])
            sun_azimuth = float(row["sol_azimut"])
            earth_elevation = float(row["tierra_elevacion"])
            earth_azimuth = float(row["tierra_azimut"])
            earth_distance = float(row["distancia_km"])
            latency_one_way = float(row["latencia_seg"])
            phase_angle = float(row["angulo_fase"])
            sun_visible = row["sol_estado_luz"]
            sun_any_visible = row["sol_parte_visible"]
            sun_full_visible = row["sol_disco_completo_visible"]
            earth_visible = row["linea_vista_directa"]
            earth_any_visible = row["tierra_parte_visible"]
            earth_full_visible = row["tierra_disco_completo_visible"]
        except (KeyError, TypeError, ValueError) as error:
            raise HTTPException(
                status_code=502,
                detail="Supabase returned an invalid timeline row.",
            ) from error

        if not all(
            isinstance(value, bool)
            for value in (
                sun_visible,
                sun_any_visible,
                sun_full_visible,
                earth_visible,
                earth_any_visible,
                earth_full_visible,
            )
        ):
            raise HTTPException(
                status_code=502,
                detail="Supabase timeline visibility columns must be booleans.",
            )
        if start_dt:
            point_timestamp = point_dt.timestamp()
            if point_timestamp < start_dt.timestamp() or point_timestamp > end_dt:
                continue
            step_index = (point_timestamp - start_dt.timestamp()) / step_seconds
            if abs(step_index - round(step_index)) > 1e-6:
                continue

        points.append(
            TimeSeriesPoint(
                timestamp_utc=point_dt.isoformat(),
                sun_elevation_deg=sun_elevation,
                sun_azimuth_deg=sun_azimuth,
                earth_elevation_deg=earth_elevation,
                earth_azimuth_deg=earth_azimuth,
                is_sun_visible=sun_visible,
                is_sun_any_part_visible=sun_any_visible,
                is_sun_full_disk_visible=sun_full_visible,
                is_earth_visible=earth_visible,
                is_earth_any_part_visible=earth_any_visible,
                is_earth_full_disk_visible=earth_full_visible,
                earth_distance_km=earth_distance,
                earth_latency_rtt_sec=round(latency_one_way * 2.0, 3),
                earth_phase_angle_deg=phase_angle,
            )
        )

    return SiteTimelineResponse(site_id=site_id, name=site_name, points=points)


@app.post("/api/custom-site", response_model=SiteStatusResponse, tags=["Calculations"])
def evaluate_custom_site(request: CustomSiteRequest):
    """
    Evaluates real-time astronomical parameters and terrain visibility
    for any custom selenographic latitude and longitude on the Moon.
    """
    if request.timestamp_utc:
        try:
            target_dt = date_parser.isoparse(request.timestamp_utc)
            if target_dt.tzinfo is None:
                target_dt = target_dt.replace(tzinfo=timezone.utc)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid ISO timestamp format.")
    else:
        target_dt = datetime.now(timezone.utc)

    # Generate synthetic horizon for custom site based on latitude
    if abs(request.lat) >= 80.0:
        horizon_profile = generate_synthetic_horizon_profile("polar_crater_rim", request.default_horizon_elevation_deg or 1.5)
    else:
        horizon_profile = generate_synthetic_horizon_profile("mare_plain", request.default_horizon_elevation_deg or 0.2)

    eph = get_selenographic_ephemeris(target_dt)
    def_mask = request.default_horizon_elevation_deg or 0.5

    # Sun
    sun_topo = compute_topocentric_target(eph["vec_m2s_sel"], "Sun", request.lat, request.lon, request.elevation_m or 0.0)
    s_mask = interpolate_horizon_elevation(sun_topo["azimuth_deg"], horizon_profile, def_mask)
    sun_topo["is_above_terrain_horizon"] = sun_topo["elevation_deg"] > s_mask
    sun_disk_visibility = target_disk_visibility(
        sun_topo["elevation_deg"], s_mask, sun_topo["distance_km"], SUN_RADIUS_KM
    )
    sun_topo["is_any_part_visible"] = sun_disk_visibility["any_part_visible"]
    sun_topo["is_full_disk_visible"] = sun_disk_visibility["full_disk_visible"]

    # Earth
    earth_topo = compute_topocentric_target(eph["vec_m2e_sel"], "Earth", request.lat, request.lon, request.elevation_m or 0.0)
    e_mask = interpolate_horizon_elevation(earth_topo["azimuth_deg"], horizon_profile, def_mask)
    earth_topo["is_above_terrain_horizon"] = earth_topo["elevation_deg"] > e_mask
    earth_disk_visibility = target_disk_visibility(
        earth_topo["elevation_deg"], e_mask, earth_topo["distance_km"], EARTH_RADIUS_KM
    )
    earth_topo["is_any_part_visible"] = earth_disk_visibility["any_part_visible"]
    earth_topo["is_full_disk_visible"] = earth_disk_visibility["full_disk_visible"]

    # Visibility & Countdowns
    visibility = calculate_visibility_and_countdowns(
        lat_deg=request.lat,
        lon_deg=request.lon,
        elevation_m=request.elevation_m or 0.0,
        horizon_profile=horizon_profile,
        current_dt=target_dt,
        default_horizon_deg=def_mask,
    )

    return SiteStatusResponse(
        site_id="custom",
        name=f"Custom Site ({request.lat:.2f}°, {request.lon:.2f}°)",
        timestamp_utc=target_dt.isoformat(),
        coordinates=SiteCoordinates(lat=request.lat, lon=request.lon, elevation_m=request.elevation_m or 0.0),
        sun=CelestialTarget(**sun_topo),
        earth=CelestialTarget(**earth_topo),
        libration=LibrationData(
            sub_earth_lat=round(eph["sub_earth_lat"], 3),
            sub_earth_lon=round(eph["sub_earth_lon"], 3),
            sub_solar_lat=round(eph["sub_solar_lat"], 3),
            sub_solar_lon=round(eph["sub_solar_lon"], 3),
            earth_distance_km=round(eph["earth_distance_km"], 1),
            sun_distance_au=round(eph["sun_distance_au"], 5),
            earth_phase_angle_deg=round(eph["earth_phase_angle_deg"], 2),
        ),
        visibility=visibility,
        horizon_profile=horizon_profile,
    )


@app.get("/api/libration", response_model=LibrationData, tags=["Ephemeris"])
def get_current_libration(
    timestamp_utc: Optional[str] = Query(None, description="ISO timestamp. Defaults to now.")
):
    """
    Returns current sub-Earth and sub-Solar coordinates, optical/physical libration,
    and distances for the specified epoch.
    """
    if timestamp_utc:
        try:
            target_dt = date_parser.isoparse(timestamp_utc)
            if target_dt.tzinfo is None:
                target_dt = target_dt.replace(tzinfo=timezone.utc)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid timestamp format.")
    else:
        target_dt = datetime.now(timezone.utc)

    eph = get_selenographic_ephemeris(target_dt)
    return LibrationData(
        sub_earth_lat=round(eph["sub_earth_lat"], 3),
        sub_earth_lon=round(eph["sub_earth_lon"], 3),
        sub_solar_lat=round(eph["sub_solar_lat"], 3),
        sub_solar_lon=round(eph["sub_solar_lon"], 3),
        earth_distance_km=round(eph["earth_distance_km"], 1),
        sun_distance_au=round(eph["sun_distance_au"], 5),
        earth_phase_angle_deg=round(eph["earth_phase_angle_deg"], 2),
    )
