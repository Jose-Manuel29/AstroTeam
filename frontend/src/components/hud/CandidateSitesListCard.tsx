import React, { useState } from "react";
import { CaretDown, CheckCircle, WarningCircle, XCircle, Sun, Broadcast } from "@phosphor-icons/react";
import { HudCard, HudCardHeader, HudCardBody } from "./HudCard";
import { LandingSite } from "../../types";

export type ViabilityTier = "optimal" | "marginal" | "critical";

export interface EvaluatedLandingSite extends LandingSite {
  viabilityTier: ViabilityTier;
  criteriaMetCount: number;
}

export interface CandidateSitesListCardProps {
  title?: string;
  sites: EvaluatedLandingSite[];
  selectedSiteId: string | null;
  onSelectSite: (site: LandingSite) => void;
  className?: string;
}

/**
 * Tarjeta HUD para el Listado y Clasificación de Ubicaciones Candidatas (AstroTeam)
 * Incluye selector dropdown de estatus, tags sin relleno con iconos representativos de estatus
 * y una altura extendida para mayor comodidad de visualización.
 */
export const CandidateSitesListCard: React.FC<CandidateSitesListCardProps> = ({
  title = "Landing Sites",
  sites,
  selectedSiteId,
  onSelectSite,
  className = "w-[clamp(320px,28vw,410px)]",
}) => {
  const [filterTab, setFilterTab] = useState<"all" | ViabilityTier>("all");

  const optimalSites = sites.filter((s) => s.viabilityTier === "optimal");
  const marginalSites = sites.filter((s) => s.viabilityTier === "marginal");
  const criticalSites = sites.filter((s) => s.viabilityTier === "critical");

  const displayedSites = sites.filter((s) => {
    if (filterTab === "all") return true;
    return s.viabilityTier === filterTab;
  });

  // Status badges: icon and colored text
  const renderBadge = (tier: ViabilityTier) => {
    switch (tier) {
      case "optimal":
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-sans font-medium text-emerald-400">
            <CheckCircle size={14} weight="fill" className="text-emerald-400 shrink-0 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
            Meets both
          </span>
        );
      case "marginal":
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-sans font-medium text-amber-400">
            <WarningCircle size={14} weight="fill" className="text-amber-400 shrink-0 shadow-[0_0_6px_rgba(251,191,36,0.6)]" />
            Meets one
          </span>
        );
      case "critical":
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-sans font-medium text-rose-400">
            <XCircle size={14} weight="fill" className="text-rose-400 shrink-0 shadow-[0_0_6px_rgba(251,113,133,0.6)]" />
            Meets none
          </span>
        );
    }
  };

  return (
    <HudCard
      variant="charcoal"
      padding="md"
      ariaLabel={title}
      className={`gap-[clamp(0.4rem,1vh,0.85rem)] ${className}`}
    >
      <HudCardHeader
        title={title}
        subtitle={`${optimalSites.length} meet both · ${marginalSites.length} one · ${criticalSites.length} none`}
        align="left"
        size="md"
      />

      {/* Status dropdown filter */}
      <div className="flex items-center justify-between gap-2 px-1 py-0.5 border-b border-white/10 pb-2">
        <label
          htmlFor="criteria-match-filter-select"
          className="font-heading font-medium text-[11px] uppercase tracking-wider text-palette-cream/80"
        >
          Filter by status:
        </label>
        <div className="relative">
          <select
            id="criteria-match-filter-select"
            value={filterTab}
            onChange={(e) => setFilterTab(e.target.value as "all" | ViabilityTier)}
            className="appearance-none bg-palette-charcoal/80 hover:bg-palette-charcoal text-[#FAFAFA] font-sans text-[11.5px] font-medium pl-3 pr-7 py-1 rounded-lg border border-white/15 focus:outline-none focus:border-palette-cream/40 cursor-pointer backdrop-blur-sm transition-colors"
          >
            <option value="all" className="bg-[#141416] text-[#FAFAFA]">
              All ({sites.length})
            </option>
            <option value="optimal" className="bg-[#141416] text-emerald-400">
              Meets both ({optimalSites.length})
            </option>
            <option value="marginal" className="bg-[#141416] text-amber-400">
              Meets one ({marginalSites.length})
            </option>
            <option value="critical" className="bg-[#141416] text-rose-400">
              Meets none ({criticalSites.length})
            </option>
          </select>
          <CaretDown
            size={12}
            weight="bold"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-palette-cream/80 pointer-events-none"
          />
        </div>
      </div>

      {/* Lista scrolleable de ubicaciones con mayor longitud vertical */}
      <HudCardBody className="gap-2 max-h-[clamp(280px,52vh,540px)] overflow-y-auto overflow-x-hidden pr-1">
        {displayedSites.map((site) => {
          const isSelected = site.id === selectedSiteId;
          return (
            <button
              key={site.id}
              type="button"
              onClick={() => onSelectSite(site)}
              className={`
                w-full text-left p-2.5 rounded-lg border transition-all cursor-pointer flex flex-col gap-1.5
                ${
                  isSelected
                    ? "bg-[#D9CEC5]/20 border-white/40 shadow-[0_0_12px_rgba(255,255,255,0.15)] ring-1 ring-white/30"
                    : "bg-[#0D0D0D]/40 border-white/10 hover:bg-white/10 hover:border-white/20"
                }
              `}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-heading font-bold text-[12.5px] text-[#FFFFFF] tracking-wide truncate">
                  {site.name}
                </span>
                {renderBadge(site.viabilityTier)}
              </div>

              {/* Key metrics in miniature */}
              <div className="grid grid-cols-2 gap-1.5 text-[11px] font-sans text-palette-cream/80 pt-0.5 border-t border-white/5">
                <span className="flex items-center gap-1 truncate" title="Samples with the Sun center visible">
                  <Sun size={12} className="text-amber-400 shrink-0" />
                  {site.illuminationAvgPercent}%
                </span>
                <span className="flex items-center gap-1 truncate" title="Samples with direct line of sight to Earth">
                  <Broadcast size={12} className="text-palette-cream shrink-0" />
                  {site.earthVisibilityPercent}%
                </span>
              </div>
            </button>
          );
        })}
      </HudCardBody>
    </HudCard>
  );
};

export default CandidateSitesListCard;
