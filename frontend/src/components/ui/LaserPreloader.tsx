"use client";

import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import { ASTRO_TEAM_PATH_D, ASTRO_TEAM_VIEWBOX } from "./AstroTeamLogoSvg";

export interface LaserPreloaderProps {
  onComplete: () => void;
}

type PreloaderStage = "measuring" | "engraving" | "cooldown" | "gliding" | "fading" | "complete";

export const LaserPreloader: React.FC<LaserPreloaderProps> = ({ onComplete }) => {
  const pathRef = useRef<SVGPathElement>(null);
  const [stage, setStage] = useState<PreloaderStage>("measuring");
  const [pathLength, setPathLength] = useState<number>(10000); // Valor fallback razonable
  const [isEngraveActive, setIsEngraveActive] = useState(false);

  // 1. Medir la longitud real del trazo SVG al montar en el DOM
  useLayoutEffect(() => {
    if (pathRef.current) {
      try {
        const length = pathRef.current.getTotalLength();
        if (length && length > 0) {
          setPathLength(length);
        }
      } catch {
        // En caso de SSR o navegadores que fallen getTotalLength
      }
    }
  }, []);

  // 2. Máquina de estados de la secuencia del láser
  useEffect(() => {
    // Iniciar el grabado en el siguiente frame
    const startTimer = requestAnimationFrame(() => {
      setStage("engraving");
      // Breve retraso de un frame para activar la transición CSS
      requestAnimationFrame(() => {
        setIsEngraveActive(true);
      });
    });

    // Fase 2: Enfriado del láser (revela texto blanco y apaga el halo de luz)
    const cooldownTimer = setTimeout(() => {
      setStage("cooldown");
    }, 2800);

    // Fase 3: Desplazamiento del SVG exactamente sobre la posición del título
    const glidingTimer = setTimeout(() => {
      setStage("gliding");
    }, 3600);

    // Fase 4: Desvanecimiento del fondo negro (fondo pierde opacidad gradualmente)
    const fadingTimer = setTimeout(() => {
      setStage("fading");
    }, 4550);

    // Fase 5: Finalización y desmontado (el título real queda visible debajo)
    const completeTimer = setTimeout(() => {
      setStage("complete");
      onComplete();
    }, 5350);

    // Permitir saltar la animación con ESC o Space
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === " " || e.key === "Enter") {
        setStage("complete");
        onComplete();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      cancelAnimationFrame(startTimer);
      clearTimeout(cooldownTimer);
      clearTimeout(glidingTimer);
      clearTimeout(fadingTimer);
      clearTimeout(completeTimer);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onComplete]);

  if (stage === "complete") {
    return null;
  }

  const isGlided = stage === "gliding" || stage === "fading";
  const isFadedBg = stage === "fading";

  return (
    <div
      aria-label="Cargando visualizador lunar..."
      className="fixed inset-0 z-[9999] overflow-hidden select-none"
      onClick={() => {
        // Clic en la pantalla para saltar si el usuario lo desea
        if (stage !== "fading") {
          setStage("complete");
          onComplete();
        }
      }}
    >
      {/* Fondo negro que se desvanece de forma animada al llegar sobre el título */}
      <div
        className="absolute inset-0 bg-[#09080C] pointer-events-none"
        style={{
          opacity: isFadedBg ? 0 : 1,
          transition: "opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      />

      {/* Contenedor del SVG que se desplaza exactamente a la posición del título en LandingView */}
      <div
        className="pointer-events-none"
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: "min(94.11vh, 95vw)",
          aspectRatio: "928 / 94",
          transform: isGlided
            ? "translate(-50%, -35vh)"
            : "translate(-50%, -50%)",
          transition: isGlided
            ? "transform 0.95s cubic-bezier(0.22, 1, 0.36, 1)"
            : "none",
        }}
      >
        <svg
          viewBox={ASTRO_TEAM_VIEWBOX}
          className="w-full h-full block"
          style={{
            filter:
              stage === "engraving"
                ? "drop-shadow(0 0 5px #FFFFFF) drop-shadow(0 0 14px rgba(217, 206, 197, 0.95)) drop-shadow(0 0 32px rgba(166, 148, 138, 0.7))"
                : stage === "cooldown"
                ? "drop-shadow(0 0 4px rgba(217, 206, 197, 0.3))"
                : "none",
            transition: "filter 0.8s ease-out",
          }}
          aria-hidden="true"
        >
          <path
            ref={pathRef}
            d={ASTRO_TEAM_PATH_D}
            style={{
              strokeWidth: 1.5,
              // Fase 1: Trazo color lunar cream (#D9CEC5), relleno transparente
              // Fase 2 en adelante: Trazo se vuelve transparente y relleno blanco puro (#FFFFFF)
              stroke: stage === "engraving" ? "#D9CEC5" : "transparent",
              fill: stage === "engraving" ? "transparent" : "#FFFFFF",
              strokeDasharray: pathLength,
              strokeDashoffset: isEngraveActive ? 0 : pathLength,
              transition:
                stage === "engraving"
                  ? "stroke-dashoffset 2.7s cubic-bezier(0.4, 0, 0.2, 1)"
                  : "fill 0.8s ease-out, stroke 0.8s ease-out",
            }}
          />
        </svg>
      </div>

      {/* Indicador táctico sutil para omitir */}
      <div
        className="absolute bottom-6 right-8 pointer-events-auto transition-opacity duration-500 font-mono text-[11px] tracking-wider text-[#7F7B8C]/60 hover:text-[#D9CEC5] cursor-pointer"
        style={{
          opacity: isFadedBg ? 0 : 1,
        }}
        onClick={(e) => {
          e.stopPropagation();
          setStage("complete");
          onComplete();
        }}
      >
        [ESC / CLICK TO SKIP]
      </div>
    </div>
  );
};
