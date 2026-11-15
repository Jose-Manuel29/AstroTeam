"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { PresetSite } from "@/lib/context/SiteContext";
import { latLonToPlane } from "@/lib/geo/polarStereo";
import { useTerrainHeight } from "@/lib/geo/useTerrainHeight";

export interface FlyToControllerProps {
  site: PresetSite | null;
  /** Cambia en cada clic para re-disparar el vuelo aunque el sitio sea el mismo. */
  flightId: number;
  /** Posición de la cámara relativa al sitio. */
  offset?: [number, number, number];
  /** Factor de interpolación por frame (normalizado a 60 fps). */
  lerpFactor?: number;
}

/**
 * Interpola OrbitControls.target y camera.position hacia el sitio seleccionado.
 * Requiere <OrbitControls makeDefault />. Al llegar libera la cámara al usuario.
 */
export const FlyToController: React.FC<FlyToControllerProps> = ({
  site,
  flightId,
  offset = [6, 8, 10],
  lerpFactor = 0.06,
}) => {
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const heightAt = useTerrainHeight();
  const flying = useRef(false);

  const goal = useMemo(() => {
    if (!site) {
      if (flightId > 0) {
        return {
          target: new THREE.Vector3(0, 0, 0),
          camera: new THREE.Vector3(0, 50, 100),
        };
      }
      return null;
    }
    const p = latLonToPlane(site.lat, site.lon);
    if (!p.inside) return null;
    const target = new THREE.Vector3(p.x, heightAt(p.u, p.v), p.z);
    return { target, camera: target.clone().add(new THREE.Vector3(...offset)) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site, flightId, heightAt, offset[0], offset[1], offset[2]]);

  useEffect(() => {
    flying.current = goal !== null;
  }, [goal, flightId]);

  // Si el usuario arrastra durante el vuelo, se cancela la animación.
  useEffect(() => {
    if (!controls) return;
    const cancel = () => (flying.current = false);
    controls.addEventListener("start", cancel);
    return () => controls.removeEventListener("start", cancel);
  }, [controls]);

  useFrame((state, delta) => {
    if (!flying.current || !goal || !controls) return;
    const a = 1 - Math.pow(1 - lerpFactor, delta * 60);
    controls.target.lerp(goal.target, a);
    state.camera.position.lerp(goal.camera, a);
    controls.update();

    if (
      state.camera.position.distanceToSquared(goal.camera) < 1e-3 &&
      controls.target.distanceToSquared(goal.target) < 1e-3
    ) {
      flying.current = false;
    }
  });

  return null;
};

export default FlyToController;
