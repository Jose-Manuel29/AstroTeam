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
  /** Posición de destino de la cámara cuando no hay sitio seleccionado (overview general). */
  overviewCamera?: [number, number, number];
  overviewTarget?: [number, number, number];
  /** Rotación aplicada al terreno para transformar el target a coordenadas mundiales. */
  terrainRotation?: [number, number, number];
  /** Posición (offset) aplicada al grupo del terreno. */
  terrainPosition?: [number, number, number];
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
  overviewCamera = [0, 52, 95],
  overviewTarget = [0, -10, 0],
  terrainRotation,
  terrainPosition,
}) => {
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const heightAt = useTerrainHeight();
  const flying = useRef(false);

  const goal = useMemo(() => {
    if (!site) {
      if (flightId > 0) {
        return {
          target: new THREE.Vector3(...overviewTarget),
          camera: new THREE.Vector3(...overviewCamera),
        };
      }
      return null;
    }
    const p = latLonToPlane(site.lat, site.lon);
    if (!p.inside) return null;
    const target = new THREE.Vector3(p.x, heightAt(p.u, p.v), p.z);
    if (terrainRotation) {
      target.applyEuler(new THREE.Euler(...terrainRotation));
    }
    if (terrainPosition) {
      target.add(new THREE.Vector3(...terrainPosition));
    }
    return { target, camera: target.clone().add(new THREE.Vector3(...offset)) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    site,
    flightId,
    heightAt,
    offset[0],
    offset[1],
    offset[2],
    overviewCamera[0],
    overviewCamera[1],
    overviewCamera[2],
    overviewTarget[0],
    overviewTarget[1],
    overviewTarget[2],
    terrainRotation?.[0],
    terrainRotation?.[1],
    terrainRotation?.[2],
    terrainPosition?.[0],
    terrainPosition?.[1],
    terrainPosition?.[2],
  ]);

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
