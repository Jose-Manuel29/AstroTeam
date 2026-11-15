"use client";

import React, { useEffect, useMemo } from "react";
import { useLoader } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import { useSiteContext, type PresetSite } from "@/lib/context/SiteContext";
import { TERRAIN, latLonToPlane } from "@/lib/geo/polarStereo";
import { DEM_URL, NORMAL_URL, useTerrainHeight } from "@/lib/geo/useTerrainHeight";
import { TerrainPedestal } from "@/components/3d_canvas/TerrainPedestal";

export interface LunarSurfaceProps {
  /** Albedo WAC sin sombras fotográficas (delight_wac.py). */
  mapUrl?: string;
  /** DEM LOLA (escala de grises → desplazamiento). */
  demUrl?: string;
  /** Normal map tangente derivado del DEM (dem_to_normal.py). */
  normalUrl?: string;
  size?: number;
  segments?: number;
  displacementScale?: number;
  displacementBias?: number;
  normalScale?: number;
  roughness?: number;
  metalness?: number;
  wireframe?: boolean;
  /** Sitio seleccionado (si se omite, se lee de useSiteContext). */
  selectedSite?: PresetSite | null;
  /** Radio del recorte del diorama holográfico en unidades (15 u ≈ 135 km). */
  focusRadius?: number;
  /** Bloque sólido (pedestal) bajo el relieve, estilo maqueta. */
  showPedestal?: boolean;
  pedestalDepth?: number;
  pedestalColor?: string;
  children?: React.ReactNode;
}

interface CutoutUniforms {
  uFocusPos: { value: THREE.Vector2 };
  uFocusRadius: { value: number };
  uFocusActive: { value: number };
}

interface DioramaPedestalProps {
  centerX: number;
  centerZ: number;
  radius: number;
  terrainSize: number;
  demUrl: string;
  displacementScale: number;
  displacementBias: number;
  depth: number;
}

/**
 * Pedestal cilíndrico del Diorama Aislado (#050505 negro mate):
 * Sigue a `selectedSite` en (x, z) con radio `uFocusRadius`. Su borde superior se
 * adapta a la cota real del DEM a lo largo del perímetro circular para que parezca
 * un bloque sólido extraído directamente del Polo Sur sin huecos ni intersecciones.
 */
const DioramaPedestal: React.FC<DioramaPedestalProps> = ({
  centerX,
  centerZ,
  radius,
  terrainSize,
  demUrl,
  displacementScale,
  displacementBias,
  depth,
}) => {
  const heightAt = useTerrainHeight(demUrl, displacementScale, displacementBias);
  // Radio efectivo ligeramente dentro del borde smoothstep para evitar flecos flotantes
  const r = radius * 0.9;
  const baseY = displacementBias - depth;
  const radialSegments = 96;

  const { wallGeo, rimPoints } = useMemo(() => {
    const positions: number[] = [];
    const indices: number[] = [];
    const rim: [number, number, number][] = [];

    for (let i = 0; i <= radialSegments; i++) {
      const theta = (i / radialSegments) * Math.PI * 2;
      const dx = Math.cos(theta) * r;
      const dz = Math.sin(theta) * r;
      const wx = centerX + dx;
      const wz = centerZ + dz;

      const u = THREE.MathUtils.clamp(0.5 + wx / terrainSize, 0, 1);
      const v = THREE.MathUtils.clamp(0.5 - wz / terrainSize, 0, 1);
      const topY = heightAt(u, v) - 0.03;

      positions.push(dx, topY, dz);
      positions.push(dx, baseY, dz);
      rim.push([dx, baseY, dz]);
    }

    for (let i = 0; i < radialSegments; i++) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    g.setIndex(indices);
    g.computeVertexNormals();

    return { wallGeo: g, rimPoints: rim };
  }, [centerX, centerZ, r, terrainSize, heightAt, baseY]);

  useEffect(() => () => wallGeo.dispose(), [wallGeo]);

  return (
    <group position={[centerX, 0, centerZ]}>
      {/* Pared cilíndrica acoplada al relieve superior */}
      <mesh geometry={wallGeo} castShadow receiveShadow>
        <meshStandardMaterial
          color="#050505"
          roughness={0.95}
          metalness={0.05}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Base cilíndrica inferior en negro mate (#050505) */}
      <mesh position={[0, baseY - 0.1, 0]} receiveShadow>
        <cylinderGeometry args={[r, r, 0.2, radialSegments]} />
        <meshStandardMaterial color="#050505" roughness={0.95} metalness={0.05} />
      </mesh>

      {/* Aro holográfico sutil en la base del cilindro */}
      <Line
        points={rimPoints}
        color="#00ffff"
        lineWidth={1.2}
        transparent
        opacity={0.45}
      />
    </group>
  );
};

/**
 * Mapa 3D Local: bloque topográfico WAC (albedo) + LOLA DEM (relieve) + normales.
 * Cuando hay un `selectedSite` activo, recorta el terreno mediante GLSL (`uFocusPos`,
 * `uFocusRadius`) aislando un Diorama Holográfico sobre un pedestal cilíndrico mate.
 */
export const LunarSurface: React.FC<LunarSurfaceProps> = ({
  mapUrl = "/textures/albedo_wac_delighted.webp",
  demUrl = DEM_URL,
  normalUrl = NORMAL_URL,
  size = TERRAIN.size,
  segments = TERRAIN.segments,
  displacementScale = TERRAIN.displacementScale,
  displacementBias = TERRAIN.displacementBias,
  normalScale = 1,
  roughness = 1,
  metalness = 0,
  wireframe = false,
  selectedSite: selectedSiteProp,
  focusRadius = 15.0,
  showPedestal = true,
  pedestalDepth = 4,
  pedestalColor = "#0b0e14",
  children,
}) => {
  const { selectedSite: contextSite } = useSiteContext();
  const activeSite = selectedSiteProp !== undefined ? selectedSiteProp : contextSite;

  const [colorMap, displacementMap, normalMap] = useLoader(THREE.TextureLoader, [
    mapUrl,
    demUrl,
    normalUrl,
  ]);

  useEffect(() => {
    colorMap.colorSpace = THREE.SRGBColorSpace;
    colorMap.anisotropy = 8;
    colorMap.needsUpdate = true;
  }, [colorMap]);

  const normalScaleVec = useMemo(() => new THREE.Vector2(normalScale, normalScale), [normalScale]);

  // Coordenadas (x, z) del sitio seleccionado en el plano
  const focusCoords = useMemo(() => {
    if (!activeSite) return null;
    const p = latLonToPlane(activeSite.lat, activeSite.lon, size);
    if (!p.inside) return null;
    return p;
  }, [activeSite, size]);

  // Uniforms compartidos entre el material principal y el depth material
  const cutoutUniforms = useMemo<CutoutUniforms>(
    () => ({
      uFocusPos: { value: new THREE.Vector2(0, 0) },
      uFocusRadius: { value: focusRadius },
      uFocusActive: { value: 0 },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Actualiza los uniforms reactivamente cuando cambia el sitio o el radio
  useEffect(() => {
    if (focusCoords) {
      cutoutUniforms.uFocusPos.value.set(focusCoords.x, focusCoords.z);
      cutoutUniforms.uFocusRadius.value = focusRadius;
      cutoutUniforms.uFocusActive.value = 1.0;
    } else {
      cutoutUniforms.uFocusActive.value = 0.0;
    }
  }, [focusCoords, focusRadius, cutoutUniforms]);

  // Material estándar del terreno con inyección GLSL para el recorte del diorama
  const surfaceMaterial = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      map: colorMap,
      displacementMap,
      displacementScale,
      displacementBias,
      normalMap,
      normalScale: normalScaleVec,
      roughness,
      metalness,
      wireframe,
      transparent: true,
      depthWrite: true,
    });

    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, cutoutUniforms);

      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec2 vWorldXZ;")
        .replace(
          "#include <project_vertex>",
          `#include <project_vertex>
vWorldXZ = (modelMatrix * vec4(transformed, 1.0)).xz;`
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
varying vec2 vWorldXZ;
uniform vec2 uFocusPos;
uniform float uFocusRadius;
uniform float uFocusActive;`
        )
        .replace(
          "#include <dithering_fragment>",
          `#include <dithering_fragment>
if (uFocusActive > 0.5) {
  float dist = distance(vWorldXZ, uFocusPos);
  float focusAlpha = 1.0 - smoothstep(uFocusRadius * 0.85, uFocusRadius, dist);
  gl_FragColor.a *= focusAlpha;
  if (gl_FragColor.a < 0.01) discard;
}`
        );
    };
    mat.customProgramCacheKey = () => "lunar-surface-diorama-cutout-v1";
    return mat;
  }, [
    colorMap,
    displacementMap,
    displacementScale,
    displacementBias,
    normalMap,
    normalScaleVec,
    roughness,
    metalness,
    wireframe,
    cutoutUniforms,
  ]);

  useEffect(() => () => surfaceMaterial.dispose(), [surfaceMaterial]);

  // Depth material sincronizado con el desplazamiento y el recorte
  const depthMaterial = useMemo(() => {
    const mat = new THREE.MeshDepthMaterial({
      depthPacking: THREE.RGBADepthPacking,
      displacementMap,
      displacementScale,
      displacementBias,
    });

    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, cutoutUniforms);

      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec2 vWorldXZ;")
        .replace(
          "#include <project_vertex>",
          `#include <project_vertex>
vWorldXZ = (modelMatrix * vec4(transformed, 1.0)).xz;`
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
varying vec2 vWorldXZ;
uniform vec2 uFocusPos;
uniform float uFocusRadius;
uniform float uFocusActive;`
        )
        .replace(
          "gl_FragColor = packDepthToRGBA( fragCoordZ );",
          `if (uFocusActive > 0.5 && distance(vWorldXZ, uFocusPos) > uFocusRadius) discard;
gl_FragColor = packDepthToRGBA( fragCoordZ );`
        );
    };
    mat.customProgramCacheKey = () => "lunar-depth-diorama-cutout-v1";
    return mat;
  }, [displacementMap, displacementScale, displacementBias, cutoutUniforms]);

  useEffect(() => () => depthMaterial.dispose(), [depthMaterial]);

  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        material={surfaceMaterial}
        customDepthMaterial={depthMaterial}
        receiveShadow
        castShadow
      >
        <planeGeometry args={[size, size, segments, segments]} />
      </mesh>

      {/* Pedestal: Cilíndrico de Diorama (#050505) si hay sitio aislado; completo si no */}
      {showPedestal &&
        (focusCoords ? (
          <DioramaPedestal
            centerX={focusCoords.x}
            centerZ={focusCoords.z}
            radius={focusRadius}
            terrainSize={size}
            demUrl={demUrl}
            displacementScale={displacementScale}
            displacementBias={displacementBias}
            depth={pedestalDepth}
          />
        ) : (
          <TerrainPedestal
            size={size}
            segments={segments}
            demUrl={demUrl}
            displacementScale={displacementScale}
            displacementBias={displacementBias}
            depth={pedestalDepth}
            color={pedestalColor}
          />
        ))}

      {children}
    </group>
  );
};

export default LunarSurface;
