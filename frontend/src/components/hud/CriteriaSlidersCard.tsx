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
  readOnly?: boolean;
}

export interface CriteriaSlidersCardProps {
  title?: string;
  subtitle?: string;
  headerAction?: React.ReactNode;
  items: CriterionSliderItem[];
  onChange?: (id: string, newValue: number) => void;
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
  className = "w-[clamp(260px,23.5vw,336px)]",
}) => {
  return (
    <HudCard
      variant="charcoal"
      padding="md"
      ariaLabel={title}
      className={`gap-[clamp(0.4rem,1.1vh,0.875rem)] ${className}`}
    >
      <HudCardHeader
        title={title}
        subtitle={subtitle}
        action={headerAction}
        size="md"
      />

      <HudCardBody className="gap-[clamp(0.3rem,0.9vh,0.75rem)]">
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
            <div key={item.id} className="flex flex-col gap-[0.3vh] w-full">
              {/* Etiqueta + Valor inyectado */}
              <div className="flex items-center justify-between gap-2 w-full">
                <span className="font-sans font-light text-[clamp(0.7rem,1.3vh,0.78125rem)] leading-[1.25] text-[#FAFAFA]/95 truncate">
                  {item.label}
                </span>
                <span className="font-sans font-medium text-[clamp(0.68rem,1.25vh,0.75rem)] leading-[1.25] text-[#D9CEC5] tabular-nums shrink-0">
                  {displayValue}
                </span>
              </div>

              {/* Track interactivo fluido al 100% del ancho y alto relativo */}
              <div className={`relative flex items-center w-full h-[clamp(13px,2vh,20px)] isolate ${item.readOnly ? "" : "group"}`}>
                {/* Riel base */}
                <div
                  aria-hidden="true"
                  className="w-full h-[clamp(2px,0.32vh,3px)] bg-[#27262B] rounded-full z-0"
                />

                {/* Marca vertical inicial en x=0 */}
                <div
                  aria-hidden="true"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-[clamp(6px,0.85vh,8px)] bg-[#FFFFFF] rounded-full z-10"
                />

                {/* Progreso activo en porcentaje */}
                <div
                  aria-hidden="true"
                  className={`absolute left-0 top-1/2 -translate-y-1/2 h-[clamp(2px,0.32vh,3px)] bg-[#FFFFFF] rounded-full z-10 ${item.readOnly ? "" : "transition-[width] duration-75 ease-out"}`}
                  style={{ width: `${percent}%` }}
                />

                {/* Thumb circular interactivo */}
                <div
                  aria-hidden="true"
                  className={`
                    absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-[clamp(8px,1.15vh,11px)] h-[clamp(8px,1.15vh,11px)]
                    rounded-full bg-[#FFFFFF] shadow-[0_0_8px_rgba(255,255,255,0.65)]
                    ${item.readOnly ? "" : "group-hover:scale-125 transition-transform duration-150"} z-10 pointer-events-none
                  `}
                  style={{ left: `${percent}%` }}
                />

                {/* Input nativo accesible */}
                {!item.readOnly && (
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={item.value}
                    aria-label={item.label}
                    onChange={(e) => onChange?.(item.id, Number(e.target.value))}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20 m-0"
                  />
                )}
              </div>
            </div>
          );
        })}
      </HudCardBody>
    </HudCard>
  );
};

export default CriteriaSlidersCard;
