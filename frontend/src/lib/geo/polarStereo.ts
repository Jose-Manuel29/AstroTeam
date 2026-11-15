import * as THREE from "three";

/**
 * Geometría del Mapa 3D Local (Polo Sur Lunar)
 * -------------------------------------------
 * Las texturas se generaron con GDAL en Estereográfica Polar Sur:
 *   +proj=stere +lat_0=-90 +lon_0=0 +k=1 +R=1737400
 *   Bounding box [-450 km, +450 km] → cobertura ≈ -90° … -75.24° de latitud.
 * El planeGeometry (lado TERRAIN.size) se rota -90° en X, por lo que:
 *   Este  (+x proyectado) → +X mundo
 *   Norte (+y proyectado) → -Z mundo
 */
export const MOON_RADIUS_M = 1_737_400;
export const MAP_HALF_EXTENT_M = 450_000;

export const TERRAIN = {
  size: 100,
  segments: 256,
  displacementScale: 2.5,
  displacementBias: -1.25,
} as const;

/** Kilómetros reales por unidad de escena (900 km / 100 u = 9 km/u). */
export const KM_PER_UNIT = (2 * MAP_HALF_EXTENT_M) / 1000 / TERRAIN.size;

export interface PlaneCoords {
  /** Coordenadas de mundo sobre el plano (Y se resuelve con el DEM). */
  x: number;
  z: number;
  /** UV de la textura (v = 1 en el borde superior de la imagen). */
  u: number;
  v: number;
  /** true si el punto cae dentro del bloque de terreno. */
  inside: boolean;
}

/** lat/lon selenográficos (°) → metros en Estereográfica Polar Sur (k=1). */
export function latLonToSouthPolarStereo(lat: number, lon: number): { x: number; y: number } {
  const colat = THREE.MathUtils.degToRad(90 + lat); // 0 en el Polo Sur
  const rho = 2 * MOON_RADIUS_M * Math.tan(colat / 2);
  const lambda = THREE.MathUtils.degToRad(lon);
  return { x: rho * Math.sin(lambda), y: rho * Math.cos(lambda) };
}

/** lat/lon (°) → posición sobre el planeGeometry del terreno local. */
export function latLonToPlane(lat: number, lon: number, size: number = TERRAIN.size): PlaneCoords {
  const { x, y } = latLonToSouthPolarStereo(lat, lon);
  const span = 2 * MAP_HALF_EXTENT_M;
  return {
    x: (x / span) * size,
    z: -(y / span) * size,
    u: (x + MAP_HALF_EXTENT_M) / span,
    v: (y + MAP_HALF_EXTENT_M) / span,
    inside: Math.abs(x) <= MAP_HALF_EXTENT_M && Math.abs(y) <= MAP_HALF_EXTENT_M,
  };
}
