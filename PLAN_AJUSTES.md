# Plan de ajustes — Portal del Trabajador

**Version actual del portal:** v1.0.1.2 · **Produccion:** `https://valida-bd.vercel.app`

---

## Resumen de modulos

| Modulo | Seccion UI | Estado | Documentacion |
|--------|------------|--------|---------------|
| Auth email + contraseña | Login | Implementado | `config.js`, Supabase Auth |
| Datos personales + documento | 1 | Implementado | `schema_solicitud_documento.sql` |
| Contacto, domicilio, previsional | 2–6 | Implementado | `app.js` |
| Tallas EPP y opcionales | 7–8 | Implementado | — |
| **Equipo de trabajo (activos)** | **9** | **Implementado v1.0.1.1** | **`PLAN_ACTIVOS.md`** |
| Bases legales | 10 | Implementado | `schema_normativa.sql` |
| Confirmacion legal | 11 | Implementado | Unico guardado global |

---

## Puntos funcionales (historico y estado actual)

| # | Tema | Estado | Notas |
|---|------|--------|-------|
| 1 | Telefono emergencia (CL/PE) | Implementado | Validacion segun nacionalidad |
| 2 | Numero domicilio (CL/PE) | Implementado | S/N, manzana-lote, etc. |
| 3 | Genero (`sexo`) M/F/NB | Implementado | `schema_ajustes_portal.sql` |
| 4 | Vigencia carnet identidad | Implementado | Bloquea confirmacion si vencido |
| 5 | Contador ingresos portal | Implementado | **Solo informativo**; sin bloqueo TI |
| 6 | Solicitud correccion documento | Implementado | Modal seccion 1; no auto-aplica |
| 7 | **Declaracion de equipo** | **Implementado** | **Ver `PLAN_ACTIVOS.md`** |
| 8 | **Tallas EPP (guantes/casco/respirador)** | **Implementado v1.0.1.2** | Ver seccion abajo |

---

## 8. Tallas EPP — guantes, casco y respirador (v1.0.1.2)

| Campo BD | Etiqueta portal | Opciones |
|----------|-----------------|----------|
| `talla_guantes` | Talla guantes | **7, 8, 9, 10, 11** (numerico) |
| `talla_casco` | Casco | **Si / No** (no es talla de letra) |
| `respirador` | Talla respirador | **S, M, L** |

Configuracion en `config.js`: `TALLAS_GUANTES`, `OPCIONES_CASCO`, `TALLAS_RESPIRADOR`.

Valores legacy en BD (ej. respirador `Pequeño`, casco `M`) se muestran como opcion actual y se normalizan al guardar cuando aplica.

---

## 5. Contador de ingresos (solo informativo)

### Comportamiento actual

- Cada login exitoso incrementa `trabajadores.ingresos_portal_count`.
- Se muestra aviso informativo al usuario (ej. “Ingreso N al portal”).
- **No bloquea** el acceso ni el formulario.
- Tabla `solicitudes_autorizacion_portal` y columnas `portal_autorizado_ti` quedan como **legacy** (por si RR.HH. audita historico).

### Columnas en `trabajadores`

- `ingresos_portal_count` — contador visible
- `portal_*_ti` — legacy, no usadas por el portal actual

---

## 9. Equipo de trabajo — resumen (detalle en PLAN_ACTIVOS.md)

### Funcion

Declaracion **opcional y referencial** de notebook de empresa o computador propio. **No** es gestion de inventario.

### Flujo del trabajador

1. (Opcional) Completa seccion 9 si usa equipo.
2. Marca checkbox legal y **Confirmar y enviar**.
3. Si interactuo con la seccion 9, se inserta una fila en `activos` con estado `pendiente_validacion`.
4. TI revisa y valida fuera del portal.

### Lo que el portal NO hace

- Guardado intermedio en seccion 9
- Solicitar devolucion
- Editar o borrar activos existentes
- Gestionar proveedores ni acuerdos

---

## Autenticacion

| Aspecto | Configuracion |
|---------|---------------|
| Metodo | Correo `@monitoring.cl` + contraseña de verificacion |
| Supabase | Email ON, **Confirm email OFF** |
| Magic link | No usado (requiere SMTP custom) |
| Azure AD | Opcional / futuro |

---

## Orden de despliegue (BD + frontend)

### Supabase (SQL Editor)

1. `schema.sql`
2. `schema_normativa.sql`
3. `schema_activos.sql`
4. `schema_ajustes_portal.sql`
5. `schema_revision_portal.sql`
6. `schema_activos_referencial.sql`
7. `schema_activos_estado_fix.sql` (si hay error de CHECK en `estado`)
8. `schema_solicitud_documento.sql`

### Frontend

- Local: `npx http-server . -p 5174 -c-1` (o `npm run dev` en 5173)
- Produccion: push a `main` → Vercel (`valida-bd.vercel.app`)
- Cache bust: parametro `?v=` en `index.html` al cambiar `app.js` / `config.js`

---

## Pruebas sugeridas (checklist)

### Datos generales

- [ ] Login con correo corporativo y contraseña
- [ ] Genero No binario guarda sin error CHECK
- [ ] Telefono emergencia CL y PE
- [ ] Domicilio `S/N` y `Mz A Lt 5`
- [ ] Carnet vencido bloquea confirmacion
- [ ] Solicitud correccion documento llega a `solicitudes_cambio_documento`

### Modulo equipo (seccion 9)

- [ ] Sin tocar seccion 9 → confirmar no inserta en `activos`
- [ ] Elegir notebook o propio → confirmar inserta `pendiente_validacion`
- [ ] Lista superior muestra declaraciones previas (solo lectura)
- [ ] No aparece boton de devolucion

### Contador ingresos

- [ ] Varios logins incrementan contador sin bloquear

---

## Fases futuras recomendadas

| Prioridad | Tema | Responsable |
|-----------|------|-------------|
| Alta | Panel TI para `pendiente_validacion` | TI |
| Media | Notificacion correo a TI al declarar equipo | TI + Supabase |
| Media | Panel desbloqueo / auditoria si se reactiva control TI | TI |
| Baja | Recordatorio vencimiento carnet por email | RR.HH. |

---

## Archivos clave del repositorio

| Archivo | Contenido |
|---------|-----------|
| `app.js` | Logica portal, confirmacion, activos, documento |
| `config.js` | Version, catalogos, Supabase |
| `index.html` | Secciones 1–11 |
| `PLAN_ACTIVOS.md` | **Especificacion modulo equipo** |
| `MANUAL_USUARIO.md` | Guia para trabajadores |
| `schema_*.sql` | Migraciones Supabase |
