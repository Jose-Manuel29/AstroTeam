# 🚀 Guía de Flujo de Trabajo y Coordinación del Equipo

**Proyecto**: Visualizador del Polo Sur Lunar - Misiones Artemis  
**Reto**: NASA Space Apps Challenge 2026  
**Propósito**: Establecer el orden de tareas, entregables y puntos de contacto para trabajar en paralelo sin cuellos de botella durante el sprint.

---

## 👥 1. Estructura de Roles del Equipo

| Rol | Miembro | Responsabilidad Principal | Entregable Clave |
| :--- | :--- | :--- | :--- |
| **Rol 1** | **Tú (Backend & Datos)** | Motor de efemérides (Skyfield), Supabase, pipeline GDAL y endpoints de FastAPI. | Datasets precalculados, script SQL de Supabase y API REST en vivo. |
| **Rol 2** | **Compañero Datos** | Descargar y aislar GeoTIFFs científicos de NASA Moon Trek / PDS. | Archivos crudos `lola_dem.tif` y `wac_mosaic.tif` en `raw_data/`. |
| **Rol 3** | **Compañero 3D** | Entorno Three.js / React Three Fiber, relieve lunar e iluminación rasante dinámica. | Canvas 3D con LOD (esfera global + plano regional con sombras dinámicas). |
| **Rol 4** | **Compañero Frontend** | Next.js, Tailwind CSS, slider de línea de tiempo y paneles analíticos. | Dashboard web responsivo desplegado en Vercel con perfiles de usuario. |

---

## 🗺️ 2. Diagrama de Flujo y Entrega de Datos

```text
 ┌─────────────────────────────────────────────────────────────┐
 │               COMPAÑERO DE DATOS (NASA MOON TREK)           │
 │       Descarga GeoTIFFs estereográficos del Polo Sur        │
 └──────────────────────────────┬──────────────────────────────┘
                                │ Entrega .tif en raw_data/
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │                    TÚ (BACKEND & PIPELINE)                  │
 │                                                             │
 │  1. Ejecutas GDAL  ────────► Genera PNG 8-bit y WEBP 2K    │
 │  2. FastAPI consulta ──────► Supabase (sitios y cronograma)  │
 │  3. Corres FastAPI ────────► Expone endpoints en vivo       │
 └──────────────┬───────────────────────────────┬──────────────┘
                │ Texturas procesadas           │ Datos desde Supabase
                ▼                               ▼
 ┌─────────────────────────────┐ ┌─────────────────────────────┐
 │        COMPAÑERO 3D         │ │     COMPAÑERO FRONTEND      │
 │  (Three.js / React Canvas)  │ │   (Next.js / Tailwind UI)   │
 │                             │ │                             │
 │ • DisplacementMap del DEM   │ │ • Consume API de FastAPI    │
 │ • Vector de luz solar       │ │ • Slider de tiempo a 60 FPS │
 │ • Rayo a la Tierra (Verde/  │ │ • Paneles de latencia y luz │
 │   Rojo según LOS)           │ │ • Despliegue en Vercel      │
 └──────────────┬──────────────┘ └──────────────┬──────────────┘
                │                               │
                └───────────────┬───────────────┘
                                ▼
                 ┌─────────────────────────────┐
                 │    APLICACIÓN WEB FINAL     │
                 │      (Lista para Pitch)     │
                 └─────────────────────────────┘
```

---

## ⚡ 3. Tu Plan de Acción Paso a Paso

### Paso 1: Subir tu trabajo a GitHub (Inmediato)
Permite que tus compañeros sincronicen el repositorio y tengan acceso a la documentación y datos:
```bash
git add backend/ docs/
git commit -m "feat(backend): motor orbital skyfield, datasets precalculados, supabase seed y pipeline gdal"
git push origin main
```
*Comparte con el equipo el archivo [CONTRATO_ESPECIFICACIONES.md](file:///C:/xampp/nasa/AstroTeam/backend/CONTRATO_ESPECIFICACIONES.md).*

---

### Paso 2: Conectar Frontend, FastAPI y Supabase
El catálogo y los cronogramas viven en Supabase. La carga del nuevo pipeline se hace directamente de JPL Horizons a Supabase; no requiere JSON como fuente de producción.

1. Carga seis registros en `lunar_sites`: Shackleton, Malapert, Connecting Ridge, Faustini, Cabeus (`cabeus`) y De Gerlache (`de-gerlache`). Para Cabeus, el centro oficial es aprox. 85.33°S, 42.13°O; para De Gerlache, 88.48°S, 88.34°O. Se verificaron en el [nomenclátor USGS/IAU de la Luna](https://planetarynames.wr.usgs.gov/Page/MOON/target) y su [KMZ de centros lunares](https://asc-planetarynames-data.s3.us-west-2.amazonaws.com/MOON_nomenclature_center_pts.kmz). Son centros de cráter, no puntos de aterrizaje; altitud y perfil local deben venir del DEM.
2. Obtén y carga el perfil topográfico real de cada sitio en `site_horizon_profile` (puntos de azimut 0–<360° y elevación angular del horizonte respecto al plano local). El pipeline no genera ni finge esos perfiles.
3. Revisa y ejecuta manualmente [`supabase_horizons_migration.sql`](C:/xampp/nasa/AstroTeam/backend/scripts/supabase_horizons_migration.sql) desde el SQL Editor de Supabase. Agrega `default_horizon_elevation_deg`, `site_horizon_profile`, unicidad por sitio/fecha y políticas públicas de lectura. Antes, resuelve cualquier duplicado existente de `(site_id, fecha_hora)`.
4. En el entorno local del backend configura `SUPABASE_URL`, `SUPABASE_KEY` y `SUPABASE_SERVICE_ROLE_KEY`. La clave de servicio solo permanece en el backend; no se configura en Vercel/frontend.
5. Desde `backend/`, genera y guarda 30 días de puntos horarios con `python scripts/sync_horizons.py --days 30`. Opcionales: `--site-id <id>` y `--start-utc 2026-11-15T00:00:00Z`. El proceso consulta Sol y Tierra a JPL, calcula visibilidad según el perfil, distancia, latencia de un sentido y fase, y hace upsert de 720 puntos por sitio. También guarda elevación de la Tierra, necesaria para decidir LOS.
6. FastAPI consulta Supabase. El frontend obtiene el catálogo con `GET /api/sites` y, al elegir un sitio, descarga una vez `GET /api/sites/{site_id}/timeline`; conserva los puntos en memoria mientras se mueve el slider. No debe pedir datos a Horizons ni a Supabase en cada movimiento.

Las rutas antiguas [`import_teammate_data.py`](C:/xampp/nasa/AstroTeam/backend/scripts/import_teammate_data.py) y `generate_presets.py` quedan fuera del flujo nuevo; los presets/SQL generados anteriormente incluyen datos sintéticos y no deben usarse como fuente ni ejecutarse. `GET /api/sites/{site_id}` ya no inventa un horizonte: requiere un perfil real y responde con error si falta. Aún no se ha aplicado la migración ni se han insertado sitios, perfiles o cronogramas en la base remota.

**Pendiente del frontend:** al seleccionar el índice del slider, mostrar elevación y azimut del Sol, estado de iluminación, azimut de la Tierra, LOS directa, distancia Tierra-Luna, latencia de comunicación y ángulo de fase terrestre. La respuesta incluye también elevación de la Tierra para depurar/representar LOS. `earth_latency_rtt_sec` es ida y vuelta; la base guarda la latencia unidireccional.

---

### Paso 3: Coordinación con el Compañero de Extracción de Datos
1. **Qué debe hacer tu compañero**:
   - Descargar desde NASA Moon Trek o NASA PDS:
     * `lola_dem.tif` (Mapa de elevación LOLA 75°S en escala de grises, proyección polar estereográfica).
     * `wac_mosaic.tif` (Mosaico de albedo visible LROC WAC).
   - Colocar ambos archivos en `backend/raw_data/` (esta carpeta está ignorada en `.gitignore` para no saturar Git).
2. **Qué debes hacer tú cuando los recibas**:
   - Ejecutar el pipeline de GDAL desde la terminal de PowerShell:
     ```powershell
     cd C:\xampp\nasa\AstroTeam\backend
     python gdal_pipeline/process_terrain.py
     ```
   - Esto producirá automáticamente en `output/textures/`:
     * `displacement_lola_2k.png` (8-bit escala de grises normalizada para Three.js).
     * `skin_wac_2k.webp` (Textura visual liviana comprimida al 80%).

---

### Paso 4: Coordinación con el Compañero de Renderizado 3D (Three.js)
1. **Entrégale las texturas**:
   - `output/textures/displacement_lola_2k.png` -> Asignar a `displacementMap` del material del plano.
   - `output/textures/skin_wac_2k.webp` -> Asignar a `map` del material.
2. **Pásale las fórmulas de iluminación (Sección 7 del Contrato)**:
   - **Posición de la Luz Direccional (Sol)**:
     ```javascript
     const R = 1000; // Radio orbital de la luz
     const elevRad = (sunElevationDeg * Math.PI) / 180;
     const azimRad = (sunAzimuthDeg * Math.PI) / 180;

     light.position.set(
       R * Math.cos(elevRad) * Math.sin(azimRad),
       R * Math.sin(elevRad),
       -R * Math.cos(elevRad) * Math.cos(azimRad)
     );
     ```
   - **Vector a la Tierra (Direct-to-Earth Line of Sight)**:
     - Si `direct_to_earth_los === true`: Dibujar el haz/línea de color **verde** (comunicación directa activa).
     - Si `direct_to_earth_los === false`: Dibujar el haz de color **rojo** (bloqueo por relieve montañoso).

---

### Paso 5: Validación y Despliegue del Backend FastAPI (Para cálculo en vivo)
Para permitir que los evaluadores seleccionen cualquier punto libre de la Luna:
1. **Prueba local**:
   ```powershell
   cd C:\xampp\nasa\AstroTeam\backend
   .\venv\Scripts\Activate.ps1
   uvicorn app.main:app --reload --port 8000
   ```
   - Entra a [http://localhost:8000/docs](http://localhost:8000/docs) y ejecuta una prueba en `POST /api/custom-site`.
2. **Despliegue opcional en la nube**:
   - Conecta el repositorio de GitHub a un servicio gratuito como [Render.com](https://render.com/) o [Railway.app](https://railway.app/).
   - Comando de inicio (*Start command*):
     ```bash
     uvicorn app.main:app --host 0.0.0.0 --port $PORT
     ```

---

## ⏱️ 4. Matriz Rápida de Entradas y Salidas

| Hito | Emisor | Receptor | Archivo / Recurso | Estado |
| :--- | :--- | :--- | :--- | :--- |
| **Modelo relacional** | Rol 1 (Tú) | Supabase | `lunar_sites`, `site_cronograma`, `site_horizon_profile` | ⏳ Migración pendiente |
| **Conexión FastAPI-Supabase** | Rol 1 (Tú) | Supabase | Catálogo, perfil y timeline | ✅ Lecturas probadas previamente; requiere migración nueva |
| **Metadatos y perfiles reales de 6 sitios** | Rol 2 (Datos) / Rol 1 (Tú) | Supabase | Coordenadas y perfiles topográficos | ⏳ Pendiente |
| **Cronograma JPL horario (30 días)** | Rol 1 (Tú) | Horizons → Supabase | `scripts/sync_horizons.py` | ⏳ Pendiente de ejecutar |
| **Slider y paneles conectados** | Rol 4 (Front) | FastAPI | 8 indicadores del timeline; una carga por sitio | ⏳ Pendiente |
| **Variables de entorno y RLS de producción** | Rol 1 (Tú) | Backend / Supabase | URL, clave de lectura y clave privada de servidor | ⏳ Pendiente |
| **GeoTIFFs Crudos** | Rol 2 (Datos) | Rol 1 (Tú) | `raw_data/*.tif` | ⏳ Pendiente descarga |
| **Texturas 3D** | Rol 1 (Tú) | Rol 3 (3D) | `output/textures/displacement_lola_2k.png` | ⏳ Corre tras recibir TIFs |
| **Endpoints en Vivo**| Rol 1 (Tú) | Rol 4 (Front) | `POST /api/custom-site` | ✅ Listo |
| **Contrato Técnico** | Rol 1 (Tú) | Todo el equipo | `docs/CONTRATO_ESPECIFICACIONES.md` | ✅ Listo |
