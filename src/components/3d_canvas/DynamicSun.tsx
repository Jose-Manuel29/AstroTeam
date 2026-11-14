"use client";

import React, { useMemo } from "react";

export interface DynamicSunProps {
  /** Azimut del Sol en grados (0–360). */
  sunAngle: number;
  /** Radio horizontal de la órbita de la luz. */
  radius?: number;
  /** Altura de la luz: rasante (~6° de elevación con los valores por defecto). */
  height?: number;
  intensity?: number;
  /** Semilado del frustum ortográfico de sombras (debe cubrir el terreno). */
  shadowExtent?: number;
}

/**
 * Sol dinámico rasante: orbita el horizonte del Polo Sur a baja elevación.
 * x = r·cos(θ), z = r·sin(θ), y = altura rasante.
 */
export const DynamicSun: React.FC<DynamicSunProps> = ({
  sunAngle,
  radius = 80,
  height = 8,
  intensity = 2,
  shadowExtent = 75,
}) => {
  const position = useMemo<[number, number, number]>(() => {
    const t = (sunAngle * Math.PI) / 180;
    return [radius * Math.cos(t), height, radius * Math.sin(t)];
  }, [sunAngle, radius, height]);

  return (
    <directionalLight
      position={position}
      intensity={intensity}
      castShadow
      shadow-mapSize={[2048, 2048]}
      shadow-camera-left={-shadowExtent}
      shadow-camera-right={shadowExtent}
      shadow-camera-top={shadowExtent}
      shadow-camera-bottom={-shadowExtent}
      shadow-camera-near={1}
      shadow-camera-far={radius + 2 * shadowExtent}
      shadow-bias={-0.0004}
      shadow-normalBias={0.04}
    />
  );
};

export default DynamicSun;
