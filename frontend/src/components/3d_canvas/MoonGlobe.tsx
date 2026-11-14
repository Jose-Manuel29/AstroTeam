"use client";

import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { LandingSite } from "../../types";

// Radio nativo del bounding box de moon.glb ([-1.27186, 1.27186])
const NATIVE_MOON_RADIUS = 1.27186;

export interface MoonGlobeProps {
  modelPath?: string;
  sites?: (LandingSite & { isViable?: boolean })[];
  selectedSiteId?: string | null;
  onSelectSite?: (site: LandingSite) => void;
  scale?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  /** Activa la rotación axial automática muy lenta de la Luna */
  autoRotate?: boolean;
  /** Velocidad de rotación en radianes por segundo (por defecto 0.025 rad/s) */
  rotationSpeed?: number;
  /** Muestra un halo atmosférico/horizonte sutil en el borde superior iluminado */
  showHorizonGlow?: boolean;
  /** Si se muestran los marcadores de los sitios candidatos */
  showSites?: boolean;
}

export const MoonGlobe: React.FC<MoonGlobeProps> = ({
  modelPath = "/models/moon.glb",
  sites = [],
  selectedSiteId,
  onSelectSite,
  scale = 1.85,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  autoRotate = true,
  rotationSpeed = 0.025,
  showHorizonGlow = false,
  showSites = true,
}) => {
  const spinGroupRef = useRef<THREE.Group>(null);
  const markersGroupRef = useRef<THREE.Group>(null);
  const markersScaleRef = useRef(showSites ? 1 : 0);

  // Carga del modelo GLB global (NASA SVS ID 14959)
  const { scene } = useGLTF(modelPath);

  // Clonar la escena para permitir múltiples instancias en distintos Canvas sin conflictos
  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    return clone;
  }, [scene]);

  // Rotación lenta y continua sobre su propio eje Y y transición suave de marcadores
  useFrame((_, delta) => {
    if (autoRotate && spinGroupRef.current) {
      spinGroupRef.current.rotation.y += delta * rotationSpeed;
    }

    // Animación suave de aparición/desaparición de marcadores
    const targetScale = showSites ? 1 : 0;
    markersScaleRef.current = THREE.MathUtils.damp(markersScaleRef.current, targetScale, 5, delta);
    if (markersGroupRef.current) {
      const s = markersScaleRef.current;
      markersGroupRef.current.scale.set(s, s, s);
      markersGroupRef.current.visible = s > 0.005;
    }
  });

  return (
    <group position={position} rotation={rotation} scale={[scale, scale, scale]}>
      {/* Halo sutil de horizonte para acentuar la curvatura contra el fondo estelar */}
      {showHorizonGlow && (
        <mesh scale={[1.012, 1.012, 1.012]}>
          <sphereGeometry args={[NATIVE_MOON_RADIUS, 64, 64]} />
          <meshBasicMaterial
            color="#7dd3fc"
            transparent
            opacity={0.07}
            side={THREE.BackSide}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}

      {/* Grupo interno que gira lentamente sobre su eje */}
      <group ref={spinGroupRef}>
        <primitive object={clonedScene} />

        {/* Marcadores de sitios candidatos sobre el globo */}
        <group ref={markersGroupRef}>
          {sites.map((site) => {
            const phi = (90 - site.coordinates.lat) * (Math.PI / 180);
            const theta = (site.coordinates.lng + 180) * (Math.PI / 180);
            const markerRadius = NATIVE_MOON_RADIUS * 1.012;

            const x = -markerRadius * Math.sin(phi) * Math.cos(theta);
            const y = markerRadius * Math.cos(phi);
            const z = markerRadius * Math.sin(phi) * Math.sin(theta);

            const isSelected = site.id === selectedSiteId;

            // Orientar el marcador perpendicularmente a la superficie lunar
            const normal = new THREE.Vector3(x, y, z).normalize();
            const quaternion = new THREE.Quaternion().setFromUnitVectors(
              new THREE.Vector3(0, 1, 0),
              normal
            );

            return (
              <group key={site.id} position={[x, y, z]} quaternion={quaternion}>
                {/* Poste / baliza vertical */}
                <mesh position={[0, 0.025, 0]}>
                  <cylinderGeometry args={[0.003, 0.003, 0.05, 8]} />
                  <meshBasicMaterial color={isSelected ? "#FF9F1C" : "#38BDF8"} />
                </mesh>

                {/* Cabezal esférico interactivo */}
                <mesh
                  position={[0, 0.055, 0]}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectSite?.(site);
                  }}
                >
                  <sphereGeometry args={[isSelected ? 0.035 : 0.022, 16, 16]} />
                  <meshStandardMaterial
                    color={isSelected ? "#FF9F1C" : "#38BDF8"}
                    emissive={isSelected ? "#FF9F1C" : "#0284C7"}
                    emissiveIntensity={isSelected ? 2.5 : 1.2}
                  />
                </mesh>

                {/* Anillo de pulso / mira sobre la superficie */}
                <mesh rotation={[-Math.PI / 2, 0, 0]}>
                  <ringGeometry args={[0.02, isSelected ? 0.055 : 0.035, 32]} />
                  <meshBasicMaterial
                    color={isSelected ? "#FF9F1C" : "#38BDF8"}
                    side={THREE.DoubleSide}
                    transparent
                    opacity={isSelected ? 0.85 : 0.45}
                  />
                </mesh>
              </group>
            );
          })}
        </group>
      </group>
    </group>
  );
};

// Pre-cargar el modelo para evitar tirones en tiempo de ejecución
useGLTF.preload("/models/moon.glb");
