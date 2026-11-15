import React from "react";

export interface FigmaLandingButtonProps {
  onClick?: () => void;
  className?: string;
  label?: string;
}

/**
 * Botón "Frame 8" de Figma:
 * - Dimensiones: auto / min-w-[135px], h-[40px]
 * - Padding: 8px 24px, gap: 10px
 * - Fondo: rgba(217, 206, 197, 0.2) con backdrop-blur-[6px]
 * - Sombra: 0px 4px 4px rgba(0, 0, 0, 0.25)
 * - Bordes: rounded-[18px]
 * - Tipografía: 'Inter' bold (font-sans), 16px/20px, text-center, color #09080C (o #3B3B40 en Figma)
 */
export const FigmaLandingButton: React.FC<FigmaLandingButtonProps> = ({
  onClick,
  className = "",
  label = "Aterrizar",
}) => {
  return (
    <button
      onClick={onClick}
      type="button"
      className={`group relative inline-flex items-center justify-center px-6 py-2 min-w-[135px] h-[40px] rounded-[18px] bg-[rgba(217,206,197,0.2)] hover:bg-[rgba(217,206,197,0.3)] active:bg-[rgba(217,206,197,0.25)] shadow-[0px_4px_4px_rgba(0,0,0,0.25),inset_0px_1px_1.5px_rgba(255,255,255,0.45)] backdrop-blur-[8px] border border-white/35 hover:border-white/55 transition-all duration-200 hover:scale-[1.04] active:scale-[0.97] cursor-pointer select-none focus:outline-none ${className}`}
      aria-label={label}
    >
      <span className="font-sans font-bold text-[20px] leading-[24px] text-center text-[#09080C] whitespace-nowrap">
        {label}
      </span>
    </button>
  );
};

export default FigmaLandingButton;
