import React from "react";
import { HudCard, HudCardHeader } from "./HudCard";

export interface CriteriaDaysKpiCardProps {
  title?: string;
  days: number | string;
  unitLabel?: string;
  subtitle?: string;
  align?: "left" | "center" | "right";
  className?: string;
}

/**
 * Tarjeta HUD de KPI Secundario / VentanaContinua (ej. "12 days")
 * Construida sobre el esqueleto HudCard (variante slate).
 */
export const CriteriaDaysKpiCard: React.FC<CriteriaDaysKpiCardProps> = ({
  title = "Solar Window",
  days = 12,
  unitLabel = "days",
  subtitle,
  align = "right",
  className = "w-fit",
}) => {
  const justifyClass =
    align === "left"
      ? "justify-start text-left"
      : align === "center"
      ? "justify-center text-center"
      : "justify-end text-right";

  return (
    <HudCard
      variant="slate"
      padding="md"
      ariaLabel={title}
      className={`justify-between gap-[clamp(0.2rem,0.5vh,0.45rem)] ${className}`}
    >
      <HudCardHeader
        title={title}
        align={align}
        size="md"
      />

      <div className={`flex items-baseline gap-[0.4vw] pt-[0.1vh] w-auto ${justifyClass}`}>
        <span className="font-heading font-medium text-[clamp(1.75rem,4.8vh,3.4rem)] leading-none tracking-tight text-[#FAFAFA] tabular-nums">
          {days}
        </span>
        {unitLabel && (
          <span className="font-heading font-normal text-[clamp(0.95rem,2.4vh,1.65rem)] leading-none text-palette-cream">
            {unitLabel}
          </span>
        )}
      </div>

      {subtitle && (
        <p className="font-sans font-light text-[clamp(0.65rem,1.15vh,0.72rem)] leading-[1.3] text-[#D9CEC5]/80 text-left pt-[0.2vh] w-full">
          {subtitle}
        </p>
      )}
    </HudCard>
  );
};

export default CriteriaDaysKpiCard;
