"use client";

import React, { useEffect, useMemo } from "react";
import { useLoader } from "@react-three/fiber";
import * as THREE from "three";
import type { PresetSite } from "@/lib/context/SiteContext";
import { TERRAIN, latLonToPlane } from "@/lib/geo/polarStereo";
import { DEM_URL, NORMAL_URL } from "@/lib/geo/useTerrainHeight";

/**
 * Tabla de diámetros reales / áreas de interés de exploración (en kilómetros).
 * Proporción de la escena: 100 unidades = 900 km -> 1 unidad 3D = 9 km reales.
 */
export const SITE_ZONE_DIAMETERS_KM: Record<string, number> = {
  "shackleton": 21,
  "malapert": 10,
  "connecting": 25,
  "faustini": 39,
  "schrodinger": 312,
  "schrödinger": 312,
  "drygalski": 149,
};

export const KM_PER_UNIT = 9.0;

/** Diámetro real en km según el ID o nombre del sitio */
export function getSiteZoneKm(siteId: string, fallbackKm: number = 25): number {
  const idLower = siteId.toLowerCase();
  for (const [key, km] of Object.entries(SITE_ZONE_DIAMETERS_KM)) {
    if (idLower.includes(key)) {
      return km;
    }
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
  /** Multiplicador o factor de escala global para el tamaño de las zonas (por defecto 1.0) */
  sizeScale?: number;
  /** Sobrescrituras específicas de tamaño por sitio { [siteId]: unidades } */
  sizeOverrides?: Record<string, number>;
  segments?: number;
  /** Color temático de la zona (hex o THREE.Color). Por defecto: #FF9F1C (Ámbar) */
  color?: THREE.ColorRepresentation;
  /** Opacidad máxima en el borde exterior del cuadrado (el centro siempre es 0). */
  edgeOpacity?: number;
  /** Desplazamiento vertical sobre el terreno (offset / lift) para evitar z-fighting. */
  offset?: number;
  /** Alias legado para retrocompatibilidad con lift */
  lift?: number;
  /** Exponente de curvatura del gradiente del shader */
  gradientPower?: number;
  /** Intensidad emisiva base para visibilidad en zonas oscuras */
  emissiveIntensity?: number;
  /** Permite ocultar/mostrar todas las zonas dinámicamente */
  visible?: boolean;
}

interface ZoneUniforms {
  uEdgeOpacity: { value: number };
  uGradientPower: { value: number };
}

/**
 * Crea un MeshStandardMaterial con el displacement/normal map recortados a la
 * ventana UV exacta de la zona según su posición y tamaño individual en el terreno de 100x100.
 */
function createZoneMaterial(
  dem: THREE.Texture,
  normal: THREE.Texture,
  uv0: THREE.Vector2,
  repeat: number,
  color: THREE.ColorRepresentation,
  edgeOpacity: number,
  gradientPower: number,
  emissiveIntensity: number
) {
  const crop = (src: THREE.Texture) => {
    const t = src.clone();
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.repeat.set(repeat, repeat);
    t.offset.copy(uv0);
    t.updateMatrix();
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
    displacementScale: TERRAIN.displacementScale,
    displacementBias: TERRAIN.displacementBias,
    normalMap,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
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
// Contorno sutil en el perímetro del cuadrado
float zw = fwidth(zd) * 1.5;
zoneAlpha = max(zoneAlpha, smoothstep(1.0 - 0.02 - zw, 1.0 - 0.02, zd) * min(1.0, uEdgeOpacity + 0.2));
diffuseColor.a = zoneAlpha;`
      );
  };
  material.customProgramCacheKey = () => "site-zone-gradient-v2";

  return { material, uniforms, textures: [displacementMap, normalMap] };
}

export const SiteZonesOverlay: React.FC<SiteZonesOverlayProps> = ({
  sites,
  selectedId,
  sizeScale = 1.0,
  sizeOverrides,
  segments = 64,
  color = "#FF9F1C",
  edgeOpacity = 0.7,
  offset: offsetProp,
  lift: liftProp,
  gradientPower = 1.6,
  emissiveIntensity = 0.25,
  visible = true,
}) => {
  const effectiveOffset = offsetProp ?? liftProp ?? 0.05;

  const [dem, normal] = useLoader(THREE.TextureLoader, [DEM_URL, NORMAL_URL]);

  const zones = useMemo(() => {
    return sites
      .map((site) => ({ site, p: latLonToPlane(site.lat, site.lon) }))
      .filter(({ p }) => p.inside)
      .map(({ site, p }) => {
        // Cálculo del tamaño dinámico según tabla de diámetros reales (km / 9)
        const baseSize = sizeOverrides?.[site.id] ?? getSiteZoneSize(site.id);
        const dynamicSize = Math.max(0.5, baseSize * sizeScale);

        // Geometría cuadrada individual adaptada a su tamaño de interés
        const geometry = new THREE.PlaneGeometry(dynamicSize, dynamicSize, segments, segments);

        // Ventana UV específica de este sitio sobre el DEM general
        const repeat = dynamicSize / TERRAIN.size;
        const uv0 = new THREE.Vector2(
          0.5 + (p.x - dynamicSize / 2) / TERRAIN.size,
          0.5 - (p.z + dynamicSize / 2) / TERRAIN.size
        );

        const matData = createZoneMaterial(
          dem,
          normal,
          uv0,
          repeat,
          color,
          edgeOpacity,
          gradientPower,
          emissiveIntensity
        );

        return {
          site,
          p,
          dynamicSize,
          geometry,
          ...matData,
        };
      });
  }, [sites, dem, normal, sizeScale, sizeOverrides, segments, color, edgeOpacity, gradientPower, emissiveIntensity]);

  // Limpieza de geometrías, materiales y texturas
  useEffect(
    () => () =>
      zones.forEach((z) => {
        z.geometry.dispose();
        z.material.dispose();
        z.textures.forEach((t) => t.dispose());
      }),
    [zones]
  );

  // Actualización dinámica y reactiva del color
  useEffect(() => {
    zones.forEach((z) => {
      z.material.color.set(color);
      z.material.emissive.set(color);
    });
  }, [zones, color]);

  // Resaltado dinámico al seleccionar un sitio
  useEffect(() => {
    zones.forEach((z) => {
      const active = z.site.id === selectedId;
      z.uniforms.uEdgeOpacity.value = active ? Math.min(1.0, edgeOpacity + 0.2) : edgeOpacity;
      z.uniforms.uGradientPower.value = gradientPower;
      z.material.emissiveIntensity = active ? emissiveIntensity * 2.5 : emissiveIntensity;
    });
  }, [zones, selectedId, edgeOpacity, gradientPower, emissiveIntensity]);

  if (!visible) return null;

  return (
    <group>
      {zones.map(({ site, p, geometry, material }) => (
        <mesh
          key={site.id}
          geometry={geometry}
          material={material}
          position={[p.x, effectiveOffset, p.z]}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
          renderOrder={1}
        />
      ))}
    </group>
  );
};

export default SiteZonesOverlay;
