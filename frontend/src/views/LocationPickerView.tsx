"use client";

import React, { useState, useMemo, useRef, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { MoonGlobe } from "../components/3d_canvas/MoonGlobe";
import { CANDIDATE_LANDING_SITES } from "../data/landingSites";
import { LandingSite, ViabilityFilterCriteria } from "../types";

export type ExplorerPhase = "landing" | "transitioning" | "picker";

export interface LocationPickerViewProps {
  initialPhase?: ExplorerPhase;
  onSelectSiteDetail?: (siteId: string) => void;
}

interface SceneDirectorProps {
  phase: ExplorerPhase;
  sites: (LandingSite & { isViable?: boolean })[];
  selectedSiteId: string | null;
  onSelectSite: (site: LandingSite) => void;
}

/**
 * Controlador de la animación continua 3D:
 * - En landing: cámara en [0, 0, 5.5], Luna en horizonte [0, -2.53, 0], rotación X = 0.35.
 * - Durante la transición: cámara se aleja suavemente a Z = 6.0, Luna se eleva al centro [0, 0, 0]
 *   y rota su eje X hacia -1.38 rad para apuntar el Polo Sur directamente hacia el usuario,
 *   mostrando progresivamente los marcadores de sitios candidatos.
 */
// Estado original del Home (antes de modificar la cámara)
const HOME_CAM_Z = 5.5;
const HOME_CAM_FOV = 35;
const HOME_MOON_Y = -2.53;
const HOME_MOON_SCALE = 1.85;
const HOME_MOON_ROTX = 0.35;
const HOME_MOON_ROTZ = 0.04;

// Estado del Picker (aprobado por el usuario)
const PICKER_CAM_Z = 5.45;
const PICKER_CAM_FOV = 38;
const PICKER_MOON_Y = -2.65;
const PICKER_MOON_SCALE = 2.45;
const PICKER_MOON_ROTX = 3.42; // ~196°: Polo Sur apuntando hacia arriba
const PICKER_MOON_ROTZ = 0.0;

const SceneDirector: React.FC<SceneDirectorProps> = ({
  phase,
  sites,
  selectedSiteId,
  onSelectSite,
}) => {
  const { camera } = useThree();
  const moonGroupRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.DirectionalLight>(null);
  const rimLightRef = useRef<THREE.DirectionalLight>(null);

  const isLanding = phase === "landing";

  useFrame((_, delta) => {
    // 1. Interpolación suave entre la cámara original del Home y la cámara del Picker
    const targetCamZ = isLanding ? HOME_CAM_Z : PICKER_CAM_Z;
    const targetFov = isLanding ? HOME_CAM_FOV : PICKER_CAM_FOV;

    camera.position.z = THREE.MathUtils.damp(camera.position.z, targetCamZ, 2.5, delta);
    camera.position.y = 0.0;

    if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
      const perspCam = camera as THREE.PerspectiveCamera;
      if (Math.abs(perspCam.fov - targetFov) > 0.01) {
        perspCam.fov = THREE.MathUtils.damp(perspCam.fov, targetFov, 2.5, delta);
        perspCam.updateProjectionMatrix();
      }
    }

    // 2. Interpolación de la Luna desde su estado original en Home hacia la vista del Polo Sur en Picker
    if (moonGroupRef.current) {
      const targetPosY = isLanding ? HOME_MOON_Y : PICKER_MOON_Y;
      const targetScale = isLanding ? HOME_MOON_SCALE : PICKER_MOON_SCALE;
      const targetRotX = isLanding ? HOME_MOON_ROTX : PICKER_MOON_ROTX;
      const targetRotZ = isLanding ? HOME_MOON_ROTZ : PICKER_MOON_ROTZ;

      moonGroupRef.current.position.y = THREE.MathUtils.damp(
        moonGroupRef.current.position.y,
        targetPosY,
        2.5,
        delta
      );

      const currentScale = THREE.MathUtils.damp(
        moonGroupRef.current.scale.x,
        targetScale,
        2.5,
        delta
      );
      moonGroupRef.current.scale.set(currentScale, currentScale, currentScale);

      moonGroupRef.current.rotation.x = THREE.MathUtils.damp(
        moonGroupRef.current.rotation.x,
        targetRotX,
        2.2,
        delta
      );

      moonGroupRef.current.rotation.z = THREE.MathUtils.damp(
        moonGroupRef.current.rotation.z,
        targetRotZ,
        2.2,
        delta
      );
    }

    // 3. Iluminación: exacta a la original en Home y rasante en Picker
    if (lightRef.current) {
      const targetLightX = isLanding ? 0.0 : 3.0;
      const targetLightY = isLanding ? 6.5 : 6.0;
      const targetLightZ = isLanding ? 1.5 : 2.8;
      const targetIntensity = isLanding ? 2.8 : 2.7;

      lightRef.current.position.x = THREE.MathUtils.damp(lightRef.current.position.x, targetLightX, 2.5, delta);
      lightRef.current.position.y = THREE.MathUtils.damp(lightRef.current.position.y, targetLightY, 2.5, delta);
      lightRef.current.position.z = THREE.MathUtils.damp(lightRef.current.position.z, targetLightZ, 2.5, delta);
      lightRef.current.intensity = THREE.MathUtils.damp(lightRef.current.intensity, targetIntensity, 2.5, delta);
    }

    if (rimLightRef.current) {
      const targetRimY = isLanding ? 5.5 : 5.0;
      const targetRimIntensity = isLanding ? 1.5 : 0.9;
      rimLightRef.current.position.y = THREE.MathUtils.damp(rimLightRef.current.position.y, targetRimY, 2.5, delta);
      rimLightRef.current.intensity = THREE.MathUtils.damp(rimLightRef.current.intensity, targetRimIntensity, 2.5, delta);
    }
  });

  return (
    <>
      <ambientLight intensity={isLanding ? 0.03 : 0.08} />
      <directionalLight
        ref={lightRef}
        position={[0, 6.5, 1.5]}
        intensity={2.8}
        color="#f8fafc"
      />
      <directionalLight
        ref={rimLightRef}
        position={[0, 5.5, -2.5]}
        intensity={1.5}
        color="#7dd3fc"
      />

      {/* Inicia con los parámetros exactos del Home original */}
      <group
        ref={moonGroupRef}
        position={[0, HOME_MOON_Y, 0]}
        rotation={[HOME_MOON_ROTX, 0, HOME_MOON_ROTZ]}
        scale={[HOME_MOON_SCALE, HOME_MOON_SCALE, HOME_MOON_SCALE]}
      >
        <MoonGlobe
          scale={1.0}
          sites={sites}
          selectedSiteId={selectedSiteId}
          onSelectSite={onSelectSite}
          autoRotate={true}
          rotationSpeed={isLanding ? 0.025 : 0.012}
          showHorizonGlow={true}
          showSites={!isLanding}
        />
      </group>

      {/* OrbitControls mantiene target={[0, 0, 0]} para no cambiar el pitch de cámara ni empujar el modelo */}
      {phase === "picker" && (
        <OrbitControls
          target={[0, 0, 0]}
          enablePan={false}
          enableDamping
          dampingFactor={0.05}
          minDistance={4.8}
          maxDistance={6.2}
          minPolarAngle={Math.PI / 2.25}
          maxPolarAngle={Math.PI / 1.85}
          rotateSpeed={0.5}
        />
      )}
    </>
  );
};

export const LocationPickerView: React.FC<LocationPickerViewProps> = ({
  initialPhase = "landing",
  onSelectSiteDetail,
}) => {
  const [phase, setPhase] = useState<ExplorerPhase>(initialPhase);

  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(
    CANDIDATE_LANDING_SITES[0]?.id || null
  );

  const [filters, setFilters] = useState<ViabilityFilterCriteria>({
    minIllumination: 70,
    maxSlope: 12,
    requireEarthLink: true,
    requirePsrIceProximity: false,
  });

  const selectedSite = useMemo(
    () => CANDIDATE_LANDING_SITES.find((s) => s.id === selectedSiteId) || null,
    [selectedSiteId]
  );

  const filteredSites = useMemo(() => {
    return CANDIDATE_LANDING_SITES.map((site) => {
      const isViable =
        site.illuminationAvgPercent >= filters.minIllumination &&
        site.slopeDegrees <= filters.maxSlope &&
        (!filters.requireEarthLink || site.earthVisibilityPercent >= 70);

      return { ...site, isViable };
    });
  }, [filters]);

  const viableCount = filteredSites.filter((s) => s.isViable).length;

  // Manejo de la transición al presionar "Launch 3D Explorer"
  const handleLaunchExplorer = () => {
    setPhase("transitioning");
    setTimeout(() => {
      setPhase("picker");
    }, 1250);
  };

  // Regresar a la Landing Page
  const handleBackToLanding = () => {
    setPhase("landing");
  };

  return (
    <div
      className="relative w-full h-screen bg-[#05070B] bg-cover bg-center bg-no-repeat overflow-hidden select-none"
      style={{ backgroundImage: "url('/images/bg_start_.webp')" }}
    >
      {/* Canvas 3D Único y Persistente con Animación de Cámara y Luna */}
      <div className="absolute inset-0 z-0">
        <Canvas
          gl={{ alpha: true, antialias: true }}
          camera={{ position: [0, 0, HOME_CAM_Z], fov: HOME_CAM_FOV, near: 0.1, far: 100 }}
        >
          <Suspense fallback={null}>
            <SceneDirector
              phase={phase}
              sites={filteredSites}
              selectedSiteId={selectedSiteId}
              onSelectSite={(site) => setSelectedSiteId(site.id)}
            />
          </Suspense>
        </Canvas>
      </div>

      {/* =========================================================================
          1. UI DEL HOME / LANDING (Sale hacia arriba con animación suave ease-in)
         ========================================================================= */}
      <div
        className="absolute inset-0 z-10 flex flex-col justify-between px-6 py-8 md:px-16 md:py-10 pointer-events-none"
        style={{
          transform: phase !== "landing" ? "translateY(-140%)" : "translateY(0%)",
          opacity: phase !== "landing" ? 0 : 1,
          transition: "transform 1.2s cubic-bezier(0.55, 0.055, 0.675, 0.19), opacity 0.85s ease-in",
        }}
      >
        {/* Cabecera / Identidad */}
        <header className="flex items-center justify-between w-full border-b border-white/10 pb-4 pointer-events-auto">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-[#FF9F1C] rotate-45" />
            <h2 className="font-display text-sm md:text-base tracking-widest text-[#FBFBFB] lowercase">
              astRo teaM
            </h2>
          </div>
          <span className="font-mono text-xs px-3 py-1 rounded border border-white/10 bg-black/40 backdrop-blur-sm text-slate-300">
            nasa space apps 2026
          </span>
        </header>

        {/* Hero Section */}
        <section className="w-full max-w-5xl mx-auto text-center mt-10 md:mt-16 mb-auto px-4 pointer-events-auto">
          <h1 className="font-display text-5xl sm:text-7xl md:text-8xl font-normal leading-none tracking-tight text-[#FBFBFB] mb-8 drop-shadow-[0_4px_30px_rgba(0,0,0,0.95)]">
            astRo teaM
          </h1>
          <p className="font-sans text-base md:text-lg text-slate-300 max-w-4xl mx-auto leading-relaxed mb-24 md:mb-36 px-4">
            We precompute solar and terrestrial ephemerides to simulate polar regolith grazing shadows and Direct-to-Earth (DTE) communication windows with sub-degree accuracy.
          </p>

          <div className="flex items-center justify-center pt-8 md:pt-12">
            <button
              onClick={handleLaunchExplorer}
              className="px-8 py-4 bg-[#FF9F1C] hover:bg-[#ffaa33] text-[#0F1108] font-heading font-bold text-sm md:text-base uppercase tracking-wider rounded-lg transition-all duration-200 shadow-[0_0_25px_rgba(255,159,28,0.4)] flex items-center gap-3 cursor-pointer"
            >
              <span>Launch 3D Explorer</span>
              <span aria-hidden="true">&rarr;</span>
            </button>
          </div>
        </section>
      </div>

      {/* =========================================================================
          2. UI DEL EXPLORADOR / PICKER HUD (Aparece suavemente al llegar al Polo Sur)
         ========================================================================= */}
      <div
        className={`absolute inset-0 z-20 pointer-events-none transition-opacity duration-700 ease-out ${
          phase === "picker" ? "opacity-100" : "opacity-0"
        }`}
      >
        {/* Marcadores de encuadre HUD tácticos estilo póster lunar */}
        <div className="absolute top-20 inset-x-0 mx-auto text-center pointer-events-none">
          <span className="font-mono text-[11px] text-slate-300 tracking-[0.25em] uppercase px-3 py-1 bg-black/50 border border-white/10 rounded-full backdrop-blur-sm">
            <span className="inline-block w-2 h-2 rounded-full bg-rose-500 animate-pulse mr-2" />
            REC // SOUTH POLE SECTOR
          </span>
        </div>

        {/* Retículas laterales */}
        <div className="absolute top-1/2 left-8 -translate-y-1/2 font-mono text-sm text-white/20 pointer-events-none select-none">
          +
        </div>
        <div className="absolute top-1/2 right-8 -translate-y-1/2 font-mono text-sm text-white/20 pointer-events-none select-none">
          +
        </div>

        {/* HUD Superior: Barra de Navegación */}
        <header className="absolute top-4 left-6 right-6 flex items-center justify-between pointer-events-none">
          <div className="flex items-center gap-4 pointer-events-auto">
            <button
              onClick={handleBackToLanding}
              className="px-3 py-1.5 rounded-lg border border-white/10 bg-black/50 hover:bg-white/10 text-slate-300 font-mono text-xs transition-colors cursor-pointer"
            >
              &larr; Back
            </button>
            <div>
              <h1 className="font-heading text-lg font-bold text-white uppercase tracking-wider">
                Candidate Site Selector
              </h1>
              <p className="font-mono text-xs text-sky-400">
                3D Global Model // Lunar South Pole
              </p>
            </div>
          </div>

          <div className="pointer-events-auto flex items-center gap-3 bg-[#0D121D]/80 backdrop-blur-md px-4 py-2 rounded-lg border border-white/10">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono text-xs text-slate-300">
              {viableCount} of {CANDIDATE_LANDING_SITES.length} viable sites
            </span>
          </div>
        </header>

        {/* Panel Flotante Izquierdo: Filtros de Criterios Aceptables */}
        <aside className="absolute left-6 top-24 bottom-24 w-80 flex flex-col gap-4 pointer-events-auto">
          <div className="p-4 rounded-xl border border-white/10 bg-[#0D121D]/85 backdrop-blur-md shadow-2xl">
            <h2 className="font-heading text-sm font-bold text-white uppercase tracking-wider mb-3">
              Viability Criteria
            </h2>

            {/* Slider Iluminación */}
            <div className="mb-4">
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="font-sans text-slate-400">Min Illumination</span>
                <span className="font-mono text-amber-400 font-bold">{filters.minIllumination}%</span>
              </div>
              <input
                type="range"
                min="40"
                max="95"
                value={filters.minIllumination}
                onChange={(e) =>
                  setFilters({ ...filters, minIllumination: Number(e.target.value) })
                }
                className="w-full accent-amber-400 bg-slate-800"
              />
            </div>

            {/* Slider Pendiente */}
            <div className="mb-4">
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="font-sans text-slate-400">Max Slope</span>
                <span className="font-mono text-sky-400 font-bold">{filters.maxSlope}°</span>
              </div>
              <input
                type="range"
                min="5"
                max="25"
                value={filters.maxSlope}
                onChange={(e) =>
                  setFilters({ ...filters, maxSlope: Number(e.target.value) })
                }
                className="w-full accent-sky-400 bg-slate-800"
              />
            </div>
          </div>

          {/* Lista de Sitios Candidatos */}
          <div className="flex-1 p-4 rounded-xl border border-white/10 bg-[#0D121D]/85 backdrop-blur-md shadow-2xl overflow-y-auto">
            <h3 className="font-heading text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Artemis Candidate Sites
            </h3>
            <div className="space-y-2">
              {filteredSites.map((site) => {
                const isSelected = site.id === selectedSiteId;
                return (
                  <button
                    key={site.id}
                    onClick={() => setSelectedSiteId(site.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-all cursor-pointer ${
                      isSelected
                        ? "border-amber-400/80 bg-amber-400/10"
                        : "border-white/5 bg-white/5 hover:border-white/20"
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-heading text-xs font-bold text-white truncate">
                        {site.name}
                      </span>
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                          site.isViable
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                        }`}
                      >
                        {site.isViable ? "VIABLE" : "NON-VIABLE"}
                      </span>
                    </div>
                    <div className="flex gap-3 text-[10px] font-mono text-slate-400">
                      <span>Illum: {site.illuminationAvgPercent}%</span>
                      <span>Slope: {site.slopeDegrees}°</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Card Flotante Inferior Derecha: Detalle Rápido y CTA a Vista Especializada */}
        {selectedSite && (
          <aside className="absolute right-6 bottom-8 w-96 p-5 rounded-xl border border-white/10 bg-[#0D121D]/90 backdrop-blur-md shadow-2xl pointer-events-auto">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-[10px] text-amber-400 uppercase tracking-widest">
                Selected Site
              </span>
              <span className="font-mono text-xs text-slate-400">
                {selectedSite.coordinates.lat}°S, {selectedSite.coordinates.lng}°E
              </span>
            </div>

            <h2 className="font-heading text-lg font-bold text-white mb-2">
              {selectedSite.name}
            </h2>

            <p className="font-sans text-xs text-slate-300 line-clamp-2 mb-4 leading-relaxed">
              {selectedSite.description}
            </p>

            <button
              onClick={() => onSelectSiteDetail?.(selectedSite.slug)}
              className="w-full py-3 bg-[#FF9F1C] hover:bg-[#ffaa33] text-[#0F1108] font-heading font-bold text-xs uppercase tracking-wider rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(255,159,28,0.3)]"
            >
              <span>Analyze 3D Local Terrain</span>
              <span aria-hidden="true">&rarr;</span>
            </button>
          </aside>
        )}
      </div>
    </div>
  );
};

export default LocationPickerView;
