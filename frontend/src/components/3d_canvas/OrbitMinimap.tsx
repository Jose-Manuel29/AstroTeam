"use client";

import React, { useRef, useMemo, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { LandingSite } from "../../types";

interface MiniGlobeProps {
  site?: LandingSite | null;
}

const MiniGlobeInner: React.FC<MiniGlobeProps> = ({ site }) => {
  const meshRef = useRef<THREE.Group>(null);
  const { scene } = useGLTF("/models/moon.glb");
  const clonedScene = useMemo(() => scene.clone(true), [scene]);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.08;
    }
  });

  return (
    <group ref={meshRef}>
      <primitive object={clonedScene} scale={[1.0, 1.0, 1.0]} />
      {site && (
        <mesh position={[0, -1.29, 0]}>
          <sphereGeometry args={[0.07, 16, 16]} />
          <meshBasicMaterial color="#FFB703" />
        </mesh>
      )}
    </group>
  );
};

export interface OrbitMinimapProps {
  currentSite?: LandingSite | null;
  className?: string;
}

/**
 * Minimapa 3D del modelo global de la Luna utilizado en la vista de detalle
 * para contextualizar la orientación polar y la posición macroscópica.
 */
export const OrbitMinimap: React.FC<OrbitMinimapProps> = ({ currentSite, className = "" }) => {
  return (
    <div
      className={`relative rounded-xl border border-white/10 bg-[#0D121D]/80 backdrop-blur-md overflow-hidden bg-cover bg-center ${className}`}
      style={{ backgroundImage: "url('/images/bg_start_.webp')" }}
    >
      <div className="absolute top-2 left-3 z-10 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-300">
          Global Polar View
        </span>
      </div>

      <div className="w-full h-40">
        <Canvas gl={{ alpha: true }} camera={{ position: [0, -2.8, 1.8], fov: 42 }}>
          <ambientLight intensity={0.15} />
          <directionalLight position={[5, 2, 5]} intensity={1.8} />
          <Suspense fallback={null}>
            <MiniGlobeInner site={currentSite} />
          </Suspense>
          <OrbitControls enableZoom={false} enablePan={false} />
        </Canvas>
      </div>

      {currentSite && (
        <div className="px-3 py-1.5 border-t border-white/5 bg-black/50 text-center">
          <p className="text-[11px] font-mono text-amber-300">
            {currentSite.name} ({currentSite.coordinates.lat}°S)
          </p>
        </div>
      )}
    </div>
  );
};
