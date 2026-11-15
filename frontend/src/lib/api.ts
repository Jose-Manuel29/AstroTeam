import type { LandingSite } from "../types";

export interface ApiSite {
  id: string;
  mision: string | null;
  nombre: string;
  latitud: number;
  longitud: number;
  altitud_km: number;
  pct_luz_solar: number;
  pct_vista_tierra: number;
}

export interface TimelinePoint {
  timestamp_utc: string;
  sun_elevation_deg: number;
  sun_azimuth_deg: number;
  earth_elevation_deg: number;
  earth_azimuth_deg: number;
  is_sun_visible: boolean;
  is_sun_any_part_visible: boolean;
  is_sun_full_disk_visible: boolean;
  is_earth_visible: boolean;
  is_earth_any_part_visible: boolean;
  is_earth_full_disk_visible: boolean;
  earth_distance_km: number;
  earth_latency_rtt_sec: number;
  earth_phase_angle_deg: number | null;
}

export interface SiteTimeline {
  site_id: string;
  name: string;
  points: TimelinePoint[];
}

export interface LibrationData {
  sub_earth_lat: number;
  sub_earth_lon: number;
  sub_solar_lat: number;
  sub_solar_lon: number;
  earth_distance_km: number;
  sun_distance_au: number;
  earth_phase_angle_deg: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function getApiBaseUrl(): string {
  const configuredUrl = import.meta.env.VITE_API_BASE_URL?.trim();
  const baseUrl = configuredUrl || (import.meta.env.DEV ? "http://localhost:8000" : "");
  if (!baseUrl) {
    throw new Error("Falta configurar VITE_API_BASE_URL con la URL pública de FastAPI.");
  }
  return baseUrl.replace(/\/+$/, "");
}

async function requestJson(path: string): Promise<unknown> {
  const response = await fetch(`${getApiBaseUrl()}${path}`);
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`FastAPI devolvió una respuesta que no es JSON (${response.status}).`);
  }

  if (!response.ok) {
    const detail = isRecord(payload) && typeof payload.detail === "string"
      ? payload.detail
      : `Error HTTP ${response.status}`;
    throw new Error(detail);
  }
  return payload;
}

function isApiSite(value: unknown): value is ApiSite {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    (typeof value.mision === "string" || value.mision === null) &&
    typeof value.nombre === "string" &&
    isFiniteNumber(value.latitud) &&
    isFiniteNumber(value.longitud) &&
    isFiniteNumber(value.altitud_km) &&
    isFiniteNumber(value.pct_luz_solar) &&
    isFiniteNumber(value.pct_vista_tierra)
  );
}

function isTimelinePoint(value: unknown): value is TimelinePoint {
  return (
    isRecord(value) &&
    typeof value.timestamp_utc === "string" &&
    isFiniteNumber(value.sun_elevation_deg) &&
    isFiniteNumber(value.sun_azimuth_deg) &&
    isFiniteNumber(value.earth_elevation_deg) &&
    isFiniteNumber(value.earth_azimuth_deg) &&
    typeof value.is_sun_visible === "boolean" &&
    typeof value.is_sun_any_part_visible === "boolean" &&
    typeof value.is_sun_full_disk_visible === "boolean" &&
    typeof value.is_earth_visible === "boolean" &&
    typeof value.is_earth_any_part_visible === "boolean" &&
    typeof value.is_earth_full_disk_visible === "boolean" &&
    isFiniteNumber(value.earth_distance_km) &&
    isFiniteNumber(value.earth_latency_rtt_sec) &&
    (value.earth_phase_angle_deg === null || isFiniteNumber(value.earth_phase_angle_deg))
  );
}

function isLibrationData(value: unknown): value is LibrationData {
  return (
    isRecord(value) &&
    isFiniteNumber(value.sub_earth_lat) &&
    isFiniteNumber(value.sub_earth_lon) &&
    isFiniteNumber(value.sub_solar_lat) &&
    isFiniteNumber(value.sub_solar_lon) &&
    isFiniteNumber(value.earth_distance_km) &&
    isFiniteNumber(value.sun_distance_au) &&
    isFiniteNumber(value.earth_phase_angle_deg)
  );
}

async function loadSites(): Promise<LandingSite[]> {
  const payload = await requestJson("/api/sites");
  if (!isRecord(payload) || !Array.isArray(payload.sites) || !payload.sites.every(isApiSite)) {
    throw new Error("La respuesta de /api/sites no coincide con el contrato esperado.");
  }

  return payload.sites.map((site) => ({
    id: site.id,
    name: site.nombre,
    slug: site.id,
    coordinates: { lat: site.latitud, lng: site.longitud },
    elevationMeters: site.altitud_km * 1000,
    illuminationAvgPercent: site.pct_luz_solar,
    earthVisibilityPercent: site.pct_vista_tierra,
    mission: site.mision,
  }));
}

let siteCatalogRequest: Promise<LandingSite[]> | null = null;
const siteTimelineRequests = new Map<string, Promise<SiteTimeline>>();

export function fetchSites(): Promise<LandingSite[]> {
  if (!siteCatalogRequest) {
    siteCatalogRequest = loadSites().catch((error: unknown) => {
      siteCatalogRequest = null;
      throw error;
    });
  }
  return siteCatalogRequest;
}

async function loadSiteTimeline(siteId: string): Promise<SiteTimeline> {
  const payload = await requestJson(
    `/api/sites/${encodeURIComponent(siteId)}/timeline`
  );
  if (
    !isRecord(payload) ||
    typeof payload.site_id !== "string" ||
    typeof payload.name !== "string" ||
    !Array.isArray(payload.points) ||
    !payload.points.every(isTimelinePoint)
  ) {
    throw new Error("La respuesta del timeline no coincide con el contrato esperado.");
  }

  return {
    site_id: payload.site_id,
    name: payload.name,
    points: payload.points,
  };
}

export function fetchSiteTimeline(siteId: string): Promise<SiteTimeline> {
  const cachedRequest = siteTimelineRequests.get(siteId);
  if (cachedRequest) return cachedRequest;

  const request = loadSiteTimeline(siteId).catch((error: unknown) => {
    siteTimelineRequests.delete(siteId);
    throw error;
  });
  siteTimelineRequests.set(siteId, request);
  return request;
}

export async function fetchLibration(timestampUtc: string): Promise<LibrationData> {
  const query = new URLSearchParams({ timestamp_utc: timestampUtc });
  const payload = await requestJson(`/api/libration?${query.toString()}`);
  if (!isLibrationData(payload)) {
    throw new Error("La respuesta de /api/libration no coincide con el contrato esperado.");
  }
  return payload;
}
