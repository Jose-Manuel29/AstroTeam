import React from "react";
import {
  CheckCircle,
  WarningCircle,
  XCircle,
  MapPin,
  Broadcast,
  Sun,
  GridFour,
  Cube,
  CircleDashed,
} from "@phosphor-icons/react";
import { HudCard, HudCardHeader, HudCardBody } from "./HudCard";

export interface MapLegendCardProps {
  /** Modo de visualización: "picker" (globo 3D) o "detail" (mapa 3D local) */
  mode?: "picker" | "detail";
  title?: string;
  showCriteria?: boolean;
  className?: string;
}

/**
 * Tarjeta HUD de Leyenda de Indicadores y Simbología Táctica (AstroTeam)
 * Soporta dos modos especializados:
 * - "picker": Viabilidad de sitios candidatos, pins radiales en el globo y cruz polar 90°S.
 * - "detail": Zonas holográficas de aterrizaje, vectores DTE/solar y malla topográfica DEM.
 */
export const MapLegendCard: React.FC<MapLegendCardProps> = ({
  mode = "picker",
  title,
  showCriteria = true,
  className = "w-[clamp(260px,22vw,320px)]",
}) => {
  const isPicker = mode === "picker";
  const defaultTitle = isPicker ? "Symbols & Indicators" : "Terrain & Vector Symbology";
  const cardTitle = title || defaultTitle;
  const subtitle = isPicker ? "Tactical globe reference" : "Local 3D diorama reference";

  return (
    <HudCard
      variant="ochre"
      padding="sm"
      ariaLabel={cardTitle}
      className={`gap-[clamp(0.2rem,0.6vh,0.5rem)] ${className}`}
    >
      <HudCardHeader
        title={cardTitle}
        subtitle={subtitle}
        size="sm"
      />

      <HudCardBody className="gap-[clamp(0.25rem,0.65vh,0.55rem)] text-[clamp(0.66rem,1.05vh,0.75rem)] font-sans">
        {isPicker ? (
          <>
            {/* Sección: Coincidencia con criterios (iluminación solar + enlace con la Tierra) */}
            {showCriteria && (
            <div className="flex flex-col gap-1.5 pt-0.5 border-b border-white/10 pb-2">
              <span className="font-heading font-bold uppercase tracking-wider text-[clamp(0.56rem,0.9vh,0.65rem)] text-palette-cream/80">
                Criteria Match
              </span>
              <div className="grid grid-cols-1 gap-1.5">
                <div className="flex items-center gap-2">
                  <CheckCircle size={14} weight="fill" className="text-emerald-400 shrink-0 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
                  <span className="font-medium text-[#FAFAFA]">Meets both</span>
                  <span className="text-palette-cream/70 text-[0.88em] ml-auto">2 thresholds</span>
                </div>
                <div className="flex items-center gap-2">
                  <WarningCircle size={14} weight="fill" className="text-amber-400 shrink-0 shadow-[0_0_6px_rgba(251,191,36,0.6)]" />
                  <span className="font-medium text-[#FAFAFA]">Meets one</span>
                  <span className="text-palette-cream/70 text-[0.88em] ml-auto">1 threshold</span>
                </div>
                <div className="flex items-center gap-2">
                  <XCircle size={14} weight="fill" className="text-rose-400 shrink-0 shadow-[0_0_6px_rgba(251,113,133,0.6)]" />
                  <span className="font-medium text-[#FAFAFA]">Meets none</span>
                  <span className="text-palette-cream/70 text-[0.88em] ml-auto">0 thresholds</span>
                </div>
              </div>
            </div>
            )}

            {/* Sección: Vectores espaciales y marcadores en el globo */}
            <div className="flex flex-col gap-1.5 pt-0.5">
              <span className="font-heading font-bold uppercase tracking-wider text-[clamp(0.56rem,0.9vh,0.65rem)] text-palette-cream/80">
                Globe Vectors & Markers
              </span>
              <div className="grid grid-cols-1 gap-1.5">
                <div className="flex items-center gap-2 text-palette-cream">
                  <div className="w-4 h-4 flex items-center justify-center rounded bg-white/10 border border-white/15 text-palette-cream shrink-0">
                    <MapPin size={12} weight="fill" />
                  </div>
                  <span className="font-medium text-[#FAFAFA]">Landing Site Pin</span>
                  <span className="text-palette-cream/70 text-[0.88em] ml-auto">Interactive radial pin</span>
                </div>

                <div className="flex items-center gap-2 text-palette-cream">
                  <div className="w-4 h-4 flex items-center justify-center rounded bg-white/10 border border-white/15 text-palette-cream shrink-0">
                    <CircleDashed size={12} weight="bold" />
                  </div>
                  <span className="font-medium text-[#FAFAFA]">Coverage Area</span>
                  <span className="text-palette-cream/70 text-[0.88em] ml-auto">Surface perimeter</span>
                </div>

                {/* Meridianos y Cruz Polar (90°S) */}
                <div className="flex items-center gap-2 text-palette-cream">
                  <div className="w-4 h-4 flex items-center justify-center rounded bg-white/10 border border-white/15 shrink-0 overflow-hidden">
                    <svg width="14" height="14" viewBox="0 0 14 14" className="text-palette-cream" aria-hidden="true">
                      {/* Meridiano vertical 0°-180° */}
                      <line
                        x1="7"
                        y1="1.5"
                        x2="7"
                        y2="12.5"
                        stroke="#D9CEC5"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                      {/* Meridiano horizontal 90°-270° */}
                      <line
                        x1="1.5"
                        y1="7"
                        x2="12.5"
                        y2="7"
                        stroke="#D9CEC5"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                      {/* Nodo central en el Polo Sur */}
                      <circle cx="7" cy="7" r="1.5" fill="#D9CEC5" />
                    </svg>
                  </div>
                  <span className="font-medium text-[#FAFAFA]">Polar Cross / Meridians</span>
                  <span className="text-palette-cream/70 text-[0.88em] ml-auto">90°S intersection</span>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Sección: Elementos tácticos en el diorama 3D local */}
            <div className="flex flex-col gap-1.5 pt-0.5 border-b border-white/10 pb-2">
              <span className="font-heading font-bold uppercase tracking-wider text-[clamp(0.56rem,0.9vh,0.65rem)] text-palette-cream/80">
                Tactical Surface Overlays
              </span>
              <div className="grid grid-cols-1 gap-1.5">
                {/* Zona de aterrizaje holográfica (#FF9F1C) */}
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 flex items-center justify-center rounded bg-amber-500/10 border border-amber-400/30 shrink-0">
                    <span className="w-2 h-2 rounded-full border border-[#FF9F1C] bg-[#FF9F1C]/40 shadow-[0_0_6px_rgba(255,159,28,0.7)]" />
                  </div>
                  <span className="font-medium text-[#FAFAFA]">Landing Zone</span>
                  <span className="text-palette-cream/70 text-[0.88em] ml-auto">Holographic perimeter</span>
                </div>

                {/* Vector Direct-to-Earth (#38BDF8) */}
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 flex items-center justify-center rounded bg-sky-500/10 border border-sky-400/30 text-sky-400 shrink-0 shadow-[0_0_6px_rgba(56,189,248,0.4)]">
                    <Broadcast size={12} weight="bold" />
                  </div>
                  <span className="font-medium text-[#FAFAFA]">Direct-to-Earth (DTE)</span>
                  <span className="text-palette-cream/70 text-[0.88em] ml-auto">Comms line of sight</span>
                </div>

                {/* Vector Solar (#FBBF24) */}
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 flex items-center justify-center rounded bg-amber-400/10 border border-amber-400/30 text-amber-400 shrink-0 shadow-[0_0_6px_rgba(251,191,36,0.4)]">
                    <Sun size={12} weight="bold" />
                  </div>
                  <span className="font-medium text-[#FAFAFA]">Solar Vector</span>
                  <span className="text-palette-cream/70 text-[0.88em] ml-auto">Grazing sun azimuth</span>
                </div>
              </div>
            </div>

            {/* Sección: Topografía y Referencia */}
            <div className="flex flex-col gap-1.5 pt-0.5">
              <span className="font-heading font-bold uppercase tracking-wider text-[clamp(0.56rem,0.9vh,0.65rem)] text-palette-cream/80">
                Terrain & Diorama Grid
              </span>
              <div className="grid grid-cols-1 gap-1.5">
                <div className="flex items-center gap-2 text-palette-cream">
                  <div className="w-4 h-4 flex items-center justify-center rounded bg-white/10 border border-white/15 text-palette-ochre shrink-0">
                    <GridFour size={12} weight="bold" />
                  </div>
                  <span className="font-medium text-[#FAFAFA]">DEM Elevation Grid</span>
                  <span className="text-palette-cream/70 text-[0.88em] ml-auto">Altimetric contours</span>
                </div>

                <div className="flex items-center gap-2 text-palette-cream">
                  <div className="w-4 h-4 flex items-center justify-center rounded bg-white/10 border border-white/15 text-palette-cream shrink-0">
                    <MapPin size={12} weight="fill" />
                  </div>
                  <span className="font-medium text-[#FAFAFA]">Tactical Beacon</span>
                  <span className="text-palette-cream/70 text-[0.88em] ml-auto">Site focus marker</span>
                </div>

                <div className="flex items-center gap-2 text-palette-cream">
                  <div className="w-4 h-4 flex items-center justify-center rounded bg-white/10 border border-white/15 text-palette-slate shrink-0">
                    <Cube size={12} weight="bold" />
                  </div>
                  <span className="font-medium text-[#FAFAFA]">Isolated Diorama</span>
                  <span className="text-palette-cream/70 text-[0.88em] ml-auto">15u cutout pedestal</span>
                </div>
              </div>
            </div>
          </>
        )}
      </HudCardBody>
    </HudCard>
  );
};

export default MapLegendCard;