# Plan de Proyecto: Visualizador del Polo Sur Lunar

**Reto:** 2026 NASA Space Apps Challenge - Misiones al Polo Sur de la Luna  
**Estrategia Principal:** Precalcular efemérides para evitar simular física orbital compleja y dedicar el 80% del esfuerzo a una interfaz visual comparativa rápida y de alto impacto.

---

## 1. Estructura de Roles (Equipo Sprint de 48 Horas)

Para asegurar el éxito sin cuellos de botella, cada rol tiene un entregable bloqueado:

### Rol 1: Especialista en Datos Orbitales y Backend (Python / FastAPI)
- **Responsabilidad:** Obtener y limpiar datos de elevación (LOLA) y calcular la posición del Sol y la Tierra respecto a coordenadas específicas.
- **Entregable:** Archivos JSON estáticos precalculados con la estructura:  
  `[fecha, hora, elevación_sol, azimut_sol, elevación_tierra, azimut_tierra, línea_de_vista_directa]`.

### Rol 2: Arquitecto de Visualización 3D / Gráficos (Frontend - React / Three.js)
- **Responsabilidad:** Construir el componente visual estrella, gestionando el entorno 3D y la iluminación rasante para simular las sombras del polo sur.
- **Entregable:** Canvas interactivo con control de tiempo y transición fluida entre vistas (LOD).

### Rol 3: Desarrollador UI/UX e Integración (Frontend - React / Tailwind CSS)
- **Responsabilidad:** Crear la vista comparativa, paneles de métricas (horas de luz, ventanas de comunicación) y asegurar una experiencia de usuario limpia.
- **Entregable:** Dashboard responsivo y estructuración de los modos de usuario.

---

## 2. Definición de Requerimientos (Features Core)

Para garantizar un producto completo y competitivo, la plataforma debe cumplir con los siguientes requerimientos técnicos y funcionales:

- **Mapa Interactivo de Selección:** Mapa para seleccionar ubicaciones, con capacidad de agrupar sitios de interés (clustering).
- **Entorno 3D y Vectores:** Mapa 3D con iluminación solar dinámica y un vector/línea de visión visualizando la posición de la Tierra.
- **Control Temporal:** Slider temporal (línea de tiempo) y un input de fecha exacto para simular efemérides precisas.
- **Visualización de Métricas:** Paneles de control (dashboards) que muestran datos analíticos en tiempo real según la posición del Sol y la Tierra.
- **Filtros Dinámicos (Sliders):** Sliders para definir "criterios aceptables" (ej. % mínimo de iluminación, grados máximos de pendiente) que filtren los sitios viables.
- **Sistema de Perfiles (Niveles de Profundidad):**
  - **Nivel 1: Educadores / Entusiastas:** Métricas simplificadas, enfoque visual e interactivo.
  - **Nivel 2: Ingenieros / Planificadores de Misión:** Datos crudos, telemetría, proyecciones topográficas, análisis de riesgos.
- **Física Visual:** Relación directa entre la elevación solar calculada y la iluminación dinámica en el modelo 3D.
- **Comunicaciones:** Cálculo y visualización de ventanas operativas (*Direct-to-Earth Line of Sight*) para la transmisión de datos.

---

## 3. Flujo de Usuario de la Web-App (User Flow)

La aplicación seguirá un recorrido de tres etapas (embudo de análisis):

1. **Landing Page:**  
   Pantalla de inicio atractiva que presenta el reto de Artemis y ofrece la entrada a la herramienta.

2. **Seleccionador de Ubicaciones (Vista Global/Regional):**  
   - Interfaz montada sobre el modelo 3D global o regional.
   - **UI Card:** Panel de input donde el usuario define sus requerimientos (filtros/sliders) y ajusta el slider temporal.
   - **Acción:** El mapa resalta o filtra automáticamente las ubicaciones que cumplen con los criterios establecidos.

3. **Vista Especializada (Vista Local / Análisis Profundo):**  
   - Al seleccionar un sitio viable, la cámara hace zoom al modelo topográfico 3D de alta resolución de esa zona específica.
   - Se muestra el cumplimiento de métricas detalladas.
   - Se despliegan capas de datos científicos y ambientales (topografía, albedo, hielo, pendientes, etc.) con la iluminación dinámica interactuando en tiempo real.

---

## 4. Estrategia de Visualización 3D (Renderizado Dual / LOD)

Para mantener la aplicación web ultraligera y científicamente atractiva, utilizaremos dos estrategias de renderizado basadas en el nivel de detalle (*Level of Detail* - LOD):

### A. Vista Global (Navegación General)
- **Técnica:** Uso de un modelo `.glb` estático de la NASA (SVS ID 14959) versión "COLOR MAP ONLY".
- **Propósito:** Permitir al usuario rotar la Luna libremente y seleccionar sitios de interés (Flujo paso 2) con cero lag. Se evita el mapa de relieve global para no sufrir el defecto de "polos distorsionados".

### B. Vista Regional y Local (Análisis de Sitios Específicos)
- **Técnica:** Reemplazar la esfera por una geometría plana (`PlaneGeometry`) subdividida, aplicando texturas de elevación (`displacementMap`) e imágenes de alta resolución.
- **Propósito:** Simular el terreno local exacto para la Vista Especializada.
- **Iluminación:** Permite que una luz direccional dinámica simule las sombras alargadas reales y las "regiones en sombra permanente" (PSR) controladas por Three.js, no por la fotografía.

---

## 5. Decisiones Técnicas sobre Datos y Mapas (Pipeline NASA)

Para asegurar estabilidad en la presentación y evitar caídas de servidores externos (WMS/3D Tiles), se adopta una arquitectura de **Mapas Estáticos Preprocesados**, extraídos principalmente de NASA Moon Trek:

### A. Criterios de Búsqueda y Selección
- **Proyección Cartográfica:** Todo mapa descargado **DEBE** usar la proyección *Estereográfica Polar (South Pole)* para garantizar que la cuadrícula encaje y no haya distorsión geométrica en los bordes.
- **Mapa de Relieve (DEM / Displacement):**
  - **Instrumentos:** LOLA (Global/Regional) o LROC NAC (Local).
  - **Selección Regional:** LRO LOLA DEM, 75 deg v4, S Pole (el balance perfecto para cubrir los sitios candidatos de Artemis).
  - **Regla Estricta:** Descartar cualquier mapa "Hillshade". Usar únicamente versiones "Grayscale" o "Elevation" puros para evitar inyectar sombras falsas en la geometría 3D.
- **Mapa Visual (Skin / Color):**
  - **Instrumentos:** LROC WAC (Mosaico) o LOLA (Albedo).
  - **Selección:** LRO WAC Mosaic, S Pole v2. Elegido específicamente porque corrige las diferencias extremas de iluminación polar, funcionando casi como un Albedo puro para que el renderizador 3D tome el control de las sombras.
- **Capas Científicas (UI Overlays):**
  - Descargar selectivamente mapas de "Slope" (LOLA) para visibilidad de peligro de aterrizaje.
  - Mapas de temperatura / PSR (Diviner) para identificar potenciales depósitos de hielo volátil.

### B. Pipeline de Procesamiento (GDAL)
Para manejar los archivos científicos masivos (`.tif`) de varios Gigabytes y hacerlos compatibles con React Three Fiber, se procesan mediante línea de comandos (GDAL) bajo las siguientes reglas:
- **Proyección Cartográfica Compartida:** Estereográfica Polar Sur (`+proj=stere +lat_0=-90 +lon_0=0 +k=1 +x_0=0 +y_0=0 +R=1737400 +units=m +no_defs`).
- **Sincronización:** Todos los archivos (Skin, Displacement y Normales) se reproyectan y recortan al mismo tamaño exacto (`2048x2048`) usando el mismo *Bounding Box* centrado en el Polo Sur (`-450000 -450000 450000 450000` metros).
- **Conversión Visual (Skin / Color):** Convertir `.tif` a `.webp` para máxima compresión sin perder calidad visual:
  ```bash
  gdal_translate -b 1 -b 1 -b 1 -of WEBP -co "QUALITY=80" input_skin_stere.tif output_skin.webp
  ```
- **Conversión Elevación (DEM / Displacement):** Convertir `.tif` a `.png` de 8-bits usando la bandera de normalización matemática:
  ```bash
  gdal_translate -of PNG -scale -ot Byte input_dem_stere.tif output_displacement.png
  ```
  *(Nota: No usar compresión WEBP/JPG para los DEM, ya que genera "escalones" o artefactos en la geometría 3D).*
- **Generación de Normal Map (Micro-relieve):** Extraer gradientes de pendiente y normales ortogonales mediante `gdaldem hillshade` a $90^\circ$, $0^\circ$ y $89^\circ$ cenital, combinados en un archivo RGB de 3 bandas:
  ```bash
  gdaldem hillshade -az 90 -alt 45 input_dem_stere.tif hs_x.tif
  gdaldem hillshade -az 0 -alt 45 input_dem_stere.tif hs_y.tif
  gdaldem hillshade -az 0 -alt 89 input_dem_stere.tif hs_z.tif
  gdalbuildvrt -separate normal.vrt hs_x.tif hs_y.tif hs_z.tif
  gdal_translate -of PNG normal.vrt output_normal.png
  ```

---

## 6. Plan de Trabajo (Cronograma de 48 Horas)

| Bloque | Ventana de Tiempo | Alcance / Hito | Estado |
| :--- | :--- | :--- | :--- |
| **Bloque 1** | Horas 0 a 4 | **Definición y Datos:** Selección de sitios, extracción de Moon Trek, procesamiento de texturas con GDAL (Skin, DEM, Normales) y ejecución del script Python para JSONs de efemérides. | **COMPLETADO (100%)** |
| **Bloque 2** | Horas 4 a 16 | **Núcleo Funcional (MVP):** Landing page, flujos de navegación, Vista Global (GLB) y sincronización del Timeline Slider. | En progreso |
| **Bloque 3** | Horas 16 a 30 | **3D Avanzado y Filtros:** Implementar Vistas Regional y Local (componente `LunarSurface` con displacement maps), inputs de "criterios aceptables" y render de vectores hacia la Tierra. | **PARCIAL (Vista Local 3D lista)** |
| **Bloque 4** | Horas 30 a 42 | **UI/UX y Modos:** Separación de perfiles (Técnico vs Educativo), overlays científicos (Slope/PSR), métricas avanzadas y despliegue inicial (Vercel/Netlify). | Pendiente |
| **Bloque 5** | Horas 42 a 48 | **Pitch y Respaldo:** Grabación de video demo de 2 minutos y ensayo del pitch. | Pendiente |
