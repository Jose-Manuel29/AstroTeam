"use client";

import React, { useRef, useState, useEffect, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import { MoonGlobe } from "./MoonGlobe";

// Radio nativo del modelo moon.glb
const NATIVE_MOON_RADIUS = 1.27186;

// Estado inicial idéntico al Picker (LocationPickerView) para evitar cualquier salto visual
const PICKER_CAM_Z = 5.45;
const PICKER_CAM_FOV = 38;
const PICKER_MOON_Y = -2.38;
const PICKER_MOON_SCALE = 2.45;
const PICKER_MOON_ROTX = 3.77;
const PICKER_MOON_ROTZ = 0.0;

// Inclinación estética del eje Y en la esquina inferior derecha (~ -34° en Z, y ángulo cercano en X para no dar vuelta)
const CORNER_TILT_ROTX = 3.32;
const CORNER_TILT_ROTZ = -0.60;

// Duración lenta y fluida del encogimiento y traslación (segundos)
const SHRINK_TRANSLATE_DURATION = 1.85;
// Duración del trazado del eje Y punteado al llegar (segundos)
const AXIS_DRAW_DURATION = 0.65;

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Obtiene las dimensiones y coordenadas de pantalla de un elemento en reposo,
 * compensando traslaciones CSS temporales (ej. translateX de entrada del aside HUD).
 */
function getElementRestingRect(element: HTMLElement): {
  left: number;
  top: number;
  width: number;
  height: number;
} {
  const rect = element.getBoundingClientRect();
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

export interface CornerMoonTransitionProps {
  /** Se dispara exactamente cuando la Luna termina de encogerse y llega a su posición en la esquina */
  onArrived?: () => void;
}

interface AnimatedCornerMoonProps {
  onArrived?: () => void;
  onSettledChange?: (settled: boolean) => void;
}

const AnimatedCornerMoon: React.FC<AnimatedCornerMoonProps> = ({
  onArrived,
  onSettledChange,
}) => {
  const { camera, viewport, size } = useThree();
  const moonGroupRef = useRef<THREE.Group>(null);
  const elapsedRef = useRef(0);
  const notifiedArrivedRef = useRef(false);

  // Progreso de dibujado del eje Y punteado (0 a 1), que inicia en cuanto la Luna llega a su posición
  const [axisProgress, setAxisProgress] = useState(0);

  useFrame((_, delta) => {
    // Limitar delta máximo en el primer frame tras el montaje para evitar saltos por carga inicial
    const safeDelta = Math.min(delta, 0.05);
    elapsedRef.current += safeDelta;

    // Coordenadas destino en la esquina inferior derecha (fallback por defecto)
    let targetX = viewport.width / 2 - viewport.width * 0.135;
    let targetY = -viewport.height / 2 + viewport.height * 0.165;
    let targetScale = (viewport.height * 0.205) / (2 * NATIVE_MOON_RADIUS);

    // Slot reservado en la UI (card falsa en SiteDetailView)
    const slotEl =
      typeof document !== "undefined"
        ? (document.getElementById("mini-moon-target") ||
           document.getElementById("mini-moon-card-slot"))
        : null;

    if (slotEl && size.width > 0 && size.height > 0) {
      const resting = getElementRestingRect(slotEl);
      if (resting.width > 0 && resting.height > 0) {
        const boxDiameterPx = Math.min(resting.width, resting.height);
        const worldDiameter = (boxDiameterPx / size.height) * viewport.height;
        const worldRadius = worldDiameter / 2;
        targetScale = worldRadius / NATIVE_MOON_RADIUS;

        const rightEdgePx = resting.left + resting.width;
        const bottomEdgePx = resting.top + resting.height;

        const rightNdcX = (rightEdgePx / size.width) * 2 - 1;
        const bottomNdcY = -(bottomEdgePx / size.height) * 2 + 1;

        const rightEdgeWorldX = (rightNdcX * viewport.width) / 2;
        const bottomEdgeWorldY = (bottomNdcY * viewport.height) / 2;

        const camZ = Math.max(0.1, camera.position.z);

        targetX =
          rightEdgeWorldX -
          worldRadius * Math.sqrt(1 + (rightEdgeWorldX / camZ) ** 2);
        targetY =
          bottomEdgeWorldY +
          worldRadius * Math.sqrt(1 + (bottomEdgeWorldY / camZ) ** 2);
      }
    }

    // Progreso normalizado (0 a 1) del trayecto lento hacia la esquina
    const rawT = Math.min(1, elapsedRef.current / SHRINK_TRANSLATE_DURATION);
    const smoothT = easeInOutCubic(rawT);
    // Y sube con easeOutCubic mientras se encoge para que la Luna se mantenga siempre dentro del viewport
    const smoothY = easeOutCubic(rawT);

    if (moonGroupRef.current) {
      moonGroupRef.current.position.x = THREE.MathUtils.lerp(0, targetX, smoothT);
      moonGroupRef.current.position.y = THREE.MathUtils.lerp(PICKER_MOON_Y, targetY, smoothY);

      const currentScale = THREE.MathUtils.lerp(PICKER_MOON_SCALE, targetScale, smoothT);
      moonGroupRef.current.scale.set(currentScale, currentScale, currentScale);

      moonGroupRef.current.rotation.x = THREE.MathUtils.lerp(
        PICKER_MOON_ROTX,
        CORNER_TILT_ROTX,
        smoothT
      );
      moonGroupRef.current.rotation.z = THREE.MathUtils.lerp(
        PICKER_MOON_ROTZ,
        CORNER_TILT_ROTZ,
        smoothT
      );

      // En cuanto llega a su posición (rawT >= 1): dispara la entrada de la UI y pinta el eje Y al mismo tiempo
      if (rawT >= 1) {
        moonGroupRef.current.position.x = targetX;
        moonGroupRef.current.position.y = targetY;
        moonGroupRef.current.scale.set(targetScale, targetScale, targetScale);

        if (!notifiedArrivedRef.current) {
          notifiedArrivedRef.current = true;
          onSettledChange?.(true);
          onArrived?.();
        }

        const timeAfterArrival = elapsedRef.current - SHRINK_TRANSLATE_DURATION;
        const nextAxisProg = easeOutCubic(
          Math.min(1, Math.max(0, timeAfterArrival / AXIS_DRAW_DURATION))
        );
        if (
          Math.abs(nextAxisProg - axisProgress) > 0.01 ||
          (nextAxisProg === 1 && axisProgress < 1)
        ) {
          setAxisProgress(nextAxisProg);
        }
      }
    }
  });

  // Extensión progresiva del eje Y punteado sobresaliendo por ambos polos de la Luna
  const innerExtent = NATIVE_MOON_RADIUS * 0.98;
  const maxOuterExtent = NATIVE_MOON_RADIUS * 1.42;
  const currentOuterExtent = innerExtent + (maxOuterExtent - innerExtent) * axisProgress;

  return (
    <>
      <ambientLight intensity={0.24} color="#7F7B8C" />
      <directionalLight position={[0.0, 4.2, 4.5]} intensity={2.15} color="#ffffff" />
      <directionalLight position={[0, 5.5, -2.0]} intensity={0.65} color="#D9CEC5" />

      <group
        ref={moonGroupRef}
        position={[0, PICKER_MOON_Y, 0]}
        rotation={[PICKER_MOON_ROTX, 0, PICKER_MOON_ROTZ]}
        scale={[PICKER_MOON_SCALE, PICKER_MOON_SCALE, PICKER_MOON_SCALE]}
      >
        <MoonGlobe
          scale={1.0}
          autoRotate={true}
          rotationSpeed={0.025}
          showHorizonGlow={false}
          showSites={false}
        />

        {/* Eje Y punteado que se pinta al llegar a la esquina al mismo tiempo que entra la UI */}
        {axisProgress > 0.01 && (
          <>
            {/* Segmento Polar Superior (+Y) */}
            <Line
              points={[
                [0, innerExtent, 0],
                [0, currentOuterExtent, 0],
              ]}
              color="#FAFAFA"
              lineWidth={1.6}
              dashed
              dashSize={0.08}
              gapSize={0.07}
              transparent
              opacity={axisProgress * 0.95}
            />
            {/* Segmento Polar Inferior (-Y) */}
            <Line
              points={[
                [0, -innerExtent, 0],
                [0, -currentOuterExtent, 0],
              ]}
              color="#FAFAFA"
              lineWidth={1.6}
              dashed
              dashSize={0.08}
              gapSize={0.07}
              transparent
              opacity={axisProgress * 0.95}
            />
          </>
        )}
      </group>
    </>
  );
};

export const CornerMoonTransition: React.FC<CornerMoonTransitionProps> = ({
  onArrived,
}) => {
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    setSettled(false);
  }, []);

  return (
    <div className="absolute inset-0 z-[15] pointer-events-none overflow-hidden">
      {/* Resplandor atmosférico suave detrás de la pequeña Luna en la esquina inferior derecha */}
      <div
        aria-hidden="true"
        className={`absolute right-[5.5vw] bottom-[3.5vh] w-[260px] h-[260px] rounded-full transition-opacity duration-700 ${
          settled ? "opacity-100" : "opacity-0"
        }`}
        style={{
          background:
            "radial-gradient(50% 50% at 50% 50%, rgba(250, 250, 250, 0.28) 0%, rgba(217, 206, 197, 0.08) 52%, rgba(0, 0, 0, 0) 75%)",
        }}
      />

      <Canvas
        gl={{ alpha: true, antialias: true }}
        camera={{ position: [0, 0, PICKER_CAM_Z], fov: PICKER_CAM_FOV, near: 0.1, far: 100 }}
      >
        <Suspense fallback={null}>
          <AnimatedCornerMoon onArrived={onArrived} onSettledChange={setSettled} />
        </Suspense>
      </Canvas>
    </div>
  );
};

export default CornerMoonTransition;
