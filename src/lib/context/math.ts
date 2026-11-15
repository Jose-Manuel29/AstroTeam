import * as THREE from "three";

/**
 * Convierte latitud/longitud selenográficas (grados) a coordenadas cartesianas
 * sobre una esfera de radio `sphereRadius` (convención Three.js: Y hacia arriba).
 *
 * - lat = +90 → polo norte (0, +R, 0)
 * - lat = -90 → polo sur   (0, -R, 0)
 * - lon = 0   → eje +Z (cara visible)
 */
export function getPositionFromLatLon(
  lat: number,
  lon: number,
  sphereRadius: number
): THREE.Vector3 {
  const phi = THREE.MathUtils.degToRad(90 - lat); // ángulo polar desde +Y
  const theta = THREE.MathUtils.degToRad(lon); // ángulo azimutal desde +Z hacia +X

  const x = sphereRadius * Math.sin(phi) * Math.sin(theta);
  const y = sphereRadius * Math.cos(phi);
  const z = sphereRadius * Math.sin(phi) * Math.cos(theta);

  return new THREE.Vector3(x, y, z);
}
