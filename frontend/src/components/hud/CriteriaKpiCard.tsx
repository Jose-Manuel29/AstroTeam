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
  className = "w-[clamp(260px,23.5vw,336px)]",
}) => {
  const formattedValue =
    typeof value === "number" ? `${value}${unit}` : value;

  return (
    <HudCard
      variant="slate"
      padding="md"
      ariaLabel={title}
      className={`justify-between gap-[clamp(0.2rem,0.65vh,0.5rem)] ${className}`}
    >
      <HudCardHeader
        title={title}
        size="md"
        action={
          badgeText ? (
            <span className="px-[0.5vw] py-[0.2vh] rounded-full bg-white/10 border border-white/15 font-sans font-medium text-[clamp(0.55rem,1.05vh,0.625rem)] tracking-wider uppercase text-[#D9CEC5]">
              {badgeText}
            </span>
          ) : undefined
        }
      />

      {/* Valor central KPI escalado proporcionalmente a la altura de pantalla */}
      <div className="flex items-center justify-center py-[clamp(0.1rem,0.45vh,0.5rem)] w-full">
        <span className="font-heading font-medium text-[clamp(2.5rem,7.2vh,4.75rem)] leading-none text-center text-[#FAFAFA] tabular-nums tracking-tight">
          {formattedValue}
        </span>
      </div>

      {subtitle && <HudCardFooter>{subtitle}</HudCardFooter>}
    </HudCard>
  );
};

export default CriteriaKpiCard;
