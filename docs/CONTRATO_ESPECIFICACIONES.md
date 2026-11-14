# 📜 Contrato de Especificaciones Técnicas y Entregables del Backend

**Reto**: NASA Space Apps Challenge 2026 - Misiones al Polo Sur de la Luna  
**Rol del Propietario**: Rol 1 - Especialista en Datos Orbitales y Backend  
**Destinatarios**: Rol 2 (Arquitecto 3D / Three.js) y Rol 3 (Desarrollador UI/UX)  
**Versión**: 2.1.0 (Actualizada para Sprint de 48 Horas con Guía de Recreación del Entorno)  

---

## 🎯 1. Propósito y Estrategia de Entrega

Para asegurar el éxito del equipo sin cuellos de botella y garantizar **cero lag** en la presentación (pitch de 2 minutos), el **Rol 1** entrega una arquitectura **híbrida y redundante**:

1. **Modo Estático Precalculado (Prioritario para Vercel)**:
   - Archivos JSON listos en `backend/output/` para ser consumidos directamente como archivos estáticos en `public/data/` por el Frontend Next.js.
   - Texturas científicas procesadas en `backend/output/textures/` (DEM PNG y Skin WEBP) para Three.js.
2. **Modo Dinámico / Servidor (FastAPI)**:
   - Servicio REST en `backend/app/main.py` para evaluación en tiempo real de coordenadas lunares arbitrarias (`/api/custom-site`) y series temporales dinámicas (`/api/sites/{id}/timeline`).

---

## 📁 2. Estructura Oficial del Espacio de Datos y Backend

```text
AstroTeam/
└── backend/                       # ESPACIO DEL ROL 1: Motor Orbital & Pipeline
    ├── app/                       # Microservicio FastAPI
    │   ├── __init__.py
    │   ├── main.py                # Endpoints REST y CORS
    │   ├── schemas.py             # Contratos Pydantic v2
    │   ├── ephemeris.py           # Skyfield DE421 + IAU 2015 WGCCRE
    │   └── terrain.py             # Máscaras de horizonte y cuentas regresivas
    ├── scripts/                   
    │   └── generate_presets.py    # Script generador (exporta a output/ y auto-sincroniza)
    ├── gdal_pipeline/             # Pipeline científico de texturas de terreno
    │   ├── process_terrain.py     # Script CLI automatizado en Python
    │   ├── commands.sh            # Comandos de bash para Linux/macOS
    │   └── process_dem.ps1        # Script PowerShell para Windows
    ├── raw_data/                  # (En .gitignore) GeoTIFFs masivos de Moon Trek (LOLA / LROC)
    │   └── .gitkeep
    ├── output/                    # ENTREGABLES LISTOS PARA EL FRONTEND (Subir a Git)
    │   ├── .gitkeep
    │   ├── preset_sites.json      # JSON precalculado con los 6 sitios estrella
    │   └── textures/              # Texturas procesadas (PNG 8-bit y WEBP)
    ├── data/                      # Caché local y efemérides JPL
    │   ├── .gitkeep
    │   ├── de421.bsp              # Efemérides JPL auto-descargadas (en .gitignore)
    │   └── preset_sites.json
    ├── .gitignore                 # Reglas estrictas: ignora raw_data/, *.bsp, *.tif
    ├── requirements.txt           # Dependencias Python
    ├── README.md                  # Guía de ejecución del backend
    └── CONTRATO_ESPECIFICACIONES.md # Este documento
```

---

## 🛠️ 3. Guía Paso a Paso: Cómo Recrear y Levantar el Entorno del Backend

Cualquier miembro del equipo o evaluador puede clonar el repositorio y levantar el backend idénticamente en cualquier computadora (Windows, Mac o Linux) siguiendo estos pasos:

### Paso 1: Prerrequisitos
- **Python 3.10 o superior** (Recomendado 3.12). Verificar en la terminal:
  ```bash
  python --version   # En Windows
  python3 --version  # En Linux / macOS
  ```
- **Git** instalado.

### Paso 2: Clonar y navegar a la carpeta del backend
```bash
git clone https://github.com/Jose-Manuel29/AstroTeam.git
cd AstroTeam/backend
```

### Paso 3: Crear el entorno virtual (`venv`)
Aísla las dependencias para evitar conflictos con otras librerías del sistema:
- **En Windows (PowerShell o CMD)**:
  ```powershell
  python -m venv venv
  ```
- **En Linux / macOS**:
  ```bash
  python3 -m venv venv
  ```

### Paso 4: Activar el entorno virtual
- **En Windows PowerShell**:
  ```powershell
  .\venv\Scripts\Activate.ps1
  ```
  *(Si PowerShell bloquea la ejecución de scripts, ejecuta una vez: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`)*
- **En Windows CMD**:
  ```cmd
  venv\Scripts\activate.bat
  ```
- **En Linux / macOS**:
  ```bash
  source venv/bin/activate
  ```
*(Aparecerá el prefijo `(venv)` en tu consola indicando que el entorno está activo).*

### Paso 5: Instalar las dependencias del proyecto
Con el `(venv)` activo, ejecuta:
```bash
pip install --upgrade pip
pip install -r requirements.txt
```
Dependencias instaladas: `fastapi`, `uvicorn[standard]`, `pydantic`, `skyfield`, `numpy`, `scipy`, `python-dateutil`, `requests`.

### Paso 6: Generar los JSONs precalculados (Efemérides y Sitios)
Ejecuta el script de cálculo astronómico para generar `output/preset_sites.json` y la caché local:
```bash
python scripts/generate_presets.py
```
> **Descarga automática de JPL (`de421.bsp`)**: La librería `skyfield` descarga automáticamente las efemérides planetarias de la NASA (~17 MB) a la carpeta `data/de421.bsp` en la primera ejecución. Está excluida de Git para no sobrecargar el repositorio.

### Paso 7: Iniciar el servidor local de FastAPI
Para encender el servidor con recarga en vivo (*hot-reload*):
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Paso 8: Comprobación y Swagger UI
Abre tu navegador en:
- **Swagger UI (Interactiva)**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc (Documentación técnica)**: [http://localhost:8000/redoc](http://localhost:8000/redoc)
- **Endpoint de Salud**: [http://localhost:8000/](http://localhost:8000/)

### Paso 9 (Opcional): Recrear las texturas 3D con GDAL
Si el equipo descarga nuevos GeoTIFFs de NASA Moon Trek a `raw_data/`:
- **En Windows (PowerShell)**:
  ```powershell
  .\gdal_pipeline\process_dem.ps1
  ```
- **En Linux / macOS / Bash**:
  ```bash
  bash gdal_pipeline/commands.sh
  ```
- **Vía script Python CLI**:
  ```bash
  python gdal_pipeline/process_terrain.py
  ```

---

## 🗺️ 4. Pipeline de Texturas Científicas (GDAL) para el Rol 2 (Three.js)

Para que el modelo 3D del terreno polar en **React Three Fiber** no sufra lag ni distorsiones geométricas, el Rol 1 procesa los GeoTIFFs científicos de **NASA Moon Trek** bajo las siguientes especificaciones:

### 4.1. Criterios de Selección de Datos
- **Proyección Cartográfica**: Estereográfica Polar Sur (*South Pole Stereographic*).
- **Mapa de Elevación (DEM)**: `LRO LOLA DEM, 75 deg v4, S Pole` (relieve puro en escala de grises, sin sombras "Hillshade" falsas).
- **Mapa Visual (Skin / Color)**: `LRO WAC Mosaic, S Pole v2` (albedo uniforme que permite a Three.js calcular las sombras reales con luces direccionales).

### 4.2. Reglas Estrictas de Conversión
1. **DEM (Mapa de Desplazamiento)**:
   - Formato: **PNG de 8-bits en escala de grises**.
   - Normalización matemática: bandera `-scale` para asignar la cota mínima a `0` (negro) y la máxima a `255` (blanco).
   - **REGLA CRÍTICA**: Nunca usar compresión con pérdida (WEBP o JPG) para el DEM, ya que los bloques de compresión generan "escalones o terrazas" deformes en la malla 3D.
   - Comando ejecutado:
     ```bash
     gdal_translate -of PNG -outsize 2048 2048 -scale raw_data/lola_dem.tif output/textures/displacement_lola_2k.png
     ```

2. **Skin (Textura Visual)**:
   - Formato: **WEBP** comprimido con calidad 80%.
   - Comando ejecutado:
     ```bash
     gdal_translate -of WEBP -outsize 2048 2048 -co "QUALITY=80" raw_data/wac_mosaic.tif output/textures/skin_wac_2k.webp
     ```

3. **Sincronización Geométrica**:
   - Ambos mapas se recortan con el **mismo tamaño de píxel (ej. 2048x2048)** y el mismo Bounding Box (`-projwin ulx uly lrx lry`) para que la textura visual y el relieve encajen a la perfección vértice por vértice.

---

## 📊 5. Contratos de Datos JSON para los Roles 2 y 3

### 5.1. Ubicación de Consumo
El Frontend puede leer el JSON de efemérides de dos formas:
- **Estática (Recomendada)**: Copiado a `public/data/preset_sites.json` y consumido mediante:
  ```typescript
  const res = await fetch("/data/preset_sites.json");
  const data = await res.json();
  ```
- **Dinámica (API FastAPI)**: Petición HTTP a `http://localhost:8000/api/sites/{id}`.

### 5.2. Estructura del JSON de Efemérides (`preset_sites.json`)

```json
{
  "metadata": {
    "generated_at": "2026-11-14T18:07:40.018617+00:00",
    "count": 6,
    "libration_snapshot": {
      "sub_earth_lat": 3.528,
      "sub_earth_lon": -1.809,
      "sub_solar_lat": -1.557,
      "sub_solar_lon": 117.802,
      "earth_distance_km": 405088.7,
      "sun_distance_au": 0.98932,
      "earth_phase_angle_deg": 119.65
    },
    "ephemeris_engine": "Skyfield DE421 + IAU 2015 WGCCRE Lunar Frame"
  },
  "sites": [
    {
      "id": "shackleton-rim",
      "name": "Borde del Cráter Shackleton",
      "category": "Polo Sur / Candidato Artemis",
      "lat": -89.90,
      "lon": 0.00,
      "elevation_m": 4200.0,
      "description": "Pico de alta iluminación con cráteres en sombra permanente (PSR).",
      "default_horizon_elevation_deg": 2.2,
      "horizon_profile": [
        {"azimuth": 0.0, "elevation_deg": 2.8},
        {"azimuth": 10.0, "elevation_deg": 3.12},
        {"azimuth": 350.0, "elevation_deg": 2.41}
      ]
    }
  ]
}
```

---

## 🕹️ 6. Integración con Three.js y UI (Roles 2 y 3)

### Para el Rol 2 (Arquitecto 3D):
1. **Luz Solar Dinámica**:
   - Con el acimut y la elevación solar:
     $$\text{Posición Luz Directional} = (R \cos(\text{elev}) \sin(\text{azim}), R \sin(\text{elev}), -R \cos(\text{elev}) \cos(\text{azim}))$$
   - En el Polo Sur, cuando $\text{elevación} \approx 1.5^\circ$, Three.js proyectará sombras largas y realistas sobre las montañas de Shackleton y Malapert.
2. **Vector de Comunicaciones con la Tierra (Direct-to-Earth LOS)**:
   - Con el acimut y la elevación de la Tierra, se dibuja un rayo / vector 3D hacia el cielo lunar.
   - Si `is_above_terrain_horizon === true`, se dibuja verde (Enlace activo). Si es `false`, se dibuja rojo (Bloqueo orográfico).

### Para el Rol 3 (UI/UX y Modos de Usuario):
1. **Slider Temporal**:
   - Al mover el slider de tiempo, el Frontend consulta la serie temporal (`timeline`) y actualiza instantáneamente:
     - El porcentaje de iluminación del sitio.
     - Los segundos restantes para el amanecer/atardecer.
     - El ángulo de orientación de la luz 3D en la escena.
2. **Filtros Dinámicos**:
   - Slider de "Criterio de Iluminación Mínima" (ej. > 70% de luz).
   - Slider de "Pendiente Máxima Aceptable" (ej. < 15° para rovers).
3. **Modos de Usuario**:
   - **Nivel 1 (Educador/Público)**: Muestra insignias sencillas ("☀️ Iluminado", "🟢 Señal con la Tierra disponible", "⏳ Amanecer en 3 días").
   - **Nivel 2 (Ingeniero Artemis)**: Muestra azimut/elevación en grados con 3 decimales, telemetría de distancias en km y perfiles de máscara topográfica.

---

## 📡 7. Catálogo de Endpoints de FastAPI (`app/main.py`)

| Método | Endpoint | Entrada | Salida | Propósito |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/` | Ninguna | JSON | Health Check y estado del motor orbital |
| `GET` | `/api/sites` | Ninguna | `List[PresetSite]` | Lista de los 6 sitios estrella |
| `GET` | `/api/sites/{id}` | `timestamp_utc` (opcional) | `SiteStatusResponse` | Estado topocéntrico y cuentas regresivas en tiempo real |
| `GET` | `/api/sites/{id}/timeline` | `hours`, `step_hours` | `SiteTimelineResponse` | Serie temporal predictiva para gráficas de curvas solares |
| `POST` | `/api/custom-site` | `CustomSiteRequest` | `SiteStatusResponse` | Evaluación en vivo de cualquier coordenada lunar `(lat, lon)` |
| `GET` | `/api/libration` | `timestamp_utc` (opcional) | `LibrationData` | Coordenadas sub-solar, sub-terrestre y ángulo de fase |

---

## ✅ 8. Estado del Entregable del Rol 1

- [x] Motor de efemérides y orientación selenográfica (`app/ephemeris.py`).
- [x] Motor de horizonte y cuentas regresivas de amanecer/atardecer (`app/terrain.py`).
- [x] Microservicio FastAPI con CORS habilitado (`app/main.py`).
- [x] Base de datos JSON precalculada de los 6 sitios estrella (`output/preset_sites.json`).
- [x] Script de generación y auto-sincronización (`scripts/generate_presets.py`).
- [x] Pipeline automatizado de procesamiento GDAL (`gdal_pipeline/`).
- [x] Carpeta `raw_data/` con `.gitignore` estricto para evitar subir TIFs gigantes al repositorio.
- [x] Guía paso a paso para recrear el entorno desde cero agregada a la sección 3.
- [x] Contrato técnico actualizado y documentado.
