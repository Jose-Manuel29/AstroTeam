"use client";

import React, { useState, useMemo, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { LunarSurface } from "../components/3d_canvas/LunarSurface";
import { OrbitMinimap } from "../components/3d_canvas/OrbitMinimap";
import { CANDIDATE_LANDING_SITES } from "../data/landingSites";
import { UserProfileMode } from "../types";

export interface SiteDetailViewProps {
  siteSlug?: string;
  onBackToPicker?: () => void;
}

/**
 * Vista 3: Vista de Detalle (Análisis Profundo)
 * URL: /site/:id
 * Incluye:
 * 1. Mapa 3D del terreno local en alta resolución (LunarSurface con DEM LOLA y sombras rasantes).
 * 2. Modelo 3D global complementario (OrbitMinimap con moon.glb).
 * 3. Telemetría en tiempo real y controlador temporal.
 */
export const SiteDetailView: React.FC<SiteDetailViewProps> = ({
  siteSlug = "shackleton-connecting-ridge",
  onBackToPicker,
}) => {
  const [profileMode, setProfileMode] = useState<UserProfileMode>("mission_planner");
  const [timeStep, setTimeStep] = useState<number>(12); // Hora simulada (0 a 24)

  const site = useMemo(
    () =>
      CANDIDATE_LANDING_SITES.find((s) => s.slug === siteSlug) ||
      CANDIDATE_LANDING_SITES[0],
    [siteSlug]
  );

  // Simulación matemática de efemérides solares según la hora
  const sunElevation = useMemo(() => {
    // Elevación rasante polar típica (entre -1.5° y +1.8°)
    return Number((1.5 * Math.sin((timeStep / 24) * Math.PI * 2)).toFixed(2));
  }, [timeStep]);

  const sunAzimuth = useMemo(() => {
    return Math.round((timeStep / 24) * 360);
  }, [timeStep]);

  const isSunVisible = sunElevation > 0;
  const isEarthVisible = true; // Simulado para Shackleton Ridge

  // Posición dinámica de la luz direccional del Sol según azimut y elevación
  const lightPosition: [number, number, number] = useMemo(() => {
    const radAz = (sunAzimuth * Math.PI) / 180;
    const radEl = (sunElevation * Math.PI) / 180;
    const dist = 80;
    return [
      dist * Math.cos(radEl) * Math.sin(radAz),
      Math.max(dist * Math.sin(radEl), 2), // Evitar que la luz quede completamente debajo del plano
      dist * Math.cos(radEl) * Math.cos(radAz),
    ];
  }, [sunAzimuth, sunElevation]);

  return (
    <div
      className="relative w-full h-screen bg-[#05070B] bg-cover bg-center bg-no-repeat overflow-hidden select-none"
      style={{ backgroundImage: "url('/images/bg_start_.webp')" }}
    >
      {/* HUD Superior: Barra de Estado y Selector de Perfil */}
      <header className="absolute top-4 left-6 right-6 z-20 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-4 pointer-events-auto">
          <button
            onClick={onBackToPicker}
            className="px-3 py-1.5 rounded-lg border border-white/10 bg-black/50 hover:bg-white/10 text-slate-300 font-mono text-xs transition-colors"
          >
            &larr; Back to Selector
          </button>
          <div>
            <h1 className="font-heading text-lg font-bold text-white uppercase tracking-wider">
              {site.name}
            </h1>
            <p className="font-mono text-xs text-amber-400">
              Specialized View // 3D Local Terrain
            </p>
          </div>
        </div>

        {/* Conmutador de Perfil: Entusiasta vs Planificador */}
        <div className="pointer-events-auto flex items-center gap-1 p-1 bg-[#0D121D]/80 backdrop-blur-md rounded-lg border border-white/10">
          <button
            onClick={() => setProfileMode("enthusiast")}
            className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
              profileMode === "enthusiast"
                ? "bg-white/20 text-white font-bold"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Enthusiast
          </button>
          <button
            onClick={() => setProfileMode("mission_planner")}
            className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
              profileMode === "mission_planner"
                ? "bg-amber-400 text-slate-950 font-bold"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Mission Planner
          </button>
        </div>
      </header>

      {/* Canvas 3D Principal (Terreno Local con Displacement y Sombras) */}
      <div className="w-full h-full">
        <Canvas gl={{ alpha: true, antialias: true }} camera={{ position: [0, 45, 65], fov: 45 }}>
          <ambientLight intensity={0.06} />

          {/* Luz Solar Dinámica */}
          <directionalLight
            position={lightPosition}
            intensity={isSunVisible ? 2.5 : 0.2}
            castShadow
          />

          <Suspense fallback={null}>
            <LunarSurface
              size={90}
              displacementScale={12}
              displacementBias={-3}
              normalScale={1.5}
              roughness={0.9}
            />
          </Suspense>

          <OrbitControls
            enableDamping
            dampingFactor={0.05}
            maxPolarAngle={Math.PI / 2.05} // No permitir que la cámara pase por debajo del terreno
            minDistance={15}
            maxDistance={120}
          />
        </Canvas>
      </div>

      {/* Esquina Superior Derecha: Modelo Global 3D (Minimapa) + Telemetría HUD */}
      <aside className="absolute top-20 right-6 w-80 z-20 flex flex-col gap-4 pointer-events-auto">
        {/* Modelo 3D Global Complementario */}
        <OrbitMinimap currentSite={site} />

        {/* Telemetry Card */}
        <div className="p-4 rounded-xl border border-white/10 bg-[#0D121D]/85 backdrop-blur-md shadow-2xl space-y-3">
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <span className="font-mono text-[10px] text-slate-400 uppercase tracking-widest">
              Orbital Telemetry
            </span>
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                isSunVisible
                  ? "bg-amber-400/20 text-amber-300 border border-amber-400/30"
                  : "bg-slate-700 text-slate-300"
              }`}
            >
              {isSunVisible ? "SUNLIGHT ACTIVE" : "FULL SHADOW"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div>
              <span className="text-[10px] text-slate-500 block">Sun Elevation</span>
              <span className="text-amber-300 text-sm font-bold">
                {sunElevation >= 0 ? `+${sunElevation}°` : `${sunElevation}°`}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block">Sun Azimuth</span>
              <span className="text-white text-sm font-bold">{sunAzimuth}°</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block">Earth Link (DTE)</span>
              <span className="text-emerald-400 text-sm font-bold">
                {isEarthVisible ? "ACTIVE (92%)" : "BLACKOUT"}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block">Mean Elevation</span>
              <span className="text-white text-sm font-bold">{site.elevationMeters} m</span>
            </div>
          </div>

          {profileMode === "mission_planner" && (
            <div className="pt-2 border-t border-white/5 text-[10px] font-mono text-slate-400 space-y-1">
              <div>Coords: {site.coordinates.lat}°S, {site.coordinates.lng}°E</div>
              <div>Mean Slope: {site.slopeDegrees}°</div>
              <div>Nearby PSR Area: {site.permanentShadowAreaKm2} km²</div>
            </div>
          )}
        </div>
      </aside>

      {/* Barra Inferior: Controlador Temporal (Timeline Slider) */}
      <footer className="absolute bottom-6 inset-x-8 max-w-2xl mx-auto z-20 pointer-events-auto">
        <div className="px-6 py-4 rounded-xl border border-white/10 bg-[#0D121D]/90 backdrop-blur-md shadow-2xl flex flex-col gap-2">
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="text-slate-400">Time Simulation (UTC Hours)</span>
            <span className="text-amber-400 font-bold">2026-10-24 {String(timeStep).padStart(2, "0")}:00 UTC</span>
          </div>
          <input
            type="range"
            min="0"
            max="24"
            step="0.5"
            value={timeStep}
            onChange={(e) => setTimeStep(Number(e.target.value))}
            className="w-full accent-amber-400 bg-slate-800"
          />
          <div className="flex justify-between text-[10px] font-mono text-slate-500">
            <span>00:00 UTC</span>
            <span>12:00 UTC</span>
            <span>24:00 UTC</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
