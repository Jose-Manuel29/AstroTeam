# 🚀 AstroTeam - Backend de Exploración Lunar

Backend de alta precisión para el cálculo de efemérides lunares, orientación selenográfica, perfiles de horizonte topográfico y visibilidad/cuentas regresivas de iluminación solar y línea de vista directa (LOS) con la Tierra.

---

## 📁 Estructura del Proyecto

```text
backend/
├── data/
│   ├── de421.bsp                  # Efemérides JPL (se descarga automático con Skyfield)
│   └── analysis_sites.csv         # Puntos usados para extraer elevaciones y perfiles DEM
├── app/
│   ├── __init__.py
│   ├── main.py                    # Endpoints de FastAPI y configuración CORS
│   ├── schemas.py                 # Modelos Pydantic (contratos de datos para el frontend)
│   ├── ephemeris.py               # Lógica astronómica con Skyfield (Sol, Tierra, libración)
│   └── terrain.py                 # Perfil de horizonte lunar y cálculo de visibilidad/cuentas regresivas
├── scripts/
│   ├── extract_dem_profiles.py    # Extrae elevaciones y perfiles de horizonte del DEM LOLA
│   ├── sync_horizons.py           # Sincroniza efemérides horarias JPL a Supabase
│   └── generate_presets.py        # Legado: genera datos sintéticos, no usar en producción
├── requirements.txt
└── README.md
```

---

## 🌌 Seis sitios de análisis

Estos son los IDs y puntos de análisis proporcionados para las consultas de Horizons. Las longitudes están en grados Este (0–360°). No implican que el punto sea un lugar de aterrizaje ya validado.

| ID canónico | Punto de análisis | Latitud | Longitud E | Elevación DEM |
|---|---|---:|---:|---:|
| `shackleton-rim` | Borde del cráter Shackleton | -89.684° | 196.74° | +1.725 km (80 m/píxel) |
| `malapert-massif` | Macizo Malapert | -85.964° | 357.68° | +4.990 km (80 m/píxel) |
| `connecting-ridge` | Connecting Ridge | -89.457° | 222.51° | +1.947 km (80 m/píxel) |
| `faustini-rim` | Interior del cráter Faustini; se conserva el ID | -87.300° | 84.30° | -2.715 km (80 m/píxel) |
| `schrodinger-basin` | Cuenca Schrödinger | -75.000° | 132.40° | -4.640 km (120 m/píxel) |
| `drygalski-crater` | Cráter Drygalski | -79.570° | 272.82° | -3.176 km (120 m/píxel) |

Las elevaciones y los perfiles se extrajeron bilinealmente de los GeoTIFFs LOLA usando el radio lunar de 1,737.4 km y altura de observador de 0 m. Faustini es un punto interior que conserva el ID `faustini-rim` por compatibilidad. Los resultados se consideran los datos definitivos del proyecto; el perfil de Drygalski alcanza 24.5472° hacia el azimut 78°.

---

## 🛠️ Instalación y Requisitos

### Prerrequisitos
- Python 3.10 o superior (recomendado Python 3.12).
- Gestor de paquetes `pip`.

### 1. Crear y activar entorno virtual (recomendado)

En Windows (PowerShell):
```powershell
cd C:\xampp\nasa\AstroTeam\backend
python -m venv venv
.\venv\Scripts\Activate.ps1
```

En Linux / macOS:
```bash
cd AstroTeam/backend
python3 -m venv venv
source venv/bin/activate
```

### 2. Instalar dependencias
```bash
pip install -r requirements.txt
```

---

## ⚡ Ejecución del Servidor Backend

Configura las variables de entorno de Supabase antes de iniciar la API. En PowerShell:

```powershell
$env:SUPABASE_URL = "https://<project-ref>.supabase.co"
$env:SUPABASE_KEY = "<publishable-key>"
```

No escribas la clave en el código ni la envíes desde el frontend. Las tablas `lunar_sites` y
`site_cronograma` deben existir y permitir las lecturas a través de las políticas/permisos de
Supabase. El backend usa estas variables para consultar la API REST de Supabase.

Para iniciar la API en modo de desarrollo con recarga automática:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Una vez levantado el servidor:
- **API Base**: `http://localhost:8000`
- **Documentación Interactiva Swagger UI**: `http://localhost:8000/docs`
- **Documentación ReDoc**: `http://localhost:8000/redoc`

---

## 🪐 Efemérides JPL (`de421.bsp`)

El archivo de efemérides planetarias de la NASA/JPL `de421.bsp` (~17 MB) se descarga de forma automática en la carpeta `data/` al iniciar la aplicación cuando Skyfield realiza su primera consulta. 

Si deseas descargarlo manualmente con antelación:
```bash
python -c "from skyfield.api import Loader; Loader('data')('de421.bsp')"
```
*Nota: `data/*.bsp` está ignorado en `.gitignore` para no saturar el repositorio de Git con binarios pesados.*

---

## 🔄 Flujo DEM + JPL Horizons → Supabase

El flujo de producción usa los GeoTIFF LOLA y JPL Horizons; no usa el JSON de compañero como
fuente de cronogramas.

1. Los seis sitios y coordenadas se definen en `data/analysis_sites.csv`. El extractor escribe
   `datos/dem_site_elevations.csv` y un perfil de 360 azimuts por sitio. Cada perfil incluye
   `site_id`, `azimuth_deg` y `elevation_deg`.
2. `scripts/generate_horizons_data.py` consulta el Sol y la Tierra a JPL con altitud DEM final,
   genera 720 horas por sitio y guarda `datos/horizons_timeline.csv`. El archivo actual cubre
   2026-11-15 08:00 UTC a 2026-12-15 07:00 UTC.
3. `scripts/generate_supabase_setup_sql.py --overwrite` combina la migración, el catálogo,
   los perfiles y el cronograma en `datos/supabase_horizons_setup.sql`. Ejecuta ese archivo
   completo una vez desde el SQL Editor de Supabase. Usa upserts y no elimina filas.
4. El SQL agrega los campos de visibilidad del disco, la tabla `site_horizon_profile`, índice
   único por sitio/hora y políticas de lectura; después carga los seis sitios, 2,160 puntos de
   perfil y 4,320 puntos horarios. Los porcentajes del catálogo resumen la ventana de 30 días.
5. Para volver a sincronizar desde el backend con `scripts/sync_horizons.py`, configura
   `SUPABASE_URL`, `SUPABASE_KEY` y `SUPABASE_SERVICE_ROLE_KEY` en `backend/.env`. La clave de
   servicio es solo del backend; no se usa en el frontend. Para la carga inicial basta con
   ejecutar el SQL en Supabase.
6. FastAPI consulta Supabase. El frontend debe descargar el timeline una vez al seleccionar
   un sitio y recorrer los puntos en memoria; no consulta Horizons ni Supabase al mover el slider.

Las banderas heredadas `sol_estado_luz` y `linea_vista_directa` evalúan el centro del disco.
El timeline también incluye `sol_parte_visible` / `tierra_parte_visible` (cualquier parte del
disco supera el perfil) y `sol_disco_completo_visible` / `tierra_disco_completo_visible`
(disco completo despejado). Los radios del Sol y la Tierra se comparan con la distancia
topocéntrica devuelta por Horizons. Los estados/cuentas regresivas de `/api/sites/{site_id}`
mantienen sus transiciones basadas en el centro; sus objetos `sun` y `earth` exponen también
`is_any_part_visible` e `is_full_disk_visible`.

El SQL de carga inicial se puede regenerar tras actualizar los datos locales:

```powershell
python scripts/generate_horizons_data.py --start-utc 2026-11-15T08:00:00Z --days 30 --overwrite
python scripts/generate_supabase_setup_sql.py --overwrite
```

Ejecuta `datos/supabase_horizons_setup.sql` completo en Supabase SQL Editor. La clave pública
permite lecturas de FastAPI; las escrituras posteriores desde `sync_horizons.py` o
`seed_supabase_dem.py` requieren `SUPABASE_SERVICE_ROLE_KEY` en el entorno privado del backend.

   ### Elevaciones y perfiles desde los GeoTIFF LOLA

   Los archivos `LDEM_60S_120MPP_ADJ.tiff` y `LDEM_80S_80MPP_ADJ.tiff` deben estar en
   `backend/raw_data/`. Ejecuta desde `backend/`:

   ```powershell
   python scripts/extract_dem_profiles.py
   ```

   El script usa la resolución de 80 m al sur de 80°S y el DEM de 120 m para el resto,
   aplica interpolación bilineal al terreno, muestrea el observador a 0 m sobre el terreno
   y calcula un perfil cada 1° de azimut hasta 250 km, considerando la curvatura lunar.
   Escribe `datos/dem_site_elevations.csv` y un CSV de horizonte por sitio con `site_id`,
   `azimuth_deg` y `elevation_deg`. No modifica Supabase. Para reemplazar esos CSVs después de
   cambiar coordenadas o altura, usa `--overwrite`.

`scripts/import_teammate_data.py` es un generador SQL heredado para el formato JSON anterior;
no forma parte del flujo JPL ni es necesario para la carga final. El antiguo
`scripts/generate_presets.py` y sus archivos de salida contienen perfiles sintéticos/datos
anteriores: no los uses como fuente, no ejecutes su SQL ni los tomes como datos científicos.
Los datos nuevos no se han cargado automáticamente ni se ha aplicado la migración remota.

---

## 📡 Endpoints de la API

### 1. `GET /`
Health check y metadatos del servicio.

### 2. `GET /api/sites`
Retorna las filas de `lunar_sites` en Supabase.

### 3. `GET /api/sites/{site_id}`
Lee el sitio desde `lunar_sites` y calcula su estado astronómico para la fecha solicitada.
- **Parámetros opcionales**: `timestamp_utc` (ej. `?timestamp_utc=2026-11-14T12:00:00Z`).
- Usa el perfil topográfico del sitio almacenado en `site_horizon_profile`. Responde con error
  explícito si falta un perfil válido; no lo reemplaza por uno sintético.
- **Respuesta**:
  - Coordenadas topocéntricas del Sol (`azimuth_deg`, `elevation_deg`, `is_above_terrain_horizon`).
  - Coordenadas topocéntricas de la Tierra (azimut, elevación, línea de vista directa LOS).
  - En ambos objetos, `is_any_part_visible` y `is_full_disk_visible` usan el tamaño aparente del disco.
  - Datos de libración selenográfica (punto sub-terrestre, punto sub-solar, ángulo de fase de la Tierra).
  - Cuentas regresivas (`seconds_to_sunrise`, `seconds_to_sunset`, timestamp UTC de próximo amanecer y atardecer).
  - Perfil topográfico guardado en Supabase.

### 4. `GET /api/sites/{site_id}/timeline`
Lee el cronograma existente en `site_cronograma`, ordenado por `fecha_hora`. El endpoint carga los
puntos de una sola vez para que el frontend pueda mantenerlos en memoria mientras se mueve el slider.
- **Parámetros**:
  - Sin filtros, retorna todos los puntos del sitio (hasta el límite de 1000 filas).
  - `start_time_utc`, `hours` y `step_hours` son filtros opcionales.
  - Devuelve los estados de centro, visibilidad parcial y disco completo para Sol y Tierra.

### 5. `POST /api/custom-site`
Calcula en tiempo real los parámetros astronómicos y visibilidad para cualquier coordenada personalizada en la Luna.
- **Body JSON**:
  ```json
  {
    "lat": -88.5,
    "lon": 12.0,
    "elevation_m": 1500.0,
    "default_horizon_elevation_deg": 1.5
  }
  ```

### 6. `GET /api/libration`
Retorna la libración lunar física y óptica actual, así como las distancias Luna-Tierra y Luna-Sol.

---

## 🛰️ Integración con el Frontend (CORS)

El backend tiene configurado `CORSMiddleware` con permisos completos (`allow_origins=["*"]`) para facilitar la conexión inmediata con aplicaciones frontend en React, Next.js, Vue o Vite corriendo en `http://localhost:3000`, `http://localhost:5173`, etc.
