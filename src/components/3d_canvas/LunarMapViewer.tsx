"use client";

import React, { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import type { PresetSite } from "@/lib/context/SiteContext";
import { DynamicSun } from "@/components/3d_canvas/DynamicSun";
import { LunarSurface } from "@/components/3d_canvas/LunarSurface";
import { SiteMarkers } from "@/components/3d_canvas/SiteMarkers";
import { SiteZonesOverlay } from "@/components/3d_canvas/SiteZonesOverlay";
import { FlyToController } from "@/components/3d_canvas/FlyToController";

/** Configuración de las Mallas de Zona (SiteZonesOverlay) inyectable desde afuera */
export interface ZoneConfig {
  visible?: boolean;
  /** Color de la zona (hex o RGB). Ej: "#FF9F1C" */
  color?: string;
  /** Opacidad máxima en el borde (0 a 1). Ej: 0.7 */
  edgeOpacity?: number;
  /** Desplazamiento vertical (offset / lift) sobre el terreno. Por defecto: 0.5 */
  offset?: number;
  /** Factor multiplicador de escala sobre los tamaños de zona dinámicos (por defecto 1.0) */
  sizeScale?: number;
  /** Sobrescritura de tamaño por ID de sitio */
  sizeOverrides?: Record<string, number>;
  /** Subdivisiones del plano de la zona */
  segments?: number;
  /** Exponente de curvatura del gradiente del shader */
  gradientPower?: number;
  /** Brillo emisivo base */
  emissiveIntensity?: number;
}

/** Configuración de los marcadores físicos (postes y esferas) */
export interface MarkerConfig {
  visible?: boolean;
  poleHeight?: number;
  colors?: string[];
}

/** Configuración de la topografía y material del terreno lunar */
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
  /** Lista de sitios lunares (preset_sites.json) */
  sites: PresetSite[];
  /** Sitio actualmente seleccionado para navegación y resaltado */
  selectedSite?: PresetSite | null;
  /** Callback al hacer clic en un sitio (por ejemplo desde su etiqueta 3D) */
  onSelectSite?: (site: PresetSite) => void;
  /** ID numérico incremental para disparar vuelo de cámara hacia el sitio */
  flightId?: number;
  /** Configuración inyectable de zonas de aterrizaje */
  zones?: ZoneConfig;
  /** Configuración inyectable de marcadores de puntos */
  markers?: MarkerConfig;
  /** Configuración inyectable del terreno LOLA/WAC */
  terrain?: TerrainConfig;
  /** Configuración inyectable del Sol */
  sun?: SunConfig;
  /** Configuración inyectable de la cámara */
  camera?: CameraConfig;
  /** Activar campo de estrellas de fondo */
  showStars?: boolean;
  /** Clases CSS del contenedor principal */
  className?: string;
  /** Elementos 3D adicionales opcionales para inyectar dentro del Canvas */
  children?: React.ReactNode;
}

/**
 * LunarMapViewer
 * --------------
 * Componente modular y maestro de la escena 3D lunar.
 * Expone todos sus parámetros (colores, opacidades, offsets, sol, terreno y cámara)
 * para ser controlados dinámicamente desde cualquier UI externa, dashboard o telemetría.
 */
export const LunarMapViewer: React.FC<LunarMapViewerProps> = ({
  sites,
  selectedSite,
  onSelectSite,
  flightId = 0,
  zones,
  markers,
  terrain,
  sun,
  camera,
  showStars = true,
  className = "relative h-screen w-screen bg-black",
  children,
}) => {
  // Valores por defecto seguros con capacidades de inyección
  const sunAngle = sun?.angle ?? 0;
  const sunRadius = sun?.radius ?? 80;
  const sunHeight = sun?.height ?? 8;
  const sunIntensity = sun?.intensity ?? 2;
  const ambientIntensity = sun?.ambientIntensity ?? 0.1;
  const shadowExtent = sun?.shadowExtent ?? 75;

  const zoneVisible = zones?.visible ?? true;
  const zoneColor = zones?.color ?? "#FF9F1C";
  const zoneEdgeOpacity = zones?.edgeOpacity ?? 0.7;
  // Offset vertical solicitado por defecto en 0.05
  const zoneOffset = zones?.offset ?? 0.05;
  const zoneSizeScale = zones?.sizeScale ?? 1.0;
  const zoneSizeOverrides = zones?.sizeOverrides;
  const zoneSegments = zones?.segments ?? 64;
  const zoneGradientPower = zones?.gradientPower ?? 1.6;
  const zoneEmissiveIntensity = zones?.emissiveIntensity ?? 0.25;

  const markersVisible = markers?.visible ?? true;
  const markerPoleHeight = markers?.poleHeight ?? 2;
  const markerColors = markers?.colors;

  const cameraInitialPos = camera?.initialPosition ?? [0, 50, 100];
  const cameraFov = camera?.fov ?? 45;
  const cameraNear = camera?.near ?? 0.1;
  const cameraFar = camera?.far ?? 1000;
  const cameraFlyOffset = camera?.flyOffset ?? [6, 8, 10];
  const cameraLerpFactor = camera?.lerpFactor ?? 0.06;

  return (
    <div className={className}>
      <Canvas
        shadows
        camera={{
          position: cameraInitialPos,
          fov: cameraFov,
          near: cameraNear,
          far: cameraFar,
        }}
      >
        <ambientLight intensity={ambientIntensity} />
        <DynamicSun
          sunAngle={sunAngle}
          radius={sunRadius}
          height={sunHeight}
          intensity={sunIntensity}
          shadowExtent={shadowExtent}
        />

        {showStars && <Stars radius={200} depth={50} count={3000} factor={3} fade />}

        <Suspense fallback={null}>
          <LunarSurface
            size={terrain?.size}
            segments={terrain?.segments}
            displacementScale={terrain?.displacementScale}
            displacementBias={terrain?.displacementBias}
            normalScale={terrain?.normalScale}
            roughness={terrain?.roughness}
            metalness={terrain?.metalness}
            wireframe={terrain?.wireframe}
            mapUrl={terrain?.mapUrl}
            demUrl={terrain?.demUrl}
            normalUrl={terrain?.normalUrl}
          >
            {/* Mallas de Zona Topográficas Deformadas */}
            <SiteZonesOverlay
              sites={sites}
              selectedId={selectedSite?.id}
              visible={zoneVisible}
              color={zoneColor}
              edgeOpacity={zoneEdgeOpacity}
              offset={zoneOffset}
              sizeScale={zoneSizeScale}
              sizeOverrides={zoneSizeOverrides}
              segments={zoneSegments}
              gradientPower={zoneGradientPower}
              emissiveIntensity={zoneEmissiveIntensity}
            />

            {/* Marcadores físicos (postes y etiquetas de nombre flotantes) */}
            <SiteMarkers
              sites={sites}
              selectedId={selectedSite?.id}
              visible={markersVisible}
              poleHeight={markerPoleHeight}
              onSelectSite={onSelectSite}
            />
          </LunarSurface>

          {/* Navegación y Vuelo Fly-To */}
          <FlyToController
            site={selectedSite ?? null}
            flightId={flightId}
            offset={cameraFlyOffset}
            lerpFactor={cameraLerpFactor}
          />

          {/* Slot para extensiones 3D personalizadas */}
          {children}
        </Suspense>

        <OrbitControls makeDefault enableDamping />
      </Canvas>
    </div>
  );
};

export default LunarMapViewer;
