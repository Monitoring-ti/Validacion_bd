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
    userAgent: navigator.userAgent || '',
    activos: [],               // filas de public.activos
    activosHistorial: {},      // id_activo -> eventos[]
    basesLegales: null,        // catalogo desde BD o CONFIG
    categoriasDatos: null      // catalogo desde BD o CONFIG
};

// Campos obligatorios antes de confirmar (ademas del checkbox legal).
const CAMPOS_OBLIGATORIOS = [
    { campo: 'fecha_vencimiento_id', id: 'f-fecha-vencimiento-id', etiqueta: 'Vigencia del carnet de identidad' }
];

// ---------- Campos editables -------------------------------------------
const CAMPOS_EDITABLES = [
    // Datos personales
    'sexo',
    // Contacto personal
    'email_personal',
    'celular_personal',
    // Contacto de emergencia
    'nombre_contacto_emergencia',
    'parentesco_emergencia',
    'telefono_emergencia',
    // Domicilio (vivienda)
    'region',
    'ciudad',
    'comuna',
    'calle',
    'numero_domicilio',
    'departamento_casa',
    // Domicilio (teletrabajo)
    'teletrabajo_misma_direccion',
    'teletrabajo_region',
    'teletrabajo_ciudad',
    'teletrabajo_comuna',
    'teletrabajo_calle',
    'teletrabajo_numero',
    'teletrabajo_departamento',
    // Previsional
    'afp',
    'sistema_salud',
    'nombre_isapre',
    'seguro_falp',
    'cargas_familiares_seguro_complementario',
    // Bancarios
    'banco',
    'tipo_cuenta',
    'numero_cuenta',
    // Tallas EPP
    'talla_zapato',
    'talla_polera',
    'talla_camisa',
    'talla_chaqueta',
    'talla_guantes',
    'talla_casco',
    'talla_chaleco',
    'talla_buzo',
    'respirador',
    // Informacion adicional
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
    sexo:                       'Genero',
    email_personal:             'Email personal',
    celular_personal:           'Celular personal',
    nombre_contacto_emergencia: 'Contacto de emergencia',
    parentesco_emergencia:      'Parentesco emergencia',
    telefono_emergencia:        'Telefono de emergencia',
    region:                     'Region (vivienda)',
    ciudad:                     'Ciudad (vivienda)',
    comuna:                     'Comuna (vivienda)',
    calle:                      'Calle (vivienda)',
    numero_domicilio:           'Numero (vivienda)',
    departamento_casa:          'Departamento (vivienda)',
    teletrabajo_misma_direccion:'Teletrabajo misma direccion',
    teletrabajo_region:         'Region (teletrabajo)',
    teletrabajo_ciudad:         'Ciudad (teletrabajo)',
    teletrabajo_comuna:         'Comuna (teletrabajo)',
    teletrabajo_calle:          'Calle (teletrabajo)',
    teletrabajo_numero:         'Numero (teletrabajo)',
    teletrabajo_departamento:   'Departamento (teletrabajo)',
    afp:                        'AFP',
    sistema_salud:              'Sistema de salud',
    nombre_isapre:              'Nombre Isapre',
    seguro_falp:                'Seguro FALP',
    cargas_familiares_seguro_complementario: 'Cargas familiares seguro complementario',
    banco:                      'Banco',
    tipo_cuenta:                'Tipo de cuenta',
    numero_cuenta:              'Numero de cuenta',
    talla_zapato:               'Talla zapato',
    talla_polera:               'Talla polera',
    talla_camisa:               'Talla camisa',
    talla_chaqueta:             'Talla chaqueta',
    talla_guantes:              'Talla guantes',
    talla_casco:                'Talla casco',
    talla_chaleco:              'Talla chaleco',
    talla_buzo:                 'Talla buzo',
    respirador:                 'Talla respirador',
    fecha_vencimiento_id:           'Vigencia carnet de identidad',
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
        poblarSelectsEstaticos();
        renderMatrizNormativa();
        aplicarVersionApp();
        prepararVistaLogin();
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
    // Login magic link / logout
    document.getElementById('btn-login').addEventListener('click', enviarMagicLink);
    document.getElementById('input-email').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') enviarMagicLink();
    });
    const btnReenviar = document.getElementById('btn-reenviar-magic');
    if (btnReenviar) btnReenviar.addEventListener('click', enviarMagicLink);
    document.getElementById('btn-logout').addEventListener('click', cerrarSesion);

    // Toggle on/off: pase Codelco. Si apagado, oculta numero y limpia.
    const chkPase = document.getElementById('f-pase-codelco');
    if (chkPase) {
        chkPase.addEventListener('change', aplicarVisibilidadPaseCodelco);
    }

    // Toggle on/off: teletrabajo misma direccion. Si apagado, muestra bloque distinto.
    const chkTele = document.getElementById('f-teletrabajo-misma');
    if (chkTele) {
        chkTele.addEventListener('change', aplicarVisibilidadTeletrabajo);
    }

    const fechaId = document.getElementById('f-fecha-vencimiento-id');
    if (fechaId) {
        fechaId.addEventListener('change', () => {
            fechaId.classList.remove('campo-invalido');
            ocultarErrorConfirmacion();
            actualizarEstadoVigenciaDocumento();
        });
        fechaId.addEventListener('input', actualizarEstadoVigenciaDocumento);
    }

    const telEmerg = document.getElementById('f-telefono-emergencia');
    if (telEmerg) {
        telEmerg.addEventListener('change', () => telEmerg.classList.remove('campo-invalido'));
    }

    // Modal documento
    document.getElementById('btn-solicitar-correccion')
        .addEventListener('click', abrirModalCorreccionDocumento);
    document.getElementById('btn-enviar-doc')
        .addEventListener('click', onEnviarSolicitudDocumento);

    // Confirmacion legal
    document.getElementById('chk-legal').addEventListener('change', (e) => {
        document.getElementById('btn-confirmar').disabled = !e.target.checked;
        if (e.target.checked) ocultarErrorConfirmacion();
    });
    document.getElementById('btn-confirmar').addEventListener('click', mostrarResumenAntesConfirmar);
    document.getElementById('btn-confirmar-final').addEventListener('click', confirmarYEnviar);
    document.getElementById('btn-exito-seguir').addEventListener('click', onSeguirEditando);
    document.getElementById('btn-exito-logout').addEventListener('click', onCerrarSesionTrasExito);
    document.getElementById('btn-ingreso-revisar').addEventListener('click', onRevisarDatosTrasIngreso);
    document.getElementById('btn-ingreso-salir').addEventListener('click', onCerrarSesionTrasIngreso);

    const btnActivo = document.getElementById('btn-agregar-activo');
    if (btnActivo) btnActivo.addEventListener('click', onAgregarActivo);

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
            document.getElementById('privacidad-email').textContent = emailSoporte();
            dlg.showModal();
        }
    });
}

function poblarTextoLegal() {
    document.getElementById('texto-legal').textContent = CONFIG.LEGAL_TEXT;
    document.getElementById('legal-version').textContent = CONFIG.LEGAL_TEXT_VERSION;
}

function poblarSelectsEstaticos() {
    poblarSelectGenero('f-genero', '');
    poblarSelect('activo-tipo', CONFIG.TIPOS_ACTIVO, '');
}

function generoEtiqueta(valorBd) {
    const hit = (CONFIG.GENEROS_OPCIONES || []).find((g) => g.bd === valorBd);
    if (hit) return hit.etiqueta;
    const v = String(valorBd || '').toUpperCase();
    if (v === 'F' || v === 'FEMENINO') return 'Femenino';
    if (v === 'M' || v === 'MASCULINO') return 'Masculino';
    if (v === 'NB' || v === 'NO BINARIO') return 'No binario';
    return valorBd || '';
}

function normalizarGeneroBd(valor) {
    if (!valor) return '';
    const v = String(valor).trim();
    const upper = v.toUpperCase();
    if (upper === 'F' || upper === 'FEMENINO' || v === 'Femenino') return 'F';
    if (upper === 'M' || upper === 'MASCULINO' || v === 'Masculino') return 'M';
    if (upper === 'NB' || upper === 'NO BINARIO' || v === 'No binario') return 'NB';
    const hit = (CONFIG.GENEROS_OPCIONES || []).find((g) => g.etiqueta === v);
    return hit ? hit.bd : v;
}

function normalizarGenero(valor) {
    return generoEtiqueta(normalizarGeneroBd(valor));
}

function poblarSelectGenero(id, valorBd) {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = '';

    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = '-- Seleccionar --';
    sel.appendChild(empty);

    (CONFIG.GENEROS_OPCIONES || []).forEach((g) => {
        const o = document.createElement('option');
        o.value = g.bd;
        o.textContent = g.etiqueta;
        sel.appendChild(o);
    });

    const bd = normalizarGeneroBd(valorBd);
    if (bd && !Array.from(sel.options).some((o) => o.value === bd)) {
        const extra = document.createElement('option');
        extra.value = bd;
        extra.textContent = generoEtiqueta(bd) + ' (actual)';
        sel.appendChild(extra);
    }
    sel.value = bd || '';
}

function paisDesdeTrabajador(t) {
    const n = String((t && t.nacionalidad) || '').toLowerCase();
    if (n.includes('peru') || n.includes('per?')) return 'PE';
    return 'CL';
}

function aplicarHintsPais(t) {
    const pais = paisDesdeTrabajador(t);
    const hintTel = document.getElementById('hint-telefono-emergencia');
    const hintNum = document.getElementById('hint-numero-domicilio');
    const tel = document.getElementById('f-telefono-emergencia');

    if (hintTel) {
        hintTel.textContent = pais === 'PE'
            ? 'Peru: movil de 9 digitos comenzando en 9. Ej. +51 987 654 321'
            : 'Chile: movil de 9 digitos comenzando en 9. Ej. +56 9 8765 4321';
    }
    if (hintNum) {
        hintNum.textContent = pais === 'PE'
            ? 'Peru: numero, manzana y lote (Ej. Mz A Lt 5) o S/N.'
            : 'Chile: numero, complemento (Ej. 1234-A) o S/N.';
    }
    if (tel) {
        tel.placeholder = pais === 'PE' ? '+51 987 654 321' : '+56 9 8765 4321';
    }
}

function soloDigitosTelefono(s) {
    return String(s || '').replace(/\D/g, '');
}

function normalizarTelefonoParaBD(telefono, pais) {
    const d = soloDigitosTelefono(telefono);
    if (!d) return null;
    if (pais === 'PE') {
        if (d.length === 9 && d.startsWith('9')) return '+51' + d;
        if (d.startsWith('51') && d.length === 11) return '+' + d;
        return '+' + d;
    }
    if (d.length === 9 && d.startsWith('9')) return '+56' + d;
    if (d.startsWith('56') && d.length === 11) return '+' + d;
    return '+' + d;
}

function validarTelefonoEmergencia(telefono, pais) {
    if (!telefono || !String(telefono).trim()) return { ok: true };
    const d = soloDigitosTelefono(telefono);
    if (pais === 'PE') {
        const local = d.startsWith('51') ? d.slice(2) : d;
        if (local.length === 9 && local.startsWith('9')) return { ok: true };
        return { ok: false, mensaje: 'Telefono Peru invalido. Usa 9 digitos comenzando en 9.' };
    }
    const local = d.startsWith('56') ? d.slice(2) : d;
    if (local.length === 9 && local.startsWith('9')) return { ok: true };
    return { ok: false, mensaje: 'Telefono Chile invalido. Usa 9 digitos comenzando en 9.' };
}

function validarNumeroDomicilio(valor, pais) {
    if (!valor || !String(valor).trim()) return { ok: true };
    const v = String(valor).trim();
    const reCL = /^(\d{1,6}([\-\s]?[A-Za-z0-9]{1,4})?|S\s*\/?\s*N|SN|sin\s*numer[o?]?)$/i;
    const rePE = /^(\d{1,6}|Mz\.?\s*[A-Za-z0-9]+\s*Lt\.?\s*[A-Za-z0-9]+|S\s*\/?\s*N|SN|sin\s*numer[o?]?)$/i;
    const re = pais === 'PE' ? rePE : reCL;
    if (re.test(v)) return { ok: true };
    return {
        ok: false,
        mensaje: pais === 'PE'
            ? 'Numero invalido para Peru. Ej: 123, Mz A Lt 5 o S/N.'
            : 'Numero invalido para Chile. Ej: 1234, 1234-A o S/N.'
    };
}

function evaluarVigenciaDocumento(fechaStr) {
    if (!fechaStr || !String(fechaStr).trim()) {
        return { estado: 'sin_fecha', mensaje: 'Ingresa la fecha de vencimiento.', bloquea: true };
    }
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const f = new Date(fechaStr + 'T12:00:00');
    if (isNaN(f.getTime())) {
        return { estado: 'invalida', mensaje: 'Fecha de vencimiento invalida.', bloquea: true };
    }
    const diffDias = Math.ceil((f - hoy) / 86400000);
    const umbral = CONFIG.DIAS_ALERTA_VIGENCIA_ID || 90;
    if (diffDias < 0) {
        return {
            estado: 'vencido',
            mensaje: 'Documento vencido. Actualiza la fecha de vigencia antes de confirmar.',
            bloquea: true
        };
    }
    if (diffDias <= umbral) {
        return {
            estado: 'por_vencer',
            mensaje: 'Documento por vencer (en ' + diffDias + ' dias). Puedes confirmar, pero renuevalo pronto.',
            bloquea: false
        };
    }
    return { estado: 'vigente', mensaje: 'Documento vigente.', bloquea: false };
}

function actualizarEstadoVigenciaDocumento() {
    const input = document.getElementById('f-fecha-vencimiento-id');
    const el = document.getElementById('fecha-vencimiento-estado');
    if (!input || !el) return;
    const ev = evaluarVigenciaDocumento(input.value);
    el.textContent = ev.mensaje;
    el.className = 'field-hint field-estado-vigencia estado-' + ev.estado;
    if (ev.bloquea) input.classList.add('campo-invalido');
    else input.classList.remove('campo-invalido');
}

function validarFormatosFormulario(actuales) {
    const t = STATE.trabajador;
    const pais = paisDesdeTrabajador(t);
    const errores = [];

    const vig = evaluarVigenciaDocumento(actuales.fecha_vencimiento_id);
    if (vig.bloquea) {
        errores.push({ campo: 'fecha_vencimiento_id', id: 'f-fecha-vencimiento-id', mensaje: vig.mensaje });
    }

    const tel = validarTelefonoEmergencia(actuales.telefono_emergencia, pais);
    if (!tel.ok) {
        errores.push({ campo: 'telefono_emergencia', id: 'f-telefono-emergencia', mensaje: tel.mensaje });
    }

    const num = validarNumeroDomicilio(actuales.numero_domicilio, pais);
    if (!num.ok) {
        errores.push({ campo: 'numero_domicilio', id: 'f-numero-domicilio', mensaje: num.mensaje });
    }

    if (actuales.teletrabajo_misma_direccion === false && actuales.teletrabajo_numero) {
        const numT = validarNumeroDomicilio(actuales.teletrabajo_numero, pais);
        if (!numT.ok) {
            errores.push({ campo: 'teletrabajo_numero', id: 'f-teletrabajo-numero', mensaje: numT.mensaje });
        }
    }

    const sexoBd = normalizarGeneroBd(actuales.sexo);
    if (actuales.sexo && !['F', 'M', 'NB'].includes(sexoBd)) {
        errores.push({ campo: 'sexo', id: 'f-genero', mensaje: 'Selecciona un genero valido.' });
    }

    return errores;
}

function marcarErroresFormato(errores) {
    document.querySelectorAll('.campo-invalido').forEach((el) => {
        if (el.id !== 'f-fecha-vencimiento-id') el.classList.remove('campo-invalido');
    });
    (errores || []).forEach((e) => {
        const el = document.getElementById(e.id);
        if (el) el.classList.add('campo-invalido');
    });
}

function bloquearConfirmacionPorFormatos(actuales, opts) {
    const errores = validarFormatosFormulario(actuales);
    if (!errores.length) {
        marcarErroresFormato([]);
        return false;
    }
    if (opts && opts.cerrarResumen) cerrarModalResumen();
    marcarErroresFormato(errores);
    const mensaje = errores.map((e) => e.mensaje).join(' ');
    mostrarErrorConfirmacion(mensaje, errores);
    return true;
}

function nombreBaseLegal(codigo) {
    const bases = STATE.basesLegales || CONFIG.BASES_LEGALES || [];
    const hit = bases.find((b) => b.codigo === codigo);
    return hit ? (hit.nombre || codigo) : codigo;
}

function renderMatrizNormativa() {
    const bases = STATE.basesLegales || CONFIG.BASES_LEGALES || [];
    const categorias = STATE.categoriasDatos || CONFIG.CATEGORIAS_DATOS || [];
    const tbBases = document.getElementById('tbody-bases-legales');
    const tbCats = document.getElementById('tbody-categorias-datos');
    if (!tbBases || !tbCats) return;

    tbBases.innerHTML = '';
    bases.forEach((b) => {
        const tr = document.createElement('tr');
        tr.innerHTML =
            '<td>' + escapeHtml(b.nombre || b.codigo) + '</td>' +
            '<td>' + escapeHtml(b.ejemplo_uso || '') + '</td>';
        tbBases.appendChild(tr);
    });

    tbCats.innerHTML = '';
    categorias.forEach((c) => {
        const tr = document.createElement('tr');
        tr.innerHTML =
            '<td>' + escapeHtml(c.nombre || c.codigo) + '</td>' +
            '<td>' + escapeHtml(nombreBaseLegal(c.base_legal_codigo)) + '</td>';
        tbCats.appendChild(tr);
    });
}

function emailSoporte() {
    return (CONFIG && (CONFIG.SUPPORT_EMAIL || CONFIG.RRHH_NOTIFY_EMAIL)) ||
           'ti.soporte@monitoring.cl';
}

function bindTogglePassword() {
    const btn = document.getElementById('btn-toggle-password');
    const input = document.getElementById('input-password');
    if (!btn || !input) return;

    btn.addEventListener('click', () => {
        const mostrar = input.type === 'password';
        input.type = mostrar ? 'text' : 'password';
        btn.classList.toggle('is-revealed', mostrar);
        btn.setAttribute('aria-pressed', mostrar ? 'true' : 'false');
        btn.setAttribute('aria-label', mostrar ? 'Ocultar contrase?a' : 'Mostrar contrase?a');
        btn.title = mostrar ? 'Ocultar contrase?a' : 'Mostrar contrase?a';
    });
}

function aplicarVersionApp() {
    const raw = (CONFIG && CONFIG.APP_VERSION) ? String(CONFIG.APP_VERSION).trim() : '1.1.0';
    const label = raw.startsWith('v') ? raw : ('v' + raw);
    document.querySelectorAll('[data-app-version]').forEach((el) => {
        el.textContent = label;
    });
    const soporte = emailSoporte();
    const linkSoporte = document.getElementById('login-support-email');
    if (linkSoporte) {
        linkSoporte.textContent = soporte;
        linkSoporte.href = 'mailto:' + soporte;
    }
}

// =======================================================================
// AUTENTICACION (Magic Link - Supabase OTP email)
// =======================================================================

let magicLinkCooldownTimer = null;

function urlRedirectMagicLink() {
    return window.location.origin + window.location.pathname;
}

function esCallbackMagicLinkEnUrl() {
    const h = window.location.hash || '';
    const q = window.location.search || '';
    return h.includes('access_token=') || h.includes('type=magiclink') ||
           q.includes('code=') || q.includes('token_hash=');
}

function limpiarParametrosAuthEnUrl() {
    if (!window.location.hash && !window.location.search) return;
    if (esCallbackMagicLinkEnUrl() || window.location.hash) {
        try {
            window.history.replaceState({}, document.title, window.location.pathname);
        } catch (_) {}
    }
}

function mostrarEstadoMagicLinkEnviado(email) {
    const form = document.getElementById('login-form-box');
    const pending = document.getElementById('login-pending');
    const texto = document.getElementById('login-pending-texto');
    if (form) form.hidden = true;
    if (pending) pending.hidden = false;
    if (texto) {
        texto.textContent = 'Enviamos un enlace a ' + email + '. Abre el correo en este equipo y pulsa el enlace para entrar.';
    }
    iniciarCooldownReenvioMagicLink();
}

function ocultarEstadoMagicLinkEnviado() {
    const form = document.getElementById('login-form-box');
    const pending = document.getElementById('login-pending');
    if (form) form.hidden = false;
    if (pending) pending.hidden = true;
}

function iniciarCooldownReenvioMagicLink() {
    const btn = document.getElementById('btn-reenviar-magic');
    if (!btn) return;
    const total = CONFIG.MAGIC_LINK_COOLDOWN_SEC || 60;
    let restante = total;
    btn.disabled = true;
    btn.textContent = 'Reenviar en ' + restante + ' s';
    if (magicLinkCooldownTimer) clearInterval(magicLinkCooldownTimer);
    magicLinkCooldownTimer = setInterval(() => {
        restante -= 1;
        if (restante <= 0) {
            clearInterval(magicLinkCooldownTimer);
            magicLinkCooldownTimer = null;
            btn.disabled = false;
            btn.textContent = 'Reenviar enlace';
            return;
        }
        btn.textContent = 'Reenviar en ' + restante + ' s';
    }, 1000);
}

function extraerMensajeError(err) {
    if (!err) return '';
    if (err.message) return String(err.message);
    if (err.error_description) return String(err.error_description);
    if (err.error) return String(err.error);
    try { return JSON.stringify(err); } catch (_) { return String(err); }
}

async function enviarMagicLink() {
    const email = (document.getElementById('input-email').value || '').trim().toLowerCase();
    ocultarErrorLogin();

    if (!email) {
        mostrarErrorLogin('Ingresa tu correo corporativo.', { titulo: 'Correo requerido', tipo: 'warn' });
        return;
    }

    if (!validarDominio(email)) {
        const soporte = emailSoporte();
        mostrarErrorLogin(
            'El correo ' + email + ' no pertenece a Monitoring. ' +
            'Verifica que termine en ' + CONFIG.ALLOWED_DOMAIN + '. ' +
            'Si crees que es un error, escribe a ' + soporte + '.',
            { titulo: 'Dominio no permitido', tipo: 'error' }
        );
        return;
    }

    showLoader();
    try {
        const { error } = await STATE.sb.auth.signInWithOtp({
            email,
            options: {
                emailRedirectTo: urlRedirectMagicLink(),
                shouldCreateUser: true
            }
        });
        if (error) throw error;
        mostrarEstadoMagicLinkEnviado(email);
        mostrarMensaje('success', 'Enlace enviado. Revisa tu correo corporativo.');
    } catch (err) {
        console.error('Error enviando magic link:', err);
        const detalle = extraerMensajeError(err);
        const tr = traducirErrorAuth(detalle, err);
        mostrarErrorLogin(tr.mensaje, { titulo: tr.titulo, tipo: tr.tipo });
    } finally {
        hideLoader();
    }
}

function ocultarErrorLogin() {
    const el = document.getElementById('login-error');
    if (!el) return;
    el.hidden = true;
    el.innerHTML = '';
    el.classList.remove('alert-error', 'alert-warn', 'alert-info');
    el.removeAttribute('role');
}

function prepararVistaLogin() {
    ocultarErrorLogin();
    ocultarEstadoMagicLinkEnviado();
    const banner = document.getElementById('login-banner-reingreso');
    if (banner) {
        try {
            const flag = sessionStorage.getItem('valida_bd_reingreso_confirmado');
            banner.hidden = flag !== '1';
            if (flag === '1') sessionStorage.removeItem('valida_bd_reingreso_confirmado');
        } catch (_) {
            banner.hidden = true;
        }
    }
    const bannerOk = document.getElementById('login-banner-confirmacion-ok');
    if (bannerOk) {
        try {
            const msg = sessionStorage.getItem('valida_bd_confirmacion_ok');
            if (msg) {
                bannerOk.textContent = msg;
                bannerOk.hidden = false;
                sessionStorage.removeItem('valida_bd_confirmacion_ok');
            } else {
                bannerOk.hidden = true;
                bannerOk.textContent = '';
            }
        } catch (_) {
            bannerOk.hidden = true;
        }
    }
}

function trabajadorYaConfirmado(t) {
    if (!t) return false;
    return t.datos_confirmados === true || t.datos_confirmados === 'true' || t.datos_confirmados === 1;
}

function formatearFechaLegible(iso) {
    if (!iso) return '';
    try {
        const d = new Date(iso);
        if (isNaN(d.getTime())) return String(iso).substring(0, 10);
        return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' });
    } catch (_) {
        return String(iso).substring(0, 10);
    }
}

function textoFechaConfirmacion(t) {
    const f = formatearFechaLegible(t && t.fecha_confirmacion);
    return f ? ('Confirmaste el ' + f + '.') : 'Tu confirmacion ya esta registrada en el sistema.';
}

function esErrorCuentaYaRegistrada(msg) {
    const lc = String(msg || '').toLowerCase();
    return lc.includes('already registered') ||
           lc.includes('already been registered') ||
           lc.includes('user already exists');
}

// Devuelve { titulo, mensaje, tipo } segun el error de autenticacion.
function traducirErrorAuth(msg, errObj) {
    const dominio = CONFIG.ALLOWED_DOMAIN || '@monitoring.cl';
    const soporte = emailSoporte();
    const status = errObj && (errObj.status || errObj.code);

    if (!msg) {
        return { titulo: 'No se pudo autenticar', mensaje: 'Intenta nuevamente en unos segundos.', tipo: 'error' };
    }

    const lc = String(msg).toLowerCase();

    if (status === 500 || lc.includes('internal server error') || lc.includes('error sending confirmation email') ||
        lc.includes('error sending magic link') || lc.includes('smtp')) {
        return {
            titulo: 'No se pudo enviar el correo',
            mensaje: 'Supabase no pudo enviar el enlace magico. TI debe configurar SMTP en el proyecto ' +
                     '(Authentication ? SMTP Settings). Mientras tanto, escribe a ' + soporte + '.',
            tipo: 'error'
        };
    }
    if (lc.includes('signup is disabled') || lc.includes('signups not allowed')) {
        return {
            titulo: 'Registro no habilitado',
            mensaje: 'El acceso por enlace no esta habilitado para nuevas cuentas. Contacta a ' + soporte + '.',
            tipo: 'error'
        };
    }
    if (lc.includes('email address is invalid') || lc.includes('invalid email')) {
        return {
            titulo: 'Correo invalido',
            mensaje: 'El formato del correo no es valido. Usa tu cuenta ' + dominio + '.',
            tipo: 'warn'
        };
    }
    if (lc.includes('email not confirmed')) {
        return {
            titulo: 'Correo sin confirmar',
            mensaje: 'La cuenta existe pero el correo aun no esta confirmado. Escribe a ' + soporte + '.',
            tipo: 'warn'
        };
    }
    if (lc.includes('rate limit') || lc.includes('too many requests') || lc.includes('over_email_send_rate_limit')) {
        return {
            titulo: 'Demasiados intentos',
            mensaje: 'Hubo demasiados envios seguidos. Espera unos minutos y vuelve a intentar.',
            tipo: 'warn'
        };
    }
    if (lc.includes('user already registered') || lc.includes('already been registered') || lc.includes('user already exists')) {
        return {
            titulo: 'Cuenta ya registrada',
            mensaje: 'Si ya recibiste un enlace antes, revisa tu correo. Tambien puedes solicitar reenvio.',
            tipo: 'info'
        };
    }
    return { titulo: 'No se pudo enviar el enlace', mensaje: msg, tipo: 'error' };
}

async function obtenerSesionTrasMagicLink() {
    const reintentos = esCallbackMagicLinkEnUrl() ? 6 : 1;
    for (let i = 0; i < reintentos; i++) {
        const { data, error } = await STATE.sb.auth.getSession();
        if (error) throw error;
        if (data && data.session) return data.session;
        if (!esCallbackMagicLinkEnUrl()) break;
        await new Promise((r) => setTimeout(r, 350));
    }

    const code = new URLSearchParams(window.location.search).get('code');
    if (code) {
        const { data, error } = await STATE.sb.auth.exchangeCodeForSession(code);
        if (error) throw error;
        if (data && data.session) return data.session;
    }

    const { data } = await STATE.sb.auth.getSession();
    return (data && data.session) ? data.session : null;
}

async function procesarSesionActual() {
    if (esCallbackMagicLinkEnUrl()) showLoader();
    try {
        const session = await obtenerSesionTrasMagicLink();
        if (session) {
            await manejarSesion(session);
        } else if (esCallbackMagicLinkEnUrl()) {
            mostrarVistaLogin();
            mostrarErrorLogin(
                'No pudimos validar el enlace. Puede haber expirado o ya fue usado. Solicita un enlace nuevo.',
                { titulo: 'Enlace invalido o expirado', tipo: 'warn' }
            );
        } else {
            mostrarVistaLogin();
        }
    } catch (err) {
        console.error('Error procesando callback magic link:', err);
        mostrarVistaLogin();
        if (esCallbackMagicLinkEnUrl()) {
            const detalle = extraerMensajeError(err);
            const tr = traducirErrorAuth(detalle, err);
            mostrarErrorLogin(tr.mensaje, { titulo: tr.titulo || 'No se pudo iniciar sesion', tipo: tr.tipo });
        }
    } finally {
        limpiarParametrosAuthEnUrl();
        hideLoader();
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
            const dominio = CONFIG.ALLOWED_DOMAIN || '@monitoring.cl';
            const soporte = emailSoporte();
            mostrarErrorLogin(
                'Tu correo ' + email + ' no figura en la base de trabajadores. ' +
                'Verifica que esta bien escrito y que termine en ' + dominio + '. ' +
                'Si esta correcto, escribe a ' + soporte + '.',
                { titulo: 'Cuenta no encontrada', tipo: 'error' }
            );
            mostrarMensaje('error', 'Cuenta no encontrada en la base de trabajadores');
            await STATE.sb.auth.signOut();
            return;
        }

        if (trabajador.sexo) {
            trabajador.sexo = normalizarGeneroBd(trabajador.sexo);
        }

        const accesoOk = await procesarIngresoPortal(trabajador);
        if (!accesoOk) return;

        STATE.trabajador = trabajador;
        STATE.trabajadorOriginal = JSON.parse(JSON.stringify(trabajador));

        await actualizarUltimoLoginMicrosoft(trabajador.id_trabajador);
        if (!trabajadorYaConfirmado(trabajador)) {
            await crearSesionValidacion(trabajador);
        } else {
            STATE.sesionId = null;
        }
        mostrarVistaApp();
        renderFormulario(trabajador);
        await cargarCatalogoNormativo();
        await cargarActivosEmpresa(trabajador.id_trabajador);
        if (trabajadorYaConfirmado(trabajador)) {
            mostrarModalIngresoConfirmado(trabajador);
        }
        limpiarParametrosAuthEnUrl();
        ocultarEstadoMagicLinkEnviado();
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
    const estabaConfirmado = STATE.trabajador && trabajadorYaConfirmado(STATE.trabajador);
    try {
        await STATE.sb.auth.signOut();
    } catch (_) {}
    if (estabaConfirmado) {
        try { sessionStorage.setItem('valida_bd_reingreso_confirmado', '1'); } catch (_) {}
    }
    STATE.user = null;
    STATE.trabajador = null;
    STATE.trabajadorOriginal = null;
    STATE.sesionId = null;
    STATE.activos = [];
    STATE.activosHistorial = {};
    const dlgIngreso = document.getElementById('modal-ingreso-confirmado');
    const dlgExito = document.getElementById('modal-exito');
    if (dlgIngreso && dlgIngreso.open) dlgIngreso.close();
    if (dlgExito && dlgExito.open) dlgExito.close();
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

async function procesarIngresoPortal(trabajador) {
    const limite = CONFIG.MAX_INGRESOS_PORTAL || 3;
    const yaAutorizado = !!trabajador.portal_autorizado_ti;
    const countActual = parseInt(trabajador.ingresos_portal_count, 10) || 0;

    if (countActual >= limite && !yaAutorizado) {
        mostrarBloqueoAutorizacionTI(trabajador, countActual);
        await STATE.sb.auth.signOut();
        return false;
    }

    const nuevoCount = countActual + 1;
    const requiereTi = nuevoCount >= limite && !yaAutorizado;

    try {
        const patch = { ingresos_portal_count: nuevoCount };
        if (requiereTi) patch.portal_requiere_autorizacion_ti = true;

        const { error } = await STATE.sb
            .from('trabajadores')
            .update(patch)
            .eq('id_trabajador', trabajador.id_trabajador);

        if (error) {
            console.warn('No se pudo actualizar contador de ingresos:', error);
        } else {
            trabajador.ingresos_portal_count = nuevoCount;
            if (requiereTi) trabajador.portal_requiere_autorizacion_ti = true;
        }

        if (requiereTi) {
            await crearSolicitudAutorizacionTI(trabajador, nuevoCount);
            mostrarBloqueoAutorizacionTI(trabajador, nuevoCount);
            await STATE.sb.auth.signOut();
            return false;
        }
    } catch (err) {
        console.warn('Error en control de ingresos portal:', err);
    }

    return true;
}

async function crearSolicitudAutorizacionTI(trabajador, numeroIngreso) {
    try {
        const { error } = await STATE.sb
            .from('solicitudes_autorizacion_portal')
            .insert({
                trabajador_id:     trabajador.id_trabajador,
                email_corporativo: trabajador.email_corporativo,
                numero_ingreso:    numeroIngreso,
                estado:            'pendiente',
                ip_origen:         STATE.ip,
                user_agent:        STATE.userAgent
            });
        if (error) console.warn('No se pudo registrar solicitud autorizacion TI:', error);
    } catch (err) {
        console.warn('Tabla solicitudes_autorizacion_portal no disponible:', err);
    }
}

function mostrarBloqueoAutorizacionTI(trabajador, count) {
    const soporte = emailSoporte();
    mostrarErrorLogin(
        'Has ingresado ' + count + ' veces al portal de validacion. Por seguridad, el acceso requiere autorizacion de TI. ' +
        'Escribe a ' + soporte + ' indicando tu correo ' + (trabajador.email_corporativo || '') + ' para habilitar tu cuenta.',
        { titulo: 'Autorizacion de TI requerida', tipo: 'warn' }
    );
    mostrarMensaje('warn', 'Acceso pendiente de autorizacion TI.');
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
    setVal('f-tipo-contrato',         t.tipo_contrato);
    setVal('f-email-corporativo',     t.email_corporativo);
    poblarSelectGenero('f-genero', t.sexo);
    setVal('f-fecha-vencimiento-id', formatearFechaInput(t.fecha_vencimiento_id));
    actualizarEstadoVigenciaDocumento();
    aplicarHintsPais(t);

    // 2. Contacto personal
    setVal('f-email-personal',   t.email_personal);
    setVal('f-celular-personal', t.celular_personal);

    // 3. Contacto de emergencia
    setVal('f-nombre-emergencia', t.nombre_contacto_emergencia);
    poblarSelect('f-parentesco-emergencia', CONFIG.PARENTESCOS, t.parentesco_emergencia);
    setVal('f-telefono-emergencia', t.telefono_emergencia);

    // 4. Domicilio - Vivienda
    poblarSelect('f-region', CONFIG.REGIONES_CHILE, t.region);
    setVal('f-ciudad',            t.ciudad);
    setVal('f-comuna',            t.comuna);
    setVal('f-calle',             t.calle);
    setVal('f-numero-domicilio',  t.numero_domicilio);
    setVal('f-departamento-casa', t.departamento_casa);

    // 4. Domicilio - Teletrabajo (toggle on/off + bloque condicional)
    // Si nunca se ha definido en BD, asumimos true (misma direccion).
    const mismaTele = (t.teletrabajo_misma_direccion === undefined || t.teletrabajo_misma_direccion === null)
        ? true
        : !!t.teletrabajo_misma_direccion;
    document.getElementById('f-teletrabajo-misma').checked = mismaTele;

    poblarSelect('f-teletrabajo-region', CONFIG.REGIONES_CHILE, t.teletrabajo_region);
    setVal('f-teletrabajo-ciudad',       t.teletrabajo_ciudad);
    setVal('f-teletrabajo-comuna',       t.teletrabajo_comuna);
    setVal('f-teletrabajo-calle',        t.teletrabajo_calle);
    setVal('f-teletrabajo-numero',       t.teletrabajo_numero);
    setVal('f-teletrabajo-departamento', t.teletrabajo_departamento);

    aplicarVisibilidadTeletrabajo();

    // 5. Previsional
    poblarSelect('f-afp',           CONFIG.AFPS,            t.afp);
    poblarSelect('f-sistema-salud', CONFIG.SISTEMAS_SALUD,  t.sistema_salud);
    setVal('f-nombre-isapre', t.nombre_isapre);
    poblarSelect('f-seguro-falp', CONFIG.OPCIONES_SEGURO_FALP, t.seguro_falp);
    poblarSelect('f-cargas-seguro-complementario', CONFIG.OPCIONES_CARGAS_SEGURO_COMPLEMENTARIO, t.cargas_familiares_seguro_complementario);

    // 6. Datos bancarios (selects + input)
    poblarSelect('f-banco',       CONFIG.BANCOS,       t.banco);
    poblarSelect('f-tipo-cuenta', CONFIG.TIPOS_CUENTA, t.tipo_cuenta);
    setVal('f-numero-cuenta', t.numero_cuenta);

    // 7. Tallas EPP
    poblarSelect('f-talla-zapato',   CONFIG.TALLAS_ZAPATO,     t.talla_zapato || t.calzado_seguridad);
    poblarSelect('f-talla-polera',   CONFIG.TALLAS_LETRA,      t.talla_polera);
    poblarSelect('f-talla-camisa',   CONFIG.TALLAS_LETRA,      t.talla_camisa);
    poblarSelect('f-talla-chaqueta', CONFIG.TALLAS_LETRA,      t.talla_chaqueta);
    poblarSelect('f-talla-guantes',  CONFIG.TALLAS_LETRA,      t.talla_guantes);
    poblarSelect('f-talla-casco',    CONFIG.TALLAS_LETRA,      t.talla_casco);
    poblarSelect('f-talla-chaleco',  CONFIG.TALLAS_LETRA,      t.talla_chaleco);
    poblarSelect('f-talla-buzo',     CONFIG.TALLAS_BUZO,       t.talla_buzo);
    poblarSelect('f-respirador',     CONFIG.TALLAS_RESPIRADOR, t.respirador);

    // 8. Informacion opcional
    poblarSelect('f-licencia-tipo', CONFIG.TIPOS_LICENCIA, t.licencia_conducir_tipo);
    setVal('f-licencia-numero',     t.licencia_conducir_numero);
    setVal('f-licencia-vencimiento', formatearFechaInput(t.vencimiento_licencia_conducir));

    const tienePase = !!t.pase_codelco;
    document.getElementById('f-pase-codelco').checked = tienePase;
    setVal('f-pase-numero', t.pase_codelco_numero);
    aplicarVisibilidadPaseCodelco();

    setVal('f-enfermedades-cronicas', t.enfermedades_cronicas);

    // 9. Checkbox legal: nunca premarcado
    const chk = document.getElementById('chk-legal');
    chk.checked = false;
    document.getElementById('btn-confirmar').disabled = true;

    aplicarEstadoConfirmacion(t);
}

function aplicarEstadoConfirmacion(t) {
    const confirmado = trabajadorYaConfirmado(t);
    const panel = document.getElementById('panel-ya-confirmado');
    const intro = document.getElementById('page-intro-texto');
    const legalNota = document.getElementById('legal-ya-confirmado');

    if (confirmado) {
        const fechaTxt = textoFechaConfirmacion(t);
        if (panel) {
            panel.hidden = false;
            const fechaEl = document.getElementById('confirmado-fecha-texto');
            if (fechaEl) fechaEl.textContent = fechaTxt;
        }
        if (intro) {
            intro.textContent = 'Tu informacion ya fue validada. Revisa los datos y, si necesitas corregir algo, editalo y confirma nuevamente al final. La vigencia del carnet de identidad es obligatoria.';
        }
        if (legalNota) {
            legalNota.hidden = false;
            legalNota.textContent = fechaTxt + ' Si realizas cambios, marca el checkbox y confirma otra vez para registrar la actualizacion.';
        }
    } else {
        if (panel) panel.hidden = true;
        if (intro) {
            intro.textContent = 'Revisa cuidadosamente la informacion. Los campos en gris son de solo lectura. Edita los campos habilitados, completa la vigencia del carnet de identidad y confirma al final.';
        }
        if (legalNota) legalNota.hidden = true;
    }
}

// Convierte un valor de fecha de Supabase (ISO o YYYY-MM-DD) al formato
// requerido por <input type="date">: YYYY-MM-DD.
function formatearFechaInput(v) {
    if (!v) return '';
    const s = String(v);
    if (s.length >= 10) return s.substring(0, 10);
    return s;
}

// Muestra u oculta el bloque de teletrabajo segun el toggle "misma direccion".
// Si esta encendido (misma), limpia los campos del bloque (para que en BD queden null).
function aplicarVisibilidadTeletrabajo() {
    const chk = document.getElementById('f-teletrabajo-misma');
    const bloque = document.getElementById('bloque-teletrabajo');
    if (!chk || !bloque) return;

    bloque.hidden = chk.checked;
    if (chk.checked) {
        ['f-teletrabajo-region', 'f-teletrabajo-ciudad', 'f-teletrabajo-comuna',
         'f-teletrabajo-calle',  'f-teletrabajo-numero', 'f-teletrabajo-departamento']
            .forEach((id) => { const e = document.getElementById(id); if (e) e.value = ''; });
    }
}

// Muestra u oculta el campo de numero de pase segun el toggle "tengo pase".
// Si esta apagado, limpia el numero.
function aplicarVisibilidadPaseCodelco() {
    const chk = document.getElementById('f-pase-codelco');
    const campoNumero = document.getElementById('campo-pase-numero');
    if (!chk || !campoNumero) return;

    campoNumero.hidden = !chk.checked;
    if (!chk.checked) {
        const num = document.getElementById('f-pase-numero');
        if (num) num.value = '';
    }
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
    // Si la direccion de teletrabajo es la misma que la de vivienda, los
    // campos especificos se guardan vacios (null en BD).
    if (out.teletrabajo_misma_direccion === true) {
        out.teletrabajo_region = '';
        out.teletrabajo_ciudad = '';
        out.teletrabajo_comuna = '';
        out.teletrabajo_calle = '';
        out.teletrabajo_numero = '';
        out.teletrabajo_departamento = '';
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
            if (campo === 'sexo') {
                antes = normalizarGeneroBd(antes);
                desp  = normalizarGeneroBd(desp);
            }
            // Las fechas en BD pueden venir con timestamp; en el input son YYYY-MM-DD.
            if (antes.length >= 10 && /\d{4}-\d{2}-\d{2}/.test(antes)) antes = antes.substring(0, 10);
            if (antes === desp) return;
            const etiquetaAntes = campo === 'sexo' ? generoEtiqueta(antes) : (antes || '(vacio)');
            const etiquetaDesp  = campo === 'sexo' ? generoEtiqueta(desp)  : (desp  || '(vacio)');
            cambios.push({
                campo,
                etiqueta: ETIQUETAS[campo] || campo,
                valor_anterior: etiquetaAntes,
                valor_nuevo:    etiquetaDesp
            });
        }
    });
    return cambios;
}

function validarCamposObligatorios(actuales) {
    const faltantes = [];
    CAMPOS_OBLIGATORIOS.forEach((c) => {
        const val = actuales ? actuales[c.campo] : '';
        if (!val || !String(val).trim()) faltantes.push(c);
    });
    return faltantes;
}

function marcarCamposObligatoriosInvalidos(faltantes) {
    CAMPOS_OBLIGATORIOS.forEach((c) => {
        const el = document.getElementById(c.id);
        if (el) el.classList.remove('campo-invalido');
    });
    (faltantes || []).forEach((c) => {
        const el = document.getElementById(c.id);
        if (el) el.classList.add('campo-invalido');
    });
}

function bloquearConfirmacionPorObligatorios(actuales, opts) {
    const faltantes = validarCamposObligatorios(actuales);
    if (faltantes.length === 0) {
        marcarCamposObligatoriosInvalidos([]);
        return false;
    }
    marcarCamposObligatoriosInvalidos(faltantes);
    const lista = faltantes.map((f) => f.etiqueta).join(', ');
    const mensaje = 'Debes completar los campos obligatorios: ' + lista + '.';
    if (opts && opts.cerrarResumen) cerrarModalResumen();
    mostrarErrorConfirmacion(mensaje, faltantes);
    return true;
}

function cerrarModalResumen() {
    const dlg = document.getElementById('modal-resumen');
    if (dlg && dlg.open) dlg.close();
}

function scrollAConfirmacionLegal(focoId) {
    const card = document.getElementById('card-legal');
    if (card) {
        try { card.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (_) {}
    }
    if (focoId) {
        const el = document.getElementById(focoId);
        if (el) {
            try { el.focus(); } catch (_) {}
            try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) {}
        }
    }
}

function mostrarErrorConfirmacion(mensaje, faltantes) {
    mostrarMensaje('error', mensaje);
    const panel = document.getElementById('panel-error-confirmacion');
    if (panel) {
        panel.hidden = false;
        panel.textContent = mensaje;
    }
    if (faltantes && faltantes.length) {
        const first = faltantes[0];
        const focoId = first.id || (first.campo === 'fecha_vencimiento_id' ? 'f-fecha-vencimiento-id' : null);
        if (focoId) {
            scrollAConfirmacionLegal(focoId);
        } else {
            scrollAConfirmacionLegal(null);
        }
    } else {
        scrollAConfirmacionLegal('chk-legal');
    }
}

function ocultarErrorConfirmacion() {
    const panel = document.getElementById('panel-error-confirmacion');
    if (panel) {
        panel.hidden = true;
        panel.textContent = '';
    }
}

function mostrarResumenAntesConfirmar() {
    if (!document.getElementById('chk-legal').checked) {
        mostrarErrorConfirmacion('Debes marcar el checkbox legal para continuar.');
        return;
    }

    const actuales = leerValoresActuales();
    if (bloquearConfirmacionPorObligatorios(actuales)) return;
    if (bloquearConfirmacionPorFormatos(actuales)) return;

    ocultarErrorConfirmacion();

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
    const btnFinal = document.getElementById('btn-confirmar-final');

    if (!document.getElementById('chk-legal').checked) {
        cerrarModalResumen();
        mostrarErrorConfirmacion('Debes marcar el checkbox legal para confirmar.');
        return;
    }

    const actuales = leerValoresActuales();
    if (bloquearConfirmacionPorObligatorios(actuales, { cerrarResumen: true })) return;
    if (bloquearConfirmacionPorFormatos(actuales, { cerrarResumen: true })) return;

    const cambios = recolectarCambios(STATE.trabajadorOriginal, actuales);

    if (btnFinal) btnFinal.disabled = true;
    showLoader();
    try {
        if (!STATE.sesionId && STATE.trabajador) {
            await ejecutarPaso('crearSesionValidacion', () => crearSesionValidacion(STATE.trabajador));
        }
        if (cambios.length > 0) {
            await ejecutarPaso('guardarCambiosTrabajador', () => guardarCambiosTrabajador(actuales));
            await ejecutarPaso('registrarLogValidacion',   () => registrarLogValidacion(cambios));
        }
        await ejecutarPaso('marcarConfirmacionLegal', () => marcarConfirmacionLegal());
        await ejecutarPaso('registrarConsentimientosTratamiento', () => registrarConsentimientosTratamiento());
        await ejecutarPaso('cerrarSesionValidacion', () => cerrarSesionValidacion());

        const ahora = new Date().toISOString();
        STATE.trabajadorOriginal = Object.assign({}, STATE.trabajadorOriginal, actuales, {
            datos_confirmados: true,
            fecha_confirmacion: ahora
        });
        STATE.trabajador = Object.assign({}, STATE.trabajador, actuales, {
            datos_confirmados: true,
            fecha_confirmacion: ahora
        });

        ocultarErrorConfirmacion();
        cerrarModalResumen();

        const textoExito = cambios.length > 0
            ? 'Tus datos fueron actualizados y la confirmacion legal quedo registrada. Tu sesion se cerrara automaticamente.'
            : 'Tu confirmacion legal quedo registrada. Tu sesion se cerrara automaticamente.';

        try { sessionStorage.setItem('valida_bd_confirmacion_ok', textoExito); } catch (_) {}
        await cerrarSesion();
    } catch (err) {
        console.error('Error al confirmar:', err);
        cerrarModalResumen();
        const detalle = (err && (err.message || err.error_description || err.details || err.hint)) ||
                        (function () { try { return JSON.stringify(err); } catch (_) { return String(err); } })();
        mostrarErrorConfirmacion(
            'No se pudo guardar. Revisa los campos marcados o intenta nuevamente. Detalle: ' + detalle
        );
    } finally {
        hideLoader();
        if (btnFinal) btnFinal.disabled = false;
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
    const pais = paisDesdeTrabajador(t);
    const patch = {};
    CAMPOS_EDITABLES.forEach((campo) => {
        let v = actuales[campo];
        if (typeof v === 'boolean') {
            patch[campo] = v;
        } else if (campo === 'sexo' && v) {
            patch[campo] = normalizarGeneroBd(v) || null;
        } else if (campo === 'telefono_emergencia' && v) {
            patch[campo] = normalizarTelefonoParaBD(v, pais);
        } else if ((campo === 'numero_domicilio' || campo === 'teletrabajo_numero') && v) {
            patch[campo] = String(v).trim();
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

async function cargarCatalogoNormativo() {
    try {
        const [resBases, resCats] = await Promise.all([
            STATE.sb.from('cat_bases_legales').select('codigo,nombre,descripcion,ejemplo_uso,orden').eq('activo', true).order('orden'),
            STATE.sb.from('cat_categorias_datos').select('codigo,nombre,descripcion,base_legal_codigo,orden').eq('activo', true).order('orden')
        ]);
        if (!resBases.error && resBases.data && resBases.data.length) {
            STATE.basesLegales = resBases.data;
        }
        if (!resCats.error && resCats.data && resCats.data.length) {
            STATE.categoriasDatos = resCats.data;
        }
        renderMatrizNormativa();
    } catch (err) {
        console.warn('Catalogo normativo no disponible (ejecuta schema_normativa.sql):', err);
    }
}

async function registrarConsentimientosTratamiento() {
    const t = STATE.trabajador;
    if (!t) return;

    const categorias = STATE.categoriasDatos || CONFIG.CATEGORIAS_DATOS || [];
    if (!categorias.length) return;

    const filas = categorias.map((cat) => ({
        trabajador_id:        t.id_trabajador,
        email_corporativo:    t.email_corporativo,
        categoria_codigo:     cat.codigo,
        base_legal_codigo:    cat.base_legal_codigo,
        aceptado:             true,
        version_portal:       CONFIG.APP_VERSION,
        version_texto_legal:  CONFIG.LEGAL_TEXT_VERSION,
        sesion_id:            STATE.sesionId,
        ip_origen:            STATE.ip,
        user_agent:           STATE.userAgent
    }));

    const { error } = await STATE.sb
        .from('trabajador_consentimientos_tratamiento')
        .insert(filas);

    if (error) {
        console.warn('No se pudo registrar consentimientos de tratamiento:', error);
        // No bloquea la confirmacion si falla el registro auxiliar.
    }
}

async function cargarActivosEmpresa(trabajadorId) {
    STATE.activos = [];
    STATE.activosHistorial = {};
    try {
        const { data, error } = await STATE.sb
            .from('activos')
            .select('*')
            .eq('id_trabajador_asignado', trabajadorId)
            .neq('estado', 'dado_baja')
            .order('created_at', { ascending: false });

        if (error) throw error;
        STATE.activos = data || [];

        if (STATE.activos.length) {
            const ids = STATE.activos.map((a) => a.id_activo);
            const { data: hist, error: errHist } = await STATE.sb
                .from('activos_historial')
                .select('id_evento,id_activo,tipo_evento,estado_anterior,estado_nuevo,created_at,detalles')
                .in('id_activo', ids)
                .order('created_at', { ascending: false });

            if (!errHist && hist) {
                hist.forEach((ev) => {
                    if (!STATE.activosHistorial[ev.id_activo]) {
                        STATE.activosHistorial[ev.id_activo] = [];
                    }
                    STATE.activosHistorial[ev.id_activo].push(ev);
                });
            }
        }
    } catch (err) {
        console.warn('Activos no disponibles (ejecuta schema_activos.sql):', err);
        STATE.activos = [];
        STATE.activosHistorial = {};
    }
    renderListaActivos();
}

function etiquetaEstadoActivo(codigo) {
    const map = CONFIG.ESTADOS_ACTIVO || {};
    return map[codigo] || codigo || '';
}

function claseEstadoActivo(codigo) {
    const c = String(codigo || '').replace(/_/g, '-');
    return 'activo-estado activo-estado-' + c;
}

function leerDetallesActivo(a) {
    const d = a && a.detalles_adicionales;
    if (!d || typeof d !== 'object') return {};
    return d;
}

function renderListaActivos() {
    const lista = document.getElementById('activos-lista');
    const vacio = document.getElementById('activos-vacio');
    if (!lista) return;

    lista.innerHTML = '';
    const items = STATE.activos || [];

    if (vacio) vacio.hidden = items.length > 0;

    items.forEach((a) => {
        const det = leerDetallesActivo(a);
        const card = document.createElement('div');
        card.className = 'activo-item';
        const partes = [
            [a.marca, a.modelo].filter(Boolean).join(' '),
            a.identificador_unico ? ('ID: ' + a.identificador_unico) : '',
            det.numero_serie ? ('Serie: ' + det.numero_serie) : '',
            det.numero_inventario ? ('Inv: ' + det.numero_inventario) : '',
            a.fecha_asignacion ? ('Entrega: ' + formatearFechaLegible(a.fecha_asignacion)) : '',
            det.proveedor_declarado ? ('Proveedor: ' + det.proveedor_declarado) : ''
        ].filter(Boolean);

        const historial = STATE.activosHistorial[a.id_activo] || [];
        const histHtml = historial.length
            ? ('<details class="activo-historial"><summary>Historial (' + historial.length + ')</summary><ul>' +
                historial.slice(0, 5).map((ev) =>
                    '<li><span class="activo-hist-fecha">' + escapeHtml(formatearFechaLegible(ev.created_at)) + '</span> ' +
                    escapeHtml(ev.tipo_evento || '') +
                    (ev.estado_nuevo ? (' ? ' + escapeHtml(etiquetaEstadoActivo(ev.estado_nuevo))) : '') +
                    '</li>'
                ).join('') + '</ul></details>')
            : '';

        const puedeDevolver = ['asignado', 'pendiente_validacion'].includes(a.estado);

        card.innerHTML =
            '<div class="activo-item-body">' +
                '<div class="activo-item-head">' +
                    '<strong>' + escapeHtml(a.tipo || 'Activo') + '</strong>' +
                    '<span class="' + claseEstadoActivo(a.estado) + '">' + escapeHtml(etiquetaEstadoActivo(a.estado)) + '</span>' +
                '</div>' +
                '<span class="activo-item-detalle">' + escapeHtml(partes.join(' ? ') || 'Sin detalle adicional') + '</span>' +
                (det.observaciones ? ('<span class="activo-item-obs">' + escapeHtml(det.observaciones) + '</span>') : '') +
                histHtml +
            '</div>' +
            (puedeDevolver
                ? '<button type="button" class="btn btn-ghost btn-quitar-activo" data-activo-id="' + escapeHtml(a.id_activo) + '">Solicitar devolucion</button>'
                : '');

        lista.appendChild(card);
    });

    lista.querySelectorAll('.btn-quitar-activo').forEach((btn) => {
        btn.addEventListener('click', () => onSolicitarDevolucionActivo(btn.getAttribute('data-activo-id')));
    });
}

function limpiarFormularioActivo() {
    const tipo = document.getElementById('activo-tipo');
    if (tipo) tipo.value = '';
    ['activo-marca', 'activo-modelo', 'activo-identificador', 'activo-serie', 'activo-inventario',
     'activo-fecha-asignacion', 'activo-proveedor', 'activo-observaciones']
        .forEach((id) => { const el = document.getElementById(id); if (el) el.value = ''; });
}

function construirDetallesActivo(t) {
    const det = {
        origen: 'portal',
        registrado_por_email: t.email_corporativo,
        portal_version: CONFIG.APP_VERSION
    };
    const serie = valOrNull('activo-serie');
    const inv = valOrNull('activo-inventario');
    const prov = valOrNull('activo-proveedor');
    const obs = valOrNull('activo-observaciones');
    if (serie) det.numero_serie = serie;
    if (inv) det.numero_inventario = inv;
    if (prov) det.proveedor_declarado = prov;
    if (obs) det.observaciones = obs;
    if (t.tipo_contrato) det.tipo_contrato_laboral = t.tipo_contrato;
    if (t.fecha_vencimiento_contrato) {
        det.fecha_vencimiento_contrato = String(t.fecha_vencimiento_contrato).substring(0, 10);
    }
    return det;
}

async function onAgregarActivo() {
    const t = STATE.trabajador;
    if (!t) return;

    const tipo = (document.getElementById('activo-tipo') || {}).value || '';
    const marca = valOrNull('activo-marca');
    const modelo = valOrNull('activo-modelo');
    const identificador = valOrNull('activo-identificador');

    if (!tipo.trim()) {
        mostrarMensaje('error', 'Selecciona el tipo de activo.');
        return;
    }
    if (!marca || !modelo || !identificador) {
        mostrarMensaje('error', 'Marca, modelo e identificador unico son obligatorios.');
        return;
    }

    const payload = {
        tipo:                   tipo.trim(),
        marca:                  marca,
        modelo:                 modelo,
        identificador_unico:    identificador,
        estado:                 'pendiente_validacion',
        id_trabajador_asignado: t.id_trabajador,
        fecha_asignacion:       valOrNull('activo-fecha-asignacion'),
        detalles_adicionales:   construirDetallesActivo(t)
    };

    showLoader();
    try {
        const { data, error } = await STATE.sb
            .from('activos')
            .insert(payload)
            .select('*')
            .single();

        if (error) throw error;
        if (data) STATE.activos.unshift(data);
        limpiarFormularioActivo();
        await cargarActivosEmpresa(t.id_trabajador);
        mostrarMensaje('success', 'Activo declarado. Quedara pendiente de validacion por TI.');
    } catch (err) {
        console.error('Error al declarar activo:', err);
        const msg = String((err && err.message) || '');
        if (msg.toLowerCase().includes('unique') || msg.includes('activos_identificador_unico')) {
            mostrarMensaje('error', 'Ese identificador ya existe en el inventario. Verifica serie o codigo de inventario.');
        } else {
            mostrarMensaje('error', 'No se pudo declarar el activo. Verifica que schema_activos.sql este ejecutado en Supabase.');
        }
    } finally {
        hideLoader();
    }
}

async function onSolicitarDevolucionActivo(idActivo) {
    if (!idActivo || !STATE.trabajador) return;
    if (!window.confirm('?Solicitar la devolucion de este activo a TI?')) return;

    const t = STATE.trabajador;
    const activo = STATE.activos.find((a) => a.id_activo === idActivo);
    if (!activo) return;

    const det = Object.assign({}, leerDetallesActivo(activo), {
        origen: 'portal',
        registrado_por_email: t.email_corporativo,
        solicitud_devolucion: new Date().toISOString()
    });

    showLoader();
    try {
        const { error } = await STATE.sb
            .from('activos')
            .update({
                estado: 'devolucion_pendiente',
                detalles_adicionales: det
            })
            .eq('id_activo', idActivo)
            .eq('id_trabajador_asignado', t.id_trabajador);

        if (error) throw error;

        await STATE.sb.from('activos_historial').insert({
            id_activo: idActivo,
            tipo_evento: 'solicitud_devolucion',
            estado_anterior: activo.estado,
            estado_nuevo: 'devolucion_pendiente',
            id_trabajador_anterior: t.id_trabajador,
            registrado_por_email: t.email_corporativo,
            origen: 'portal',
            detalles: { motivo: 'Solicitud desde portal del trabajador' }
        });

        await cargarActivosEmpresa(t.id_trabajador);
        mostrarMensaje('info', 'Devolucion solicitada. TI coordinara la recepcion del equipo.');
    } catch (err) {
        console.error('Error al solicitar devolucion:', err);
        mostrarMensaje('error', 'No se pudo registrar la solicitud de devolucion.');
    } finally {
        hideLoader();
    }
}

function valOrNull(id) {
    const el = document.getElementById(id);
    if (!el) return null;
    const v = el.value != null ? String(el.value).trim() : '';
    return v ? v : null;
}

async function cerrarSesionValidacion() {
    if (!STATE.sesionId) return;
    const { error } = await STATE.sb
        .from('validacion_trabajador_sesiones')
        .update({ confirmado_en: new Date().toISOString() })
        .eq('id', STATE.sesionId);

    if (error) console.warn('No se pudo cerrar la sesion de validacion:', error);
    STATE.sesionId = null;
}

function mostrarModalExito(mensaje) {
    const dlg = document.getElementById('modal-exito');
    const msg = document.getElementById('exito-mensaje');
    if (msg) msg.textContent = mensaje || 'Operacion completada correctamente.';
    if (dlg) dlg.showModal();
}

function mostrarModalIngresoConfirmado(trabajador) {
    const dlg = document.getElementById('modal-ingreso-confirmado');
    const msg = document.getElementById('ingreso-confirmado-mensaje');
    const nombre = trabajador ? (formatNombreCompleto(trabajador) || trabajador.email_corporativo || '') : '';
    const saludo = nombre ? ('Hola ' + nombre + '. ') : '';
    if (msg) {
        msg.textContent = saludo + textoFechaConfirmacion(trabajador) +
            ' Puedes revisar tu informacion o actualizarla si algo cambio.';
    }
    if (dlg) dlg.showModal();
}

function onRevisarDatosTrasIngreso() {
    const dlg = document.getElementById('modal-ingreso-confirmado');
    if (dlg) dlg.close();
    const panel = document.getElementById('panel-ya-confirmado');
    if (panel && !panel.hidden) {
        try { panel.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (_) {}
    }
}

function onCerrarSesionTrasIngreso() {
    const dlg = document.getElementById('modal-ingreso-confirmado');
    if (dlg) dlg.close();
    cerrarSesion();
}

function onSeguirEditando() {
    const dlg = document.getElementById('modal-exito');
    if (dlg) dlg.close();
    aplicarEstadoConfirmacion(STATE.trabajador);
    mostrarMensaje('info', 'Puedes seguir editando. Vuelve a marcar la confirmacion legal si deseas guardar nuevos cambios.');
    const intro = document.querySelector('.page-intro');
    if (intro) {
        try { intro.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (_) {}
    }
}

function onCerrarSesionTrasExito() {
    const dlg = document.getElementById('modal-exito');
    if (dlg) dlg.close();
    cerrarSesion();
}

// =======================================================================
// VISTAS Y FEEDBACK
// =======================================================================
function mostrarVistaLogin() {
    document.getElementById('vista-login').hidden = false;
    document.getElementById('vista-app').hidden   = true;
    prepararVistaLogin();
}
function mostrarVistaApp() {
    document.getElementById('vista-login').hidden = true;
    document.getElementById('vista-app').hidden   = false;
    ocultarErrorLogin();
}

// opts: { titulo, tipo: 'error'|'warn'|'info' }
function mostrarErrorLogin(texto, opts) {
    const el = document.getElementById('login-error');
    const titulo = (opts && opts.titulo) ? opts.titulo : '';
    const tipo = (opts && opts.tipo) ? opts.tipo : 'error';

    el.classList.remove('alert-error', 'alert-warn', 'alert-info');
    el.classList.add('alert-' + tipo);
    el.setAttribute('role', 'alert');

    el.innerHTML = '';
    if (titulo) {
        const h = document.createElement('strong');
        h.className = 'alert-title';
        h.textContent = titulo;
        el.appendChild(h);
    }
    const p = document.createElement('span');
    p.className = 'alert-msg';
    p.textContent = texto || '';
    el.appendChild(p);

    el.hidden = false;
    document.getElementById('vista-login').hidden = false;
    document.getElementById('vista-app').hidden   = true;
    try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) {}
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
