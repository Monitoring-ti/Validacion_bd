-- =====================================================================
-- schema_solicitud_documento.sql — Solicitudes de correccion de documento
-- =====================================================================
-- Ejecutar en Supabase SQL Editor si falla el envio desde el portal.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.solicitudes_cambio_documento (
    id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    trabajador_id               uuid REFERENCES public.trabajadores(id_trabajador) ON DELETE CASCADE,
    email_corporativo           varchar NOT NULL,
    tipo_documento_actual       varchar,
    numero_documento_actual     varchar,
    tipo_documento_solicitado   varchar,
    numero_documento_solicitado varchar,
    motivo                      text,
    estado                      varchar NOT NULL DEFAULT 'pendiente',
    ip_origen                   varchar,
    user_agent                  text,
    creado_en                   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_solicitudes_doc_trabajador
    ON public.solicitudes_cambio_documento (trabajador_id);

CREATE INDEX IF NOT EXISTS idx_solicitudes_doc_estado
    ON public.solicitudes_cambio_documento (estado, creado_en DESC);

ALTER TABLE public.solicitudes_cambio_documento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS solicitudes_doc_select_self ON public.solicitudes_cambio_documento;
CREATE POLICY solicitudes_doc_select_self
    ON public.solicitudes_cambio_documento
    FOR SELECT TO authenticated
    USING (lower(trim(email_corporativo)) = lower(trim(auth.jwt() ->> 'email')));

DROP POLICY IF EXISTS solicitudes_doc_insert_self ON public.solicitudes_cambio_documento;
CREATE POLICY solicitudes_doc_insert_self
    ON public.solicitudes_cambio_documento
    FOR INSERT TO authenticated
    WITH CHECK (
        trabajador_id IS NOT NULL
        AND lower(trim(email_corporativo)) = lower(trim(auth.jwt() ->> 'email'))
        AND trabajador_id IN (
            SELECT id_trabajador FROM public.trabajadores
            WHERE lower(trim(email_corporativo)) = lower(trim(auth.jwt() ->> 'email'))
        )
    );

COMMENT ON TABLE public.solicitudes_cambio_documento IS
    'Solicitudes de correccion de RUT/DNI/Pasaporte. No se aplican automaticamente.';

-- =====================================================================
-- FIN
-- =====================================================================
