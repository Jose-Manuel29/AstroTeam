
# Astro Team: Lunar South Pole Landing Site Navigator

**Technical Documentation Report**
NASA Space Apps Challenge 2026

---

## Document Information

| Item | Detail |
| :--- | :--- |
| Project name | Astro Team |
| Challenge | Lunar Landing Site Navigator |
| Challenge page | https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/?tab=details |
| Source repository | https://github.com/Jose-Manuel29/AstroTeam |
| Live application | https://astro-team-2jfd.vercel.app |
| Demonstration video | https://drive.google.com/file/d/1e2e78a3xiKPZC3lvOkG2tqIUV7pjZMok/view?usp=sharing (narration audio generated with an AI voice synthesis tool) |
| Document version | 1.0 |
| Date | 15 November 2026 |
| Spanish version | DOCUMENTACION_ES.md |

![Figure 1](img/figure1_landing.jpg)

*Figure 1. Landing page of the Astro Team application.*

---

## Abstract

Astro Team is a browser-based, three-dimensional tool for evaluating lunar south pole landing sites and dates. It displays the positions of the Sun and the Earth relative to the local terrain horizon, and derives the indicators that mission planners use to assess a candidate: solar elevation, illumination state, direct-to-Earth line of sight, Earth distance, round-trip communication latency, and time remaining until sunrise or sunset. The tool combines precomputed ephemerides from NASA JPL Horizons, horizon profiles derived from the LRO LOLA elevation model, and a live calculation service for arbitrary lunar coordinates. It offers two levels of detail, one for educators and the general public and one for engineers and mission planners.

---

## Rubric Traceability

Each of the eight evaluation criteria carries a weight of 12.5%. The table below indicates the section of this report that addresses each one.

| No. | Criterion | Weight | Section |
| :-: | :--- | :-: | :--- |
| 01 | Technological Innovation | 12.5% | Section 3 |
| 02 | User Experience (UX/UI) | 12.5% | Section 6 |
| 03 | Social Impact | 12.5% | Section 1 |
| 04 | Use of NASA Data | 12.5% | Section 4 |
| 05 | Scientific Solution | 12.5% | Section 5 |
| 06 | Creativity | 12.5% | Section 7 |
| 07 | Art and Technology | 12.5% | Section 8 |
| 08 | Communication (English documentation, AI tool disclosure, citations) | 12.5% | Sections 13 and 14, and this document as a whole |

---

## Contents

1. Problem Statement and Social Impact
2. Solution Overview
3. System Architecture and Technological Innovation
4. NASA Data Sources
5. Scientific Methodology and Validation
6. User Experience Design
7. Creativity and Originality
8. Art and Technology
9. Installation and Usage
10. API Reference
11. Project Status and Future Work
12. Team
13. Disclosure of AI Tools
14. References

---

## 1. Problem Statement and Social Impact

**Rubric criterion addressed: 03, Social Impact.**

### 1.1 The problem

Missions to the lunar south pole, including NASA's Artemis program and the Commercial Lunar Payload Services (CLPS) initiative, operate under extreme illumination and communication constraints:

- The Sun remains only a few degrees above the horizon, roughly between 1.5 and 6 degrees. As a result, elevated terrain can be illuminated for long periods while neighboring craters remain in permanent shadow at cryogenic temperatures.
- Small changes in landing location or date can substantially alter the available solar power and the availability of a direct communication link with the Earth.
- Mission schedules frequently change because of hardware development or launch delays. Planners must then evaluate alternative sites or dates quickly.

The tools that provide this information, such as NASA Quickmap, Moon Trek and the JPL Horizons system, are designed for detailed specialist analysis. Comparing several scenarios requires navigating multiple interfaces and interpreting raw data, which creates a gap between available technical data and the accessible tools needed for agile planning.

### 1.2 Beneficiaries

| Beneficiary | Contribution of Astro Team |
| :--- | :--- |
| Mission planners and engineers | Rapid evaluation of site and date combinations, supported by detailed telemetry (azimuth, elevation, distance, latency). |
| Educators | A visual and interactive means of explaining why the Moon presents distinctive engineering challenges. |
| Students and the general public | Simplified metrics and an exploratory interface that requires no installation, account or specialized hardware. |

### 1.3 Implementation and potential for positive change

- **Accessibility.** The application runs in a modern web browser on ordinary laptops and tablets. It does not require SPICE kernels, desktop geographic information systems or licensed software.
- **Two levels of depth.** A simplified profile and an engineering profile allow the same tool to serve different audiences.
- **Language.** Documentation is provided in English and Spanish.
- **Feasibility.** The solution relies on open-source software and public NASA datasets, and can be deployed on free-tier hosting services.

### 1.4 Limitation

Formal user testing has not yet been conducted. The impact described in this section follows from the challenge definition and the design of the tool. Testing with educators and students is included in the future work (Section 11).

---

## 2. Solution Overview

The user experience follows a three-stage workflow.

1. **Landing page.** Introduces the Artemis challenge and provides access to the tool.
2. **Global and regional selection.** A three-dimensional Moon on which the user defines acceptable criteria (minimum solar visibility and minimum Direct-to-Earth visibility, expressed as a percentage of the analysis period). Each candidate site is classified as meeting both, one or none of the thresholds.
3. **Local analysis (Diorama Mode).** Selecting a site moves the camera to a high-resolution terrain model of that location. Dynamic solar lighting, terrain shadows, a vector toward the Earth and layered scientific data respond to the time slider.

![Figure 2](img/figure2_global_selector.jpg)

*Figure 2. Global selector. The criteria panel (minimum solar visibility 55%, minimum Direct-to-Earth visibility 32%), the site markers on the three-dimensional Moon and the list of the six analysis sites classified against the thresholds.*

![Figure 3](img/figure3_local_view.jpg)

*Figure 3. Local view of the Shackleton crater rim on 30 November 2026, 07:00 UTC. The mission clock and date selector, the criteria thresholds, the ephemeris at the selected instant, the site telemetry, the continuous solar window indicator and the overview minimap.*

### 2.1 Principal functions

| Function | Description |
| :--- | :--- |
| Site selection | Six curated analysis sites, plus custom lunar coordinates evaluated through a live service. |
| Date and time control | A UTC date selector and a time slider covering a 30-day window. |
| Sun and Earth visualization | Dynamic directional light, shadows from real terrain, and a vector toward the Earth. |
| Power and communication indicators | Solar elevation, illumination state, Earth line of sight, Earth distance, round-trip latency, Earth phase angle, and countdowns to sunrise and sunset. |
| Criteria filters | Sliders that set minimum thresholds for solar visibility and Direct-to-Earth visibility, and classify each site as meeting both, one or none of them. |
| User profiles | Level 1 (simplified) and Level 2 (engineering telemetry). |
| Scientific layers | Topography, thermal and permanently shadowed regions, and orbital telemetry. |

---

## 3. System Architecture and Technological Innovation

**Rubric criterion addressed: 01, Technological Innovation.**

### 3.1 Architecture

Data reach the interface through three complementary paths. This design keeps the time slider responsive and allows the application to remain functional if one component is unavailable.

```text
                  FRONTEND (Next.js, hosted on Vercel)
              React, Three.js (React Three Fiber), Tailwind CSS
                   |               |                |
              Path 1           Path 2            Path 3
           Static JSON       Supabase           FastAPI
           (Vercel CDN)     (PostgreSQL)        (Skyfield)
                   |               |                |
        Precomputed 30-day   Site catalog,     Live evaluation of
        timelines for        horizon profiles, any latitude and
        six sites            hourly timeline   longitude
```

| Component | Role | Deployment |
| :--- | :--- | :--- |
| Next.js, React, Three.js | Three-dimensional canvas, interface panels, sliders | Vercel |
| Supabase (PostgreSQL) | Site catalog, horizon profiles, hourly timeline, saved user missions | Supabase Cloud |
| FastAPI with Skyfield | Live orbital calculation for arbitrary coordinates | Render, Railway or local |
| GDAL pipeline | Conversion of large NASA GeoTIFF files into web-ready textures | Offline, at build time |

The frontend downloads the timeline of a selected site once and keeps it in memory. Moving the time slider therefore does not generate network requests, which allows shadows and panels to update at 60 frames per second.

### 3.2 Technical innovations

1. **Homomorphic albedo extraction (`delight_wac.py`).** Orbital imagery contains the illumination present at the time of capture. A homomorphic filter in the logarithmic domain, where $\log(I) = \log(\text{albedo}) + \log(\text{illumination})$, is applied using normalized Gaussian convolution. This removes large-scale shading and masks permanently shadowed regions, leaving an albedo texture on which the rendering engine computes all shadows dynamically.
2. **Custom GLSL shaders for the local view (`onBeforeCompile`).** In `LunarSurface.tsx`, shader code is injected into the vertex and fragment stages of the standard material and a synchronized depth material. The uniforms `uFocusPos`, `uFocusRadius` and `uFocusActive` isolate a circular terrain section (15 scene units, equivalent to 135 km) on the GPU with a smooth transition. The shadow map respects the same cut.
3. **Dual level-of-detail rendering.** The global Moon model (`MoonGlobe.tsx`) remains mounted across all views and is interpolated in camera space into a minimap. The local view (`LunarSurface.tsx`) uses a dense displaced plane.
4. **Deterministic CPU and GPU terrain sampling (`useTerrainHeight.ts`).** The bilinear interpolation executed by the vertex shader is replicated in TypeScript and cached, so that markers, cameras and structures align with the relief without geometric artifacts.
5. **Differentiated compression strategy.** Elevation data are exported as lossless 8-bit PNG, because lossy compression introduces false terraces in the mesh. Albedo is compressed to WebP, reducing download size by more than 90%.

### 3.3 Repository structure

```text
AstroTeam/
  backend/
    app/              FastAPI service: main.py, schemas.py, ephemeris.py, terrain.py
    scripts/          DEM profile extraction, Horizons timeline, Supabase SQL generator
    gdal_pipeline/    process_terrain.py, delight_wac.py, dem_to_normal.py
    raw_data/         Large GeoTIFF files (excluded from version control)
    datos/            Generated CSV files and Supabase setup SQL
    output/textures/  displacement_lola_2k.png and albedo textures
  frontend/           Next.js application (3D canvas, interface, views, geospatial helpers)
  docs/               Project plan, workflow and design guides
```

---

## 4. NASA Data Sources

**Rubric criterion addressed: 04, Use of NASA Data.**

| No. | Dataset or service | Provider | Use in the project |
| :-: | :--- | :--- | :--- |
| 1 | LRO LOLA Digital Elevation Model (75 deg v4, S Pole) | NASA LRO, via Moon Trek | Three-dimensional relief, terrain normals, horizon mask (360 azimuths per site) and site elevation. |
| 2 | LROC WAC Mosaic (S Pole v2) | NASA LRO, via Moon Trek | Surface texture (albedo), processed to remove embedded shadows. |
| 3 | JPL Horizons and DE421 / DE440 planetary ephemerides | NASA JPL | Positions of the Sun and Earth, Earth distance, and the 30-day hourly timeline. |
| 4 | Moon 3D model, SVS ID 14959 | NASA Scientific Visualization Studio | Global Moon model used for navigation. |
| 5 | IAU lunar orientation model (WGCCRE), applied with JPL data | International Astronomical Union | Transformation from the inertial frame (ICRF, J2000) to the lunar body-fixed frame, including libration. |

### 4.1 Interpretation of the data

- **Elevation (LOLA).** The same raster produces both the displacement map used for display and the numerical horizon profile used for calculation. The visual relief and the computed visibility therefore derive from a single source.
- **Imagery (WAC).** Photographs containing captured shadows are not used directly, because they would conflict with dynamic lighting. The imagery is processed into an albedo texture.
- **Ephemerides (Horizons).** Each hourly record contains Sun and Earth azimuth and elevation, line-of-sight flags, distance, one-way latency and Earth phase.

### 4.2 Map projection

All layers share the South Polar Stereographic projection (`+proj=stere +lat_0=-90 +lon_0=0 +k=1 +R=1737400`). A bounding box of plus or minus 450 km (900 km wide, covering latitudes from -90 degrees to approximately -75.2 degrees) is resampled to 2048 by 2048 pixels, so that texture, relief and normal maps coincide vertex by vertex.

---

## 5. Scientific Methodology and Validation

**Rubric criterion addressed: 05, Scientific Solution.**

### 5.1 Calculation methods

**Topocentric position.** For each site and instant, the azimuth and elevation of the Sun and Earth are computed as observed from the lunar surface, including libration and the IAU lunar orientation model (`ephemeris.py`).

**Terrain horizon.** The Moon has no atmosphere, so no atmospheric refraction applies. The horizon is determined by local terrain and lunar curvature. For each site, a horizon profile of 360 azimuths is extracted from the LOLA elevation model using bilinear interpolation, an observer height of 0 m and lunar curvature. A body is considered visible only when its elevation exceeds the horizon elevation at its azimuth (`terrain.py`).

**Visibility criteria.** Because the Sun and Earth appear as discs, three criteria are reported.

| Criterion | Flags (Sun / Earth) | Meaning |
| :--- | :--- | :--- |
| Disc center | `sol_estado_luz` / `linea_vista_directa` | The center of the disc is above the horizon. Used for countdowns. |
| Partial visibility | `sol_parte_visible` / `tierra_parte_visible` | Any part of the disc is above the horizon. |
| Full visibility | `sol_disco_completo_visible` / `tierra_disco_completo_visible` | The entire disc is above the horizon. |

**Round-trip communication latency.**

$$\text{RTT (s)} = \frac{2d\ (\text{km})}{299{,}792.458\ \text{km/s}}$$

The Earth-Moon distance varies between approximately 363,000 km and 405,000 km, so the round-trip time ranges from about 2.42 s to 2.70 s. The API exposes `earth_latency_rtt_sec` as a round-trip value, whereas the database stores one-way latency.

**Sunrise and sunset countdowns.** Transitions between illuminated and shadowed states are detected and the exact instant is refined by binary search (`_refine_transition`).

**Map scale.** The polar stereographic radius is $\rho = 2R_{\text{Moon}} \tan\left(\frac{90^\circ + \text{lat}}{2}\right)$, which yields a fixed relation of 1 scene unit to 9.0 km over a plane of 100 by 100 units.

**Normal maps.** The numerical gradient $\vec{n} = \text{normalize}(-\partial h/\partial x,\ -\partial h/\partial y,\ 1)$ is calibrated to the vertical exaggeration of the viewer (`displacementScale = 2.5`). Standard GDAL hillshades are not used, because they do not preserve the normal direction.

**Site dimensions.** Zone overlays use real diameters: Shackleton 21 km, Malapert 10 km, Connecting Ridge 25 km, Faustini 39 km, Schrodinger 312 km and Drygalski 149 km.

### 5.2 Validation status

| Verification | Status | Notes |
| :--- | :-: | :--- |
| Hourly timeline generated from JPL Horizons (6 sites, 720 points each, 15 Nov 2026 08:00 UTC to 15 Dec 2026 07:00 UTC) | Completed | The reference ephemeris is NASA's own service. |
| Horizon profile derived from the LOLA DEM (6 sites, 360 azimuths each, 2,160 points) | Completed | Based on measured topography. |
| Physical consistency: round-trip latency within 2.42 s to 2.70 s | Consistent | Follows from the Earth-Moon distance range. |
| Physical consistency: polar solar elevation of a few degrees | Consistent | Consistent with the low-Sun regime produced by the Moon's axial tilt of about 1.5 degrees. |
| Comparison of the live Skyfield service against the tabulated Horizons timeline for the same site and instant | Completed | Both engines rely on official JPL ephemerides (DE421 and DE440). The maximum difference is below 0.02 degrees in azimuth and below 0.01 degrees in elevation, attributable solely to the difference between apparent and geometric aberration corrections. |

### 5.3 Limitations

- Illumination is evaluated geometrically (horizon and disc visibility). Indirect light, scattering and detailed thermal behavior are not modeled.
- Horizon profiles are limited by DEM resolution. Terrain features smaller than that resolution are not represented.
- The precomputed timeline covers 30 days (15 November to 15 December 2026). Other dates require the live service.
- The three-dimensional view applies vertical exaggeration for legibility. Numerical calculations do not use the exaggerated geometry.
- Comparison against NASA Quickmap has not been performed and is proposed as future work (Section 11.2).

### 5.4 Real-world feasibility

The tool relies on the same primary sources used by mission teams (LOLA elevation data and JPL ephemerides) and produces the metrics relevant to site selection. The architecture degrades gracefully: static data are used first, then the database, then the live service.

---

## 6. User Experience Design

**Rubric criterion addressed: 02, User Experience (UX/UI).**

- **Guided workflow.** The three-stage sequence (landing, global exploration with filters, local analysis) uses continuous camera transitions.
- **Temporal controller (`TopTemporalController.tsx`).** A time ruler and a UTC date selector (`MissionDatePicker`) update the solar azimuth, terrain shadows and the azimuth and elevation indicator in real time.
- **Criteria sliders (`CriteriaSlidersCard`).** Users set minimum thresholds for solar visibility and Direct-to-Earth visibility. Site markers and the site list update immediately, classifying each site as meeting both, one or none of the thresholds, and a status filter restricts the list accordingly.
- **Focused local view.** Selecting a site hides peripheral features and isolates one crater, reducing the information overload typical of conventional geographic information systems.
- **Persistent orientation.** An interactive minimap (`SouthPoleMinimap.tsx`) keeps the user oriented relative to the south pole.

### 6.1 User profiles

| Level | Audience | Content |
| :--- | :--- | :--- |
| Level 1 | Educators, students, enthusiasts | Simplified indicators (illuminated, Earth signal available, radio latency) and a visual-first presentation. |
| Level 2 | Engineers, mission planners | Detailed telemetry with decimals, azimuth and elevation, center, partial and full-disc flags, distance, latency, Earth phase and horizon mask profiles. |

---

## 7. Creativity and Originality

**Rubric criterion addressed: 06, Creativity.**

Rather than a conventional flat map viewer, the south pole is presented as a physical-style terrain model, or diorama. A matte pedestal whose upper edge follows the exact terrain profile (`TerrainPedestal.tsx`) supports three stacked data layers:

- **L01, Topographic scan:** landing-hazard terrain.
- **L02, Thermal and permanently shadowed regions:** volatile ice and cold traps.
- **L03, Orbital telemetry:** communication window with an animated vector toward the Earth.

![Figure 4](img/figure4_data_layers.jpg)

*Figure 4. Diorama of the Shackleton crater rim with the three stacked data layers: L01 topographic scan, L02 thermal and permanently shadowed regions, and L03 orbital telemetry.*

The approach combines orbital mechanics, planetary geodesy, computer graphics, data engineering and educational design. Observing a long shadow progressively cover a crater as the time slider moves conveys the polar illumination problem more directly than a table of numerical values.

---

## 8. Art and Technology

**Rubric criterion addressed: 07, Art and Technology.**

- **Design system.** The interface follows a visual language derived from the tones of lunar regolith: cream `#D9CEC5`, charcoal `#3B3B40`, slate `#7F7B8C`, ochre `#A6948A` and obsidian `#0D0D0D`. Typography uses Major Mono Display, Space Grotesk and Inter. The system is documented in `docs/HUD_COMPONENTS_GUIDE.md`.
- **Emissive boundary shader.** `SiteZonesOverlay.tsx` uses a fragment shader based on the Chebyshev distance, $\max(|u-0.5|,|v-0.5|) \times 2$, with hardware derivative smoothing, so that landing-zone boundaries remain legible even within permanent shadow.
- **Earth vector (`EarthVector.tsx`).** An animated line from the active site toward the Earth is shown in green when direct line of sight exists and in red when terrain blocks it.
- **Function-driven aesthetics.** Color, luminance and motion are tied to data (viability, illumination, link state) and are not purely decorative.

---

## 9. Installation and Usage

### 9.1 Prerequisites

- Python 3.10 or later (3.12 recommended) and Git
- Node.js 18 or later with npm (frontend)
- GDAL (optional, to regenerate textures)
- A Supabase project (optional)

### 9.2 Backend

```bash
git clone https://github.com/Jose-Manuel29/AstroTeam.git
cd AstroTeam/backend

python -m venv venv
# Windows PowerShell: .\venv\Scripts\Activate.ps1
# Linux or macOS:     source venv/bin/activate

pip install --upgrade pip
pip install -r requirements.txt

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Interactive documentation is available at `http://localhost:8000/docs` and a health check at `http://localhost:8000/`. The JPL ephemeris file `de421.bsp` (approximately 17 MB) is downloaded automatically by Skyfield on first execution.

### 9.3 Data pipeline (optional)

```bash
cd backend
python scripts/extract_dem_profiles.py --overwrite
python scripts/generate_horizons_data.py
python scripts/generate_supabase_setup_sql.py --overwrite
```

The generated file `backend/datos/supabase_horizons_setup.sql` is executed in the Supabase SQL Editor. After loading, the database should contain 6 sites, 360 horizon points per site and 720 timeline rows per site.

### 9.4 Texture pipeline (GDAL)

Place the Moon Trek GeoTIFF files in `backend/raw_data/` (`lola_dem.tif`, `wac_mosaic.tif`) and run:

```bash
cd backend
python gdal_pipeline/process_terrain.py
```

Principal conversions, on the shared 2048 by 2048 grid:

```bash
# Elevation: lossless 8-bit PNG
gdal_translate -of PNG -outsize 2048 2048 -scale raw_data/lola_dem.tif output/textures/displacement_lola_2k.png

# Visual texture: WebP, quality 80
gdal_translate -b 1 -b 1 -b 1 -of WEBP -co "QUALITY=80" wac_stere.tif output/textures/skin_wac_2k.webp
```

### 9.5 Frontend

```bash
cd frontend
npm install
npm run dev
```

The application requires the Supabase URL and public key and the FastAPI base URL. The Supabase service-role key must never be exposed in the frontend or on Vercel.

### 9.6 Basic usage

1. Open the application and enter from the landing page.
2. In the global view, set the minimum solar visibility and Direct-to-Earth visibility thresholds. Each site is classified as meeting both, one or none of the criteria.
3. Select a site to open the local view.
4. Move the time slider to observe changes in the Sun, shadows and Earth link. Enable or disable data layers as needed.
5. Switch between Level 1 and Level 2 to adjust the depth of information.
6. Select any free point to evaluate custom coordinates through the live service.

---

## 10. API Reference

Base URL (local): `http://localhost:8000`

| Method | Endpoint | Input | Output | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| GET | `/` | None | JSON | Health check and engine status |
| GET | `/api/sites` | None | Site list | Catalog of the six analysis sites |
| GET | `/api/sites/{id}` | `timestamp_utc` (optional) | Site status | Topocentric state and countdowns |
| GET | `/api/sites/{id}/timeline` | `hours`, `step_hours` | Timeline | Time series (720 hourly points in the precomputed window) |
| POST | `/api/custom-site` | `{lat, lon, ...}` | Site status | Live evaluation of any lunar coordinate |
| GET | `/api/libration` | `timestamp_utc` (optional) | Libration data | Sub-solar and sub-Earth coordinates and phase angle |

Illustrative timeline record (values shown only to document the structure):

```json
{
  "timestamp": "2026-11-15T08:00:00+00:00",
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
```

Position of the directional light in Three.js:

```javascript
const R = 1000;
const elev = (sunElevationDeg * Math.PI) / 180;
const azim = (sunAzimuthDeg * Math.PI) / 180;
light.position.set(
  R * Math.cos(elev) * Math.sin(azim),
  R * Math.sin(elev),
  -R * Math.cos(elev) * Math.cos(azim)
);
```

---

## 11. Project Status and Future Work

### 11.1 Components completed

| Component | Status |
| :--- | :-: |
| Orbital engine (Skyfield DE421, IAU lunar orientation, libration) | Completed |
| Terrain horizon mask and sunrise and sunset countdowns | Completed |
| FastAPI service with live custom-site evaluation | Completed |
| LOLA horizon profiles and Horizons hourly timeline for six sites | Completed |
| Supabase schema and seed script | Completed |
| GDAL pipeline (elevation, albedo, normals) on a shared polar stereographic grid | Completed |
| Dual level-of-detail 3D view and local view with custom shaders | Completed |
| Dynamic sun, Earth vector, data layers and minimap | Completed |
| Time slider, criteria sliders, Level 1 and Level 2 profiles | Completed |
| Deployment on Vercel | Completed |

### 11.2 Future work

| Phase | Proposal | Expected contribution |
| :-: | :--- | :--- |
| 1 | Collaborative mission room using WebSockets | Distributed science and engineering teams evaluate the same scene simultaneously, with shared annotations and rover route planning. |
| 2 | Mixed reality mode using WebXR | Projection of the terrain model onto a physical surface for museums and universities. |
| 3 | Live CLPS and Artemis telemetry | Display of solar power, surface temperature and communication windows of active landers. |
| 4 | Validation and user testing | Comparison against NASA Quickmap, and evaluation with educators and students. |

---

## 12. Team

Team name: Astro Team

Members:

- Zidane Benjamín Ramírez Corona
- Jose Manuel Saldaña Nava
- Jose Eduardo Pérez Mata
- Lázaro Toxtle Jesús Alecxandro

The team worked across four areas: backend and data processing, data extraction, three-dimensional rendering, and frontend development.
---

## 13. Disclosure of AI Tools

**Rubric criterion addressed: 08, Communication.**

The project used the artificial intelligence tools Google Gemini, Antigravity and Anthropic Claude as support, together with an AI voice synthesis tool for the narration of the demonstration video. Their use is summarized below.

| Area | Use of AI |
| :--- | :--- |
| Code generation | Support in writing application and backend code. |
| Data extraction | Support in obtaining NASA datasets, including the use of an API to download data into the database. |
| Database creation | Support in designing and populating the database. |
| Scripts and JSON files | Support in writing processing scripts and generating JSON files. |
| Consultation | Resolution of technical and informational questions. |
| Documentation | Drafting and structuring of this report, with the support of Anthropic Claude. |
| Video narration | The audio of the demonstration video was generated with an AI voice synthesis tool. |

All scientific data originate from the NASA sources listed in Section 14 and were not produced by AI tools.
---

## 14. References

**NASA data and services**

1. NASA and Arizona State University. LROC WAC Mosaic, South Pole. Distributed through NASA Moon Trek. https://trek.nasa.gov/moon/
2. NASA Goddard Space Flight Center. LRO Lunar Orbiter Laser Altimeter (LOLA) Digital Elevation Model, 75 deg S, v4. Distributed through NASA Moon Trek and the Planetary Data System.
3. NASA Jet Propulsion Laboratory. Horizons System. https://ssd.jpl.nasa.gov/horizons/
4. Folkner, W. M., Williams, J. G., and Boggs, D. H. (2009). The Planetary and Lunar Ephemeris DE 421. JPL Interoffice Memorandum 343R-08-003.
5. NASA Scientific Visualization Studio. Moon 3D model, SVS ID 14959. https://svs.gsfc.nasa.gov/14959
6. Archinal, B. A., et al. (2018). Report of the IAU Working Group on Cartographic Coordinates and Rotational Elements: 2015. Celestial Mechanics and Dynamical Astronomy, 130, 22.
7. NASA. Artemis program and Commercial Lunar Payload Services (CLPS). https://www.nasa.gov/
8. Park, R. S., Folkner, W. M., Williams, J. G., and Boggs, D. H. (2021). The JPL Planetary and Lunar Ephemerides DE440 and DE441. The Astronomical Journal, 161(3), 105.

**Software**

9. Rhodes, B. Skyfield: Elegant Astronomy for Python. https://rhodesmill.org/skyfield/
10. GDAL/OGR contributors. GDAL, Open Source Geospatial Foundation. https://gdal.org/
11. Three.js, React Three Fiber and Drei. https://threejs.org/ and https://r3f.docs.pmnd.rs/
12. Next.js and React. https://nextjs.org/ and https://react.dev/
13. Tailwind CSS. https://tailwindcss.com/
14. FastAPI and Pydantic. https://fastapi.tiangolo.com/
15. Supabase. https://supabase.com/
16. NumPy, SciPy and OpenCV.
17. Vercel (frontend hosting) and Render or Railway (optional API hosting).

**Challenge**

18. NASA Space Apps Challenge 2026. Lunar Landing Site Navigator. https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/?tab=details

**Typography**

19. Major Mono Display, Space Grotesk and Inter (Google Fonts, open license).
