"use client";

import React from "react";

export interface GlobalSphereProps {
  radius?: number;
  wireframe?: boolean;
}

/** Esfera lunar de prueba (radio 10 = valor por defecto de CameraController). */
export const GlobalSphere: React.FC<GlobalSphereProps> = ({ radius = 10, wireframe = false }) => {
  return (
    <group>
      <mesh>
        <sphereGeometry args={[radius, 64, 64]} />
        <meshStandardMaterial color="#8a8a8a" roughness={0.95} metalness={0} />
      </mesh>
      {/* Retícula superpuesta para referencia visual de lat/lon */}
      <mesh scale={1.002}>
        <sphereGeometry args={[radius, 36, 18]} />
        <meshBasicMaterial color="#7F7B8C" wireframe transparent opacity={wireframe ? 0.6 : 0.14} />
      </mesh>
    </group>
  );
};

export default GlobalSphere;
