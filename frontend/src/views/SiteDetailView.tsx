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
  MapLegendCard,
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

  // Mapeo del sitio candidato seleccionado al preset correspondiente en el mapa 3D
  const initialPresetSite = useMemo(() => {
    return (
      PRESET_SITES.find(
        (p) =>
          p.id.toLowerCase() === siteSlug.toLowerCase() ||
          p.id.toLowerCase() === site.slug.toLowerCase() ||
          p.name.toLowerCase() === site.name.toLowerCase()
      ) || PRESET_SITES[0]
    );
  }, [siteSlug, site]);

  // Estado del sitio enfocado dentro del nuevo visor 3D (diorama + capas holográficas + vuelo de cámara)
  // Al seleccionar en el picker entra directamente en vista detalle del sitio seleccionado
  const [selectedMapSite, setSelectedMapSite] = useState<PresetSite | null>(initialPresetSite);
  const [flightId, setFlightId] = useState<number>(1);

  const handleMapLoaded = useCallback(() => {
    setMapLoaded(true);
  }, []);

  const handleSelectMapSite = useCallback((clickedSite: PresetSite) => {
    setSelectedMapSite((prev) => (prev?.id === clickedSite.id ? null : clickedSite));
    setFlightId((n) => n + 1);
  }, []);

  const isOverview = selectedMapSite === null;

  // Alterna entre la vista general del mapa polar y la vista detalle del sitio activo
  const handleToggleOverview = useCallback(() => {
    if (selectedMapSite) {
      setSelectedMapSite(null);
      setFlightId((n) => n + 1);
    } else {
      setSelectedMapSite(initialPresetSite);
      setFlightId((n) => n + 1);
    }
  }, [selectedMapSite, initialPresetSite]);

  const handleSelectSiteFromMinimap = useCallback(
    (slug: string) => {
      onSelectSite?.(slug);
      const targetPreset = PRESET_SITES.find((p) => p.id === slug) || null;
      if (targetPreset) {
        setSelectedMapSite(targetPreset);
        setFlightId((n) => n + 1);
      }
    },
    [onSelectSite]
  );

  useEffect(() => {
    setAllowMapEntrance(false);
    setSelectedMapSite(initialPresetSite);
    setFlightId((n) => n + 1);
  }, [siteSlug, initialPresetSite]);

  useEffect(() => {
    if (!moonArrived) {
      setAllowMapEntrance(false);
      return;
    }
    setFlightId((n) => n + 1);
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
      {/* Botón de retorno al selector global (entra junto con la UI desde arriba con padding y espaciado generoso) */}
      {onBackToPicker && (
        <button
          type="button"
          onClick={onBackToPicker}
          style={{
            transform: moonArrived ? "translateY(0)" : "translateY(-80px)",
            opacity: moonArrived ? 1 : 0,
            transition: "transform 0.75s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.6s ease-out",
          }}
          className="pointer-events-auto absolute left-[clamp(1.25rem,4.4vw,4rem)] top-[clamp(1.2rem,2.5vh,1.75rem)] z-30 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#3B3B40]/45 hover:bg-[#3B3B40]/75 border border-white/20 text-[#D9CEC5] font-sans text-xs backdrop-blur-md transition-all shadow-[0_2px_8px_rgba(0,0,0,0.3)] cursor-pointer hover:scale-[1.03] active:scale-[0.98]"
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
          transform: showMap ? "translateY(clamp(45px, 13vh, 125px))" : "translateY(75vh)",
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
                position: [0, -18, 0], // Bloque posicionado bajo la cota de flotación
                rotation: [0, Math.PI / 4, 0], // Orientación isométrica en diamante a 45°
              }}
              earth={{
                visible: activeLayers["dte-link"],
                targetPosition: [40, 50, -30],
                color: "#38BDF8", // Azul táctico Direct-to-Earth
              }}
              grid={{
                visible: activeLayers["solar-flux"],
                height: 25,
                opacity: 0.14,
                centerColor: "#A6948A", // palette-ochre oficial
                gridColor: "#3B3B40",   // palette-charcoal oficial
              }}
              camera={{
                initialPosition: [32, 14, 51.2],
                target: [4.8, -4.5, -7.7],
                fov: 38,
                flyOffset: [27.2, 21.0, 58.9],
                targetOffset: [0, 4.5, 0], // Desplaza el punto focal sobre el terreno para que el diorama comience casi tocando el borde inferior
                lerpFactor: 0.06,
                minDistance: 30,
                maxDistance: 150,
              }}
              showStars={false}
              showDebugHud={false}
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
          Con espaciado vertical suficiente para no solaparse jamás con el botón superior
         ========================================================================= */}
      <aside
        className="absolute left-[clamp(1rem,3.8vw,4rem)] top-[clamp(4.1rem,8.2vh,5.2rem)] bottom-[clamp(0.5rem,2vh,1.5rem)] w-[clamp(250px,22vw,336px)] z-20 flex flex-col justify-start gap-[clamp(0.5rem,1.4vh,1.1rem)] max-h-[calc(100vh-clamp(4.8rem,9.5vh,6.5rem))] pointer-events-none overflow-y-auto pr-1"
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
          className="w-full shrink min-h-0 pointer-events-auto"
        />

        <CriteriaKpiCard
          title="Fulfilled criteria"
          value={fulfilledKpiPercent}
          unit="%"
          badgeText={fulfilledKpiPercent >= 75 ? "OPTIMAL" : "MARGINAL"}
          subtitle="Viable landing zone ↑"
          className="w-fit self-start shrink-0 min-h-0 pointer-events-auto"
        />

        <CriteriaIconListCard
          title="Environmental telemetry"
          items={iconCriteriaItems}
          onToggleItem={handleToggleIconCriterion}
          className="w-full shrink min-h-0 pointer-events-auto"
        />

        <MapLegendCard
          title="Simbología e Indicadores"
          className="w-full shrink min-h-0 pointer-events-auto"
        />
      </aside>

      {/* =========================================================================
          PASO 2C: COLUMNA HUD DERECHA (Entra desde el borde derecho hacia adentro con ease-out)
          Dimensionada con unidades relativas (vh/vw/clamp) para encajar siempre en pantalla con espaciado uniforme
         ========================================================================= */}
      <aside className="absolute right-[clamp(1rem,3.8vw,4rem)] top-[clamp(2.25rem,4.8vh,3.25rem)] bottom-[clamp(0.5rem,2vh,1.5rem)] w-[clamp(260px,23.5vw,360px)] z-20 flex flex-col items-end justify-between gap-[clamp(0.35rem,1.1vh,0.75rem)] max-h-[calc(100vh-clamp(3.2rem,6.8vh,4.75rem))] pointer-events-none">
        <div
          className="w-full flex flex-col items-end gap-[clamp(0.85rem,2vh,1.4rem)] shrink min-h-0"
          style={{
            transform: moonArrived ? "translateX(0)" : "translateX(450px)",
            opacity: moonArrived ? 1 : 0,
            transition: "transform 0.75s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.6s ease-out",
          }}
        >
          {/* Radar polar de orientación: Matriz 2x2, leyenda táctica interactiva y alternancia de vistas */}
          <div className="pointer-events-auto shrink-0 flex flex-col items-end gap-[clamp(0.3rem,0.7vh,0.55rem)] w-full max-w-full">
            {/* Leyenda interactiva sobre el minimapa: indica si está en detalle o general y la acción al hacer clic */}
            <button
              type="button"
              onClick={handleToggleOverview}
              title={
                isOverview
                  ? "Presiona para volver a la vista detalle del sitio"
                  : "Presiona para ver el mapa general del Polo Sur"
              }
              aria-label={
                isOverview
                  ? "Cambiar a vista detalle del sitio"
                  : "Cambiar a vista general del Polo Sur"
              }
              className="group flex items-center gap-2 px-[clamp(0.55rem,0.85vw,0.75rem)] py-[clamp(0.25rem,0.5vh,0.35rem)] rounded-full bg-palette-obsidian/85 hover:bg-palette-charcoal/85 border border-palette-slate/40 hover:border-palette-cream/40 transition-all duration-200 backdrop-blur-md cursor-pointer shadow-[0_2px_10px_rgba(0,0,0,0.55)] focus:outline-none"
            >
              <span
                className={`inline-block w-2 h-2 rounded-full transition-colors ${
                  isOverview
                    ? "bg-palette-ochre shadow-[0_0_8px_#A6948A]"
                    : "bg-palette-cream shadow-[0_0_8px_#D9CEC5] animate-pulse"
                }`}
              />
              <span className="font-heading font-bold text-[clamp(9px,1vh,11px)] tracking-wider uppercase text-palette-cream/90">
                {isOverview ? "VISTA GENERAL" : "VISTA DETALLE"}
              </span>
              <span className="font-sans text-[clamp(9px,0.95vh,10.5px)] text-palette-slate group-hover:text-palette-cream transition-colors">
                {isOverview ? "· Clic: Detalle ↩" : "· Clic: General ↗"}
              </span>
            </button>

            {/* Minimapa polar interactivo: crece en el alto disponible, forma cuadrada y ancho limitado a la card inferior */}
            <div
              onClick={handleToggleOverview}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleToggleOverview();
                }
              }}
              title={
                isOverview
                  ? "Presiona el mapa para volver a la vista detalle"
                  : "Presiona el mapa para ver la vista general"
              }
              aria-label="Alternar entre vista general y vista detalle"
              className="relative cursor-pointer group rounded-full transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-palette-cream/40 w-[clamp(170px,26vh,100%)] max-w-full aspect-square"
            >
              <SouthPoleMinimap
                currentSiteSlug={site.slug}
                onSelectSite={handleSelectSiteFromMinimap}
                isOverview={isOverview}
                className="w-full h-full aspect-square"
              />
              {/* Overlay hover táctico sutil */}
              <div className="absolute inset-0 rounded-full bg-palette-cream/0 group-hover:bg-palette-cream/10 transition-colors pointer-events-none" />
            </div>
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
            className="w-fit self-end shrink-0 min-h-0"
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
