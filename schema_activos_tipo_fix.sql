-- =====================================================================
-- schema_activos_tipo_fix.sql — Tipos permitidos en activos (portal)
-- =====================================================================
-- Ejecutar en Supabase SQL Editor (completo, en un solo Run).
-- Corrige: activos_tipo_check al declarar Notebook / Computador propio.
-- Si falla, revisa primero:
--   SELECT tipo, COUNT(*) FROM public.activos GROUP BY tipo ORDER BY 2 DESC;
-- =====================================================================

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

-- 1) Quitar constraint antiguo (permite corregir filas)
ALTER TABLE public.activos DROP CONSTRAINT IF EXISTS activos_tipo_check;

-- 2) Normalizar variantes de texto conocidas
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

-- 3) Filas con tipo desconocido → Otro (conserva datos)
UPDATE public.activos
SET tipo = 'Otro'
WHERE tipo IS NULL
   OR tipo NOT IN (
        'Notebook',
        'Computador propio',
        'Computador',
        'Celular',
        'Monitor',
        'Tablet',
        'Radio',
        'Otro'
    );

-- 4) Recrear constraint (portal + legado TI)
ALTER TABLE public.activos
    ADD CONSTRAINT activos_tipo_check
    CHECK (tipo IN (
        'Notebook',
        'Computador propio',
        'Computador',
        'Celular',
        'Monitor',
        'Tablet',
        'Radio',
        'Otro'
    ));

-- Verificacion
-- SELECT tipo, COUNT(*) FROM public.activos GROUP BY tipo ORDER BY 2 DESC;

-- =====================================================================
-- FIN
-- =====================================================================
