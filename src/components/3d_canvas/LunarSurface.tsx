"use client";

import React, { useEffect, useMemo } from "react";
import { useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { TERRAIN } from "@/lib/geo/polarStereo";
import { DEM_URL, NORMAL_URL } from "@/lib/geo/useTerrainHeight";
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
  /** Bloque sólido (pedestal) bajo el relieve, estilo maqueta. */
  showPedestal?: boolean;
  pedestalDepth?: number;
  pedestalColor?: string;
  children?: React.ReactNode;
}

/**
 * Mapa 3D Local: bloque topográfico WAC (albedo) + LOLA DEM (relieve) + normales.
 * Toda la iluminación proviene de las luces de la escena (sin sombras "quemadas").
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
  showPedestal = true,
  pedestalDepth = 4,
  pedestalColor = "#0b0e14",
  children,
}) => {
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

  // El depth material por defecto ignora el displacement: sin esto, las sombras
  // proyectadas serían las de un plano liso y el relieve no se auto-sombrearía.
  const depthMaterial = useMemo(
    () =>
      new THREE.MeshDepthMaterial({
        depthPacking: THREE.RGBADepthPacking,
        displacementMap,
        displacementScale,
        displacementBias,
      }),
    [displacementMap, displacementScale, displacementBias]
  );
  useEffect(() => () => depthMaterial.dispose(), [depthMaterial]);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow castShadow customDepthMaterial={depthMaterial}>
        <planeGeometry args={[size, size, segments, segments]} />
        <meshStandardMaterial
          map={colorMap}
          displacementMap={displacementMap}
          displacementScale={displacementScale}
          displacementBias={displacementBias}
          normalMap={normalMap}
          normalScale={normalScaleVec}
          roughness={roughness}
          metalness={metalness}
          wireframe={wireframe}
        />
      </mesh>
      {showPedestal && (
        <TerrainPedestal
          size={size}
          segments={segments}
          demUrl={demUrl}
          displacementScale={displacementScale}
          displacementBias={displacementBias}
          depth={pedestalDepth}
          color={pedestalColor}
        />
      )}
      {children}
    </group>
  );
};

export default LunarSurface;
