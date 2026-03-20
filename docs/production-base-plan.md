# Tibetan Editor — Plan de Base de Producción

## Estado: IMPLEMENTADO (sprint de seguridad)

---

## 1. Auditoría del estado previo

### Lo que ya existía y funcionaba
- Supabase Auth con email/password y magic link
- `authStore` con suscripción a `onAuthStateChange`
- Modelo de permisos `owner / editor / viewer` en `document_collaborators`
- RLS básico en `documents` y `document_collaborators`
- Guardado y carga de documentos desde la nube
- Panel de compartir con búsqueda por email

### Problemas críticos encontrados

| Severidad | Problema | Archivo |
|---|---|---|
| 🔴 Alta | Un editor podía cambiar `owner_id` a su propio UUID al hacer upsert → se robaba la propiedad del documento | `cloudSync.ts:50-55` |
| 🔴 Alta | Los colaboradores no podían leer fuentes de otros usuarios: la RLS de storage bloqueaba el acceso aunque hubiera permisos | `schema.sql:136-146` |
| 🟡 Media | Cualquier usuario autenticado podía leer todos los perfiles (emails incluidos) | `schema-v2.sql:21-23` |
| 🟡 Media | Colaboradores no podían leer proyectos compartidos (RLS faltante en `projects`) | `schema-v2.sql:70-72` |
| 🟡 Media | Comments UPDATE sin WITH CHECK → autor podía mover un comentario a otro documento | `schema-v2.sql:180-183` |
| 🟡 Media | `get_profile_by_email` ejecutable por usuarios no autenticados | `schema-v2.sql:222` |
| 🟠 Baja | No había auth gate: app renderizaba completa sin autenticación | `App.tsx` |
| 🟠 Baja | `fontCloudStorage.ts` aceptaba `userId` como parámetro externo (path traversal potencial) | `fontCloudStorage.ts` |
| 🟠 Baja | Colaboradores se mostraban como UUID truncados (ilegibles) | `DocumentBrowser.tsx:263` |
| 🟠 Baja | Quitar colaborador sin confirmación | `DocumentBrowser.tsx:124` |
| 🟠 Baja | Errores de auth crudos de Supabase expuestos al usuario | `AuthModal.tsx:110` |

---

## 2. Lo que se implementó en este sprint

### 2.1 SQL: `supabase/schema-v3-security.sql`

Ejecutar en el SQL Editor de Supabase DESPUÉS de schema.sql y schema-v2.sql:

1. **Profiles RLS** — restringida a: tu propio perfil + perfiles de colaboradores en tus documentos
2. **Projects RLS** — nuevo policy `FOR SELECT` para que colaboradores puedan leer proyectos compartidos
3. **Comments UPDATE WITH CHECK** — previene que un autor mueva un comentario a otro documento
4. **RPCs protegidas** — `get_profile_by_email` y `get_user_id_by_email` ya no son accesibles sin autenticación
5. **Font storage colaborativo** — nuevo policy `Collaborator font read` que permite leer fuentes de documentos compartidos
6. **Images bucket** — mismo policy colaborativo para imágenes
7. **Trigger `guard_document_owner_id`** — previene que cualquier UPDATE cambie el `owner_id` por alguien que no sea el owner actual

### 2.2 Código: fixes de seguridad

#### `cloudSync.ts` — `saveDocumentToCloud`
- Reemplazado upsert único por INSERT vs UPDATE separados
- El `owner_id` **solo se incluye en INSERT** (primera vez que se sube)
- En UPDATE, el `owner_id` nunca se envía → no puede ser modificado por un editor

#### `fontCloudStorage.ts`
- Eliminado el parámetro `userId` de `uploadFontToCloud`, `deleteFontFromCloud`, `fontExistsInCloud`
- Ahora el userId se deriva siempre de `supabase.auth.getUser()` → no hay riesgo de path traversal
- Signatura de `getFontSignedUrl` y `downloadFontFromCloud` conservan `ownerUserId` ya que acceden a archivos de otro usuario (colaboración)

### 2.3 Auth gate en `App.tsx`

Nuevos estados cuando Supabase está configurado:
- `loading` → spinner de carga de sesión
- `unauthenticated` → `LoginPage` (pantalla de acceso dedicada)
- `authenticated` → app completa (`AppShell`)

Si Supabase NO está configurado → la app funciona en modo local sin requerir auth (backward compatible).

### 2.4 `LoginPage.tsx` — pantalla de acceso dedicada

- Magic link como método principal (sin contraseña)
- Email + contraseña como método secundario
- Feedback explícito para: magic link enviado, confirmación de email pendiente
- Errores sanitizados (sin strings internas de Supabase al usuario)
- Tabs limpos entre métodos

### 2.5 `AuthModal.tsx` — mejoras

- Mismo error sanitization que LoginPage
- Estado `signUpPending` para mostrar "confirmá tu email"
- Magic link como modo por defecto (en vez de signin)

### 2.6 `DocumentBrowser.tsx` — mejoras de UX y seguridad

- Colaboradores ahora muestran email o display_name (no UUID truncado)
- Join con `profiles` en `listCollaborators` (con fallback si profiles no existe)
- Confirmación antes de quitar acceso a un colaborador

---

## 3. Lo que queda pendiente para producción real

### Bloqueante antes de deploy en producción

- [ ] Ejecutar `schema-v3-security.sql` en el proyecto Supabase de staging/prod
- [ ] Verificar que `schema-v2.sql` ya fue ejecutado (para profiles, projects, comments)
- [ ] Configurar variables de entorno en Vercel (ver `docs/environments.md`)
- [ ] Configurar dominio real (no `*.vercel.app`) → actualizar `Site URL` y `Redirect URLs` en Supabase Auth

### Importante pero no bloqueante

- [ ] Rate limiting para `get_user_id_by_email` (enumeration risk con usuarios autenticados)
- [ ] Estrategia de invite pendiente (hoy solo funciona con usuarios ya registrados)
- [ ] Backup manual inicial de la base de datos
- [ ] Monitoreo de errores (Sentry u otro)

### Puede esperar

- [ ] Row-level audit log (quién editó qué y cuándo)
- [ ] Transfer de ownership (ahora bloqueado por trigger)
- [ ] Colaboración realtime (Yjs / Supabase Realtime)
- [ ] Roles por proyecto (actualmente solo por documento)

---

## 4. Riesgos remanentes

| Riesgo | Nivel | Mitigación actual |
|---|---|---|
| Enumeración de emails vía `get_user_id_by_email` | Medio | GRANT solo a `authenticated`; sin rate limiting aún |
| Last-write-wins en edición simultánea | Medio | Documentado; requiere Yjs para resolverlo |
| Fuentes en storage: sin validación de formato | Bajo | RLS por userId; extensiones de archivo validadas en frontend |
| Sesión JWT expirada sin redirect automático | Bajo | `onAuthStateChange` maneja el cambio de estado; LoginPage aparece |
