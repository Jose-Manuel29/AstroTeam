const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

export function celestialDirectionToScene(
  azimuthDeg: number,
  elevationDeg: number,
  siteLongitudeDeg: number,
  distance = 1
): [number, number, number] {
  const azimuth = toRadians(azimuthDeg);
  const elevation = toRadians(elevationDeg);
  const longitude = toRadians(siteLongitudeDeg);
  const northX = -Math.sin(longitude);
  const northZ = Math.cos(longitude);
  const eastX = Math.cos(longitude);
  const eastZ = Math.sin(longitude);
  const horizontal = Math.cos(elevation);

  return [
    distance * horizontal * (northX * Math.cos(azimuth) + eastX * Math.sin(azimuth)),
    distance * Math.sin(elevation),
    distance * horizontal * (northZ * Math.cos(azimuth) + eastZ * Math.sin(azimuth)),
  ];
}
