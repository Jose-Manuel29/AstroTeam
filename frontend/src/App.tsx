"use client";

import React, { useEffect, useState } from "react";
import { LocationPickerView, ExplorerPhase } from "./views/LocationPickerView";
import { SiteDetailView } from "./views/SiteDetailView";
import { fetchSites } from "./lib/api";
import type { LandingSite } from "./types";

export type CurrentView = "explorer" | "detail";

export const App: React.FC = () => {
  const [sites, setSites] = useState<LandingSite[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [loadingSites, setLoadingSites] = useState(true);
  const [sitesError, setSitesError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [currentView, setCurrentView] = useState<CurrentView>("explorer");
  const [explorerInitialPhase, setExplorerInitialPhase] =
    useState<ExplorerPhase>("landing");
  const [detailMoonArrived, setDetailMoonArrived] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    setLoadingSites(true);
    setSitesError(null);

    fetchSites()
      .then((loadedSites) => {
        if (!active) return;
        setSites(loadedSites);
        setSelectedSiteId((current) =>
          loadedSites.some((site) => site.id === current)
            ? current
            : loadedSites[0]?.id ?? null
        );
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

  if (loadingSites) {
    return (
      <main className="flex h-screen w-screen items-center justify-center bg-[#0D0D0D] text-slate-100">
        <p className="font-mono text-sm text-[#D9CEC5]">Conectando con el catálogo lunar…</p>
      </main>
    );
  }

  if (sitesError || sites.length === 0 || !selectedSiteId) {
    return (
      <main className="flex h-screen w-screen items-center justify-center bg-[#0D0D0D] px-6 text-slate-100">
        <section className="max-w-lg rounded-2xl border border-white/15 bg-slate-950/80 p-6 text-center">
          <h1 className="mb-3 text-lg font-semibold">No se pudieron cargar los sitios</h1>
          <p role="alert" className="mb-5 text-sm text-[#D9CEC5]">
            {sitesError ?? "La API respondió con un catálogo vacío."}
          </p>
          <button
            type="button"
            onClick={() => setReloadKey((key) => key + 1)}
            className="rounded-lg border border-white/25 px-4 py-2 text-sm hover:bg-white/10"
          >
            Reintentar
          </button>
        </section>
      </main>
    );
  }

  return (
    <div className="relative w-full h-screen bg-[#0D0D0D] text-slate-100 overflow-hidden">
      {/* LocationPickerView y su Canvas 3D de la Luna permanecen SIEMPRE montados para que la Luna nunca desaparezca ni parpadee */}
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
        onSelectSiteDetail={(slug) => {
          setDetailMoonArrived(false);
          setSelectedSiteId(slug);
          setCurrentView("detail");
        }}
      />

      {currentView === "detail" && (
        <SiteDetailView
          siteId={selectedSiteId}
          sites={sites}
          moonArrived={detailMoonArrived}
          onBackToPicker={() => {
            setDetailMoonArrived(false);
            setExplorerInitialPhase("picker");
            setCurrentView("explorer");
          }}
          onSelectSite={setSelectedSiteId}
        />
      )}
    </div>
  );
};

export default App;
