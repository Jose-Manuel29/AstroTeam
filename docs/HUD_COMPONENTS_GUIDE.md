# Guía de Arquitectura y Diseño de Componentes HUD (AstroTeam)

Este documento define las reglas visuales, tipográficas, de espaciado y el **esqueleto base (`HudCard`)** del sistema de interfaz espacial de **AstroTeam**. Su propósito es que cualquier integrante del equipo pueda **modificar los componentes existentes o crear nuevas tarjetas HUD desde cero** inyectando datos reales en React/Tailwind, sin depender del CSS absoluto exportado por Figma.

---

## 1. Principios de Diseño HUD (Lunar Regolith Glassmorphism)

### 1.1 Paleta de Superficies Translúcidas (`variant`)
Todas las tarjetas del HUD flotan sobre el lienzo 3D utilizando `backdrop-blur-md`, borde translúcido `border border-white/15`, esquinas `rounded-[18px]` y sombra profunda con bisel superior interno:

| Variante (`variant`) | Token Tailwind / Color | Uso recomendado en el HUD |
| :--- | :--- | :--- |
| **`charcoal`** | `bg-[#3B3B40]/25` | Tarjetas de control interactivo (Sliders, filtros, ajustes de simulación). |
| **`slate`** | `bg-[#7F7B8C]/20` | Tarjetas de KPIs principales y secundarios (Porcentajes, días de misión, scores). |
| **`ochre`** | `bg-[#A6948A]/20` | Tarjetas de telemetría ambiental, listas con iconos y tablas/grids de parámetros. |
| **`cream`** | `bg-[#D9CEC5]/20` | Cápsulas tácticas, selectores de fecha y botones de acción (`Aterrizar`). |
| **`obsidian`** | `bg-[#0D0D0D]/70` | Tooltips flotantes de alto contraste o alertas críticas. |

### 1.2 Jerarquía Tipográfica y Tamaños
Respetamos estrictamente las tres familias tipográficas del proyecto:

1. **`Major Mono Display` (`font-display`)**:
   - Exclusiva para el título Hero de la Landing (`astRo teaM`), siempre en minúsculas.
2. **`Space Grotesk` (`font-heading`)**:
   - **Títulos de tarjeta (`HudCardHeader`)**:
     - `size="sm"` $\rightarrow$ `15px / 20px`
     - `size="md"` $\rightarrow$ `17px / 22px` *(estándar)*
     - `size="lg"` $\rightarrow$ `20px / 26px` *(para KPIs compactos)*
   - **Números de KPI Central**: `64px` a `76px`, `font-medium`, `leading-none`, `tabular-nums`.
3. **`Inter` (`font-sans`)**:
   - **Etiquetas de fila / métricas**: `12.5px / 16px`, `font-light` o `font-normal`, color `#FAFAFA`.
   - **Valores inyectados / unidades**: `12px / 16px`, `font-medium`, `tabular-nums`, color `#D9CEC5`.
   - **Subtítulos / Micro-labels superiores**: `10px`, `uppercase`, `tracking-wider`, color `#D9CEC5/70`.
   - **Pies de tarjeta (`HudCardFooter`)**: `13px / 18px`, `font-light`, color `#D9CEC5`.

### 1.3 Reglas de Espaciado y Distribución (Cero Posicionamiento Absoluto Interno)
Para evitar que los textos se corten al inyectar datos dinámicos:
- **Nunca fijar `height` en píxeles** en las tarjetas ni en las filas internas; dejar que el contenido y el `padding` determinen la altura natural.
- **Padding estándar de tarjeta (`padding="md"`)**: `px-5 py-4` (`20px` horizontal, `16px` vertical).
- **Ritmo vertical entre secciones**: `gap-3` (`12px`) o `gap-3.5` (`14px`).
- **Barras y Sliders**: Usar siempre anchos en porcentaje (`w-full` y `style={{ width: "${percent}%" }}`) en lugar de anchos fijos en píxeles.
- **Columnas de tarjetas en la vista**: Agrupar las tarjetas laterales dentro de un contenedor `<aside className="flex flex-col gap-4">` para que si una tarjeta crece, las demás se desplacen limpiamente sin solaparse.

---

## 2. Esqueleto Base (`HudCard.tsx`)

Ubicación: [`frontend/src/components/hud/HudCard.tsx`](../frontend/src/components/hud/HudCard.tsx)

El archivo exporta 4 piezas modulares:
- `<HudCard>`: Contenedor principal con glassmorphism, bordes, sombras y variante cromática.
- `<HudCardHeader>`: Cabecera con soporte para `title`, `subtitle`, `action` (botones/badges a la derecha) y alineación (`left | center | right`).
- `<HudCardBody>`: Contenedor flexible (`flex-col`) para las filas o grillas de datos.
- `<HudCardFooter>`: Pie de tarjeta para estados o notas al pie.

---

## 3. Plantilla para Crear un Nuevo Componente HUD

Copia y pega este esqueleto en `frontend/src/components/hud/MiNuevaCard.tsx` cuando quieras crear un componente nuevo sin usar CSS de Figma:

```tsx
import React from "react";
import { Sun, Broadcast } from "@phosphor-icons/react";
import {
  HudCard,
  HudCardHeader,
  HudCardBody,
  HudCardFooter,
} from "./HudCard";

export interface TelemetryDataPoint {
  id: string;
  label: string;
  value: string | number;
  unit?: string;
}

export interface MiNuevaCardProps {
  title?: string;
  subtitle?: string;
  data: TelemetryDataPoint[];
  onRefresh?: () => void;
  className?: string;
}

export const MiNuevaCard: React.FC<MiNuevaCardProps> = ({
  title = "Communications Telemetry",
  subtitle = "Direct-to-Earth (DTE) Link Status",
  data,
  onRefresh,
  className = "w-[336px]",
}) => {
  return (
    <HudCard
      variant="ochre" // Opciones: "charcoal" | "slate" | "ochre" | "cream" | "obsidian"
      padding="md"    // Opciones: "none" | "sm" | "md" | "lg"
      ariaLabel={title}
      className={`gap-3.5 ${className}`}
    >
      {/* 1. Cabecera con acción opcional a la derecha */}
      <HudCardHeader
        title={title}
        subtitle={subtitle}
        size="md"
        action={
          onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="font-heading text-[12px] underline text-[#D9CEC5] hover:text-white bg-transparent border-0 cursor-pointer"
            >
              sync
            </button>
          )
        }
      />

      {/* 2. Cuerpo dinámico para inyectar cualquier arreglo u objeto de datos */}
      <HudCardBody className="gap-2">
        {data.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between gap-3 px-2.5 py-1.5 rounded-[10px] bg-white/[0.03] border border-white/5"
          >
            <span className="font-sans font-light text-[12.5px] text-[#FAFAFA] truncate">
              {item.label}
            </span>
            <span className="font-sans font-medium text-[12px] text-[#D9CEC5] tabular-nums shrink-0">
              {item.value}
              {item.unit ? ` ${item.unit}` : ""}
            </span>
          </div>
        ))}
      </HudCardBody>

      {/* 3. Pie opcional */}
      <HudCardFooter className="justify-between text-[11px]">
        <span className="flex items-center gap-1.5">
          <Broadcast size={14} className="text-[#D9CEC5]" />
          <span>X-Band Active</span>
        </span>
        <span>Sub-degree lock ↑</span>
      </HudCardFooter>
    </HudCard>
  );
};

export default MiNuevaCard;
```

---

## 4. Catálogo de Componentes HUD Listos para Usar

Todos los componentes se pueden importar directamente desde el barril [`frontend/src/components/hud/index.ts`](../frontend/src/components/hud/index.ts):

1. **[`CriteriaSlidersCard`](../frontend/src/components/hud/CriteriaSlidersCard.tsx)** (`variant="charcoal"`):
   - Renderiza $N$ sliders interactivos con `min`, `max`, `step`, `unit` o `formatValue: (val) => string`.
   - La barra de progreso se calcula en porcentaje (`%`), adaptándose a cualquier ancho de tarjeta.
2. **[`CriteriaKpiCard`](../frontend/src/components/hud/CriteriaKpiCard.tsx)** (`variant="slate"`):
   - Muestra un KPI principal de gran formato (`76px`), con `badgeText` opcional en la esquina superior derecha (ej. `"OPTIMAL"`, `"MARGINAL"`) y `subtitle` inferior.
3. **[`CriteriaIconListCard`](../frontend/src/components/hud/CriteriaIconListCard.tsx)** (`variant="ochre"`):
   - Lista interactiva de factores con iconos de `@phosphor-icons/react` (`"sun" | "thermometer" | "radiation" | "compass" | "mountains" | "broadcast" | "ice" | "shield"` o cualquier nodo React) e inyección de valores en tiempo real (`value`).
4. **[`CriteriaGridCard`](../frontend/src/components/hud/CriteriaGridCard.tsx)** (`variant="ochre"`):
   - Grilla de 2 columnas con soporte para micro-etiquetas (`leftSubtext`, `rightSubtext`), valores principales (`leftText`, `rightText`) y botón `"see more" / "see less"` para alternar hacia `expandedRows`.
5. **[`CriteriaDaysKpiCard`](../frontend/src/components/hud/CriteriaDaysKpiCard.tsx)** (`variant="slate"`):
   - KPI compacto alineado a la derecha (o configurable con `align`) para métricas de duración o ventanas operativas (`days` + `unitLabel`).
6. **[`TemporalRulerSlider`](../frontend/src/components/hud/TopTemporalController.tsx)**:
   - Regla horaria fluida basada en porcentajes (`left: ${percent}%`), sin píxeles fijos.
   - Permite configurar `min`, `max`, `step`, `tickCount` (con marcas principales cada 6 divisiones), `formatValue` y `telemetryBadge` para inyectar telemetría en vivo en el tooltip superior (ej. `"Az 180° · El +1.2°"`).
7. **[`MissionDatePicker`](../frontend/src/components/hud/TopTemporalController.tsx)**:
   - Cápsula táctica (`variant="cream"`) con iconos `@phosphor-icons/react` (`CaretLeft`, `CaretRight`, `CalendarBlank`), avance/retroceso diario rápido, selector de calendario nativo y soporte para `badgeText` opcional.
8. **[`TopTemporalController`](../frontend/src/components/hud/TopTemporalController.tsx)**:
   - Orquestador en columna Flexbox (`gap-3`) que agrupa `<TemporalRulerSlider>` y `<MissionDatePicker>` sin colisiones ni posiciones absolutas internas desconectadas.
