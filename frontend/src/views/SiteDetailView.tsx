"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { LunarMapViewer } from "../components/3d_canvas/LunarMapViewer";
import {
  SiteProvider,
  type PresetSite,
} from "../lib/context/SiteContext";
import {
  fetchSiteTimeline,
  type SiteTimeline,
  type TimelinePoint,
} from "../lib/api";
import { celestialDirectionToScene } from "../lib/geo/celestial";
import { toPresetSite } from "../lib/siteAdapters";
import type { LandingSite } from "../types";
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

export interface SiteDetailViewProps {
  siteId: string;
  sites: LandingSite[];
  moonArrived?: boolean;
  onBackToPicker?: () => void;
  onSelectSite?: (siteId: string) => void;
}

interface SolarWindowEstimate {
  startIndex: number;
  startTimestamp: string;
  endTimestamp: string;
  durationHours: number;
  continuesAtForecastEnd: boolean;
}

function findNextSolarWindow(
  points: TimelinePoint[],
  fromIndex: number
): SolarWindowEstimate | null {
  for (let startIndex = fromIndex; startIndex < points.length; startIndex += 1) {
    if (!points[startIndex].is_sun_full_disk_visible) continue;

    let endIndex = startIndex;
    while (
      endIndex + 1 < points.length &&
      points[endIndex + 1].is_sun_full_disk_visible
    ) {
      endIndex += 1;
    }

    const startTimestamp = points[startIndex].timestamp_utc;
    const nextPoint = points[endIndex + 1];
    const endTimestamp =
      nextPoint?.timestamp_utc ?? points[endIndex].timestamp_utc;

    return {
      startIndex,
      startTimestamp,
      endTimestamp,
      durationHours:
        (Date.parse(endTimestamp) - Date.parse(startTimestamp)) / 3_600_000,
      continuesAtForecastEnd: !nextPoint,
    };
  }

  return null;
}

function formatDurationHours(durationHours: number): string {
  const totalHours = Math.max(0, Math.round(durationHours));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return days > 0 ? `${days}d ${hours}h` : `${hours} h`;
}

function formatUtcDateTime(timestamp: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(new Date(timestamp));
}

/**
 * Vista 3: Vista de Detalle (Análisis Local Profundo - Polo Sur Lunar)
 * Utiliza el sistema de componentes HUD modulares (HudCard) con inyección de datos reales.
 * Comparte el mismo Canvas 3D persistente de la Luna desde LocationPickerView para evitar parpadeos.
 */
export const SiteDetailView: React.FC<SiteDetailViewProps> = ({
  siteId,
  sites,
  moonArrived = false,
  onBackToPicker,
  onSelectSite,
}) => {
  const site = useMemo(
    () => sites.find((candidate) => candidate.id === siteId) ?? null,
    [sites, siteId]
  );

  const [timeline, setTimeline] = useState<SiteTimeline | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineError, setTimelineError] = useState<string | null>(null);
  const [timelineRetry, setTimelineRetry] = useState(0);
  const [selectedPointIndex, setSelectedPointIndex] = useState(0);

  useEffect(() => {
    if (!site) {
      setTimeline(null);
      return;
    }

    let active = true;
    setTimeline(null);
    setTimelineLoading(true);
    setTimelineError(null);
    setSelectedPointIndex(0);

    fetchSiteTimeline(site.id)
      .then((result) => {
        if (!active) return;
        if (result.points.length === 0) {
          throw new Error(`El timeline de ${result.name} no contiene muestras.`);
        }
        setTimeline(result);
      })
      .catch((error: unknown) => {
        if (active) {
          setTimelineError(error instanceof Error ? error.message : String(error));
        }
      })
      .finally(() => {
        if (active) setTimelineLoading(false);
      });

    return () => {
      active = false;
    };
  }, [site?.id, timelineRetry]);

  const timelinePoints = timeline?.points ?? [];
  const currentIndex = timelinePoints.length
    ? Math.max(0, Math.min(timelinePoints.length - 1, selectedPointIndex))
    : 0;
  const selectedPoint = timelinePoints[currentIndex] ?? null;
  const firstPoint = timelinePoints[0];
  const lastPoint = timelinePoints[timelinePoints.length - 1];
  const nextSolarWindow = useMemo(
    () => findNextSolarWindow(timelinePoints, currentIndex),
    [timelinePoints, currentIndex]
  );
  const solarWindowValue = !selectedPoint
    ? "N/D"
    : !nextSolarWindow
    ? "NONE"
    : nextSolarWindow.continuesAtForecastEnd &&
      nextSolarWindow.durationHours === 0
    ? "ACTIVE"
    : `${nextSolarWindow.continuesAtForecastEnd ? "≥" : ""}${formatDurationHours(
        nextSolarWindow.durationHours
      )}`;
  const solarWindowSubtitle = !selectedPoint
    ? timelineLoading
      ? "Loading forecast..."
      : timelineError
      ? "Timeline could not be loaded"
      : "No timeline sample selected"
    : !nextSolarWindow
    ? "No full-disk window remains in this forecast"
    : nextSolarWindow.continuesAtForecastEnd
    ? `${
        nextSolarWindow.startIndex === currentIndex
          ? "From selected time"
          : "Next window"
      }: visible from ${formatUtcDateTime(
        nextSolarWindow.startTimestamp
      )} UTC; forecast ends during visibility · hourly estimate`
    : `${
        nextSolarWindow.startIndex === currentIndex
          ? "From selected time"
          : "Next window"
      }: ${formatUtcDateTime(
        nextSolarWindow.startTimestamp
      )}–${formatUtcDateTime(nextSolarWindow.endTimestamp)} UTC · hourly estimate`;

  const sliderItems: CriterionSliderItem[] = useMemo(
    () =>
      site
        ? [
            {
              id: "illumination",
              label: "Sun center visible",
              value: site.illuminationAvgPercent,
              readOnly: true,
              unit: "%",
            },
            {
              id: "earthLink",
              label: "Earth center visible",
              value: site.earthVisibilityPercent,
              readOnly: true,
              unit: "%",
            },
          ]
        : [],
    [site]
  );

  // Estado de capas de telemetría ambiental (Card Inferior Izquierda)
  const [activeLayers, setActiveLayers] = useState<Record<string, boolean>>({
    sun: true,
    earth: true,
    "dte-link": true,
    "earth-distance": true,
    "earth-rtt": true,
    "earth-phase": true,
  });

  const handleToggleIconCriterion = (id: string) => {
    setActiveLayers((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const dateIso = selectedPoint?.timestamp_utc.slice(0, 10) ?? "";
  const minDate = firstPoint?.timestamp_utc.slice(0, 10) ?? "";
  const maxDate = lastPoint?.timestamp_utc.slice(0, 10) ?? "";
  const selectedHour = selectedPoint
    ? new Date(selectedPoint.timestamp_utc).getUTCHours() +
      new Date(selectedPoint.timestamp_utc).getUTCMinutes() / 60
    : 0;

  const selectNearestPointForDate = useCallback(
    (date: string) => {
      if (!timelinePoints.length) return;
      const target = Date.parse(`${date}T${String(Math.floor(selectedHour)).padStart(2, "0")}:00:00Z`);
      let nearestIndex = 0;
      let nearestDistance = Number.POSITIVE_INFINITY;
      timelinePoints.forEach((point, index) => {
        const distance = Math.abs(Date.parse(point.timestamp_utc) - target);
        if (distance < nearestDistance) {
          nearestIndex = index;
          nearestDistance = distance;
        }
      });
      setSelectedPointIndex(nearestIndex);
    },
    [selectedHour, timelinePoints]
  );

  const iconCriteriaItems: CriterionIconListItem[] = useMemo(() => {
    return [
      {
        id: "sun",
        label: "Solar visibility",
        value: selectedPoint
          ? selectedPoint.is_sun_full_disk_visible
            ? "Full disk"
            : selectedPoint.is_sun_any_part_visible
            ? "Partial"
            : "Blocked"
          : "N/D",
        icon: "sun",
        active: activeLayers.sun,
      },
      {
        id: "earth",
        label: "Earth visibility",
        value: selectedPoint
          ? selectedPoint.is_earth_full_disk_visible
            ? "Full disk"
            : selectedPoint.is_earth_any_part_visible
            ? "Partial"
            : "Blocked"
          : "N/D",
        icon: "compass",
        active: activeLayers.earth,
      },
      {
        id: "dte-link",
        label: "Direct-to-Earth link",
        value: selectedPoint ? (selectedPoint.is_earth_visible ? "Available" : "Blocked") : "N/D",
        icon: "broadcast",
        active: activeLayers["dte-link"],
      },
      {
        id: "earth-distance",
        label: "Earth distance",
        value: selectedPoint ? `${Math.round(selectedPoint.earth_distance_km).toLocaleString()} km` : "N/D",
        icon: "compass",
        active: activeLayers["earth-distance"],
      },
      {
        id: "earth-rtt",
        label: "Earth round-trip latency",
        value: selectedPoint ? `${selectedPoint.earth_latency_rtt_sec.toFixed(3)} s` : "N/D",
        icon: "broadcast",
        active: activeLayers["earth-rtt"],
      },
      {
        id: "earth-phase",
        label: "Earth phase angle",
        value: selectedPoint?.earth_phase_angle_deg == null
          ? "N/D"
          : `${selectedPoint.earth_phase_angle_deg.toFixed(2)}°`,
        icon: "compass",
        active: activeLayers["earth-phase"],
      },
    ];
  }, [selectedPoint, activeLayers]);

  const rightGridRows: CriteriaGridRow[] = useMemo(
    () => site
      ? [
          {
            id: "coords",
            leftSubtext: "Latitude",
            leftText: `${site.coordinates.lat.toFixed(3)}°`,
            rightSubtext: "Longitude",
            rightText: `${site.coordinates.lng.toFixed(3)}°`,
          },
          {
            id: "topo",
            leftSubtext: "Elevation",
            leftText: `${site.elevationMeters.toFixed(0)} m`,
            rightSubtext: "Mission",
            rightText: site.mission || "N/D",
          },
          {
            id: "catalog",
            leftSubtext: "Solar illumination",
            leftText: `${site.illuminationAvgPercent.toFixed(1)}%`,
            rightSubtext: "Earth visibility",
            rightText: `${site.earthVisibilityPercent.toFixed(1)}%`,
          },
        ]
      : [],
    [site]
  );

  const rightGridExpandedRows: CriteriaGridRow[] = useMemo(
    () => selectedPoint
      ? [
          {
            id: "sun",
            leftSubtext: "Sun azimuth",
            leftText: `${selectedPoint.sun_azimuth_deg.toFixed(2)}°`,
            rightSubtext: "Sun elevation",
            rightText: `${selectedPoint.sun_elevation_deg.toFixed(2)}°`,
          },
          {
            id: "earth",
            leftSubtext: "Earth azimuth",
            leftText: `${selectedPoint.earth_azimuth_deg.toFixed(2)}°`,
            rightSubtext: "Earth elevation",
            rightText: `${selectedPoint.earth_elevation_deg.toFixed(2)}°`,
          },
          {
            id: "visibility",
            leftSubtext: "Sun above terrain",
            leftText: selectedPoint.is_sun_visible ? "Yes" : "No",
            rightSubtext: "Direct Earth link",
            rightText: selectedPoint.is_earth_visible ? "Available" : "Blocked",
          },
          {
            id: "epoch",
            leftSubtext: "Timeline sample",
            leftText: selectedPoint.timestamp_utc.slice(0, 10),
            rightSubtext: "UTC",
            rightText: `${selectedPoint.timestamp_utc.slice(11, 16)} UTC`,
          },
        ]
      : [],
    [selectedPoint]
  );

  const mapSites = useMemo(() => sites.map(toPresetSite), [sites]);
  const selectedMapSite = useMemo(
    () => (site ? mapSites.find((candidate) => candidate.id === site.id) ?? null : null),
    [mapSites, site]
  );

  // Estados de la coreografía secuencial de entrada:
  // 1. La Luna persistente se encoge y traslada lentamente a la esquina inferior derecha (siempre dentro de la pantalla).
  // 2. Al llegar (moonArrived = true), pinta su eje Y al mismo tiempo que entra la UI desde sus bordes con ease-out.
  // 3. Por último (y solo cuando las texturas del mapa hayan cargado), sube el mapa 3D desde abajo con ease-out.
  const [mapLoaded, setMapLoaded] = useState<boolean>(false);
  const [allowMapEntrance, setAllowMapEntrance] = useState<boolean>(false);

  const [flightId, setFlightId] = useState<number>(0);

  const handleMapLoaded = useCallback(() => {
    setMapLoaded(true);
  }, []);

  const handleSelectMapSite = useCallback((clickedSite: PresetSite) => {
    onSelectSite?.(clickedSite.id);
    setFlightId((n) => n + 1);
  }, [onSelectSite]);

  useEffect(() => {
    setAllowMapEntrance(false);
  }, [siteId]);

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

  const sunVisible = selectedPoint?.is_sun_any_part_visible ?? false;
  const earthDirection: [number, number, number] = selectedPoint && site
    ? celestialDirectionToScene(
        selectedPoint.earth_azimuth_deg,
        selectedPoint.earth_elevation_deg,
        site.coordinates.lng,
        60
      )
    : [0, 0, 0];

  if (!site) {
    return (
      <div role="alert" className="absolute inset-0 flex items-center justify-center bg-[#0D0D0D] text-slate-100">
        El sitio solicitado ya no está en el catálogo de la API.
      </div>
    );
  }

  return (
    <div className="absolute inset-0 bg-transparent overflow-hidden select-none pointer-events-none">
      {timelineLoading && (
        <div role="status" className="pointer-events-none absolute left-1/2 top-3 z-50 -translate-x-1/2 rounded-full border border-white/15 bg-slate-950/85 px-4 py-2 text-xs text-[#D9CEC5]">
          Cargando timeline de {site.name}…
        </div>
      )}
      {timelineError && (
        <div className="pointer-events-auto absolute left-1/2 top-3 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-rose-300/30 bg-slate-950/95 px-4 py-3 text-xs text-slate-100">
          <span role="alert">No se pudo cargar el timeline: {timelineError}</span>
          <button
            type="button"
            onClick={() => setTimelineRetry((retry) => retry + 1)}
            className="rounded border border-white/25 px-2 py-1 hover:bg-white/10"
          >
            Reintentar
          </button>
        </div>
      )}
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
          <SiteProvider initialSite={selectedMapSite} initialZoneOffset={0.02}>
            <LunarMapViewer
              sites={mapSites}
              selectedSite={selectedMapSite}
              onSelectSite={handleSelectMapSite}
              flightId={flightId}
              sun={{
                angle: selectedPoint?.sun_azimuth_deg ?? 0,
                elevationDeg: selectedPoint?.sun_elevation_deg ?? 0,
                visible: sunVisible,
                intensity: 2.2,
                ambientIntensity: 0.22,
              }}
              zones={{
                visible: true,
                color: "#FF9F1C",
                edgeOpacity: 0.75,
                gradientPower: 1.6,
                emissiveIntensity: 0.8,
              }}
              markers={{
                visible: true,
                poleHeight: 2,
              }}
              terrain={{
                displacementScale: 2.5,
                displacementBias: -1.25,
                showPedestal: true,
                pedestalDepth: 4,
                focusRadius: 15.0,
              }}
              earth={{
                visible: activeLayers["dte-link"],
                direction: earthDirection,
              }}
              grid={{
                visible: activeLayers.sun,
                height: 25,
                opacity: 0.12,
              }}
              camera={{
                initialPosition: [0, 50, 100],
                fov: 42,
                flyOffset: [6, 8, 10],
                lerpFactor: 0.06,
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
        {selectedPoint && (
          <TopTemporalController
            value={currentIndex}
            min={0}
            max={timelinePoints.length - 1}
            onChangeValue={(index) => setSelectedPointIndex(Math.round(index))}
            formatValue={(index) => {
              const point = timelinePoints[Math.round(index)];
              return point
                ? `${point.timestamp_utc.slice(0, 10)} ${point.timestamp_utc.slice(11, 16)} UTC`
                : "";
            }}
            dateIso={dateIso}
            onChangeDate={selectNearestPointForDate}
            minDate={minDate}
            maxDate={maxDate}
            telemetryBadge={`Sol ${selectedPoint.sun_azimuth_deg.toFixed(0)}° / ${selectedPoint.sun_elevation_deg.toFixed(1)}°`}
          />
        )}
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
          title="Visibility summary"
          subtitle="Percent of hourly timeline samples"
          items={sliderItems}
          className="w-full shrink"
        />

        <CriteriaKpiCard
          title="Solar disk visibility"
          value={
            !selectedPoint
              ? "N/D"
              : selectedPoint.is_sun_full_disk_visible
              ? "FULL"
              : selectedPoint.is_sun_any_part_visible
              ? "PARTIAL"
              : "SHADOW"
          }
          unit=""
          badgeText={selectedPoint?.is_sun_visible ? "CENTER VISIBLE" : "CENTER HIDDEN"}
          subtitle="Estado calculado para la muestra UTC seleccionada"
          className="w-full shrink"
        />

        <CriteriaIconListCard
          title="Timeline telemetry"
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
              sites={sites}
              currentSiteId={site.id}
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
            title="Continuous solar window"
            days={solarWindowValue}
            unitLabel=""
            subtitle={solarWindowSubtitle}
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
