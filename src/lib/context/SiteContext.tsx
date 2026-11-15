"use client";

import React, { createContext, useContext, useMemo, useState } from "react";

export interface HorizonPoint {
  azimuth: number;
  elevation_deg: number;
}

export interface PresetSite {
  id: string;
  name: string;
  category: string;
  lat: number;
  lon: number;
  elevation_m: number;
  description: string;
  default_horizon_elevation_deg: number;
  horizon_profile: HorizonPoint[];
  /** Probabilidad de hielo (0–1). Opcional: aún no presente en todos los JSON del backend. */
  ice_probability?: number;
}

export interface PresetSitesFile {
  metadata: {
    generated_at: string;
    count: number;
    libration_snapshot?: Record<string, number>;
    ephemeris_engine?: string;
  };
  sites: PresetSite[];
}

interface SiteContextValue {
  selectedSite: PresetSite | null;
  setSelectedSite: (site: PresetSite | null) => void;
  /** Offset vertical (Y) de las mallas de zona sobre el terreno. */
  zoneOffset: number;
  setZoneOffset: (offset: number) => void;
}

const DEFAULT_CONTEXT: SiteContextValue = {
  selectedSite: null,
  setSelectedSite: () => {},
  zoneOffset: 0.02,
  setZoneOffset: () => {},
};

const SiteContext = createContext<SiteContextValue>(DEFAULT_CONTEXT);

export const SiteProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedSite, setSelectedSite] = useState<PresetSite | null>(null);
  const [zoneOffset, setZoneOffset] = useState<number>(0.02);

  const value = useMemo(
    () => ({ selectedSite, setSelectedSite, zoneOffset, setZoneOffset }),
    [selectedSite, zoneOffset]
  );

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
};

export function useSiteContext(): SiteContextValue {
  return useContext(SiteContext);
}

export default SiteContext;
