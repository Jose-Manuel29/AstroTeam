"use client";

import React, { useState } from "react";
import { LocationPickerView, ExplorerPhase } from "./views/LocationPickerView";
import { SiteDetailView } from "./views/SiteDetailView";

export type CurrentView = "explorer" | "detail";

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<CurrentView>("explorer");
  const [explorerInitialPhase, setExplorerInitialPhase] = useState<ExplorerPhase>("landing");
  const [selectedSiteSlug, setSelectedSiteSlug] = useState<string>("shackleton-connecting-ridge");

  return (
    <div className="w-full h-screen bg-[#05070B] text-slate-100">
      {currentView === "explorer" && (
        <LocationPickerView
          initialPhase={explorerInitialPhase}
          onSelectSiteDetail={(slug) => {
            setSelectedSiteSlug(slug);
            setCurrentView("detail");
          }}
        />
      )}

      {currentView === "detail" && (
        <SiteDetailView
          siteSlug={selectedSiteSlug}
          onBackToPicker={() => {
            setExplorerInitialPhase("picker");
            setCurrentView("explorer");
          }}
        />
      )}
    </div>
  );
};

export default App;
