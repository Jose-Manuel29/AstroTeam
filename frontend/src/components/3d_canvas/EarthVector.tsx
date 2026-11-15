"use client";

import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html, Line } from "@react-three/drei";
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
  /** Desplazamiento desde el sitio hacia la Tierra en coordenadas de escena. */
  targetDirection?: [number, number, number];
  terrainSize?: number;
  color?: THREE.ColorRepresentation;
  label?: string;
  lineWidth?: number;
  dashSize?: number;
  gapSize?: number;
  /** Velocidad del flujo animado de los guiones (0 = estático). */
  flowSpeed?: number;
  visible?: boolean;
  /** Indica si hay enlace de comunicación directa con la Tierra (LoS). */
  isConnected?: boolean;
  /** Etiqueta que se muestra cuando no hay comunicación (en inglés). */
  disconnectedLabel?: string;
}

/**
 * Vector de línea de vista hacia la Tierra (Direct-To-Earth, DTE).
 * - Si isConnected es true (o hay visibilidad): haz vectorial discontinuo azul hacia la Tierra.
 * - Si isConnected es false (o no hay visibilidad / sin enlace): trayectoria parabólica roja
 *   que nace del sitio y cae por el borde del mapa con la etiqueta "NO DTE LINK".
 */
export const EarthVector: React.FC<EarthVectorProps> = ({
  selectedSite: selectedSiteProp,
  origin = [0, 0, 0],
  targetDirection = [0, 0, 0],
  terrainSize = TERRAIN.size,
  color = "#38BDF8",
  label = "EARTH",
  lineWidth = 1.6,
  dashSize = 1.2,
  gapSize = 0.8,
  flowSpeed = 2,
  visible = true,
  isConnected = true,
  disconnectedLabel = "NO DTE LINK",
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
    const e = s.clone().add(new THREE.Vector3(...targetDirection));
    const d = e.clone().sub(s);
    return { start: s, end: e, dir: d.clone().normalize(), length: d.length() };
  }, [dynamicOrigin, targetDirection]);

  // Orientación de la punta (cono apunta en +Y por defecto)
  const tipQuaternion = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir),
    [dir]
  );
  // Posicionada al doble de distancia sobre la superficie lunar (~11.0 u) a lo largo del haz hacia la Tierra
  const labelPos = useMemo(() => {
    const offsetDistance = Math.min(11.0, length * 0.44);
    return start.clone().add(dir.clone().multiplyScalar(offsetDistance));
  }, [start, dir, length]);

  // Flujo de los guiones desde el sitio lunar hacia la Tierra
  useFrame((_, delta) => {
    const mat = lineRef.current?.material;
    if (mat && flowSpeed) mat.dashOffset -= delta * flowSpeed;
  });

  // Cálculo de la parábola roja cuando NO hay comunicación con la Tierra:
  // Parte del origen dinámico, se eleva suavemente y decae curvándose hacia el borde del terreno
  const disconnectedTrajectory = useMemo(() => {
    if (isConnected) return null;

    const s = new THREE.Vector3(...dynamicOrigin);
    // Dirección horizontal hacia el borde del mapa
    let horizontalDir = new THREE.Vector2(s.x, s.z);
    if (horizontalDir.lengthSq() < 1e-4) {
      horizontalDir = new THREE.Vector2(0, 1);
    } else {
      horizontalDir.normalize();
    }

    // Si hay targetDirection con componente horizontal, dirigir la caída en esa dirección hacia el horizonte
    const targetH = new THREE.Vector2(targetDirection[0], targetDirection[2]);
    if (targetH.lengthSq() > 1e-4) {
      horizontalDir = targetH.normalize();
    }

    const halfSpan = (terrainSize / 2) * 1.05;
    // Distancia hasta caer por el borde exterior
    const distanceToEdge = Math.max(22, halfSpan - Math.hypot(s.x, s.z) + 12);

    const points: [number, number, number][] = [];
    const segments = 36;
    const apexHeight = 5.5; // Cúspide de la parábola sobre el terreno
    const fallDepth = -16.0; // Caída por debajo del faldón del pedestal

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const x = s.x + horizontalDir.x * distanceToEdge * t;
      const z = s.z + horizontalDir.y * distanceToEdge * t;
      // Curva parabólica: elevación inicial que decae fuertemente al acercarse al borde
      const y = s.y + apexHeight * 4 * t * (1 - t * 1.35) + fallDepth * Math.pow(t, 2.8);
      points.push([x, y, z]);
    }

    // Posición del tag flotante en el tercio superior de la trayectoria parabólica
    const labelIdx = Math.floor(segments * 0.35);
    const labelVector = new THREE.Vector3(...points[labelIdx]);

    return { points, labelVector, endPoint: points[points.length - 1] };
  }, [isConnected, dynamicOrigin, targetDirection, terrainSize]);

  if (!visible) return null;

  // CASO A: Sin comunicación directa con la Tierra (Parábola roja descendente con tag de alerta)
  if (!isConnected) {
    if (!disconnectedTrajectory) return null;
    const { points, labelVector } = disconnectedTrajectory;

    return (
      <group>
        <Line
          ref={lineRef}
          points={points}
          color="#FB7185"
          lineWidth={lineWidth * 1.15}
          dashed
          dashSize={dashSize * 0.9}
          gapSize={gapSize * 0.9}
          transparent
          opacity={0.92}
          toneMapped={false}
        />

        {/* Nodo de origen en el sitio */}
        <mesh position={start}>
          <sphereGeometry args={[0.26, 16, 16]} />
          <meshBasicMaterial color="#FB7185" toneMapped={false} />
        </mesh>

        {/* Tag de alerta roja "NO DTE LINK / NO DIRECT COMMUNICATION" */}
        <Html
          position={labelVector}
          center
          zIndexRange={[5, 0]}
          style={{ pointerEvents: "none" }}
        >
          <div className="flex items-center gap-1.5 whitespace-nowrap px-2.5 py-0.5 rounded-full bg-[#0D0D0D]/95 border border-[#FB7185]/70 backdrop-blur-md shadow-[0_0_16px_rgba(251,113,133,0.5)] select-none pointer-events-none">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FB7185] shadow-[0_0_8px_#FB7185] animate-pulse inline-block" />
            <span className="font-heading font-bold text-[10.5px] tracking-wider uppercase text-[#FB7185]">
              {disconnectedLabel}
            </span>
          </div>
        </Html>
      </group>
    );
  }

  // CASO B: Enlace activo y visible hacia la Tierra
  if (length === 0) return null;

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

      {/* Leyenda interactiva visible más abajo a lo largo del haz con viñeta circular resaltada */}
      <Html
        position={labelPos}
        center
        zIndexRange={[5, 0]}
        style={{ pointerEvents: "none" }}
      >
        <div className="flex items-center gap-1.5 whitespace-nowrap px-2.5 py-0.5 rounded-full bg-[#0D0D0D]/90 border border-[#38BDF8]/60 backdrop-blur-md shadow-[0_0_14px_rgba(56,189,248,0.45)] select-none pointer-events-none">
          <span className="font-heading font-bold text-[11px] tracking-widest uppercase text-[#38BDF8]">
            {label}
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-[#38BDF8] shadow-[0_0_8px_#38BDF8] inline-block" />
        </div>
      </Html>
    </group>
  );
};

export default EarthVector;
