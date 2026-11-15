"use client";

import React, { useRef, useMemo, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, Html, Line } from "@react-three/drei";
import * as THREE from "three";
import { LandingSite } from "../../types";

// Radio nativo del bounding box de moon.glb ([-1.27186, 1.27186])
const NATIVE_MOON_RADIUS = 1.27186;

interface LandingSitePinProps {
  site: LandingSite & { isViable?: boolean; viabilityTier?: "optimal" | "marginal" | "critical" };
  isSelected: boolean;
  onSelectSite?: (site: LandingSite) => void;
  position: [number, number, number];
  quaternion: THREE.Quaternion;
}

/**
 * Marcador radial interactivo para cada sitio de aterrizaje:
 * - Crece en altura en hover/selección
 * - Circunferencia de área con efecto pulsante
 * - Etiqueta HTML visible con el nombre del punto
 */
const LandingSitePin: React.FC<LandingSitePinProps> = ({
  site,
  isSelected,
  onSelectSite,
  position,
  quaternion,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const stemMeshRef = useRef<THREE.Mesh>(null);
  const stemHitboxRef = useRef<THREE.Mesh>(null);
  const tipMeshRef = useRef<THREE.Mesh>(null);
  const discRingRef = useRef<THREE.Mesh>(null);
  const pulseWaveRef = useRef<THREE.Mesh>(null);

  const isViable = site.isViable !== false;
  const heightRef = useRef(isSelected ? 0.34 : 0.16);

  useFrame((state, delta) => {
    // 1. Efecto hover: el picker crece en altura dinámicamente con una animación más suave y pausada (damp speed 4.5)
    const targetHeight = isHovered ? 0.44 : isSelected ? 0.34 : 0.16;
    heightRef.current = THREE.MathUtils.damp(heightRef.current, targetHeight, 4.5, delta);

    if (stemMeshRef.current) {
      stemMeshRef.current.position.y = heightRef.current / 2;
      stemMeshRef.current.scale.y = heightRef.current / 0.16;
    }

    if (stemHitboxRef.current) {
      stemHitboxRef.current.position.y = heightRef.current / 2;
      stemHitboxRef.current.scale.y = heightRef.current / 0.16;
    }

    if (tipMeshRef.current) {
      tipMeshRef.current.position.y = heightRef.current;
    }

    // 2. Efecto hover / selección: pulsa la circunferencia que marca el área (SOLO si es viable/activo)
    const time = state.clock.elapsedTime;
    if (discRingRef.current) {
      if (isViable && isHovered) {
        const pulse = 1 + Math.sin(time * 7) * 0.18;
        discRingRef.current.scale.set(pulse, pulse, 1);
      } else if (isViable && isSelected) {
        const pulse = 1 + Math.sin(time * 3.5) * 0.1;
        discRingRef.current.scale.set(pulse, pulse, 1);
      } else {
        discRingRef.current.scale.set(1, 1, 1);
      }
    }

    // Onda de radar expansiva en la base (SOLO si es viable/activo)
    if (pulseWaveRef.current) {
      if (isViable && (isHovered || isSelected)) {
        const wave = (time * 1.6) % 1;
        const waveScale = 1 + wave * 0.95;
        pulseWaveRef.current.scale.set(waveScale, waveScale, 1);
        const mat = pulseWaveRef.current.material as THREE.MeshBasicMaterial;
        if (mat) mat.opacity = (1 - wave) * 0.8;
        pulseWaveRef.current.visible = true;
      } else {
        pulseWaveRef.current.visible = false;
      }
    }
  });

  // Color del pin: si es inactivo no cambia de color con hover, permanece en su tono tenue
  const pinColor = !isViable
    ? "#7F7B8C"
    : isHovered
    ? "#FFFFFF"
    : isSelected
    ? "#FAF9F7"
    : "#A6948A";

  const pinOpacity = !isViable ? 0.35 : isSelected ? 0.95 : 0.72;
  const discRadius = isSelected ? 0.088 : 0.048;

  // Fill del círculo de área:
  // Si está inactivo y en hover, toma el color del tag/estado (#fb7185 - rose-400)
  const discFillColor = !isViable
    ? isHovered
      ? "#fb7185"
      : "#7F7B8C"
    : pinColor;

  const discFillOpacity = !isViable
    ? isHovered
      ? 0.55
      : 0.25
    : isHovered
    ? 0.45
    : pinOpacity * 0.35;

  return (
    <group
      position={position}
      quaternion={quaternion}
      onPointerOver={(e) => {
        e.stopPropagation();
        setIsHovered(true);
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        setIsHovered(false);
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelectSite?.(site);
      }}
    >
      {/* Hitbox invisible ampliada para el mástil (captura fácil y cómoda del cursor) */}
      <mesh ref={stemHitboxRef} position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.048, 0.048, 0.16, 12]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      {/* Disco sólido de zona de aterrizaje */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <circleGeometry args={[discRadius, 48]} />
        <meshBasicMaterial
          color={discFillColor}
          side={THREE.DoubleSide}
          transparent
          opacity={discFillOpacity}
        />
      </mesh>

      {/* Circunferencia que marca el área (anillo perimetral) */}
      <mesh
        ref={discRingRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.003, 0]}
      >
        <ringGeometry args={[discRadius * 0.88, discRadius, 48]} />
        <meshBasicMaterial
          color={!isViable ? (isHovered ? "#fb7185" : "#7F7B8C") : isHovered ? "#FFFFFF" : pinColor}
          side={THREE.DoubleSide}
          transparent
          opacity={!isViable ? (isHovered ? 0.85 : 0.35) : isHovered ? 1.0 : pinOpacity}
        />
      </mesh>

      {/* Onda expansiva de pulso */}
      <mesh
        ref={pulseWaveRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.0035, 0]}
        visible={false}
      >
        <ringGeometry args={[discRadius * 0.92, discRadius * 1.05, 48]} />
        <meshBasicMaterial
          color={isHovered ? "#38BDF8" : "#E4E3E8"}
          side={THREE.DoubleSide}
          transparent
          opacity={0.6}
        />
      </mesh>

      {/* Mástil / picker radial visual que crece en altura */}
      <mesh ref={stemMeshRef} position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.0035, 0.0035, 0.16, 12]} />
        <meshBasicMaterial
          color={pinColor}
          transparent
          opacity={pinOpacity}
        />
      </mesh>

      {/* Nodo esférico superior y etiqueta anclada al extremo */}
      <mesh ref={tipMeshRef} position={[0, 0.16, 0]}>
        <sphereGeometry args={[isSelected || isHovered ? 0.018 : 0.012, 20, 20]} />
        <meshBasicMaterial
          color={pinColor}
          transparent
          opacity={pinOpacity}
        />

        {/* Etiqueta HTML con hitbox ampliada (el punto conserva su estado/color original siempre, no cambia en hover) */}
        <Html
          position={[0, 0.038, 0]}
          center
          className="pointer-events-auto select-none"
        >
          <div
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={(e) => {
              e.stopPropagation();
              onSelectSite?.(site);
            }}
            className="p-1.5 cursor-pointer -m-1.5"
          >
            <div
              className={`px-3 py-1 rounded-full border backdrop-blur-md transition-all duration-200 whitespace-nowrap shadow-lg flex items-center gap-1.5 cursor-pointer ${
                isHovered
                  ? "bg-[#FAF9F7] text-[#09080C] border-white scale-110 font-bold shadow-white/30 ring-2 ring-white/50"
                  : isSelected
                  ? "bg-[#D9CEC5]/95 text-[#09080C] border-white font-medium scale-105"
                  : "bg-[#0D0D0D]/85 text-[#FAFAFA] border-white/30 font-normal hover:bg-[#1C1C20] hover:border-white/60"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  site.viabilityTier === "optimal"
                    ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]"
                    : site.viabilityTier === "marginal"
                    ? "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]"
                    : site.viabilityTier === "critical"
                    ? "bg-rose-400 shadow-[0_0_6px_rgba(251,113,133,0.8)]"
                    : !isViable
                    ? "bg-rose-400"
                    : "bg-emerald-400"
                }`}
              />
              <span className="font-sans text-[11.5px] leading-tight tracking-tight">
                {site.name}
              </span>
            </div>
          </div>
        </Html>
      </mesh>
    </group>
  );
};

export interface MoonGlobeProps {
  modelPath?: string;
  sites?: (LandingSite & { isViable?: boolean; viabilityTier?: "optimal" | "marginal" | "critical" })[];
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

  // Carga del modelo GLB global (NASA SVS ID 14959)
  const { scene } = useGLTF(modelPath);

  // Clonar la escena para permitir múltiples instancias en distintos Canvas sin conflictos
  // Ajuste de contraste y desaturación del albedo lunar para lograr sombras profundas y acabado fotográfico
  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        if (mesh.material) {
          // Clonar el material para no mutar el modelo global compartido
          const originalMat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
          const mat = originalMat.clone() as THREE.MeshPhysicalMaterial;

          // Eliminar el acabado plástico/clearcoat del GLB para obtener regolito mate real
          mat.roughness = 0.98;
          mat.metalness = 0.0;
          if ("clearcoat" in mat) mat.clearcoat = 0.0;
          if ("specularIntensity" in mat) mat.specularIntensity = 0.05;

          // Modificar el shader de fragmentos para igualar el acabado fotográfico de la referencia:
          // - Monocromo plateado/cenizo (90% desaturado)
          // - Contraste orgánico entre los mares oscuros (gris carbón) y las tierras altas (plata)
          // - Piso de sombras suavizado (sin negros empastados)
          mat.onBeforeCompile = (shader) => {
            shader.fragmentShader = shader.fragmentShader.replace(
              "#include <map_fragment>",
              `
              #include <map_fragment>
              #ifdef USE_MAP
                // 1. Escala de grises fotográfica de regolito lunar
                float luma = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
                vec3 regolithTint = vec3(luma) * vec3(1.0, 0.99, 0.98);
                diffuseColor.rgb = mix(regolithTint, diffuseColor.rgb, 0.12);

                // 2. Curva tonal estilo referencia: mares lunares en gris carbón rico y cráteres superiores nítidos
                diffuseColor.rgb = smoothstep(0.04, 0.94, diffuseColor.rgb);
                diffuseColor.rgb = pow(diffuseColor.rgb, vec3(0.95));
                diffuseColor.rgb = diffuseColor.rgb * 0.88 + vec3(0.055);
              #endif
              `
            );
          };

          mesh.material = mat;
        }
      }
    });
    return clone;
  }, [scene]);

  // Rotación lenta y continua sobre su propio eje Y
  useFrame((_, delta) => {
    if (autoRotate && spinGroupRef.current) {
      spinGroupRef.current.rotation.y += delta * rotationSpeed;
    }
  });

  // Puntos del Meridiano 1 (0° - 180° en el plano X-Y) que cruza el Polo Sur (-Y)
  const meridian1Points = useMemo(() => {
    const pts: [number, number, number][] = [];
    const R = NATIVE_MOON_RADIUS * 1.0035;
    const maxAngle = (78 * Math.PI) / 180; // Abarca 78° hacia cada hemisferio desde el polo sur
    const steps = 64;
    for (let i = 0; i <= steps; i++) {
      const alpha = -maxAngle + (2 * maxAngle * i) / steps;
      const x = R * Math.sin(alpha);
      const y = -R * Math.cos(alpha);
      const z = 0;
      pts.push([x, y, z]);
    }
    return pts;
  }, []);

  // Puntos del Meridiano 2 (90° - 270° en el plano Z-Y) perpendicular al Meridiano 1
  const meridian2Points = useMemo(() => {
    const pts: [number, number, number][] = [];
    const R = NATIVE_MOON_RADIUS * 1.0035;
    const maxAngle = (78 * Math.PI) / 180;
    const steps = 64;
    for (let i = 0; i <= steps; i++) {
      const alpha = -maxAngle + (2 * maxAngle * i) / steps;
      const x = 0;
      const y = -R * Math.cos(alpha);
      const z = R * Math.sin(alpha);
      pts.push([x, y, z]);
    }
    return pts;
  }, []);

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

        {/* Marcadores de sitios candidatos sobre el globo: se desmontan de inmediato al salir del Picker */}
        {showSites && (
          <group ref={markersGroupRef}>
            {sites.map((site) => {
              // Distribuir visualmente las coordenadas polares (-82° a -89.5°) sobre la corona polar
              // para evitar que colapsen en un único píxel y replicar el ángulo del callout de referencia
              const degFromSouthPole = Math.max(12, (90 + site.coordinates.lat) * 2.5 + 15);
              const phi = (180 - degFromSouthPole) * (Math.PI / 180);
              const theta = (site.coordinates.lng + 180) * (Math.PI / 180);
              const markerRadius = NATIVE_MOON_RADIUS * 1.004;

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
                <LandingSitePin
                  key={site.id}
                  site={site}
                  isSelected={isSelected}
                  onSelectSite={onSelectSite}
                  position={[x, y, z]}
                  quaternion={quaternion}
                />
              );
            })}
          </group>
        )}

        {/* Meridianos ortogonales en cruz que intersectan en el eje polar (Polo Sur) */}
        {showSites && (
          <group>
            {/* Meridiano 1: 0° - 180° en color palette-cream */}
            <Line
              points={meridian1Points}
              color="#D9CEC5"
              lineWidth={1.5}
              transparent
              opacity={0.85}
            />

            {/* Meridiano 2: 90° - 270° en color palette-cream */}
            <Line
              points={meridian2Points}
              color="#D9CEC5"
              lineWidth={1.5}
              transparent
              opacity={0.85}
            />

            {/* Nodo central luminoso en el Polo Sur (intersección exacta 90°S) */}
            <mesh position={[0, -NATIVE_MOON_RADIUS * 1.0035, 0]}>
              <sphereGeometry args={[0.015, 20, 20]} />
              <meshBasicMaterial color="#D9CEC5" />
            </mesh>
          </group>
        )}
      </group>
    </group>
  );
};

// Pre-cargar el modelo para evitar tirones en tiempo de ejecución
useGLTF.preload("/models/moon.glb");
