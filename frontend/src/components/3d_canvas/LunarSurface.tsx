"use client";

import React, { useMemo } from "react";
import { useLoader } from "@react-three/fiber";
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
   * @default 0.9
   */
  roughness?: number;
  /**
   * Metalicidad del suelo lunar.
   * @default 0.05
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
   * Rotación en radianes (por defecto horizontal en el plano XZ).
   * @default [-Math.PI / 2, 0, 0]
   */
  rotation?: [number, number, number];
  /**
   * Subdivisión de vértices para la geometría plana.
   * @default 512
   */
  segments?: number;
}

/**
 * Componente LunarSurface (Vista Local / Polo Sur Lunar)
 * ----------------------------------------------------
 * Renderiza la superficie lunar utilizando texturas de alta resolución
 * generadas con GDAL a partir de datos científicos de la NASA:
 * - Color / Skin: Mosaico LROC WAC (WEBP calidad 80).
 * - Displacement Map: Elevación LOLA DEM normalizada (PNG 8-bit sin pérdida).
 * - Normal Map: Micro-relieve y sombras rasantes extraídas con gdaldem.
 */
export const LunarSurface: React.FC<LunarSurfaceProps> = ({
  size = 100,
  displacementScale = 12,
  displacementBias = -3,
  normalScale = 1.5,
  roughness = 0.9,
  metalness = 0.05,
  wireframe = false,
  position = [0, 0, 0],
  rotation = [-Math.PI / 2, 0, 0],
  segments = 512,
}) => {
  // Carga paralela de las 3 texturas procesadas por GDAL desde /textures/
  const [colorMap, displacementMap, normalMap] = useLoader(
    THREE.TextureLoader,
    [
      "/textures/skin_wac_2k.webp",
      "/textures/displacement_lola_2k.png",
      "/textures/normal_lola_2k.png",
    ]
  );

  // Optimización de configuración de texturas para Three.js
  useMemo(() => {
    // Espacio de color sRGB para la textura visual
    colorMap.colorSpace = THREE.SRGBColorSpace;
    colorMap.wrapS = THREE.ClampToEdgeWrapping;
    colorMap.wrapT = THREE.ClampToEdgeWrapping;

    // Filtros lineales para el displacement map
    displacementMap.wrapS = THREE.ClampToEdgeWrapping;
    displacementMap.wrapT = THREE.ClampToEdgeWrapping;

    // Espacio lineal para el normal map
    normalMap.wrapS = THREE.ClampToEdgeWrapping;
    normalMap.wrapT = THREE.ClampToEdgeWrapping;
  }, [colorMap, displacementMap, normalMap]);

  const normalScaleVector = useMemo(
    () => new THREE.Vector2(normalScale, normalScale),
    [normalScale]
  );

  return (
    <mesh
      position={position}
      rotation={rotation}
      castShadow
      receiveShadow
    >
      {/* Geometría plana densamente subdividida (ej. 512x512) para deformación de vértices */}
      <planeGeometry args={[size, size, segments, segments]} />

      {/* Material reactivo a luces direccionales dinámicas (simulación de amanecer/atardecer polar) */}
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
      />
    </mesh>
  );
};

export default LunarSurface;
