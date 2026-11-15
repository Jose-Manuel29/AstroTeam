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

## 3. Flujo de Usuario y Vistas del Sprint (User Flow)

La aplicación implementa un embudo de 3 vistas clave para el sprint de 48 horas:

| Vista | URL | Propósito | Componentes Clave |
| :--- | :--- | :--- | :--- |
| **1. Landing Page** | `/` | Presentación del reto Artemis de la NASA, contexto polar y entrada a la herramienta. | Hero Section con estética HUD, botón CTA a exploración, resumen de datos e instrumentos LOLA/LROC. |
| **2. Locations Picker with 3D Global Model** | `/explore` | Selección y filtrado de sitios candidatos de alunizaje sobre el globo lunar completo. | Canvas 3D con `MoonGlobe` (`public/models/moon.glb`), pins interactivos de sitios Artemis, panel de filtros de viabilidad (% luz y pendiente) y badge de viabilidad en tiempo real. |
| **3. Detail View with 3D Map and 3D Global Model** | `/site/:id` | Análisis local profundo del terreno de alunizaje y telemetría de misión. | Canvas 3D local con `LunarSurface` (DEM LOLA + sombras rasantes dinámicas), minimapa 3D complementario (`OrbitMinimap` con `moon.glb`), panel de telemetría orbital y controlador temporal. |

---

## 4. Estrategia de Visualización 3D (Renderizado Dual / LOD)

Para mantener la aplicación web ultraligera y científicamente atractiva, utilizaremos dos estrategias de renderizado basadas en el nivel de detalle (*Level of Detail* - LOD):

### A. Vista Global (Navegación General y Minimapa)
- **Técnica:** Uso de un modelo `.glb` estático de la NASA (SVS ID 14959) versión "COLOR MAP ONLY".
- **Ubicación de Archivo:** `frontend/public/models/moon.glb` (cargado vía `/models/moon.glb` con `useGLTF`).
- **Propósito:** Permitir al usuario rotar la Luna libremente y seleccionar sitios de interés (Flujo paso 2) y servir como minimapa de orientación en la vista de detalle (Flujo paso 3) con cero lag. Se evita el mapa de relieve global para no sufrir el defecto de "polos distorsionados".

### B. Vista Regional y Local (Análisis de Sitios Específicos)
- **Técnica:** Reemplazar la esfera por una geometría plana (`PlaneGeometry`) subdividida, aplicando texturas de elevación (`displacementMap`), normales y albedo corregido.
- **Ubicación de Texturas:** `frontend/public/textures/lunar_displacement.png`, `lunar_normal.png`, `lunar_color.webp`.
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

---

## 7. Sistema de Diseño y Tipografía (Cyber-Aeroespacial & Brutalist)

Para asegurar coherencia visual con la estética de telemetría y centro de control (*Mission Control*), la interfaz adopta el siguiente sistema tipográfico:

| Nivel UI | Fuente | Peso | Ejemplo de Uso |
| :--- | :--- | :--- | :--- |
| **Hero / Logo** | `Major Mono Display` | 400 Regular (minúsculas) | `astRo teaM // artemis south pole` |
| **Cabeceras HUD / Secciones** | `Space Grotesk` | 700 Bold | `ANÁLISIS DE ILUMINACIÓN POLAR, SITIOS VIABLES` |
| **Botones CTA** | `Inter` | 700 Bold (`1.25rem` / `20px`) | `touch down` |
| **Cuerpo / Textos / Labels** | `Inter` | 400 Regular / 500 Medium | Explicaciones de criterios, descripciones de cráteres, modales de ayuda |

*(Nota: Por ahora se prescinde de `Space Mono`, unificando botones CTA y cuerpo bajo `Inter`).*

### Paleta Cromática Oficial (Adobe Color - Actualizada Lunar Regolith)
- **Regolith Warm Cream (`#D9CEC5` / `palette-cream`):** Superficies de botones tácticos, cápsulas glassmorphism, acentos sutiles de suelo lunar, zona de alunizaje activa y vector hacia la Tierra.
- **Charcoal Dark Slate (`#3B3B40` / `palette-charcoal`):** Textos oscuros en botones, bordes de alto contraste, tarjetas HUD y sub-grids de telemetría.
- **Space Slate Purple / Dust (`#7F7B8C` / `palette-slate`):** Elementos secundarios, retículas de escaneo topográfico y badges neutrales.
- **Lunar Ochre / Earthshine (`#A6948A` / `palette-ochre`):** Iluminación solar rasante suave, transiciones térmicas, ejes/retícula de referencia, líneas ortogonales del minimapa polar y marcadores.
- **Deep Space Obsidian (`#0D0D0D` / `palette-obsidian`):** Fondo general del viewport espacial, pedestal de diorama, lienzo principal y sombras permanentes (PSR).

### Sistema de Diseño HUD y Responsividad Desktop (Medidas Relativas Fluidas)
- **Estrategia Anti-Desbordamiento Vertical:** Para garantizar que todos los paneles HUD y elementos interactivos se rendericen holgadamente en pantallas de escritorio con altura reducida (ej. 768px, 800px, 900px), todos los componentes de la vista de detalle implementan:
  - **Medidas Relativas con `clamp(min, preferred_vh/vw, max)`:** Alturas, rellenos (`padding`), márgenes y tipografías escalan dinámicamente según la altura del viewport.
  - **Minimapa Radar Polar (`SouthPoleMinimap`):** Ensambla una matriz 2x2 de cuadrantes polares (`1.png`, `2.png`, `3.png`, `4.png`) en un marco circular con líneas discontinuas perpendiculares (`palette-ochre`), recuadro de zona (`palette-cream/70`) y marcadores de sitios, escalando fluidamente con `w-[clamp(95px,16.5vh,195px)]`.
  - **Contención y Scroll Interno Elegante:** Componentes con múltiples elementos dinámicos (como la lista de telemetría ambiental) incluyen límites relativos de altura (`max-h-[clamp(115px,24vh,230px)]`) con scroll interno sutil para evitar cualquier colisión o desborde del layout.

### Sistema de Iconografía Oficial
- **Biblioteca:** `Phosphor Icons` (`@phosphor-icons/react`).
- **Estilo:** `regular` y `bold` para interfaz HUD táctica y controles de telemetría.

---

## 8. Arquitectura y Estructura de Carpetas del Frontend

Basado en el stack técnico definido para el proyecto (**React 18**, **Three.js / React Three Fiber / Drei**, **Vite**, **Tailwind CSS** y **Phosphor Icons (`@phosphor-icons/react`)**):

```text
AstroTeam/
├── backend/                             # API y procesamiento de efemérides (FastAPI / Python)
├── docs/                                # Documentación y plan de proyecto
│   └── plan_de_proyecto.md
├── frontend/                            # Aplicación web cliente (Vite + React 18 + R3F)
│   ├── public/
│   │   ├── models/                      # Modelos 3D globales (GLB)
│   │   │   ├── moon.glb                 # <-- SUBIR AQUÍ EL MODELO GLOBAL DE LA LUNA
│   │   │   └── README.md
│   │   └── textures/                    # Texturas científicas procesadas (LOLA / LROC)
│   │       ├── lunar_color.webp         # Skin/Albedo WAC corregido
│   │       ├── lunar_displacement.png   # DEM LOLA 8-bit normalizado
│   │       └── lunar_normal.png         # Normal map 3 bandas para micro-relieve
│   ├── src/
│   │   ├── components/
│   │   │   ├── 3d_canvas/               # Componentes Three.js / R3F
│   │   │   │   ├── LunarSurface.tsx     # Terreno local 3D con displacement y sombras
│   │   │   │   ├── MoonGlobe.tsx        # Globo lunar global 3D con pins interactivos
│   │   │   │   ├── OrbitMinimap.tsx     # Minimapa 3D de contexto polar global
│   │   │   │   └── LightingRig.tsx      # Rig de iluminación solar y vector Tierra
│   │   │   ├── hud/                     # Paneles de control y telemetría táctica
│   │   │   │   ├── TelemetryCard.tsx    # Métricas de azimut, elevación y DTE
│   │   │   │   ├── TimelineSlider.tsx   # Controlador temporal UTC
│   │   │   │   ├── ViabilityDrawer.tsx  # Filtros de pendiente y % iluminación
│   │   │   │   └── ProfileSwitcher.tsx  # Switcher Entusiasta vs Planificador
│   │   │   └── navigation/
│   │   │       └── Navbar.tsx           # Barra superior HUD
│   │   ├── views/                       # Vistas del flujo del sprint
│   │   ├── LandingView.tsx              # URL: / (Landing Page)
│   │   ├── LocationPickerView.tsx       # URL: /explore (Locations Picker con globo 3D)
│   │   └── SiteDetailView.tsx           # URL: /site/:id (Detalle con terreno y minimapa)
│   ├── data/
│   │   └── landingSites.ts              # Dataset de sitios candidatos Artemis
│   ├── types/
│   │   └── index.ts                     # Definiciones TypeScript de efemérides y sitios
│   ├── App.tsx                          # Orquestador de vistas y navegación SPA
│   ├── main.tsx                         # Punto de entrada React
│   └── index.css                        # Estilos globales y utilidades Tailwind
│   ├── index.html                       # Entry HTML con fuentes Google Fonts
│   ├── package.json                     # Dependencias y scripts de construcción
│   ├── tailwind.config.js               # Configuración de tokens y fuentes
│   ├── tsconfig.json                    # Configuración de TypeScript
│   └── vite.config.ts                   # Configuración de empaquetado Vite
```


