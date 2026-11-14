"""
Pydantic schemas for data contracts between Backend and Frontend.
Includes lightweight fallback if pydantic is not yet installed in the environment.
"""

from typing import List, Optional, Dict, Any
from datetime import datetime

try:
    from pydantic import BaseModel, Field
except ImportError:
    # Graceful fallback for standalone execution before pip install
    class BaseModel:
        def __init__(self, **kwargs):
            for k, v in kwargs.items():
                setattr(self, k, v)

        def model_dump(self) -> Dict[str, Any]:
            res = {}
            for k, v in self.__dict__.items():
                if hasattr(v, "model_dump"):
                    res[k] = v.model_dump()
                elif isinstance(v, list):
                    res[k] = [item.model_dump() if hasattr(item, "model_dump") else item for item in v]
                else:
                    res[k] = v
            return res

        def dict(self) -> Dict[str, Any]:
            return self.model_dump()

    def Field(default=None, **kwargs):
        return default


class SiteCoordinates(BaseModel):
    lat: float = Field(..., ge=-90.0, le=90.0, description="Selenographic latitude in degrees (-90 to +90)")
    lon: float = Field(..., description="Selenographic longitude in degrees (-180 to 180 or 0 to 360)")
    elevation_m: float = Field(0.0, description="Elevation relative to mean lunar radius (1737.4 km) in meters")


class HorizonPoint(BaseModel):
    azimuth: float = Field(..., ge=0.0, lt=360.0, description="Azimuth angle in degrees (0° = North, 90° = East)")
    elevation_deg: float = Field(..., description="Horizon obstacle elevation angle in degrees")


class PresetSite(BaseModel):
    id: str = Field(..., description="Unique slug identifier (e.g., shackleton-rim)")
    name: str = Field(..., description="Human-readable site name")
    category: str = Field(..., description="Category (e.g., Artemis Candidate, Apollo Historic)")
    lat: float = Field(...)
    lon: float = Field(...)
    elevation_m: float = Field(...)
    description: str = Field(...)
    default_horizon_elevation_deg: float = Field(0.5)
    horizon_profile: List[HorizonPoint] = Field(default_factory=list)


class CelestialTarget(BaseModel):
    name: str = Field(..., description="Target name ('Sun' or 'Earth')")
    azimuth_deg: float = Field(..., description="Azimuth in degrees (0=N, 90=E, 180=S, 270=W)")
    elevation_deg: float = Field(..., description="Topocentric elevation angle above local mathematical horizontal")
    distance_km: float = Field(..., description="Distance from the lunar surface site in kilometers")
    is_above_geometric_horizon: bool = Field(..., description="True if elevation > 0°")
    is_above_terrain_horizon: bool = Field(..., description="True if elevation > local terrain horizon mask")
    latency_round_trip_sec: Optional[float] = Field(None, description="Round-trip radio signal latency to Earth in seconds")
    latency_one_way_sec: Optional[float] = Field(None, description="One-way radio signal latency in seconds")


class LibrationData(BaseModel):
    sub_earth_lat: float = Field(..., description="Selenographic latitude of sub-Earth point (optical + physical libration b)")
    sub_earth_lon: float = Field(..., description="Selenographic longitude of sub-Earth point (optical + physical libration l)")
    sub_solar_lat: float = Field(..., description="Selenographic latitude of sub-solar point")
    sub_solar_lon: float = Field(..., description="Selenographic longitude of sub-solar point")
    earth_distance_km: float = Field(..., description="Distance between Earth center and Moon center")
    sun_distance_au: float = Field(..., description="Distance between Sun center and Moon center in AU")
    earth_phase_angle_deg: float = Field(..., description="Phase angle of Earth as seen from the Moon")


class VisibilityCountdown(BaseModel):
    is_sun_visible: bool = Field(..., description="Whether the Sun is currently visible above the local terrain")
    is_earth_visible: bool = Field(..., description="Whether Earth has direct Line-of-Sight (LOS) for communications")
    next_sunrise_utc: Optional[str] = Field(None, description="ISO timestamp of estimated next sunrise")
    next_sunset_utc: Optional[str] = Field(None, description="ISO timestamp of estimated next sunset")
    seconds_to_sunrise: Optional[float] = Field(None, description="Seconds until next sunrise")
    seconds_to_sunset: Optional[float] = Field(None, description="Seconds until next sunset")
    next_earth_rise_utc: Optional[str] = Field(None, description="ISO timestamp of next Earth-rise (for polar/limb sites)")
    next_earth_set_utc: Optional[str] = Field(None, description="ISO timestamp of next Earth-set (for polar/limb sites)")
    illumination_status: str = Field(..., description="Descriptive status: 'Illuminated', 'Shadow / Night', 'Grazing'")


class SiteStatusResponse(BaseModel):
    site_id: Optional[str] = None
    name: Optional[str] = None
    timestamp_utc: str = Field(...)
    coordinates: SiteCoordinates = Field(...)
    sun: CelestialTarget = Field(...)
    earth: CelestialTarget = Field(...)
    libration: LibrationData = Field(...)
    visibility: VisibilityCountdown = Field(...)
    horizon_profile: List[HorizonPoint] = Field(default_factory=list)


class CustomSiteRequest(BaseModel):
    lat: float = Field(..., ge=-90.0, le=90.0, description="Selenographic latitude (-90 to +90)")
    lon: float = Field(..., ge=-180.0, le=360.0, description="Selenographic longitude")
    elevation_m: Optional[float] = Field(0.0, description="Elevation in meters")
    timestamp_utc: Optional[str] = Field(None, description="Target datetime in ISO format (defaults to now)")
    default_horizon_elevation_deg: Optional[float] = Field(0.0, description="Uniform terrain obstacle height in degrees")


class TimeSeriesPoint(BaseModel):
    timestamp_utc: str = Field(...)
    sun_elevation_deg: float = Field(...)
    sun_azimuth_deg: float = Field(...)
    earth_elevation_deg: float = Field(...)
    earth_azimuth_deg: float = Field(...)
    is_sun_visible: bool = Field(...)
    is_earth_visible: bool = Field(...)
    earth_distance_km: float = Field(384400.0, description="Real distance to Earth center in kilometers")
    earth_latency_rtt_sec: float = Field(2.56, description="Round-trip radio latency in seconds")
    earth_phase_angle_deg: Optional[float] = Field(None, description="Earth phase angle in degrees")


class SiteTimelineResponse(BaseModel):
    site_id: str = Field(...)
    name: str = Field(...)
    points: List[TimeSeriesPoint] = Field(default_factory=list)
