"""
Lunar terrain profile handling, horizon obstacle masks,
and astronomical visibility / countdown calculations.
"""

import math
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Optional, Tuple

from app.schemas import HorizonPoint, VisibilityCountdown
from app.ephemeris import get_selenographic_ephemeris, compute_topocentric_target


def interpolate_horizon_elevation(azimuth_deg: float, horizon_profile: List[Dict[str, float]], default_elevation_deg: float = 0.5) -> float:
    """
    Interpolates the local obstacle elevation angle (in degrees)
    for a given azimuth (0° to 360°) using the site's horizon profile.
    """
    if not horizon_profile:
        return default_elevation_deg

    azimuth_deg = azimuth_deg % 360.0

    # Sort profile by azimuth
    sorted_pts = sorted(horizon_profile, key=lambda p: p["azimuth"])
    az_list = [p["azimuth"] for p in sorted_pts]
    el_list = [p["elevation_deg"] for p in sorted_pts]

    # Handle circular wrapping (between last point and first point)
    if azimuth_deg <= az_list[0]:
        # Between last point (-360) and first point
        az0 = az_list[-1] - 360.0
        el0 = el_list[-1]
        az1 = az_list[0]
        el1 = el_list[0]
    elif azimuth_deg >= az_list[-1]:
        # Between last point and first point (+360)
        az0 = az_list[-1]
        el0 = el_list[-1]
        az1 = az_list[0] + 360.0
        el1 = el_list[0]
    else:
        # Standard interval search
        idx = 0
        for i in range(len(az_list) - 1):
            if az_list[i] <= azimuth_deg <= az_list[i + 1]:
                idx = i
                break
        az0, el0 = az_list[idx], el_list[idx]
        az1, el1 = az_list[idx + 1], el_list[idx + 1]

    # Linear interpolation
    if abs(az1 - az0) < 1e-6:
        return el0
    factor = (azimuth_deg - az0) / (az1 - az0)
    return el0 + factor * (el1 - el0)


def generate_synthetic_horizon_profile(site_type: str = "polar_crater_rim", base_elevation: float = 1.5, num_points: int = 36) -> List[Dict[str, float]]:
    """
    Generates a realistic synthetic lunar horizon mask (azimuth vs elevation angle)
    based on geomorphological type (crater rim, mountain massif, ridge, mare plain).
    """
    profile = []
    step = 360.0 / num_points

    for i in range(num_points):
        az = round(i * step, 1)
        rad = math.radians(az)

        if site_type == "polar_crater_rim":
            # Higher towards crater rim interior/massif (azimuth ~180°), lower towards polar plains
            elev = base_elevation + 1.2 * math.sin(rad) + 0.6 * math.cos(2 * rad) + 0.3 * math.sin(3 * rad)
        elif site_type == "mountain_massif":
            # High peak overlooking lower ridges with peaks at specific azimuths
            elev = base_elevation + 0.8 * math.cos(rad - math.pi / 4) + 0.5 * math.sin(2 * rad)
        elif site_type == "connecting_ridge":
            # Narrow saddle with elevated obstacles on opposing sides
            elev = base_elevation + 1.1 * math.cos(2 * rad) + 0.4 * math.sin(rad)
        elif site_type == "mare_plain":
            # Smooth flat basalt plain, minimal distant topographic relief
            elev = max(0.1, base_elevation + 0.15 * math.sin(2 * rad))
        else:
            elev = base_elevation

        profile.append({"azimuth": az, "elevation_deg": round(max(0.0, elev), 2)})

    return profile


def calculate_visibility_and_countdowns(
    lat_deg: float,
    lon_deg: float,
    elevation_m: float,
    horizon_profile: List[Dict[str, float]],
    current_dt: datetime,
    default_horizon_deg: float = 0.5,
    max_scan_days: float = 35.0,
    scan_step_hours: float = 1.0,
) -> VisibilityCountdown:
    """
    Computes current visibility of Sun and Earth, illumination status,
    and calculates time countdowns to next sunrise, sunset, and Earth-rise/set.
    """
    if current_dt.tzinfo is None:
        current_dt = current_dt.replace(tzinfo=timezone.utc)

    # 1. Compute current state
    current_eph = get_selenographic_ephemeris(current_dt)

    # Sun current topocentric
    sun_topo_raw = compute_topocentric_target(current_eph["vec_m2s_sel"], "Sun", lat_deg, lon_deg, elevation_m)
    sun_horizon_mask = interpolate_horizon_elevation(sun_topo_raw["azimuth_deg"], horizon_profile, default_horizon_deg)
    is_sun_visible = sun_topo_raw["elevation_deg"] > sun_horizon_mask

    # Earth current topocentric
    earth_topo_raw = compute_topocentric_target(current_eph["vec_m2e_sel"], "Earth", lat_deg, lon_deg, elevation_m)
    earth_horizon_mask = interpolate_horizon_elevation(earth_topo_raw["azimuth_deg"], horizon_profile, default_horizon_deg)
    is_earth_visible = earth_topo_raw["elevation_deg"] > earth_horizon_mask

    # Illumination descriptive status
    if is_sun_visible:
        if sun_topo_raw["elevation_deg"] - sun_horizon_mask < 0.5:
            illum_status = "Grazing / Low Sun"
        else:
            illum_status = "Illuminated"
    else:
        illum_status = "Shadow / Lunar Night"

    # 2. Forward scan for sunrise, sunset, and Earth LOS transitions
    next_sunrise_dt: Optional[datetime] = None
    next_sunset_dt: Optional[datetime] = None
    next_earth_rise_dt: Optional[datetime] = None
    next_earth_set_dt: Optional[datetime] = None

    scan_hours = int(max_scan_days * 24 / scan_step_hours)
    prev_sun_vis = is_sun_visible
    prev_earth_vis = is_earth_visible

    for step in range(1, scan_hours + 1):
        test_dt = current_dt + timedelta(hours=step * scan_step_hours)
        test_eph = get_selenographic_ephemeris(test_dt)

        # Check Sun
        if next_sunrise_dt is None or next_sunset_dt is None:
            s_topo = compute_topocentric_target(test_eph["vec_m2s_sel"], "Sun", lat_deg, lon_deg, elevation_m)
            s_mask = interpolate_horizon_elevation(s_topo["azimuth_deg"], horizon_profile, default_horizon_deg)
            s_vis = s_topo["elevation_deg"] > s_mask

            # Sunrise transition: False -> True
            if not prev_sun_vis and s_vis and next_sunrise_dt is None:
                # Refine with binary search within the step
                next_sunrise_dt = _refine_transition(
                    test_dt - timedelta(hours=scan_step_hours),
                    test_dt,
                    lat_deg,
                    lon_deg,
                    elevation_m,
                    horizon_profile,
                    default_horizon_deg,
                    "Sun",
                    target_visible=True,
                )

            # Sunset transition: True -> False
            if prev_sun_vis and not s_vis and next_sunset_dt is None:
                next_sunset_dt = _refine_transition(
                    test_dt - timedelta(hours=scan_step_hours),
                    test_dt,
                    lat_deg,
                    lon_deg,
                    elevation_m,
                    horizon_profile,
                    default_horizon_deg,
                    "Sun",
                    target_visible=False,
                )

            prev_sun_vis = s_vis

        # Check Earth (primarily changes at polar/limb borders due to libration)
        if next_earth_rise_dt is None or next_earth_set_dt is None:
            e_topo = compute_topocentric_target(test_eph["vec_m2e_sel"], "Earth", lat_deg, lon_deg, elevation_m)
            e_mask = interpolate_horizon_elevation(e_topo["azimuth_deg"], horizon_profile, default_horizon_deg)
            e_vis = e_topo["elevation_deg"] > e_mask

            if not prev_earth_vis and e_vis and next_earth_rise_dt is None:
                next_earth_rise_dt = test_dt
            if prev_earth_vis and not e_vis and next_earth_set_dt is None:
                next_earth_set_dt = test_dt
            prev_earth_vis = e_vis

        # Stop scanning if we found both primary solar events
        if next_sunrise_dt is not None and next_sunset_dt is not None:
            break

    # Calculate remaining seconds
    sec_to_sunrise = (next_sunrise_dt - current_dt).total_seconds() if next_sunrise_dt else None
    sec_to_sunset = (next_sunset_dt - current_dt).total_seconds() if next_sunset_dt else None

    return VisibilityCountdown(
        is_sun_visible=is_sun_visible,
        is_earth_visible=is_earth_visible,
        next_sunrise_utc=next_sunrise_dt.isoformat() if next_sunrise_dt else None,
        next_sunset_utc=next_sunset_dt.isoformat() if next_sunset_dt else None,
        seconds_to_sunrise=sec_to_sunrise,
        seconds_to_sunset=sec_to_sunset,
        next_earth_rise_utc=next_earth_rise_dt.isoformat() if next_earth_rise_dt else None,
        next_earth_set_utc=next_earth_set_dt.isoformat() if next_earth_set_dt else None,
        illumination_status=illum_status,
    )


def _refine_transition(
    dt_start: datetime,
    dt_end: datetime,
    lat_deg: float,
    lon_deg: float,
    elevation_m: float,
    horizon_profile: List[Dict[str, float]],
    default_horizon_deg: float,
    target_name: str,
    target_visible: bool,
    iterations: int = 5,
) -> datetime:
    """Refines the exact timestamp of rising or setting with binary search."""
    low = dt_start
    high = dt_end

    for _ in range(iterations):
        mid = low + (high - low) / 2
        eph = get_selenographic_ephemeris(mid)
        vec = eph["vec_m2s_sel"] if target_name == "Sun" else eph["vec_m2e_sel"]
        topo = compute_topocentric_target(vec, target_name, lat_deg, lon_deg, elevation_m)
        mask = interpolate_horizon_elevation(topo["azimuth_deg"], horizon_profile, default_horizon_deg)
        vis = topo["elevation_deg"] > mask

        if target_visible:  # Looking for sunrise (False -> True)
            if vis:
                high = mid
            else:
                low = mid
        else:  # Looking for sunset (True -> False)
            if vis:
                low = mid
            else:
                high = mid

    return high
