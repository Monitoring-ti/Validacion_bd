-- =====================================================================
-- schema.sql - Portal de Trabajadores Monitoring
-- =====================================================================
-- Ejecutar en el SQL Editor de Supabase.
-- Incluye:
--   1. ALTER TABLE trabajadores (columnas nuevas requeridas por el portal)
--   2. CREATE TABLE de tres tablas auxiliares
--   3. Indices utiles
--   4. Politicas RLS para asegurar acceso solo a la fila propia
-- =====================================================================
-- Configuracion previa de Supabase Auth:
--   a) Authentication → Providers → Email habilitado.
--   b) Confirm email: DESACTIVADO (login con contraseña de verificacion del portal).
--   c) Opcional Azure AD: limitar tenant Monitoring si se usa SSO en el futuro.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Columnas nuevas en trabajadores
-- ---------------------------------------------------------------------
ALTER TABLE public.trabajadores
    ADD COLUMN IF NOT EXISTS centro_costo                      varchar,
    ADD COLUMN IF NOT EXISTS unidad                            varchar,
    ADD COLUMN IF NOT EXISTS talla_zapato                      varchar,
    ADD COLUMN IF NOT EXISTS talla_pantalon                    varchar,
    ADD COLUMN IF NOT EXISTS talla_camisa                      varchar,
    ADD COLUMN IF NOT EXISTS talla_guantes                     varchar,
    ADD COLUMN IF NOT EXISTS talla_casco                       varchar,
    ADD COLUMN IF NOT EXISTS talla_chaleco                     varchar,
    ADD COLUMN IF NOT EXISTS ultimo_login_microsoft            timestamptz,
    ADD COLUMN IF NOT EXISTS datos_confirmados                 boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS fecha_confirmacion                timestamptz,
    ADD COLUMN IF NOT EXISTS acepta_tratamiento_datos          boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS fecha_aceptacion_datos            timestamptz,
    ADD COLUMN IF NOT EXISTS version_texto_legal               varchar,
    ADD COLUMN IF NOT EXISTS actualizado_por_email             varchar,
    ADD COLUMN IF NOT EXISTS ultima_actualizacion_autogestion  timestamptz,
    -- Datos opcionales: licencia, pase Codelco, salud
    ADD COLUMN IF NOT EXISTS licencia_conducir_tipo            varchar,
    ADD COLUMN IF NOT EXISTS licencia_conducir_numero          varchar,
    ADD COLUMN IF NOT EXISTS pase_codelco                      boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS pase_codelco_numero               varchar,
    ADD COLUMN IF NOT EXISTS enfermedades_cronicas             text,
    -- Direccion de teletrabajo (separada de domicilio si difiere)
    ADD COLUMN IF NOT EXISTS teletrabajo_misma_direccion       boolean DEFAULT true,
    ADD COLUMN IF NOT EXISTS teletrabajo_region                varchar,
    ADD COLUMN IF NOT EXISTS teletrabajo_ciudad                varchar,
    ADD COLUMN IF NOT EXISTS teletrabajo_comuna                varchar,
    ADD COLUMN IF NOT EXISTS teletrabajo_calle                 varchar,
    ADD COLUMN IF NOT EXISTS teletrabajo_numero                varchar,
    ADD COLUMN IF NOT EXISTS teletrabajo_departamento          varchar,
    -- Tallas EPP adicionales y seguros
    ADD COLUMN IF NOT EXISTS talla_buzo                        varchar,
    ADD COLUMN IF NOT EXISTS seguro_falp                       varchar,
    ADD COLUMN IF NOT EXISTS cargas_familiares_seguro_complementario varchar;

CREATE INDEX IF NOT EXISTS idx_trabajadores_email_corporativo
    ON public.trabajadores (lower(email_corporativo));

-- ---------------------------------------------------------------------
-- 2. Solicitudes de cambio de documento (no se aplica automaticamente)
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- 3. Log granular por campo cambiado
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.log_validaciones (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    trabajador_id         uuid REFERENCES public.trabajadores(id_trabajador) ON DELETE CASCADE,
    sesion_id             uuid,
    campo                 varchar NOT NULL,
    valor_anterior        text,
    valor_nuevo           text,
    modificado_por_email  varchar,
    ip_origen             varchar,
    user_agent            text,
    fecha_modificacion    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_log_validaciones_trabajador
    ON public.log_validaciones (trabajador_id);

CREATE INDEX IF NOT EXISTS idx_log_validaciones_sesion
    ON public.log_validaciones (sesion_id);

-- ---------------------------------------------------------------------
-- 4. Sesiones de validacion (creada al login, cerrada al confirmar)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.validacion_trabajador_sesiones (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    trabajador_id         uuid REFERENCES public.trabajadores(id_trabajador) ON DELETE CASCADE,
    email_corporativo     varchar NOT NULL,
    iniciado_en           timestamptz NOT NULL DEFAULT now(),
    confirmado_en         timestamptz,
    ip_origen             varchar,
    user_agent            text,
    version_texto_legal   varchar
);

CREATE INDEX IF NOT EXISTS idx_validacion_sesiones_trabajador
    ON public.validacion_trabajador_sesiones (trabajador_id);

-- ---------------------------------------------------------------------
-- 5. Row Level Security
-- ---------------------------------------------------------------------
-- El email del JWT viene en auth.jwt() ->> 'email'. Se compara con
-- email_corporativo para que el trabajador solo vea/edite su fila.
-- ---------------------------------------------------------------------

ALTER TABLE public.trabajadores                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitudes_cambio_documento       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.log_validaciones                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.validacion_trabajador_sesiones     ENABLE ROW LEVEL SECURITY;

-- --- trabajadores ---
DROP POLICY IF EXISTS trabajador_select_self ON public.trabajadores;
CREATE POLICY trabajador_select_self
    ON public.trabajadores
    FOR SELECT
    TO authenticated
    USING (lower(email_corporativo) = lower(auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS trabajador_update_self ON public.trabajadores;
CREATE POLICY trabajador_update_self
    ON public.trabajadores
    FOR UPDATE
    TO authenticated
    USING (lower(email_corporativo) = lower(auth.jwt() ->> 'email'))
    WITH CHECK (lower(email_corporativo) = lower(auth.jwt() ->> 'email'));

-- --- solicitudes_cambio_documento ---
DROP POLICY IF EXISTS solicitudes_doc_select_self ON public.solicitudes_cambio_documento;
CREATE POLICY solicitudes_doc_select_self
    ON public.solicitudes_cambio_documento
    FOR SELECT
    TO authenticated
    USING (lower(email_corporativo) = lower(auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS solicitudes_doc_insert_self ON public.solicitudes_cambio_documento;
CREATE POLICY solicitudes_doc_insert_self
    ON public.solicitudes_cambio_documento
    FOR INSERT
    TO authenticated
    WITH CHECK (
        trabajador_id IS NOT NULL
        AND lower(trim(email_corporativo)) = lower(trim(auth.jwt() ->> 'email'))
        AND trabajador_id IN (
            SELECT id_trabajador FROM public.trabajadores
            WHERE lower(trim(email_corporativo)) = lower(trim(auth.jwt() ->> 'email'))
        )
    );

-- --- log_validaciones ---
DROP POLICY IF EXISTS log_validaciones_select_self ON public.log_validaciones;
CREATE POLICY log_validaciones_select_self
    ON public.log_validaciones
    FOR SELECT
    TO authenticated
    USING (lower(modificado_por_email) = lower(auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS log_validaciones_insert_self ON public.log_validaciones;
CREATE POLICY log_validaciones_insert_self
    ON public.log_validaciones
    FOR INSERT
    TO authenticated
    WITH CHECK (lower(modificado_por_email) = lower(auth.jwt() ->> 'email'));

-- --- validacion_trabajador_sesiones ---
DROP POLICY IF EXISTS sesiones_select_self ON public.validacion_trabajador_sesiones;
CREATE POLICY sesiones_select_self
    ON public.validacion_trabajador_sesiones
    FOR SELECT
    TO authenticated
    USING (lower(email_corporativo) = lower(auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS sesiones_insert_self ON public.validacion_trabajador_sesiones;
CREATE POLICY sesiones_insert_self
    ON public.validacion_trabajador_sesiones
    FOR INSERT
    TO authenticated
    WITH CHECK (lower(email_corporativo) = lower(auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS sesiones_update_self ON public.validacion_trabajador_sesiones;
CREATE POLICY sesiones_update_self
    ON public.validacion_trabajador_sesiones
    FOR UPDATE
    TO authenticated
    USING (lower(email_corporativo) = lower(auth.jwt() ->> 'email'))
    WITH CHECK (lower(email_corporativo) = lower(auth.jwt() ->> 'email'));

-- =====================================================================
-- FIN del schema principal
-- =====================================================================
-- Para cumplimiento normativo y activos de empresa, ejecutar ademas:
--   schema_normativa.sql
--   schema_activos.sql
--   schema_ajustes_portal.sql
--   schema_revision_portal.sql
-- =====================================================================
