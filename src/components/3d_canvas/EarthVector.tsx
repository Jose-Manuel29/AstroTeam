"use client";

import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Line, Text } from "@react-three/drei";
import * as THREE from "three";
import { useSiteContext, type PresetSite } from "@/lib/context/SiteContext";
import { TERRAIN, latLonToPlane } from "@/lib/geo/polarStereo";
import { useTerrainHeight } from "@/lib/geo/useTerrainHeight";

export const SPACE_MONO_TTF = "/fonts/SpaceMono-Regular.ttf";

export interface EarthVectorProps {
  /** Sitio activo opcional por prop; si se omite, se lee de useSiteContext(). */
  selectedSite?: PresetSite | null;
  /** Punto de partida por defecto cuando no hay sitio seleccionado. */
  origin?: [number, number, number];
  /**
   * Posición/dirección de la Tierra en coordenadas de escena.
   * PROVISIONAL: el backend (ephemeris.py → sub_earth_lat/lon) proveerá el valor real.
   */
  targetPosition?: [number, number, number];
  terrainSize?: number;
  color?: THREE.ColorRepresentation;
  label?: string;
  lineWidth?: number;
  dashSize?: number;
  gapSize?: number;
  /** Velocidad del flujo animado de los guiones (0 = estático). */
  flowSpeed?: number;
  visible?: boolean;
}

/**
 * Vector de línea de vista hacia la Tierra (Direct-To-Earth, DTE).
 * - Si hay un `selectedSite` en contexto, nace exactamente de la coordenada (x, y, z)
 *   de ese cráter sobre el relieve.
 * - Línea discontinua animada + punta de flecha + etiqueta "TIERRA" (Space Mono).
 */
export const EarthVector: React.FC<EarthVectorProps> = ({
  selectedSite: selectedSiteProp,
  origin = [0, 0, 0],
  targetPosition = [40, 50, -30],
  terrainSize = TERRAIN.size,
  color = "#38bdf8",
  label = "TIERRA",
  lineWidth = 1.6,
  dashSize = 1.2,
  gapSize = 0.8,
  flowSpeed = 2,
  visible = true,
}) => {
  const { selectedSite: contextSite } = useSiteContext();
  const activeSite = selectedSiteProp !== undefined ? selectedSiteProp : contextSite;
  const heightAt = useTerrainHeight();
  const lineRef = useRef<any>(null);

  const dynamicOrigin = useMemo<[number, number, number]>(() => {
    if (activeSite) {
      const p = latLonToPlane(activeSite.lat, activeSite.lon, terrainSize);
      if (p.inside) {
        const y = heightAt(p.u, p.v);
        return [p.x, y, p.z];
      }
    }
    return origin;
  }, [activeSite, terrainSize, heightAt, origin]);

  const { start, end, dir, length } = useMemo(() => {
    const s = new THREE.Vector3(...dynamicOrigin);
    const e = new THREE.Vector3(...targetPosition);
    const d = e.clone().sub(s);
    return { start: s, end: e, dir: d.clone().normalize(), length: d.length() };
  }, [dynamicOrigin, targetPosition]);

  // Orientación de la punta (cono apunta en +Y por defecto)
  const tipQuaternion = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir),
    [dir]
  );
  const labelPos = useMemo(() => end.clone().add(dir.clone().multiplyScalar(2.2)), [end, dir]);

  // Flujo de los guiones desde el sitio lunar hacia la Tierra
  useFrame((_, delta) => {
    const mat = lineRef.current?.material;
    if (mat && flowSpeed) mat.dashOffset -= delta * flowSpeed;
  });

  if (!visible || length === 0) return null;

  return (
    <group>
      <Line
        ref={lineRef}
        points={[start, end]}
        color={color}
        lineWidth={lineWidth}
        dashed
        dashSize={dashSize}
        gapSize={gapSize}
        transparent
        opacity={0.95}
        toneMapped={false}
      />

      {/* Punta de flecha */}
      <mesh position={end} quaternion={tipQuaternion}>
        <coneGeometry args={[0.45, 1.4, 12]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>

      {/* Nodo de origen en el cráter seleccionado */}
      <mesh position={start}>
        <sphereGeometry args={[0.25, 16, 16]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>

      <Billboard position={labelPos}>
        <Text
          font={SPACE_MONO_TTF}
          fontSize={1.6}
          color={color}
          anchorX="center"
          anchorY="middle"
          letterSpacing={0.15}
          outlineWidth={0.06}
          outlineColor="#000000"
        >
          {label}
        </Text>
      </Billboard>
    </group>
  );
};

export default EarthVector;
