export interface LandingSite {
  id: string;
  name: string;
  slug: string;
  coordinates: {
    lat: number; // Grados decimales (ej. -89.5 para Polo Sur)
    lng: number;
  };
  elevationMeters: number;
  illuminationAvgPercent: number;
  earthVisibilityPercent: number;
  mission?: string | null;
}

export interface EphemerisEntry {
  timestamp: string; // ISO 8601 UTC
  sunElevationDeg: number;
  sunAzimuthDeg: number;
  earthElevationDeg: number;
  earthAzimuthDeg: number;
  directLineOfSight: boolean;
}

export interface ViabilityFilterCriteria {
  minIllumination: number; // 0 - 100%
  maxSlope: number; // 0 - 30°
  requireEarthLink: boolean;
  requirePsrIceProximity: boolean;
}

export type UserProfileMode = "enthusiast" | "mission_planner";
