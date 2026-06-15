// =====================================================================
// config.js - Variables configurables del portal de trabajadores
// =====================================================================
// Editar estos valores segun el ambiente. No incluir secretos:
// la anon key es publica por diseno, pero las politicas RLS del
// schema.sql garantizan que cada trabajador solo accede a sus datos.
// =====================================================================

window.CONFIG = {
    // --- Supabase ---
    SUPABASE_URL: 'https://TU-PROYECTO.supabase.co',
    SUPABASE_ANON_KEY: 'TU-ANON-KEY',

    // --- Dominio corporativo permitido (validacion estricta) ---
    ALLOWED_DOMAIN: '@monitoring.cl',

    // --- Texto legal y su version (para trazabilidad por cambio) ---
    LEGAL_TEXT_VERSION: 'v1.0-2026-06',
    LEGAL_TEXT:
        'Declaro que he revisado los datos mostrados en este formulario y que ' +
        'la informacion ingresada o actualizada por mi es correcta a la fecha. ' +
        'Asimismo, tomo conocimiento de que Monitoring tratara mis datos personales ' +
        'para fines de gestion laboral, operativa, administrativa, de seguridad y ' +
        'cumplimiento, de acuerdo con la normativa aplicable y su politica interna ' +
        'de tratamiento de datos personales.',

    // --- Email de notificacion a RR.HH. (uso futuro / referencia visual) ---
    RRHH_NOTIFY_EMAIL: 'rrhh@monitoring.cl',

    // --- Politica de privacidad (placeholder para link futuro) ---
    POLITICA_PRIVACIDAD_URL: '',

    // --- Opciones de UI ---
    TALLAS_LETRA: ['S', 'M', 'L', 'XL', 'XXL'],
    TALLAS_ZAPATO: ['36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47'],
    TIPOS_DOCUMENTO: ['RUT', 'DNI', 'Pasaporte'],
    TIPOS_CUENTA: ['Cuenta Corriente', 'Cuenta Vista', 'Cuenta de Ahorro', 'Chequera Electronica', 'RUT'],
    BANCOS: [
        'Banco de Chile',
        'Banco Estado',
        'Banco Santander',
        'Banco BCI',
        'Banco Itau',
        'Banco Falabella',
        'Banco Security',
        'Banco BICE',
        'Scotiabank',
        'Banco Ripley',
        'Banco Consorcio',
        'Banco Internacional',
        'Otro'
    ]
};
