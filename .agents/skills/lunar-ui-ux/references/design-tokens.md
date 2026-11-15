# Design Tokens & Sistema de Estilos - AstroTeam

Estándar de diseño para la interfaz del Visualizador del Polo Sur Lunar. Compatible con Tailwind CSS y variables CSS nativas.

---

## 1. Tokens de Color (Paleta Oficial Adobe Color - Lunar Regolith)

| Token | Hex | Tailwind Utility | Semántica / Uso |
| :--- | :--- | :--- | :--- |
| `palette-cream` | `#D9CEC5` | `bg-palette-cream` / `lunarPalette-200` | Cápsulas interactivas, fondo de botones tácticos, acento regolito |
| `palette-charcoal` | `#3B3B40` | `text-palette-charcoal` / `lunarPalette-700` | Texto de alto contraste sobre cápsulas, bordes HUD sutiles |
| `palette-slate` | `#7F7B8C` | `text-palette-slate` / `lunarPalette-500` | Telemetría secundaria, retículas, polvo lunar |
| `palette-ochre` | `#A6948A` | `text-palette-ochre` / `lunarPalette-400` | Resplandor solar suave, transiciones térmicas, earthshine |
| `palette-obsidian` | `#0D0D0D` | `bg-palette-obsidian` / `lunarPalette-950` | Fondo general de espacio profundo, paneles HUD, sombras permanentes |

---

## 2. Tipografía y Jerarquías (Cyber-Aeroespacial & Brutalist)

Alineado con la **Sección 7** de [docs/plan_de_proyecto.md](../../docs/plan_de_proyecto.md):

| Nivel UI | Fuente | Peso | Ejemplo de Uso |
| :--- | :--- | :--- | :--- |
| **Hero / Logo** | `Major Mono Display` | 400 Regular (minúsculas) | `astRo teaM // artemis south pole` |
| **Cabeceras HUD / Secciones** | `Space Grotesk` | 700 Bold | `ANÁLISIS DE ILUMINACIÓN POLAR, SITIOS VIABLES` |
| **Botones CTA** | `Inter` | 700 Bold (`1.25rem` / `20px`) | `touch down` |
| **Cuerpo / Textos / Labels** | `Inter` | 400 Regular / 500 Medium | Explicaciones de criterios, descripciones de cráteres, modales de ayuda |

*(Nota: Por ahora no se emplea `Space Mono`).*

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
