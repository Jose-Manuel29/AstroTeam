"use client";

import React, { createContext, useContext, useMemo, useState } from "react";

export interface HorizonPoint {
  azimuth: number;
  elevation_deg: number;
}

export interface PresetSite {
  id: string;
  name: string;
  lat: number;
  lon: number;
  category?: string;
  elevation_m?: number;
  description?: string;
  default_horizon_elevation_deg?: number;
  horizon_profile?: HorizonPoint[];
  viabilityTier?: "optimal" | "marginal" | "critical";
  isViable?: boolean;
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

export const SiteProvider: React.FC<{
  children: React.ReactNode;
  initialSite?: PresetSite | null;
  initialZoneOffset?: number;
}> = ({ children, initialSite = null, initialZoneOffset = 0.02 }) => {
  const [selectedSite, setSelectedSite] = useState<PresetSite | null>(initialSite);
  const [zoneOffset, setZoneOffset] = useState<number>(initialZoneOffset);

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
