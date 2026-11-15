"use client";

import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { PresetSite } from "@/lib/context/SiteContext";
import { latLonToPlane, type PlaneCoords } from "@/lib/geo/polarStereo";
import { useTerrainHeight } from "@/lib/geo/useTerrainHeight";
import { getSiteZoneKm } from "@/components/3d_canvas/SiteZonesOverlay";

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
  const currentHeight = active ? poleHeight * 1.4 : poleHeight;
  const radius = 0.025; // grosor (diámetro) = 0.05

  const zoneKm = getSiteZoneKm(site.id);
  const htmlRef = useRef<HTMLDivElement>(null);

  const markerPosition = useMemo(
    () => new THREE.Vector3(p.x, y + currentHeight, p.z),
    [p.x, y, p.z, currentHeight]
  );

  // Control estricto de escala:
  // - A distancia normal/lejana se mantiene en escala 1.0 (nunca se sobredimensiona)
  // - Al acercarse mucho (< 25 u), se contrae suavemente hasta 0.70x para no tapar el cráter
  useFrame(({ camera }) => {
    if (!htmlRef.current) return;
    const distance = camera.position.distanceTo(markerPosition);
    const dynamicScale = THREE.MathUtils.clamp(distance / 25, 0.7, 1.0);
    htmlRef.current.style.transform = `scale(${dynamicScale})`;
  });

  return (
    <group position={[p.x, y, p.z]}>
      {/* Línea vertical blanca esbelta con emisividad */}
      <mesh position={[0, currentHeight / 2, 0]}>
        <cylinderGeometry args={[radius, radius, currentHeight, 8]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#ffffff"
          emissiveIntensity={2}
          roughness={0.2}
          metalness={0}
          toneMapped={false}
        />
      </mesh>

      {/* Etiqueta flotante: zIndexRange=[5, 0] para quedar siempre por debajo de menús (z-20/z-30) */}
      <Html
        position={[0, currentHeight + 0.35, 0]}
        center
        zIndexRange={[5, 0]}
        style={{ pointerEvents: onSelectSite ? "auto" : "none" }}
      >
        <div
          ref={htmlRef}
          onClick={() => onSelectSite?.(site)}
          className={`flex w-[10rem] flex-col items-center text-center font-mono font-normal select-none origin-bottom transition-all duration-150 ${
            onSelectSite ? "cursor-pointer" : ""
          }`}
          style={{
            textShadow:
              "0 0 3px #000000, 0 1px 5px #000000, 0 0 8px #000000, 0 0 14px rgba(0,0,0,0.95)",
          }}
        >
          {/* Nombre de la zona: fuente Space Mono Regular (400), ancho 10rem */}
          <span
            className={`block w-full break-words text-[0.75rem] font-normal leading-tight tracking-wider uppercase transition-colors ${
              active ? "text-cyan-300" : "text-white"
            }`}
          >
            {site.name}
          </span>

          {/* Tamaño en km: tamaño de fuente proporcional en 'em' respecto al rem del título */}
          <span
            className="block w-full font-normal tracking-widest text-amber-300/90 leading-tight mt-0.5"
            style={{ fontSize: "0.75em" }}
          >
            ⌀ {zoneKm} KM
          </span>
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
