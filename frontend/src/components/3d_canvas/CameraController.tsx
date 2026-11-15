"use client";

import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useSiteContext } from "../../lib/context/SiteContext";
import { getPositionFromLatLon } from "../../lib/context/math";

export interface CameraControllerProps {
  /** Radio de la esfera lunar en unidades de Three.js. */
  sphereRadius?: number;
  /** Distancia extra sobre la superficie para no estrellar la cámara. */
  offset?: number;
  /** Factor de interpolación por frame (normalizado a 60 fps). */
  lerpFactor?: number;
}

const ORIGIN = new THREE.Vector3(0, 0, 0);

export const CameraController: React.FC<CameraControllerProps> = ({
  sphereRadius = 10,
  offset = 5,
  lerpFactor = 0.05,
}) => {
  const { selectedSite } = useSiteContext();
  const arrived = useRef(false);

  // Posición destino: punto del sitio proyectado hacia afuera (radio + offset).
  const target = useMemo(() => {
    arrived.current = false;
    if (!selectedSite) return null;
    return getPositionFromLatLon(selectedSite.lat, selectedSite.lon, sphereRadius + offset);
  }, [selectedSite, sphereRadius, offset]);

  useFrame((state, delta) => {
    if (!target || arrived.current) return;

    // Lerp independiente del framerate.
    const alpha = 1 - Math.pow(1 - lerpFactor, delta * 60);
    state.camera.position.lerp(target, alpha);
    state.camera.lookAt(ORIGIN);

    if (state.camera.position.distanceToSquared(target) < 1e-4) {
      state.camera.position.copy(target);
      state.camera.lookAt(ORIGIN);
      arrived.current = true; // libera la cámara para controles manuales
    }
  });

  return null;
};

export default CameraController;
