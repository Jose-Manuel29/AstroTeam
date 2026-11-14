"use client";

import { useState } from "react";
import presetSitesData from "../../public/data/preset_sites.json";
import type { PresetSite, PresetSitesFile } from "@/lib/context/SiteContext";
import { latLonToPlane } from "@/lib/geo/polarStereo";
import { LunarMapViewer } from "@/components/3d_canvas/LunarMapViewer";

const SITES: PresetSite[] = (presetSitesData as PresetSitesFile).sites;

const ZONE_COLOR_PRESETS = [
  { label: "Ámbar Artemis", value: "#FF9F1C" },
  { label: "Cian Hielo", value: "#00F5D4" },
  { label: "Esmeralda", value: "#34D399" },
  { label: "Violeta DTE", value: "#A78BFA" },
  { label: "Rosa Alerta", value: "#F472B6" },
];

export default function Home() {
  const [selectedSite, setSelectedSite] = useState<PresetSite | null>(null);
  const [flightId, setFlightId] = useState(0);

  // Estados dinámicos inyectables hacia el LunarMapViewer:
  const [sunAngle, setSunAngle] = useState(30);

  // Zonas: offset reducido a 0.05 según especificación
  const [zoneOffset, setZoneOffset] = useState(0.05);
  const [zoneColor, setZoneColor] = useState("#FF9F1C");
  const [zoneOpacity, setZoneOpacity] = useState(0.75);
  const [zoneScale, setZoneScale] = useState(1.0);
  const [zonesVisible, setZonesVisible] = useState(true);
  const [markersVisible, setMarkersVisible] = useState(true);
  const [terrainWireframe, setTerrainWireframe] = useState(false);

  // Control para desplegar/contraer panel de configuración
  const [showConfig, setShowConfig] = useState(true);

  const flyTo = (site: PresetSite) => {
    setSelectedSite(site);
    setFlightId((n) => n + 1);
  };

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-black font-mono text-slate-100 select-none">
      {/* ---------------- 1. Visualizador 3D Maestro Modular ---------------- */}
      <LunarMapViewer
        sites={SITES}
        selectedSite={selectedSite}
        onSelectSite={flyTo}
        flightId={flightId}
        sun={{
          angle: sunAngle,
          intensity: 2.2,
          ambientIntensity: 0.12,
        }}
        zones={{
          visible: zonesVisible,
          color: zoneColor,
          edgeOpacity: zoneOpacity,
          offset: zoneOffset, // Inyección dinámica del offset (0.5 por defecto)
          sizeScale: zoneScale,
        }}
        markers={{
          visible: markersVisible,
          poleHeight: 2,
        }}
        terrain={{
          wireframe: terrainWireframe,
        }}
      />

      {/* ---------------- 2. HUD: Barra Superior (Control Solar) ---------------- */}
      <header className="pointer-events-none absolute left-0 right-0 top-3 z-30 flex justify-center px-4">
        <div className="pointer-events-auto flex w-full max-w-xl items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-2 text-xs backdrop-blur-md shadow-2xl">
          <span className="flex items-center gap-1.5 font-semibold text-amber-300">
            <span>☀</span>
            <span className="tracking-wide uppercase text-[10px]">Azimut Solar</span>
          </span>
          <input
            type="range"
            min={0}
            max={360}
            step={1}
            value={sunAngle}
            onChange={(e) => setSunAngle(Number(e.target.value))}
            className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
          />
          <span className="w-12 text-right font-mono font-bold text-amber-300">{sunAngle}°</span>
        </div>
      </header>

      {/* ---------------- 3. HUD: Selector de Sitios Artemis (Izquierda) ---------------- */}
      <aside className="pointer-events-none absolute left-4 top-16 z-30 flex flex-col gap-2">
        <div className="pointer-events-auto flex w-64 flex-col gap-2 rounded-2xl border border-white/10 bg-slate-950/70 p-3 text-xs backdrop-blur-md shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-cyan-300">
              Sitios Artemis
            </h2>
            <span className="font-mono text-[10px] text-slate-400">Polo Sur Lunar</span>
          </div>

          <div className="flex max-h-[55vh] flex-col gap-1.5 overflow-y-auto pr-1">
            {SITES.map((site) => {
              const inside = latLonToPlane(site.lat, site.lon).inside;
              const active = selectedSite?.id === site.id;
              return (
                <button
                  key={site.id}
                  type="button"
                  disabled={!inside}
                  onClick={() => flyTo(site)}
                  title={inside ? site.description : "Ubicado fuera del cuadrante polar"}
                  className={`group flex items-start gap-2.5 rounded-xl border p-2 text-left transition-all duration-200 ${
                    active
                      ? "border-cyan-400/80 bg-cyan-500/20 shadow-[0_0_15px_rgba(34,211,238,0.25)]"
                      : "border-white/5 bg-white/5 hover:border-cyan-400/40 hover:bg-white/10"
                  } disabled:cursor-not-allowed disabled:opacity-30`}
                >
                  <span
                    className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full transition-transform group-hover:scale-125"
                    style={{ backgroundColor: active ? "#22d3ee" : zoneColor }}
                  />
                  <div className="flex-1 min-w-0">
                    <span className="block truncate font-medium text-slate-100">{site.name}</span>
                    <span className="font-mono text-[10px] text-slate-400">
                      {site.lat.toFixed(2)}°, {site.lon.toFixed(2)}°
                      {!inside && " · Fuera del mapa"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      {/* ---------------- 4. HUD: Inspector de Parámetros Dinámicos (Derecha) ---------------- */}
      <aside className="pointer-events-none absolute right-4 top-16 z-30 flex flex-col gap-2">
        <div className="pointer-events-auto flex w-72 flex-col gap-3 rounded-2xl border border-white/10 bg-slate-950/70 p-3.5 text-xs backdrop-blur-md shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
              Inspector Dinámico
            </h3>
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="text-[10px] font-mono text-slate-400 hover:text-slate-200"
            >
              {showConfig ? "[ Ocultar ]" : "[ Mostrar ]"}
            </button>
          </div>

          {showConfig && (
            <div className="flex flex-col gap-3">
              {/* Offset (Lift) de la zona */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-300">Offset Vertical (Zona)</span>
                  <span className="font-mono text-cyan-300">{zoneOffset.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0.05}
                  max={0.8}
                  step={0.01}
                  value={zoneOffset}
                  onChange={(e) => setZoneOffset(Number(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer h-1 bg-slate-800 rounded"
                />
              </div>

              {/* Opacidad en el borde */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-300">Opacidad Borde</span>
                  <span className="font-mono text-cyan-300">{(zoneOpacity * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={1.0}
                  step={0.05}
                  value={zoneOpacity}
                  onChange={(e) => setZoneOpacity(Number(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer h-1 bg-slate-800 rounded"
                />
              </div>

              {/* Escala global de zonas dinámicas */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-300">Escala de Zonas</span>
                  <span className="font-mono text-cyan-300">{zoneScale.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min={0.4}
                  max={2.5}
                  step={0.1}
                  value={zoneScale}
                  onChange={(e) => setZoneScale(Number(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer h-1 bg-slate-800 rounded"
                />
              </div>

              {/* Color dinámico de la zona */}
              <div className="flex flex-col gap-1.5 pt-1 border-t border-white/5">
                <span className="text-[11px] text-slate-300">Color de Zona:</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {ZONE_COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      onClick={() => setZoneColor(preset.value)}
                      title={preset.label}
                      style={{ backgroundColor: preset.value }}
                      className={`h-5 w-5 rounded-full border-2 transition-transform hover:scale-110 ${
                        zoneColor.toLowerCase() === preset.value.toLowerCase()
                          ? "border-white scale-110 shadow-[0_0_8px_rgba(255,255,255,0.4)]"
                          : "border-transparent"
                      }`}
                    />
                  ))}
                  <input
                    type="color"
                    value={zoneColor}
                    onChange={(e) => setZoneColor(e.target.value)}
                    className="h-6 w-6 cursor-pointer rounded border border-white/20 bg-transparent"
                    title="Color personalizado"
                  />
                </div>
              </div>

              {/* Toggles de visualización */}
              <div className="flex flex-col gap-1.5 pt-1 border-t border-white/5">
                <label className="flex items-center justify-between text-[11px] text-slate-300 cursor-pointer">
                  <span>Mallas de Zona</span>
                  <input
                    type="checkbox"
                    checked={zonesVisible}
                    onChange={(e) => setZonesVisible(e.target.checked)}
                    className="accent-cyan-400 rounded"
                  />
                </label>
                <label className="flex items-center justify-between text-[11px] text-slate-300 cursor-pointer">
                  <span>Marcadores (Postes)</span>
                  <input
                    type="checkbox"
                    checked={markersVisible}
                    onChange={(e) => setMarkersVisible(e.target.checked)}
                    className="accent-cyan-400 rounded"
                  />
                </label>
                <label className="flex items-center justify-between text-[11px] text-slate-300 cursor-pointer">
                  <span>Wireframe Terreno</span>
                  <input
                    type="checkbox"
                    checked={terrainWireframe}
                    onChange={(e) => setTerrainWireframe(e.target.checked)}
                    className="accent-amber-400 rounded"
                  />
                </label>
              </div>
            </div>
          )}
        </div>
      </aside>
    </main>
  );
}
