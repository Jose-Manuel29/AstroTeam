"use client";

import React, { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { MoonGlobe } from "../components/3d_canvas/MoonGlobe";

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
      className="relative min-h-screen w-full flex flex-col justify-between bg-[#05070B] bg-cover bg-center bg-no-repeat text-slate-100 overflow-hidden px-6 py-8 md:px-16 md:py-10"
      style={{ backgroundImage: "url('/images/bg_start_.webp')" }}
    >
      {/* Viñeta sutil para oscurecer bordes y destacar el horizonte lunar */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_95%,rgba(56,189,248,0.12),rgba(5,7,11,0.65)_70%)] pointer-events-none z-0" />

      {/* Escena 3D de la Luna en el horizonte inferior */}
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
          {/* Luz ambiental mínima para sombras profundas como en el espacio */}
          <ambientLight intensity={0.03} />

          {/* Luz principal cenital/frontal iluminando la cresta superior de la Luna */}
          <directionalLight
            position={[0, 6.5, 1.5]}
            intensity={2.8}
            color="#f8fafc"
          />

          {/* Contraluz sutil en el limbo superior para definir el arco del horizonte */}
          <directionalLight
            position={[0, 5.5, -2.5]}
            intensity={1.5}
            color="#7dd3fc"
          />

          <Suspense fallback={null}>
            <MoonGlobe
              position={[0, -2.53, 0]}
              rotation={[0.35, 0, 0.04]}
              scale={1.85}
              autoRotate={true}
              rotationSpeed={0.025}
              showHorizonGlow={true}
            />
          </Suspense>
        </Canvas>
      </div>

      {/* Cabecera / Identidad */}
      <header className="relative z-10 flex items-center justify-between w-full border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-[#FF9F1C] rotate-45" />
          <h2 className="font-display text-sm md:text-base tracking-widest text-[#FBFBFB] lowercase">
            astRo teaM
          </h2>
        </div>
        <span className="font-mono text-xs px-3 py-1 rounded border border-white/10 bg-black/40 backdrop-blur-sm text-slate-300">
          nasa space apps 2026
        </span>
      </header>

      {/* Hero Section posicionado en la mitad superior despejada sobre el horizonte lunar */}
      <section className="relative z-10 w-full max-w-5xl mx-auto text-center mt-10 md:mt-16 mb-auto px-4">
        <h1 className="font-display text-5xl sm:text-7xl md:text-8xl font-normal leading-none tracking-tight text-[#FBFBFB] mb-8 drop-shadow-[0_4px_30px_rgba(0,0,0,0.95)]">
          astRo teaM
        </h1>
        <p className="font-sans text-base md:text-lg text-slate-300 max-w-4xl mx-auto leading-relaxed mb-24 md:mb-36 px-4">
          We precompute solar and terrestrial ephemerides to simulate polar regolith grazing shadows and Direct-to-Earth (DTE) communication windows with sub-degree accuracy.
        </p>

        <div className="flex items-center justify-center pt-8 md:pt-12">
          <button
            onClick={onEnterExplorer}
            className="px-8 py-4 bg-[#FF9F1C] hover:bg-[#ffaa33] text-[#0F1108] font-heading font-bold text-sm md:text-base uppercase tracking-wider rounded-lg transition-all duration-200 shadow-[0_0_25px_rgba(255,159,28,0.4)] flex items-center gap-3"
          >
            <span>Launch 3D Explorer</span>
            <span aria-hidden="true">&rarr;</span>
          </button>
        </div>
      </section>
    </main>
  );
};
