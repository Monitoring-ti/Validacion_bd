-- =====================================================================
-- schema_activos_referencial.sql — Activos como declaracion opcional
-- =====================================================================
-- Ejecutar en Supabase si quedo el indice unico de "un computador propio"
-- por trabajador o si se desea reforzar el modelo referencial.
-- =====================================================================

DROP INDEX IF EXISTS public.idx_activos_un_equipo_propio_por_trabajador;

COMMENT ON TABLE public.activos IS
    'Inventario y declaraciones del portal. La informacion del trabajador es referencial y opcional.';

COMMENT ON COLUMN public.activos.detalles_adicionales IS
    'JSON referencial opcional: origen_equipo, numero_serie, ram, almacenamiento, etc.';

-- =====================================================================
-- FIN
-- =====================================================================
