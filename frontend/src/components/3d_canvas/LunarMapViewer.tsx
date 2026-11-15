"use client";

import React, { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import { useSiteContext, type PresetSite } from "@/lib/context/SiteContext";
import { TERRAIN } from "@/lib/geo/polarStereo";
import { DynamicSun } from "@/components/3d_canvas/DynamicSun";
import { LunarSurface, type DioramaCutoutShape } from "@/components/3d_canvas/LunarSurface";
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
  /** Forma geométrica del recorte del diorama aislado ("square" por defecto, o "circle") */
  cutoutShape?: DioramaCutoutShape;
  /** Rotación fija del bloque topográfico en radianes [X, Y, Z] */
  rotation?: [number, number, number];
}

/** Configuración de la iluminación solar y ambiental */
export interface SunConfig {
  /** Azimut solar en grados (0 - 360) */
  angle?: number;
  radius?: number;
  height?: number;
  intensity?: number;
  ambientIntensity?: number;
  shadowExtent?: number;
}

/** Vector de línea de vista hacia la Tierra */
export interface EarthConfig {
  visible?: boolean;
  origin?: [number, number, number];
  /** PROVISIONAL hasta recibir la efeméride real del backend. */
  targetPosition?: [number, number, number];
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
  target?: [number, number, number];
  fov?: number;
  near?: number;
  far?: number;
  flyOffset?: [number, number, number];
  lerpFactor?: number;
  minDistance?: number;
  maxDistance?: number;
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
  const terrainRotation: [number, number, number] = terrain?.rotation ?? [0, 0, 0];
  const camTarget: [number, number, number] = camera?.target ?? [0, -10, 0];
  const initialCamPos: [number, number, number] = camera?.initialPosition ?? [0, 52, 95];

  return (
    <div className={className}>
      <Canvas
        shadows
        gl={{ alpha: true, antialias: true }}
        camera={{
          position: initialCamPos,
          fov: camera?.fov ?? 40,
          near: camera?.near ?? 0.1,
          far: camera?.far ?? 1000,
        }}
      >
        <ambientLight intensity={sun?.ambientIntensity ?? 0.1} />
        <DynamicSun
          sunAngle={sun?.angle ?? 0}
          radius={sun?.radius ?? 80}
          height={sun?.height ?? 18}
          intensity={sun?.intensity ?? 2.8}
          shadowExtent={sun?.shadowExtent ?? 75}
        />

        {showStars && <Stars radius={200} depth={50} count={3000} factor={3} fade />}

        <HoloGrid
          visible={(grid?.visible ?? true) && !activeSite}
          size={terrainSize}
          divisions={grid?.divisions ?? 50}
          height={grid?.height ?? 25}
          opacity={grid?.opacity ?? 0.14}
          centerColor={grid?.centerColor ?? "#A6948A"}
          gridColor={grid?.gridColor ?? "#3B3B40"}
        />

        <Suspense fallback={null}>
          <group rotation={terrainRotation}>
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
              targetPosition={earth?.targetPosition ?? [40, 50, -30]}
              terrainSize={terrainSize}
              color={earth?.color ?? "#D9CEC5"}
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
              cutoutShape={terrain?.cutoutShape ?? "square"}
              showPedestal={terrain?.showPedestal}
              pedestalDepth={terrain?.pedestalDepth}
              pedestalColor={terrain?.pedestalColor ?? "#0D0D0D"}
              onLoaded={onLoaded}
            >
              <SiteZonesOverlay
                sites={sites}
                selectedId={activeSite?.id}
                visible={zones?.visible ?? true}
                color={zones?.color ?? "#D9CEC5"}
                edgeOpacity={zones?.edgeOpacity ?? 0.8}
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
          </group>

          <FlyToController
            site={activeSite}
            flightId={flightId}
            offset={camera?.flyOffset ?? [6, 8, 10]}
            lerpFactor={camera?.lerpFactor ?? 0.06}
            overviewCamera={initialCamPos}
            overviewTarget={camTarget}
          />

          {children}
        </Suspense>

        <OrbitControls
          makeDefault
          enableDamping
          target={camTarget}
          minDistance={camera?.minDistance ?? 40}
          maxDistance={camera?.maxDistance ?? 160}
          maxPolarAngle={Math.PI / 2.05}
        />
      </Canvas>
    </div>
  );
};

export default LunarMapViewer;
