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
}

const SiteContext = createContext<SiteContextValue | undefined>(undefined);

export const SiteProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedSite, setSelectedSite] = useState<PresetSite | null>(null);

  const value = useMemo(() => ({ selectedSite, setSelectedSite }), [selectedSite]);

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
};

export function useSiteContext(): SiteContextValue {
  const ctx = useContext(SiteContext);
  if (!ctx) {
    throw new Error("useSiteContext debe usarse dentro de <SiteProvider>.");
  }
  return ctx;
}

export default SiteContext;
