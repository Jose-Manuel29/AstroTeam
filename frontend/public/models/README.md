# Modelos 3D Globales (.glb)

Coloca aquí el archivo `.glb` del modelo global de la Luna (NASA SVS ID 14959 - "Color Map Only"):

- **Ruta recomendada:** `public/models/moon.glb`
- **Acceso en React Three Fiber:** Se cargará directamente desde la URL estática `/models/moon.glb` usando `@react-three/drei`:
  ```tsx
  const { scene } = useGLTF('/models/moon.glb');
  ```
