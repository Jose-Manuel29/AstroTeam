"use client";

import React, { useMemo } from "react";
import type { LandingSite } from "../../types";

export interface SouthPoleMinimapProps {
  sites: LandingSite[];
  currentSiteId: string;
  onSelectSite?: (siteId: string) => void;
  size?: number;
  className?: string;
  isOverview?: boolean;
}

function projectSite(site: LandingSite): { x: number; y: number } {
  const radius = Math.min(7, Math.max(0, 90 + site.coordinates.lat)) / 7 * 78;
  const longitude = (site.coordinates.lng * Math.PI) / 180;
  return {
    x: 105 + radius * Math.sin(longitude),
    y: 105 - radius * Math.cos(longitude),
  };
}

/**
 * Componente SouthPoleMinimap (Radar Polar de Orientación)
 * Reconstruye la superficie del polo sur lunar mediante una matriz 2x2:
 *  [ 1.png | 2.png ]
 *  [ 3.png | 4.png ]
 * Renderiza dos líneas discontinuas perpendiculares y un recuadro de zona con la paleta Lunar Regolith
 * (palette-cream / palette-ochre / palette-obsidian) que enmarca la ubicación activa analizada en la vista 3D.
 * Totalmente adaptativo a la altura y ancho del viewport con porcentajes y clamps relativos.
 */
export const SouthPoleMinimap: React.FC<SouthPoleMinimapProps> = ({
  sites,
  currentSiteId,
  onSelectSite,
  size,
  className = "w-full h-full aspect-square",
  isOverview = false,
}) => {
  // Dimensiones relativas (%) respecto al sistema base de 210x210 de Figma
  const rectWidthPct = (38 / 210) * 100;
  const rectHeightPct = (19 / 210) * 100;

  // Coordenadas del sitio activo en porcentaje (%)
  const activeCoord = useMemo(() => {
    const activeSite = sites.find((site) => site.id === currentSiteId) ?? sites[0];
    return activeSite ? projectSite(activeSite) : { x: 105, y: 105 };
  }, [sites, currentSiteId]);

  const targetXPct = (activeCoord.x / 210) * 100;
  const targetYPct = (activeCoord.y / 210) * 100;

  const rectLeftPct = targetXPct - rectWidthPct / 2;
  const rectTopPct = targetYPct - rectHeightPct / 2;

  return (
    <div
      className={`relative rounded-full overflow-hidden select-none border border-palette-slate/40 bg-palette-obsidian shadow-[0_0_24px_rgba(217,206,197,0.18)] ${className}`}
      style={{
        ...(size ? { width: `${size}px`, height: `${size}px` } : {}),
        filter: "drop-shadow(0px 0px 20px rgba(217, 206, 197, 0.2))",
      }}
      aria-label="South Pole Polar Minimap"
    >
      {/* 1. MATRIZ DE IMÁGENES 2x2 */}
      {/* 1 2 */}
      {/* 3 4 */}
      <div className="grid grid-cols-2 grid-rows-2 w-full h-full pointer-events-none select-none">
        <img
          src="/images/south-pole-map/1.png"
          alt="South Pole NW"
          className="w-full h-full object-cover block select-none pointer-events-none"
          draggable={false}
        />
        <img
          src="/images/south-pole-map/2.png"
          alt="South Pole NE"
          className="w-full h-full object-cover block select-none pointer-events-none"
          draggable={false}
        />
        <img
          src="/images/south-pole-map/3.png"
          alt="South Pole SW"
          className="w-full h-full object-cover block select-none pointer-events-none"
          draggable={false}
        />
        <img
          src="/images/south-pole-map/4.png"
          alt="South Pole SE"
          className="w-full h-full object-cover block select-none pointer-events-none"
          draggable={false}
        />
      </div>

      {/* 2. OVERLAY RADAR SUTIL CON PALETA LUNAR */}
      <div className="absolute inset-0 rounded-full border border-palette-cream/15 pointer-events-none" />

      {/* 3. LÍNEA VERTICAL DISCONTINUA (Paleta Ochre con opacidad, oculta en overview) */}
      <div
        className={`absolute top-0 bottom-0 w-0 border-l-2 border-dashed border-palette-ochre/85 pointer-events-none transition-all duration-500 ease-out z-10 ${
          isOverview ? "opacity-0 scale-95" : "opacity-100 scale-100"
        }`}
        style={{
          left: `${targetXPct}%`,
        }}
      />

      {/* 4. LÍNEA HORIZONTAL DISCONTINUA (Paleta Ochre con opacidad, oculta en overview) */}
      <div
        className={`absolute left-0 right-0 h-0 border-t-2 border-dashed border-palette-ochre/85 pointer-events-none transition-all duration-500 ease-out z-10 ${
          isOverview ? "opacity-0 scale-95" : "opacity-100 scale-100"
        }`}
        style={{
          top: `${targetYPct}%`,
        }}
      />

      {/* 5. RECUADRO DE ZONA ACTIVA (Paleta Cream translúcido con borde Ochre, oculto en overview) */}
      <div
        className={`absolute box-border bg-palette-cream/70 border-2 border-palette-ochre pointer-events-none transition-all duration-500 ease-out z-20 shadow-[0_0_12px_rgba(217,206,197,0.35)] ${
          isOverview ? "opacity-0 scale-75" : "opacity-100 scale-100"
        }`}
        style={{
          width: `${rectWidthPct}%`,
          height: `${rectHeightPct}%`,
          left: `${rectLeftPct}%`,
          top: `${rectTopPct}%`,
        }}
      />

      {/* 6. PUNTOS DE SITIOS CANDIDATOS (Marcadores polares interactivos en %) */}
      {sites.map((site) => {
        const coord = projectSite(site);
        const posXPct = (coord.x / 210) * 100;
        const posYPct = (coord.y / 210) * 100;
        const isActive = !isOverview && site.id === currentSiteId;

        return (
          <button
            key={site.id}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectSite?.(site.id);
            }}
            title={`${site.name} (${Math.abs(site.coordinates.lat)}°S, ${site.coordinates.lng}°E)`}
            className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform duration-300 z-30 group cursor-pointer focus:outline-none ${
              isActive ? "scale-125" : "hover:scale-150"
            }`}
            style={{
              left: `${posXPct}%`,
              top: `${posYPct}%`,
            }}
          >
            <span
              className={`block rounded-full transition-all ${
                isActive
                  ? "w-[clamp(7px,1.1vh,10px)] h-[clamp(7px,1.1vh,10px)] bg-palette-cream shadow-[0_0_8px_#D9CEC5] ring-2 ring-palette-ochre"
                  : "w-[clamp(4px,0.7vh,6px)] h-[clamp(4px,0.7vh,6px)] bg-palette-slate/90 shadow-[0_0_4px_#7F7B8C] hover:bg-palette-cream"
              }`}
            />
          </button>
        );
      })}
    </div>
  );
};

export default SouthPoleMinimap;
