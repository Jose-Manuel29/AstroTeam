-- Additive migration for terrain-aware JPL Horizons timelines.
-- Does not remove existing sites or telemetry.

ALTER TABLE public.lunar_sites
    ADD COLUMN IF NOT EXISTS default_horizon_elevation_deg DOUBLE PRECISION
        NOT NULL DEFAULT 0.0;

ALTER TABLE public.site_cronograma
    ADD COLUMN IF NOT EXISTS sol_parte_visible BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS sol_disco_completo_visible BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS tierra_parte_visible BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS tierra_disco_completo_visible BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.site_cronograma
        GROUP BY site_id, fecha_hora
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION
            'Resolve duplicate site_cronograma (site_id, fecha_hora) rows before migration.';
    END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.site_horizon_profile (
    site_id VARCHAR(64) NOT NULL
        REFERENCES public.lunar_sites(id) ON DELETE CASCADE,
    azimuth_deg DOUBLE PRECISION NOT NULL
        CHECK (azimuth_deg >= 0 AND azimuth_deg < 360),
    elevation_deg DOUBLE PRECISION NOT NULL,
    PRIMARY KEY (site_id, azimuth_deg)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_site_cronograma_site_fecha
    ON public.site_cronograma (site_id, fecha_hora);

ALTER TABLE public.lunar_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_cronograma ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_horizon_profile ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.lunar_sites TO anon, authenticated;
GRANT SELECT ON public.site_cronograma TO anon, authenticated;
GRANT SELECT ON public.site_horizon_profile TO anon, authenticated;

DROP POLICY IF EXISTS lunar_sites_public_read ON public.lunar_sites;
CREATE POLICY lunar_sites_public_read
    ON public.lunar_sites FOR SELECT TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS site_cronograma_public_read ON public.site_cronograma;
CREATE POLICY site_cronograma_public_read
    ON public.site_cronograma FOR SELECT TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS site_horizon_profile_public_read ON public.site_horizon_profile;
CREATE POLICY site_horizon_profile_public_read
    ON public.site_horizon_profile FOR SELECT TO anon, authenticated
    USING (true);
