import React from "react";
import { HudCard, HudCardHeader, HudCardFooter } from "./HudCard";

export interface CriteriaKpiCardProps {
  title?: string;
  value: number | string;
  unit?: string;
  subtitle?: string;
  badgeText?: string;
  className?: string;
}

/**
 * Tarjeta HUD de KPI Principal (Porcentaje de Viabilidad / Métrica Central)
 * Construida sobre el esqueleto HudCard (variante slate).
 * Distribución Flexbox limpia sin posicionamiento absoluto rígido.
 */
export const CriteriaKpiCard: React.FC<CriteriaKpiCardProps> = ({
  title = "Viability Score",
  value = "75%",
  unit = "%",
  subtitle = "Viable landing zone ↑",
  badgeText,
  className = "w-fit",
}) => {
  const formattedValue =
    typeof value === "number" ? `${value}${unit}` : value;

  return (
    <HudCard
      variant="slate"
      padding="md"
      ariaLabel={title}
      className={`justify-between gap-[clamp(0.12rem,0.45vh,0.35rem)] ${className}`}
    >
      <HudCardHeader
        title={title}
        size="md"
        action={
          badgeText ? (
            <span className="px-[0.5vw] py-[0.15vh] rounded-full bg-palette-cream/15 border border-palette-cream/25 font-sans font-medium text-[clamp(0.52rem,0.98vh,0.625rem)] tracking-wider uppercase text-palette-cream">
              {badgeText}
            </span>
          ) : undefined
        }
      />

      {/* Valor central KPI escalado proporcionalmente a la altura de pantalla */}
      <div className="flex items-center justify-center py-[clamp(0.08rem,0.35vh,0.35rem)] w-auto px-1">
        <span className="font-heading font-medium text-[clamp(2.1rem,5.6vh,4.25rem)] leading-none text-center text-[#FAFAFA] tabular-nums tracking-tight">
          {formattedValue}
        </span>
      </div>

      {subtitle && <HudCardFooter>{subtitle}</HudCardFooter>}
    </HudCard>
  );
};

export default CriteriaKpiCard;
