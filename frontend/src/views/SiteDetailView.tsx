"use client";

import React, { useState, useMemo, useEffect, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { LunarSurface } from "../components/3d_canvas/LunarSurface";
import {
  HudCard,
  CriteriaSlidersCard,
  CriterionSliderItem,
  CriteriaKpiCard,
  CriteriaIconListCard,
  CriterionIconListItem,
  CriteriaGridCard,
  CriteriaGridRow,
  CriteriaDaysKpiCard,
  TopTemporalController,
  SouthPoleMinimap,
} from "../components/hud";
import { CANDIDATE_LANDING_SITES } from "../data/landingSites";

export interface SiteDetailViewProps {
  siteSlug?: string;
  moonArrived?: boolean;
  onBackToPicker?: () => void;
  onSelectSite?: (slug: string) => void;
}

/**
 * Vista 3: Vista de Detalle (Análisis Local Profundo - Polo Sur Lunar)
 * Utiliza el sistema de componentes HUD modulares (HudCard) con inyección de datos reales.
 * Comparte el mismo Canvas 3D persistente de la Luna desde LocationPickerView para evitar parpadeos.
 */
export const SiteDetailView: React.FC<SiteDetailViewProps> = ({
  siteSlug = "shackleton-connecting-ridge",
  moonArrived = false,
  onBackToPicker,
  onSelectSite,
}) => {
  const site = useMemo(
    () =>
      CANDIDATE_LANDING_SITES.find((s) => s.slug === siteSlug) ||
      CANDIDATE_LANDING_SITES[0],
    [siteSlug]
  );

  // Estado reactivo de los sliders inicializado con los datos reales del sitio seleccionado
  const [criteriaValues, setCriteriaValues] = useState<Record<string, number>>({
    illumination: site.illuminationAvgPercent,
    slope: site.slopeDegrees,
    earthLink: site.earthVisibilityPercent,
  });

  useEffect(() => {
    setCriteriaValues({
      illumination: site.illuminationAvgPercent,
      slope: site.slopeDegrees,
      earthLink: site.earthVisibilityPercent,
    });
  }, [site]);

  const sliderItems: CriterionSliderItem[] = useMemo(
    () => [
      {
        id: "illumination",
        label: "Solar illumination threshold ↑",
        value: criteriaValues.illumination,
        min: 0,
        max: 100,
        step: 1,
        unit: "%",
      },
      {
        id: "slope",
        label: "Max terrain slope tolerance ↓",
        value: criteriaValues.slope,
        min: 0,
        max: 25,
        step: 0.5,
        formatValue: (v) => `${v.toFixed(1)}°`,
      },
      {
        id: "earthLink",
        label: "Direct-to-Earth (DTE) link ↑",
        value: criteriaValues.earthLink,
        min: 0,
        max: 100,
        step: 1,
        unit: "%",
      },
    ],
    [criteriaValues]
  );

  const handleCriterionChange = (id: string, newValue: number) => {
    setCriteriaValues((prev) => ({
      ...prev,
      [id]: newValue,
    }));
  };

  // KPI de viabilidad global calculado en vivo a partir de los parámetros
  const fulfilledKpiPercent = useMemo(() => {
    const slopeScore = Math.max(0, Math.min(100, ((25 - criteriaValues.slope) / 25) * 100));
    const score =
      criteriaValues.illumination * 0.45 +
      slopeScore * 0.25 +
      criteriaValues.earthLink * 0.3;
    return Math.max(0, Math.min(100, Math.round(score)));
  }, [criteriaValues]);

  // Estado de capas de telemetría ambiental (Card Inferior Izquierda)
  const [activeLayers, setActiveLayers] = useState<Record<string, boolean>>({
    "solar-flux": true,
    "thermal-gradient": true,
    "radiation-shield": true,
    "psr-ice": true,
    "dte-link": true,
  });

  const handleToggleIconCriterion = (id: string) => {
    setActiveLayers((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Controlador Temporal Superior
  const [hourOfDay, setHourOfDay] = useState<number>(12.0);
  const [missionDateIso, setMissionDateIso] = useState<string>("2026-11-18");

  // Datos inyectados en la lista de telemetría con iconos
  const iconCriteriaItems: CriterionIconListItem[] = useMemo(() => {
    const solarFlux = Math.round(1361 * (criteriaValues.illumination / 100));
    const tempCelsius = Math.round(-210 + (criteriaValues.illumination / 100) * 95);

    return [
      {
        id: "solar-flux",
        label: "Solar Flux Incidence",
        value: `${solarFlux} W/m²`,
        icon: "sun",
        active: activeLayers["solar-flux"],
      },
      {
        id: "thermal-gradient",
        label: "Surface Thermal Mean",
        value: `${tempCelsius} °C`,
        icon: "thermometer",
        active: activeLayers["thermal-gradient"],
      },
      {
        id: "radiation-shield",
        label: "Radiation Exposure",
        value: "0.42 mSv/d",
        icon: "radiation",
        active: activeLayers["radiation-shield"],
      },
      {
        id: "psr-ice",
        label: "PSR Volatile Basin",
        value: `${site.permanentShadowAreaKm2} km²`,
        icon: "ice",
        active: activeLayers["psr-ice"],
      },
      {
        id: "dte-link",
        label: "DTE Telemetry Lock",
        value: `${Math.round(criteriaValues.earthLink)}%`,
        icon: "broadcast",
        active: activeLayers["dte-link"],
      },
    ];
  }, [criteriaValues, site, activeLayers]);

  // Filas de la tarjeta derecha de 2 columnas (resumen vs expandido)
  const rightGridRows: CriteriaGridRow[] = useMemo(
    () => [
      {
        id: "coords",
        leftSubtext: "Latitude",
        leftText: `${Math.abs(site.coordinates.lat)}° S`,
        rightSubtext: "Longitude",
        rightText: `${site.coordinates.lng}° E`,
      },
      {
        id: "topo",
        leftSubtext: "Elevation",
        leftText: `${site.elevationMeters} m`,
        rightSubtext: "Mean Slope",
        rightText: `${criteriaValues.slope.toFixed(1)}°`,
      },
      {
        id: "links",
        leftSubtext: "Solar Avg",
        leftText: `${Math.round(criteriaValues.illumination)}%`,
        rightSubtext: "Earth LoS",
        rightText: `${Math.round(criteriaValues.earthLink)}%`,
      },
    ],
    [site, criteriaValues]
  );

  const rightGridExpandedRows: CriteriaGridRow[] = useMemo(() => {
    const sunAzimuth = Math.round((hourOfDay / 24) * 360);
    const sunElev = (1.5 * Math.sin((hourOfDay / 24) * Math.PI * 2)).toFixed(2);
    return [
      {
        id: "ephem-1",
        leftSubtext: "Sun Azimuth",
        leftText: `${sunAzimuth}°`,
        rightSubtext: "Sun Elevation",
        rightText: `${sunElev}°`,
      },
      {
        id: "ephem-2",
        leftSubtext: "PSR Cold Trap",
        leftText: `${site.permanentShadowAreaKm2} km²`,
        rightSubtext: "Regolith Albedo",
        rightText: "0.12 (Highland)",
      },
      {
        id: "ephem-3",
        leftSubtext: "Mission Date",
        leftText: missionDateIso,
        rightSubtext: "UTC Epoch",
        rightText: `${String(Math.floor(hourOfDay)).padStart(2, "0")}:00 UTC`,
      },
    ];
  }, [hourOfDay, site, missionDateIso]);

  // Días de luz continua estimados según el porcentaje de iluminación
  const continuousSunlightDays = useMemo(() => {
    return Math.max(1, Math.round((criteriaValues.illumination / 100) * 18));
  }, [criteriaValues.illumination]);

  // Estados de la coreografía secuencial de entrada:
  // 1. La Luna persistente se encoge y traslada lentamente a la esquina inferior derecha (siempre dentro de la pantalla).
  // 2. Al llegar (moonArrived = true), pinta su eje Y al mismo tiempo que entra la UI desde sus bordes con ease-out.
  // 3. Por último (y solo cuando las texturas del mapa hayan cargado), sube el mapa 3D desde abajo con ease-out.
  const [mapLoaded, setMapLoaded] = useState<boolean>(false);
  const [allowMapEntrance, setAllowMapEntrance] = useState<boolean>(false);

  useEffect(() => {
    setAllowMapEntrance(false);
  }, [siteSlug]);

  useEffect(() => {
    if (!moonArrived) {
      setAllowMapEntrance(false);
      return;
    }
    const timer = setTimeout(() => {
      setAllowMapEntrance(true);
    }, 450);
    return () => clearTimeout(timer);
  }, [moonArrived]);

  const showMap = allowMapEntrance && mapLoaded;

  // Posición de la luz solar 3D controlada por el slider horario
  const lightPosition: [number, number, number] = useMemo(() => {
    const sunAzimuth = (hourOfDay / 24) * 360;
    const sunElevation = 1.5 * Math.sin((hourOfDay / 24) * Math.PI * 2);
    const radAz = (sunAzimuth * Math.PI) / 180;
    const radEl = (sunElevation * Math.PI) / 180;
    const dist = 80;
    return [
      dist * Math.cos(radEl) * Math.sin(radAz),
      Math.max(dist * Math.sin(radEl), 14),
      dist * Math.cos(radEl) * Math.cos(radAz),
    ];
  }, [hourOfDay]);

  return (
    <div className="absolute inset-0 bg-transparent overflow-hidden select-none pointer-events-none">
      {/* Botón de retorno al selector global (entra junto con la UI desde arriba) */}
      {onBackToPicker && (
        <button
          type="button"
          onClick={onBackToPicker}
          style={{
            transform: moonArrived ? "translateY(0)" : "translateY(-80px)",
            opacity: moonArrived ? 1 : 0,
            transition: "transform 0.75s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.6s ease-out",
          }}
          className="pointer-events-auto absolute left-[clamp(1.25rem,4.4vw,4rem)] top-[clamp(0.75rem,2vh,1.25rem)] z-30 inline-flex items-center gap-1.5 px-[clamp(0.65rem,0.9vw,0.875rem)] py-[clamp(0.2rem,0.45vh,0.35rem)] rounded-full bg-[#3B3B40]/30 hover:bg-[#3B3B40]/50 border border-white/15 text-[#D9CEC5] font-sans text-[clamp(0.68rem,1.25vh,0.75rem)] backdrop-blur-md transition-colors cursor-pointer"
        >
          <span>&larr;</span>
          <span>{site.name}</span>
        </button>
      )}

      {/* PASO 3: Canvas 3D Principal del Mapa Topográfico (Se monta cuando la Luna arriba a su slot para no bloquear la animación de transición) */}
      <div
        className={`absolute inset-0 z-[5] ${
          showMap ? "pointer-events-auto" : "pointer-events-none [&_*]:!pointer-events-none"
        }`}
        style={{
          transform: showMap ? "translateY(0)" : "translateY(65vh)",
          opacity: showMap ? 1 : 0,
          transition: "transform 0.95s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.75s ease-out",
        }}
      >
        {moonArrived && (
          <Canvas
            gl={{ alpha: true, antialias: true }}
            camera={{ position: [0, 56, 84], fov: 36, near: 0.5, far: 300 }}
          >
            <ambientLight intensity={0.28} color="#7F7B8C" />

            <directionalLight
              position={lightPosition}
              intensity={2.35}
              color="#FFFFFF"
            />

            <directionalLight
              position={[45, 28, -45]}
              intensity={0.45}
              color="#D9CEC5"
            />

            <Suspense fallback={null}>
              <LunarSurface
                size={76}
                displacementScale={12.5}
                displacementBias={-2.5}
                normalScale={1.85}
                roughness={0.94}
                metalness={0.02}
                position={[0, -14.5, 4]}
                rotation={[0, Math.PI / 4, 0]}
                showDioramaBase={true}
                onLoaded={() => setMapLoaded(true)}
              />
            </Suspense>

            <OrbitControls
              target={[0, -2, 0]}
              enablePan={false}
              enableDamping
              dampingFactor={0.05}
              minPolarAngle={Math.PI / 4.2}
              maxPolarAngle={Math.PI / 2.35}
              minDistance={60}
              maxDistance={115}
              rotateSpeed={0.55}
            />
          </Canvas>
        )}
      </div>

      {/* PASO 2A: Controlador Temporal Superior (Entra de arriba hacia abajo con ease-out cuando llega la Luna) */}
      <div
        className="absolute inset-x-0 top-0 z-20 pointer-events-none"
        style={{
          transform: moonArrived ? "translateY(0)" : "translateY(-140px)",
          opacity: moonArrived ? 1 : 0,
          transition: "transform 0.75s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.6s ease-out",
        }}
      >
        <TopTemporalController
          hour={hourOfDay}
          onChangeHour={setHourOfDay}
          dateIso={missionDateIso}
          onChangeDate={setMissionDateIso}
          telemetryBadge={`Az ${Math.round((hourOfDay / 24) * 360)}° · El ${(
            1.5 * Math.sin((hourOfDay / 24) * Math.PI * 2)
          ).toFixed(1)}°`}
        />
      </div>

      {/* =========================================================================
          PASO 2B: COLUMNA HUD IZQUIERDA (Entra desde el borde izquierdo hacia adentro con ease-out)
          Dimensionada con unidades relativas (vh/vw/clamp) para encajar siempre en pantalla con espaciado uniforme
         ========================================================================= */}
      <aside
        className="absolute left-[clamp(1.25rem,4.4vw,4rem)] top-[clamp(3.1rem,6.2vh,4rem)] bottom-[clamp(0.75rem,2.5vh,1.75rem)] w-[clamp(260px,23.5vw,336px)] z-20 flex flex-col justify-between gap-[clamp(0.45rem,1.4vh,1rem)] pointer-events-none"
        style={{
          transform: moonArrived ? "translateX(0)" : "translateX(-430px)",
          opacity: moonArrived ? 1 : 0,
          transition: "transform 0.75s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.6s ease-out",
        }}
      >
        <CriteriaSlidersCard
          title="Fulfilled criteria"
          items={sliderItems}
          onChange={handleCriterionChange}
          className="w-full shrink"
        />

        <CriteriaKpiCard
          title="Fulfilled criteria"
          value={fulfilledKpiPercent}
          unit="%"
          badgeText={fulfilledKpiPercent >= 75 ? "OPTIMAL" : "MARGINAL"}
          subtitle="Viable landing zone ↑"
          className="w-full shrink"
        />

        <CriteriaIconListCard
          title="Environmental telemetry"
          items={iconCriteriaItems}
          onToggleItem={handleToggleIconCriterion}
          className="w-full shrink"
        />
      </aside>

      {/* =========================================================================
          PASO 2C: COLUMNA HUD DERECHA (Entra desde el borde derecho hacia adentro con ease-out)
          Dimensionada con unidades relativas (vh/vw/clamp) para encajar siempre en pantalla con espaciado uniforme
         ========================================================================= */}
      <aside className="absolute right-[clamp(1.25rem,4.4vw,4rem)] top-[clamp(2.75rem,5.2vh,3.5rem)] bottom-[clamp(0.75rem,2.5vh,1.75rem)] w-[clamp(270px,25vw,360px)] z-20 flex flex-col items-end justify-between gap-[clamp(0.45rem,1.3vh,0.875rem)] pointer-events-none">
        <div
          className="w-full flex flex-col items-end gap-[clamp(0.45rem,1.3vh,0.875rem)] shrink"
          style={{
            transform: moonArrived ? "translateX(0)" : "translateX(450px)",
            opacity: moonArrived ? 1 : 0,
            transition: "transform 0.75s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.6s ease-out",
          }}
        >
          {/* Radar polar de orientación: Matriz 2x2, líneas discontinuas y recuadro en % */}
          <div className="pointer-events-auto shrink-0">
            <SouthPoleMinimap
              currentSiteSlug={site.slug}
              onSelectSite={onSelectSite}
            />
          </div>

          <CriteriaGridCard
            title="Site telemetry"
            actionLabel="see more"
            rows={rightGridRows}
            expandedRows={rightGridExpandedRows}
            className="w-full shrink"
          />

          <CriteriaDaysKpiCard
            title="Solar window"
            days={continuousSunlightDays}
            unitLabel="days"
            className="w-full shrink"
          />
        </div>

        {/* Contenedor transparente de la mini Luna con dimensiones relativas y padding proporcional */}
        <HudCard
          id="mini-moon-card-slot"
          variant="transparent"
          padding="none"
          className="w-full h-[clamp(115px,18.5vh,200px)] pr-[clamp(0.75rem,1.35vw,1.25rem)] pb-[clamp(0.5rem,1.2vh,1rem)] flex items-end justify-end shrink-0 mt-auto pointer-events-auto"
          ariaLabel="Mini globe 3D container slot"
        >
          {/* Área interactiva anclada a la mini Luna: al hacer clic regresa a la vista de picker */}
          <button
            type="button"
            id="mini-moon-target"
            onClick={onBackToPicker}
            title="Presiona para regresar a la vista de selector de ubicación"
            aria-label="Regresar a vista de selección"
            className="h-full aspect-square rounded-full pointer-events-auto cursor-pointer bg-transparent border-0 outline-none p-0 transition-transform duration-200 hover:scale-105 active:scale-95 group focus:outline-none"
          />
        </HudCard>
      </aside>
    </div>
  );
};

export default SiteDetailView;
