# 🚀 AstroTeam - Backend de Exploración Lunar

Backend de alta precisión para el cálculo de efemérides lunares, orientación selenográfica, perfiles de horizonte topográfico y visibilidad/cuentas regresivas de iluminación solar y línea de vista directa (LOS) con la Tierra.

---

## 📁 Estructura del Proyecto

```text
backend/
├── data/
│   ├── de421.bsp                  # Efemérides JPL (se descarga automático con Skyfield)
│   └── preset_sites.json          # Datos precalculados de los 6 sitios estrella
├── app/
│   ├── __init__.py
│   ├── main.py                    # Endpoints de FastAPI y configuración CORS
│   ├── schemas.py                 # Modelos Pydantic (contratos de datos para el frontend)
│   ├── ephemeris.py               # Lógica astronómica con Skyfield (Sol, Tierra, libración)
│   └── terrain.py                 # Perfil de horizonte lunar y cálculo de visibilidad/cuentas regresivas
├── scripts/
│   └── generate_presets.py        # Script para precalcular los sitios destacados en JSON
├── requirements.txt
└── README.md
```

---

## 🌌 Los 6 Sitios Estrella Precalculados

1. **Borde del Cráter Shackleton (`shackleton-rim`)**: Polo Sur Lunar (-89.90°, 0.00°). Iluminación solar pico cuasi-continua y cráteres interiores en sombra permanente (PSR) con depósitos de hielo de agua. Región clave del programa Artemis.
2. **Montaña Malapert (`malapert-massif`)**: Macizo polar (-85.99°, 2.91°). Cumbre a 5,000 m de elevación con línea de visión ininterrumpida hacia la Tierra, idónea para antenas repetidoras de telecomunicaciones lunares.
3. **Cresta de Conexión (`connecting-ridge`)**: Zona polar (-89.44°, 222.00°). Corredor de tránsito entre Shackleton y de Gerlache para rovers de superficie.
4. **Borde del Cráter Faustini (`faustini-rim`)**: Zona polar sur (-87.30°, 77.00°). Gradientes térmicos extremos y estudio de volátiles atrapados en regolito.
5. **Apolo 11 (`apollo-11`)**: Statio Tranquillitatis (0.67408°N, 23.47297°E). Sitio histórico del primer alunizaje humano en el Mar de la Tranquilidad con ciclo diurno de ~29.5 días terrestres.
6. **Océano de las Tormentas (`oceanus-procellarum`)**: Llanura basáltica occidental (18.00°N, -64.00°O). Referencia ecuatorial/intermedia frente a las condiciones extremas de los polos lunares.

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

## 🔄 Regenerar Datos Precalculados (`preset_sites.json`)

Para recalcular o actualizar el archivo `data/preset_sites.json` con las posiciones celestes en tiempo real:

```bash
python scripts/generate_presets.py
```

---

## 📡 Endpoints de la API

### 1. `GET /`
Health check y metadatos del servicio.

### 2. `GET /api/sites`
Retorna el listado de los 6 sitios estrella con su información básica, coordenadas selenográficas y perfil base de horizonte.

### 3. `GET /api/sites/{site_id}`
Retorna el estado astronómico y de visibilidad en tiempo real para el sitio solicitado.
- **Parámetros opcionales**: `timestamp_utc` (ej. `?timestamp_utc=2026-11-14T12:00:00Z`).
- **Respuesta**:
  - Coordenadas topocéntricas del Sol (`azimuth_deg`, `elevation_deg`, `is_above_terrain_horizon`).
  - Coordenadas topocéntricas de la Tierra (azimut, elevación, línea de vista directa LOS).
  - Datos de libración selenográfica (punto sub-terrestre, punto sub-solar, ángulo de fase de la Tierra).
  - Cuentas regresivas (`seconds_to_sunrise`, `seconds_to_sunset`, timestamp UTC de próximo amanecer y atardecer).
  - Perfil de horizonte en 36 acimuts.

### 4. `GET /api/sites/{site_id}/timeline`
Genera una serie temporal predictiva ideal para gráficas interactivas en el frontend.
- **Parámetros**:
  - `hours`: Número de horas a proyectar (por defecto 48, hasta 720 h / 30 días).
  - `step_hours`: Intervalo entre puntos (por defecto 2.0 h).
  - `start_time_utc`: Fecha/hora de inicio opcional.

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
