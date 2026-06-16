// =====================================================================
// config.js - Variables configurables del portal de trabajadores
// =====================================================================
// Editar estos valores segun el ambiente. No incluir secretos:
// la anon key es publica por diseno, pero las politicas RLS del
// schema.sql garantizan que cada trabajador solo accede a sus datos.
// =====================================================================

window.CONFIG = {
    // --- Version del portal ---
    APP_VERSION: '1.0.6',

    // --- Supabase ---
    SUPABASE_URL: 'https://wjzdqcttuiixrybxoaqi.supabase.co',
    SUPABASE_ANON_KEY: 'sb_publishable_Vd8reHQz6C18PAcKvNF36g_eemMHc9p',

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

    // --- Contacto soporte (problemas de cuenta / acceso) ---
    SUPPORT_EMAIL: 'ti.soporte@monitoring.cl',

    // --- Email de notificacion (referencia visual / privacidad) ---
    RRHH_NOTIFY_EMAIL: 'ti.soporte@monitoring.cl',

    // --- Politica de privacidad (placeholder para link futuro) ---
    POLITICA_PRIVACIDAD_URL: '',

    // --- Opciones de UI ---
    TALLAS_LETRA: ['S', 'M', 'L', 'XL', 'XXL'],
    TALLAS_BUZO: ['S', 'M', 'L', 'XL'],
    TALLAS_RESPIRADOR: ['Pequeño', 'Mediano', 'Grande'],
    TALLAS_ZAPATO: ['36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47'],
    TIPOS_DOCUMENTO: ['RUT', 'DNI', 'PASAPORTE'],
    TIPOS_CUENTA: ['Corriente', 'Vista', 'CuentaRUT', 'Ahorro'],
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
    ],
    // --- Catalogos para nuevas secciones editables ---
    REGIONES_CHILE: [
        'Arica y Parinacota',
        'Tarapaca',
        'Antofagasta',
        'Atacama',
        'Coquimbo',
        'Valparaiso',
        'Metropolitana',
        'O\'Higgins',
        'Maule',
        '\u00d1uble',
        'Biobio',
        'La Araucania',
        'Los Rios',
        'Los Lagos',
        'Aysen',
        'Magallanes'
    ],
    SISTEMAS_SALUD: ['Fonasa', 'Isapre'],
    AFPS: [
        'AFP Capital',
        'AFP Cuprum',
        'AFP Habitat',
        'AFP Modelo',
        'AFP PlanVital',
        'AFP Provida',
        'AFP Uno'
    ],
    PARENTESCOS: [
        'Conyuge',
        'Conviviente',
        'Padre',
        'Madre',
        'Hijo',
        'Hija',
        'Hermano',
        'Hermana',
        'Pareja',
        'Otro'
    ],
    // --- Tipos de licencia de conducir (Chile) ---
    TIPOS_LICENCIA: [
        'Clase A-1',
        'Clase A-2',
        'Clase A-3',
        'Clase A-4',
        'Clase A-5',
        'Clase B',
        'Clase C',
        'Clase D',
        'Clase E',
        'Clase F'
    ],
    OPCIONES_SEGURO_FALP: [
        'No aplica',
        'Titular FALP',
        'Carga familiar FALP',
        'En tramite de afiliacion'
    ],
    OPCIONES_CARGAS_SEGURO_COMPLEMENTARIO: [
        'Sin seguro complementario',
        '0 cargas familiares',
        '1 carga familiar',
        '2 cargas familiares',
        '3 cargas familiares',
        '4 o mas cargas familiares'
    ]
};
