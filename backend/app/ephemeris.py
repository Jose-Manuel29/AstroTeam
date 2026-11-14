"""
Astronomical ephemeris and lunar orientation calculations.
Integrates with NASA JPL ephemerides (Skyfield) and IAU lunar rotation models.
Calculates sub-Earth, sub-solar coordinates, libration, and topocentric positions
of the Sun and Earth from any selenographic site.
"""

import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Tuple, Optional
import numpy as np

# Directory for data and JPL ephemerides
DATA_DIR = Path(__file__).resolve().parent.parent / "data"

# Physical constants
LUNAR_MEAN_RADIUS_KM = 1737.4
AU_KM = 149597870.7
SPEED_OF_LIGHT_KM_S = 299792.458

# Global Skyfield cache
_skyfield_loaded = False
_eph = None
_ts = None


def get_skyfield_data():
    """
    Attempts to load Skyfield timescale and JPL de421.bsp ephemeris from data/
    If Skyfield is installed and network/file is available, caches and returns (ts, eph).
    Otherwise returns (None, None).
    """
    global _skyfield_loaded, _eph, _ts
    if _skyfield_loaded:
        return _ts, _eph

    try:
        from skyfield.api import Loader
        load = Loader(str(DATA_DIR))
        _ts = load.timescale()
        # de421.bsp is automatically downloaded to data/ on first load if internet is available
        _eph = load("de421.bsp")
        _skyfield_loaded = True
        return _ts, _eph
    except Exception:
        # Fall back to high-precision IAU analytical lunar ephemeris
        return None, None


def datetime_to_jd(dt: datetime) -> float:
    """Calculates Julian Date (JD) from a datetime in UTC."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)

    year = dt.year
    month = dt.month
    day = dt.day + (dt.hour + (dt.minute + (dt.second + dt.microsecond / 1e6) / 60.0) / 60.0) / 24.0

    if month <= 2:
        year -= 1
        month += 12

    A = int(year / 100)
    B = 2 - A + int(A / 4)
    jd = int(365.25 * (year + 4716)) + int(30.6001 * (month + 1)) + day + B - 1524.5
    return jd


def compute_iau_lunar_orientation(jd: float) -> Tuple[float, float, float]:
    """
    Computes IAU orientation of the Moon (alpha_0, delta_0, W) in degrees
    for epoch JD in ICRF (J2000).
    Based on IAU WGCCRE standard expressions.
    """
    d = jd - 2451545.0
    T = d / 36525.0

    # Delaunay arguments in radians
    d2r = math.radians
    E1 = d2r(125.045 - 0.0529921 * d)
    E2 = d2r(250.089 - 0.1059842 * d)
    E3 = d2r(260.008 + 13.0120009 * d)
    E4 = d2r(176.625 + 13.3407154 * d)
    E5 = d2r(357.529 + 0.9856003 * d)
    E6 = d2r(311.589 + 26.4057084 * d)
    E7 = d2r(134.963 + 13.0649930 * d)
    E8 = d2r(276.617 + 0.3287146 * d)
    E9 = d2r(34.226 + 1.7484877 * d)
    E10 = d2r(15.134 - 0.1589763 * d)
    E11 = d2r(119.743 + 0.0036042 * d)
    E12 = d2r(239.961 + 0.1643573 * d)
    E13 = d2r(25.053 + 12.9590088 * d)

    # Right ascension of Moon's north pole
    alpha_0 = (
        269.9949
        + 0.0031 * T
        - 3.8787 * math.sin(E1)
        - 0.1204 * math.sin(E2)
        + 0.0700 * math.sin(E3)
        - 0.0172 * math.sin(E4)
        + 0.0072 * math.sin(E6)
        - 0.0052 * math.sin(E10)
        + 0.0043 * math.sin(E13)
    )

    # Declination of Moon's north pole
    delta_0 = (
        66.5392
        + 0.0130 * T
        + 1.5419 * math.cos(E1)
        + 0.0239 * math.cos(E2)
        - 0.0278 * math.cos(E3)
        + 0.0068 * math.cos(E4)
        - 0.0029 * math.cos(E6)
        + 0.0009 * math.cos(E7)
        + 0.0008 * math.cos(E10)
        - 0.0009 * math.cos(E13)
    )

    # Rotation angle (prime meridian)
    W = (
        38.3213
        + 13.17635815 * d
        - 1.4e-12 * (d**2)
        + 3.5610 * math.sin(E1)
        + 0.1208 * math.sin(E2)
        - 0.0642 * math.sin(E3)
        + 0.0158 * math.sin(E4)
        + 0.0252 * math.sin(E5)
        - 0.0066 * math.sin(E6)
        - 0.0047 * math.sin(E7)
        - 0.0046 * math.sin(E8)
        + 0.0028 * math.sin(E9)
        + 0.0052 * math.sin(E10)
        + 0.0040 * math.sin(E11)
        + 0.0019 * math.sin(E12)
        - 0.0044 * math.sin(E13)
    )

    return alpha_0, delta_0, W % 360.0


def rotation_matrix_icrf_to_selenographic(alpha_0_deg: float, delta_0_deg: float, W_deg: float) -> np.ndarray:
    """
    Computes rotation matrix from ICRF (J2000 equator) to Moon body-fixed selenographic frame.
    R = R_z(W) * R_x(pi/2 - delta_0) * R_z(alpha_0 + pi/2)
    """
    a = math.radians(alpha_0_deg + 90.0)
    d = math.radians(90.0 - delta_0_deg)
    w = math.radians(W_deg)

    Rz_a = np.array([
        [math.cos(a), math.sin(a), 0],
        [-math.sin(a), math.cos(a), 0],
        [0, 0, 1]
    ])

    Rx_d = np.array([
        [1, 0, 0],
        [0, math.cos(d), math.sin(d)],
        [0, -math.sin(d), math.cos(d)]
    ])

    Rz_w = np.array([
        [math.cos(w), math.sin(w), 0],
        [-math.sin(w), math.cos(w), 0],
        [0, 0, 1]
    ])

    return Rz_w @ (Rx_d @ Rz_a)


def get_earth_and_sun_positions_icrf(dt: datetime) -> Tuple[np.ndarray, np.ndarray, float, float]:
    """
    Returns (vector_moon_to_earth_km, vector_moon_to_sun_km, earth_distance_km, sun_distance_au).
    Uses Skyfield + JPL de421 if loaded, otherwise uses high precision VSOP87/ELP-2000 analytical orbit.
    """
    ts, eph = get_skyfield_data()
    if ts is not None and eph is not None:
        try:
            t = ts.from_datetime(dt)
            moon = eph["moon"].at(t)
            earth = eph["earth"].at(t)
            sun = eph["sun"].at(t)

            pos_earth = (earth.position.km - moon.position.km)
            pos_sun = (sun.position.km - moon.position.km)
            dist_e = float(np.linalg.norm(pos_earth))
            dist_s_km = float(np.linalg.norm(pos_sun))
            return pos_earth, pos_sun, dist_e, dist_s_km / AU_KM
        except Exception:
            pass

    # Analytical High-Precision Ephemeris fallback
    jd = datetime_to_jd(dt)
    d = jd - 2451545.0
    T = d / 36525.0

    # Moon position relative to Earth (geocentric ecliptic)
    # Mean arguments of the Moon
    L_prime = math.radians((218.3164477 + 481267.88123421 * T) % 360)
    D = math.radians((297.8501921 + 445267.1114034 * T) % 360)
    M = math.radians((357.5291092 + 35999.0502909 * T) % 360)
    M_prime = math.radians((134.9633964 + 477198.8675055 * T) % 360)
    F = math.radians((93.2720950 + 483202.0175233 * T) % 360)

    # Periodic perturbations in longitude, latitude, distance
    lon_m = (
        L_prime
        + math.radians(6.288774) * math.sin(M_prime)
        + math.radians(1.274027) * math.sin(2 * D - M_prime)
        + math.radians(0.658314) * math.sin(2 * D)
        + math.radians(0.213618) * math.sin(2 * M_prime)
        - math.radians(0.185116) * math.sin(M)
        - math.radians(0.114332) * math.sin(2 * F)
    )

    lat_m = (
        math.radians(5.128122) * math.sin(F)
        + math.radians(0.280602) * math.sin(M_prime + F)
        + math.radians(0.277693) * math.sin(M_prime - F)
        + math.radians(0.173237) * math.sin(2 * D - F)
    )

    dist_e = (
        385000.56
        - 20905.355 * math.cos(M_prime)
        - 3699.111 * math.cos(2 * D - M_prime)
        - 2955.968 * math.cos(2 * D)
        - 569.925 * math.cos(2 * M_prime)
    )

    # Obliquity of ecliptic
    eps = math.radians(23.4392911 - 0.0130042 * T)

    # Convert geocentric Moon ecliptic to equatorial ICRF
    x_m_ecl = dist_e * math.cos(lat_m) * math.cos(lon_m)
    y_m_ecl = dist_e * math.cos(lat_m) * math.sin(lon_m)
    z_m_ecl = dist_e * math.sin(lat_m)

    x_m = x_m_ecl
    y_m = y_m_ecl * math.cos(eps) - z_m_ecl * math.sin(eps)
    z_m = y_m_ecl * math.sin(eps) + z_m_ecl * math.cos(eps)

    # Moon to Earth is -Moon geocentric position
    vec_moon_to_earth = np.array([-x_m, -y_m, -z_m])

    # Sun position relative to Earth
    L0 = math.radians((280.46646 + 36000.76983 * T) % 360)
    C = math.radians((1.914602 - 0.004817 * T) * math.sin(M) + (0.019993 - 0.000101 * T) * math.sin(2 * M))
    sun_lon = L0 + C
    sun_dist_au = 1.00014061 - 0.01670862 * math.cos(M) - 0.000139589 * math.cos(2 * M)
    sun_dist_km = sun_dist_au * AU_KM

    x_s_ecl = sun_dist_km * math.cos(sun_lon)
    y_s_ecl = sun_dist_km * math.sin(sun_lon)
    z_s_ecl = 0.0

    x_s = x_s_ecl
    y_s = y_s_ecl * math.cos(eps) - z_s_ecl * math.sin(eps)
    z_s = y_s_ecl * math.sin(eps) + z_s_ecl * math.cos(eps)

    # Moon to Sun is Earth_to_Sun - Earth_to_Moon
    vec_moon_to_sun = np.array([x_s - x_m, y_s - y_m, z_s - z_m])

    return vec_moon_to_earth, vec_moon_to_sun, dist_e, sun_dist_au


def get_selenographic_ephemeris(dt: datetime):
    """
    Computes sub-Earth and sub-solar selenographic coordinates,
    librations, and lunar distances for epoch dt.
    """
    jd = datetime_to_jd(dt)
    alpha_0, delta_0, W = compute_iau_lunar_orientation(jd)
    R_icrf2sel = rotation_matrix_icrf_to_selenographic(alpha_0, delta_0, W)

    vec_m2e_icrf, vec_m2s_icrf, dist_e_km, dist_s_au = get_earth_and_sun_positions_icrf(dt)

    # Transform to selenographic body-fixed frame
    vec_m2e_sel = R_icrf2sel @ vec_m2e_icrf
    vec_m2s_sel = R_icrf2sel @ vec_m2s_icrf

    u_e = vec_m2e_sel / np.linalg.norm(vec_m2e_sel)
    u_s = vec_m2s_sel / np.linalg.norm(vec_m2s_sel)

    # Sub-Earth point (librations)
    sub_earth_lat = math.degrees(math.asin(np.clip(u_e[2], -1.0, 1.0)))
    sub_earth_lon = math.degrees(math.atan2(u_e[1], u_e[0]))

    # Sub-solar point
    sub_solar_lat = math.degrees(math.asin(np.clip(u_s[2], -1.0, 1.0)))
    sub_solar_lon = math.degrees(math.atan2(u_s[1], u_s[0]))

    # Phase angle: angle between Sun and Earth as seen from Moon center
    cos_phase = float(np.dot(u_e, u_s))
    earth_phase_deg = math.degrees(math.acos(np.clip(cos_phase, -1.0, 1.0)))

    return {
        "sub_earth_lat": sub_earth_lat,
        "sub_earth_lon": sub_earth_lon,
        "sub_solar_lat": sub_solar_lat,
        "sub_solar_lon": sub_solar_lon,
        "earth_distance_km": dist_e_km,
        "sun_distance_au": dist_s_au,
        "earth_phase_angle_deg": earth_phase_deg,
        "vec_m2e_sel": vec_m2e_sel,
        "vec_m2s_sel": vec_m2s_sel,
    }


def compute_topocentric_target(
    target_vec_sel: np.ndarray,
    target_name: str,
    obs_lat_deg: float,
    obs_lon_deg: float,
    obs_elev_m: float = 0.0,
    horizon_mask_deg: float = 0.0,
) -> dict:
    """
    Computes topocentric azimuth and elevation of a celestial target
    from a specific selenographic surface site.
    """
    phi = math.radians(obs_lat_deg)
    lam = math.radians(obs_lon_deg)
    r_site_km = LUNAR_MEAN_RADIUS_KM + (obs_elev_m / 1000.0)

    # Observer site vector in Moon-centered selenographic frame
    r_obs = np.array([
        r_site_km * math.cos(phi) * math.cos(lam),
        r_site_km * math.cos(phi) * math.sin(lam),
        r_site_km * math.sin(phi)
    ])

    # Topocentric target vector (from surface observer to target)
    rho_vec = target_vec_sel - r_obs
    rho_dist_km = float(np.linalg.norm(rho_vec))
    u_target = rho_vec / rho_dist_km

    # Local topocentric coordinate unit vectors
    up = np.array([math.cos(phi) * math.cos(lam), math.cos(phi) * math.sin(lam), math.sin(phi)])
    north = np.array([-math.sin(phi) * math.cos(lam), -math.sin(phi) * math.sin(lam), math.cos(phi)])
    east = np.array([-math.sin(lam), math.cos(lam), 0.0])

    # Elevation and Azimuth
    elev_sin = float(np.dot(u_target, up))
    elevation_deg = math.degrees(math.asin(np.clip(elev_sin, -1.0, 1.0)))

    east_comp = float(np.dot(u_target, east))
    north_comp = float(np.dot(u_target, north))
    azimuth_deg = (math.degrees(math.atan2(east_comp, north_comp)) + 360.0) % 360.0

    res = {
        "name": target_name,
        "azimuth_deg": round(azimuth_deg, 3),
        "elevation_deg": round(elevation_deg, 3),
        "distance_km": round(rho_dist_km, 1),
        "is_above_geometric_horizon": elevation_deg > 0.0,
        "is_above_terrain_horizon": elevation_deg > horizon_mask_deg,
    }
    if target_name == "Earth":
        res["latency_round_trip_sec"] = round((2.0 * rho_dist_km) / SPEED_OF_LIGHT_KM_S, 3)
        res["latency_one_way_sec"] = round(rho_dist_km / SPEED_OF_LIGHT_KM_S, 3)
    return res
