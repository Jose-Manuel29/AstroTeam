"use client";

import { useMemo } from "react";
import { useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { TERRAIN } from "./polarStereo";

export const DEM_URL = "/textures/displacement_lola_2k.png";
export const NORMAL_URL = "/textures/normal_lola_tangent_2k.png";

const pixelCache = new WeakMap<object, ImageData>();

function readPixels(image: CanvasImageSource & { width: number; height: number }): ImageData {
  const cached = pixelCache.get(image);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(image, 0, 0);
  const data = ctx.getImageData(0, 0, image.width, image.height);
  pixelCache.set(image, data);
  return data;
}

/**
 * Devuelve una función (u, v) → altura Y en mundo, idéntica a la que aplica el
 * shader de displacement: Y = (R/255) * displacementScale + displacementBias.
 * Se usa para posar marcadores y la cámara exactamente sobre el relieve.
 */
export function useTerrainHeight(
  demUrl: string = DEM_URL,
  displacementScale: number = TERRAIN.displacementScale,
  displacementBias: number = TERRAIN.displacementBias
): (u: number, v: number) => number {
  const dem = useLoader(THREE.TextureLoader, demUrl);

  return useMemo(() => {
    const img = readPixels(dem.image as HTMLImageElement);
    const { width: w, height: h, data } = img;
    const at = (c: number, r: number) => data[(r * w + c) * 4] / 255;

    return (u: number, v: number) => {
      // Réplica exacta del muestreo LinearFilter + ClampToEdge de la GPU:
      // coordenada de texel = uv * N - 0.5 (centros de texel). Con flipY, v = 1 es la fila 0.
      const fx = THREE.MathUtils.clamp(u * w - 0.5, 0, w - 1);
      const fy = THREE.MathUtils.clamp((1 - v) * h - 0.5, 0, h - 1);
      const c0 = Math.floor(fx), r0 = Math.floor(fy);
      const c1 = Math.min(c0 + 1, w - 1), r1 = Math.min(r0 + 1, h - 1);
      const tx = fx - c0, ty = fy - r0;
      const top = at(c0, r0) * (1 - tx) + at(c1, r0) * tx;
      const bot = at(c0, r1) * (1 - tx) + at(c1, r1) * tx;
      return (top * (1 - ty) + bot * ty) * displacementScale + displacementBias;
    };
  }, [dem, displacementScale, displacementBias]);
}
