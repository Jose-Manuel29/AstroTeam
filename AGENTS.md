# Reglas del Proyecto (AstroTeam)

## Gestión del Plan y Nuevas Features
- **Autorización Obligatoria para Nuevas Features:** Siempre que se proponga o implemente una nueva funcionalidad o cambio de alcance, se debe solicitar autorización explícita al usuario para determinar si se debe actualizar el documento [docs/plan_de_proyecto.md](file:///home/eduardo/Documents/Github/AstroTeam/docs/plan_de_proyecto.md).
- **Mantenimiento de la Documentación:** Mantener alineado el código y los entregables con los 5 bloques del cronograma y los requerimientos establecidos en el plan.

## Sistema de Diseño y UI/UX (Obligatorio)
- **Consulta Previa de Diseño:** Antes de crear, modificar o refactorizar cualquier componente de interfaz, estilo, vista o layout, es **obligatorio** consultar los lineamientos y especificaciones definidos en:
  - [docs/plan_de_proyecto.md#sección-7](file:///home/eduardo/Documents/Github/AstroTeam/docs/plan_de_proyecto.md) (Sistema de Diseño y Tipografía).
  - [.agents/skills/lunar-ui-ux/references/design-tokens.md](file:///home/eduardo/Documents/Github/AstroTeam/.agents/skills/lunar-ui-ux/references/design-tokens.md) (Tokens de color, utilidades Tailwind y sombras HUD).
  - [.agents/skills/lunar-ui-ux/references/components-spec.md](file:///home/eduardo/Documents/Github/AstroTeam/.agents/skills/lunar-ui-ux/references/components-spec.md) (Especificaciones de componentes y vistas).
- **Reglas Tipográficas Estrictas:**
  - `Major Mono Display` (`font-display`): Reservada exclusivamente para títulos Hero / Logo y **siempre en minúsculas** (ej. `astRo teaM`).
  - `Space Grotesk` (`font-heading`, 700 bold): Para cabeceras y títulos HUD en mayúsculas o estilo táctico.
  - `Inter` (`font-sans`): Para descripciones, textos de cuerpo, labels, modales y **botones CTA** (en peso `700 bold`, tamaño `1.25rem` / `20px`, `line-height: 1.5rem` / `24px`).
  - *Nota:* Por ahora **no** se utiliza `Space Mono`.
- **Paleta Cromática Oficial (Lunar Regolith):**
  - Seguir estrictamente los tokens configurados en [frontend/tailwind.config.js](file:///home/eduardo/Documents/Github/AstroTeam/frontend/tailwind.config.js):
    - `palette-cream` (`#D9CEC5`): Cápsulas interactivas, fondo de botones tácticos (`touch down`).
    - `palette-charcoal` (`#3B3B40`): Textos oscuros en botones y bordes HUD.
    - `palette-slate` (`#7F7B8C`): Telemetría secundaria, retículas y vectores.
    - `palette-ochre` (`#A6948A`): Acentos solares suaves, transiciones y earthshine.
    - `palette-obsidian` (`#0D0D0D`): Fondos generales de espacio profundo y sombras permanentes.

## Control de Versiones (Git)
- **Commits Bajo Autorización:** No realizar commits ni pushes sin la autorización explícita previa del usuario./
