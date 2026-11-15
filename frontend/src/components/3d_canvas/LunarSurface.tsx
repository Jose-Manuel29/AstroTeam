"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { useLoader } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import { useSiteContext, type PresetSite } from "@/lib/context/SiteContext";
import { TERRAIN, latLonToPlane } from "@/lib/geo/polarStereo";
import { DEM_URL, NORMAL_URL, useTerrainHeight } from "@/lib/geo/useTerrainHeight";
import { TerrainPedestal } from "@/components/3d_canvas/TerrainPedestal";

export const DEFAULT_ALBEDO_URL = "/textures/albedo_wac_delighted.webp";

// Pre-carga las texturas base para acelerar la transición hacia SiteDetailView
useLoader.preload(THREE.TextureLoader, [DEFAULT_ALBEDO_URL, DEM_URL, NORMAL_URL]);

export type DioramaCutoutShape = "square" | "circle";

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
  /** Radio / semi-lado del recorte del diorama aislado (15 u ≈ 135 km). */
  focusRadius?: number;
  /** Forma geométrica del recorte del diorama aislado ("square" por defecto, o "circle"). */
  cutoutShape?: DioramaCutoutShape;
  /** Bloque sólido (pedestal) bajo el relieve, estilo maqueta. */
  showPedestal?: boolean;
  pedestalDepth?: number;
  pedestalColor?: string;
  /** Callback invocado cuando las texturas terminan de cargar */
  onLoaded?: () => void;
  children?: React.ReactNode;
}

interface CutoutUniforms {
  uFocusPos: { value: THREE.Vector2 };
  uFocusRadius: { value: number };
  uFocusActive: { value: number };
  uFocusShape: { value: number };
}

interface DioramaPedestalProps {
  centerX: number;
  centerZ: number;
  radius: number;
  shape?: DioramaCutoutShape;
  terrainSize: number;
  demUrl: string;
  displacementScale: number;
  displacementBias: number;
  depth: number;
}

/**
 * Pedestal del Diorama Aislado (#050505 negro mate):
 * Sigue a `selectedSite` en (x, z) con dimensiones acordes a `uFocusRadius`.
 * Soporta recorte cuadrado (bloque cúbico de maqueta) o circular (cilíndrico).
 * Su borde superior se adapta a la cota real del DEM a lo largo del perímetro
 * para que parezca un bloque sólido extraído directamente del Polo Sur lunar.
 */
const DioramaPedestal: React.FC<DioramaPedestalProps> = ({
  centerX,
  centerZ,
  radius,
  shape = "square",
  terrainSize,
  demUrl,
  displacementScale,
  displacementBias,
  depth,
}) => {
  const heightAt = useTerrainHeight(demUrl, displacementScale, displacementBias);
  const baseY = displacementBias - depth;

  const { wallGeo, rimPoints, halfSide } = useMemo(() => {
    if (shape === "square") {
      const s = radius * 0.96;
      const segmentsPerSide = 24;
      const positions: number[] = [];
      const normals: number[] = [];
      const indices: number[] = [];
      const rim: [number, number, number][] = [];

      // 4 caras del prisma cuadrangular con normales exactas para aristas vivas
      const sides: [[number, number], [number, number], [number, number, number]][] = [
        [[-s, -s], [s, -s], [0, 0, -1]], // Cara Sur
        [[s, -s], [s, s], [1, 0, 0]],    // Cara Este
        [[s, s], [-s, s], [0, 0, 1]],    // Cara Norte
        [[-s, s], [-s, -s], [-1, 0, 0]], // Cara Oeste
      ];

      let vCount = 0;
      for (const [p1, p2, norm] of sides) {
        const startV = vCount;
        for (let i = 0; i <= segmentsPerSide; i++) {
          const t = i / segmentsPerSide;
          const dx = p1[0] + (p2[0] - p1[0]) * t;
          const dz = p1[1] + (p2[1] - p1[1]) * t;
          const wx = centerX + dx;
          const wz = centerZ + dz;

          const u = THREE.MathUtils.clamp(0.5 + wx / terrainSize, 0, 1);
          const v = THREE.MathUtils.clamp(0.5 - wz / terrainSize, 0, 1);
          const topY = heightAt(u, v) - 0.03;

          positions.push(dx, topY, dz);
          positions.push(dx, baseY, dz);
          normals.push(norm[0], norm[1], norm[2]);
          normals.push(norm[0], norm[1], norm[2]);
          rim.push([dx, baseY, dz]);
          vCount += 2;
        }

        for (let i = 0; i < segmentsPerSide; i++) {
          const a = startV + i * 2;
          indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
      }

      if (rim.length > 0) rim.push(rim[0]);

      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      g.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
      g.setIndex(indices);

      return { wallGeo: g, rimPoints: rim, halfSide: s };
    }

    // Modo circular / cilíndrico
    const r = radius * 0.9;
    const radialSegments = 96;
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

    return { wallGeo: g, rimPoints: rim, halfSide: r };
  }, [centerX, centerZ, radius, shape, terrainSize, heightAt, displacementBias, depth]);

  return (
    <group position={[centerX, 0, centerZ]}>
      {/* Pared vertical del bloque diorama acoplada al relieve superior */}
      <mesh geometry={wallGeo} castShadow receiveShadow>
        <meshStandardMaterial
          color="#0D0D0D"
          roughness={0.95}
          metalness={0.05}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Base inferior en negro mate (#0D0D0D) */}
      <mesh position={[0, baseY - 0.1, 0]} receiveShadow>
        {shape === "square" ? (
          <boxGeometry args={[2 * halfSide, 0.2, 2 * halfSide]} />
        ) : (
          <cylinderGeometry args={[halfSide, halfSide, 0.2, 96]} />
        )}
        <meshStandardMaterial color="#0D0D0D" roughness={0.95} metalness={0.05} />
      </mesh>

      {/* Marco / Aro holográfico sutil en la base (palette-ochre) */}
      <Line
        points={rimPoints}
        color="#A6948A"
        lineWidth={1.2}
        transparent
        opacity={0.5}
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
  mapUrl = DEFAULT_ALBEDO_URL,
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
  cutoutShape = "square",
  showPedestal = true,
  pedestalDepth = 4,
  pedestalColor = "#0b0e14",
  onLoaded,
  children,
}) => {
  const { selectedSite: contextSite } = useSiteContext();
  const activeSite = selectedSiteProp !== undefined ? selectedSiteProp : contextSite;

  const [colorMap, displacementMap, normalMap] = useLoader(THREE.TextureLoader, [
    mapUrl,
    demUrl,
    normalUrl,
  ]);

  const loadedNotifiedRef = useRef(false);
  useEffect(() => {
    colorMap.colorSpace = THREE.SRGBColorSpace;
    colorMap.anisotropy = 8;
    colorMap.needsUpdate = true;
    if (!loadedNotifiedRef.current && colorMap && displacementMap && normalMap) {
      loadedNotifiedRef.current = true;
      onLoaded?.();
    }
  }, [colorMap, displacementMap, normalMap, onLoaded]);

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
      uFocusShape: { value: cutoutShape === "circle" ? 0.0 : 1.0 },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Actualiza los uniforms reactivamente cuando cambia el sitio, el radio o la forma
  useEffect(() => {
    if (focusCoords) {
      cutoutUniforms.uFocusPos.value.set(focusCoords.x, focusCoords.z);
      cutoutUniforms.uFocusRadius.value = focusRadius;
      cutoutUniforms.uFocusActive.value = 1.0;
      cutoutUniforms.uFocusShape.value = cutoutShape === "circle" ? 0.0 : 1.0;
    } else {
      cutoutUniforms.uFocusActive.value = 0.0;
    }
  }, [focusCoords, focusRadius, cutoutShape, cutoutUniforms]);

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
vWorldXZ = vec2(transformed.x, -transformed.y);`
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
varying vec2 vWorldXZ;
uniform vec2 uFocusPos;
uniform float uFocusRadius;
uniform float uFocusActive;
uniform float uFocusShape;`
        )
        .replace(
          "#include <dithering_fragment>",
          `#include <dithering_fragment>
if (uFocusActive > 0.5) {
  float dist = uFocusShape > 0.5
    ? max(abs(vWorldXZ.x - uFocusPos.x), abs(vWorldXZ.y - uFocusPos.y))
    : distance(vWorldXZ, uFocusPos);
  float edgeStart = uFocusShape > 0.5 ? (uFocusRadius * 0.96) : (uFocusRadius * 0.85);
  float focusAlpha = 1.0 - smoothstep(edgeStart, uFocusRadius, dist);
  gl_FragColor.a *= focusAlpha;
  if (gl_FragColor.a < 0.01) discard;
}`
        );
    };
    mat.customProgramCacheKey = () => "lunar-surface-diorama-cutout-v2";
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
vWorldXZ = vec2(transformed.x, -transformed.y);`
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
varying vec2 vWorldXZ;
uniform vec2 uFocusPos;
uniform float uFocusRadius;
uniform float uFocusActive;
uniform float uFocusShape;`
        )
        .replace(
          "gl_FragColor = packDepthToRGBA( fragCoordZ );",
          `if (uFocusActive > 0.5) {
  float dist = uFocusShape > 0.5
    ? max(abs(vWorldXZ.x - uFocusPos.x), abs(vWorldXZ.y - uFocusPos.y))
    : distance(vWorldXZ, uFocusPos);
  if (dist > uFocusRadius) discard;
}
gl_FragColor = packDepthToRGBA( fragCoordZ );`
        );
    };
    mat.customProgramCacheKey = () => "lunar-depth-diorama-cutout-v2";
    return mat;
  }, [displacementMap, displacementScale, displacementBias, cutoutUniforms]);

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

      {/* Pedestal: Bloque prismático cuadrangular o cilíndrico según cutoutShape */}
      {showPedestal &&
        (focusCoords ? (
          <DioramaPedestal
            centerX={focusCoords.x}
            centerZ={focusCoords.z}
            radius={focusRadius}
            shape={cutoutShape}
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
