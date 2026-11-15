import React, { useRef } from "react";
import { CaretLeft, CaretRight, CalendarBlank } from "@phosphor-icons/react";

const MONTHS_SHORT = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];

export function formatDisplayDate(iso: string): string {
  const parts = iso.split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return "18 nov 2026";
  const [year, month, day] = parts;
  const monthName = MONTHS_SHORT[(month - 1 + 12) % 12] || "nov";
  return `${day} ${monthName} ${year}`;
}

export function formatHourUtc(hour: number): string {
  const clamped = Math.max(0, Math.min(24, hour));
  const h = Math.floor(clamped);
  const m = Math.round((clamped - h) * 60);
  const hh = String(h === 24 ? 0 : h).padStart(2, "0");
  const mm = String(m === 60 ? 0 : m).padStart(2, "0");
  return `${hh}:${mm} UTC`;
}

// ============================================================================
// 1. COMPONENTE MODULAR: TemporalRulerSlider (Regla Horaria Interactiva)
// ============================================================================
export interface TemporalRulerSliderProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  /** Cantidad de marcas verticales en la regla (por defecto 37: cada ~40 min en 24h) */
  tickCount?: number;
  onChange: (newValue: number) => void;
  /** Formateador para el badge/tooltip superior */
  formatValue?: (val: number) => string;
  /** Etiqueta secundaria inyectable (ej. azimut o elevación solar en tiempo real) */
  telemetryBadge?: string;
  className?: string;
}

export const TemporalRulerSlider: React.FC<TemporalRulerSliderProps> = ({
  value,
  min = 0,
  max = 24,
  step = 0.1,
  tickCount = 37,
  onChange,
  formatValue = formatHourUtc,
  telemetryBadge,
  className = "w-[clamp(280px,38vw,560px)] max-w-[90vw]",
}) => {
  const percent = Math.max(
    0,
    Math.min(100, ((value - min) / (max - min)) * 100)
  );

  const ticks = Array.from({ length: tickCount }, (_, i) => i);

  return (
    <div className={`flex flex-col items-center pointer-events-auto ${className}`}>
      {/* Título indicador superior con viñeta amarilla táctica a la derecha */}
      <div className="flex items-center justify-center gap-1.5 pb-[clamp(0.2rem,0.45vh,0.4rem)] pointer-events-none select-none">
        <span className="font-heading font-bold text-[clamp(0.68rem,1.15vh,0.78rem)] uppercase tracking-[0.14em] text-palette-cream">
          Avanzar el reloj
        </span>
        <span className="w-1.5 h-1.5 rounded-full bg-[#FACC15] shadow-[0_0_8px_#FACC15] inline-block" />
      </div>

      <div className="group relative flex flex-col justify-center w-full h-[clamp(18px,2.4vh,24px)] select-none">
        {/* Resplandor radial dinámico centrado en el porcentaje activo */}
        <div
          aria-hidden="true"
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-[55%] h-[clamp(16px,2.2vh,22px)] pointer-events-none will-change-transform"
          style={{
            left: `${percent}%`,
            background:
              "radial-gradient(50% 50% at 50% 50%, rgba(250, 250, 250, 0.65) 0%, rgba(255, 255, 255, 0) 100%)",
          }}
        />

        {/* Contenedor fluido de la regla (100% ancho relativo sin píxeles fijos) */}
        <div
          aria-hidden="true"
          className="relative flex items-center justify-between w-full h-[clamp(10px,1.5vh,14px)] pointer-events-none"
        >
          {/* Línea horizontal central luminosa */}
          <div
            className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[1.5px] bg-[#F8F6F4]"
            style={{ boxShadow: "0px 0px 16px #FAFAFA" }}
          />

          {/* Marcas verticales distribuidas con Flexbox (principales cada 6 intervalos) */}
          {ticks.map((idx) => {
            const isMajor = idx % 6 === 0;
            return (
              <div
                key={idx}
                className={`w-[1.5px] bg-[#F8F6F4] transition-opacity ${
                  isMajor
                    ? "h-[clamp(10px,1.5vh,14px)] opacity-100"
                    : "h-[clamp(7px,1.1vh,10px)] opacity-75"
                }`}
              />
            );
          })}

          {/* Cursor / Thumb luminoso con toque amarillo coordinado */}
          <div
            className="
              absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-[clamp(6px,0.8vh,8px)] h-[clamp(13px,1.9vh,18px)]
              rounded-full bg-[#FFFFFF] border border-[#FACC15]/80 shadow-[0_0_10px_rgba(250,204,21,0.55)]
              group-hover:scale-110 transition-transform duration-100
            "
            style={{ left: `${percent}%` }}
          />
        </div>

        {/* Badge inferior con hora UTC + telemetría solar inyectada (reubicado debajo del slider) */}
        <div
          aria-hidden="true"
          className="
            absolute top-[calc(100%+clamp(5px,0.7vh,9px))] -translate-x-1/2 px-[clamp(0.45rem,0.7vw,0.625rem)] py-[0.15vh] rounded-full
            bg-[#0D0D0D]/90 border border-white/15 backdrop-blur-md
            font-sans text-[clamp(0.625rem,1.15vh,0.6875rem)] leading-[1.3] text-[#FAFAFA] whitespace-nowrap tabular-nums
            flex items-center gap-2 shadow-md
            opacity-85 group-hover:opacity-100 transition-opacity pointer-events-none z-20
          "
          style={{ left: `${percent}%` }}
        >
          <span className="font-medium">{formatValue(value)}</span>
          {telemetryBadge && (
            <>
              <span className="text-white/25">|</span>
              <span className="text-[#D9CEC5] font-light">{telemetryBadge}</span>
            </>
          )}
        </div>

        {/* Input range nativo accesible */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-label="Mission time slider"
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-30 m-0"
        />
      </div>
    </div>
  );
};

// ============================================================================
// 2. COMPONENTE MODULAR: MissionDatePicker (Selector Táctico de Fecha)
// ============================================================================
export interface MissionDatePickerProps {
  /** Fecha en formato ISO YYYY-MM-DD */
  dateIso: string;
  onChangeDate: (newDateIso: string) => void;
  /** Texto opcional secundario (ej. hora UTC o fase de misión) */
  badgeText?: string;
  className?: string;
}

export const MissionDatePicker: React.FC<MissionDatePickerProps> = ({
  dateIso,
  onChangeDate,
  badgeText,
  className = "",
}) => {
  const dateInputRef = useRef<HTMLInputElement>(null);

  const shiftDay = (deltaDays: number) => {
    const [y, m, d] = dateIso.split("-").map(Number);
    const dt = new Date(
      Date.UTC(y || 2026, (m || 11) - 1, (d || 18) + deltaDays)
    );
    const ny = dt.getUTCFullYear();
    const nm = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const nd = String(dt.getUTCDate()).padStart(2, "0");
    onChangeDate(`${ny}-${nm}-${nd}`);
  };

  const openNativePicker = () => {
    if (!dateInputRef.current) return;
    if ("showPicker" in HTMLInputElement.prototype) {
      try {
        dateInputRef.current.showPicker();
        return;
      } catch {
        // Fallback
      }
    }
    dateInputRef.current.focus();
    dateInputRef.current.click();
  };

  return (
    <div
      className={`
        inline-flex items-center justify-center px-[clamp(0.65rem,1vw,0.875rem)] py-[clamp(0.22rem,0.55vh,0.375rem)] gap-[clamp(0.35rem,0.6vw,0.625rem)]
        rounded-[clamp(12px,1.8vh,18px)] bg-[#D9CEC5]/20 hover:bg-[#D9CEC5]/28
        backdrop-blur-md border border-white/20
        shadow-[0px_4px_4px_rgba(0,0,0,0.25),inset_0px_1px_1px_rgba(255,255,255,0.25)]
        transition-all select-none pointer-events-auto
        ${className}
      `}
    >
      {/* Día anterior */}
      <button
        type="button"
        onClick={() => shiftDay(-1)}
        aria-label="Previous day"
        className="flex items-center justify-center w-[clamp(16px,2vh,20px)] h-[clamp(16px,2vh,20px)] rounded-full text-[#FAFAFA]/70 hover:text-[#FAFAFA] hover:bg-white/10 bg-transparent border-0 cursor-pointer transition-colors p-0"
      >
        <CaretLeft size={14} weight="bold" />
      </button>

      {/* Disparador del calendario con fecha formateada */}
      <button
        type="button"
        onClick={openNativePicker}
        title="Select mission date"
        className="inline-flex items-center gap-[0.45vw] font-sans font-normal text-[clamp(0.75rem,1.4vh,0.875rem)] leading-[1.25] text-[#FAFAFA] bg-transparent border-0 cursor-pointer px-1 py-0 whitespace-nowrap tabular-nums"
      >
        <CalendarBlank size={15} className="text-[#D9CEC5]" />
        <span>{formatDisplayDate(dateIso)}</span>
        {badgeText && (
          <span className="ml-1 pl-2 border-l border-white/20 font-light text-[clamp(0.65rem,1.2vh,0.75rem)] text-[#D9CEC5]">
            {badgeText}
          </span>
        )}
      </button>

      {/* Día siguiente */}
      <button
        type="button"
        onClick={() => shiftDay(1)}
        aria-label="Next day"
        className="flex items-center justify-center w-[clamp(16px,2vh,20px)] h-[clamp(16px,2vh,20px)] rounded-full text-[#FAFAFA]/70 hover:text-[#FAFAFA] hover:bg-white/10 bg-transparent border-0 cursor-pointer transition-colors p-0"
      >
        <CaretRight size={14} weight="bold" />
      </button>

      <input
        ref={dateInputRef}
        type="date"
        value={dateIso}
        onChange={(e) => {
          if (e.target.value) onChangeDate(e.target.value);
        }}
        aria-label="Mission date picker"
        className="sr-only"
      />
    </div>
  );
};

// ============================================================================
// 3. ORQUESTADOR: TopTemporalController (Combina Slider Horario + Date Picker)
// ============================================================================
export interface TopTemporalControllerProps {
  /** Hora del día en formato decimal (0 a 24) */
  hour: number;
  onChangeHour: (newHour: number) => void;
  /** Opcional: índice de muestra cuando el reloj recorre un timeline precalculado. */
  value?: number;
  min?: number;
  max?: number;
  onChangeValue?: (newValue: number) => void;
  formatValue?: (value: number) => string;
  /** Fecha ISO seleccionada (ej. "2026-11-18") */
  dateIso: string;
  onChangeDate: (newDateIso: string) => void;
  /** Telemetría opcional para inyectar en el tooltip del slider (ej. "Az 180° · El +1.2°") */
  telemetryBadge?: string;
  className?: string;
}

export const TopTemporalController: React.FC<TopTemporalControllerProps> = ({
  hour,
  onChangeHour,
  value,
  min = 0,
  max = 24,
  onChangeValue,
  formatValue,
  dateIso,
  onChangeDate,
  telemetryBadge,
  className = "absolute left-1/2 -translate-x-1/2 top-[clamp(1.25rem,3vh,2rem)] z-20",
}) => {
  return (
    <div
      className={`flex flex-col items-center pointer-events-none ${className}`}
    >
      <TemporalRulerSlider
        value={value ?? hour}
        min={value === undefined ? 0 : min}
        max={value === undefined ? 24 : max}
        step={value === undefined ? 0.1 : 1}
        onChange={value === undefined ? onChangeHour : onChangeValue ?? onChangeHour}
        formatValue={formatValue ?? formatHourUtc}
        telemetryBadge={telemetryBadge}
      />

      {/* Picker de fecha recorrido hacia abajo con margen holgado para no colisionar con la telemetría inferior */}
      <div className="mt-[clamp(1.6rem,3.2vh,2.35rem)] pointer-events-auto">
        <MissionDatePicker dateIso={dateIso} onChangeDate={onChangeDate} />
      </div>
    </div>
  );
};

export default TopTemporalController;
