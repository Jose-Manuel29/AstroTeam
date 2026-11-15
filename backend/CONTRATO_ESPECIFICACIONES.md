# 📜 Contrato de Especificaciones Técnicas y Entregables del Backend

**Reto**: NASA Space Apps Challenge 2026 - Misiones al Polo Sur de la Luna  
**Rol del Propietario**: Rol 1 - Especialista en Datos Orbitales y Backend  
**Destinatarios**: Rol 2 (Arquitecto 3D / Three.js) y Rol 3 (Desarrollador UI/UX)  
**Versión**: 2.2.0 (Actualizada: Arquitectura de Datos Estático vs. Dinámico, Supabase y Vercel)  

---

## 🎯 1. Propósito y Estrategia de Entrega

Para asegurar el éxito del equipo sin cuellos de botella y garantizar **cero lag** en la presentación (pitch de 2 minutos ante los jueces), el **Rol 1** entrega una arquitectura **híbrida, resiliente y redundante**:

1. **Modo Estático Precalculado (Prioritario para Vercel)**:
   - Archivos JSON listos en `backend/output/` para ser consumidos directamente como archivos estáticos en `public/data/` por el Frontend Next.js.
   - Texturas científicas procesadas en `backend/output/textures/` (DEM PNG 8-bit normalizado y Skin WEBP) para Three.js.
2. **Modo Base de Datos Relacional (Supabase Cloud)**:
   - Script SQL llave en mano en `backend/output/supabase_seed.sql` para crear tablas e insertar los 6 sitios y sus 2,166 registros de telemetría horaria.
3. **Modo Dinámico / Servidor (FastAPI)**:
   - Servicio REST en `backend/app/main.py` para evaluación en tiempo real de coordenadas lunares arbitrarias (`POST /api/custom-site`) y consultas ad-hoc.

---

## 📁 2. Estructura Oficial del Espacio de Datos y Backend

```text
AstroTeam/
└── backend/                       # ESPACIO DEL ROL 1: Motor Orbital & Pipeline
    ├── app/                       # Microservicio FastAPI
    │   ├── __init__.py
    │   ├── main.py                # Endpoints REST y CORS
    │   ├── schemas.py             # Contratos Pydantic v2 (Telemetría, Latencia, Azimut/Elevación)
    │   ├── ephemeris.py           # Skyfield DE421 + IAU 2015 WGCCRE Lunar Frame
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
    │   ├── preset_sites.json          # Metadatos físicos y snapshot actual de los 6 sitios
    │   ├── preset_sites_timeline.json # Serie temporal 30 días con paso de 2h (telemetría completa)
    │   ├── supabase_seed.sql          # Script SQL DDL + DML listo para Supabase
    │   └── textures/                  # Texturas procesadas (PNG 8-bit y WEBP)
    ├── data/                      # Caché local y efemérides JPL
    │   ├── .gitkeep
    │   ├── de421.bsp              # Efemérides JPL auto-descargadas (en .gitignore)
    │   ├── preset_sites.json
    │   └── preset_sites_timeline.json
    ├── .gitignore                 # Reglas estrictas: ignora raw_data/, *.bsp, *.tif, venv/
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

### Paso 6: Generar los JSONs precalculados y script SQL
Ejecuta el script de cálculo astronómico para generar `output/preset_sites.json`, `output/preset_sites_timeline.json` y `output/supabase_seed.sql`:
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
- **En Windows (PowerShell)**: `.\gdal_pipeline\process_dem.ps1`
- **En Linux / macOS / Bash**: `bash gdal_pipeline/commands.sh`
- **Vía script Python CLI**: `python gdal_pipeline/process_terrain.py`

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
     gdal_translate -b 1 -b 1 -b 1 -of WEBP -co "QUALITY=80" wac_stere.tif output/textures/skin_wac_2k.webp
     ```

3. **Normal Map (Micro-relieve y Sombras Rasantes)**:
   - Formato: **PNG RGB de 24-bits**.
   - Generado combinando hillshades ortogonales a $90^\circ$ (R), $0^\circ$ (G) y $89^\circ$ cenital (B) con `gdaldem hillshade` y `gdalbuildvrt -separate`.

4. **Sincronización Geométrica**:
   - Los mapas se reproyectan a **Estereográfica Polar Sur** con el **mismo tamaño de píxel (2048x2048)** y el mismo Bounding Box (`[-450000, -450000, 450000, 450000]` m) para que la textura visual, el relieve y las normales encajen a la perfección vértice por vértice.

---

## 📐 5. Modelo de Datos: ¿Qué es Estático, qué es Dinámico y dónde entra Supabase?

Para aclarar completamente el flujo de datos entre el Backend, Frontend y Base de Datos:

### 5.1. Datos Estáticos (Geográficos del Terreno Lunar)
Son las características geológicas y topográficas fijas de cada uno de los sitios en la Luna. **No cambian en función del reloj ni del calendario**:
* **Ubicación Selenográfica**: Latitud y Longitud en grados (punto de análisis actual de Shackleton Rim: `-89.684°`, `196.74°E`; pendiente de validación con el DEM).
* **Elevación Topográfica**: Altura sobre el radio lunar medio (ej. `+4,200 m`).
* **Pendiente del Terreno**: Inclinación media en grados (ej. `14.5°`, crucial para planificar si un rover se vuelca).
* **Probabilidad de Hielo en Subsuelo**: Porcentaje estimado por espectrometría de neutrones de LRO (ej. `85%`).
* **Promedio Anual de Iluminación**: Porcentaje acumulado de luz solar al año (ej. `86.2%`).
* **Perfil de Horizonte Orográfico**: Malla circular de 360° que describe las montañas circundantes que bloquean el Sol o la Tierra.

### 5.2. Datos Dinámicos (Orbitales, Efemérides y Telemetría por Fecha/Hora)
Son los valores astronómicos y de telecomunicaciones que **cambian continuamente en cada segundo o minuto** debido a la rotación lunar y los movimientos orbitales de la Tierra y el Sol:
* **Posición aparente del Sol**: Acimut y elevación topocéntrica (grados).
* **Iluminación Solar Directa**: `true` si el Sol está por encima del relieve local; `false` si está en sombra orográfica.
* **Posición aparente de la Tierra**: Acimut y elevación topocéntrica en el cielo lunar.
* **Línea de Vista Directa con la Tierra (Direct-to-Earth LOS)**: `true` si la Tierra está sobre el horizonte del sitio (permite transmitir datos directamente sin satélites repetidores).
* **Distancia Tierra-Luna**: Distancia euclidiana en tiempo real (km), que varía entre ~363,000 km (perigeo) y ~405,000 km (apogeo).
* **Latencia de Radio Ida y Vuelta (Round-Trip Time - RTT)**:
  $$\text{Latencia (s)} = \frac{2 \times \text{Distancia (km)}}{299,792.458\text{ km/s}}$$
  *(Oscila entre 2.42 s y 2.70 s según la fecha)*.
* **Fase de la Tierra**: Ángulo de fase Sol-Tierra visto desde la Luna (grados).
* **Cuentas regresivas**: Tiempo en segundos para el próximo amanecer, atardecer o ventana de enlace con la Tierra.

---

### 5.3. Arquitectura de Distribución: ¿Dónde se guarda y cómo se usa?

```text
                                  ┌─────────────────────────────────────────┐
                                  │       FLUJO DE CONSUMO EN FRONTEND       │
                                  └────────────────────┬────────────────────┘
                                                       │
                     ┌─────────────────────────────────┼─────────────────────────────────┐
                     ▼                                 ▼                                 ▼
             [VÍA 1: VERCEL CDN]             [VÍA 2: SUPABASE CLOUD]            [VÍA 3: FASTAPI LIVE]
            (Archivos JSON locales)          (Base de Datos PostgreSQL)         (Python / Skyfield DE421)
                     │                                 │                                 │
                     ▼                                 ▼                                 ▼
         preset_sites_timeline.json             supabase_seed.sql               POST /api/custom-site
         ───────────────────────────            ─────────────────               ─────────────────────
         • 6 sitios estrella                    • Tablas: lunar_sites,          • Cualquier latitud y
         • 30 días precalculados                  site_telemetry_timeline         longitud de la Luna
         • Paso de 2 horas (2,166 filas)        • Historial y búsquedas SQL     • Cálculo al vuelo (15 ms)
         • Cero llamadas de red                 • Persistencia de misiones      • Explorador interactivo
         • 60 FPS en Slider de tiempo             creadas por el usuario          libre
```

#### ¿Por qué precalculamos la serie temporal a JSON?
- **Para ganar el hackathon**: Cuando el usuario mueve el Slider temporal de izquierda a derecha en React, la interfaz actualiza las sombras y los paneles analíticos a **60 FPS fluidos**. Si hiciera una petición HTTP por cada milímetro que se mueve el cursor, el navegador colapsaría o se congelaría.
- **Seguridad en el Pitch**: Si el despliegue de Vercel no tiene backend en vivo conectado, la aplicación sigue siendo 100% interactiva y funcional.

#### ¿Para qué sirve Supabase y qué se guarda en él?
El archivo generado [output/supabase_seed.sql](file:///C:/xampp/nasa/AstroTeam/backend/output/supabase_seed.sql) crea la base de datos relacional del proyecto:
1. **Tabla `lunar_sites`**: Guarda los 6 sitios estrella con sus propiedades físicas fijas (nombre, lat, lon, pendiente, hielo).
2. **Tabla `site_telemetry_timeline`**: Guarda los 2,166 registros precalculados con la telemetría horaria (fecha, hora, azimut sol, elevación sol, azimut tierra, elevación tierra, visibilidad y latencia).
3. **Tabla `user_custom_missions`**: Permite al usuario en la web hacer clic en "Guardar mi sitio de misión" o "Crear marcador favorito", persistiendo esa información en la nube.

#### 5.4. ¿Cómo trabajan conjuntamente Vercel, Supabase y FastAPI?
1. **Vercel (Frontend Next.js / Three.js)**:
   - Renderiza el mapa lunar 3D y los paneles interactivos.
   - Lee de **Supabase** (vía `@supabase/supabase-js`) los datos de iluminación, latencia y posiciones de los 6 sitios precalculados para responder al instante a los sliders.
   - Llama a **FastAPI** (`POST /api/custom-site`) únicamente cuando el usuario hace clic sobre un punto libre o personalizado en la Luna.
2. **Supabase (Base de Datos Cloud PostgreSQL)**:
   - Almacena la telemetría de 30 días y persiste las misiones o marcadores creados por el usuario en la web.
3. **FastAPI (Motor Científico Python)**:
   - Procesa cálculos orbitales de alta precisión con Skyfield y el kernel JPL `de421.bsp` para cualquier coordenada arbitraria en milisegundos.

| Componente | Rol en el Proyecto | Dónde se Despliega |
| :--- | :--- | :--- |
| **Vercel** | Frontend (Next.js, Three.js, Canvas 3D, Sliders) | Vercel (Hospedaje Web Serverless) |
| **Supabase** | Base de Datos (PostgreSQL, queries SQL, persistencia) | Supabase Cloud |
| **FastAPI** | Motor Orbital (Skyfield, efemérides JPL, cálculo en vivo) | Render.com / Railway.app / Servidor Local |

---

## 📊 6. Contratos de Datos JSON para los Roles 2 y 3

### 6.1. Ubicación de Consumo
El Frontend puede leer el JSON de efemérides de dos formas:
- **Estática (Recomendada)**: Copiado a `public/data/preset_sites.json` y `public/data/preset_sites_timeline.json`:
  ```typescript
  const res = await fetch("/data/preset_sites_timeline.json");
  const data = await res.json();
  ```
- **Dinámica (API FastAPI)**: Petición HTTP a `http://localhost:8000/api/sites/{id}/timeline`.

### 6.2. Estructura de la Serie Temporal (`preset_sites_timeline.json`)

```json
{
  "metadata": {
    "generated_at": "2026-11-14T18:07:40.018617+00:00",
    "forecast_duration_hours": 720,
    "step_hours": 2,
    "sites_count": 6
  },
  "timelines": {
    "shackleton-rim": [
      {
        "timestamp": "2026-11-14T18:07:40+00:00",
        "sun_azimuth_deg": 45.2,
        "sun_elevation_deg": 1.15,
        "is_sun_visible": true,
        "earth_azimuth_deg": 180.5,
        "earth_elevation_deg": 3.2,
        "is_earth_visible": true,
        "direct_to_earth_los": true,
        "earth_distance_km": 405088.7,
        "latency_round_trip_sec": 2.702,
        "earth_phase_angle_deg": 119.65
      }
    ]
  }
}
```

---

## 🕹️ 7. Integración con Three.js y UI (Roles 2 y 3)

### Para el Rol 2 (Arquitecto 3D):
1. **Luz Solar Dinámica**:
   - Con el acimut y la elevación solar:
     $$\text{Posición Luz Direccional} = (R \cos(\text{elev}) \sin(\text{azim}), R \sin(\text{elev}), -R \cos(\text{elev}) \cos(\text{azim}))$$
   - En el Polo Sur, cuando $\text{elevación} \approx 1.5^\circ$, Three.js proyectará sombras alargadas y realistas sobre las montañas de Shackleton y Malapert.
2. **Vector de Comunicaciones con la Tierra (Direct-to-Earth LOS)**:
   - Con el acimut y la elevación de la Tierra, se dibuja un rayo / vector 3D hacia el cielo lunar.
   - Si `direct_to_earth_los === true`, se dibuja verde (Enlace activo). Si es `false`, se dibuja rojo (Bloqueo orográfico).

### Para el Rol 3 (UI/UX y Modos de Usuario):
1. **Slider Temporal**:
   - Al mover el slider de tiempo, el Frontend consulta el arreglo precalculado y actualiza en tiempo real:
     - El porcentaje de iluminación del sitio.
     - La latencia de comunicaciones ida y vuelta (ej. `2.54 s`).
     - Los segundos restantes para el amanecer/atardecer.
     - La orientación angular de la luz 3D en la escena.
2. **Filtros Dinámicos (Sliders)**:
   - "Criterio de Iluminación Mínima" (ej. > 70% de luz solar).
   - "Pendiente Máxima Aceptable" (ej. < 15° para rovers).
3. **Modos de Usuario**:
   - **Nivel 1 (Educador/Público)**: Insignias sencillas ("☀️ Iluminado", "🟢 Señal con la Tierra disponible", "⚡ Latencia de radio: 2.6s").
   - **Nivel 2 (Ingeniero Artemis)**: Telemetría cruda con 3 decimales, matriz de rotación IAU 2015, ángulo de fase y perfiles de máscara topográfica.

---

## 📡 8. Catálogo de Endpoints de FastAPI (`app/main.py`)

| Método | Endpoint | Entrada | Salida | Propósito |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/` | Ninguna | JSON | Health Check y estado del motor orbital |
| `GET` | `/api/sites` | Ninguna | `List[PresetSite]` | Lista de los 6 sitios estrella |
| `GET` | `/api/sites/{id}` | `timestamp_utc` (opcional) | `SiteStatusResponse` | Estado topocéntrico y cuentas regresivas en tiempo real |
| `GET` | `/api/sites/{id}/timeline` | `hours`, `step_hours` | `SiteTimelineResponse` | Serie temporal predictiva para gráficas de curvas solares |
| `POST` | `/api/custom-site` | `CustomSiteRequest` | `SiteStatusResponse` | Evaluación en vivo de cualquier coordenada lunar `(lat, lon)` |
| `GET` | `/api/libration` | `timestamp_utc` (opcional) | `LibrationData` | Coordenadas sub-solar, sub-terrestre y ángulo de fase |

---

## ✅ 9. Estado del Entregable del Rol 1

- [x] Motor de efemérides y orientación selenográfica (`app/ephemeris.py`).
- [x] Motor de horizonte y cuentas regresivas de amanecer/atardecer (`app/terrain.py`).
- [x] Microservicio FastAPI con CORS habilitado (`app/main.py`).
- [x] Base de datos JSON precalculada de los 6 sitios estrella (`output/preset_sites.json`).
- [x] Serie temporal precalculada de 30 días hora a hora (`output/preset_sites_timeline.json`).
- [x] Script relacional SQL completo para Supabase (`output/supabase_seed.sql`).
- [x] Script de generación y auto-sincronización (`scripts/generate_presets.py`).
- [x] Pipeline automatizado de procesamiento GDAL (`gdal_pipeline/`).
- [x] Carpeta `raw_data/` con `.gitignore` estricto para evitar subir TIFs gigantes al repositorio.
- [x] Guía paso a paso para recrear el entorno desde cero agregada a la sección 3.
- [x] Modelo de datos Estático vs. Dinámico y roles de Supabase/Vercel documentados en la sección 5.
