/* =====================================================================
   app.js - Portal del Trabajador Monitoring
   Logica de autenticacion (Supabase Auth + Azure), carga del trabajador,
   render del formulario, modal de correccion de documento, diff y
   guardado con log granular, confirmacion legal y cierre de sesion.
   ===================================================================== */

// ---------- Estado global del modulo ------------------------------------
const STATE = {
    sb: null,                  // cliente Supabase
    user: null,                // user.auth de Supabase (jwt + email)
    trabajador: null,          // fila completa de "trabajadores"
    trabajadorOriginal: null,  // snapshot original para diff
    sesionId: null,            // id de validacion_trabajador_sesiones
    ip: null,                  // ip publica detectada
    userAgent: navigator.userAgent || ''
};

// ---------- Campos editables -------------------------------------------
const CAMPOS_EDITABLES = [
    // Contacto personal
    'email_personal',
    'celular_personal',
    // Contacto de emergencia
    'nombre_contacto_emergencia',
    'parentesco_emergencia',
    'telefono_emergencia',
    // Domicilio
    'region',
    'ciudad',
    'comuna',
    'calle',
    'numero_domicilio',
    'departamento_casa',
    // Previsional
    'afp',
    'sistema_salud',
    'nombre_isapre',
    'valor_plan_uf',
    // Bancarios
    'banco',
    'tipo_cuenta',
    'numero_cuenta',
    // Tallas EPP
    'talla_zapato',
    'talla_pantalon',
    'talla_polera',
    'talla_camisa',
    'talla_chaqueta',
    'talla_guantes',
    'talla_casco',
    'talla_chaleco',
    // Opcionales
    'fecha_vencimiento_id',
    'licencia_conducir_tipo',
    'licencia_conducir_numero',
    'vencimiento_licencia_conducir',
    'pase_codelco',
    'pase_codelco_numero',
    'enfermedades_cronicas'
];

// Etiqueta legible por campo (para resumen y logs visuales)
const ETIQUETAS = {
    email_personal:             'Email personal',
    celular_personal:           'Celular personal',
    nombre_contacto_emergencia: 'Contacto de emergencia',
    parentesco_emergencia:      'Parentesco emergencia',
    telefono_emergencia:        'Telefono de emergencia',
    region:                     'Region',
    ciudad:                     'Ciudad',
    comuna:                     'Comuna',
    calle:                      'Calle',
    numero_domicilio:           'Numero de domicilio',
    departamento_casa:          'Departamento / casa',
    afp:                        'AFP',
    sistema_salud:              'Sistema de salud',
    nombre_isapre:              'Nombre Isapre',
    valor_plan_uf:              'Valor plan (UF)',
    banco:                      'Banco',
    tipo_cuenta:                'Tipo de cuenta',
    numero_cuenta:              'Numero de cuenta',
    talla_zapato:               'Talla zapato',
    talla_pantalon:             'Talla pantalon',
    talla_polera:               'Talla polera',
    talla_camisa:               'Talla camisa',
    talla_chaqueta:             'Talla chaqueta',
    talla_guantes:              'Talla guantes',
    talla_casco:                'Talla casco',
    talla_chaleco:              'Talla chaleco',
    fecha_vencimiento_id:           'Vencimiento cedula',
    licencia_conducir_tipo:         'Tipo de licencia',
    licencia_conducir_numero:       'Numero de licencia',
    vencimiento_licencia_conducir:  'Vencimiento licencia',
    pase_codelco:                   'Pase Codelco',
    pase_codelco_numero:            'Numero pase Codelco',
    enfermedades_cronicas:          'Enfermedades cronicas'
};

// =======================================================================
// PUNTO DE ENTRADA
// =======================================================================
document.addEventListener('DOMContentLoaded', initApp);

async function initApp() {
    try {
        initSupabase();
        bindEventos();
        poblarTextoLegal();
        await detectarIp();
        await procesarSesionActual();
    } catch (err) {
        console.error('Error iniciando app:', err);
        mostrarMensaje('error', 'No se pudo iniciar la aplicacion. Intenta recargar.');
    }
}

// =======================================================================
// SUPABASE
// =======================================================================
function initSupabase() {
    if (!window.supabase || !window.supabase.createClient) {
        throw new Error('Supabase JS no cargado.');
    }
    if (!window.CONFIG || !CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY) {
        throw new Error('Configura SUPABASE_URL y SUPABASE_ANON_KEY en config.js.');
    }
    STATE.sb = window.supabase.createClient(
        CONFIG.SUPABASE_URL,
        CONFIG.SUPABASE_ANON_KEY,
        { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
    );

    STATE.sb.auth.onAuthStateChange((_event, session) => {
        if (session && session.user) {
            manejarSesion(session);
        }
    });
}

// =======================================================================
// EVENTOS DE UI
// =======================================================================
function bindEventos() {
    // Login email + password / logout
    document.getElementById('btn-login').addEventListener('click', autenticar);
    document.getElementById('input-email').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') autenticar();
    });
    document.getElementById('input-password').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') autenticar();
    });
    document.getElementById('tab-signin').addEventListener('click', () => cambiarModoLogin('signin'));
    document.getElementById('tab-signup').addEventListener('click', () => cambiarModoLogin('signup'));
    document.getElementById('btn-logout').addEventListener('click', cerrarSesion);

    // Toggle: si destilda el pase Codelco, se oculta el numero y se limpia.
    const chkPase = document.getElementById('f-pase-codelco');
    if (chkPase) {
        chkPase.addEventListener('change', () => {
            const campoNumero = document.getElementById('campo-pase-numero');
            campoNumero.hidden = !chkPase.checked;
            if (!chkPase.checked) {
                document.getElementById('f-pase-numero').value = '';
            }
        });
    }

    // Modal documento
    document.getElementById('btn-solicitar-correccion')
        .addEventListener('click', abrirModalCorreccionDocumento);
    document.getElementById('btn-enviar-doc')
        .addEventListener('click', onEnviarSolicitudDocumento);

    // Confirmacion legal
    document.getElementById('chk-legal').addEventListener('change', (e) => {
        document.getElementById('btn-confirmar').disabled = !e.target.checked;
    });
    document.getElementById('btn-confirmar').addEventListener('click', mostrarResumenAntesConfirmar);
    document.getElementById('btn-confirmar-final').addEventListener('click', confirmarYEnviar);

    // Cerradores generales de modales
    document.querySelectorAll('[data-close-modal]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-close-modal');
            const dlg = document.getElementById(id);
            if (dlg && dlg.open) dlg.close();
        });
    });

    // Link politica de privacidad (placeholder)
    document.getElementById('link-privacidad').addEventListener('click', (e) => {
        e.preventDefault();
        if (CONFIG.POLITICA_PRIVACIDAD_URL) {
            window.open(CONFIG.POLITICA_PRIVACIDAD_URL, '_blank', 'noopener');
        } else {
            const dlg = document.getElementById('modal-privacidad');
            document.getElementById('privacidad-email').textContent = CONFIG.RRHH_NOTIFY_EMAIL;
            dlg.showModal();
        }
    });
}

function poblarTextoLegal() {
    document.getElementById('texto-legal').textContent = CONFIG.LEGAL_TEXT;
    document.getElementById('legal-version').textContent = CONFIG.LEGAL_TEXT_VERSION;
}

// =======================================================================
// AUTENTICACION (Email + Password)
// =======================================================================
// Estado de login: 'signin' (default) o 'signup' (primera vez).
let MODO_LOGIN = 'signin';

function cambiarModoLogin(modo) {
    MODO_LOGIN = (modo === 'signup') ? 'signup' : 'signin';

    document.getElementById('tab-signin').classList.toggle('active', MODO_LOGIN === 'signin');
    document.getElementById('tab-signup').classList.toggle('active', MODO_LOGIN === 'signup');

    const btn = document.getElementById('btn-login');
    const pwd = document.getElementById('input-password');
    const hint = document.getElementById('hint-password');
    const sub = document.getElementById('login-sub');

    if (MODO_LOGIN === 'signup') {
        btn.textContent = 'Crear contrasena y entrar';
        pwd.setAttribute('autocomplete', 'new-password');
        pwd.placeholder = 'Define una contrasena (minimo 8 caracteres)';
        hint.hidden = false;
        sub.textContent = 'Es tu primera vez? Define una contrasena para tu cuenta corporativa.';
    } else {
        btn.textContent = 'Iniciar sesion';
        pwd.setAttribute('autocomplete', 'current-password');
        pwd.placeholder = 'Ingresa tu contrasena';
        hint.hidden = true;
        sub.textContent = 'Ingresa tu correo corporativo y tu contrasena.';
    }

    document.getElementById('login-error').hidden = true;
}

async function autenticar() {
    const email = (document.getElementById('input-email').value || '').trim().toLowerCase();
    const password = document.getElementById('input-password').value || '';

    document.getElementById('login-error').hidden = true;

    if (!email) { mostrarErrorLogin('Ingresa tu correo corporativo.'); return; }
    if (!password) { mostrarErrorLogin('Ingresa tu contrasena.'); return; }

    // Validacion de dominio.
    if (!validarDominio(email)) {
        mostrarErrorLogin(
            'Solo cuentas que terminen en ' + CONFIG.ALLOWED_DOMAIN + ' pueden acceder.'
        );
        return;
    }

    if (MODO_LOGIN === 'signup' && password.length < 8) {
        mostrarErrorLogin('La contrasena debe tener al menos 8 caracteres.');
        return;
    }

    showLoader();
    try {
        if (MODO_LOGIN === 'signup') {
            const { error } = await STATE.sb.auth.signUp({
                email, password,
                options: { emailRedirectTo: window.location.origin + window.location.pathname }
            });
            if (error) {
                // Si la cuenta ya existe, intentamos iniciar sesion con esa misma password.
                const lc = String(error.message || '').toLowerCase();
                const yaRegistrado = lc.includes('already registered') ||
                                     lc.includes('already been registered') ||
                                     lc.includes('user already exists');
                if (yaRegistrado) {
                    const { error: signInError } = await STATE.sb.auth.signInWithPassword({ email, password });
                    if (signInError) {
                        const lc2 = String(signInError.message || '').toLowerCase();
                        if (lc2.includes('invalid login credentials')) {
                            throw new Error(
                                'Esa cuenta ya existe pero la contrasena no coincide. ' +
                                'Ve a "Iniciar sesion" e ingresa tu contrasena actual.'
                            );
                        }
                        throw signInError;
                    }
                    mostrarMensaje('info', 'Esta cuenta ya estaba registrada. Iniciamos tu sesion.');
                } else {
                    throw error;
                }
            }
        } else {
            const { error } = await STATE.sb.auth.signInWithPassword({ email, password });
            if (error) throw error;
        }
        // onAuthStateChange se encarga de cargar el trabajador.
    } catch (err) {
        console.error('Error autenticando:', err);
        const detalle = (err && (err.message || err.error_description || err.error)) ||
                        (function () { try { return JSON.stringify(err); } catch (_) { return String(err); } })();
        mostrarErrorLogin(traducirErrorAuth(detalle));
    } finally {
        hideLoader();
    }
}

function traducirErrorAuth(msg) {
    if (!msg) return 'No se pudo autenticar.';
    const lc = String(msg).toLowerCase();
    if (lc.includes('invalid login credentials'))
        return 'Correo o contrasena incorrectos. Si es tu primera vez, usa "Primera vez".';
    if (lc.includes('user already registered'))
        return 'Esa cuenta ya esta registrada. Usa "Iniciar sesion".';
    if (lc.includes('email not confirmed'))
        return 'La cuenta existe pero el email no esta confirmado. Contacta a RR.HH.';
    if (lc.includes('password should be at least'))
        return 'La contrasena es demasiado corta. Usa al menos 8 caracteres.';
    return msg;
}

async function procesarSesionActual() {
    const { data } = await STATE.sb.auth.getSession();
    if (data && data.session) {
        await manejarSesion(data.session);
    } else {
        mostrarVistaLogin();
    }
}

async function manejarSesion(session) {
    if (STATE.trabajador) return; // ya manejada en esta carga

    const email = (session.user && session.user.email) ? session.user.email : '';

    if (!validarDominio(email)) {
        await cerrarSesionPorDominio(email);
        return;
    }

    STATE.user = session.user;
    showLoader();
    try {
        const trabajador = await cargarTrabajador(email);
        if (!trabajador) {
            mostrarErrorLogin(
                'Tu cuenta esta autenticada pero no se encontro tu registro de trabajador. ' +
                'Contacta a RR.HH. (' + CONFIG.RRHH_NOTIFY_EMAIL + ').'
            );
            await STATE.sb.auth.signOut();
            return;
        }

        STATE.trabajador = trabajador;
        STATE.trabajadorOriginal = JSON.parse(JSON.stringify(trabajador));

        await actualizarUltimoLoginMicrosoft(trabajador.id_trabajador);
        await crearSesionValidacion(trabajador);
        mostrarVistaApp();
        renderFormulario(trabajador);
    } catch (err) {
        console.error('Error al manejar sesion:', err);
        mostrarMensaje('error', 'No se pudieron cargar tus datos. Intenta nuevamente.');
    } finally {
        hideLoader();
    }
}

function validarDominio(email) {
    if (!email) return false;
    const dom = String(CONFIG.ALLOWED_DOMAIN || '').toLowerCase();
    return String(email).toLowerCase().endsWith(dom);
}

async function cerrarSesionPorDominio(email) {
    try { await STATE.sb.auth.signOut(); } catch (_) {}
    mostrarVistaLogin();
    mostrarErrorLogin(
        'Acceso denegado: la cuenta ' + (email || '') +
        ' no pertenece al dominio ' + CONFIG.ALLOWED_DOMAIN + '. ' +
        'Inicia sesion con tu correo corporativo Monitoring.'
    );
}

async function cerrarSesion() {
    try {
        await STATE.sb.auth.signOut();
    } catch (_) {}
    STATE.user = null;
    STATE.trabajador = null;
    STATE.trabajadorOriginal = null;
    STATE.sesionId = null;
    mostrarVistaLogin();
}

// =======================================================================
// CARGA DEL TRABAJADOR
// =======================================================================
async function cargarTrabajador(email) {
    const { data, error } = await STATE.sb
        .from('trabajadores')
        .select('*')
        .ilike('email_corporativo', email)
        .maybeSingle();

    if (error) {
        console.error('Error consultando trabajadores:', error);
        throw error;
    }
    return data;
}

async function actualizarUltimoLoginMicrosoft(idTrabajador) {
    const { error } = await STATE.sb
        .from('trabajadores')
        .update({ ultimo_login_microsoft: new Date().toISOString() })
        .eq('id_trabajador', idTrabajador);

    if (error) console.warn('No se pudo actualizar ultimo_login_microsoft:', error);
}

async function crearSesionValidacion(trabajador) {
    const payload = {
        trabajador_id:        trabajador.id_trabajador,
        email_corporativo:    trabajador.email_corporativo,
        ip_origen:            STATE.ip,
        user_agent:           STATE.userAgent,
        version_texto_legal:  CONFIG.LEGAL_TEXT_VERSION
    };

    const { data, error } = await STATE.sb
        .from('validacion_trabajador_sesiones')
        .insert(payload)
        .select('id')
        .single();

    if (error) {
        console.warn('No se pudo crear sesion de validacion:', error);
        return;
    }
    STATE.sesionId = data && data.id ? data.id : null;
}

async function detectarIp() {
    try {
        const r = await fetch('https://api.ipify.org?format=json', { cache: 'no-store' });
        if (!r.ok) throw new Error('ipify status ' + r.status);
        const j = await r.json();
        STATE.ip = j && j.ip ? j.ip : null;
    } catch (_) {
        STATE.ip = null;
    }
}

// =======================================================================
// RENDER DEL FORMULARIO
// =======================================================================
function renderFormulario(t) {
    // Header
    const nombre = formatNombreCompleto(t);
    const apellidos = formatApellidos(t);
    document.getElementById('user-nombre').textContent = nombre || apellidos || t.email_corporativo;
    document.getElementById('user-email').textContent  = t.email_corporativo || '';

    // 1. Datos personales (solo lectura)
    setVal('f-nombre-completo',       nombre);
    setVal('f-apellidos',             apellidos);
    setVal('f-nacionalidad',          t.nacionalidad);
    setVal('f-tipo-identificacion',   t.tipo_identificacion);
    setVal('f-numero-identificacion', t.numero_identificacion);
    setVal('f-cargo',                 t.cargo);
    setVal('f-tipo-contrato',         t.tipo_contrato);
    setVal('f-centro-costo',          t.centro_costo);
    setVal('f-unidad',                t.unidad || t.area_departamento);
    setVal('f-email-corporativo',     t.email_corporativo);

    // 2. Contacto personal
    setVal('f-email-personal',   t.email_personal);
    setVal('f-celular-personal', t.celular_personal);

    // 3. Contacto de emergencia
    setVal('f-nombre-emergencia', t.nombre_contacto_emergencia);
    poblarSelect('f-parentesco-emergencia', CONFIG.PARENTESCOS, t.parentesco_emergencia);
    setVal('f-telefono-emergencia', t.telefono_emergencia);

    // 4. Domicilio
    poblarSelect('f-region', CONFIG.REGIONES_CHILE, t.region);
    setVal('f-ciudad',            t.ciudad);
    setVal('f-comuna',            t.comuna);
    setVal('f-calle',             t.calle);
    setVal('f-numero-domicilio',  t.numero_domicilio);
    setVal('f-departamento-casa', t.departamento_casa);

    // 5. Previsional
    poblarSelect('f-afp',           CONFIG.AFPS,            t.afp);
    poblarSelect('f-sistema-salud', CONFIG.SISTEMAS_SALUD,  t.sistema_salud);
    setVal('f-nombre-isapre', t.nombre_isapre);
    setVal('f-valor-plan-uf', t.valor_plan_uf);

    // 6. Datos bancarios (selects + input)
    poblarSelect('f-banco',       CONFIG.BANCOS,       t.banco);
    poblarSelect('f-tipo-cuenta', CONFIG.TIPOS_CUENTA, t.tipo_cuenta);
    setVal('f-numero-cuenta', t.numero_cuenta);

    // 7. Tallas EPP
    poblarSelect('f-talla-zapato',   CONFIG.TALLAS_ZAPATO, t.talla_zapato);
    poblarSelect('f-talla-pantalon', CONFIG.TALLAS_LETRA,  t.talla_pantalon);
    poblarSelect('f-talla-polera',   CONFIG.TALLAS_LETRA,  t.talla_polera);
    poblarSelect('f-talla-camisa',   CONFIG.TALLAS_LETRA,  t.talla_camisa);
    poblarSelect('f-talla-chaqueta', CONFIG.TALLAS_LETRA,  t.talla_chaqueta);
    poblarSelect('f-talla-guantes',  CONFIG.TALLAS_LETRA,  t.talla_guantes);
    poblarSelect('f-talla-casco',    CONFIG.TALLAS_LETRA,  t.talla_casco);
    poblarSelect('f-talla-chaleco',  CONFIG.TALLAS_LETRA,  t.talla_chaleco);

    // 8. Informacion opcional
    setVal('f-fecha-vencimiento-id', formatearFechaInput(t.fecha_vencimiento_id));
    poblarSelect('f-licencia-tipo', CONFIG.TIPOS_LICENCIA, t.licencia_conducir_tipo);
    setVal('f-licencia-numero',     t.licencia_conducir_numero);
    setVal('f-licencia-vencimiento', formatearFechaInput(t.vencimiento_licencia_conducir));

    const chkPase = document.getElementById('f-pase-codelco');
    chkPase.checked = !!t.pase_codelco;
    document.getElementById('campo-pase-numero').hidden = !chkPase.checked;
    setVal('f-pase-numero', t.pase_codelco_numero);

    setVal('f-enfermedades-cronicas', t.enfermedades_cronicas);

    // 9. Checkbox legal: nunca premarcado
    const chk = document.getElementById('chk-legal');
    chk.checked = false;
    document.getElementById('btn-confirmar').disabled = true;
}

// Convierte un valor de fecha de Supabase (ISO o YYYY-MM-DD) al formato
// requerido por <input type="date">: YYYY-MM-DD.
function formatearFechaInput(v) {
    if (!v) return '';
    const s = String(v);
    if (s.length >= 10) return s.substring(0, 10);
    return s;
}

function formatNombreCompleto(t) {
    const partes = [t.nombre_1, t.nombre_2].filter(Boolean);
    return partes.join(' ').trim();
}
function formatApellidos(t) {
    const partes = [t.apellido_paterno, t.apellido_materno].filter(Boolean);
    return partes.join(' ').trim();
}

function poblarSelect(id, opciones, valorActual) {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = '';

    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = '-- Seleccionar --';
    sel.appendChild(empty);

    (opciones || []).forEach((op) => {
        const o = document.createElement('option');
        o.value = String(op);
        o.textContent = String(op);
        sel.appendChild(o);
    });

    const v = valorActual != null ? String(valorActual) : '';
    // Si el valor actual no esta en la lista, lo agregamos para no perderlo.
    if (v && !Array.from(sel.options).some((o) => o.value === v)) {
        const extra = document.createElement('option');
        extra.value = v;
        extra.textContent = v + ' (actual)';
        sel.appendChild(extra);
    }
    sel.value = v;
}

function setVal(id, valor) {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = valor != null ? String(valor) : '';
}

function getVal(id) {
    const el = document.getElementById(id);
    return el ? el.value : '';
}

// =======================================================================
// MODAL: SOLICITUD DE CAMBIO DE DOCUMENTO
// =======================================================================
function abrirModalCorreccionDocumento() {
    const t = STATE.trabajador;
    if (!t) return;

    setVal('doc-tipo-actual',   t.tipo_identificacion);
    setVal('doc-numero-actual', t.numero_identificacion);

    // Tipos posibles en selector
    poblarSelect('doc-tipo-solicitado', CONFIG.TIPOS_DOCUMENTO, t.tipo_identificacion);
    setVal('doc-numero-solicitado', '');
    setVal('doc-motivo', '');

    const dlg = document.getElementById('modal-documento');
    dlg.showModal();
}

async function onEnviarSolicitudDocumento() {
    const tipoSolicitado   = getVal('doc-tipo-solicitado');
    const numeroSolicitado = getVal('doc-numero-solicitado').trim();
    const motivo           = getVal('doc-motivo').trim();

    if (!tipoSolicitado || !numeroSolicitado || !motivo) {
        mostrarMensaje('error', 'Completa tipo, numero y motivo antes de enviar.');
        return;
    }

    showLoader();
    try {
        await enviarSolicitudCambioDocumento({
            tipo_documento_solicitado:   tipoSolicitado,
            numero_documento_solicitado: numeroSolicitado,
            motivo
        });
        document.getElementById('modal-documento').close();
        mostrarMensaje(
            'success',
            'Solicitud enviada. RR.HH. la revisara. El cambio NO se aplica automaticamente.'
        );
    } catch (err) {
        console.error('Error al enviar solicitud documento:', err);
        mostrarMensaje('error', 'No se pudo enviar la solicitud. Intenta nuevamente.');
    } finally {
        hideLoader();
    }
}

async function enviarSolicitudCambioDocumento(payload) {
    const t = STATE.trabajador;
    const fila = {
        trabajador_id:               t.id_trabajador,
        email_corporativo:           t.email_corporativo,
        tipo_documento_actual:       t.tipo_identificacion,
        numero_documento_actual:     t.numero_identificacion,
        tipo_documento_solicitado:   payload.tipo_documento_solicitado,
        numero_documento_solicitado: payload.numero_documento_solicitado,
        motivo:                      payload.motivo,
        estado:                      'pendiente',
        ip_origen:                   STATE.ip,
        user_agent:                  STATE.userAgent
    };

    const { error } = await STATE.sb
        .from('solicitudes_cambio_documento')
        .insert(fila);

    if (error) throw error;
}

// =======================================================================
// DIFF, RESUMEN Y CONFIRMACION
// =======================================================================
function leerValoresActuales() {
    const out = {};
    CAMPOS_EDITABLES.forEach((campo) => {
        const el = document.querySelector('[data-campo="' + campo + '"]');
        if (!el) return;
        if (el.type === 'checkbox') {
            out[campo] = !!el.checked;
        } else {
            out[campo] = el.value != null ? String(el.value) : '';
        }
    });
    // Si el pase Codelco esta destildado, el numero debe ir vacio aunque
    // alguien lo hubiera tipeado antes.
    if (out.pase_codelco === false) {
        out.pase_codelco_numero = '';
    }
    return out;
}

function recolectarCambios(originales, actuales) {
    const cambios = [];
    CAMPOS_EDITABLES.forEach((campo) => {
        const aRaw = originales[campo];
        const dRaw = actuales[campo];
        const esBool = typeof aRaw === 'boolean' || typeof dRaw === 'boolean';

        let antes, desp;
        if (esBool) {
            antes = !!aRaw;
            desp  = !!dRaw;
            if (antes === desp) return;
            cambios.push({
                campo,
                etiqueta: ETIQUETAS[campo] || campo,
                valor_anterior: antes ? 'Si' : 'No',
                valor_nuevo:    desp  ? 'Si' : 'No'
            });
        } else {
            antes = aRaw != null ? String(aRaw) : '';
            desp  = dRaw != null ? String(dRaw) : '';
            // Las fechas en BD pueden venir con timestamp; en el input son YYYY-MM-DD.
            if (antes.length >= 10 && /\d{4}-\d{2}-\d{2}/.test(antes)) antes = antes.substring(0, 10);
            if (antes === desp) return;
            cambios.push({
                campo,
                etiqueta: ETIQUETAS[campo] || campo,
                valor_anterior: antes,
                valor_nuevo: desp
            });
        }
    });
    return cambios;
}

function mostrarResumenAntesConfirmar() {
    if (!document.getElementById('chk-legal').checked) {
        mostrarMensaje('error', 'Debes marcar el checkbox legal para continuar.');
        return;
    }

    const actuales = leerValoresActuales();
    const cambios = recolectarCambios(STATE.trabajadorOriginal, actuales);

    const cont = document.getElementById('resumen-lista');
    cont.innerHTML = '';

    if (cambios.length === 0) {
        const p = document.createElement('p');
        p.className = 'resumen-vacio';
        p.textContent = 'No hay cambios en los campos editables. Se registrara solo la confirmacion legal.';
        cont.appendChild(p);
    } else {
        cambios.forEach((c) => {
            const item = document.createElement('div');
            item.className = 'resumen-item';
            item.innerHTML =
                '<div class="campo">' + escapeHtml(c.etiqueta) + '</div>' +
                '<div class="antes">'   + escapeHtml(c.valor_anterior || '(vacio)') + '</div>' +
                '<div class="flecha">&rarr;</div>' +
                '<div class="despues">' + escapeHtml(c.valor_nuevo || '(vacio)')    + '</div>';
            cont.appendChild(item);
        });
    }

    document.getElementById('modal-resumen').showModal();
}

async function confirmarYEnviar() {
    if (!document.getElementById('chk-legal').checked) {
        mostrarMensaje('error', 'Debes marcar el checkbox legal para confirmar.');
        return;
    }

    const actuales = leerValoresActuales();
    const cambios  = recolectarCambios(STATE.trabajadorOriginal, actuales);

    showLoader();
    try {
        if (cambios.length > 0) {
            await ejecutarPaso('guardarCambiosTrabajador', () => guardarCambiosTrabajador(actuales));
            await ejecutarPaso('registrarLogValidacion',   () => registrarLogValidacion(cambios));
        }
        await ejecutarPaso('marcarConfirmacionLegal', () => marcarConfirmacionLegal());
        await ejecutarPaso('cerrarSesionValidacion', () => cerrarSesionValidacion());

        // refrescar snapshot
        STATE.trabajadorOriginal = Object.assign({}, STATE.trabajadorOriginal, actuales);
        STATE.trabajador         = Object.assign({}, STATE.trabajador,         actuales);

        document.getElementById('modal-resumen').close();
        document.getElementById('btn-confirmar').disabled = true;
        document.getElementById('chk-legal').checked = false;

        mostrarMensaje(
            'success',
            cambios.length > 0
                ? 'Datos actualizados y confirmacion registrada correctamente.'
                : 'Confirmacion registrada correctamente. No habia cambios.'
        );
    } catch (err) {
        console.error('Error al confirmar:', err);
        const detalle = (err && (err.message || err.error_description || err.details || err.hint)) ||
                        (function () { try { return JSON.stringify(err); } catch (_) { return String(err); } })();
        mostrarMensaje('error', 'No se pudo guardar: ' + detalle);
    } finally {
        hideLoader();
    }
}

async function ejecutarPaso(nombre, fn) {
    try {
        return await fn();
    } catch (err) {
        console.error('Fallo en paso [' + nombre + ']:', err);
        const e = new Error('[' + nombre + '] ' + (err && (err.message || err.error_description || err.details) || JSON.stringify(err)));
        e.original = err;
        throw e;
    }
}

async function guardarCambiosTrabajador(actuales) {
    const t = STATE.trabajador;
    // Solo enviamos campos editables, para no tocar nada mas.
    const patch = {};
    CAMPOS_EDITABLES.forEach((campo) => {
        const v = actuales[campo];
        if (typeof v === 'boolean') {
            patch[campo] = v;
        } else {
            patch[campo] = (v != null && v !== '') ? v : null;
        }
    });

    const { error } = await STATE.sb
        .from('trabajadores')
        .update(patch)
        .eq('id_trabajador', t.id_trabajador);

    if (error) throw error;
}

async function registrarLogValidacion(cambios) {
    if (!cambios || cambios.length === 0) return;

    const t = STATE.trabajador;
    const ahora = new Date().toISOString();
    const filas = cambios.map((c) => ({
        trabajador_id:        t.id_trabajador,
        sesion_id:            STATE.sesionId,
        campo:                c.campo,
        valor_anterior:       c.valor_anterior || null,
        valor_nuevo:          c.valor_nuevo   || null,
        modificado_por_email: t.email_corporativo,
        ip_origen:            STATE.ip,
        user_agent:           STATE.userAgent,
        fecha_modificacion:   ahora
    }));

    const { error } = await STATE.sb.from('log_validaciones').insert(filas);
    if (error) {
        console.warn('No se pudo registrar log_validaciones:', error);
        throw error;
    }
}

async function marcarConfirmacionLegal() {
    const t = STATE.trabajador;
    const ahora = new Date().toISOString();
    const patch = {
        datos_confirmados:                true,
        fecha_confirmacion:               ahora,
        acepta_tratamiento_datos:         true,
        fecha_aceptacion_datos:           ahora,
        version_texto_legal:              CONFIG.LEGAL_TEXT_VERSION,
        actualizado_por_email:            t.email_corporativo,
        ultima_actualizacion_autogestion: ahora
    };

    const { error } = await STATE.sb
        .from('trabajadores')
        .update(patch)
        .eq('id_trabajador', t.id_trabajador);

    if (error) throw error;
}

async function cerrarSesionValidacion() {
    if (!STATE.sesionId) return;
    const { error } = await STATE.sb
        .from('validacion_trabajador_sesiones')
        .update({ confirmado_en: new Date().toISOString() })
        .eq('id', STATE.sesionId);

    if (error) console.warn('No se pudo cerrar la sesion de validacion:', error);
}

// =======================================================================
// VISTAS Y FEEDBACK
// =======================================================================
function mostrarVistaLogin() {
    document.getElementById('vista-login').hidden = false;
    document.getElementById('vista-app').hidden   = true;
    const pwd = document.getElementById('input-password');
    if (pwd) pwd.value = '';
    cambiarModoLogin('signin');
}
function mostrarVistaApp() {
    document.getElementById('vista-login').hidden = true;
    document.getElementById('vista-app').hidden   = false;
    document.getElementById('login-error').hidden = true;
}

function mostrarErrorLogin(texto) {
    const el = document.getElementById('login-error');
    el.textContent = texto;
    el.hidden = false;
    document.getElementById('vista-login').hidden = false;
    document.getElementById('vista-app').hidden   = true;
}

function mostrarMensaje(tipo, texto) {
    const cont = document.getElementById('toasts');
    const t = document.createElement('div');
    t.className = 'toast ' + (tipo || 'info');
    t.textContent = texto;
    cont.appendChild(t);
    setTimeout(() => {
        t.style.opacity = '0';
        t.style.transform = 'translateY(-6px)';
        t.style.transition = 'opacity .2s, transform .2s';
        setTimeout(() => t.remove(), 220);
    }, 4500);
}

function showLoader() { document.getElementById('loader').hidden = false; }
function hideLoader() { document.getElementById('loader').hidden = true; }

// Escape HTML basico para resumen
function escapeHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
