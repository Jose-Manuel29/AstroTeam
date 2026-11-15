"use client";

import React, { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import { useSiteContext, type PresetSite } from "@/lib/context/SiteContext";
import { TERRAIN } from "@/lib/geo/polarStereo";
import { DynamicSun } from "@/components/3d_canvas/DynamicSun";
import { LunarSurface } from "@/components/3d_canvas/LunarSurface";
import { SiteMarkers } from "@/components/3d_canvas/SiteMarkers";
import { SiteZonesOverlay } from "@/components/3d_canvas/SiteZonesOverlay";
import { FlyToController } from "@/components/3d_canvas/FlyToController";
import { EarthVector } from "@/components/3d_canvas/EarthVector";
import { HoloGrid } from "@/components/3d_canvas/HoloGrid";
import { DataLayers } from "@/components/3d_canvas/DataLayers";

/** Configuración de las Mallas de Zona (SiteZonesOverlay) */
export interface ZoneConfig {
  visible?: boolean;
  /** Color de la zona (hex). Ej: "#FF9F1C" */
  color?: string;
  /** Opacidad máxima en el borde (0 a 1). */
  edgeOpacity?: number;
  /** Elevación sobre el terreno (si se omite, usa zoneOffset del SiteContext). */
  offset?: number;
  /** Multiplicador de los tamaños de zona (tabla km/9). */
  sizeScale?: number;
  /** Sobrescritura de tamaño (unidades) por ID de sitio */
  sizeOverrides?: Record<string, number>;
  /** Exponente de curvatura del gradiente del shader */
  gradientPower?: number;
  /** Brillo emisivo base (0.8 por defecto para resaltar como interfaz holográfica en PSR) */
  emissiveIntensity?: number;
}

/** Configuración de los marcadores físicos (postes) */
export interface MarkerConfig {
  visible?: boolean;
  poleHeight?: number;
}

/** Configuración de la topografía, material y pedestal del terreno lunar */
export interface TerrainConfig {
  size?: number;
  segments?: number;
  displacementScale?: number;
  displacementBias?: number;
  normalScale?: number;
  roughness?: number;
  metalness?: number;
  wireframe?: boolean;
  mapUrl?: string;
  demUrl?: string;
  normalUrl?: string;
  showPedestal?: boolean;
  pedestalDepth?: number;
  pedestalColor?: string;
  /** Radio del recorte del diorama holográfico en unidades (por defecto 15.0 = 135 km) */
  focusRadius?: number;
}

/** Configuración de la iluminación solar y ambiental */
export interface SunConfig {
  /** Azimut solar en grados (0 - 360) */
  angle?: number;
  elevationDeg?: number;
  visible?: boolean;
  radius?: number;
  intensity?: number;
  ambientIntensity?: number;
  shadowExtent?: number;
}

/** Vector de línea de vista hacia la Tierra */
export interface EarthConfig {
  visible?: boolean;
  origin?: [number, number, number];
  direction?: [number, number, number];
  color?: string;
  label?: string;
}

/** Capa de datos holográfica flotante */
export interface GridConfig {
  visible?: boolean;
  height?: number;
  opacity?: number;
  divisions?: number;
  centerColor?: string;
  gridColor?: string;
}

/** Configuración de cámara y navegación */
export interface CameraConfig {
  initialPosition?: [number, number, number];
  fov?: number;
  near?: number;
  far?: number;
  flyOffset?: [number, number, number];
  lerpFactor?: number;
}

export interface LunarMapViewerProps {
  sites: PresetSite[];
  selectedSite?: PresetSite | null;
  onSelectSite?: (site: PresetSite) => void;
  flightId?: number;
  zones?: ZoneConfig;
  markers?: MarkerConfig;
  terrain?: TerrainConfig;
  sun?: SunConfig;
  earth?: EarthConfig;
  grid?: GridConfig;
  camera?: CameraConfig;
  showStars?: boolean;
  className?: string;
  onLoaded?: () => void;
  children?: React.ReactNode;
}

/**
 * LunarMapViewer
 * --------------
 * Componente maestro de la escena 3D lunar. Todos sus elementos (zonas, marcadores,
 * terreno/pedestal, sol, vector Tierra, rejilla holográfica y cámara) son
 * configurables desde afuera vía props o mediante SiteContext.
 */
export const LunarMapViewer: React.FC<LunarMapViewerProps> = ({
  sites,
  selectedSite: selectedSiteProp,
  onSelectSite,
  flightId = 0,
  zones,
  markers,
  terrain,
  sun,
  earth,
  grid,
  camera,
  showStars = false,
  className = "relative w-full h-full bg-transparent",
  onLoaded,
  children,
}) => {
  const { selectedSite: contextSite } = useSiteContext();
  const activeSite = selectedSiteProp !== undefined ? selectedSiteProp : contextSite;

  const terrainSize = terrain?.size ?? TERRAIN.size;
  const terrainSegments = terrain?.segments ?? TERRAIN.segments;
  const displacementScale = terrain?.displacementScale ?? TERRAIN.displacementScale;
  const displacementBias = terrain?.displacementBias ?? TERRAIN.displacementBias;

  return (
    <div className={className}>
      <Canvas
        shadows
        gl={{ alpha: true, antialias: true }}
        camera={{
          position: camera?.initialPosition ?? [0, 50, 100],
          fov: camera?.fov ?? 45,
          near: camera?.near ?? 0.1,
          far: camera?.far ?? 1000,
        }}
      >
        <ambientLight intensity={sun?.ambientIntensity ?? 0.1} />
        <DynamicSun
          sunAngle={sun?.angle ?? 0}
          elevationDeg={sun?.elevationDeg ?? 5.7}
          siteLongitudeDeg={activeSite?.lon ?? 0}
          radius={sun?.radius ?? 80}
          intensity={sun?.intensity ?? 2}
          shadowExtent={sun?.shadowExtent ?? 75}
          visible={sun?.visible ?? true}
        />

        {showStars && <Stars radius={200} depth={50} count={3000} factor={3} fade />}

        <HoloGrid
          visible={(grid?.visible ?? true) && !activeSite}
          size={terrainSize}
          divisions={grid?.divisions ?? 50}
          height={grid?.height ?? 25}
          opacity={grid?.opacity ?? 0.12}
          centerColor={grid?.centerColor ?? "#00ffff"}
          gridColor={grid?.gridColor ?? "#004444"}
        />

        <Suspense fallback={null}>
          {/* Capas de datos apiladas sobre el sitio seleccionado (Diorama Holográfico) */}
          <DataLayers
            selectedSite={activeSite}
            terrainSize={terrainSize}
            visible={grid?.visible ?? true}
          />

          <EarthVector
            selectedSite={activeSite}
            visible={earth?.visible ?? true}
            origin={earth?.origin ?? [0, 0, 0]}
            targetDirection={earth?.direction ?? [0, 0, 0]}
            terrainSize={terrainSize}
            color={earth?.color ?? "#38bdf8"}
            label={earth?.label ?? "TIERRA"}
          />

          <LunarSurface
            size={terrainSize}
            segments={terrainSegments}
            displacementScale={displacementScale}
            displacementBias={displacementBias}
            normalScale={terrain?.normalScale}
            roughness={terrain?.roughness}
            metalness={terrain?.metalness}
            wireframe={terrain?.wireframe}
            mapUrl={terrain?.mapUrl}
            demUrl={terrain?.demUrl}
            normalUrl={terrain?.normalUrl}
            selectedSite={activeSite}
            focusRadius={terrain?.focusRadius ?? 15.0}
            showPedestal={terrain?.showPedestal}
            pedestalDepth={terrain?.pedestalDepth}
            pedestalColor={terrain?.pedestalColor}
            onLoaded={onLoaded}
          >
            <SiteZonesOverlay
              sites={sites}
              selectedId={activeSite?.id}
              visible={zones?.visible ?? true}
              color={zones?.color ?? "#FF9F1C"}
              edgeOpacity={zones?.edgeOpacity ?? 0.7}
              offset={zones?.offset}
              sizeScale={zones?.sizeScale ?? 1.0}
              sizeOverrides={zones?.sizeOverrides}
              terrainSize={terrainSize}
              terrainSegments={terrainSegments}
              displacementScale={displacementScale}
              displacementBias={displacementBias}
              gradientPower={zones?.gradientPower ?? 1.6}
              emissiveIntensity={zones?.emissiveIntensity ?? 0.8}
            />

            <SiteMarkers
              sites={sites}
              selectedId={activeSite?.id}
              visible={markers?.visible ?? true}
              poleHeight={markers?.poleHeight ?? 2}
              onSelectSite={onSelectSite}
            />
          </LunarSurface>

          <FlyToController
            site={activeSite}
            flightId={flightId}
            offset={camera?.flyOffset ?? [6, 8, 10]}
            lerpFactor={camera?.lerpFactor ?? 0.06}
          />

          {children}
        </Suspense>

        <OrbitControls makeDefault enableDamping />
      </Canvas>
    </div>
  );
};

export default LunarMapViewer;
