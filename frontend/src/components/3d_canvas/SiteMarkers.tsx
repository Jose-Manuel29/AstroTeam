"use client";

import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { PresetSite } from "@/lib/context/SiteContext";
import { latLonToPlane, type PlaneCoords } from "@/lib/geo/polarStereo";
import { useTerrainHeight } from "@/lib/geo/useTerrainHeight";

export interface SiteMarkersProps {
  sites: PresetSite[];
  selectedId?: string | null;
  poleHeight?: number;
  visible?: boolean;
  onSelectSite?: (site: PresetSite) => void;
}

interface SiteMarkerItemProps {
  site: PresetSite;
  p: PlaneCoords;
  y: number;
  active: boolean;
  poleHeight: number;
  onSelectSite?: (site: PresetSite) => void;
}

/**
 * Elemento individual de marcador:
 * - Poste vertical blanco esbelto
 * - Etiqueta flotante sin fondo, sin recuadros ni puntos
 * - Fuente Space Mono Regular 400
 * - Ancho fijado en 10 rem (160px) con texto centrado
 * - Tamaño de los KM calculado en proporción (em) al rem del título
 * - zIndexRange acotado a [5, 0] para no sobreponerse a los menús de la interfaz
 * - Control de zoom: no usa distanceFactor desbordante; escala acotada que se reduce al acercarse
 */
const SiteMarkerItem: React.FC<SiteMarkerItemProps> = ({
  site,
  p,
  y,
  active,
  poleHeight,
  onSelectSite,
}) => {
  const [isHovered, setIsHovered] = React.useState(false);
  const currentHeight = active ? poleHeight * 1.35 : poleHeight;
  const radius = 0.025; // grosor (diámetro) = 0.05

  const htmlRef = useRef<HTMLDivElement>(null);

  const markerPosition = useMemo(
    () => new THREE.Vector3(p.x, y + currentHeight, p.z),
    [p.x, y, p.z, currentHeight]
  );

  // Control estricto de escala al acercarse o alejarse
  useFrame(({ camera }) => {
    if (!htmlRef.current) return;
    const distance = camera.position.distanceTo(markerPosition);
    const dynamicScale = THREE.MathUtils.clamp(distance / 30, 0.75, 1.1);
    htmlRef.current.style.transform = `scale(${dynamicScale})`;
  });

  const isViable = site.isViable !== false;
  const tier = site.viabilityTier ?? (isViable ? "optimal" : "critical");

  return (
    <group position={[p.x, y, p.z]}>
      {/* Mástil / poste vertical en crema lunar */}
      <mesh position={[0, currentHeight / 2, 0]}>
        <cylinderGeometry args={[radius, radius, currentHeight, 8]} />
        <meshStandardMaterial
          color="#D9CEC5"
          emissive="#A6948A"
          emissiveIntensity={0.8}
          roughness={0.25}
          metalness={0.05}
          toneMapped={false}
        />
      </mesh>

      {/* Nodo esférico luminoso en la unión del poste con la etiqueta */}
      <mesh position={[0, currentHeight, 0]}>
        <sphereGeometry args={[radius * 1.5, 12, 12]} />
        <meshBasicMaterial
          color={
            tier === "optimal"
              ? "#34d399"
              : tier === "marginal"
              ? "#fbbf24"
              : "#fb7185"
          }
        />
      </mesh>

      {/* Etiqueta HTML idéntica a la cápsula de MoonGlobe:
          misma forma rounded-full, tipografía Inter, padding, fondo con glassmorphism,
          indicador circular del estado de viabilidad e interacción hover/active */}
      <Html
        position={[0, currentHeight + 0.35, 0]}
        center
        zIndexRange={[5, 0]}
        style={{ pointerEvents: onSelectSite ? "auto" : "none" }}
      >
        <div
          ref={htmlRef}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={(e) => {
            e.stopPropagation();
            onSelectSite?.(site);
          }}
          className="p-1 cursor-pointer select-none origin-bottom transition-transform duration-150"
        >
          <div
            className={`px-3 py-1 rounded-full border backdrop-blur-md transition-all duration-200 whitespace-nowrap shadow-lg flex items-center gap-1.5 cursor-pointer ${
              isHovered
                ? "bg-[#FAF9F7] text-[#09080C] border-white scale-105 font-bold shadow-white/30 ring-2 ring-white/50"
                : active
                ? "bg-[#D9CEC5]/95 text-[#09080C] border-white font-medium scale-105"
                : "bg-[#0D0D0D]/85 text-[#FAFAFA] border-white/30 font-normal hover:bg-[#1C1C20] hover:border-white/60"
            }`}
          >
            {/* Punto indicador de estatus idéntico a MoonGlobe */}
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                tier === "optimal"
                  ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]"
                  : tier === "marginal"
                  ? "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]"
                  : "bg-rose-400 shadow-[0_0_6px_rgba(251,113,133,0.8)]"
              }`}
            />
            <span className="font-sans text-[11.5px] leading-tight tracking-tight">
              {site.name}
            </span>
          </div>
        </div>
      </Html>
    </group>
  );
};

/** Marcadores físicos lineales sobre el relieve con etiquetas de telemetría */
export const SiteMarkers: React.FC<SiteMarkersProps> = ({
  sites,
  selectedId,
  poleHeight = 2.5,
  visible = true,
  onSelectSite,
}) => {
  const heightAt = useTerrainHeight();

  const markers = useMemo(
    () =>
      sites
        .map((site) => ({ site, p: latLonToPlane(site.lat, site.lon) }))
        .filter(({ p }) => p.inside)
        .map((m) => ({ ...m, y: heightAt(m.p.u, m.p.v) })),
    [sites, heightAt]
  );

  if (!visible) return null;

  return (
    <group>
      {markers
        .filter(({ site }) => !selectedId || site.id === selectedId)
        .map(({ site, p, y }) => (
          <SiteMarkerItem
            key={site.id}
            site={site}
            p={p}
            y={y}
            active={site.id === selectedId}
            poleHeight={poleHeight}
            onSelectSite={onSelectSite}
          />
        ))}
    </group>
  );
};

export default SiteMarkers;
