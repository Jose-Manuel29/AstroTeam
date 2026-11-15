"use client";

import React, { useMemo, useCallback, useEffect } from "react";
import { useLoader } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";

export interface LunarSurfaceProps {
  /**
   * Dimensión del plano cuadrado en unidades de Three.js (ancho y alto).
   * @default 100
   */
  size?: number;
  /**
   * Factor de escala vertical para el mapa de desplazamiento (LOLA DEM).
   * Controla la altura macroscópica de picos y cráteres lunares.
   * @default 12
   */
  displacementScale?: number;
  /**
   * Desplazamiento base para centrar la elevación vertical.
   * @default -3
   */
  displacementBias?: number;
  /**
   * Intensidad del mapa de normales (micro-relieve de la superficie).
   * @default 1.5
   */
  normalScale?: number;
  /**
   * Rugosidad del material para simular el regolito lunar.
   * @default 0.92
   */
  roughness?: number;
  /**
   * Metalicidad del suelo lunar.
   * @default 0.02
   */
  metalness?: number;
  /**
   * Modo malla de alambre para depuración geométrica.
   * @default false
   */
  wireframe?: boolean;
  /**
   * Posición en el espacio 3D.
   * @default [0, 0, 0]
   */
  position?: [number, number, number];
  /**
   * Rotación del bloque completo en radianes.
   * @default [0, Math.PI / 4, 0]
   */
  rotation?: [number, number, number];
  /**
   * Subdivisión de vértices para la geometría plana.
   * @default 512
   */
  segments?: number;
  /**
   * Muestra el bloque base tipo diorama y los marcadores verticales de telemetría.
   * @default true
   */
  showDioramaBase?: boolean;
  /**
   * Callback disparado cuando las 3 texturas científicas están cargadas y la malla lista en GPU.
   */
  onLoaded?: () => void;
}

/**
 * Componente LunarSurface (Vista Local / Polo Sur Lunar)
 * ----------------------------------------------------
 * Renderiza la superficie lunar como un bloque topográfico 3D isométrico (diorama)
 * utilizando texturas de alta resolución generadas con GDAL (LROC WAC + LOLA DEM).
 */
const LUNAR_SURFACE_TEXTURES = [
  "/textures/skin_wac_2k.webp",
  "/textures/displacement_lola_2k.png",
  "/textures/normal_lola_2k.png",
];

// Precarga en segundo plano para evitar tirones al entrar a la vista de detalle
useLoader.preload(THREE.TextureLoader, LUNAR_SURFACE_TEXTURES);

export const LunarSurface: React.FC<LunarSurfaceProps> = ({
  size = 86,
  displacementScale = 13,
  displacementBias = -2.5,
  normalScale = 1.8,
  roughness = 0.94,
  metalness = 0.02,
  wireframe = false,
  position = [0, -14, 0],
  rotation = [0, Math.PI / 4, 0],
  segments = 256,
  showDioramaBase = true,
  onLoaded,
}) => {
  // Carga paralela de las 3 texturas procesadas por GDAL desde /textures/
  const [colorMap, displacementMap, normalMap] = useLoader(
    THREE.TextureLoader,
    LUNAR_SURFACE_TEXTURES
  );

  useEffect(() => {
    if (colorMap && displacementMap && normalMap) {
      onLoaded?.();
    }
  }, [colorMap, displacementMap, normalMap, onLoaded]);

  // Optimización de configuración de texturas para Three.js
  useMemo(() => {
    colorMap.colorSpace = THREE.SRGBColorSpace;
    colorMap.wrapS = THREE.ClampToEdgeWrapping;
    colorMap.wrapT = THREE.ClampToEdgeWrapping;

    displacementMap.wrapS = THREE.ClampToEdgeWrapping;
    displacementMap.wrapT = THREE.ClampToEdgeWrapping;

    normalMap.wrapS = THREE.ClampToEdgeWrapping;
    normalMap.wrapT = THREE.ClampToEdgeWrapping;
  }, [colorMap, displacementMap, normalMap]);

  const normalScaleVector = useMemo(
    () => new THREE.Vector2(normalScale, normalScale),
    [normalScale]
  );

  // Memoizado para que Three.js compile el shader una única vez y no en cada cambio de luz
  const handleBeforeCompile = useCallback((shader: THREE.WebGLProgramParametersWithUniforms) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      `
      #include <map_fragment>
      #ifdef USE_MAP
        float luma = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
        diffuseColor.rgb = mix(vec3(luma), diffuseColor.rgb, 0.15);
        diffuseColor.rgb = smoothstep(0.03, 0.95, diffuseColor.rgb);
        diffuseColor.rgb = diffuseColor.rgb * 0.88 + vec3(0.06);
      #endif
      `
    );
  }, []);

  return (
    <group position={position} rotation={rotation}>
      {/* Superficie topográfica desplazada por LOLA DEM */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[size, size, segments, segments]} />
        <meshStandardMaterial
          map={colorMap}
          displacementMap={displacementMap}
          displacementScale={displacementScale}
          displacementBias={displacementBias}
          normalMap={normalMap}
          normalScale={normalScaleVector}
          roughness={roughness}
          metalness={metalness}
          wireframe={wireframe}
          onBeforeCompile={handleBeforeCompile}
        />
      </mesh>

      {/* Base sólida tipo diorama para dar volumen al corte topográfico */}
      {showDioramaBase && (
        <mesh position={[0, -5.2, 0]}>
          <boxGeometry args={[size * 0.995, 7.5, size * 0.995]} />
          <meshStandardMaterial
            color="#232227"
            roughness={0.95}
            metalness={0.05}
          />
        </mesh>
      )}

      {/* Balizas tácticas con líneas verticales punteadas (como en la referencia de diseño) */}
      {showDioramaBase && (
        <>
          {/* Marcador Cresta Principal (Izquierda-Superior del bloque) */}
          <group position={[-12, 6.2, -4]}>
            <mesh>
              <sphereGeometry args={[1.05, 16, 16]} />
              <meshBasicMaterial color="#FFFFFF" />
            </mesh>
            <mesh>
              <sphereGeometry args={[1.8, 16, 16]} />
              <meshBasicMaterial color="#FFFFFF" transparent opacity={0.28} />
            </mesh>
            <Line
              points={[
                [0, 0, 0],
                [0, 26, 0],
              ]}
              color="#FAFAFA"
              lineWidth={1}
              dashed
              dashSize={0.9}
              gapSize={0.9}
              transparent
              opacity={0.65}
            />
          </group>

          {/* Marcador Zona Secundaria (Derecha-Inferior del bloque) */}
          <group position={[14, 3.8, 12]}>
            <mesh>
              <sphereGeometry args={[1.05, 16, 16]} />
              <meshBasicMaterial color="#FFFFFF" />
            </mesh>
            <mesh>
              <sphereGeometry args={[1.8, 16, 16]} />
              <meshBasicMaterial color="#FFFFFF" transparent opacity={0.28} />
            </mesh>
            <Line
              points={[
                [0, 0, 0],
                [0, 38, 0],
              ]}
              color="#FAFAFA"
              lineWidth={1}
              dashed
              dashSize={0.9}
              gapSize={0.9}
              transparent
              opacity={0.65}
            />
          </group>
        </>
      )}
    </group>
  );
};

export default LunarSurface;
