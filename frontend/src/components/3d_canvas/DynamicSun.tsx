"use client";

import React, { useMemo } from "react";
import { celestialDirectionToScene } from "@/lib/geo/celestial";

export interface DynamicSunProps {
  /** Azimut del Sol en grados (0–360). */
  sunAngle: number;
  elevationDeg?: number;
  siteLongitudeDeg?: number;
  /** Radio horizontal de la órbita de la luz. */
  radius?: number;
  intensity?: number;
  /** Semilado del frustum ortográfico de sombras (debe cubrir el terreno). */
  shadowExtent?: number;
  visible?: boolean;
}

/**
 * Sol dinámico rasante: orbita el horizonte del Polo Sur a baja elevación
 * proyectando sombras duras sobre el relieve lunar.
 * La dirección local norte/este se transforma al sistema de coordenadas polar del terreno.
 */
export const DynamicSun: React.FC<DynamicSunProps> = ({
  sunAngle,
  elevationDeg = 5.7,
  siteLongitudeDeg = 0,
  radius = 80,
  intensity = 2,
  shadowExtent = 75,
  visible = true,
}) => {
  const position = useMemo<[number, number, number]>(() => {
    return celestialDirectionToScene(sunAngle, elevationDeg, siteLongitudeDeg, radius);
  }, [sunAngle, elevationDeg, siteLongitudeDeg, radius]);

  return (
    <directionalLight
      position={position}
      intensity={intensity}
      visible={visible}
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
