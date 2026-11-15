import React from "react";
import { HudCard, HudCardHeader, HudCardBody } from "./HudCard";

export interface CriterionSliderItem {
  id: string;
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  /** Formateador opcional para mostrar el valor inyectado */
  formatValue?: (val: number) => string;
}

export interface CriteriaSlidersCardProps {
  title?: string;
  subtitle?: string;
  headerAction?: React.ReactNode;
  items: CriterionSliderItem[];
  onChange: (id: string, newValue: number) => void;
  className?: string;
}

/**
 * Tarjeta HUD de Sliders Interactivos (Umbrales y Simulación de Criterios)
 * Construida sobre el esqueleto HudCard (variante charcoal).
 * Soporta cualquier cantidad de sliders y se adapta fluidamente al ancho del contenedor.
 */
export const CriteriaSlidersCard: React.FC<CriteriaSlidersCardProps> = ({
  title = "Mission Thresholds",
  subtitle,
  headerAction,
  items,
  onChange,
  className = "w-full",
}) => {
  return (
    <HudCard
      variant="charcoal"
      padding="md"
      ariaLabel={title}
      className={`gap-[clamp(0.25rem,0.85vh,0.75rem)] ${className}`}
    >
      <HudCardHeader
        title={title}
        subtitle={subtitle}
        action={headerAction}
        size="md"
      />

      <HudCardBody className="gap-[clamp(0.2rem,0.75vh,0.65rem)]">
        {items.map((item) => {
          const min = item.min ?? 0;
          const max = item.max ?? 100;
          const step = item.step ?? 1;
          const percent = Math.max(
            0,
            Math.min(100, ((item.value - min) / (max - min)) * 100)
          );

          const displayValue = item.formatValue
            ? item.formatValue(item.value)
            : `${Math.round(item.value)}${item.unit ?? "%"}`;

          return (
            <div key={item.id} className="flex flex-col gap-[0.25vh] w-full">
              {/* Etiqueta + Valor inyectado */}
              <div className="flex items-center justify-between gap-2 w-full">
                <span className="font-sans font-light text-[clamp(0.65rem,1.18vh,0.78125rem)] leading-tight text-[#FAFAFA]/95 truncate">
                  {item.label}
                </span>
                <span className="font-sans font-medium text-[clamp(0.62rem,1.12vh,0.75rem)] leading-tight text-palette-cream tabular-nums shrink-0">
                  {displayValue}
                </span>
              </div>

              {/* Track interactivo fluido al 100% del ancho y alto relativo */}
              <div className="relative flex items-center w-full h-[clamp(11px,1.6vh,18px)] isolate group">
                {/* Riel base */}
                <div
                  aria-hidden="true"
                  className="w-full h-[clamp(2px,0.28vh,3px)] bg-palette-charcoal rounded-full z-0"
                />

                {/* Marca vertical inicial en x=0 */}
                <div
                  aria-hidden="true"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-[clamp(5px,0.75vh,7px)] bg-[#FFFFFF] rounded-full z-10"
                />

                {/* Progreso activo en porcentaje */}
                <div
                  aria-hidden="true"
                  className="absolute left-0 top-1/2 -translate-y-1/2 h-[clamp(2px,0.28vh,3px)] bg-[#FFFFFF] rounded-full z-10 transition-[width] duration-75 ease-out"
                  style={{ width: `${percent}%` }}
                />

                {/* Thumb circular interactivo */}
                <div
                  aria-hidden="true"
                  className="
                    absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-[clamp(7px,1.05vh,10px)] h-[clamp(7px,1.05vh,10px)]
                    rounded-full bg-palette-cream shadow-[0_0_8px_rgba(217,206,197,0.75)]
                    group-hover:scale-125 transition-transform duration-150 z-10 pointer-events-none
                  "
                  style={{ left: `${percent}%` }}
                />

                {/* Input nativo accesible */}
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={step}
                  value={item.value}
                  aria-label={item.label}
                  onChange={(e) => onChange(item.id, Number(e.target.value))}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20 m-0"
                />
              </div>
            </div>
          );
        })}
      </HudCardBody>
    </HudCard>
  );
};

export default CriteriaSlidersCard;
