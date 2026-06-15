# Prompt maestro - HTML + Supabase + Microsoft 365

Crea una página HTML simple, limpia y moderna para el portal de trabajadores de Monitoring.

## Objetivo
El trabajador inicia sesión con su cuenta Microsoft 365 corporativa y solo puede entrar si su correo termina en `@monitoring.cl`. Después del login, el sistema busca su registro en Supabase usando el mismo email corporativo y muestra sus datos.

## Reglas de autenticación
- Autenticación con Microsoft 365.
- Validar obligatoriamente que el email autenticado termine en `@monitoring.cl`.
- Si el email no pertenece al dominio permitido, bloquear acceso y mostrar mensaje claro.
- Guardar fecha del último login Microsoft.

## Reglas de visualización
Mostrar los datos del trabajador en un formulario dividido en secciones:
1. Datos personales.
2. Datos bancarios.
3. Tallas EPP.
4. Confirmación legal.

## Campos solo lectura
- Nombre completo.
- Apellidos.
- Nacionalidad.
- Tipo de documento.
- Número de documento.
- Cargo.
- Contrato.
- Centro de costo.
- Unidad.
- Email corporativo.

## Excepción documento
- El campo RUT/DNI/Pasaporte no se puede editar directamente.
- Debe existir un botón: "Solicitar corrección de documento".
- Al presionarlo, abrir modal con:
  - Tipo de documento actual.
  - Número actual.
  - Tipo solicitado.
  - Número solicitado.
  - Motivo.
- Al enviar, guardar en tabla `solicitudes_cambio_documento`.
- Mostrar advertencia: "La corrección de documento será revisada por RR.HH. o administrador. No se aplica de forma automática."

## Campos editables
### Datos bancarios
- Banco.
- Tipo de cuenta.
- Número de cuenta.

### Tallas EPP
- Talla zapato: selector numérico.
- Talla pantalón: S, M, L, XL, XXL.
- Talla polera: S, M, L, XL, XXL.
- Talla camisa: S, M, L, XL, XXL.
- Talla chaqueta: S, M, L, XL, XXL.
- Talla guantes: S, M, L, XL, XXL.
- Talla casco: S, M, L, XL, XXL.
- Talla chaleco: S, M, L, XL, XXL.

## Reglas de guardado
- Al cargar el formulario, obtener datos desde Supabase.
- Al guardar, actualizar solo campos editables en `trabajadores`.
- Registrar en `log_validaciones` cada campo cambiado con:
  - trabajador_id
  - sesion_id
  - campo
  - valor_anterior
  - valor_nuevo
  - modificado_por_email
  - ip_origen
  - user_agent
  - fecha_modificacion
- Si no hubo cambio en un campo, no registrar ese campo.

## Confirmación legal
Agregar una sección final con:
- Checkbox obligatorio no premarcado.
- Texto legal visible y claro.
- Botón "Confirmar y enviar".

Texto legal sugerido:
"Declaro que he revisado los datos mostrados en este formulario y que la información ingresada o actualizada por mí es correcta a la fecha. Asimismo, tomo conocimiento de que Monitoring tratará mis datos personales para fines de gestión laboral, operativa, administrativa, de seguridad y cumplimiento, de acuerdo con la normativa aplicable y su política interna de tratamiento de datos personales."

## Reglas legales y de trazabilidad
- No permitir confirmar si el checkbox no está marcado.
- Al confirmar:
  - marcar `datos_confirmados = true`
  - guardar `fecha_confirmacion = now()`
  - guardar `acepta_tratamiento_datos = true`
  - guardar `fecha_aceptacion_datos = now()`
  - guardar `version_texto_legal`
  - guardar `actualizado_por_email`
  - guardar `ultima_actualizacion_autogestion = now()`
- Crear registro en `validacion_trabajador_sesiones` al inicio y actualizarlo al confirmar.

## UX esperada
- HTML responsive.
- Diseño simple, corporativo, profesional.
- Mensajes claros de éxito y error.
- Separar secciones con cards.
- Botones visibles.
- Mostrar resumen final antes de confirmar.

## Stack
- HTML + CSS + JavaScript vanilla.
- Supabase JS para lectura y escritura.
- Integración lista para conectar con autenticación Microsoft.
- Código comentado de forma breve y útil.
- No usar frameworks pesados.

## Entregables
1. Un archivo `index.html`.
2. Un archivo `app.js`.
3. Un archivo `styles.css`.
4. Variables configurables para:
   - Supabase URL
   - Supabase anon key
   - dominio permitido
   - versión del texto legal
   - email de notificación RR.HH.

## Consideraciones extra
- Preparar estructura para futura carga de política de privacidad en link modal.
- Dejar función separada para registrar logs.
- Dejar función separada para crear solicitud de cambio de documento.
- No permitir editar documento directamente.
- Usar nombres de funciones claros y mantenibles.