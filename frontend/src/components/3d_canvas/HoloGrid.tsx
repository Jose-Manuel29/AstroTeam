"use client";

import React, { useEffect, useMemo } from "react";
import * as THREE from "three";

export interface HoloGridProps {
  size?: number;
  divisions?: number;
  centerColor?: THREE.ColorRepresentation;
  gridColor?: THREE.ColorRepresentation;
  /** Altura de la capa de datos orbitales sobre el mapa. */
  height?: number;
  opacity?: number;
  visible?: boolean;
}

/** Capa de datos flotante: rejilla holográfica muy sutil sobre el terreno. */
export const HoloGrid: React.FC<HoloGridProps> = ({
  size = 100,
  divisions = 50,
  centerColor = "#A6948A",
  gridColor = "#3B3B40",
  height = 25,
  opacity = 0.14,
  visible = true,
}) => {
  const grid = useMemo(
    () => new THREE.GridHelper(size, divisions, centerColor, gridColor),
    [size, divisions, centerColor, gridColor]
  );

  useEffect(() => {
    const mats = Array.isArray(grid.material) ? grid.material : [grid.material];
    mats.forEach((m) => {
      m.transparent = true;
      m.opacity = opacity;
      m.depthWrite = false;
      m.toneMapped = false;
      m.needsUpdate = true;
    });
  }, [grid, opacity]);

  useEffect(
    () => () => {
      grid.geometry.dispose();
      const mats = Array.isArray(grid.material) ? grid.material : [grid.material];
      mats.forEach((m) => m.dispose());
    },
    [grid]
  );

  if (!visible) return null;
  return <primitive object={grid} position={[0, height, 0]} renderOrder={2} />;
};

export default HoloGrid;
