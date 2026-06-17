-- =====================================================================
-- schema_normativa.sql - Cumplimiento tratamiento de datos + activos empresa
-- =====================================================================
-- Ejecutar DESPUES de schema.sql (o en el mismo SQL Editor).
-- No modifica la estructura principal de trabajadores mas alla de
-- documentar el uso del campo sexo como identidad de genero.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Catalogo de bases legales (Ley 19.628 / buenas practicas)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cat_bases_legales (
    codigo        varchar PRIMARY KEY,
    nombre        varchar NOT NULL,
    descripcion   text,
    ejemplo_uso   text NOT NULL,
    activo        boolean NOT NULL DEFAULT true,
    orden         smallint NOT NULL DEFAULT 0
);

INSERT INTO public.cat_bases_legales (codigo, nombre, descripcion, ejemplo_uso, orden) VALUES
    ('consentimiento', 'Consentimiento',
     'Tratamiento basado en autorizacion explicita del titular.',
     'Checkbox explicito en registro y confirmacion del portal.',
     1),
    ('contrato', 'Contrato',
     'Datos necesarios para la relacion laboral y prestacion del servicio.',
     'Datos necesarios para prestar el servicio y gestionar la relacion laboral.',
     2),
    ('obligacion_legal', 'Obligacion legal',
     'Cumplimiento de normativa laboral, minera y de seguridad.',
     'Datos requeridos por normativa minera y laboral.',
     3),
    ('interes_legitimo', 'Interes legitimo',
     'Finalidades operativas proporcionadas y con salvaguardas.',
     'Monitoreo de activos propio de la operacion.',
     4),
    ('interes_vital', 'Interes vital',
     'Proteccion de la vida o integridad fisica del titular u otras personas.',
     'Emergencias de seguridad y contactos de emergencia.',
     5),
    ('interes_publico', 'Interes publico',
     'Cumplimiento de deberes legales frente a organismos del Estado.',
     'Informacion a organismos reguladores cuando corresponda.',
     6)
ON CONFLICT (codigo) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    descripcion = EXCLUDED.descripcion,
    ejemplo_uso = EXCLUDED.ejemplo_uso,
    orden = EXCLUDED.orden;

-- ---------------------------------------------------------------------
-- 2. Categorias de datos del portal y su base legal principal
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cat_categorias_datos (
    codigo              varchar PRIMARY KEY,
    nombre              varchar NOT NULL,
    descripcion         text,
    base_legal_codigo   varchar NOT NULL REFERENCES public.cat_bases_legales(codigo),
    tabla_origen        varchar,
    activo              boolean NOT NULL DEFAULT true,
    orden               smallint NOT NULL DEFAULT 0
);

INSERT INTO public.cat_categorias_datos (codigo, nombre, descripcion, base_legal_codigo, tabla_origen, orden) VALUES
    ('identidad', 'Identidad y documentacion',
     'Nombre, documento, nacionalidad, genero y vigencia de carnet.',
     'obligacion_legal', 'trabajadores', 1),
    ('contacto_personal', 'Contacto personal',
     'Email y telefono personal del trabajador.',
     'contrato', 'trabajadores', 2),
    ('contacto_emergencia', 'Contacto de emergencia',
     'Persona y telefono para situaciones de emergencia.',
     'interes_vital', 'trabajadores', 3),
    ('domicilio', 'Domicilio y teletrabajo',
     'Direccion de vivienda y, si aplica, de teletrabajo.',
     'contrato', 'trabajadores', 4),
    ('previsional', 'Datos previsionales y seguros',
     'AFP, sistema de salud, FALP y cargas familiares.',
     'obligacion_legal', 'trabajadores', 5),
    ('bancarios', 'Datos bancarios',
     'Cuenta para pago de remuneraciones.',
     'contrato', 'trabajadores', 6),
    ('epp_tallas', 'Tallas EPP',
     'Equipos de proteccion personal y tallas asociadas.',
     'obligacion_legal', 'trabajadores', 7),
    ('activos_empresa', 'Activos entregados por la empresa',
     'Computadores, celulares y otros activos asignados.',
     'interes_legitimo', 'activos', 8),
    ('consentimiento_portal', 'Consentimiento del portal',
     'Aceptacion del texto legal y tratamiento en autogestion.',
     'consentimiento', 'trabajador_consentimientos_tratamiento', 9),
    ('regulatorio', 'Informacion regulatoria',
     'Datos que puedan requerirse a organismos fiscalizadores.',
     'interes_publico', NULL, 10)
ON CONFLICT (codigo) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    descripcion = EXCLUDED.descripcion,
    base_legal_codigo = EXCLUDED.base_legal_codigo,
    tabla_origen = EXCLUDED.tabla_origen,
    orden = EXCLUDED.orden;

-- ---------------------------------------------------------------------
-- 3. Registro de consentimientos / aceptaciones por categoria
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trabajador_consentimientos_tratamiento (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    trabajador_id         uuid NOT NULL REFERENCES public.trabajadores(id_trabajador) ON DELETE CASCADE,
    email_corporativo     varchar NOT NULL,
    categoria_codigo      varchar NOT NULL REFERENCES public.cat_categorias_datos(codigo),
    base_legal_codigo     varchar NOT NULL REFERENCES public.cat_bases_legales(codigo),
    aceptado              boolean NOT NULL DEFAULT true,
    version_portal        varchar,
    version_texto_legal   varchar,
    sesion_id             uuid,
    ip_origen             varchar,
    user_agent            text,
    registrado_en         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_consentimientos_trabajador
    ON public.trabajador_consentimientos_tratamiento (trabajador_id);

CREATE INDEX IF NOT EXISTS idx_consentimientos_categoria
    ON public.trabajador_consentimientos_tratamiento (categoria_codigo);

-- ---------------------------------------------------------------------
-- 4. Activos: ver schema_activos.sql (tabla public.activos existente)
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- 5. Row Level Security
-- ---------------------------------------------------------------------
ALTER TABLE public.cat_bases_legales                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cat_categorias_datos                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trabajador_consentimientos_tratamiento ENABLE ROW LEVEL SECURITY;

-- Catalogos: lectura para usuarios autenticados
DROP POLICY IF EXISTS cat_bases_legales_select_auth ON public.cat_bases_legales;
CREATE POLICY cat_bases_legales_select_auth
    ON public.cat_bases_legales FOR SELECT TO authenticated USING (activo = true);

DROP POLICY IF EXISTS cat_categorias_datos_select_auth ON public.cat_categorias_datos;
CREATE POLICY cat_categorias_datos_select_auth
    ON public.cat_categorias_datos FOR SELECT TO authenticated USING (activo = true);

-- Consentimientos: solo el propio trabajador
DROP POLICY IF EXISTS consentimientos_select_self ON public.trabajador_consentimientos_tratamiento;
CREATE POLICY consentimientos_select_self
    ON public.trabajador_consentimientos_tratamiento FOR SELECT TO authenticated
    USING (lower(email_corporativo) = lower(auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS consentimientos_insert_self ON public.trabajador_consentimientos_tratamiento;
CREATE POLICY consentimientos_insert_self
    ON public.trabajador_consentimientos_tratamiento FOR INSERT TO authenticated
    WITH CHECK (lower(email_corporativo) = lower(auth.jwt() ->> 'email'));

-- Activos: ver schema_activos.sql

-- =====================================================================
-- FIN schema_normativa.sql
-- =====================================================================
