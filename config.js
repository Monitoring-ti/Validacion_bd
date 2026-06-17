// =====================================================================
// config.js - Variables configurables del portal de trabajadores
// =====================================================================
// Editar estos valores segun el ambiente. No incluir secretos:
// la anon key es publica por diseno, pero las politicas RLS del
// schema.sql garantizan que cada trabajador solo accede a sus datos.
// =====================================================================

window.CONFIG = {
    // --- Version del portal ---
    APP_VERSION: '1.0.0.1',
    PRODUCTION_ACTIVE: true,

    // --- Supabase ---
    SUPABASE_URL: 'https://wjzdqcttuiixrybxoaqi.supabase.co',
    SUPABASE_ANON_KEY: 'sb_publishable_Vd8reHQz6C18PAcKvNF36g_eemMHc9p',

    // --- Auth: correo → registro con contraseña de verificacion ---
    // Supabase → Authentication → Providers → Email: habilitado
    // Supabase → Authentication → Email → Confirm email: DESACTIVADO
    PASSWORD_MIN_LENGTH: 8,
    PASSWORD_EJEMPLO: '12345678',

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
    ],
    // --- Identidad de genero (columna sexo: M / F / NB en BD) ---
    GENEROS_OPCIONES: [
        { etiqueta: 'Femenino',   bd: 'F'  },
        { etiqueta: 'Masculino',  bd: 'M'  },
        { etiqueta: 'No binario', bd: 'NB' }
    ],
    // Compatibilidad con codigo legacy
    GENEROS: ['Femenino', 'Masculino', 'No binario'],
    MAX_INGRESOS_PORTAL: 5,
    DIAS_ALERTA_VIGENCIA_ID: 90,
    // --- Activos (tabla public.activos) ---
    TIPOS_ACTIVO: ['Notebook', 'Computador', 'Celular', 'Monitor', 'Tablet', 'Radio', 'Otro'],
    ESTADOS_ACTIVO: {
        disponible:           'Disponible',
        pendiente_validacion: 'Pendiente validacion TI',
        asignado:             'Asignado',
        en_reparacion:        'En reparacion',
        devolucion_pendiente: 'Devolucion pendiente',
        dado_baja:            'Dado de baja'
    },
    // --- Catalogo normativo (fallback si aun no se ejecuta schema_normativa.sql) ---
    BASES_LEGALES: [
        { codigo: 'consentimiento', nombre: 'Consentimiento', ejemplo_uso: 'Checkbox explicito en registro y confirmacion del portal.' },
        { codigo: 'contrato', nombre: 'Contrato', ejemplo_uso: 'Datos necesarios para prestar el servicio.' },
        { codigo: 'obligacion_legal', nombre: 'Obligacion legal', ejemplo_uso: 'Datos requeridos por normativa minera y laboral.' },
        { codigo: 'interes_legitimo', nombre: 'Interes legitimo', ejemplo_uso: 'Monitoreo de activos propio de la operacion.' },
        { codigo: 'interes_vital', nombre: 'Interes vital', ejemplo_uso: 'Emergencias de seguridad.' },
        { codigo: 'interes_publico', nombre: 'Interes publico', ejemplo_uso: 'Informacion a organismos reguladores.' }
    ],
    CATEGORIAS_DATOS: [
        { codigo: 'identidad', nombre: 'Identidad y documentacion', base_legal_codigo: 'obligacion_legal' },
        { codigo: 'contacto_personal', nombre: 'Contacto personal', base_legal_codigo: 'contrato' },
        { codigo: 'contacto_emergencia', nombre: 'Contacto de emergencia', base_legal_codigo: 'interes_vital' },
        { codigo: 'domicilio', nombre: 'Domicilio y teletrabajo', base_legal_codigo: 'contrato' },
        { codigo: 'previsional', nombre: 'Datos previsionales y seguros', base_legal_codigo: 'obligacion_legal' },
        { codigo: 'bancarios', nombre: 'Datos bancarios', base_legal_codigo: 'contrato' },
        { codigo: 'epp_tallas', nombre: 'Tallas EPP', base_legal_codigo: 'obligacion_legal' },
        { codigo: 'activos_empresa', nombre: 'Activos entregados por la empresa', base_legal_codigo: 'interes_legitimo' },
        { codigo: 'consentimiento_portal', nombre: 'Consentimiento del portal', base_legal_codigo: 'consentimiento' },
        { codigo: 'regulatorio', nombre: 'Informacion regulatoria', base_legal_codigo: 'interes_publico' }
    ]
};
