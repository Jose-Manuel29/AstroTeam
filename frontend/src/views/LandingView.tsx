"use client";

import React, { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { MoonGlobe } from "../components/3d_canvas/MoonGlobe";
import { FigmaDiamondShadow } from "../components/ui/FigmaDiamondShadow";
import { FigmaLandingButton } from "../components/ui/FigmaLandingButton";
import { AstroTeamLogo } from "../components/ui/AstroTeamLogoSvg";

export interface LandingViewProps {
  onEnterExplorer?: () => void;
}

/**
 * Vista 1: Landing Page
 * URL: /
 * Renderiza el fondo estelar (/images/bg_start_.webp) con el modelo 3D de la Luna (moon.glb)
 * encuadrado en el horizonte inferior y girando lentamente sobre su eje.
 */
export const LandingView: React.FC<LandingViewProps> = ({ onEnterExplorer }) => {
  return (
    <main
      className="relative h-screen w-full bg-[#09080C] bg-cover bg-no-repeat text-[#FFFFFF] overflow-hidden select-none"
      style={{
        backgroundImage: "url('/images/bg_start_.webp')",
        backgroundPosition: "center calc(50% + 2rem)",
      }}
    >
      {/* Definición global del filtro SVG de refracción óptica (Liquid Glass) */}
      <svg className="absolute w-0 h-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <defs>
          <filter id="liquid-glass-refraction" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.025"
              numOctaves="2"
              seed="4"
              result="noise"
            />
            <feGaussianBlur in="noise" stdDeviation="2.5" result="smoothNoise" />
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

      {/* Escena 3D de la Luna en el horizonte inferior con la perspectiva de Figma */}
      <div className="absolute inset-0 z-[1] pointer-events-none">
        <Canvas
          gl={{ alpha: true, antialias: true }}
          camera={{
            position: [0, 0, 5.5],
            fov: 35,
            near: 0.1,
            far: 100,
          }}
        >
          <ambientLight intensity={0.012} />

          <directionalLight
            position={[0, 4.8, 1.8]}
            intensity={1.05}
            color="#f8fafc"
          />

          <directionalLight
            position={[0, 5.2, -2.5]}
            intensity={0.12}
            color="#d4d2da"
          />

          <Suspense fallback={null}>
            <MoonGlobe
              position={[0, -2.96, 0]}
              rotation={[0.28, 0, 0]}
              scale={1.92}
              autoRotate={true}
              rotationSpeed={0.02}
              showHorizonGlow={false}
              showSites={false}
            />
          </Suspense>
        </Canvas>
      </div>

      {/* Capa "shadow" de Figma duplicada (dos veces sobrepuesta en z-[5]) */}
      <div
        aria-hidden="true"
        className="absolute inset-0 z-[5] pointer-events-none"
      >
        <FigmaDiamondShadow opacity={1} />
        <FigmaDiamondShadow opacity={1} />
      </div>

      {/* Bloque de Título y Descripción: centrado horizontalmente, ancho 85% del modelo 3D y subtítulo acorde */}
      <section
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[35vh] z-10 flex flex-col items-center pointer-events-auto"
        style={
          {
            "--title-fs": "clamp(2.5rem, 12.5vh, 128px)",
          } as React.CSSProperties
        }
      >
        <div
          className="select-text flex items-center justify-center"
          style={{
            width: "min(94.11vh, 95vw)",
            aspectRatio: "928 / 94",
          }}
        >
          <h1 className="sr-only">astRo teaM</h1>
          <AstroTeamLogo fill="#FFFFFF" className="w-full h-auto block" />
        </div>
        <p
          className="font-sans font-normal text-[#FFFFFF] text-center mt-6 sm:mt-8 md:mt-10"
          style={{
            fontSize: "calc(var(--title-fs) * 0.156)",
            lineHeight: "1.2",
            width: "min(83.29vh, 90vw)",
          }}
        >
          We precompute solar and terrestrial ephemerides to simulate polar regolith grazing shadows and Direct-to-Earth (DTE) communication windows with sub-degree accuracy.
        </p>
      </section>

      {/* Botón CTA "Aterrizar": centrado con offset +3rem */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 mt-[calc(6px+3rem)] z-10 pointer-events-auto">
        <FigmaLandingButton onClick={onEnterExplorer} />
      </div>
    </main>
  );
};
