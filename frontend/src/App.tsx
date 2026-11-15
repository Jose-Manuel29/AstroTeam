"use client";

import React, { useEffect, useState } from "react";
import { LocationPickerView, ExplorerPhase } from "./views/LocationPickerView";
import { SiteDetailView } from "./views/SiteDetailView";
import { fetchSites } from "./lib/api";
import type { LandingSite } from "./types";
import { LaserPreloader } from "./components/ui/LaserPreloader";

export type CurrentView = "explorer" | "detail";

export const INITIAL_PRESET_SITES: LandingSite[] = [
  {
    id: "shackleton-rim",
    name: "Shackleton Crater Rim",
    slug: "shackleton-rim",
    coordinates: { lat: -89.9, lng: 0.0 },
    elevationMeters: 4200,
    illuminationAvgPercent: 86,
    earthVisibilityPercent: 52,
    mission: "Artemis III Candidate",
  },
  {
    id: "malapert-massif",
    name: "Malapert Mountain (Massif)",
    slug: "malapert-massif",
    coordinates: { lat: -85.9, lng: 2.9 },
    elevationMeters: 5100,
    illuminationAvgPercent: 89,
    earthVisibilityPercent: 91,
    mission: "Artemis III Candidate",
  },
  {
    id: "connecting-ridge",
    name: "Connecting Ridge",
    slug: "connecting-ridge",
    coordinates: { lat: -89.4, lng: 222.0 },
    elevationMeters: 3800,
    illuminationAvgPercent: 82,
    earthVisibilityPercent: 48,
    mission: "Artemis III Candidate",
  },
  {
    id: "faustini-rim",
    name: "Faustini Crater Rim",
    slug: "faustini-rim",
    coordinates: { lat: -87.1, lng: 84.3 },
    elevationMeters: 3100,
    illuminationAvgPercent: 78,
    earthVisibilityPercent: 41,
    mission: "Artemis III Candidate",
  },
  {
    id: "apollo-11",
    name: "Apollo 11 (Statio Tranquillitatis)",
    slug: "apollo-11",
    coordinates: { lat: 0.674, lng: 23.473 },
    elevationMeters: -1300,
    illuminationAvgPercent: 50,
    earthVisibilityPercent: 100,
    mission: "Historic Reference (1969)",
  },
  {
    id: "oceanus-procellarum",
    name: "Oceanus Procellarum",
    slug: "oceanus-procellarum",
    coordinates: { lat: 28.4, lng: -56.7 },
    elevationMeters: -2100,
    illuminationAvgPercent: 50,
    earthVisibilityPercent: 100,
    mission: "Chang'e 5 / Ocean of Storms",
  },
];

export const App: React.FC = () => {
  const [sites, setSites] = useState<LandingSite[]>(INITIAL_PRESET_SITES);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>("shackleton-rim");
  const [, setLoadingSites] = useState(true);
  const [sitesError, setSitesError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [currentView, setCurrentView] = useState<CurrentView>("explorer");
  const [explorerInitialPhase, setExplorerInitialPhase] =
    useState<ExplorerPhase>("landing");
  const [detailMoonArrived, setDetailMoonArrived] = useState(false);
  // Vista general del mapa 3D (botón "Explorar terreno"): sin sitio aislado inicialmente
  const [detailOverview, setDetailOverview] = useState(false);
  const [isPreloadComplete, setIsPreloadComplete] = useState(false);

  useEffect(() => {
    let active = true;
    setLoadingSites(true);
    setSitesError(null);

    fetchSites()
      .then((loadedSites) => {
        if (!active) return;
        if (loadedSites && loadedSites.length > 0) {
          setSites(loadedSites);
          setSelectedSiteId((current) =>
            loadedSites.some((site) => site.id === current)
              ? current
              : loadedSites[0]?.id ?? null
          );
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setSitesError(error instanceof Error ? error.message : String(error));
        }
      })
      .finally(() => {
        if (active) setLoadingSites(false);
      });

    return () => {
      active = false;
    };
  }, [reloadKey]);

  if (sites.length === 0 || !selectedSiteId) {
    return (
      <main className="flex h-screen w-screen items-center justify-center bg-[#0D0D0D] px-6 text-slate-100">
        <section className="max-w-lg rounded-2xl border border-white/15 bg-slate-950/80 p-6 text-center">
          <h1 className="mb-3 text-lg font-semibold">
            Failed to load sites
          </h1>
          <p role="alert" className="mb-5 text-sm text-[#D9CEC5]">
            {sitesError ?? "The API returned an empty catalog."}
          </p>
          <button
            type="button"
            onClick={() => setReloadKey((key) => key + 1)}
            className="rounded-lg border border-white/25 px-4 py-2 text-sm hover:bg-white/10"
          >
            Retry
          </button>
        </section>
      </main>
    );
  }

  return (
    <div className="relative w-full h-screen bg-[#0D0D0D] text-slate-100 overflow-hidden">
      {!isPreloadComplete && (
        <LaserPreloader onComplete={() => setIsPreloadComplete(true)} />
      )}

      <LocationPickerView
        sites={sites}
        selectedSiteId={selectedSiteId}
        initialPhase={explorerInitialPhase}
        isDetailActive={currentView === "detail"}
        onDetailMoonArrived={() => setDetailMoonArrived(true)}
        onBackToPicker={() => {
          setDetailMoonArrived(false);
          setExplorerInitialPhase("picker");
          setCurrentView("explorer");
        }}
        onSelectSiteDetail={(siteId) => {
          setDetailMoonArrived(false);
          // Un id vacío indica la vista general del mapa (conserva el sitio seleccionado como referencia)
          setDetailOverview(!siteId);
          if (siteId) setSelectedSiteId(siteId);
          setCurrentView("detail");
        }}
      />

      {currentView === "detail" && (
        <SiteDetailView
          siteId={selectedSiteId}
          sites={sites}
          overview={detailOverview}
          moonArrived={detailMoonArrived}
          onBackToPicker={() => {
            setDetailMoonArrived(false);
            setExplorerInitialPhase("picker");
            setCurrentView("explorer");
          }}
          onSelectSite={(siteId) => {
            setDetailOverview(false);
            setSelectedSiteId(siteId);
          }}
        />
      )}
    </div>
  );
};

export default App;
