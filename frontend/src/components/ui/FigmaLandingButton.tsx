import React from "react";

export interface FigmaLandingButtonProps {
  onClick?: () => void;
  className?: string;
  label?: string;
  textColor?: string;
  icon?: React.ReactNode;
}

/**
 * Botón táctico espacial basado en el diseño de Figma (Landing CTA / Action Button):
 * - Dimensiones: auto / min-w-[135px], h-[40px] o fluido
 * - Padding: 8px 24px, gap: 10px
 * - Fondo: rgba(217, 206, 197, 0.25) con backdrop-blur-[8px]
 * - Sombra: 0px 4px 4px rgba(0, 0, 0, 0.25)
 * - Bordes: rounded-[18px]
 * - Tipografía: 'Inter' bold (font-sans), 18px-20px
 */
export const FigmaLandingButton: React.FC<FigmaLandingButtonProps> = ({
  onClick,
  className = "",
  label = "Touch Down",
  textColor = "text-[#09080C]",
  icon,
}) => {
  return (
    <button
      onClick={onClick}
      type="button"
      className={`group relative inline-flex items-center justify-center gap-2.5 px-6 py-2 min-w-[135px] h-[40px] rounded-[18px] bg-[rgba(217,206,197,0.25)] hover:bg-[rgba(217,206,197,0.38)] active:bg-[rgba(217,206,197,0.3)] shadow-[0px_4px_4px_rgba(0,0,0,0.25),inset_0px_1px_1.5px_rgba(255,255,255,0.45)] backdrop-blur-[8px] border border-white/35 hover:border-white/60 transition-all duration-200 hover:scale-[1.04] active:scale-[0.97] cursor-pointer select-none focus:outline-none ${className}`}
      aria-label={label}
    >
      <span className={`font-sans font-bold text-[18px] sm:text-[20px] leading-[24px] text-center whitespace-nowrap transition-colors ${textColor}`}>
        {label}
      </span>
      {icon && <span className="shrink-0">{icon}</span>}
    </button>
  );
};

export default FigmaLandingButton;
