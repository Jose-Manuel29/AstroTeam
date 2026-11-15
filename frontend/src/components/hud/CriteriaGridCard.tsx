import React, { useState, useRef, useEffect, useMemo } from "react";
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
 * El botón "ver más" / "see more" solo aparece cuando el contenido tiene overflow.
 */
export const CriteriaGridCard: React.FC<CriteriaGridCardProps> = ({
  title = "Site Parameters",
  actionLabel = "see more",
  rows,
  expandedRows,
  onActionClick,
  className = "w-full",
}) => {
  const [showExpanded, setShowExpanded] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [hasOverflow, setHasOverflow] = useState(false);

  // Si se proveen filas expandidas, combinamos para evaluar overflow
  const allRows = useMemo(() => {
    if (!expandedRows || expandedRows.length === 0) return rows;
    return [...rows, ...expandedRows];
  }, [rows, expandedRows]);

  const displayedRows = showExpanded ? allRows : (expandedRows ? allRows : rows);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;

    const checkOverflow = () => {
      const isOverflowing = el.scrollHeight > el.clientHeight + 1;
      setHasOverflow(isOverflowing);
    };

    checkOverflow();

    const ro = new ResizeObserver(checkOverflow);
    ro.observe(el);

    return () => ro.disconnect();
  }, [displayedRows, showExpanded]);

  const handleAction = () => {
    if (expandedRows) {
      setShowExpanded((prev) => !prev);
    }
    onActionClick?.();
  };

  const showActionButton =
    (expandedRows || onActionClick) && (hasOverflow || showExpanded);

  return (
    <HudCard
      variant="ochre"
      padding="md"
      ariaLabel={title}
      className={`gap-[clamp(0.2rem,0.7vh,0.65rem)] ${className}`}
    >
      <HudCardHeader
        title={title}
        size="md"
        action={
          showActionButton ? (
            <button
              type="button"
              onClick={handleAction}
              className="font-heading font-light text-[clamp(0.65rem,1.2vh,0.75rem)] leading-tight underline text-palette-cream/80 hover:text-[#FAFAFA] transition-colors bg-transparent border-0 cursor-pointer p-0"
            >
              {showExpanded ? "see less" : actionLabel}
            </button>
          ) : undefined
        }
      />

      <HudCardBody
        ref={bodyRef}
        className={`gap-[clamp(0.12rem,0.45vh,0.35rem)] transition-all duration-300 ${
          showExpanded
            ? "max-h-[clamp(180px,32vh,320px)] overflow-y-auto pr-0.5"
            : expandedRows
            ? "max-h-[clamp(90px,15vh,135px)] overflow-hidden"
            : ""
        }`}
      >
        {displayedRows.map((row) => (
          <div
            key={row.id}
            className="grid grid-cols-2 gap-x-[1vw] items-center px-[clamp(0.35rem,0.5vw,0.45rem)] py-[clamp(0.14rem,0.4vh,0.3rem)] rounded-[clamp(4px,0.6vh,6px)] bg-palette-charcoal/30 border border-white/5 w-full"
          >
            <div className="flex flex-col min-w-0">
              {row.leftSubtext && (
                <span className="font-sans text-[clamp(0.5rem,0.92vh,0.6rem)] leading-tight uppercase tracking-wider text-palette-cream/70 truncate">
                  {row.leftSubtext}
                </span>
              )}
              <span className="font-sans font-normal text-[clamp(0.65rem,1.2vh,0.78125rem)] leading-tight text-[#FAFAFA] truncate tabular-nums">
                {row.leftText}
              </span>
            </div>

            <div className="flex flex-col min-w-0 text-right">
              {row.rightSubtext && (
                <span className="font-sans text-[clamp(0.5rem,0.92vh,0.6rem)] leading-tight uppercase tracking-wider text-palette-cream/70 truncate">
                  {row.rightSubtext}
                </span>
              )}
              <span className="font-sans font-normal text-[clamp(0.65rem,1.2vh,0.78125rem)] leading-tight text-[#FAFAFA] truncate tabular-nums">
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
