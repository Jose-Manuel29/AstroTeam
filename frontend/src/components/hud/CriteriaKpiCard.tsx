import React from "react";
import { CheckCircle, WarningCircle, XCircle } from "@phosphor-icons/react";
import { HudCard, HudCardHeader, HudCardFooter } from "./HudCard";

export type KpiStatusTier = "optimal" | "marginal" | "critical";

export interface CriteriaKpiCardProps {
  title?: string;
  value: number | string;
  unit?: string;
  subtitle?: string;
  badgeText?: string;
  statusTier?: KpiStatusTier;
  className?: string;
}

/**
 * Tarjeta HUD de KPI Principal (Porcentaje de Viabilidad / Métrica Central)
 * Construida sobre el esqueleto HudCard (variante slate).
 * Distribución Flexbox limpia con badge dinámico e icono representativo por estado.
 */
export const CriteriaKpiCard: React.FC<CriteriaKpiCardProps> = ({
  title = "Viability Score",
  value = "75%",
  unit = "%",
  subtitle = "Viable landing zone ↑",
  badgeText,
  statusTier,
  className = "w-fit",
}) => {
  const formattedValue =
    typeof value === "number" ? `${value}${unit}` : value;

  // Si se pasa statusTier, renderiza el badge idéntico al picker (icono + color correspondiente)
  const renderStatusBadge = () => {
    if (!statusTier && !badgeText) return null;

    if (statusTier === "optimal") {
      return (
        <span className="inline-flex items-center gap-1.5 text-[clamp(0.6rem,1vh,0.72rem)] font-sans font-medium text-emerald-400">
          <CheckCircle size={14} weight="fill" className="text-emerald-400 shrink-0 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
          {badgeText || "OPTIMAL"}
        </span>
      );
    }

    if (statusTier === "marginal") {
      return (
        <span className="inline-flex items-center gap-1.5 text-[clamp(0.6rem,1vh,0.72rem)] font-sans font-medium text-amber-400">
          <WarningCircle size={14} weight="fill" className="text-amber-400 shrink-0 shadow-[0_0_6px_rgba(251,191,36,0.6)]" />
          {badgeText || "MARGINAL"}
        </span>
      );
    }

    if (statusTier === "critical") {
      return (
        <span className="inline-flex items-center gap-1.5 text-[clamp(0.6rem,1vh,0.72rem)] font-sans font-medium text-rose-400">
          <XCircle size={14} weight="fill" className="text-rose-400 shrink-0 shadow-[0_0_6px_rgba(251,113,133,0.6)]" />
          {badgeText || "CRITICAL"}
        </span>
      );
    }

    // Fallback estándar si solo viene badgeText plano
    return (
      <span className="px-[0.5vw] py-[0.15vh] rounded-full bg-palette-cream/15 border border-palette-cream/25 font-sans font-medium text-[clamp(0.52rem,0.98vh,0.625rem)] tracking-wider uppercase text-palette-cream">
        {badgeText}
      </span>
    );
  };

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
        action={renderStatusBadge()}
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
