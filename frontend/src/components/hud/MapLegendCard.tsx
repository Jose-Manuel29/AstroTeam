import React from "react";
import { CheckCircle, WarningCircle, XCircle, MapPin } from "@phosphor-icons/react";
import { HudCard, HudCardHeader, HudCardBody } from "./HudCard";

export interface MapLegendCardProps {
  title?: string;
  showCriteria?: boolean;
  className?: string;
}

/**
 * Tarjeta HUD de Leyenda de Indicadores y Simbología Polar (AstroTeam)
 * Muestra los estados cromáticos con iconos representativos, el marcador de ubicación y el eje polar punteado.
 */
export const MapLegendCard: React.FC<MapLegendCardProps> = ({
  title = "Simbología e Indicadores",
  showCriteria = true,
  className = "w-[clamp(260px,22vw,320px)]",
}) => {
  return (
    <HudCard
      variant="ochre"
      padding="sm"
      ariaLabel={title}
      className={`gap-[clamp(0.2rem,0.6vh,0.5rem)] ${className}`}
    >
      <HudCardHeader
        title={title}
        subtitle="Referencia táctica"
        size="sm"
      />

      <HudCardBody className="gap-[clamp(0.25rem,0.65vh,0.55rem)] text-[clamp(0.68rem,1.1vh,0.75rem)] font-sans">
        {showCriteria && (
          <div className="flex flex-col gap-1.5 pt-0.5 border-b border-white/10 pb-2">
            <span className="font-heading font-bold uppercase tracking-wider text-[clamp(0.58rem,0.95vh,0.66rem)] text-palette-cream/80">
              Coincidencia con criterios
            </span>
            <div className="grid grid-cols-1 gap-1.5">
              <div className="flex items-center gap-2">
                <CheckCircle size={14} weight="fill" className="text-emerald-400 shrink-0 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
                <span className="font-medium text-[#FAFAFA]">Cumple ambos</span>
                <span className="text-palette-cream/70 text-[0.9em] ml-auto">2 límites</span>
              </div>
              <div className="flex items-center gap-2">
                <WarningCircle size={14} weight="fill" className="text-amber-400 shrink-0 shadow-[0_0_6px_rgba(251,191,36,0.6)]" />
                <span className="font-medium text-[#FAFAFA]">Cumple uno</span>
                <span className="text-palette-cream/70 text-[0.9em] ml-auto">1 límite</span>
              </div>
              <div className="flex items-center gap-2">
                <XCircle size={14} weight="fill" className="text-rose-400 shrink-0 shadow-[0_0_6px_rgba(251,113,133,0.6)]" />
                <span className="font-medium text-[#FAFAFA]">No cumple</span>
                <span className="text-palette-cream/70 text-[0.9em] ml-auto">0 límites</span>
              </div>
            </div>
          </div>
        )}

        {/* Sección: Indicadores espaciales en el globo */}
        <div className="flex flex-col gap-1.5 pt-0.5">
          <span className="font-heading font-bold uppercase tracking-wider text-[clamp(0.58rem,0.95vh,0.66rem)] text-palette-cream/80">
            Vectores e Indicadores
          </span>
          <div className="grid grid-cols-1 gap-1.5">
            <div className="flex items-center gap-2 text-palette-cream">
              <div className="w-4 h-4 flex items-center justify-center rounded bg-white/10 border border-white/15 text-palette-cream shrink-0">
                <MapPin size={12} weight="fill" />
              </div>
              <span className="font-medium text-[#FAFAFA]">Marcador de Sitio</span>
              <span className="text-palette-cream/70 text-[0.9em] ml-auto">Pin radial interactivo</span>
            </div>

            {/* Eje Polar Lunar con representación gráfica de línea punteada */}
            <div className="flex items-center gap-2 text-palette-cream">
              <div className="w-4 h-4 flex items-center justify-center rounded bg-white/10 border border-white/15 shrink-0 overflow-hidden">
                <svg width="14" height="14" viewBox="0 0 14 14" className="text-palette-cream" aria-hidden="true">
                  <line
                    x1="2"
                    y1="12"
                    x2="12"
                    y2="2"
                    stroke="#FAFAFA"
                    strokeWidth="1.6"
                    strokeDasharray="2 2"
                  />
                  <circle cx="7" cy="7" r="1.5" fill="#D9CEC5" />
                </svg>
              </div>
              <span className="font-medium text-[#FAFAFA]">Eje Polar Lunar</span>
              <span className="text-palette-cream/70 text-[0.9em] ml-auto">Línea punteada 90°S</span>
            </div>
          </div>
        </div>
      </HudCardBody>
    </HudCard>
  );
};

export default MapLegendCard;
