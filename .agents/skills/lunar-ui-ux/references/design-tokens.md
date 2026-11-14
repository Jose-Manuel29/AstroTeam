# Design Tokens & Sistema de Estilos - AstroTeam

Estándar de diseño para la interfaz del Visualizador del Polo Sur Lunar. Compatible con Tailwind CSS y variables CSS nativas.

---

## 1. Tokens de Color (Paleta Aeroespacial Lunar)

### Superficies & Fondos (Space Surfaces)
| Token | Hex | Tailwind Utility | Uso |
| :--- | :--- | :--- | :--- |
| `surface-space` | `#05070B` | `bg-[#05070B]` | Fondo general del viewport / lienzo espacial |
| `surface-panel` | `#0D121D` | `bg-[#0D121D]` | Fondo base de paneles laterales y modales |
| `surface-card` | `#151D2E` | `bg-[#151D2E]/80` | Cards de telemetría con `backdrop-blur-md` |
| `surface-subtle`| `#1E293B` | `bg-slate-800` | Inputs, botones secundarios, hover states |
| `border-hud` | `rgba(255,255,255,0.1)`| `border-white/10` | Bordes finos de paneles tácticos HUD |
| `border-accent` | `#38BDF8` | `border-sky-400` | Borde de elemento seleccionado o en foco |

### Acentos de Telemetría Científica
| Token | Hex | Semántica |
| :--- | :--- | :--- |
| `solar-active` | `#F59E0B` / `#FBBF24` | Sol sobre el horizonte polar (energía solar disponible) |
| `solar-dark` | `#334155` | Sombra o noche lunar |
| `psr-ice` | `#06B6D4` / `#67E8F9` | Región en Sombra Permanente (potencial hielo de agua) |
| `earth-link-ok` | `#10B981` | Línea de vista directa con la Tierra (enlace de comunicación activo) |
| `earth-link-down` | `#EF4444` | Pérdida de comunicación DTE (*blackout*) |
| `alert-warning` | `#F97316` | Pendiente elevada / Terreno de alto riesgo para alunizaje |

---

## 2. Tipografía y Jerarquías

### Stack Tipográfico Recomendado
- **Titulares & Display (Geométrica Pesada):**
  - Fuente: `Space Grotesk`, `Cabinet Grotesk` o `Outfit`
  - Pesos: `700 (Bold)`, `800 (ExtraBold)`, `900 (Black)`
  - *Tailwind class:* `font-display tracking-tight font-extrabold uppercase`
- **Cuerpo & Microcopy (Alta Legibilidad):**
  - Fuente: `Inter` o `Plus Jakarta Sans`
  - Pesos: `400 (Regular)`, `500 (Medium)`, `600 (SemiBold)`
- **Telemetría & Datos Tabulares (Monospace):**
  - Fuente: `JetBrains Mono` o `Space Mono`
  - *Tailwind class:* `font-mono tracking-wider tabular-nums`

---

## 3. Radios y Sombras (HUD Style)

- **Border Radius:** `rounded-lg` (8px) o `rounded-xl` (12px). Evitar bordes circulares excesivos en paneles para mantener la sensación técnica y militar/aeroespacial.
- **Glassmorphism:**
  ```css
  background: rgba(13, 18, 29, 0.75);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
  ```
- **Glow Accents:** `shadow-[0_0_15px_rgba(56,189,248,0.25)]` para destacar elementos activos (ej. sitio de aterrizaje seleccionado).
