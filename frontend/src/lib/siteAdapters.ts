import type { LandingSite } from "../types";
import type { PresetSite } from "./context/SiteContext";

export function toPresetSite(site: LandingSite & { viabilityTier?: "optimal" | "marginal" | "critical"; isViable?: boolean }): PresetSite {
  return {
    id: site.id,
    name: site.name,
    lat: site.coordinates.lat,
    lon: site.coordinates.lng,
    elevation_m: site.elevationMeters,
    category: site.mission ?? undefined,
    viabilityTier: site.viabilityTier,
    isViable: site.isViable,
  };
}
