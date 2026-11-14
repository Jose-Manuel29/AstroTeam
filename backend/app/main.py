"""
FastAPI Backend Application for AstroTeam Lunar Explorer.
Provides RESTful endpoints for lunar ephemerides, libration,
terrain horizon masks, and solar/Earth visibility countdowns.
"""

import json
from pathlib import Path
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
    calculate_visibility_and_countdowns,
    interpolate_horizon_elevation,
    generate_synthetic_horizon_profile,
)

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
OUTPUT_DIR = BASE_DIR / "output"
PRESETS_FILE = (OUTPUT_DIR / "preset_sites.json") if (OUTPUT_DIR / "preset_sites.json").exists() else (DATA_DIR / "preset_sites.json")

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

# In-memory storage of loaded preset sites
_preset_sites_cache = {}


def load_preset_sites_cache():
    """Loads preset sites from data/preset_sites.json into memory."""
    global _preset_sites_cache
    if PRESETS_FILE.exists():
        try:
            with open(PRESETS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                sites_list = data.get("sites", [])
                _preset_sites_cache = {site["id"]: site for site in sites_list}
        except Exception as e:
            print(f"[!] Warning: Failed loading preset_sites.json: {e}")


@app.on_event("startup")
async def startup_event():
    """Initialize ephemeris and cached data on app start."""
    load_preset_sites_cache()
    # If preset file doesn't exist yet, run generator logic
    if not _preset_sites_cache:
        try:
            from scripts.generate_presets import generate_preset_sites_json
            generate_preset_sites_json()
            load_preset_sites_cache()
        except Exception as e:
            print(f"[!] Notice: Presets generation will be deferred: {e}")

    # Warm-up Skyfield / ephemeris engine
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
        "preset_sites_count": len(_preset_sites_cache),
        "docs_url": "/docs",
    }


@app.get("/api/sites", tags=["Sites"])
def list_preset_sites():
    """Returns the list of the 6 featured star lunar sites with basic information."""
    if not _preset_sites_cache:
        load_preset_sites_cache()

    sites_summary = []
    for site_id, site in _preset_sites_cache.items():
        sites_summary.append({
            "id": site["id"],
            "name": site["name"],
            "category": site["category"],
            "lat": site["lat"],
            "lon": site["lon"],
            "elevation_m": site["elevation_m"],
            "description": site["description"],
            "default_horizon_elevation_deg": site.get("default_horizon_elevation_deg", 0.5),
        })
    return {"sites": sites_summary}


@app.get("/api/sites/{site_id}", response_model=SiteStatusResponse, tags=["Sites"])
def get_site_status(
    site_id: str,
    timestamp_utc: Optional[str] = Query(None, description="ISO timestamp (e.g., 2026-11-14T12:00:00Z). Defaults to now.")
):
    """
    Returns real-time astronomical and terrain visibility status for a preset site.
    Includes current solar and Earth azimuth/elevation, libration, and sunrise/sunset countdowns.
    """
    if not _preset_sites_cache:
        load_preset_sites_cache()

    if site_id not in _preset_sites_cache:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Site '{site_id}' not found. Available sites: {list(_preset_sites_cache.keys())}"
        )

    site_data = _preset_sites_cache[site_id]

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
    horizon_profile = site_data.get("horizon_profile", [])
    default_mask = site_data.get("default_horizon_elevation_deg", 0.5)

    # Topocentric Sun
    sun_topo = compute_topocentric_target(
        eph["vec_m2s_sel"], "Sun", site_data["lat"], site_data["lon"], site_data["elevation_m"]
    )
    sun_mask = interpolate_horizon_elevation(sun_topo["azimuth_deg"], horizon_profile, default_mask)
    sun_topo["is_above_terrain_horizon"] = sun_topo["elevation_deg"] > sun_mask

    # Topocentric Earth
    earth_topo = compute_topocentric_target(
        eph["vec_m2e_sel"], "Earth", site_data["lat"], site_data["lon"], site_data["elevation_m"]
    )
    earth_mask = interpolate_horizon_elevation(earth_topo["azimuth_deg"], horizon_profile, default_mask)
    earth_topo["is_above_terrain_horizon"] = earth_topo["elevation_deg"] > earth_mask

    # Countdowns
    visibility = calculate_visibility_and_countdowns(
        lat_deg=site_data["lat"],
        lon_deg=site_data["lon"],
        elevation_m=site_data["elevation_m"],
        horizon_profile=horizon_profile,
        current_dt=target_dt,
        default_horizon_deg=default_mask,
    )

    return SiteStatusResponse(
        site_id=site_data["id"],
        name=site_data["name"],
        timestamp_utc=target_dt.isoformat(),
        coordinates=SiteCoordinates(
            lat=site_data["lat"],
            lon=site_data["lon"],
            elevation_m=site_data["elevation_m"],
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
    start_time_utc: Optional[str] = Query(None, description="Start ISO timestamp. Defaults to now."),
    hours: int = Query(48, ge=1, le=720, description="Forecast duration in hours (up to 30 days)"),
    step_hours: float = Query(2.0, ge=0.5, le=24.0, description="Step resolution in hours"),
):
    """
    Returns time-series data for solar and Earth elevations at the site.
    Ideal for rendering interactive elevation charts and illumination curves on the frontend.
    """
    if not _preset_sites_cache:
        load_preset_sites_cache()

    if site_id not in _preset_sites_cache:
        raise HTTPException(status_code=404, detail="Site not found.")

    site = _preset_sites_cache[site_id]
    horizon_profile = site.get("horizon_profile", [])
    default_mask = site.get("default_horizon_elevation_deg", 0.5)

    if start_time_utc:
        try:
            start_dt = date_parser.isoparse(start_time_utc)
            if start_dt.tzinfo is None:
                start_dt = start_dt.replace(tzinfo=timezone.utc)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid start_time_utc.")
    else:
        start_dt = datetime.now(timezone.utc)

    num_steps = int(hours / step_hours)
    points = []

    for i in range(num_steps + 1):
        step_dt = start_dt + (datetime.fromtimestamp(0, tz=timezone.utc) - datetime.fromtimestamp(0, tz=timezone.utc)).__class__(seconds=int(i * step_hours * 3600))
        eph = get_selenographic_ephemeris(step_dt)

        # Sun
        sun = compute_topocentric_target(eph["vec_m2s_sel"], "Sun", site["lat"], site["lon"], site["elevation_m"])
        s_mask = interpolate_horizon_elevation(sun["azimuth_deg"], horizon_profile, default_mask)
        is_sun_vis = sun["elevation_deg"] > s_mask

        # Earth
        earth = compute_topocentric_target(eph["vec_m2e_sel"], "Earth", site["lat"], site["lon"], site["elevation_m"])
        e_mask = interpolate_horizon_elevation(earth["azimuth_deg"], horizon_profile, default_mask)
        is_earth_vis = earth["elevation_deg"] > e_mask

        points.append(
            TimeSeriesPoint(
                timestamp_utc=step_dt.isoformat(),
                sun_elevation_deg=sun["elevation_deg"],
                sun_azimuth_deg=sun["azimuth_deg"],
                earth_elevation_deg=earth["elevation_deg"],
                earth_azimuth_deg=earth["azimuth_deg"],
                is_sun_visible=is_sun_vis,
                is_earth_visible=is_earth_vis,
                earth_distance_km=earth["distance_km"],
                earth_latency_rtt_sec=earth.get("latency_round_trip_sec", round((2.0 * earth["distance_km"]) / 299792.458, 3)),
                earth_phase_angle_deg=round(eph.get("earth_phase_angle_deg", 0.0), 2),
            )
        )

    return SiteTimelineResponse(site_id=site["id"], name=site["name"], points=points)


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

    # Earth
    earth_topo = compute_topocentric_target(eph["vec_m2e_sel"], "Earth", request.lat, request.lon, request.elevation_m or 0.0)
    e_mask = interpolate_horizon_elevation(earth_topo["azimuth_deg"], horizon_profile, def_mask)
    earth_topo["is_above_terrain_horizon"] = earth_topo["elevation_deg"] > e_mask

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
