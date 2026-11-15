import React, { useState } from "react";
import { HudCard, HudCardHeader, HudCardBody } from "./HudCard";

export interface CriteriaGridRow {
  id: string;
  leftText: string;
  rightText: string;
  leftSubtext?: string;
  rightSubtext?: string;
}

export interface CriteriaGridCardProps {
  title?: string;
  actionLabel?: string;
  rows: CriteriaGridRow[];
  expandedRows?: CriteriaGridRow[];
  onActionClick?: () => void;
  className?: string;
}

/**
 * Tarjeta HUD de Grid de 2 Columnas (Parámetros Topográficos y Coordenadas)
 * Construida sobre el esqueleto HudCard (variante ochre).
 * Soporta alternancia interactiva entre vista resumida y vista detallada ("see more").
 */
export const CriteriaGridCard: React.FC<CriteriaGridCardProps> = ({
  title = "Site Parameters",
  actionLabel = "see more",
  rows,
  expandedRows,
  onActionClick,
  className = "w-[clamp(270px,25vw,360px)]",
}) => {
  const [showExpanded, setShowExpanded] = useState(false);

  const activeRows = showExpanded && expandedRows ? expandedRows : rows;

  const handleAction = () => {
    if (expandedRows) {
      setShowExpanded((prev) => !prev);
    }
    onActionClick?.();
  };

  return (
    <HudCard
      variant="ochre"
      padding="md"
      ariaLabel={title}
      className={`gap-[clamp(0.35rem,0.95vh,0.875rem)] ${className}`}
    >
      <HudCardHeader
        title={title}
        size="md"
        action={
          (expandedRows || onActionClick) && (
            <button
              type="button"
              onClick={handleAction}
              className="font-heading font-light text-[clamp(0.7rem,1.35vh,0.8125rem)] leading-[1.25] underline text-[#D9CEC5]/80 hover:text-[#FAFAFA] transition-colors bg-transparent border-0 cursor-pointer p-0"
            >
              {showExpanded ? "see less" : actionLabel}
            </button>
          )
        }
      />

      <HudCardBody className="gap-[clamp(0.2rem,0.6vh,0.5rem)]">
        {activeRows.map((row) => (
          <div
            key={row.id}
            className="grid grid-cols-2 gap-x-[1vw] items-center px-[clamp(0.4rem,0.6vw,0.5rem)] py-[clamp(0.18rem,0.5vh,0.375rem)] rounded-[clamp(6px,0.8vh,8px)] bg-white/[0.03] border border-white/5 w-full"
          >
            <div className="flex flex-col min-w-0">
              {row.leftSubtext && (
                <span className="font-sans text-[clamp(0.55rem,1.02vh,0.625rem)] leading-[1.2] uppercase tracking-wider text-[#D9CEC5]/70 truncate">
                  {row.leftSubtext}
                </span>
              )}
              <span className="font-sans font-normal text-[clamp(0.7rem,1.3vh,0.78125rem)] leading-[1.25] text-[#FAFAFA] truncate tabular-nums">
                {row.leftText}
              </span>
            </div>

            <div className="flex flex-col min-w-0 text-right">
              {row.rightSubtext && (
                <span className="font-sans text-[clamp(0.55rem,1.02vh,0.625rem)] leading-[1.2] uppercase tracking-wider text-[#D9CEC5]/70 truncate">
                  {row.rightSubtext}
                </span>
              )}
              <span className="font-sans font-normal text-[clamp(0.7rem,1.3vh,0.78125rem)] leading-[1.25] text-[#FAFAFA] truncate tabular-nums">
                {row.rightText}
              </span>
            </div>
          </div>
        ))}
      </HudCardBody>
    </HudCard>
  );
};

export default CriteriaGridCard;
