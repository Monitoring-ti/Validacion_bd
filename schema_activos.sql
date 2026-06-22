-- =====================================================================
-- schema_activos.sql - Integridad, relaciones e historial de activos
-- =====================================================================
-- Ejecutar en Supabase DESPUES de schema.sql.
-- Asume que la tabla public.activos YA EXISTE con esta estructura:
--   id_activo, tipo, marca, modelo, identificador_unico, estado,
--   id_trabajador_asignado, fecha_asignacion, detalles_adicionales, created_at
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Catalogos de integridad (tipo y estado)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cat_tipo_activo (
    codigo    varchar(20) PRIMARY KEY,
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

-- Indices y reglas de negocio en activos (portal)
CREATE UNIQUE INDEX IF NOT EXISTS idx_activos_identificador_unico
    ON public.activos (identificador_unico);

CREATE INDEX IF NOT EXISTS idx_activos_trabajador_asignado
    ON public.activos (id_trabajador_asignado);

-- Declaraciones referenciales: sin limite de equipos propios por trabajador.
DROP INDEX IF EXISTS idx_activos_un_equipo_propio_por_trabajador;

-- ---------------------------------------------------------------------
-- 1. Proveedores del activo (compra, arriendo, leasing, mantencion)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.proveedores_activo (
    id_proveedor      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    rut               varchar(20),
    nombre            varchar(120) NOT NULL,
    tipo_servicio     varchar(30) NOT NULL DEFAULT 'compra',
    email_contacto    varchar(120),
    telefono_contacto varchar(40),
    activo            boolean NOT NULL DEFAULT true,
    created_at        timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_proveedores_activo_nombre
    ON public.proveedores_activo (lower(nombre));

-- ---------------------------------------------------------------------
-- 2. Acuerdos / contratos del activo (proveedor + contexto laboral)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activos_acuerdos (
    id_acuerdo              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    id_activo               uuid NOT NULL,
    id_proveedor            uuid REFERENCES public.proveedores_activo(id_proveedor),
    numero_acuerdo          varchar(60),
    tipo_acuerdo            varchar(30) NOT NULL DEFAULT 'comodato',
    fecha_inicio            date,
    fecha_fin               date,
    id_trabajador_contexto  uuid REFERENCES public.trabajadores(id_trabajador),
    tipo_contrato_laboral   varchar(50),
    fecha_vencimiento_contrato date,
    vigente                 boolean NOT NULL DEFAULT true,
    detalles                jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at              timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_activos_acuerdos_activo
    ON public.activos_acuerdos (id_activo);

CREATE INDEX IF NOT EXISTS idx_activos_acuerdos_vigente
    ON public.activos_acuerdos (id_activo, vigente);

-- ---------------------------------------------------------------------
-- 3. Historial de flujo del activo (auditoria inmutable)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activos_historial (
    id_evento               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    id_activo               uuid NOT NULL,
    tipo_evento             varchar(40) NOT NULL,
    estado_anterior         varchar(20),
    estado_nuevo            varchar(20),
    id_trabajador_anterior  uuid REFERENCES public.trabajadores(id_trabajador),
    id_trabajador_nuevo     uuid REFERENCES public.trabajadores(id_trabajador),
    id_acuerdo              uuid REFERENCES public.activos_acuerdos(id_acuerdo),
    id_proveedor            uuid REFERENCES public.proveedores_activo(id_proveedor),
    registrado_por_email    varchar(120),
    origen                  varchar(20) NOT NULL DEFAULT 'sistema',
    detalles                jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at              timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_activos_historial_activo
    ON public.activos_historial (id_activo, created_at DESC);

-- ---------------------------------------------------------------------
-- 4. Integridad sobre tabla activos existente
-- ---------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'activos_trabajador_fk'
    ) THEN
        ALTER TABLE public.activos
            ADD CONSTRAINT activos_trabajador_fk
            FOREIGN KEY (id_trabajador_asignado)
            REFERENCES public.trabajadores(id_trabajador)
            ON DELETE SET NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'activos_identificador_unico_key'
    ) THEN
        ALTER TABLE public.activos
            ADD CONSTRAINT activos_identificador_unico_key UNIQUE (identificador_unico);
    END IF;
END $$;

-- FK a catalogos: ejecutar solo despues de normalizar valores existentes en activos.
-- UPDATE public.activos SET estado = 'asignado' WHERE estado NOT IN (SELECT codigo FROM cat_estado_activo);
-- UPDATE public.activos SET tipo = 'Otro' WHERE tipo NOT IN (SELECT codigo FROM cat_tipo_activo);
-- Luego descomentar y ejecutar:
-- ALTER TABLE public.activos ADD CONSTRAINT activos_tipo_fk FOREIGN KEY (tipo) REFERENCES public.cat_tipo_activo(codigo);
-- ALTER TABLE public.activos ADD CONSTRAINT activos_estado_fk FOREIGN KEY (estado) REFERENCES public.cat_estado_activo(codigo);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'activos_tipo_fk'
    ) THEN
        BEGIN
            ALTER TABLE public.activos
                ADD CONSTRAINT activos_tipo_fk
                FOREIGN KEY (tipo) REFERENCES public.cat_tipo_activo(codigo);
        EXCEPTION WHEN foreign_key_violation THEN
            RAISE NOTICE 'Omitido activos_tipo_fk: normaliza valores de tipo antes de aplicar FK.';
        END;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'activos_estado_fk'
    ) THEN
        BEGIN
            ALTER TABLE public.activos
                ADD CONSTRAINT activos_estado_fk
                FOREIGN KEY (estado) REFERENCES public.cat_estado_activo(codigo);
        EXCEPTION WHEN foreign_key_violation THEN
            RAISE NOTICE 'Omitido activos_estado_fk: normaliza valores de estado antes de aplicar FK.';
        END;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'activos_acuerdos_activo_fk'
    ) THEN
        ALTER TABLE public.activos_acuerdos
            ADD CONSTRAINT activos_acuerdos_activo_fk
            FOREIGN KEY (id_activo) REFERENCES public.activos(id_activo)
            ON DELETE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'activos_historial_activo_fk'
    ) THEN
        ALTER TABLE public.activos_historial
            ADD CONSTRAINT activos_historial_activo_fk
            FOREIGN KEY (id_activo) REFERENCES public.activos(id_activo)
            ON DELETE CASCADE;
    END IF;
END $$;

-- ---------------------------------------------------------------------
-- 5. Trigger: registrar historial automatico en cambios de activos
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_activos_registrar_historial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_evento varchar(40);
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_evento := 'creacion';
        INSERT INTO public.activos_historial (
            id_activo, tipo_evento, estado_nuevo,
            id_trabajador_nuevo, registrado_por_email, origen, detalles
        ) VALUES (
            NEW.id_activo, v_evento, NEW.estado,
            NEW.id_trabajador_asignado,
            COALESCE(NEW.detalles_adicionales->>'registrado_por_email', NULL),
            COALESCE(NEW.detalles_adicionales->>'origen', 'sistema'),
            jsonb_build_object(
                'tipo', NEW.tipo,
                'marca', NEW.marca,
                'modelo', NEW.modelo,
                'identificador_unico', NEW.identificador_unico
            )
        );
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF OLD.estado IS DISTINCT FROM NEW.estado
           OR OLD.id_trabajador_asignado IS DISTINCT FROM NEW.id_trabajador_asignado THEN
            v_evento := CASE
                WHEN OLD.id_trabajador_asignado IS DISTINCT FROM NEW.id_trabajador_asignado
                     AND NEW.id_trabajador_asignado IS NOT NULL THEN 'asignacion'
                WHEN OLD.id_trabajador_asignado IS NOT NULL
                     AND NEW.id_trabajador_asignado IS NULL THEN 'devolucion'
                WHEN OLD.estado IS DISTINCT FROM NEW.estado THEN 'cambio_estado'
                ELSE 'actualizacion'
            END;

            INSERT INTO public.activos_historial (
                id_activo, tipo_evento,
                estado_anterior, estado_nuevo,
                id_trabajador_anterior, id_trabajador_nuevo,
                registrado_por_email, origen, detalles
            ) VALUES (
                NEW.id_activo, v_evento,
                OLD.estado, NEW.estado,
                OLD.id_trabajador_asignado, NEW.id_trabajador_asignado,
                COALESCE(NEW.detalles_adicionales->>'registrado_por_email', NULL),
                COALESCE(NEW.detalles_adicionales->>'origen', 'sistema'),
                jsonb_build_object(
                    'detalles_anteriores', OLD.detalles_adicionales,
                    'detalles_nuevos', NEW.detalles_adicionales
                )
            );
        END IF;
        RETURN NEW;
    END IF;

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_activos_historial ON public.activos;
CREATE TRIGGER trg_activos_historial
    AFTER INSERT OR UPDATE ON public.activos
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_activos_registrar_historial();

-- ---------------------------------------------------------------------
-- 6. Row Level Security (portal del trabajador)
-- ---------------------------------------------------------------------
ALTER TABLE public.cat_tipo_activo      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cat_estado_activo    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proveedores_activo   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activos              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activos_acuerdos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activos_historial    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cat_tipo_activo_select ON public.cat_tipo_activo;
CREATE POLICY cat_tipo_activo_select
    ON public.cat_tipo_activo FOR SELECT TO authenticated USING (activo = true);

DROP POLICY IF EXISTS cat_estado_activo_select ON public.cat_estado_activo;
CREATE POLICY cat_estado_activo_select
    ON public.cat_estado_activo FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS proveedores_activo_select ON public.proveedores_activo;
CREATE POLICY proveedores_activo_select
    ON public.proveedores_activo FOR SELECT TO authenticated USING (activo = true);

-- Activos: ver los asignados al trabajador autenticado
DROP POLICY IF EXISTS activos_select_asignados ON public.activos;
CREATE POLICY activos_select_asignados
    ON public.activos FOR SELECT TO authenticated
    USING (
        id_trabajador_asignado IN (
            SELECT id_trabajador FROM public.trabajadores
            WHERE lower(email_corporativo) = lower(auth.jwt() ->> 'email')
        )
    );

-- Activos: declaracion desde portal (pendiente validacion TI)
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

-- Activos: el trabajador puede actualizar solo detalles y solicitar devolucion
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

DROP POLICY IF EXISTS activos_acuerdos_select_asignados ON public.activos_acuerdos;
CREATE POLICY activos_acuerdos_select_asignados
    ON public.activos_acuerdos FOR SELECT TO authenticated
    USING (
        id_activo IN (
            SELECT id_activo FROM public.activos
            WHERE id_trabajador_asignado IN (
                SELECT id_trabajador FROM public.trabajadores
                WHERE lower(email_corporativo) = lower(auth.jwt() ->> 'email')
            )
        )
    );

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

-- Actualizar referencia normativa (si existe cat_categorias_datos)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'cat_categorias_datos'
    ) THEN
        UPDATE public.cat_categorias_datos
        SET tabla_origen = 'activos'
        WHERE codigo = 'activos_empresa';
    END IF;
END $$;

-- =====================================================================
-- FIN schema_activos.sql
-- =====================================================================
