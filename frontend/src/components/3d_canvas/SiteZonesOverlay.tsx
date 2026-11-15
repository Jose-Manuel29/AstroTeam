"use client";

import React, { useEffect, useMemo } from "react";
import { useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { useSiteContext, type PresetSite } from "@/lib/context/SiteContext";
import { TERRAIN, latLonToPlane } from "@/lib/geo/polarStereo";
import { DEM_URL, NORMAL_URL } from "@/lib/geo/useTerrainHeight";

/**
 * Tabla de diámetros reales / áreas de interés de exploración (en kilómetros).
 * Proporción de la escena: 100 unidades = 900 km -> 1 unidad 3D = 9 km reales.
 */
export const SITE_ZONE_DIAMETERS_KM: Record<string, number> = {
  shackleton: 21,
  malapert: 10,
  connecting: 25,
  faustini: 39,
  schrodinger: 312,
  "schrödinger": 312,
  drygalski: 149,
};

export const KM_PER_UNIT = 9.0;

/** Elevación fija de la malla de zona sobre el terreno (anti z-fighting). */
export const ZONE_LIFT = 0.02;

/** Diámetro real en km según el ID o nombre del sitio */
export function getSiteZoneKm(siteId: string, fallbackKm: number = 25): number {
  const idLower = siteId.toLowerCase();
  for (const [key, km] of Object.entries(SITE_ZONE_DIAMETERS_KM)) {
    if (idLower.includes(key)) return km;
  }
  return fallbackKm;
}

/** Obtiene el tamaño en unidades de escena (km / 9) según el ID o nombre del sitio */
export function getSiteZoneSize(siteId: string, fallbackKm: number = 25): number {
  return getSiteZoneKm(siteId, fallbackKm) / KM_PER_UNIT;
}

export interface SiteZonesOverlayProps {
  sites: PresetSite[];
  selectedId?: string | null;
  /** Multiplicador global del tamaño de las zonas (por defecto 1.0) */
  sizeScale?: number;
  /** Sobrescrituras de tamaño por sitio { [siteId]: unidades } */
  sizeOverrides?: Record<string, number>;
  /** Geometría del terreno base (debe coincidir con <LunarSurface>) */
  terrainSize?: number;
  terrainSegments?: number;
  displacementScale?: number;
  displacementBias?: number;
  /** Color temático de la zona. Por defecto: #FF9F1C (Ámbar) */
  color?: THREE.ColorRepresentation;
  /** Opacidad máxima en el borde exterior (el centro siempre es 0). */
  edgeOpacity?: number;
  /** Elevación sobre el terreno. Por defecto 0.02 (ZONE_LIFT). */
  offset?: number;
  /** Exponente de curvatura del gradiente del shader */
  gradientPower?: number;
  /** Intensidad emisiva base para visibilidad en zonas oscuras */
  emissiveIntensity?: number;
  visible?: boolean;
}

interface ZoneUniforms {
  uEdgeOpacity: { value: number };
  uGradientPower: { value: number };
}

/**
 * Ventana de la zona ALINEADA A LA REJILLA del terreno.
 * ----------------------------------------------------
 * Por qué flotaban: el terreno sólo evalúa el DEM en sus vértices (cada 100/512 u)
 * e interpola linealmente entre ellos; la zona usaba 64 segmentos propios, así que
 * sus vértices caían ENTRE los del terreno y muestreaban picos del DEM que la malla
 * base no representa → partes de la zona por encima (flotando) y otras por debajo.
 *
 * Solución: el plano de la zona usa exactamente los mismos vértices que el terreno.
 *   cell     = terrainSize / terrainSegments
 *   (iu, iv) = vértice del terreno más cercano al sitio (en espacio UV · segments)
 *   n        = nº de celdas por lado (par, para que el sitio quede en el centro)
 *   repeat   = [n / segments, n / segments]          ( = sizeX/100, sizeZ/100 )
 *   offset   = [(iu - n/2) / segments, (iv - n/2) / segments]
 * Ejes: u = (x + 50)/100 ;  v = (50 - z)/100   (el plano está rotado -90° en X,
 * por lo que la V de la textura crece hacia -Z; con +Z el relieve saldría espejado).
 * Así cada vértice de la zona muestrea el MISMO texel que el vértice del terreno
 * situado debajo y la superficie coincide al 100 %; sólo se separa ZONE_LIFT.
 */
function computeGridWindow(
  x: number,
  z: number,
  requestedSize: number,
  terrainSize: number,
  segments: number
) {
  const cell = terrainSize / segments;
  const half = terrainSize / 2;

  const iu = Math.round(((x + half) / terrainSize) * segments);
  const iv = Math.round(((half - z) / terrainSize) * segments);

  let n = Math.max(2, Math.round(requestedSize / cell));
  if (n % 2 === 1) n += 1;

  const i0 = iu - n / 2;
  const j0 = iv - n / 2;

  return {
    n,
    size: n * cell,
    repeat: new THREE.Vector2(n / segments, n / segments),
    offset: new THREE.Vector2(i0 / segments, j0 / segments),
    // Centro exacto del vértice de la rejilla en coordenadas de mundo
    center: { x: iu * cell - half, z: half - iv * cell },
  };
}

function createZoneMaterial(
  dem: THREE.Texture,
  normal: THREE.Texture,
  offset: THREE.Vector2,
  repeat: THREE.Vector2,
  color: THREE.ColorRepresentation,
  edgeOpacity: number,
  gradientPower: number,
  emissiveIntensity: number,
  displacementScale: number,
  displacementBias: number
) {
  const crop = (src: THREE.Texture) => {
    const t = src.clone(); // comparte la fuente GPU con el terreno
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.repeat.copy(repeat);
    t.offset.copy(offset);
    t.rotation = 0;
    t.center.set(0, 0);
    t.updateMatrix(); // uv' = uv * repeat + offset
    return t;
  };

  const displacementMap = crop(dem);
  const normalMap = crop(normal);

  const uniforms: ZoneUniforms = {
    uEdgeOpacity: { value: edgeOpacity },
    uGradientPower: { value: gradientPower },
  };

  const material = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity,
    roughness: 0.9,
    metalness: 0,
    displacementMap,
    displacementScale,
    displacementBias,
    normalMap,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    side: THREE.DoubleSide,
  });

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vZoneUv;")
      .replace("#include <uv_vertex>", "#include <uv_vertex>\nvZoneUv = uv;");

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec2 vZoneUv;
uniform float uEdgeOpacity;
uniform float uGradientPower;`
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
// Distancia de Chebyshev al centro local: 0.0 en (0.5, 0.5), 1.0 en los bordes
vec2 zq = abs(vZoneUv - 0.5) * 2.0;
float zd = max(zq.x, zq.y);
float zoneAlpha = uEdgeOpacity * pow(zd, uGradientPower);
float zw = fwidth(zd) * 1.5;
zoneAlpha = max(zoneAlpha, smoothstep(1.0 - 0.02 - zw, 1.0 - 0.02, zd) * min(1.0, uEdgeOpacity + 0.2));
diffuseColor.a = zoneAlpha;`
      );
  };
  material.customProgramCacheKey = () => "site-zone-gradient-v3";

  return { material, uniforms, textures: [displacementMap, normalMap] };
}

export const SiteZonesOverlay: React.FC<SiteZonesOverlayProps> = ({
  sites,
  selectedId: selectedIdProp,
  sizeScale = 1.0,
  sizeOverrides,
  terrainSize = TERRAIN.size,
  terrainSegments = TERRAIN.segments,
  displacementScale = TERRAIN.displacementScale,
  displacementBias = TERRAIN.displacementBias,
  color = "#FF9F1C",
  edgeOpacity = 0.7,
  offset: offsetProp,
  gradientPower = 1.6,
  emissiveIntensity = 0.8,
  visible = true,
}) => {
  const { selectedSite: contextSite, zoneOffset: contextOffset } = useSiteContext();
  const selectedId = selectedIdProp !== undefined ? selectedIdProp : contextSite?.id ?? null;
  const effectiveOffset = offsetProp !== undefined ? offsetProp : contextOffset;

  const [dem, normal] = useLoader(THREE.TextureLoader, [DEM_URL, NORMAL_URL]);

  const zones = useMemo(() => {
    return sites
      .map((site) => ({ site, p: latLonToPlane(site.lat, site.lon, terrainSize) }))
      .filter(({ p }) => p.inside)
      .map(({ site, p }) => {
        const requested = Math.max(0.5, (sizeOverrides?.[site.id] ?? getSiteZoneSize(site.id)) * sizeScale);
        const win = computeGridWindow(p.x, p.z, requested, terrainSize, terrainSegments);

        // Mismo número de segmentos que celdas del terreno → vértices coincidentes
        const geometry = new THREE.PlaneGeometry(win.size, win.size, win.n, win.n);

        const matData = createZoneMaterial(
          dem,
          normal,
          win.offset,
          win.repeat,
          color,
          edgeOpacity,
          gradientPower,
          emissiveIntensity,
          displacementScale,
          displacementBias
        );

        return { site, center: win.center, geometry, ...matData };
      });
    // color/edgeOpacity/gradient/emissive se actualizan en caliente más abajo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sites, dem, normal, sizeScale, sizeOverrides, terrainSize, terrainSegments, displacementScale, displacementBias]);

  useEffect(() => {
    zones.forEach((z) => {
      z.material.color.set(color);
      z.material.emissive.set(color);
    });
  }, [zones, color]);

  useEffect(() => {
    zones.forEach((z) => {
      const active = z.site.id === selectedId;
      z.uniforms.uEdgeOpacity.value = active ? Math.min(1.0, edgeOpacity + 0.2) : edgeOpacity;
      z.uniforms.uGradientPower.value = gradientPower;
      z.material.emissiveIntensity = active ? emissiveIntensity * 1.35 : emissiveIntensity;
    });
  }, [zones, selectedId, edgeOpacity, gradientPower, emissiveIntensity]);

  if (!visible) return null;

  return (
    <group>
      {zones
        .filter(({ site }) => !selectedId || site.id === selectedId)
        .map(({ site, center, geometry, material }) => (
          <mesh
            key={site.id}
            geometry={geometry}
            material={material}
            position={[center.x, effectiveOffset, center.z]}
            rotation={[-Math.PI / 2, 0, 0]}
            receiveShadow
            renderOrder={1}
          />
        ))}
    </group>
  );
};

export default SiteZonesOverlay;
