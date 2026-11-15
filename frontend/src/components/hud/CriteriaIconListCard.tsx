import React, { useRef, useState, useEffect } from "react";
import {
  Sun,
  Thermometer,
  Radioactive,
  Compass,
  Mountains,
  Broadcast,
  Snowflake,
  ShieldCheck,
} from "@phosphor-icons/react";
import { HudCard, HudCardHeader, HudCardBody } from "./HudCard";

export type CriterionIconType =
  | "sun"
  | "thermometer"
  | "radiation"
  | "compass"
  | "mountains"
  | "broadcast"
  | "ice"
  | "shield";

export interface CriterionIconListItem {
  id: string;
  label: string;
  /** Valor de telemetría inyectado opcional (ej. "1,361 W/m²", "86%", "Viable") */
  value?: string | number;
  icon: CriterionIconType | React.ReactNode;
  active?: boolean;
  /** Si el ítem está actualmente seleccionado (destaca suavemente la fila) */
  selected?: boolean;
}

export interface CriteriaIconListCardProps {
  title?: string;
  subtitle?: string;
  /** Alineación del título de la cabecera ("left" por defecto, "right" para paneles derechos) */
  headerAlign?: "left" | "center" | "right";
  /** Posición del icono en cada fila ("right" por defecto, "left" como en el Picker de Figma) */
  iconPosition?: "left" | "right";
  items: CriterionIconListItem[];
  onToggleItem?: (id: string) => void;
  footerAction?: React.ReactNode;
  /** Etiqueta de acción en la cabecera (ej. "see more") */
  actionLabel?: string;
  /** Etiqueta de acción cuando está expandido (ej. "see less") */
  expandedActionLabel?: string;
  /** Estado de expansión */
  isExpanded?: boolean;
  /** Callback para alternar estado de expansión */
  onToggleExpand?: () => void;
  /** Elemento de acción personalizado */
  action?: React.ReactNode;
  className?: string;
}

/**
 * Tarjeta HUD de Lista de Telemetría / Zonas de Aterrizaje con Iconos (@phosphor-icons/react)
 * Construida sobre el esqueleto HudCard (variante ochre).
 * Soporta icono a la izquierda o derecha y cabecera alineada a izquierda o derecha.
 */
export const CriteriaIconListCard: React.FC<CriteriaIconListCardProps> = ({
  title = "Fulfilled criteria",
  subtitle,
  headerAlign = "left",
  iconPosition = "right",
  items,
  onToggleItem,
  footerAction,
  actionLabel = "see more",
  expandedActionLabel = "see less",
  isExpanded,
  onToggleExpand,
  action,
  className = "w-full",
}) => {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [hasOverflow, setHasOverflow] = useState(false);

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
  }, [items]);

  const renderIcon = (icon: CriterionIconType | React.ReactNode) => {
    if (typeof icon !== "string") return icon;

    const iconProps = {
      weight: "regular" as const,
      className: "w-full h-full text-palette-cream",
    };

    switch (icon) {
      case "thermometer":
        return <Thermometer {...iconProps} />;
      case "radiation":
        return <Radioactive {...iconProps} />;
      case "compass":
        return <Compass {...iconProps} />;
      case "mountains":
        return <Mountains {...iconProps} />;
      case "broadcast":
        return <Broadcast {...iconProps} />;
      case "ice":
        return <Snowflake {...iconProps} />;
      case "shield":
        return <ShieldCheck {...iconProps} />;
      case "sun":
      default:
        return <Sun {...iconProps} />;
    }
  };

  return (
    <HudCard
      variant="ochre"
      padding="md"
      ariaLabel={title}
      className={`gap-[clamp(0.25rem,0.75vh,0.65rem)] ${className}`}
    >
      <HudCardHeader
        title={title}
        subtitle={subtitle}
        align={headerAlign}
        size="md"
        action={
          action ||
          (onToggleExpand && (hasOverflow || isExpanded) ? (
            <button
              type="button"
              onClick={onToggleExpand}
              className="font-heading font-light text-[clamp(0.65rem,1.2vh,0.75rem)] leading-tight underline text-palette-cream/80 hover:text-[#FAFAFA] transition-colors bg-transparent border-0 cursor-pointer p-0"
            >
              {isExpanded ? expandedActionLabel : actionLabel}
            </button>
          ) : undefined)
        }
      />

      <HudCardBody ref={bodyRef} className="gap-[clamp(0.12rem,0.4vh,0.32rem)] max-h-[clamp(115px,24vh,230px)] overflow-y-auto overflow-x-hidden pr-0.5 shrink-0">
        {items.map((item) => {
          const isActive = item.active !== false;
          const isSelected = Boolean(item.selected);

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onToggleItem?.(item.id)}
              className={`
                flex items-center justify-between gap-[0.75vw]
                px-[clamp(0.35rem,0.65vw,0.55rem)] py-[clamp(0.16rem,0.48vh,0.38rem)] w-full
                border rounded-[clamp(6px,0.8vh,8px)] transition-all cursor-pointer
                ${
                  isSelected
                    ? "bg-white/15 border-white/25"
                    : "bg-transparent border-transparent hover:bg-white/10"
                }
                ${isActive ? "opacity-100" : "opacity-40"}
              `}
            >
              {iconPosition === "left" ? (
                <>
                  <span className="w-[clamp(13px,1.7vh,18px)] h-[clamp(13px,1.7vh,18px)] flex items-center justify-center shrink-0">
                    {renderIcon(item.icon)}
                  </span>

                  <div className="flex items-center justify-end gap-2 min-w-0 flex-1 text-right">
                    {item.value !== undefined && (
                      <span className="font-sans font-medium text-[clamp(0.62rem,1.15vh,0.72rem)] leading-tight text-palette-cream tabular-nums shrink-0">
                        {item.value}
                      </span>
                    )}
                    <span className="font-sans font-light text-[clamp(0.66rem,1.2vh,0.78125rem)] leading-tight text-[#FAFAFA] truncate">
                      {item.label}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <span className="font-sans font-light text-[clamp(0.66rem,1.2vh,0.78125rem)] leading-tight text-[#FAFAFA] truncate text-left">
                    {item.label}
                  </span>

                  <div className="flex items-center gap-[0.5vw] shrink-0">
                    {item.value !== undefined && (
                      <span className="font-sans font-medium text-[clamp(0.62rem,1.15vh,0.72rem)] leading-tight text-palette-cream tabular-nums">
                        {item.value}
                      </span>
                    )}
                    <span className="w-[clamp(13px,1.7vh,18px)] h-[clamp(13px,1.7vh,18px)] flex items-center justify-center">
                      {renderIcon(item.icon)}
                    </span>
                  </div>
                </>
              )}
            </button>
          );
        })}
      </HudCardBody>

      {footerAction && (
        <div className="pt-[0.2vh] w-full min-h-0 flex-1 flex flex-col overflow-hidden">
          {footerAction}
        </div>
      )}
    </HudCard>
  );
};

export default CriteriaIconListCard;
