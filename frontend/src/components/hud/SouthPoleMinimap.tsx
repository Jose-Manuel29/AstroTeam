"use client";

import React, { useMemo } from "react";
import { MAP_HALF_EXTENT_M, latLonToSouthPolarStereo } from "../../lib/geo/polarStereo";
import type { LandingSite } from "../../types";

export interface SouthPoleMinimapProps {
  sites: LandingSite[];
  currentSiteId?: string;
  onSelectSite?: (siteId: string) => void;
  size?: number;
  className?: string;
}

/**
 * Posiciona los sitios con la misma proyección polar estereográfica que el DEM.
 */
export const SouthPoleMinimap: React.FC<SouthPoleMinimapProps> = ({
  sites,
  currentSiteId,
  onSelectSite,
  size,
  className = "w-[clamp(115px,19vh,210px)] h-[clamp(115px,19vh,210px)] aspect-square",
}) => {
  // Dimensiones relativas (%) respecto al sistema base de 210x210 de Figma
  const rectWidthPct = (38 / 210) * 100;
  const rectHeightPct = (19 / 210) * 100;
  const mapSpan = 2 * MAP_HALF_EXTENT_M;

  const siteCoordinates = useMemo(
    () =>
      sites.flatMap((site) => {
        const projected = latLonToSouthPolarStereo(site.coordinates.lat, site.coordinates.lng);
        if (
          Math.abs(projected.x) > MAP_HALF_EXTENT_M ||
          Math.abs(projected.y) > MAP_HALF_EXTENT_M
        ) {
          return [];
        }
        return [{
          site,
          x: ((projected.x + MAP_HALF_EXTENT_M) / mapSpan) * 100,
          y: ((MAP_HALF_EXTENT_M - projected.y) / mapSpan) * 100,
        }];
      }),
    [mapSpan, sites]
  );
  const activeCoord = siteCoordinates.find(({ site }) => site.id === currentSiteId);

  const targetXPct = activeCoord?.x ?? 50;
  const targetYPct = activeCoord?.y ?? 50;

  const rectLeftPct = targetXPct - rectWidthPct / 2;
  const rectTopPct = targetYPct - rectHeightPct / 2;

  return (
    <div
      className={`relative rounded-full overflow-hidden select-none border border-white/25 bg-[#0D0D0D] shadow-[0_0_28px_rgba(250,250,250,0.18)] ${className}`}
      style={{
        ...(size ? { width: `${size}px`, height: `${size}px` } : {}),
        filter: "drop-shadow(0px 0px 24px rgba(250, 250, 250, 0.22))",
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

      {/* 2. OVERLAY RADAR SUTIL */}
      <div className="absolute inset-0 rounded-full border border-white/10 pointer-events-none" />

      {/* 3. LÍNEA VERTICAL DISCONTINUA (Posición en % relativa al contenedor) */}
      <div
        className="absolute top-0 bottom-0 w-0 border-l-2 border-dashed border-[#A6948A] pointer-events-none transition-all duration-500 ease-out z-10"
        style={{
          left: `${targetXPct}%`,
        }}
      />

      {/* 4. LÍNEA HORIZONTAL DISCONTINUA (Posición en % relativa al contenedor) */}
      <div
        className="absolute left-0 right-0 h-0 border-t-2 border-dashed border-[#A6948A] pointer-events-none transition-all duration-500 ease-out z-10"
        style={{
          top: `${targetYPct}%`,
        }}
      />

      {/* 5. RECUADRO DE ZONA ACTIVA (Dimensiones y posición en % relativas al contenedor) */}
      <div
        className="absolute box-border bg-[#D9CEC5]/75 border-2 border-[#A6948A] pointer-events-none transition-all duration-500 ease-out z-20 shadow-[0_0_10px_rgba(217,206,197,0.4)]"
        style={{
          width: `${rectWidthPct}%`,
          height: `${rectHeightPct}%`,
          left: `${rectLeftPct}%`,
          top: `${rectTopPct}%`,
        }}
      />

      {/* 6. PUNTOS DE SITIOS CANDIDATOS (Marcadores polares interactivos en %) */}
      {siteCoordinates.map(({ site, x, y }) => {
        const isActive = site.id === currentSiteId;

        return (
          <button
            key={site.id}
            type="button"
            onClick={() => onSelectSite?.(site.id)}
            title={`${site.name} (${Math.abs(site.coordinates.lat)}°S, ${site.coordinates.lng}°E)`}
            className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform duration-300 z-30 group cursor-pointer focus:outline-none ${
              isActive ? "scale-125" : "hover:scale-150"
            }`}
            style={{
              left: `${x}%`,
              top: `${y}%`,
            }}
          >
            <span
              className={`block rounded-full ${
                isActive
                  ? "w-[clamp(7px,1vh,10px)] h-[clamp(7px,1vh,10px)] bg-[#FFFFFF] shadow-[0_0_8px_#FFFFFF] ring-2 ring-[#A6948A]"
                  : "w-[clamp(4px,0.65vh,6px)] h-[clamp(4px,0.65vh,6px)] bg-[#FAFAFA]/90 shadow-[0_0_5px_#FAFAFA]"
              }`}
            />
          </button>
        );
      })}
    </div>
  );
};

export default SouthPoleMinimap;
