"use client";

import React, { useState } from "react";
import { LocationPickerView, ExplorerPhase } from "./views/LocationPickerView";
import { SiteDetailView } from "./views/SiteDetailView";

export type CurrentView = "explorer" | "detail";

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<CurrentView>("explorer");
  const [explorerInitialPhase, setExplorerInitialPhase] =
    useState<ExplorerPhase>("landing");
  const [selectedSiteSlug, setSelectedSiteSlug] = useState<string>(
    "shackleton-rim"
  );
  const [detailMoonArrived, setDetailMoonArrived] = useState<boolean>(false);

  return (
    <div className="relative w-full h-screen bg-[#0D0D0D] text-slate-100 overflow-hidden">
      {/* LocationPickerView y su Canvas 3D de la Luna permanecen SIEMPRE montados para que la Luna nunca desaparezca ni parpadee */}
      <LocationPickerView
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
          setSelectedSiteSlug(slug);
          setCurrentView("detail");
        }}
      />

      {currentView === "detail" && (
        <SiteDetailView
          siteSlug={selectedSiteSlug}
          moonArrived={detailMoonArrived}
          onBackToPicker={() => {
            setDetailMoonArrived(false);
            setExplorerInitialPhase("picker");
            setCurrentView("explorer");
          }}
          onSelectSite={(slug) => setSelectedSiteSlug(slug)}
        />
      )}
    </div>
  );
};

export default App;
