-- =====================================================================
-- schema_activos_estado_fix.sql — Estados permitidos en activos (portal)
-- =====================================================================
-- Ejecutar en Supabase SQL Editor (completo, en un solo Run).
-- Si falla, revisa primero:
--   SELECT estado, COUNT(*) FROM public.activos GROUP BY estado ORDER BY 2 DESC;
-- =====================================================================

INSERT INTO public.cat_estado_activo (codigo, nombre, es_final, orden) VALUES
    ('disponible',           'Disponible en bodega',        false, 1),
    ('pendiente_validacion', 'Pendiente validacion TI',     false, 2),
    ('asignado',             'Asignado a trabajador',       false, 3),
    ('en_reparacion',        'En reparacion',               false, 4),
    ('devolucion_pendiente', 'Devolucion pendiente',        false, 5),
    ('dado_baja',            'Dado de baja',                true,  6)
ON CONFLICT (codigo) DO NOTHING;

-- 1) Quitar constraint antiguo (permite corregir filas)
ALTER TABLE public.activos DROP CONSTRAINT IF EXISTS activos_estado_check;

-- 2) Normalizar valores legacy / variantes de texto
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

-- 3) Cualquier valor aun fuera del catalogo → asignado o disponible
UPDATE public.activos
SET estado = CASE
    WHEN id_trabajador_asignado IS NOT NULL THEN 'asignado'
    ELSE 'disponible'
END
WHERE estado IS NULL
   OR estado NOT IN (
        'disponible',
        'pendiente_validacion',
        'asignado',
        'en_reparacion',
        'devolucion_pendiente',
        'dado_baja'
    );

-- 4) Recrear constraint
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

-- Verificacion
-- SELECT estado, COUNT(*) FROM public.activos GROUP BY estado ORDER BY 2 DESC;

-- =====================================================================
-- FIN
-- =====================================================================
