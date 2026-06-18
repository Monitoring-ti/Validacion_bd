-- =====================================================================
-- schema_ajustes_portal.sql - Ajustes portal (genero, contador ingresos)
-- =====================================================================
-- El contador ingresos_portal_count es solo informativo (sin bloqueo TI).
-- =====================================================================

-- 1. Genero: ampliar CHECK para valores del portal (M, F, NB)
ALTER TABLE public.trabajadores
    DROP CONSTRAINT IF EXISTS trabajadores_sexo_check;

ALTER TABLE public.trabajadores
    ADD CONSTRAINT trabajadores_sexo_check
    CHECK (
        sexo IS NULL
        OR sexo IN (
            'M', 'F', 'NB',
            'Masculino', 'Femenino', 'No binario',
            'MASCULINO', 'FEMENINO'
        )
    );

-- 2. Contador de ingresos al portal (informativo; sin bloqueo automatico)
ALTER TABLE public.trabajadores
    ADD COLUMN IF NOT EXISTS ingresos_portal_count      integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS portal_requiere_autorizacion_ti boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS portal_autorizado_ti       boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS fecha_autorizacion_ti      timestamptz,
    ADD COLUMN IF NOT EXISTS autorizado_por_email       varchar;

COMMENT ON COLUMN public.trabajadores.ingresos_portal_count IS
    'Numero de ingresos al portal. Solo informativo para el trabajador.';

-- 3. Solicitudes autorizacion TI (legacy — portal ya no bloquea ingresos)
CREATE TABLE IF NOT EXISTS public.solicitudes_autorizacion_portal (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    trabajador_id         uuid NOT NULL REFERENCES public.trabajadores(id_trabajador) ON DELETE CASCADE,
    email_corporativo     varchar NOT NULL,
    numero_ingreso        integer NOT NULL,
    estado                varchar NOT NULL DEFAULT 'pendiente',
    ip_origen             varchar,
    user_agent            text,
    resuelto_por_email    varchar,
    resuelto_en           timestamptz,
    creado_en             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_solicitudes_autorizacion_trabajador
    ON public.solicitudes_autorizacion_portal (trabajador_id);

ALTER TABLE public.solicitudes_autorizacion_portal ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS solicitudes_autorizacion_select_self ON public.solicitudes_autorizacion_portal;
CREATE POLICY solicitudes_autorizacion_select_self
    ON public.solicitudes_autorizacion_portal FOR SELECT TO authenticated
    USING (lower(email_corporativo) = lower(auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS solicitudes_autorizacion_insert_self ON public.solicitudes_autorizacion_portal;
CREATE POLICY solicitudes_autorizacion_insert_self
    ON public.solicitudes_autorizacion_portal FOR INSERT TO authenticated
    WITH CHECK (lower(email_corporativo) = lower(auth.jwt() ->> 'email'));

-- =====================================================================
-- FIN schema_ajustes_portal.sql
-- =====================================================================
