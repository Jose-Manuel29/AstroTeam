---
name: lunar-ui-ux
description: >-
  Guía y estándares de UI/UX y Design System para el Visualizador del Polo Sur Lunar (AstroTeam).
  Úsalo cuando diseñes, implementes o audites componentes de interfaz, paletas de colores espaciales,
  sistemas de diseño, layout de dashboards, telemetría o vistas del flujo de usuario (Landing, Global y Local).
---

# Skill: UI/UX & Design System - Visualizador Lunar (NASA Artemis)

Esta skill define los principios, estándares de tokens, accesibilidad y componentes para la interfaz del **Visualizador del Polo Sur Lunar**. Está inspirada en los estándares de `plugin87/ux-ui-agent-skills`, `interfaces.dev` y `nextlevelbuilder/ui-ux-pro-max-skill`, adaptada a la estética de **Mission Control / Aerospace Dark UI**.

---

## 1. Principios de Diseño Visual & Experiencia (Aero-HUD)

1. **Mission Control Aesthetics (Dark Theme First):**
   - El espacio es oscuro y de alto contraste. Usar un fondo profundo (espacio/lunar: `#08090C`, `#0D1117`), superficies translúcidas con efecto cristal ahumado (`backdrop-blur-md`, bordes sutiles `border-white/10`).
   - Jerarquía visual estricta para evitar sobrecarga cognitiva durante la simulación.

2. **Tipografía Dual (Geométrica Pesada + Mono Telemetría):**
   - **Títulos y Branding:** Sans-serif geométrica con alto peso (ej. *Space Grotesk*, *Cabinet Grotesk*, *Outfit 800/900*). Transmite solidez, ingeniería aeroespacial y precisión.
   - **Telemetría y Coordenadas:** Monospace pura (ej. *JetBrains Mono*, *Space Mono*) para valores numéricos, acimutes, elevación solar, timestamps ISO y coordenadas polares.
   - **Interfaz general / Microcopy:** Sans legible a escalas pequeñas (ej. *Inter*, *Plus Jakarta Sans*).

3. **Arquitectura de Información (Embudo de 3 Etapas):**
   - **Etapa 1 (Landing):** Presentación del reto, contexto Artemis y CTA principal.
   - **Etapa 2 (Navegación Global/Regional):** Mapa de selección con cards flotantes, sliders de filtros de viabilidad y slider temporal.
   - **Etapa 3 (Análisis Local Profundo):** Vista especializada del terreno 3D, telemetría en tiempo real y capas científicas (PSR, pendientes, albedo).

4. **Niveles de Profundidad (Modo de Usuario):**
   - Switcher accesible: **Educador / Entusiasta** (lenguaje claro, métricas visuales explicadas) vs **Ingeniero / Planificador** (datos brutos, proyecciones topográficas, telemetría de comunicaciones Direct-to-Earth).

---

## 2. Paleta de Color Semántica y Tokens

Consulta la referencia completa en [references/design-tokens.md](./references/design-tokens.md).

- **Deep Space Base:** `#08090C` (Background principal), `#111622` (Cards/Paneles).
- **Solar Highlighting (Luz Solar):** `#FFB703` / `#FDB813` (Sol activo, elevación positiva, iluminación de crestas).
- **Permanent Shadow Regions (PSR / Hielo):** `#48CAE4` / `#0077B6` (Zonas de sombra permanente, depósitos volátiles).
- **Earth Link (Comunicaciones DTE):** `#00F5D4` (Línea de vista directa con la Tierra / Ventana abierta), `#E63946` (Sin visibilidad / Blackout).
- **High-Contrast Accents:** `#E2E8F0` / `#FFFFFF` para textos principales, `#94A3B8` para etiquetas secundarias.

---

## 3. Especificaciones de Componentes Clave

Consulta los detalles y wireframes lógicos en [references/components-spec.md](./references/components-spec.md).

- **Timeline & Date Controller:**
  - Slider horizontal con scrubbing fluido.
  - Reproducción / Pausa / Velocidad (1x, 10x, 100x).
  - Indicador numérico UTC preciso.
- **Viability Sliders (Filtros de Criterios):**
  - Controles de rango para % de iluminación mínima requerida y pendiente máxima permitida.
- **Telemetry HUD Card:**
  - Tarjetas flotantes compactas con valores tabulados, badges de estado y gráficos de elevación vs azimut.
- **LOD / View Toggle:**
  - Transición fluida entre vista orbital global y vista de terreno local con elevación LOLA.

---

## 4. Reglas de Validación de Interfaz

Antes de dar por completado un componente o vista UI:
1. **Contraste WCAG 2.2 AA:** El texto sobre superficies oscuras debe tener un ratio mínimo de 4.5:1 (y 3:1 para datos grandes/gráficos).
2. **Respuesta a Estados de Carga:** Modelos 3D y mapas DEM pesan varios MB; incluir siempre esqueletos (skeleton loaders) o indicadores de telemetría de carga.
3. **No Overlap con el Canvas 3D:** Los paneles HUD deben ubicarse en zonas periféricas seguras (safe areas: izquierda/derecha y barra inferior) permitiendo que el visor 3D central sea el protagonista interactivo.
