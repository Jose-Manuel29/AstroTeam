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
  className = "w-[clamp(220px,20vw,288px)]",
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
      className={`justify-between gap-[clamp(0.15rem,0.5vh,0.5rem)] ${className}`}
    >
      <HudCardHeader
        title={title}
        subtitle={subtitle}
        align={align}
        size="lg"
      />

      <div className={`flex items-baseline gap-[0.5vw] pt-[0.2vh] w-full ${justifyClass}`}>
        <span className="font-heading font-medium text-[clamp(2.1rem,5.8vh,4rem)] leading-none tracking-tight text-[#FAFAFA] tabular-nums">
          {days}
        </span>
        {unitLabel && (
          <span className="font-heading font-normal text-[clamp(1.1rem,2.9vh,2rem)] leading-none text-[#D9CEC5]">
            {unitLabel}
          </span>
        )}
      </div>
    </HudCard>
  );
};

export default CriteriaDaysKpiCard;
