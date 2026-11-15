"use client";

import React, { useMemo } from "react";
import { Line, Text } from "@react-three/drei";
import * as THREE from "three";
import { useSiteContext, type PresetSite } from "@/lib/context/SiteContext";
import { TERRAIN, latLonToPlane } from "@/lib/geo/polarStereo";
import { useTerrainHeight } from "@/lib/geo/useTerrainHeight";
import { SPACE_MONO_TTF } from "@/components/3d_canvas/EarthVector";

export interface DataLayersProps {
  /** Sitio activo opcional por prop; si se omite, se lee de useSiteContext(). */
  selectedSite?: PresetSite | null;
  /** Lado de las capas cuadradas de análisis (por defecto 30 u = 270 km). */
  layerSize?: number;
  terrainSize?: number;
  visible?: boolean;
  /** Color temático del aro superior según el estado de la zona ("#34d399" óptimo, "#fbbf24" marginal, "#fb7185" crítico). */
  statusColor?: string;
}

/**
 * Capas de Datos Holográficas ("Stacked Layers")
 * ----------------------------------------------
 * Cuando hay un sitio seleccionado, apila verticalmente 3 capas de análisis
 * científico en (x, 0, z) del sitio y proyecta líneas discontinuas en las
 * 4 esquinas hacia el relieve topográfico.
 */
export const DataLayers: React.FC<DataLayersProps> = ({
  selectedSite: selectedSiteProp,
  layerSize = 30,
  terrainSize = TERRAIN.size,
  visible = true,
  statusColor = "#D9CEC5",
}) => {
  const { selectedSite: contextSite } = useSiteContext();
  const activeSite = selectedSiteProp !== undefined ? selectedSiteProp : contextSite;
  const heightAt = useTerrainHeight();

  const siteCoords = useMemo(() => {
    if (!activeSite) return null;
    const p = latLonToPlane(activeSite.lat, activeSite.lon, terrainSize);
    if (!p.inside) return null;
    return p;
  }, [activeSite, terrainSize]);

  // Capa 1 (y = 10): GridHelper 30x30 (#7F7B8C / #3B3B40 - Lunar Slate & Charcoal)
  const baseGrid = useMemo(() => {
    const g = new THREE.GridHelper(layerSize, 30, "#7F7B8C", "#3B3B40");
    const mats = Array.isArray(g.material) ? g.material : [g.material];
    mats.forEach((m) => {
      m.transparent = true;
      m.opacity = 0.38;
      m.depthWrite = false;
      m.toneMapped = false;
    });
    return g;
  }, [layerSize]);

  // Capa 2 (y = 15): Plano térmico/radar transparente + borde brillante (EdgesGeometry) + sub-grid fino (#A6948A / #3B3B40)
  const radarGrid = useMemo(() => {
    const g = new THREE.GridHelper(layerSize, 15, "#A6948A", "#3B3B40");
    const mats = Array.isArray(g.material) ? g.material : [g.material];
    mats.forEach((m) => {
      m.transparent = true;
      m.opacity = 0.28;
      m.depthWrite = false;
      m.toneMapped = false;
    });
    return g;
  }, [layerSize]);

  const planeGeo = useMemo(() => new THREE.PlaneGeometry(layerSize, layerSize), [layerSize]);
  const edgesGeo = useMemo(() => new THREE.EdgesGeometry(planeGeo), [planeGeo]);

  // Capa 3 (y = 20): Capa superior de telemetría orbital / cobertura DTE
  const topRingGeo = useMemo(
    () => new THREE.RingGeometry(layerSize * 0.34, layerSize * 0.35, 64),
    [layerSize]
  );

  // Esquinas en coordenadas locales del grupo (centrado en siteCoords.x, 0, siteCoords.z)
  const corners = useMemo(() => {
    if (!siteCoords) return [];
    const half = layerSize / 2;
    const offsets: [number, number][] = [
      [-half, -half],
      [half, -half],
      [half, half],
      [-half, half],
    ];
    return offsets.map(([dx, dz]) => {
      const wx = siteCoords.x + dx;
      const wz = siteCoords.z + dz;
      const u = THREE.MathUtils.clamp(0.5 + wx / terrainSize, 0, 1);
      const v = THREE.MathUtils.clamp(0.5 - wz / terrainSize, 0, 1);
      const groundY = heightAt(u, v);
      return { dx, dz, groundY };
    });
  }, [siteCoords, layerSize, terrainSize, heightAt]);

  if (!visible || !siteCoords) return null;

  const half = layerSize / 2;

  return (
    <group position={[siteCoords.x, 0, siteCoords.z]}>
      {/* -------- CAPA 1 (y = 10): Malla de escaneo base -------- */}
      <primitive object={baseGrid} position={[0, 10, 0]} renderOrder={2} />
      <Text
        font={SPACE_MONO_TTF}
        position={[-half, 10.35, half + 0.8]}
        fontSize={0.55}
        color="#D9CEC5"
        anchorX="left"
        anchorY="middle"
      >
        L01 // TOPO-SCAN [10u]
      </Text>

      {/* -------- CAPA 2 (y = 15): Capa térmica / radar con borde brillante -------- */}
      <group position={[0, 15, 0]}>
        <mesh geometry={planeGeo} rotation={[-Math.PI / 2, 0, 0]} renderOrder={3}>
          <meshBasicMaterial
            color="#D9CEC5"
            transparent
            opacity={0.07}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
        <lineSegments geometry={edgesGeo} rotation={[-Math.PI / 2, 0, 0]} renderOrder={4}>
          <lineBasicMaterial color="#A6948A" transparent opacity={0.85} toneMapped={false} />
        </lineSegments>
        <primitive object={radarGrid} renderOrder={3} />
        <Text
          font={SPACE_MONO_TTF}
          position={[-half, 0.35, half + 0.8]}
          fontSize={0.55}
          color="#A6948A"
          anchorX="left"
          anchorY="middle"
        >
          L02 // THERMAL-PSR [15u]
        </Text>
      </group>

      {/* -------- CAPA 3 (y = 20): Capa de contorno / telemetría orbital -------- */}
      <group position={[0, 20, 0]}>
        <mesh geometry={planeGeo} rotation={[-Math.PI / 2, 0, 0]} renderOrder={4}>
          <meshBasicMaterial
            color="#D9CEC5"
            transparent
            opacity={0.04}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
        <lineSegments geometry={edgesGeo} rotation={[-Math.PI / 2, 0, 0]} renderOrder={5}>
          <lineBasicMaterial color={statusColor} transparent opacity={0.65} toneMapped={false} />
        </lineSegments>
        <mesh geometry={topRingGeo} rotation={[-Math.PI / 2, 0, 0]} renderOrder={5}>
          <meshBasicMaterial
            color={statusColor}
            transparent
            opacity={0.85}
            depthWrite={false}
            side={THREE.DoubleSide}
            toneMapped={false}
          />
        </mesh>
        <Text
          font={SPACE_MONO_TTF}
          position={[-half, 0.35, half + 0.8]}
          fontSize={0.55}
          color={statusColor}
          anchorX="left"
          anchorY="middle"
        >
          L03 // ORBITAL-TELEMETRY [20u]
        </Text>
      </group>

      {/* -------- Líneas verticales discontinuas en las 4 esquinas -------- */}
      {corners.map(({ dx, dz, groundY }, idx) => (
        <Line
          key={idx}
          points={[
            [dx, groundY, dz],
            [dx, 20, dz],
          ]}
          color="#A6948A"
          lineWidth={1.3}
          dashed
          dashSize={0.6}
          gapSize={0.4}
          transparent
          opacity={0.75}
          toneMapped={false}
        />
      ))}
    </group>
  );
};

export default DataLayers;
