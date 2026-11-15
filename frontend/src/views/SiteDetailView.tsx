"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import presetSitesData from "../../public/data/preset_sites.json";
import { LunarMapViewer } from "../components/3d_canvas/LunarMapViewer";
import {
  SiteProvider,
  type PresetSite,
  type PresetSitesFile,
} from "../lib/context/SiteContext";
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

const PRESET_SITES: PresetSite[] = (presetSitesData as PresetSitesFile).sites;

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
  siteSlug = "shackleton-rim",
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

  // Estado del sitio enfocado dentro del nuevo visor 3D (diorama + capas holográficas + vuelo de cámara)
  const [selectedMapSite, setSelectedMapSite] = useState<PresetSite | null>(null);
  const [flightId, setFlightId] = useState<number>(0);

  const handleMapLoaded = useCallback(() => {
    setMapLoaded(true);
  }, []);

  const handleSelectMapSite = useCallback((clickedSite: PresetSite) => {
    setSelectedMapSite((prev) => (prev?.id === clickedSite.id ? null : clickedSite));
    setFlightId((n) => n + 1);
  }, []);

  useEffect(() => {
    setAllowMapEntrance(false);
    setSelectedMapSite(null);
  }, [siteSlug]);

  useEffect(() => {
    if (!moonArrived) {
      setAllowMapEntrance(false);
      return;
    }
    const timer = setTimeout(() => {
      setAllowMapEntrance(true);
    }, 450);
    // Respaldo de seguridad para garantizar que el contenedor del mapa nunca quede bloqueado en opacidad 0
    const fallbackLoaded = setTimeout(() => {
      setMapLoaded(true);
    }, 1200);
    return () => {
      clearTimeout(timer);
      clearTimeout(fallbackLoaded);
    };
  }, [moonArrived]);

  const showMap = allowMapEntrance && mapLoaded;

  // Azimut solar controlado por el slider horario superior (TopTemporalController)
  const sunAzimuthDeg = useMemo(() => (hourOfDay / 24) * 360, [hourOfDay]);

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
          <SiteProvider>
            <LunarMapViewer
              sites={PRESET_SITES}
              selectedSite={selectedMapSite}
              onSelectSite={handleSelectMapSite}
              flightId={flightId}
              sun={{
                angle: sunAzimuthDeg + 45, // Ajustado para iluminar con rasante lateral contrastada
                height: 18,
                intensity: 2.8,
                ambientIntensity: 0.18,
              }}
              zones={{
                visible: true,
                color: "#D9CEC5", // palette-cream oficial
                edgeOpacity: 0.8,
                gradientPower: 1.6,
                emissiveIntensity: 0.85,
              }}
              markers={{
                visible: true,
                poleHeight: 2,
              }}
              terrain={{
                size: 78,
                displacementScale: 4.8,
                displacementBias: -2.2,
                showPedestal: true,
                pedestalDepth: 5.5,
                pedestalColor: "#0D0D0D", // palette-obsidian oficial
                focusRadius: 15.0,
                cutoutShape: "square",
                rotation: [0, Math.PI / 4, 0], // Orientación isométrica en diamante a 45°
              }}
              earth={{
                visible: activeLayers["dte-link"],
                targetPosition: [40, 50, -30],
                color: "#D9CEC5", // palette-cream oficial
              }}
              grid={{
                visible: activeLayers["solar-flux"],
                height: 25,
                opacity: 0.14,
                centerColor: "#A6948A", // palette-ochre oficial
                gridColor: "#3B3B40",   // palette-charcoal oficial
              }}
              camera={{
                initialPosition: [0, 52, 95],
                target: [0, -10, 0],
                fov: 38,
                flyOffset: [6, 8, 10],
                lerpFactor: 0.06,
                minDistance: 45,
                maxDistance: 140,
              }}
              showStars={false}
              className="relative w-full h-full bg-transparent"
              onLoaded={handleMapLoaded}
            />
          </SiteProvider>
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
        className="absolute left-[clamp(1rem,3.8vw,4rem)] top-[clamp(2.5rem,5.2vh,3.75rem)] bottom-[clamp(0.5rem,2vh,1.5rem)] w-[clamp(250px,22vw,336px)] z-20 flex flex-col justify-between gap-[clamp(0.35rem,1.1vh,0.85rem)] max-h-[calc(100vh-clamp(3.2rem,6.8vh,4.75rem))] pointer-events-none"
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
          className="w-full shrink min-h-0"
        />

        <CriteriaKpiCard
          title="Fulfilled criteria"
          value={fulfilledKpiPercent}
          unit="%"
          badgeText={fulfilledKpiPercent >= 75 ? "OPTIMAL" : "MARGINAL"}
          subtitle="Viable landing zone ↑"
          className="w-full shrink min-h-0"
        />

        <CriteriaIconListCard
          title="Environmental telemetry"
          items={iconCriteriaItems}
          onToggleItem={handleToggleIconCriterion}
          className="w-full shrink min-h-0"
        />
      </aside>

      {/* =========================================================================
          PASO 2C: COLUMNA HUD DERECHA (Entra desde el borde derecho hacia adentro con ease-out)
          Dimensionada con unidades relativas (vh/vw/clamp) para encajar siempre en pantalla con espaciado uniforme
         ========================================================================= */}
      <aside className="absolute right-[clamp(1rem,3.8vw,4rem)] top-[clamp(2.25rem,4.8vh,3.25rem)] bottom-[clamp(0.5rem,2vh,1.5rem)] w-[clamp(260px,23.5vw,360px)] z-20 flex flex-col items-end justify-between gap-[clamp(0.35rem,1.1vh,0.75rem)] max-h-[calc(100vh-clamp(3.2rem,6.8vh,4.75rem))] pointer-events-none">
        <div
          className="w-full flex flex-col items-end gap-[clamp(0.35rem,1vh,0.75rem)] shrink min-h-0"
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
            className="w-full shrink min-h-0"
          />

          <CriteriaDaysKpiCard
            title="Solar window"
            days={continuousSunlightDays}
            unitLabel="days"
            className="w-full shrink min-h-0"
          />
        </div>

        {/* Contenedor transparente de la mini Luna con dimensiones relativas y padding proporcional */}
        <HudCard
          id="mini-moon-card-slot"
          variant="transparent"
          padding="none"
          className="w-full h-[clamp(90px,15.5vh,185px)] pr-[clamp(0.6rem,1.2vw,1.15rem)] pb-[clamp(0.4rem,1vh,0.85rem)] flex items-end justify-end shrink-0 mt-auto pointer-events-auto"
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
