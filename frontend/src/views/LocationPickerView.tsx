"use client";

import React, { useState, useMemo, useRef, useEffect, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import { MoonGlobe } from "../components/3d_canvas/MoonGlobe";
import { LandingSite } from "../types";
import { FigmaDiamondShadow } from "../components/ui/FigmaDiamondShadow";
import { FigmaLandingButton } from "../components/ui/FigmaLandingButton";
import {
  CriteriaSlidersCard,
  CriterionSliderItem,
  MapLegendCard,
  CandidateSitesListCard,
  type EvaluatedLandingSite,
} from "../components/hud";

export type ExplorerPhase = "landing" | "transitioning" | "picker" | "detail";

export interface LocationPickerViewProps {
  sites: LandingSite[];
  selectedSiteId: string;
  initialPhase?: ExplorerPhase;
  isDetailActive?: boolean;
  onSelectSiteDetail?: (siteId: string) => void;
  onDetailMoonArrived?: () => void;
  onBackToPicker?: () => void;
}

interface SceneDirectorProps {
  phase: ExplorerPhase;
  hourOfDay: number;
  sites: EvaluatedLandingSite[];
  selectedSiteId: string | null;
  onSelectSite: (site: LandingSite) => void;
  onDetailMoonArrived?: () => void;
  onBackToPicker?: () => void;
}

const NATIVE_MOON_RADIUS = 1.27186;

// Estado del Home (perspectiva, escala y ángulo de cámara alineados con la referencia de Figma)
const HOME_CAM_Z = 5.5;
const HOME_CAM_FOV = 35;
const HOME_MOON_Y = -2.96;
const HOME_MOON_SCALE = 1.92;
const HOME_MOON_ROTX = 0.28;
const HOME_MOON_ROTZ = 0.0;

// Estado del Picker: Polo Sur inclinado ~20° hacia el frente (216° / 3.77 rad) y Luna ubicada ligeramente más baja
const PICKER_CAM_Z = 5.45;
const PICKER_CAM_FOV = 38;
const PICKER_MOON_Y = -2.72;
const PICKER_MOON_SCALE = 2.45;
const PICKER_MOON_ROTX = 3.77; // ~216°: Polo Sur con inclinación frontal de 36° hacia el observador
const PICKER_MOON_ROTZ = 0.0;

// Estado en Detail (esquina inferior derecha con inclinación estética de -34° en Z)
const DETAIL_TILT_ROTX = 3.32;
const DETAIL_TILT_ROTZ = -0.60;
const DETAIL_SHRINK_DURATION = 1.85;
const DETAIL_AXIS_DURATION = 0.65;

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Obtiene las dimensiones y coordenadas de pantalla del slot reservado en la UI.
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

const SceneDirector: React.FC<SceneDirectorProps> = ({
  phase,
  hourOfDay,
  sites,
  selectedSiteId,
  onSelectSite,
  onDetailMoonArrived,
  onBackToPicker,
}) => {
  const { camera, gl, viewport, size } = useThree();
  const moonGroupRef = useRef<THREE.Group>(null);
  const turntableRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.DirectionalLight>(null);
  const rimLightRef = useRef<THREE.DirectionalLight>(null);

  const isLanding = phase === "landing";
  const isDetail = phase === "detail";
  const isDragging = useRef(false);
  const prevX = useRef(0);
  // Ángulo inicial para que el pin seleccionado (Shackleton) quede en el cuadrante superior-izquierdo como en la referencia
  const targetRotationY = useRef(-0.45);

  // Controladores para el trayecto continuo Picker -> Esquina Inferior Derecha (Detail) sin desmontar jamás el modelo
  const detailElapsedRef = useRef(0);
  const detailStartPosRef = useRef({ x: 0, y: PICKER_MOON_Y, scale: PICKER_MOON_SCALE, rotX: PICKER_MOON_ROTX, rotZ: PICKER_MOON_ROTZ });
  const detailArrivedNotifiedRef = useRef(false);
  const [axisProgress, setAxisProgress] = useState(0);

  useEffect(() => {
    if (phase === "detail") {
      detailElapsedRef.current = 0;
      detailArrivedNotifiedRef.current = false;
      setAxisProgress(0);
      if (moonGroupRef.current) {
        detailStartPosRef.current = {
          x: moonGroupRef.current.position.x,
          y: moonGroupRef.current.position.y,
          scale: moonGroupRef.current.scale.x,
          rotX: moonGroupRef.current.rotation.x,
          rotZ: moonGroupRef.current.rotation.z,
        };
      }
    } else {
      detailElapsedRef.current = 0;
      detailArrivedNotifiedRef.current = false;
      setAxisProgress(0);
    }
  }, [phase]);

  // Escucha eventos de arrastre horizontal en el canvas exclusivamente durante la fase "picker"
  useEffect(() => {
    if (phase !== "picker") return;

    const dom = gl.domElement;

    const handlePointerDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      isDragging.current = true;
      prevX.current = e.clientX;
      dom.style.cursor = "grabbing";
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isDragging.current) return;
      const deltaX = e.clientX - prevX.current;
      prevX.current = e.clientX;

      // Velocidad moderada y controlada (~0.0022 rad por pixel), giro natural invertido acorde al arrastre
      targetRotationY.current -= deltaX * 0.0022;
    };

    const handlePointerUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        dom.style.cursor = "grab";
      }
    };

    dom.style.cursor = "grab";
    dom.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      dom.style.cursor = "auto";
      dom.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [phase, gl]);

  useFrame((_, delta) => {
    const safeDelta = Math.min(delta, 0.05);

    // 1. Interpolación suave de cámara: posición fija en X e Y (sin movimiento ni órbita de cámara)
    const targetCamZ = isLanding ? HOME_CAM_Z : PICKER_CAM_Z;
    const targetFov = isLanding ? HOME_CAM_FOV : PICKER_CAM_FOV;
    const camDampSpeed = isLanding ? 1.4 : 2.5;

    camera.position.x = 0.0;
    camera.position.y = 0.0;
    camera.position.z = THREE.MathUtils.damp(
      camera.position.z,
      targetCamZ,
      camDampSpeed,
      safeDelta
    );
    camera.lookAt(0, 0, 0);

    if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
      const perspCam = camera as THREE.PerspectiveCamera;
      if (Math.abs(perspCam.fov - targetFov) > 0.01) {
        perspCam.fov = THREE.MathUtils.damp(perspCam.fov, targetFov, camDampSpeed, safeDelta);
        perspCam.updateProjectionMatrix();
      }
    }

    // 2. Interpolación continua de la MISMA Luna entre Home, Picker y Detail (esquina inferior derecha)
    if (moonGroupRef.current) {
      if (isDetail) {
        detailElapsedRef.current += safeDelta;

        // Destino base por defecto (fallback en caso de que aún no monte la UI)
        let targetX = viewport.width / 2 - viewport.width * 0.135;
        let targetY = -viewport.height / 2 + viewport.height * 0.165;
        let targetScale = (viewport.height * 0.205) / (2 * NATIVE_MOON_RADIUS);

        // Si existe el slot reservado en la UI (card falsa en SiteDetailView),
        // calculamos la posición y escala exactas para que quede alineada con las cards superiores
        const slotEl =
          typeof document !== "undefined"
            ? (document.getElementById("mini-moon-target") ||
               document.getElementById("mini-moon-card-slot"))
            : null;

        if (slotEl && size.width > 0 && size.height > 0) {
          const resting = getElementRestingRect(slotEl);
          if (resting.width > 0 && resting.height > 0) {
            // Diámetro completo de la esfera dentro del contenedor
            const boxDiameterPx = Math.min(resting.width, resting.height);
            const worldDiameter = (boxDiameterPx / size.height) * viewport.height;
            const worldRadius = worldDiameter / 2;
            targetScale = worldRadius / NATIVE_MOON_RADIUS;

            // Borde derecho e inferior del contenedor interno (donde empieza el texto de las cards tras el padding)
            const rightEdgePx = resting.left + resting.width;
            const bottomEdgePx = resting.top + resting.height;

            const rightNdcX = (rightEdgePx / size.width) * 2 - 1;
            const bottomNdcY = -(bottomEdgePx / size.height) * 2 + 1;

            const rightEdgeWorldX = (rightNdcX * viewport.width) / 2;
            const bottomEdgeWorldY = (bottomNdcY * viewport.height) / 2;

            const camZ = Math.max(0.1, camera.position.z);

            // Anclaje exacto en perspectiva a la esquina inferior-derecha del contenedor
            // para que el borde derecho de la Luna 3D empiece exactamente en la misma línea que el texto de las cards
            targetX =
              rightEdgeWorldX -
              worldRadius * Math.sqrt(1 + (rightEdgeWorldX / camZ) ** 2);
            targetY =
              bottomEdgeWorldY +
              worldRadius * Math.sqrt(1 + (bottomEdgeWorldY / camZ) ** 2);
          }
        }

        const rawT = Math.min(1, detailElapsedRef.current / DETAIL_SHRINK_DURATION);
        const smoothT = easeInOutCubic(rawT);
        const smoothY = easeOutCubic(rawT);

        const start = detailStartPosRef.current;

        moonGroupRef.current.position.x = THREE.MathUtils.lerp(start.x, targetX, smoothT);
        moonGroupRef.current.position.y = THREE.MathUtils.lerp(start.y, targetY, smoothY);

        const currentScale = THREE.MathUtils.lerp(start.scale, targetScale, smoothT);
        moonGroupRef.current.scale.set(currentScale, currentScale, currentScale);

        moonGroupRef.current.rotation.x = THREE.MathUtils.lerp(
          start.rotX,
          DETAIL_TILT_ROTX,
          smoothT
        );
        moonGroupRef.current.rotation.z = THREE.MathUtils.lerp(
          start.rotZ,
          DETAIL_TILT_ROTZ,
          smoothT
        );

        if (rawT >= 1) {
          moonGroupRef.current.position.x = targetX;
          moonGroupRef.current.position.y = targetY;
          moonGroupRef.current.scale.set(targetScale, targetScale, targetScale);

          if (!detailArrivedNotifiedRef.current) {
            detailArrivedNotifiedRef.current = true;
            onDetailMoonArrived?.();
          }

          const timeAfterArrival = detailElapsedRef.current - DETAIL_SHRINK_DURATION;
          const nextAxisProg = easeOutCubic(
            Math.min(1, Math.max(0, timeAfterArrival / DETAIL_AXIS_DURATION))
          );
          if (
            Math.abs(nextAxisProg - axisProgress) > 0.01 ||
            (nextAxisProg === 1 && axisProgress < 1)
          ) {
            setAxisProgress(nextAxisProg);
          }
        }
      } else {
        const targetPosX = 0.0;
        const targetPosY = isLanding ? HOME_MOON_Y : PICKER_MOON_Y;
        const targetScale = isLanding ? HOME_MOON_SCALE : PICKER_MOON_SCALE;
        const targetRotX = isLanding ? HOME_MOON_ROTX : PICKER_MOON_ROTX;
        const targetRotZ = isLanding ? HOME_MOON_ROTZ : PICKER_MOON_ROTZ;

        const dampSpeed = isLanding ? 1.4 : 2.5;

        moonGroupRef.current.position.x = THREE.MathUtils.damp(
          moonGroupRef.current.position.x,
          targetPosX,
          dampSpeed,
          safeDelta
        );

        moonGroupRef.current.position.y = THREE.MathUtils.damp(
          moonGroupRef.current.position.y,
          targetPosY,
          dampSpeed,
          safeDelta
        );

        const currentScale = THREE.MathUtils.damp(
          moonGroupRef.current.scale.x,
          targetScale,
          dampSpeed,
          safeDelta
        );
        moonGroupRef.current.scale.set(currentScale, currentScale, currentScale);

        moonGroupRef.current.rotation.x = THREE.MathUtils.damp(
          moonGroupRef.current.rotation.x,
          targetRotX,
          isLanding ? 1.4 : 2.2,
          safeDelta
        );

        moonGroupRef.current.rotation.z = THREE.MathUtils.damp(
          moonGroupRef.current.rotation.z,
          targetRotZ,
          isLanding ? 1.4 : 2.2,
          safeDelta
        );
      }
    }

    // 3. Suavizado progresivo de la rotación axial (turntable) con damping para eliminar tirones
    if (turntableRef.current) {
      if (isDetail) {
        turntableRef.current.rotation.y += safeDelta * 0.025;
      } else {
        turntableRef.current.rotation.y = THREE.MathUtils.damp(
          turntableRef.current.rotation.y,
          targetRotationY.current,
          4.5,
          safeDelta
        );
      }
    }

    // 4. Iluminación frontal-superior modulada sutilmente por el slider horario en modo Picker
    if (lightRef.current) {
      const hourOffset = isLanding || isDetail
        ? 0
        : Math.sin(((hourOfDay - 12) / 24) * Math.PI * 2) * 2.2;
      const targetLightX = hourOffset;
      const targetLightY = 4.2;
      const targetLightZ = 4.5;
      const targetIntensity = 2.15;

      lightRef.current.position.x = THREE.MathUtils.damp(
        lightRef.current.position.x,
        targetLightX,
        2.5,
        safeDelta
      );
      lightRef.current.position.y = THREE.MathUtils.damp(
        lightRef.current.position.y,
        targetLightY,
        2.5,
        safeDelta
      );
      lightRef.current.position.z = THREE.MathUtils.damp(
        lightRef.current.position.z,
        targetLightZ,
        2.5,
        safeDelta
      );
      lightRef.current.intensity = THREE.MathUtils.damp(
        lightRef.current.intensity,
        targetIntensity,
        2.5,
        safeDelta
      );
    }

    if (rimLightRef.current) {
      const targetRimY = 5.5;
      const targetRimIntensity = 0.65;
      rimLightRef.current.position.y = THREE.MathUtils.damp(
        rimLightRef.current.position.y,
        targetRimY,
        2.5,
        safeDelta
      );
      rimLightRef.current.intensity = THREE.MathUtils.damp(
        rimLightRef.current.intensity,
        targetRimIntensity,
        2.5,
        safeDelta
      );
    }
  });

  const innerExtent = NATIVE_MOON_RADIUS * 0.98;
  const maxOuterExtent = NATIVE_MOON_RADIUS * 1.42;
  const currentOuterExtent = innerExtent + (maxOuterExtent - innerExtent) * axisProgress;

  return (
    <>
      <ambientLight intensity={0.24} color="#7F7B8C" />
      <directionalLight
        ref={lightRef}
        position={[0.0, 4.2, 4.5]}
        intensity={2.15}
        color="#ffffff"
      />
      <directionalLight
        ref={rimLightRef}
        position={[0, 5.5, -2.0]}
        intensity={0.65}
        color="#D9CEC5"
      />

      {/* La misma instancia de Luna persiste en Home, Picker y Detail sin desmontarse jamás */}
      <group
        ref={moonGroupRef}
        position={[0, HOME_MOON_Y, 0]}
        rotation={[HOME_MOON_ROTX, 0, HOME_MOON_ROTZ]}
        scale={[HOME_MOON_SCALE, HOME_MOON_SCALE, HOME_MOON_SCALE]}
      >
        <group
          ref={turntableRef}
          onClick={(e) => {
            if (isDetail) {
              e.stopPropagation();
              onBackToPicker?.();
            }
          }}
        >
          <MoonGlobe
            scale={1.0}
            sites={sites}
            selectedSiteId={selectedSiteId}
            onSelectSite={onSelectSite}
            autoRotate={isLanding}
            rotationSpeed={0.02}
            showHorizonGlow={phase === "picker" || phase === "transitioning"}
            showSites={phase === "picker"}
          />
        </group>

        {/* Eje Y punteado que se traza cuando la Luna llega a la esquina inferior derecha en Detail */}
        {isDetail && axisProgress > 0.01 && (
          <>
            <Line
              points={[
                [0, innerExtent, 0],
                [0, currentOuterExtent, 0],
              ]}
              color="#D9CEC5"
              lineWidth={1.6}
              dashed
              dashSize={0.08}
              gapSize={0.07}
              transparent
              opacity={axisProgress * 0.95}
            />
            <Line
              points={[
                [0, -innerExtent, 0],
                [0, -currentOuterExtent, 0],
              ]}
              color="#D9CEC5"
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

export const LocationPickerView: React.FC<LocationPickerViewProps> = ({
  sites,
  selectedSiteId: propSelectedSiteId,
  initialPhase = "landing",
  isDetailActive = false,
  onSelectSiteDetail,
  onDetailMoonArrived,
  onBackToPicker,
}) => {
  const [phase, setPhase] = useState<ExplorerPhase>(initialPhase);

  useEffect(() => {
    if (isDetailActive) {
      setPhase("detail");
    } else if (phase === "detail") {
      setPhase("picker");
    }
  }, [isDetailActive, phase]);

  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(
    propSelectedSiteId
  );

  useEffect(() => {
    setSelectedSiteId(propSelectedSiteId);
  }, [propSelectedSiteId]);

  const hourOfDay = 12.0;

  // Los porcentajes son resúmenes del catálogo para el periodo precalculado.
  const [criteriaValues, setCriteriaValues] = useState<Record<string, number>>({
    illumination: 50,
    earthLink: 50,
  });

  const sliderItems: CriterionSliderItem[] = useMemo(
    () => [
      {
        id: "illumination",
        label: "Min. solar visibility ↑",
        value: criteriaValues.illumination,
        min: 0,
        max: 100,
        step: 1,
        unit: "%",
      },
      {
        id: "earthLink",
        label: "Min. Direct-to-Earth (DTE) visibility ↑",
        value: criteriaValues.earthLink,
        min: 0,
        max: 100,
        step: 1,
        unit: "%",
      },
    ],
    [criteriaValues]
  );

  const handleCriterionChange = (id: string, newValue: number) => {
    setCriteriaValues((prev) => ({
      ...prev,
      [id]: newValue,
    }));
  };

  // Clasifica los sitios usando únicamente los porcentajes proporcionados por la API.
  const filteredSites: EvaluatedLandingSite[] = useMemo(() => {
    return sites.map((site) => {
      const meetsIllum = site.illuminationAvgPercent >= criteriaValues.illumination;
      const meetsDte = site.earthVisibilityPercent >= criteriaValues.earthLink;
      const criteriaMetCount = (meetsIllum ? 1 : 0) + (meetsDte ? 1 : 0);

      const viabilityTier: "optimal" | "marginal" | "critical" =
        criteriaMetCount === 2
          ? "optimal"
          : criteriaMetCount === 1
          ? "marginal"
          : "critical";

      const isViable = criteriaMetCount === 2;

      return {
        ...site,
        isViable,
        viabilityTier,
        criteriaMetCount,
      };
    });
  }, [criteriaValues, sites]);

  const handleExploreTerrain = () => {
    setPhase("detail");
    onSelectSiteDetail?.(""); // Enviar a la vista general del mapa (sin sitio específico fijado)
  };

  const handleSelectSiteOnGlobe = (site: LandingSite) => {
    setSelectedSiteId(site.id);
    setPhase("detail");
    onSelectSiteDetail?.(site.id);
  };

  // Manejo de la transición al presionar "Aterrizar"
  const handleLaunchExplorer = () => {
    setPhase("transitioning");
    setTimeout(() => {
      setPhase("picker");
    }, 1250);
  };

  // Regresar a la Landing Page
  const handleBackToLanding = () => {
    setPhase("landing");
  };

  return (
    <div
      className="relative w-full h-screen bg-[#09080C] bg-cover bg-no-repeat overflow-hidden select-none"
      style={{
        backgroundImage: "url('/images/bg_start_.webp')",
        backgroundPosition: "center calc(50% + 2rem)",
      }}
    >
      {/* Halo atmosférico suave detrás de la Luna en la esquina inferior derecha durante la vista de detalle */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute right-[18px] bottom-[8px] z-[14] w-[340px] h-[340px] rounded-full transition-opacity duration-1000 ${
          phase === "detail" ? "opacity-100" : "opacity-0"
        }`}
        style={{
          background:
            "radial-gradient(50% 50% at 50% 50%, rgba(250, 250, 250, 0.14) 0%, rgba(166, 148, 138, 0.05) 48%, rgba(13, 13, 13, 0) 75%)",
        }}
      />

      {/* Canvas 3D Único y Persistente con Animación Continua de Cámara y Luna (Nunca se desmonta) */}
      <div
        className={`absolute inset-0 ${
          phase === "detail"
            ? "z-[15] pointer-events-none [&_*]:!pointer-events-none"
            : "z-0"
        }`}
      >
        <Canvas
          gl={{ alpha: true, antialias: true }}
          camera={{
            position: [0, 0, HOME_CAM_Z],
            fov: HOME_CAM_FOV,
            near: 0.1,
            far: 100,
          }}
        >
          <Suspense fallback={null}>
            <SceneDirector
              phase={phase}
              hourOfDay={hourOfDay}
              sites={filteredSites}
              selectedSiteId={selectedSiteId}
              onSelectSite={handleSelectSiteOnGlobe}
              onDetailMoonArrived={onDetailMoonArrived}
              onBackToPicker={onBackToPicker}
            />
          </Suspense>
        </Canvas>
      </div>

      {/* Definición global del filtro SVG de refracción óptica (Liquid Glass) */}
      <svg
        className="absolute w-0 h-0 overflow-hidden pointer-events-none"
        aria-hidden="true"
      >
        <defs>
          <filter
            id="liquid-glass-refraction"
            x="-20%"
            y="-20%"
            width="140%"
            height="140%"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.025"
              numOctaves="2"
              seed="4"
              result="noise"
            />
            <feGaussianBlur
              in="noise"
              stdDeviation="2.5"
              result="smoothNoise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="smoothNoise"
              scale="14"
              xChannelSelector="R"
              yChannelSelector="G"
              result="refraction"
            />
          </filter>
        </defs>
      </svg>

      {/* Capa "shadow" de Figma duplicada (dos veces sobrepuesta en z-[5]) */}
      <div
        aria-hidden="true"
        className="absolute inset-0 z-[5] pointer-events-none transition-opacity duration-1000"
      >
        <FigmaDiamondShadow opacity={phase === "landing" ? 1 : 0.25} />
        <FigmaDiamondShadow opacity={phase === "landing" ? 1 : 0.25} />
      </div>

      {/* =========================================================================
          1. UI DEL HOME / LANDING (z-10: por encima de la capa shadow, anclada al centro vertical)
         ========================================================================= */}
      <div
        className="absolute inset-0 z-10 pointer-events-none"
        style={{
          transform:
            phase !== "landing" ? "translateY(-140%)" : "translateY(0%)",
          opacity: phase !== "landing" ? 0 : 1,
          transition:
            phase === "landing"
              ? "transform 1.8s cubic-bezier(0.16, 1, 0.3, 1), opacity 1.5s ease-out"
              : "transform 1.2s cubic-bezier(0.55, 0.055, 0.675, 0.19), opacity 0.85s ease-in",
        }}
      >
        {/* Bloque de Título y Descripción: centrado horizontalmente, ancho 85% del modelo 3D y subtítulo acorde */}
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[35vh] flex flex-col items-center pointer-events-auto"
          style={
            {
              "--title-fs": "clamp(2.5rem, 12.5vh, 128px)",
            } as React.CSSProperties
          }
        >
          <h1
            className="font-display font-normal leading-none tracking-normal text-[#FFFFFF] select-text text-center"
            style={{
              fontSize: "var(--title-fs)",
              width: "min(94.11vh, 95vw)",
            }}
          >
            astRo teaM
          </h1>
          <p
            className="font-sans font-normal text-[#FFFFFF] text-center mt-6 sm:mt-8 md:mt-10"
            style={{
              fontSize: "calc(var(--title-fs) * 0.156)",
              lineHeight: "1.2",
              width: "min(83.29vh, 90vw)",
            }}
          >
            We precompute solar and terrestrial ephemerides to simulate polar
            regolith grazing shadows and Direct-to-Earth (DTE) communication
            windows with sub-degree accuracy.
          </p>
        </div>

        {/* Botón CTA "Aterrizar": centrado con offset +3rem */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 mt-[calc(6px+3rem)] pointer-events-auto">
          <FigmaLandingButton onClick={handleLaunchExplorer} />
        </div>
      </div>

      {/* =========================================================================
          2. UI DEL EXPLORADOR / PICKER HUD (Reutilizando los componentes modulares)
         ========================================================================= */}
      <div
        className={`absolute inset-0 z-20 pointer-events-none transition-opacity duration-700 ease-out ${
          phase === "picker" ? "opacity-100" : "opacity-0 invisible"
        }`}
        style={{
          visibility: phase === "picker" ? "visible" : "hidden",
        }}
      >
        {/* Botón superior izquierdo para volver al Inicio con padding y espaciado generoso */}
        <button
          type="button"
          onClick={handleBackToLanding}
          className="absolute left-[clamp(1.5rem,4.4vw,4rem)] top-[clamp(1.2rem,2.5vh,1.75rem)] z-30 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#3B3B40]/45 hover:bg-[#3B3B40]/75 border border-white/20 text-[#D9CEC5] font-sans text-xs backdrop-blur-md transition-all shadow-[0_2px_8px_rgba(0,0,0,0.3)] cursor-pointer pointer-events-auto hover:scale-[1.03] active:scale-[0.98]"
        >
          <span>&larr;</span>
          <span>Home</span>
        </button>

        {/* Card Superior Izquierda: Criterios cumplidos (2 Sliders: Sol + Tierra) con separación suficiente respecto al botón */}
        <aside className="absolute left-[clamp(1.5rem,4.4vw,4rem)] top-[clamp(4.1rem,8.2vh,5.2rem)] z-20 flex flex-col gap-3 pointer-events-none">
          <CriteriaSlidersCard
            title="Fulfilled criteria"
            items={sliderItems}
            onChange={handleCriterionChange}
            className="w-[clamp(270px,23vw,330px)] pointer-events-auto"
          />

          {/* Card de Leyenda de Indicadores (Globo 3D) */}
          <MapLegendCard mode="picker" className="w-[clamp(270px,23vw,330px)] pointer-events-auto" />
        </aside>

        {/* Card Superior Derecha: Listado Clasificado de Sitios Candidatos */}
        <aside className="absolute right-[clamp(1.5rem,4.4vw,4rem)] top-[clamp(4.1rem,8.2vh,5.2rem)] z-20 pointer-events-none">
          <CandidateSitesListCard
            title="Landing Sites"
            sites={filteredSites}
            selectedSiteId={selectedSiteId}
            onSelectSite={(site) => setSelectedSiteId(site.id)}
            className="pointer-events-auto"
          />
        </aside>

        {/* Botón CTA "Explore Terrain" con la estética glassmorphic de las cards moradas (slate) */}
        <aside className="absolute right-[clamp(1.5rem,4.4vw,4rem)] bottom-[clamp(1.5rem,4vh,3rem)] z-30 pointer-events-auto">
          <button
            type="button"
            onClick={handleExploreTerrain}
            className="group inline-flex items-center justify-center gap-3 px-7 py-3 min-w-[190px] rounded-[clamp(12px,1.8vh,18px)] bg-[#7F7B8C]/20 hover:bg-[#7F7B8C]/35 active:bg-[#7F7B8C]/25 border border-white/15 hover:border-white/30 backdrop-blur-md shadow-[0px_4px_4px_rgba(63,60,73,0.85),inset_0px_1px_1px_rgba(255,255,255,0.18)] transition-all duration-200 hover:scale-[1.03] active:scale-[0.98] cursor-pointer select-none focus:outline-none"
            aria-label="Explore Terrain"
          >
            <span className="font-sans font-bold text-[clamp(14px,1.5vh,16px)] text-[#FAFAFA] tracking-wide">
              Explore Terrain
            </span>
            <span
              aria-hidden="true"
              className="text-[#D9CEC5] text-base transition-transform duration-200 group-hover:translate-x-1"
            >
              &rarr;
            </span>
          </button>
        </aside>
      </div>
    </div>
  );
};

export default LocationPickerView;
