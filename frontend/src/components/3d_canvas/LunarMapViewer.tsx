"use client";

import React, { Suspense, useState, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
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
  /** Posición fija del bloque topográfico en unidades de mundo [X, Y, Z] */
  position?: [number, number, number];
}

/** Configuración de la iluminación solar y ambiental */
export interface SunConfig {
  /** Azimut solar en grados (0 - 360) */
  angle?: number;
  radius?: number;
  elevationDeg?: number;
  siteLongitudeDeg?: number;
  intensity?: number;
  ambientIntensity?: number;
  shadowExtent?: number;
  visible?: boolean;
}

/** Vector de línea de vista hacia la Tierra */
export interface EarthConfig {
  visible?: boolean;
  origin?: [number, number, number];
  targetDirection?: [number, number, number];
  color?: string;
  label?: string;
  isConnected?: boolean;
  disconnectedLabel?: string;
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

export interface CameraTelemetryData {
  position: [number, number, number];
  target: [number, number, number];
  distance: number;
  polarAngleDeg: number;
  azimuthAngleDeg: number;
  rotationDeg: [number, number, number];
}

interface CameraTrackerProps {
  onUpdate: (data: CameraTelemetryData) => void;
}

const CameraTracker: React.FC<CameraTrackerProps> = ({ onUpdate }) => {
  const { camera } = useThree();
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const lastUpdateRef = useRef<number>(0);

  useFrame(() => {
    const now = performance.now();
    // Limitar a ~15 actualizaciones por segundo para no penalizar el render
    if (now - lastUpdateRef.current < 65) return;
    lastUpdateRef.current = now;

    const t = controls?.target ?? { x: 0, y: 0, z: 0 };
    const p = camera.position;
    const r = camera.rotation;

    const polar = controls ? (controls.getPolarAngle() * 180) / Math.PI : 0;
    const az = controls ? (controls.getAzimuthalAngle() * 180) / Math.PI : 0;
    const dist = controls ? controls.getDistance() : p.distanceTo(t as any);

    onUpdate({
      position: [Number(p.x.toFixed(1)), Number(p.y.toFixed(1)), Number(p.z.toFixed(1))],
      target: [Number(t.x.toFixed(1)), Number(t.y.toFixed(1)), Number(t.z.toFixed(1))],
      distance: Number(dist.toFixed(1)),
      polarAngleDeg: Number(polar.toFixed(1)),
      azimuthAngleDeg: Number(az.toFixed(1)),
      rotationDeg: [
        Number(((r.x * 180) / Math.PI).toFixed(1)),
        Number(((r.y * 180) / Math.PI).toFixed(1)),
        Number(((r.z * 180) / Math.PI).toFixed(1)),
      ],
    });
  });

  return null;
};
export interface CameraConfig {
  initialPosition?: [number, number, number];
  target?: [number, number, number];
  /** Posición de cámara para la vista general (overview alejado y elevado) */
  overviewPosition?: [number, number, number];
  /** Punto de enfoque para la vista general */
  overviewTarget?: [number, number, number];
  fov?: number;
  near?: number;
  far?: number;
  flyOffset?: [number, number, number];
  targetOffset?: [number, number, number];
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
  showDebugHud?: boolean;
  statusColor?: string;
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
  showDebugHud = false,
  statusColor = "#D9CEC5",
  children,
}) => {
  const { selectedSite: contextSite } = useSiteContext();
  const activeSite = selectedSiteProp !== undefined ? selectedSiteProp : contextSite;
  const [telemetry, setTelemetry] = useState<CameraTelemetryData | null>(null);

  const terrainSize = terrain?.size ?? TERRAIN.size;
  const terrainSegments = terrain?.segments ?? TERRAIN.segments;
  const displacementScale = terrain?.displacementScale ?? TERRAIN.displacementScale;
  const displacementBias = terrain?.displacementBias ?? TERRAIN.displacementBias;
  const terrainRotation: [number, number, number] = terrain?.rotation ?? [0, 0, 0];
  const terrainPosition: [number, number, number] = terrain?.position ?? [0, 0, 0];
  const camTarget: [number, number, number] = camera?.target ?? [4.8, -4.5, -7.7];
  const initialCamPos: [number, number, number] = camera?.initialPosition ?? [32, 14, 51.2];
  const overviewCamPos: [number, number, number] = camera?.overviewPosition ?? [42, 23, 92];
  const overviewCamTarget: [number, number, number] = camera?.overviewTarget ?? [0, -7, 0];

  // Si activeSite es null (vista general), inicializa la cámara en la perspectiva general elevada
  const canvasCamPos = activeSite ? initialCamPos : overviewCamPos;
  const canvasCamTarget = activeSite ? camTarget : overviewCamTarget;

  return (
    <div className={className}>
      <Canvas
        shadows
        gl={{ alpha: true, antialias: true }}
        camera={{
          position: canvasCamPos,
          fov: camera?.fov ?? 40,
          near: camera?.near ?? 0.1,
          far: camera?.far ?? 1000,
        }}
      >
        <ambientLight intensity={sun?.ambientIntensity ?? 0.1} />
        <DynamicSun
          sunAngle={sun?.angle ?? 0}
          radius={sun?.radius ?? 80}
          elevationDeg={sun?.elevationDeg ?? 5.7}
          siteLongitudeDeg={sun?.siteLongitudeDeg ?? 0}
          intensity={sun?.intensity ?? 2.8}
          shadowExtent={sun?.shadowExtent ?? 75}
          visible={sun?.visible ?? true}
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
          <group position={terrainPosition} rotation={terrainRotation}>
            {/* Capas de datos apiladas sobre el sitio seleccionado (Diorama Holográfico) */}
            <DataLayers
              selectedSite={activeSite}
              terrainSize={terrainSize}
              visible={grid?.visible ?? true}
              statusColor={statusColor}
            />

            <EarthVector
              selectedSite={activeSite}
              visible={earth?.visible ?? true}
              origin={earth?.origin ?? [0, 0, 0]}
              targetDirection={earth?.targetDirection ?? [40, 50, -30]}
              terrainSize={terrainSize}
              color={earth?.color ?? "#38BDF8"}
              label={earth?.label ?? "EARTH"}
              isConnected={earth?.isConnected ?? true}
              disconnectedLabel={earth?.disconnectedLabel ?? "NO DTE LINK"}
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
                isOverview={!activeSite}
                visible={markers?.visible ?? true}
                poleHeight={markers?.poleHeight ?? 2.5}
                onSelectSite={onSelectSite}
              />
            </LunarSurface>
          </group>

          <FlyToController
            site={activeSite}
            flightId={flightId}
            offset={camera?.flyOffset ?? [6, 8, 10]}
            targetOffset={camera?.targetOffset}
            lerpFactor={camera?.lerpFactor ?? 0.06}
            overviewCamera={overviewCamPos}
            overviewTarget={overviewCamTarget}
            terrainRotation={terrainRotation}
            terrainPosition={terrainPosition}
            terrainSize={terrainSize}
          />

          {children}
        </Suspense>

        <OrbitControls
          makeDefault
          enableDamping
          target={canvasCamTarget}
          minDistance={camera?.minDistance ?? 30}
          maxDistance={camera?.maxDistance ?? 180}
          maxPolarAngle={Math.PI / 2.05}
        />

        {showDebugHud && <CameraTracker onUpdate={setTelemetry} />}
      </Canvas>

      {/* HUD flotante con telemetría en tiempo real de posición, inclinación y rotación de cámara */}
      {showDebugHud && telemetry && (
        <div className="pointer-events-auto absolute bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-[#0D0D0D]/90 border border-white/20 rounded-md px-3.5 py-1.5 font-mono text-[11px] text-[#D9CEC5] backdrop-blur-md shadow-lg select-text">
          <div className="flex items-center gap-1.5">
            <span className="text-[#A6948A] uppercase">Pos:</span>
            <span className="text-cyan-300 font-semibold">[{telemetry.position.join(", ")}]</span>
          </div>
          <span className="text-white/20">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[#A6948A] uppercase">Target:</span>
            <span className="text-amber-300 font-semibold">[{telemetry.target.join(", ")}]</span>
          </div>
          <span className="text-white/20">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[#A6948A] uppercase">Inclination (Polar):</span>
            <span className="text-emerald-400 font-semibold">{telemetry.polarAngleDeg}°</span>
          </div>
          <span className="text-white/20">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[#A6948A] uppercase">Azimuth:</span>
            <span className="text-emerald-400 font-semibold">{telemetry.azimuthAngleDeg}°</span>
          </div>
          <span className="text-white/20">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[#A6948A] uppercase">Rot (deg):</span>
            <span className="text-purple-300 font-semibold">[{telemetry.rotationDeg.join(", ")}]</span>
          </div>
          <button
            type="button"
            onClick={() => {
              const snippet = `initialPosition: [${telemetry.position.join(", ")}], target: [${telemetry.target.join(", ")}]`;
              navigator.clipboard?.writeText(snippet);
            }}
            title="Copy values to clipboard"
            className="ml-1 px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[10px] text-white cursor-pointer transition-colors"
          >
            Copy
          </button>
        </div>
      )}
    </div>
  );
};

export default LunarMapViewer;
