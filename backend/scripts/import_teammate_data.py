"""Legacy JSON-to-SQL seed generator; not used by the JPL Horizons pipeline."""

import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path

backend_root = Path(__file__).resolve().parent.parent
DEFAULT_INPUT_FILE = backend_root / "raw_data" / "teammate_data.json"
OUTPUT_FILE = backend_root / "output" / "teammate_supabase_seed.sql"


def _mapping(value, label):
    if not isinstance(value, dict):
        raise ValueError(f"{label} debe ser un objeto JSON.")
    return value


def _required(mapping, key, label):
    if key not in mapping or mapping[key] is None:
        raise ValueError(f"Falta el campo requerido {label}.{key}.")
    return mapping[key]


def _text(value, label):
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{label} debe ser texto no vacío.")
    if "\x00" in value:
        raise ValueError(f"{label} no puede contener caracteres NUL.")
    return value


def _number(value, label):
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f"{label} debe ser numérico.")
    if not math.isfinite(value):
        raise ValueError(f"{label} debe ser un número finito.")
    return repr(value)


def _boolean(value, label):
    if not isinstance(value, bool):
        raise ValueError(f"{label} debe ser booleano.")
    return "TRUE" if value else "FALSE"


def _sql_text(value):
    return "'" + value.replace("'", "''") + "'"


def _timestamp_utc(value, label):
    value = _text(value, label)
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        try:
            parsed = datetime.strptime(value, "%Y-%b-%d %H:%M")
        except ValueError as error:
            raise ValueError(
                f"{label} debe ser ISO 8601 o tener formato 'YYYY-Mon-DD HH:MM'."
            ) from error

    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc).isoformat(timespec="seconds")


def generate_sql(input_data):
    input_data = _mapping(input_data, "raíz")
    mission = _text(_required(input_data, "mision", "raíz"), "mision")
    sites = _required(input_data, "sitios", "raíz")
    if not isinstance(sites, list) or not sites:
        raise ValueError("sitios debe ser una lista no vacía.")

    site_rows = []
    timeline_rows = []
    seen_site_ids = set()
    seen_timestamps = set()

    for site_index, raw_site in enumerate(sites):
        site_label = f"sitios[{site_index}]"
        site = _mapping(raw_site, site_label)
        site_id = _text(_required(site, "id", site_label), f"{site_label}.id")
        if site_id in seen_site_ids:
            raise ValueError(f"El id de sitio '{site_id}' está duplicado.")
        seen_site_ids.add(site_id)

        name = _text(_required(site, "nombre", site_label), f"{site_label}.nombre")
        coordinates = _mapping(
            _required(site, "coordenadas", site_label),
            f"{site_label}.coordenadas",
        )
        summary = _mapping(
            _required(site, "resumen", site_label),
            f"{site_label}.resumen",
        )

        site_rows.append(
            (
                site_id,
                name,
                _number(
                    _required(coordinates, "latitud", f"{site_label}.coordenadas"),
                    f"{site_label}.coordenadas.latitud",
                ),
                _number(
                    _required(coordinates, "longitud", f"{site_label}.coordenadas"),
                    f"{site_label}.coordenadas.longitud",
                ),
                _number(
                    _required(coordinates, "altitud_km", f"{site_label}.coordenadas"),
                    f"{site_label}.coordenadas.altitud_km",
                ),
                _number(
                    _required(summary, "porcentaje_luz_solar", f"{site_label}.resumen"),
                    f"{site_label}.resumen.porcentaje_luz_solar",
                ),
                _number(
                    _required(
                        summary,
                        "porcentaje_linea_vista_tierra",
                        f"{site_label}.resumen",
                    ),
                    f"{site_label}.resumen.porcentaje_linea_vista_tierra",
                ),
            )
        )

        cronograma = _required(site, "cronograma", site_label)
        if not isinstance(cronograma, list):
            raise ValueError(f"{site_label}.cronograma debe ser una lista.")

        for point_index, raw_point in enumerate(cronograma):
            point_label = f"{site_label}.cronograma[{point_index}]"
            point = _mapping(raw_point, point_label)
            timestamp = _timestamp_utc(
                _required(point, "fecha_hora", point_label),
                f"{point_label}.fecha_hora",
            )
            timestamp_key = (site_id, timestamp)
            if timestamp_key in seen_timestamps:
                raise ValueError(
                    f"Fecha duplicada para el sitio '{site_id}': {timestamp}."
                )
            seen_timestamps.add(timestamp_key)

            sun = _mapping(_required(point, "sol", point_label), f"{point_label}.sol")
            earth = _mapping(
                _required(point, "tierra", point_label),
                f"{point_label}.tierra",
            )
            timeline_rows.append(
                (
                    site_id,
                    timestamp,
                    _number(
                        _required(sun, "elevacion", f"{point_label}.sol"),
                        f"{point_label}.sol.elevacion",
                    ),
                    _number(
                        _required(sun, "azimut", f"{point_label}.sol"),
                        f"{point_label}.sol.azimut",
                    ),
                    _boolean(
                        _required(sun, "estado_luz_solar", f"{point_label}.sol"),
                        f"{point_label}.sol.estado_luz_solar",
                    ),
                    _number(
                        _required(earth, "elevacion", f"{point_label}.tierra"),
                        f"{point_label}.tierra.elevacion",
                    ),
                    _number(
                        _required(earth, "azimut", f"{point_label}.tierra"),
                        f"{point_label}.tierra.azimut",
                    ),
                    _boolean(
                        _required(
                            earth,
                            "linea_vista_directa",
                            f"{point_label}.tierra",
                        ),
                        f"{point_label}.tierra.linea_vista_directa",
                    ),
                    _number(
                        _required(earth, "distancia_km", f"{point_label}.tierra"),
                        f"{point_label}.tierra.distancia_km",
                    ),
                    _number(
                        _required(
                            earth,
                            "latencia_comunicaciones_seg",
                            f"{point_label}.tierra",
                        ),
                        f"{point_label}.tierra.latencia_comunicaciones_seg",
                    ),
                    _number(
                        _required(earth, "angulo_fase", f"{point_label}.tierra"),
                        f"{point_label}.tierra.angulo_fase",
                    ),
                )
            )

    sql_lines = [
        "-- Seed generado desde mision/sitios/cronograma.",
        "-- No elimina tablas ni datos existentes; puede ejecutarse de nuevo.",
        "",
        "CREATE TABLE IF NOT EXISTS public.lunar_sites (",
        "    id VARCHAR(64) PRIMARY KEY,",
        "    mision VARCHAR(128) NOT NULL,",
        "    nombre VARCHAR(128) NOT NULL,",
        "    latitud DOUBLE PRECISION NOT NULL CHECK (latitud BETWEEN -90 AND 90),",
        "    longitud DOUBLE PRECISION NOT NULL CHECK (longitud BETWEEN -180 AND 360),",
        "    altitud_km DOUBLE PRECISION NOT NULL,",
        "    pct_luz_solar DOUBLE PRECISION NOT NULL DEFAULT 0",
        "        CHECK (pct_luz_solar BETWEEN 0 AND 100),",
        "    pct_vista_tierra DOUBLE PRECISION NOT NULL DEFAULT 0",
        "        CHECK (pct_vista_tierra BETWEEN 0 AND 100)",
        ");",
        "",
        "CREATE TABLE IF NOT EXISTS public.site_cronograma (",
        "    id BIGSERIAL PRIMARY KEY,",
        "    site_id VARCHAR(64) NOT NULL",
        "        REFERENCES public.lunar_sites(id) ON DELETE CASCADE,",
        "    fecha_hora TIMESTAMPTZ NOT NULL,",
        "    sol_elevacion DOUBLE PRECISION NOT NULL,",
        "    sol_azimut DOUBLE PRECISION NOT NULL,",
        "    sol_estado_luz BOOLEAN NOT NULL,",
        "    tierra_elevacion DOUBLE PRECISION NOT NULL,",
        "    tierra_azimut DOUBLE PRECISION NOT NULL,",
        "    linea_vista_directa BOOLEAN NOT NULL,",
        "    distancia_km DOUBLE PRECISION NOT NULL,",
        "    latencia_seg DOUBLE PRECISION NOT NULL,",
        "    angulo_fase DOUBLE PRECISION NOT NULL,",
        "    UNIQUE (site_id, fecha_hora)",
        ");",
        "",
        "CREATE INDEX IF NOT EXISTS idx_cronograma_site_fecha",
        "    ON public.site_cronograma (site_id, fecha_hora);",
        "",
        "-- Sitios",
    ]

    for row in site_rows:
        site_id, name, lat, lon, alt, sunlight, earth_view = row
        sql_lines.append(
            "INSERT INTO public.lunar_sites "
            "(id, mision, nombre, latitud, longitud, altitud_km, "
            "pct_luz_solar, pct_vista_tierra) VALUES "
            f"({_sql_text(site_id)}, {_sql_text(mission)}, {_sql_text(name)}, "
            f"{lat}, {lon}, {alt}, {sunlight}, {earth_view}) "
            "ON CONFLICT (id) DO UPDATE SET "
            "mision = EXCLUDED.mision, nombre = EXCLUDED.nombre, "
            "latitud = EXCLUDED.latitud, longitud = EXCLUDED.longitud, "
            "altitud_km = EXCLUDED.altitud_km, "
            "pct_luz_solar = EXCLUDED.pct_luz_solar, "
            "pct_vista_tierra = EXCLUDED.pct_vista_tierra;"
        )

    sql_lines.extend(["", "-- Cronograma"])
    for row in timeline_rows:
        (
            site_id,
            timestamp,
            sun_elevation,
            sun_azimuth,
            sunlit,
            earth_elevation,
            earth_azimuth,
            earth_los,
            distance,
            latency,
            phase,
        ) = row
        sql_lines.append(
            "INSERT INTO public.site_cronograma "
            "(site_id, fecha_hora, sol_elevacion, sol_azimut, sol_estado_luz, "
            "tierra_elevacion, tierra_azimut, linea_vista_directa, "
            "distancia_km, latencia_seg, angulo_fase) VALUES "
            f"({_sql_text(site_id)}, TIMESTAMPTZ {_sql_text(timestamp)}, "
            f"{sun_elevation}, {sun_azimuth}, {sunlit}, "
            f"{earth_elevation}, {earth_azimuth}, {earth_los}, "
            f"{distance}, {latency}, {phase}) "
            "ON CONFLICT (site_id, fecha_hora) DO UPDATE SET "
            "sol_elevacion = EXCLUDED.sol_elevacion, "
            "sol_azimut = EXCLUDED.sol_azimut, "
            "sol_estado_luz = EXCLUDED.sol_estado_luz, "
            "tierra_elevacion = EXCLUDED.tierra_elevacion, "
            "tierra_azimut = EXCLUDED.tierra_azimut, "
            "linea_vista_directa = EXCLUDED.linea_vista_directa, "
            "distancia_km = EXCLUDED.distancia_km, "
            "latencia_seg = EXCLUDED.latencia_seg, "
            "angulo_fase = EXCLUDED.angulo_fase;"
        )

    return "\n".join(sql_lines) + "\n"


def main():
    input_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_INPUT_FILE
    try:
        with input_path.open("r", encoding="utf-8") as input_file:
            data = json.load(input_file)
        sql_content = generate_sql(data)
    except (OSError, ValueError) as error:
        raise SystemExit(f"No se pudo generar el seed: {error}") from error

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_FILE.write_text(sql_content, encoding="utf-8")
    site_count = len(data["sitios"])
    point_count = sum(len(site["cronograma"]) for site in data["sitios"])
    print(
        f"SQL generado para {site_count} sitios y {point_count} puntos: "
        f"{OUTPUT_FILE}"
    )


if __name__ == "__main__":
    main()
