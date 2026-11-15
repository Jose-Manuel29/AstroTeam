"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { LunarMapViewer } from "../components/3d_canvas/LunarMapViewer";
import { SiteProvider, type PresetSite } from "../lib/context/SiteContext";
import {
  fetchLibration,
  fetchSiteTimeline,
  type LibrationData,
  type SiteTimeline,
  type TimelinePoint,
} from "../lib/api";
import { toPresetSite } from "../lib/siteAdapters";
import { celestialDirectionToScene } from "../lib/geo/celestial";
import type { LandingSite } from "../types";
import {
  HudCard,
  HudCardHeader,
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

export interface SiteDetailViewProps {
  siteId: string;
  sites: LandingSite[];
  /** Si es true, la vista inicia en el mapa general del Polo Sur (sin sitio aislado) */
  overview?: boolean;
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
  endState: "PARTIAL" | "SHADOW" | null;
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

    const nextPoint = points[endIndex + 1];
    const startTimestamp = points[startIndex].timestamp_utc;
    const endTimestamp = nextPoint?.timestamp_utc ?? points[endIndex].timestamp_utc;

    return {
      startIndex,
      startTimestamp,
      endTimestamp,
      durationHours:
        (Date.parse(endTimestamp) - Date.parse(startTimestamp)) / 3_600_000,
      continuesAtForecastEnd: !nextPoint,
      endState: nextPoint
        ? nextPoint.is_sun_any_part_visible
          ? "PARTIAL"
          : "SHADOW"
        : null,
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

function formatExactUtc(timestamp: string | null): string {
  return timestamp
    ? `${new Date(timestamp).toISOString().replace("T", " ").slice(0, 16)} UTC`
    : "N/D";
}

function formatCountdownSeconds(seconds: number | null): string {
  if (seconds === null) return "N/D";
  const totalMinutes = Math.floor(Math.max(0, seconds) / 60);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  return days > 0 ? `${days}d ${hours}h ${minutes}m` : `${hours}h ${minutes}m`;
}

function findNextVisibilityTransition(
  points: TimelinePoint[],
  fromIndex: number,
  isVisible: (point: TimelinePoint) => boolean
): TimelinePoint | null {
  const currentPoint = points[fromIndex];
  if (!currentPoint) return null;
  const currentVisibility = isVisible(currentPoint);
  return (
    points
      .slice(fromIndex + 1)
      .find((point) => isVisible(point) !== currentVisibility) ?? null
  );
}

function formatDiskVisibility(fullDiskVisible: boolean, anyPartVisible: boolean): string {
  if (fullDiskVisible) return "Full disk";
  return anyPartVisible ? "Partial disk" : "Not visible";
}

/**
 * Vista 3: Vista de Detalle (Análisis Local Profundo - Polo Sur Lunar)
 * Utiliza el sistema de componentes HUD modulares (HudCard) con inyección de datos reales.
 * Comparte el mismo Canvas 3D persistente de la Luna desde LocationPickerView para evitar parpadeos.
 */
export const SiteDetailView: React.FC<SiteDetailViewProps> = ({
  siteId,
  sites,
  overview = false,
  moonArrived = false,
  onBackToPicker,
  onSelectSite,
}) => {
  const site = useMemo(
    () => sites.find((candidate) => candidate.id === siteId) ?? sites[0],
    [sites, siteId]
  );

  const [criteriaValues, setCriteriaValues] = useState({
    illumination: site.illuminationAvgPercent,
    earthLink: site.earthVisibilityPercent,
  });

  useEffect(() => {
    setCriteriaValues({
      illumination: site.illuminationAvgPercent,
      earthLink: site.earthVisibilityPercent,
    });
  }, [site]);

  const mapSites = useMemo(() => {
    return sites.map((candidate) => {
      const meetsIllum = candidate.illuminationAvgPercent >= criteriaValues.illumination;
      const meetsDte = candidate.earthVisibilityPercent >= criteriaValues.earthLink;
      const met = (meetsIllum ? 1 : 0) + (meetsDte ? 1 : 0);
      const viabilityTier: "optimal" | "marginal" | "critical" =
        met === 2 ? "optimal" : met === 1 ? "marginal" : "critical";
      const isViable = met === 2;

      return toPresetSite({
        ...candidate,
        viabilityTier,
        isViable,
      });
    });
  }, [sites, criteriaValues]);
  const [timeline, setTimeline] = useState<SiteTimeline | null>(null);
  const [timelineError, setTimelineError] = useState<string | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [selectedPointIndex, setSelectedPointIndex] = useState(0);
  const [timelineRetryKey, setTimelineRetryKey] = useState(0);
  const [librationData, setLibrationData] = useState<LibrationData | null>(null);
  const [librationError, setLibrationError] = useState<string | null>(null);
  const [librationLoading, setLibrationLoading] = useState(false);
  const [librationRetryKey, setLibrationRetryKey] = useState(0);

  useEffect(() => {
    let active = true;
    setTimeline(null);
    setTimelineError(null);
    setSelectedPointIndex(0);
    setTimelineLoading(true);

    fetchSiteTimeline(siteId)
      .then((result) => {
        if (active) {
          setTimeline(result);
          if (result.points.length > 0) {
            setSelectedPointIndex(Math.floor((result.points.length - 1) / 2));
          }
        }
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
  }, [siteId, timelineRetryKey]);

  const timelinePoints = timeline?.points ?? [];
  const currentIndex = timelinePoints.length
    ? Math.max(0, Math.min(timelinePoints.length - 1, selectedPointIndex))
    : 0;
  const selectedPoint = timelinePoints[currentIndex] ?? null;
  const selectedTimestampUtc = selectedPoint?.timestamp_utc ?? null;

  useEffect(() => {
    let active = true;
    if (!selectedTimestampUtc) {
      setLibrationData(null);
      setLibrationError(null);
      setLibrationLoading(false);
      return () => {
        active = false;
      };
    }

    setLibrationData(null);
    setLibrationError(null);
    setLibrationLoading(true);
    const delay = librationData ? 150 : 0;
    const timeoutId = window.setTimeout(() => {
      fetchLibration(selectedTimestampUtc)
        .then((result) => {
          if (active) setLibrationData(result);
        })
        .catch((error: unknown) => {
          if (active) {
            setLibrationError(
              error instanceof Error ? error.message : String(error)
            );
          }
        })
        .finally(() => {
          if (active) setLibrationLoading(false);
        });
    }, delay);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [selectedTimestampUtc, librationRetryKey]);

  const selectedDate = selectedPoint
    ? new Date(selectedPoint.timestamp_utc)
    : null;
  const missionDateIso = selectedDate?.toISOString().slice(0, 10) ?? "";
  const hourOfDay = selectedDate
    ? selectedDate.getUTCHours() + selectedDate.getUTCMinutes() / 60
    : 12;

  const selectNearestPoint = useCallback(
    (dateIso: string, hour: number) => {
      if (!timeline?.points.length) return;
      const [year, month, day] = dateIso.split("-").map(Number);
      const target = Date.UTC(year, month - 1, day) + hour * 60 * 60 * 1000;
      let nearestIndex = 0;
      let nearestDistance = Number.POSITIVE_INFINITY;
      timeline.points.forEach((point, index) => {
        const distance = Math.abs(
          new Date(point.timestamp_utc).getTime() - target
        );
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = index;
        }
      });
      setSelectedPointIndex(nearestIndex);
    },
    [timeline]
  );

  const handleChangeHour = (hour: number) => {
    if (missionDateIso) selectNearestPoint(missionDateIso, hour);
  };

  const handleChangeDate = (dateIso: string) => {
    selectNearestPoint(dateIso, hourOfDay);
  };

  const sliderItems: CriterionSliderItem[] = useMemo(
    () => [
      {
        id: "illumination",
        label: "Minimum solar visibility",
        value: criteriaValues.illumination,
        min: 0,
        max: 100,
        step: 1,
        unit: "%",
      },
      {
        id: "earthLink",
        label: "Minimum Earth visibility",
        value: criteriaValues.earthLink,
        min: 0,
        max: 100,
        step: 1,
        unit: "%",
      },
    ],
    [criteriaValues]
  );

  const handleCriterionChange = (id: string, value: number) => {
    setCriteriaValues((previous) => ({ ...previous, [id]: value }));
  };

  const metCriteriaCount =
    Number(site.illuminationAvgPercent >= criteriaValues.illumination) +
    Number(site.earthVisibilityPercent >= criteriaValues.earthLink);
  const fulfilledKpiPercent = (metCriteriaCount / 2) * 100;

  // Clasificación de estatus (Cumple ambos / uno / ninguno) sincronizada con el picker y la leyenda
  const currentStatusTier: "optimal" | "marginal" | "critical" =
    metCriteriaCount === 2 ? "optimal" : metCriteriaCount === 1 ? "marginal" : "critical";

  // Color del estatus para pintar el aro superior de las capas holográficas
  const currentStatusColor =
    currentStatusTier === "optimal"
      ? "#34d399" // emerald-400
      : currentStatusTier === "marginal"
      ? "#fbbf24" // amber-400
      : "#fb7185"; // rose-400

  const [activeLayers, setActiveLayers] = useState<Record<string, boolean>>({
    sun: true,
    earth: true,
  });
  const handleToggleIconCriterion = (id: string) => {
    setActiveLayers((previous) => ({ ...previous, [id]: !previous[id] }));
  };

  const iconCriteriaItems: CriterionIconListItem[] = useMemo(
    () => [
      {
        id: "sun",
        label: "Sun center visible",
        value: selectedPoint
          ? selectedPoint.is_sun_visible
            ? "Visible"
            : "Not visible"
          : timelineLoading
            ? "Loading…"
            : "N/D",
        icon: "sun",
        active: activeLayers.sun,
      },
      {
        id: "earth",
        label: "Earth direct visibility",
        value: selectedPoint
          ? selectedPoint.is_earth_visible
            ? "Visible"
            : "Blocked"
          : timelineLoading
            ? "Loading…"
            : "N/D",
        icon: "broadcast",
        active: activeLayers.earth,
      },
    ],
    [activeLayers, selectedPoint, timelineLoading]
  );

  const rightGridRows: CriteriaGridRow[] = useMemo(
    () => [
      {
        id: "coords",
        leftSubtext: "Latitude",
        leftText: `${site.coordinates.lat.toFixed(4)}°`,
        rightSubtext: "Longitude",
        rightText: `${site.coordinates.lng.toFixed(4)}°`,
      },
      {
        id: "elevation",
        leftSubtext: "Elevation",
        leftText: `${Math.round(site.elevationMeters)} m`,
        rightSubtext: "Mission",
        rightText: site.mission || "N/D",
      },
      {
        id: "catalog-summary",
        leftSubtext: "Sun visible (period)",
        leftText: `${Math.round(site.illuminationAvgPercent)}%`,
        rightSubtext: "Earth visible (period)",
        rightText: `${Math.round(site.earthVisibilityPercent)}%`,
      },
    ],
    [site]
  );

  const rightGridExpandedRows: CriteriaGridRow[] = useMemo(
    () => [
      {
        id: "ephemeris",
        leftSubtext: "Sun azimuth",
        leftText: selectedPoint
          ? `${selectedPoint.sun_azimuth_deg.toFixed(2)}°`
          : "N/D",
        rightSubtext: "Sun elevation",
        rightText: selectedPoint
          ? `${selectedPoint.sun_elevation_deg.toFixed(2)}°`
          : "N/D",
      },
      {
        id: "earth-angles",
        leftSubtext: "Earth azimuth",
        leftText: selectedPoint
          ? `${selectedPoint.earth_azimuth_deg.toFixed(2)}°`
          : "N/D",
        rightSubtext: "Earth elevation",
        rightText: selectedPoint
          ? `${selectedPoint.earth_elevation_deg.toFixed(2)}°`
          : "N/D",
      },
      {
        id: "date",
        leftSubtext: "UTC date / time",
        leftText: selectedDate
          ? selectedDate.toISOString().replace("T", " ").slice(0, 16)
          : "N/D",
        rightSubtext: "Earth phase",
        rightText:
          selectedPoint?.earth_phase_angle_deg == null
            ? "N/D"
            : `${selectedPoint.earth_phase_angle_deg.toFixed(2)}°`,
      },
      {
        id: "earth-link",
        leftSubtext: "Earth distance",
        leftText: selectedPoint
          ? `${Math.round(selectedPoint.earth_distance_km).toLocaleString()} km`
          : "N/D",
        rightSubtext: "Round-trip time",
        rightText: selectedPoint
          ? `${selectedPoint.earth_latency_rtt_sec.toFixed(2)} s`
          : "N/D",
      },
    ],
    [selectedDate, selectedPoint]
  );

  const nextSolarWindow = useMemo(
    () => findNextSolarWindow(timelinePoints, currentIndex),
    [timelinePoints, currentIndex]
  );
  const nextSunTransition = useMemo(
    () =>
      findNextVisibilityTransition(
        timelinePoints,
        currentIndex,
        (point) => point.is_sun_visible
      ),
    [timelinePoints, currentIndex]
  );
  const nextEarthTransition = useMemo(
    () =>
      findNextVisibilityTransition(
        timelinePoints,
        currentIndex,
        (point) => point.is_earth_visible
      ),
    [timelinePoints, currentIndex]
  );
  const solarWindowValue = !selectedPoint
    ? "N/D"
    : !nextSolarWindow
      ? "NONE"
      : nextSolarWindow.continuesAtForecastEnd
        ? "STILL VISIBLE"
        : formatDurationHours(nextSolarWindow.durationHours);
  const solarWindowStartLabel =
    nextSolarWindow?.startIndex === currentIndex
      ? "From selected time"
      : "Next window";
  const solarWindowSubtitle = !selectedPoint
    ? timelineLoading
      ? "Loading forecast..."
      : timelineError
        ? "Timeline could not be loaded"
        : "No timeline sample selected"
    : !nextSolarWindow
      ? "No full-disk window remains in this forecast"
      : nextSolarWindow.continuesAtForecastEnd
        ? `${solarWindowStartLabel}: visible through ${formatUtcDateTime(nextSolarWindow.endTimestamp)} UTC; end is outside forecast · hourly estimate`
        : `${solarWindowStartLabel}: ${formatUtcDateTime(nextSolarWindow.startTimestamp)}–${formatUtcDateTime(nextSolarWindow.endTimestamp)} UTC; then ${nextSolarWindow.endState?.toLowerCase()} · hourly estimate`;

  // Estados de la coreografía secuencial de entrada:
  // 1. La Luna persistente se encoge y traslada lentamente a la esquina inferior derecha (siempre dentro de la pantalla).
  // 2. Al llegar (moonArrived = true), pinta su eje Y al mismo tiempo que entra la UI desde sus bordes con ease-out.
  // 3. Por último (y solo cuando las texturas del mapa hayan cargado), sube el mapa 3D desde abajo con ease-out.
  const [mapLoaded, setMapLoaded] = useState<boolean>(false);
  const [allowMapEntrance, setAllowMapEntrance] = useState<boolean>(false);

  const initialPresetSite = useMemo(
    () => mapSites.find((candidate) => candidate.id === site.id) ?? mapSites[0],
    [mapSites, site]
  );

  // Estado del sitio enfocado dentro del nuevo visor 3D (diorama + capas holográficas + vuelo de cámara)
  // Al seleccionar en el picker entra directamente en vista detalle del sitio seleccionado.
  // Si overview es true ("Explorar terreno"), inicia en la vista general de todo el Polo Sur.
  const [selectedMapSite, setSelectedMapSite] = useState<PresetSite | null>(
    overview ? null : initialPresetSite
  );
  const [flightId, setFlightId] = useState<number>(overview ? 0 : 1);
  const [isShaking, setIsShaking] = useState<boolean>(false);

  // Vibración de rechazo táctico del minimapa cuando ya se está en la vista general
  const triggerMinimapShake = useCallback(() => {
    setIsShaking(true);
    setTimeout(() => {
      setIsShaking(false);
    }, 450);
  }, []);

  const handleMapLoaded = useCallback(() => {
    setMapLoaded(true);
  }, []);

  const handleSelectMapSite = useCallback(
    (clickedSite: PresetSite) => {
      setSelectedMapSite(clickedSite);
      onSelectSite?.(clickedSite.id);
      setFlightId((n) => n + 1);
    },
    [onSelectSite]
  );

  const isOverview = selectedMapSite === null;

  // Alterna entre la vista general del mapa polar y la vista detalle del sitio activo
  const handleToggleOverview = useCallback(() => {
    if (selectedMapSite) {
      setSelectedMapSite(null);
      setFlightId((n) => n + 1);
    } else {
      setSelectedMapSite(initialPresetSite);
      onSelectSite?.(initialPresetSite.id);
      setFlightId((n) => n + 1);
    }
  }, [selectedMapSite, initialPresetSite, onSelectSite]);

  const handleSelectSiteFromMinimap = useCallback(
    (id: string) => {
      onSelectSite?.(id);
      const targetPreset = mapSites.find((candidate) => candidate.id === id) || null;
      if (targetPreset) {
        setSelectedMapSite(targetPreset);
        setFlightId((n) => n + 1);
      }
    },
    [mapSites, onSelectSite]
  );

  useEffect(() => {
    setSelectedMapSite(overview ? null : initialPresetSite);
    setFlightId((n) => n + 1);
  }, [siteId, initialPresetSite, overview]);

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

  const sunAzimuthDeg = selectedPoint?.sun_azimuth_deg ?? 0;
  const earthDirection = selectedPoint
    ? celestialDirectionToScene(
        selectedPoint.earth_azimuth_deg,
        selectedPoint.earth_elevation_deg,
        site.coordinates.lng,
        40
      )
    : [40, 50, -30] as [number, number, number];

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
              sites={mapSites}
              selectedSite={selectedMapSite}
              onSelectSite={handleSelectMapSite}
              flightId={flightId}
              sun={{
                angle: sunAzimuthDeg,
                elevationDeg: selectedPoint?.sun_elevation_deg ?? 5.7,
                siteLongitudeDeg: site.coordinates.lng,
                intensity: 2.8,
                ambientIntensity: 0.18,
                visible: activeLayers.sun,
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
                position: [0, -8, 0], // Subido en el eje Y para centrar el relieve sobre la cota de flotación
                rotation: [0, Math.PI / 4, 0], // Orientación isométrica en diamante a 45°
              }}
              earth={{
                visible: activeLayers.earth,
                isConnected: Boolean(selectedPoint?.is_earth_visible),
                disconnectedLabel: "NO DTE LINK",
                targetDirection: earthDirection,
                color: "#38BDF8", // Azul táctico Direct-to-Earth
              }}
              grid={{
                visible: activeLayers.sun,
                height: 25,
                opacity: 0.14,
                centerColor: "#A6948A", // palette-ochre oficial
                gridColor: "#3B3B40",   // palette-charcoal oficial
              }}
              camera={{
                initialPosition: [36, 26, 80],
                target: [0, -6, 0],
                overviewPosition: [42, 23, 92],
                overviewTarget: [0, -7, 0],
                fov: 38,
                flyOffset: [27.2, 21.0, 58.9],
                targetOffset: [0, 1.5, 0],
                lerpFactor: 0.06,
                minDistance: 30,
                maxDistance: 190,
              }}
              showStars={false}
              showDebugHud={false}
              statusColor={currentStatusColor}
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
          onChangeHour={handleChangeHour}
          value={timeline?.points.length ? selectedPointIndex : undefined}
          min={0}
          max={Math.max((timeline?.points.length ?? 1) - 1, 1)}
          onChangeValue={(index) =>
            setSelectedPointIndex(Math.round(index))
          }
          formatValue={(index) => {
            const point = timeline?.points[Math.round(index)];
            return point
              ? `${new Date(point.timestamp_utc)
                  .toISOString()
                  .replace("T", " ")
                  .slice(0, 16)} UTC`
              : "N/D";
          }}
          dateIso={missionDateIso}
          onChangeDate={handleChangeDate}
          telemetryBadge={
            selectedPoint
              ? `Sun Az ${selectedPoint.sun_azimuth_deg.toFixed(1)}° · El ${
                  selectedPoint.sun_elevation_deg >= 0 ? "+" : ""
                }${selectedPoint.sun_elevation_deg.toFixed(1)}°`
              : timelineLoading
                ? "Loading ephemeris…"
                : "Ephemeris unavailable"
          }
        />
      </div>

      {/* =========================================================================
          PASO 2B: COLUMNA HUD IZQUIERDA (Entra desde el borde izquierdo hacia adentro con ease-out)
          Con espaciado vertical suficiente para no solaparse jamás con el botón superior
         ========================================================================= */}
      <aside
        className="absolute left-[clamp(1rem,3.8vw,4rem)] top-[clamp(4.1rem,8.2vh,5.2rem)] bottom-[clamp(0.5rem,2vh,1.5rem)] w-[clamp(250px,22vw,336px)] z-20 flex flex-col justify-start gap-[clamp(0.4rem,1.2vh,0.9rem)] max-h-[calc(100vh-clamp(4.8rem,9.5vh,6.5rem))] pointer-events-none overflow-y-auto pr-1 py-7 scroll-smooth"
        style={{
          transform: moonArrived ? "translateX(0)" : "translateX(-430px)",
          opacity: moonArrived ? 1 : 0,
          transition: "transform 0.75s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.6s ease-out",
          maskImage: "linear-gradient(to bottom, transparent 0%, black 28px, black calc(100% - 28px), transparent 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 28px, black calc(100% - 28px), transparent 100%)",
        }}
      >
        <CriteriaSlidersCard
          title="Site criteria thresholds"
          items={sliderItems}
          onChange={handleCriterionChange}
          className="w-fit self-start min-w-[clamp(240px,18.5vw,290px)] shrink-0 min-h-[clamp(135px,18vh,160px)] pointer-events-auto"
        />

        <CriteriaKpiCard
          title="Catalog criteria met"
          value={fulfilledKpiPercent}
          unit="%"
          statusTier={currentStatusTier}
          badgeText={`${metCriteriaCount}/2`}
          subtitle={`${metCriteriaCount} of 2 period-summary thresholds met`}
          className="w-fit self-start min-w-[clamp(200px,16vw,240px)] shrink-0 min-h-[clamp(58px,8vh,72px)] pointer-events-auto"
        />

        {timelineError && (
          <div
            role="alert"
            className="pointer-events-auto rounded-xl border border-rose-400/40 bg-rose-950/80 px-3 py-2 text-xs text-rose-100 shrink-0"
          >
            <p className="mb-2">Failed to load timeline: {timelineError}</p>
            <button
              type="button"
              onClick={() => setTimelineRetryKey((key) => key + 1)}
              className="rounded-md border border-rose-200/40 px-2 py-1 hover:bg-rose-200/10"
            >
              Retry
            </button>
          </div>
        )}

        <HudCard className="w-full shrink min-h-0 pointer-events-auto flex flex-col gap-2.5">
          <HudCardHeader title="Ephemeris at selected UTC" />

          <div className="w-full border-t border-white/10 pt-2 overflow-y-auto max-h-[clamp(200px,38vh,420px)] pr-1">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[10.5px] font-sans">
              <div>
                <dt className="text-palette-cream/70 text-[10px] leading-tight">Sun azimuth / elevation</dt>
                <dd className="text-[#FAFAFA] font-medium tabular-nums text-[11.5px] leading-snug">
                  {selectedPoint
                    ? `${selectedPoint.sun_azimuth_deg.toFixed(2)}° / ${selectedPoint.sun_elevation_deg.toFixed(2)}°`
                    : timelineLoading
                      ? "…"
                      : "N/D"}
                </dd>
              </div>
              <div>
                <dt className="text-palette-cream/70 text-[10px] leading-tight">Sun disk</dt>
                <dd className="text-[#FAFAFA] font-medium text-[11.5px] leading-snug">
                  {selectedPoint
                    ? formatDiskVisibility(
                        selectedPoint.is_sun_full_disk_visible,
                        selectedPoint.is_sun_any_part_visible
                      )
                    : timelineLoading
                      ? "…"
                      : "N/D"}
                </dd>
              </div>
              <div>
                <dt className="text-palette-cream/70 text-[10px] leading-tight">Earth azimuth / elevation</dt>
                <dd className="text-[#FAFAFA] font-medium tabular-nums text-[11.5px] leading-snug">
                  {selectedPoint
                    ? `${selectedPoint.earth_azimuth_deg.toFixed(2)}° / ${selectedPoint.earth_elevation_deg.toFixed(2)}°`
                    : timelineLoading
                      ? "…"
                      : "N/D"}
                </dd>
              </div>
              <div>
                <dt className="text-palette-cream/70 text-[10px] leading-tight">Earth disk</dt>
                <dd className="text-[#FAFAFA] font-medium text-[11.5px] leading-snug">
                  {selectedPoint
                    ? formatDiskVisibility(
                        selectedPoint.is_earth_full_disk_visible,
                        selectedPoint.is_earth_any_part_visible
                      )
                    : timelineLoading
                      ? "…"
                      : "N/D"}
                </dd>
              </div>
              <div>
                <dt className="text-palette-cream/70 text-[10px] leading-tight">Distance / RTT</dt>
                <dd className="text-[#FAFAFA] font-medium tabular-nums text-[11.5px] leading-snug">
                  {selectedPoint
                    ? `${Math.round(selectedPoint.earth_distance_km).toLocaleString()} km / ${selectedPoint.earth_latency_rtt_sec.toFixed(2)} s`
                    : timelineLoading
                      ? "…"
                      : "N/D"}
                </dd>
              </div>
              <div>
                <dt className="text-palette-cream/70 text-[10px] leading-tight">Earth phase</dt>
                <dd className="text-[#FAFAFA] font-medium tabular-nums text-[11.5px] leading-snug">
                  {selectedPoint?.earth_phase_angle_deg == null
                    ? timelineLoading
                      ? "…"
                      : "N/D"
                    : `${selectedPoint.earth_phase_angle_deg.toFixed(2)}°`}
                </dd>
              </div>

              <div className="col-span-2 border-t border-white/10 pt-2 mt-1">
                <dt className="text-palette-cream/70 text-[10px] leading-tight">
                  Libration at selected UTC
                </dt>
                <dd className="text-[#FAFAFA] font-medium text-[11.5px] leading-snug">
                  {librationLoading
                    ? "Loading…"
                    : librationError
                      ? "Libration unavailable"
                      : librationData
                        ? `${librationData.sun_distance_au.toFixed(6)} AU from Sun`
                        : "N/D"}
                </dd>
              </div>

              {selectedPoint && (
                <>
                  <div>
                    <dt className="text-palette-cream/70 text-[10px] leading-tight">
                      Sun horizon (geometric / terrain)
                    </dt>
                    <dd className="text-[#FAFAFA] font-medium text-[11.5px] leading-snug">
                      {selectedPoint.sun_elevation_deg > 0 ? "Above" : "Below"}
                      {" / "}
                      {selectedPoint.is_sun_visible ? "Clear" : "Blocked"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-palette-cream/70 text-[10px] leading-tight">
                      Earth horizon (geometric / terrain)
                    </dt>
                    <dd className="text-[#FAFAFA] font-medium text-[11.5px] leading-snug">
                      {selectedPoint.earth_elevation_deg > 0 ? "Above" : "Below"}
                      {" / "}
                      {selectedPoint.is_earth_visible ? "Clear" : "Blocked"}
                    </dd>
                  </div>
                </>
              )}

              {librationData && (
                <>
                  <div>
                    <dt className="text-palette-cream/70 text-[10px] leading-tight">
                      Sub-Earth latitude / longitude
                    </dt>
                    <dd className="text-[#FAFAFA] font-medium tabular-nums text-[11.5px] leading-snug">
                      {librationData.sub_earth_lat.toFixed(3)}° /{" "}
                      {librationData.sub_earth_lon.toFixed(3)}°
                    </dd>
                  </div>
                  <div>
                    <dt className="text-palette-cream/70 text-[10px] leading-tight">
                      Sub-Solar latitude / longitude
                    </dt>
                    <dd className="text-[#FAFAFA] font-medium tabular-nums text-[11.5px] leading-snug">
                      {librationData.sub_solar_lat.toFixed(3)}° /{" "}
                      {librationData.sub_solar_lon.toFixed(3)}°
                    </dd>
                  </div>
                </>
              )}

              {selectedPoint && (
                <>
                  <div>
                    <dt className="text-palette-cream/70 text-[10px] leading-tight">
                      Next solar transition (hourly estimate)
                    </dt>
                    <dd className="text-[#FAFAFA] font-medium tabular-nums text-[11.5px] leading-snug">
                      {nextSunTransition
                        ? `${selectedPoint.is_sun_visible ? "Sunset" : "Sunrise"} · ${formatExactUtc(nextSunTransition.timestamp_utc)} · ${formatCountdownSeconds(
                            (Date.parse(nextSunTransition.timestamp_utc) -
                              Date.parse(selectedPoint.timestamp_utc)) /
                              1000
                          )}`
                        : "N/D · outside forecast"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-palette-cream/70 text-[10px] leading-tight">
                      Next Earth transition (hourly estimate)
                    </dt>
                    <dd className="text-[#FAFAFA] font-medium tabular-nums text-[11.5px] leading-snug">
                      {nextEarthTransition
                        ? `${selectedPoint.is_earth_visible ? "Earth set" : "Earth rise"} · ${formatExactUtc(nextEarthTransition.timestamp_utc)} · ${formatCountdownSeconds(
                            (Date.parse(nextEarthTransition.timestamp_utc) -
                              Date.parse(selectedPoint.timestamp_utc)) /
                              1000
                          )}`
                        : "N/D · outside forecast"}
                    </dd>
                  </div>
                </>
              )}

              {librationError && (
                <div className="col-span-2" role="alert">
                  <dt className="text-rose-200/80">Libration error</dt>
                  <dd className="mt-1 flex items-center justify-between gap-2 text-rose-100">
                    <span className="min-w-0 break-words">{librationError}</span>
                    <button
                      type="button"
                      onClick={() => setLibrationRetryKey((key) => key + 1)}
                      className="shrink-0 rounded-md border border-rose-200/40 px-2 py-1 hover:bg-rose-200/10"
                    >
                      Retry
                    </button>
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </HudCard>

        <MapLegendCard
          mode="detail"
          title="Terrain & Vector Symbology"
          className="w-full shrink-0 min-h-[clamp(175px,24vh,215px)] pointer-events-auto"
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
            {/* Leyenda interactiva sobre el minimapa: indica si está en detalle o general */}
            <button
              type="button"
              onClick={() => {
                if (isOverview) {
                  setFlightId((n) => n + 1);
                } else {
                  handleToggleOverview();
                }
              }}
              title={
                isOverview
                  ? "Reset default overview camera"
                  : "Click to view South Pole overview map"
              }
              aria-label={
                isOverview
                  ? "Reset default overview camera"
                  : "Switch to South Pole overview map"
              }
              className={`group flex items-center gap-2 px-[clamp(0.55rem,0.85vw,0.75rem)] py-[clamp(0.25rem,0.5vh,0.35rem)] rounded-full bg-palette-obsidian/85 hover:bg-palette-charcoal/85 border border-palette-slate/40 hover:border-palette-cream/40 transition-all duration-200 backdrop-blur-md cursor-pointer shadow-[0_2px_10px_rgba(0,0,0,0.55)] focus:outline-none ${
                isShaking && isOverview ? "animate-hud-shake ring-2 ring-rose-400/60" : ""
              }`}
            >
              <span
                className={`inline-block w-2 h-2 rounded-full transition-colors ${
                  isOverview
                    ? "bg-palette-ochre shadow-[0_0_8px_#A6948A]"
                    : "bg-palette-cream shadow-[0_0_8px_#D9CEC5] animate-pulse"
                }`}
              />
              <span className="font-heading font-bold text-[clamp(9px,1vh,11px)] tracking-wider uppercase text-palette-cream/90">
                {isOverview ? "OVERVIEW MAP" : "SITE DETAIL"}
              </span>
              <span className="font-sans text-[clamp(9px,0.95vh,10.5px)] text-palette-slate group-hover:text-palette-cream transition-colors">
                {isOverview ? "· Reset View ⟲" : "· Click: Overview ↗"}
              </span>
            </button>

            {/* Minimapa polar interactivo: en modo detalle cambia a general; en general restablece la perspectiva por defecto */}
            <div
              onClick={() => {
                if (isOverview) {
                  setFlightId((n) => n + 1);
                } else {
                  handleToggleOverview();
                }
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  if (isOverview) {
                    setFlightId((n) => n + 1);
                  } else {
                    handleToggleOverview();
                  }
                }
              }}
              title={
                isOverview
                  ? "Reset default overview camera"
                  : "Click map to view overview map"
              }
              aria-label={
                isOverview
                  ? "Reset default overview camera"
                  : "Switch to overview map"
              }
              className={`relative cursor-pointer group rounded-full transition-transform duration-200 focus:outline-none focus:ring-2 focus:ring-palette-cream/40 w-[clamp(170px,26vh,100%)] max-w-full aspect-square ${
                isShaking ? "animate-hud-shake ring-2 ring-rose-400/60" : "hover:scale-[1.02] active:scale-[0.98]"
              }`}
            >
              <SouthPoleMinimap
                currentSiteId={site.id}
                sites={sites}
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
            className="w-fit self-end shrink-0 min-h-0"
          />

          <CriteriaDaysKpiCard
            title="Continuous solar window"
            days={solarWindowValue}
            unitLabel=""
            subtitle={solarWindowSubtitle}
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
            title="Click to return to location picker view"
            aria-label="Return to location picker"
            className="h-full aspect-square rounded-full pointer-events-auto cursor-pointer bg-transparent border-0 outline-none p-0 transition-transform duration-200 hover:scale-105 active:scale-95 group focus:outline-none"
          />
        </HudCard>
      </aside>
    </div>
  );
};

export default SiteDetailView;
