"use client";

import React, { useMemo } from "react";
import * as THREE from "three";
import { Line } from "@react-three/drei";
import { useTerrainHeight } from "@/lib/geo/useTerrainHeight";

export interface TerrainPedestalProps {
  size: number;
  segments: number;
  demUrl: string;
  displacementScale: number;
  displacementBias: number;
  /** Profundidad del bloque por debajo de la cota mínima del relieve. */
  depth?: number;
  /** Color de las paredes del bloque. */
  color?: THREE.ColorRepresentation;
  /** Color del contorno holográfico de la base. */
  rimColor?: THREE.ColorRepresentation;
  rimOpacity?: number;
}

/**
 * Pedestal / faldón: convierte el plano topográfico en un bloque sólido "recortado"
 * de la Luna. Las paredes siguen exactamente el perfil del borde del DEM (muestreado
 * en los mismos vértices que la malla del terreno), así no quedan huecos.
 */
export const TerrainPedestal: React.FC<TerrainPedestalProps> = ({
  size,
  segments,
  demUrl,
  displacementScale,
  displacementBias,
  depth = 4,
  color = "#0D0D0D",
  rimColor = "#A6948A",
  rimOpacity = 0.55,
}) => {
  const heightAt = useTerrainHeight(demUrl, displacementScale, displacementBias);
  const half = size / 2;
  const baseY = displacementBias - depth;

  const geometry = useMemo(() => {
    const positions: number[] = [];
    const indices: number[] = [];

    // Cada borde: lista de (x, z, u, v) en los vértices del terreno
    const edge = (fn: (t: number) => [number, number, number, number]) => {
      const start = positions.length / 3;
      for (let k = 0; k <= segments; k++) {
        const [x, z, u, v] = fn(k / segments);
        positions.push(x, heightAt(u, v), z); // vértice superior (sobre el relieve)
        positions.push(x, baseY, z); // vértice inferior (base)
      }
      for (let k = 0; k < segments; k++) {
        const a = start + k * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    };

    edge((t) => [-half + t * size, -half, t, 1]); // Norte (z = -half, v = 1)
    edge((t) => [half - t * size, half, 1 - t, 0]); // Sur   (z = +half, v = 0)
    edge((t) => [-half, half - t * size, 0, t]); // Oeste (x = -half, u = 0)
    edge((t) => [half, -half + t * size, 1, 1 - t]); // Este  (x = +half, u = 1)

    // Tapa inferior
    const b = positions.length / 3;
    positions.push(-half, baseY, -half, half, baseY, -half, half, baseY, half, -half, baseY, half);
    indices.push(b, b + 2, b + 1, b, b + 3, b + 2);

    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  }, [heightAt, size, segments, half, baseY]);

  const rim = useMemo<[number, number, number][]>(
    () => [
      [-half, baseY, -half],
      [half, baseY, -half],
      [half, baseY, half],
      [-half, baseY, half],
      [-half, baseY, -half],
    ],
    [half, baseY]
  );

  return (
    <group>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial color={color} roughness={0.95} metalness={0.05} side={THREE.DoubleSide} />
      </mesh>
      {/* Contorno holográfico de la base de la maqueta */}
      <Line points={rim} color={rimColor} lineWidth={1.2} transparent opacity={rimOpacity} />
    </group>
  );
};

export default TerrainPedestal;
