import React from "react";

export type HudCardVariant =
  | "charcoal"
  | "slate"
  | "ochre"
  | "cream"
  | "obsidian"
  | "transparent";
export type HudCardPadding = "none" | "sm" | "md" | "lg";

export interface HudCardProps {
  /** ID opcional para vincular elementos del layout o slots de anclaje */
  id?: string;
  /** Variante cromática basada en la paleta oficial Lunar Regolith o transparente */
  variant?: HudCardVariant;
  /** Espaciado interno del contenedor */
  padding?: HudCardPadding;
  /** Clases adicionales de Tailwind (ej. w-[340px], max-w-sm, etc.) */
  className?: string;
  /** Etiqueta de accesibilidad para la región del HUD */
  ariaLabel?: string;
  children?: React.ReactNode;
}

const VARIANT_CLASSES: Record<HudCardVariant, string> = {
  charcoal:
    "bg-[#3B3B40]/25 backdrop-blur-md border border-white/15 shadow-[0px_4px_4px_rgba(63,60,73,0.85),inset_0px_1px_1px_rgba(255,255,255,0.18)]",
  slate:
    "bg-[#7F7B8C]/20 backdrop-blur-md border border-white/15 shadow-[0px_4px_4px_rgba(63,60,73,0.85),inset_0px_1px_1px_rgba(255,255,255,0.18)]",
  ochre:
    "bg-[#A6948A]/20 backdrop-blur-md border border-white/15 shadow-[0px_4px_4px_rgba(63,60,73,0.85),inset_0px_1px_1px_rgba(255,255,255,0.18)]",
  cream:
    "bg-[#D9CEC5]/20 backdrop-blur-md border border-white/15 shadow-[0px_4px_4px_rgba(63,60,73,0.85),inset_0px_1px_1px_rgba(255,255,255,0.18)]",
  obsidian:
    "bg-[#0D0D0D]/70 backdrop-blur-md border border-white/15 shadow-[0px_4px_4px_rgba(63,60,73,0.85),inset_0px_1px_1px_rgba(255,255,255,0.18)]",
  transparent: "bg-transparent border border-transparent shadow-none",
};

const PADDING_CLASSES: Record<HudCardPadding, string> = {
  none: "p-0",
  sm: "px-[clamp(0.6rem,1vw,0.875rem)] py-[clamp(0.3rem,0.85vh,0.65rem)]",
  md: "px-[clamp(0.75rem,1.25vw,1.15rem)] py-[clamp(0.35rem,1.05vh,0.85rem)]",
  lg: "px-[clamp(0.875rem,1.45vw,1.35rem)] py-[clamp(0.5rem,1.3vh,1.1rem)]",
};

/**
 * Esqueleto Base para Tarjetas HUD (AstroTeam Design System)
 * Encapsula el efecto glassmorphism espacial, bordes translúcidos, sombras y variantes de color.
 * Utiliza medidas relativas fluidas (clamp / vh / vw) para adaptarse a cualquier altura de pantalla en desktop.
 */
export const HudCard: React.FC<HudCardProps> = ({
  id,
  variant = "charcoal",
  padding = "md",
  className = "",
  ariaLabel,
  children,
}) => {
  return (
    <section
      id={id}
      aria-label={ariaLabel}
      className={`
        relative flex flex-col rounded-[clamp(12px,1.8vh,18px)]
        ${VARIANT_CLASSES[variant]}
        ${PADDING_CLASSES[padding]}
        text-[#FAFAFA] select-none pointer-events-auto
        transition-all duration-200
        ${className}
      `}
    >
      {children}
    </section>
  );
};

export interface HudCardHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Acción opcional a la derecha (ej. botón "see more", badge o icono) */
  action?: React.ReactNode;
  /** Alineación del título */
  align?: "left" | "center" | "right";
  /** Tamaño tipográfico del título */
  size?: "sm" | "md" | "lg";
  className?: string;
}

const HEADER_SIZE_CLASSES = {
  sm: "text-[clamp(0.72rem,1.35vh,0.875rem)] leading-tight",
  md: "text-[clamp(0.78rem,1.55vh,1rem)] leading-tight",
  lg: "text-[clamp(0.85rem,1.75vh,1.15rem)] leading-tight",
};

/**
 * Cabecera estandarizada para tarjetas HUD (Space Grotesk)
 */
export const HudCardHeader: React.FC<HudCardHeaderProps> = ({
  title,
  subtitle,
  action,
  align = "left",
  size = "md",
  className = "",
}) => {
  const alignClass =
    align === "right"
      ? "justify-end text-right"
      : align === "center"
      ? "justify-center text-center"
      : "justify-between text-left";

  return (
    <header className={`flex flex-col gap-[0.2vh] w-full shrink-0 ${className}`}>
      <div className={`flex items-center gap-[0.8vw] w-full ${alignClass}`}>
        <h2
          className={`font-heading font-normal ${HEADER_SIZE_CLASSES[size]} text-[#FAFAFA] tracking-wide truncate`}
        >
          {title}
        </h2>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {subtitle && (
        <p className="font-sans font-light text-[clamp(0.68rem,1.25vh,0.75rem)] leading-[1.3] text-[#D9CEC5]/80">
          {subtitle}
        </p>
      )}
    </header>
  );
};

export interface HudCardBodyProps {
  className?: string;
  children: React.ReactNode;
}

/**
 * Cuerpo flexible para inyección de datos en tarjetas HUD
 */
export const HudCardBody: React.FC<HudCardBodyProps> = ({
  className = "",
  children,
}) => {
  return (
    <div className={`flex flex-col gap-[clamp(0.3rem,0.85vh,0.625rem)] w-full grow ${className}`}>
      {children}
    </div>
  );
};

export interface HudCardFooterProps {
  className?: string;
  children: React.ReactNode;
}

/**
 * Pie de tarjeta HUD para notas, estados o subtítulos de KPI
 */
export const HudCardFooter: React.FC<HudCardFooterProps> = ({
  className = "",
  children,
}) => {
  return (
    <footer
      className={`w-full pt-[clamp(0.125rem,0.35vh,0.25rem)] flex items-center justify-center font-sans font-light text-[clamp(0.7rem,1.35vh,0.8125rem)] leading-[1.3] text-[#D9CEC5] ${className}`}
    >
      {children}
    </footer>
  );
};

export default HudCard;
