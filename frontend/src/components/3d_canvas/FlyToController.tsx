"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { PresetSite } from "@/lib/context/SiteContext";
import { latLonToPlane, TERRAIN } from "@/lib/geo/polarStereo";
import { useTerrainHeight } from "@/lib/geo/useTerrainHeight";

export interface FlyToControllerProps {
  site: PresetSite | null;
  /** Cambia en cada clic para re-disparar el vuelo aunque el sitio sea el mismo. */
  flightId: number;
  /** Posición de la cámara relativa al sitio. */
  offset?: [number, number, number];
  /** Factor de interpolación por frame (normalizado a 60 fps). */
  lerpFactor?: number;
  /** Posición de destino de la cámara cuando no hay sitio seleccionado (overview general elevado y alejado). */
  overviewCamera?: [number, number, number];
  overviewTarget?: [number, number, number];
  /** Rotación aplicada al terreno para transformar el target a coordenadas mundiales. */
  terrainRotation?: [number, number, number];
  /** Posición (offset) aplicada al grupo del terreno. */
  terrainPosition?: [number, number, number];
  /** Offset vertical o tridimensional aplicado al punto de enfoque (target) para encuadre táctico. */
  targetOffset?: [number, number, number];
  /** Tamaño del plano del terreno (por defecto TERRAIN.size = 100). */
  terrainSize?: number;
}

interface ActiveAnimation {
  startTime: number;
  duration: number;
  startPos: THREE.Vector3;
  startTarget: THREE.Vector3;
  endPos: THREE.Vector3;
  endTarget: THREE.Vector3;
}

/**
 * Interpola suavemente OrbitControls.target y camera.position hacia el sitio seleccionado o hacia la vista general.
 * Utiliza una curva cúbica easeInOutCubic para lograr una aceleración y frenado cinematográfico.
 * Requiere <OrbitControls makeDefault />. Si el usuario interactúa, libera el control inmediatamente.
 */
export const FlyToController: React.FC<FlyToControllerProps> = ({
  site,
  flightId,
  offset = [6, 8, 10],
  overviewCamera = [42, 23, 92],
  overviewTarget = [0, -7, 0],
  terrainRotation,
  terrainPosition,
  targetOffset,
  terrainSize,
}) => {
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const heightAt = useTerrainHeight();
  const flying = useRef(false);
  const animRef = useRef<ActiveAnimation | null>(null);

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
    const p = latLonToPlane(site.lat, site.lon, terrainSize ?? TERRAIN.size);
    if (!p.inside) return null;
    const target = new THREE.Vector3(p.x, heightAt(p.u, p.v), p.z);
    if (terrainRotation) {
      target.applyEuler(new THREE.Euler(...terrainRotation));
    }
    if (terrainPosition) {
      target.add(new THREE.Vector3(...terrainPosition));
    }
    if (targetOffset) {
      target.add(new THREE.Vector3(...targetOffset));
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
    targetOffset?.[0],
    targetOffset?.[1],
    targetOffset?.[2],
    terrainSize,
  ]);

  useEffect(() => {
    if (!goal) return;
    flying.current = true;
    animRef.current = null; // Se inicializa en el primer frame con las coordenadas reales del momento
  }, [goal, flightId]);

  // Si el usuario arrastra durante el vuelo, se cancela la animación y toma control inmediato
  useEffect(() => {
    if (!controls) return;
    const cancel = () => {
      flying.current = false;
      animRef.current = null;
    };
    controls.addEventListener("start", cancel);
    return () => controls.removeEventListener("start", cancel);
  }, [controls]);

  useFrame((state) => {
    if (!flying.current || !goal || !controls) return;

    if (!animRef.current) {
      const startPos = state.camera.position.clone();
      const startTarget = controls.target.clone();
      const dist = startPos.distanceTo(goal.camera);
      // Duración calculada dinámicamente según la distancia (mínimo 1000ms, máximo 1300ms)
      const duration = Math.min(1300, Math.max(1000, dist * 14));

      animRef.current = {
        startTime: performance.now(),
        duration,
        startPos,
        startTarget,
        endPos: goal.camera.clone(),
        endTarget: goal.target.clone(),
      };
    }

    const anim = animRef.current;
    const elapsed = performance.now() - anim.startTime;
    const rawT = Math.min(1, Math.max(0, elapsed / anim.duration));

    // Curva cúbica suave (easeInOutCubic)
    const t =
      rawT < 0.5
        ? 4 * rawT * rawT * rawT
        : 1 - Math.pow(-2 * rawT + 2, 3) / 2;

    state.camera.position.lerpVectors(anim.startPos, anim.endPos, t);
    controls.target.lerpVectors(anim.startTarget, anim.endTarget, t);
    controls.update();

    if (rawT >= 1) {
      flying.current = false;
      animRef.current = null;
    }
  });

  return null;
};

export default FlyToController;
