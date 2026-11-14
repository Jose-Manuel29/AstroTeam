# Especificación de Componentes UI/UX - AstroTeam

Detalle técnico de los componentes prioritarios alineados al **Rol 3 (UI/UX e Integración)** del [plan de proyecto](../../docs/plan_de_proyecto.md).

---

## 1. Timeline & Ephemeris Controller (Barra Temporal)

- **Ubicación:** Barra flotante inferior fija (`bottom-6 inset-x-8 max-w-4xl mx-auto`).
- **Elementos:**
  1. **Play/Pause Toggle:** Botón con feedback visual de estado.
  2. **Scrubbing Slider:** Slider estilizado con marcas para eventos notables (ej. máximo de elevación solar).
  3. **Control de Velocidad:** Selector de velocidad de simulación (1x, 10x, 100x).
  4. **Display UTC / Calendario:** Selector de fecha exacta y hora UTC en formato `YYYY-MM-DD HH:mm UTC` con tipografía monoespaciada tabular.

---

## 2. Viability Filter Drawer / Panel (Criterios de Misión)

- **Ubicación:** Panel lateral colapsable (Sidebar izquierdo o flotante superior-izquierdo).
- **Controles:**
  - **Slider de Iluminación Solar:** Rango de 0% a 100% de luz solar continua requerida.
  - **Slider de Pendiente Máxima (Slope):** 0° a 30° de tolerancia máxima para aterrizaje de módulo lunar.
  - **Toggle Capa de Hielo / PSR:** Activar o desactivar visualización de zonas permanentemente sombreadas con depósitos volátiles.
  - **Contador de Sitios Viables:** Badge animado que indica cuántos sitios cumplen los criterios en tiempo real (ej. `4 / 12 candidatos viables`).

---

## 3. Telemetry HUD Card (Panel de Métricas en Tiempo Real)

- **Ubicación:** Esquina superior derecha (`top-6 right-6 w-80`).
- **Métricas a Desplegar:**
  - **Elevación Solar:** Grados sobre/bajo el horizonte con indicador de barra de progreso y estado (Solar Positivo / Sombra).
  - **Azimut Solar:** Rumbo en grados sexagesimales (0° a 360°).
  - **Línea de Vista a la Tierra (DTE):** Indicador visual de comunicación (🟢 Activo / 🔴 Blackout) con elevación de la Tierra.
  - **Coordenadas Polares del Sitio:** Latitud y Longitud polar (ej. `89.5°S, 120.2°E`).

---

## 4. Selector de Perfil de Usuario (Nivel de Profundidad)

- **Ubicación:** Barra de navegación superior o cabecera del HUD.
- **Nivel 1: Educadores / Entusiastas:**
  - Oculta fórmulas complejas y telemetría de bajo nivel.
  - Destaca explicaciones contextuales (*tooltips* informativos) sobre por qué es crucial la luz en el polo sur.
- **Nivel 2: Ingenieros / Planificadores de Misión:**
  - Desbloquea visualización de datos crudos (`raw JSON`), exportación de ventanas de comunicación y visualización de vectores 3D de iluminación rasante y enlace Tierra.
