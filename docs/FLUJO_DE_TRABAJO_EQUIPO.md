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
| **Rol 4** | **Compañero Frontend** | Vite, React, Three.js, slider de línea de tiempo y paneles analíticos. | Dashboard web responsivo conectado a FastAPI y listo para desplegar en Vercel. |

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
 │  (Three.js / React Canvas)  │ │     (Vite / React UI)       │
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
El catálogo y los cronogramas viven en Supabase. La aplicación final no lee el JSON del compañero.

1. Los seis IDs y coordenadas se encuentran en `backend/data/analysis_sites.csv`. Los DEMs LOLA ya están en `backend/raw_data/`; Faustini se conserva como punto interior con el ID histórico `faustini-rim`.
2. Desde `backend/`, el extractor produce `datos/dem_site_elevations.csv` y un perfil de 360 azimuts por sitio:
   ```powershell
   .\venv\Scripts\python.exe scripts\extract_dem_profiles.py --overwrite
   ```
   Usa interpolación bilineal, 0 m de altura de observador y curvatura lunar.
3. El cronograma de 30 días ya se generó desde JPL Horizons, con altitudes DEM y paso horario: `backend/datos/horizons_timeline.csv` (15-nov-2026 08:00 UTC a 15-dic-2026 07:00 UTC; 720 puntos por sitio).
4. El SQL completo se genera con:
   ```powershell
   .\venv\Scripts\python.exe scripts\generate_supabase_setup_sql.py --overwrite
   ```
   Abre `backend/datos/supabase_horizons_setup.sql` y ejecuta su contenido completo en el SQL Editor de Supabase. Es idempotente y no elimina filas: aplica la migración y carga seis sitios, 2,160 puntos de horizonte y 4,320 puntos horarios. La consulta debe ejecutarse después de que existan las tablas base `lunar_sites` y `site_cronograma`.
5. Para comprobar la carga en Supabase, espera 6 sitios, 360 perfiles por sitio y 720 filas de cronograma por sitio:
   ```sql
   SELECT count(*) AS sitios FROM public.lunar_sites;
   SELECT site_id, count(*) AS puntos
   FROM public.site_horizon_profile GROUP BY site_id ORDER BY site_id;
   SELECT site_id, count(*) AS puntos
   FROM public.site_cronograma
   WHERE fecha_hora >= TIMESTAMPTZ '2026-11-15 08:00:00+00'
     AND fecha_hora <= TIMESTAMPTZ '2026-12-15 07:00:00+00'
   GROUP BY site_id ORDER BY site_id;
   ```
6. Después de la carga, inicia FastAPI desde `backend/`:
   ```powershell
   .\venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
   ```
   Prueba `GET http://localhost:8000/api/sites` y `GET http://localhost:8000/api/sites/shackleton-rim/timeline`; el segundo debe devolver 720 puntos. El archivo `backend/.env` contiene la clave pública para lecturas. El SQL Editor realiza la carga inicial; `SUPABASE_SERVICE_ROLE_KEY` solo se necesita si luego ejecutas `scripts/seed_supabase_dem.py` o `scripts/sync_horizons.py` para escribir desde Python. Nunca la pongas en Vercel.
7. El frontend activo está únicamente en `frontend/` (Vite + React); se eliminaron los archivos duplicados de `src/` en la raíz y los datos estáticos de sitios que ya no se usan.
8. Al iniciar, el frontend consulta `GET /api/sites`. Al abrir o cambiar de sitio consulta una vez `GET /api/sites/{id}/timeline` y conserva los puntos en memoria. El slider recorre esos puntos sin enviar solicitudes por cada movimiento.
9. `SiteDetailView` muestra los datos disponibles del timeline: hora UTC, azimut/elevación del Sol y la Tierra, visibilidad, distancia, RTT y fase. La iluminación y el vector a la Tierra siguen la muestra seleccionada. Los valores que la API no provee (por ejemplo, batería, pendiente o producción eléctrica) se muestran como `N/D`, no como mediciones.

Las banderas actuales distinguen los tres criterios del disco: `sol_estado_luz` / `linea_vista_directa` evalúan el centro; `sol_parte_visible` / `tierra_parte_visible` indican que asoma cualquier parte; y `sol_disco_completo_visible` / `tierra_disco_completo_visible` indican que el disco entero supera el horizonte. `earth_latency_rtt_sec` es ida y vuelta; la base guarda latencia unidireccional.

Los generadores antiguos [`import_teammate_data.py`](../backend/scripts/import_teammate_data.py) y `generate_presets.py` no se usan como fuente de datos del frontend. La conexión local se verificó: `GET /api/sites` devuelve 6 sitios y el timeline de cada sitio devuelve 720 puntos. El build de producción de Vite también termina correctamente; queda una advertencia de bundle JavaScript grande que no impide compilar.

**Pendiente para publicar:** desplegar FastAPI y el frontend. En Vercel se debe usar `frontend/` como *Root Directory* y configurar `VITE_API_BASE_URL` con la URL pública de FastAPI. No se debe subir una clave `service_role` al frontend.

---

### Paso 3: Coordinación con el Compañero de Extracción de Datos
1. Los dos GeoTIFFs LOLA ya están en `backend/raw_data/` y se procesaron. El mosaico `wac_mosaic.tif` aún no está; solo hace falta para generar texturas visuales, no para el backend de Horizons.
2. Para volver a calcular perfiles y elevaciones, ejecutar desde `backend/`:
     ```powershell
     .\venv\Scripts\python.exe scripts\extract_dem_profiles.py --overwrite
     ```
     El script genera CSVs bajo `backend/datos/`; no escribe en Supabase. Para actualizar luego Horizons y el SQL de carga, ejecutar `scripts/generate_horizons_data.py` y `scripts/generate_supabase_setup_sql.py`.
3. Para producir texturas 3D, primero descargar el mosaico WAC; después ejecutar el pipeline GDAL:
     ```powershell
     cd C:\xampp\nasa\AstroTeam\backend
     python gdal_pipeline/process_terrain.py
     ```
     Esto producirá en `output/textures/`:
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

### Paso 5: Despliegue del Backend FastAPI (Pendiente)
Para permitir que los evaluadores seleccionen cualquier punto libre de la Luna:
1. **Prueba local**:
   ```powershell
   cd C:\xampp\nasa\AstroTeam\backend
   .\venv\Scripts\Activate.ps1
   uvicorn app.main:app --reload --port 8000
   ```
   - Entra a [http://localhost:8000/docs](http://localhost:8000/docs) y ejecuta una prueba en `POST /api/custom-site`.
2. **Despliegue en la nube**:
   - Conecta el repositorio de GitHub a un servicio gratuito como [Render.com](https://render.com/) o [Railway.app](https://railway.app/).
   - Comando de inicio (*Start command*):
     ```bash
     uvicorn app.main:app --host 0.0.0.0 --port $PORT
     ```
   - Configura las variables de Supabase en el servicio del backend. Luego configura `VITE_API_BASE_URL` en Vercel con la URL pública de esta API.

---

## ⏱️ 4. Matriz Rápida de Entradas y Salidas

| Hito | Emisor | Receptor | Archivo / Recurso | Estado |
| :--- | :--- | :--- | :--- | :--- |
| **Modelo relacional** | Rol 1 (Tú) | Supabase | Migración y seed en `backend/datos/supabase_horizons_setup.sql` | ✅ SQL ejecutado; lecturas locales comprobadas |
| **Conexión FastAPI-Supabase** | Rol 1 (Tú) | Supabase | Catálogo, perfiles y timeline | ✅ Endpoints locales comprobados |
| **Metadatos y perfiles reales de 6 sitios** | Rol 1 (Tú) | DEM → Supabase | 6 sitios y 2,160 puntos listos localmente | ✅ CSVs y SQL listos |
| **Cronograma JPL horario (30 días)** | Rol 1 (Tú) | Horizons → Supabase | 4,320 puntos generados | ✅ CSV y SQL listos |
| **Slider y paneles conectados** | Rol 4 (Front) | FastAPI | Timeline en memoria; hora, Sol/Tierra, visibilidad y telemetría disponible | ✅ Integrado y probado localmente |
| **Variables de entorno y RLS de producción** | Rol 1 (Tú) | Backend / Supabase | URL pública de FastAPI para Vercel; secretos solo en el backend | ⏳ Configurar al desplegar; no publicar la clave privada |
| **GeoTIFFs Crudos** | Rol 2 (Datos) | Rol 1 (Tú) | Dos DEM LOLA en `raw_data/` | ✅ Descargados y procesados |
| **Texturas 3D** | Rol 1 (Tú) | Rol 3 (3D) | `output/textures/displacement_lola_2k.png` | ⏳ Falta el mosaico WAC |
| **Endpoints consumidos por el frontend** | Rol 1 (Tú) | Rol 4 (Front) | `GET /api/sites` y `GET /api/sites/{id}/timeline` | ✅ Probados localmente |
| **Contrato Técnico** | Rol 1 (Tú) | Todo el equipo | `docs/CONTRATO_ESPECIFICACIONES.md` | ✅ Listo |
