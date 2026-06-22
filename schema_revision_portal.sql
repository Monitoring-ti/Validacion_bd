-- =====================================================================
-- schema_revision_portal.sql — Revision BD alineada al portal v1.0.0.3
-- =====================================================================
-- Ejecutar en Supabase SQL Editor (una sola vez o tras actualizar el portal).
-- Orden recomendado si parte de cero:
--   1. schema.sql
--   2. schema_normativa.sql
--   3. schema_activos.sql
--   4. schema_ajustes_portal.sql
--   5. schema_revision_portal.sql  (este archivo)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Auth del portal (referencia, no SQL)
-- ---------------------------------------------------------------------
-- Login: correo @monitoring.cl + contraseña de verificacion (Supabase Auth email).
-- Authentication → Providers → Email ON, Confirm email OFF.
-- No requiere SMTP si no se usa magic link.

-- ---------------------------------------------------------------------
-- 2. Trabajadores — columnas y genero
-- ---------------------------------------------------------------------
ALTER TABLE public.trabajadores
    ADD COLUMN IF NOT EXISTS numero_domicilio                      varchar,
    ADD COLUMN IF NOT EXISTS talla_camisa                          varchar,
    ADD COLUMN IF NOT EXISTS talla_zapato                          varchar,
    ADD COLUMN IF NOT EXISTS respirador                            varchar,
    ADD COLUMN IF NOT EXISTS ingresos_portal_count                 integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS portal_requiere_autorizacion_ti       boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS portal_autorizado_ti                  boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS fecha_autorizacion_ti                 timestamptz,
    ADD COLUMN IF NOT EXISTS autorizado_por_email                  varchar;

COMMENT ON COLUMN public.trabajadores.ingresos_portal_count IS
    'Contador informativo de ingresos al portal. Sin bloqueo automatico al trabajador.';

ALTER TABLE public.trabajadores
    DROP CONSTRAINT IF EXISTS trabajadores_sexo_check;

ALTER TABLE public.trabajadores
    ADD CONSTRAINT trabajadores_sexo_check
    CHECK (
        sexo IS NULL
        OR sexo IN ('M', 'F', 'NB', 'Masculino', 'Femenino', 'No binario', 'MASCULINO', 'FEMENINO')
    );

-- ---------------------------------------------------------------------
-- 3. Tabla activos (si no existe en el proyecto)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activos (
    id_activo               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo                    varchar(50) NOT NULL,
    marca                   varchar(50) NOT NULL DEFAULT 'Sin indicar',
    modelo                  varchar(50) NOT NULL DEFAULT 'Sin indicar',
    identificador_unico     varchar(50) NOT NULL,
    estado                  varchar(30) NOT NULL DEFAULT 'disponible',
    id_trabajador_asignado  uuid REFERENCES public.trabajadores(id_trabajador) ON DELETE SET NULL,
    fecha_asignacion        date,
    detalles_adicionales    jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at              timestamptz NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.activos
    ADD COLUMN IF NOT EXISTS detalles_adicionales jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.activos.detalles_adicionales IS
    'JSON referencial opcional del portal: origen_equipo, numero_serie, ram, almacenamiento, etc.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_activos_identificador_unico
    ON public.activos (identificador_unico);

CREATE INDEX IF NOT EXISTS idx_activos_trabajador_asignado
    ON public.activos (id_trabajador_asignado);

CREATE INDEX IF NOT EXISTS idx_activos_origen_equipo
    ON public.activos ((detalles_adicionales->>'origen_equipo'));

-- Declaraciones del portal son referenciales y opcionales: sin limite de cantidad por trabajador.
DROP INDEX IF EXISTS idx_activos_un_equipo_propio_por_trabajador;

COMMENT ON TABLE public.activos IS
    'Inventario y declaraciones del portal. La informacion ingresada por el trabajador es referencial y opcional.';

-- ---------------------------------------------------------------------
-- 4. Catalogo tipos de activo — solo los del portal + legado inactivo
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cat_tipo_activo (
    codigo    varchar(30) PRIMARY KEY,
    nombre    varchar(50) NOT NULL,
    activo    boolean NOT NULL DEFAULT true,
    orden     smallint NOT NULL DEFAULT 0
);

INSERT INTO public.cat_tipo_activo (codigo, nombre, orden, activo) VALUES
    ('Notebook',          'Notebook (empresa)',     1, true),
    ('Computador propio', 'Computador propio',      2, true),
    ('Computador',        'Computador (legado)',    10, false),
    ('Celular',           'Celular (legado)',       11, false),
    ('Monitor',           'Monitor (legado)',       12, false),
    ('Tablet',            'Tablet (legado)',        13, false),
    ('Radio',             'Radio (legado)',         14, false),
    ('Otro',              'Otro (legado)',          15, false)
ON CONFLICT (codigo) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    orden  = EXCLUDED.orden,
    activo = EXCLUDED.activo;

-- Normalizar tipos antiguos en filas existentes (opcional, no destructivo)
UPDATE public.activos
SET detalles_adicionales = COALESCE(detalles_adicionales, '{}'::jsonb)
    || jsonb_build_object('origen_equipo', 'empresa')
WHERE tipo = 'Notebook'
  AND (detalles_adicionales->>'origen_equipo') IS NULL;

-- CHECK tipo: portal (Notebook / Computador propio) + legado TI
ALTER TABLE public.activos DROP CONSTRAINT IF EXISTS activos_tipo_check;

UPDATE public.activos
SET tipo = CASE lower(trim(tipo))
    WHEN 'notebook'           THEN 'Notebook'
    WHEN 'laptop'             THEN 'Notebook'
    WHEN 'computador propio'  THEN 'Computador propio'
    WHEN 'equipo propio'      THEN 'Computador propio'
    WHEN 'propio'             THEN 'Computador propio'
    WHEN 'computador'         THEN 'Computador'
    WHEN 'celular'            THEN 'Celular'
    WHEN 'monitor'            THEN 'Monitor'
    WHEN 'tablet'             THEN 'Tablet'
    WHEN 'radio'              THEN 'Radio'
    WHEN 'otro'               THEN 'Otro'
    ELSE tipo
END
WHERE tipo IS NOT NULL;

UPDATE public.activos
SET tipo = 'Otro'
WHERE tipo IS NULL
   OR tipo NOT IN (
        'Notebook', 'Computador propio', 'Computador',
        'Celular', 'Monitor', 'Tablet', 'Radio', 'Otro'
    );

ALTER TABLE public.activos
    ADD CONSTRAINT activos_tipo_check
    CHECK (tipo IN (
        'Notebook', 'Computador propio', 'Computador',
        'Celular', 'Monitor', 'Tablet', 'Radio', 'Otro'
    ));

-- ---------------------------------------------------------------------
-- 5. Estados de activo
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cat_estado_activo (
    codigo    varchar(20) PRIMARY KEY,
    nombre    varchar(50) NOT NULL,
    es_final  boolean NOT NULL DEFAULT false,
    orden     smallint NOT NULL DEFAULT 0
);

INSERT INTO public.cat_estado_activo (codigo, nombre, es_final, orden) VALUES
    ('disponible',           'Disponible en bodega',        false, 1),
    ('pendiente_validacion', 'Pendiente validacion TI',     false, 2),
    ('asignado',             'Asignado a trabajador',       false, 3),
    ('en_reparacion',        'En reparacion',               false, 4),
    ('devolucion_pendiente', 'Devolucion pendiente',        false, 5),
    ('dado_baja',            'Dado de baja',                true,  6)
ON CONFLICT (codigo) DO NOTHING;

-- Normalizar estados legacy antes del CHECK (evita error 23514)
ALTER TABLE public.activos DROP CONSTRAINT IF EXISTS activos_estado_check;

UPDATE public.activos
SET estado = CASE lower(trim(estado))
    WHEN 'disponible'            THEN 'disponible'
    WHEN 'pendiente_validacion'    THEN 'pendiente_validacion'
    WHEN 'pendiente validacion'    THEN 'pendiente_validacion'
    WHEN 'pendiente'               THEN 'pendiente_validacion'
    WHEN 'asignado'                THEN 'asignado'
    WHEN 'activo'                  THEN 'asignado'
    WHEN 'entregado'               THEN 'asignado'
    WHEN 'en uso'                  THEN 'asignado'
    WHEN 'en_reparacion'           THEN 'en_reparacion'
    WHEN 'reparacion'              THEN 'en_reparacion'
    WHEN 'devolucion_pendiente'    THEN 'devolucion_pendiente'
    WHEN 'devolucion pendiente'    THEN 'devolucion_pendiente'
    WHEN 'dado_baja'               THEN 'dado_baja'
    WHEN 'baja'                    THEN 'dado_baja'
    WHEN 'inactivo'                THEN 'dado_baja'
    ELSE estado
END
WHERE estado IS NOT NULL;

UPDATE public.activos
SET estado = CASE
    WHEN id_trabajador_asignado IS NOT NULL THEN 'asignado'
    ELSE 'disponible'
END
WHERE estado IS NULL
   OR estado NOT IN (
        'disponible', 'pendiente_validacion', 'asignado',
        'en_reparacion', 'devolucion_pendiente', 'dado_baja'
    );

ALTER TABLE public.activos
    ADD CONSTRAINT activos_estado_check
    CHECK (estado IN (
        'disponible',
        'pendiente_validacion',
        'asignado',
        'en_reparacion',
        'devolucion_pendiente',
        'dado_baja'
    ));

-- ---------------------------------------------------------------------
-- 6. RLS activos — declaracion portal (notebook / computador propio)
-- ---------------------------------------------------------------------
ALTER TABLE public.activos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS activos_select_asignados ON public.activos;
CREATE POLICY activos_select_asignados
    ON public.activos FOR SELECT TO authenticated
    USING (
        id_trabajador_asignado IN (
            SELECT id_trabajador FROM public.trabajadores
            WHERE lower(email_corporativo) = lower(auth.jwt() ->> 'email')
        )
    );

DROP POLICY IF EXISTS activos_insert_portal ON public.activos;
CREATE POLICY activos_insert_portal
    ON public.activos FOR INSERT TO authenticated
    WITH CHECK (
        estado = 'pendiente_validacion'
        AND tipo IN ('Notebook', 'Computador propio')
        AND id_trabajador_asignado IN (
            SELECT id_trabajador FROM public.trabajadores
            WHERE lower(email_corporativo) = lower(auth.jwt() ->> 'email')
        )
    );

DROP POLICY IF EXISTS activos_update_portal ON public.activos;
CREATE POLICY activos_update_portal
    ON public.activos FOR UPDATE TO authenticated
    USING (
        id_trabajador_asignado IN (
            SELECT id_trabajador FROM public.trabajadores
            WHERE lower(email_corporativo) = lower(auth.jwt() ->> 'email')
        )
        AND estado IN ('asignado', 'pendiente_validacion', 'devolucion_pendiente')
    )
    WITH CHECK (
        id_trabajador_asignado IN (
            SELECT id_trabajador FROM public.trabajadores
            WHERE lower(email_corporativo) = lower(auth.jwt() ->> 'email')
        )
    );

-- ---------------------------------------------------------------------
-- 7. Historial activos (tabla minima si falta)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activos_historial (
    id_evento               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    id_activo               uuid NOT NULL REFERENCES public.activos(id_activo) ON DELETE CASCADE,
    tipo_evento             varchar(40) NOT NULL,
    estado_anterior         varchar(20),
    estado_nuevo            varchar(20),
    id_trabajador_anterior  uuid REFERENCES public.trabajadores(id_trabajador),
    id_trabajador_nuevo     uuid REFERENCES public.trabajadores(id_trabajador),
    registrado_por_email    varchar(120),
    origen                  varchar(20) NOT NULL DEFAULT 'sistema',
    detalles                jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at              timestamptz NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.activos_historial ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS activos_historial_select_asignados ON public.activos_historial;
CREATE POLICY activos_historial_select_asignados
    ON public.activos_historial FOR SELECT TO authenticated
    USING (
        id_activo IN (
            SELECT id_activo FROM public.activos
            WHERE id_trabajador_asignado IN (
                SELECT id_trabajador FROM public.trabajadores
                WHERE lower(email_corporativo) = lower(auth.jwt() ->> 'email')
            )
        )
    );

DROP POLICY IF EXISTS activos_historial_insert_portal ON public.activos_historial;
CREATE POLICY activos_historial_insert_portal
    ON public.activos_historial FOR INSERT TO authenticated
    WITH CHECK (
        lower(registrado_por_email) = lower(auth.jwt() ->> 'email')
        AND origen = 'portal'
        AND id_activo IN (
            SELECT id_activo FROM public.activos
            WHERE id_trabajador_asignado IN (
                SELECT id_trabajador FROM public.trabajadores
                WHERE lower(email_corporativo) = lower(auth.jwt() ->> 'email')
            )
        )
    );

-- ---------------------------------------------------------------------
-- 8. Solicitudes autorizacion TI — tabla legacy (sin uso en portal actual)
-- ---------------------------------------------------------------------
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

COMMENT ON TABLE public.solicitudes_autorizacion_portal IS
    'Legacy: el portal ya no bloquea ingresos. Mantener solo para auditoria historica.';

-- ---------------------------------------------------------------------
-- 9. Verificacion rapida
-- ---------------------------------------------------------------------
-- SELECT column_name FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'trabajadores'
-- ORDER BY ordinal_position;
--
-- SELECT codigo, nombre, activo FROM cat_tipo_activo ORDER BY orden;
--
-- SELECT tipo, estado, detalles_adicionales->>'origen_equipo' AS origen
-- FROM activos ORDER BY created_at DESC LIMIT 20;

-- =====================================================================
-- FIN schema_revision_portal.sql
-- =====================================================================
