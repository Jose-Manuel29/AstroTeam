"use client";

import React from "react";
import presetSitesData from "../../../public/data/preset_sites.json";
import { useSiteContext, type PresetSite, type PresetSitesFile } from "../../lib/context/SiteContext";

const sites: PresetSite[] = (presetSitesData as PresetSitesFile).sites;

export const SiteSelector: React.FC = () => {
  const { selectedSite, setSelectedSite } = useSiteContext();

  return (
    <aside className="pointer-events-auto flex w-80 max-h-[80vh] flex-col gap-3 overflow-y-auto rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-slate-100 shadow-2xl backdrop-blur-md">
      <header className="mb-1">
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">
          Sitios de alunizaje
        </h2>
        <p className="text-xs text-slate-400">{sites.length} candidatos precalculados</p>
      </header>

      {sites.map((site) => {
        const isActive = selectedSite?.id === site.id;
        return (
          <button
            key={site.id}
            type="button"
            onClick={() => setSelectedSite(site)}
            aria-pressed={isActive}
            className={`group rounded-xl border p-3 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
              isActive
                ? "border-cyan-400/70 bg-cyan-500/15 shadow-[0_0_20px_rgba(34,211,238,0.25)]"
                : "border-white/10 bg-white/5 hover:border-cyan-400/40 hover:bg-white/10"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-medium text-slate-50">{site.name}</h3>
              {typeof site.ice_probability === "number" && (
                <span className="shrink-0 rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] font-semibold text-sky-300">
                  Hielo {(site.ice_probability * 100).toFixed(0)}%
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[11px] uppercase tracking-wider text-slate-400">{site.category}</p>
            <div className="mt-2 flex gap-3 font-mono text-[11px] text-slate-300">
              <span>LAT {site.lat.toFixed(2)}°</span>
              <span>LON {site.lon.toFixed(2)}°</span>
              <span>{(site.elevation_m / 1000).toFixed(1)} km</span>
            </div>
          </button>
        );
      })}
    </aside>
  );
};

export default SiteSelector;
