# Tibetan Editor — Seguridad en Supabase

## Versión del schema: v3

---

## Tablas y RLS activos

### `public.documents`

| Policy | Operación | Condición |
|---|---|---|
| `Owner full access` | ALL | `auth.uid() = owner_id` |
| `Collaborator read` | SELECT | usuario en `document_collaborators` |
| `Collaborator edit` | UPDATE | usuario es editor en `document_collaborators` + `owner_id` no cambia |

**Trigger de seguridad**: `guard_document_owner_id`
- Se activa en `BEFORE UPDATE OF owner_id`
- Bloquea el cambio si quien lo ejecuta no es el owner actual
- Esto es una segunda capa de defensa además del RLS

---

### `public.document_collaborators`

| Policy | Operación | Condición |
|---|---|---|
| `Owner manages collaborators` | ALL | El usuario es owner del documento |
| `User sees own collaborations` | SELECT | `user_id = auth.uid()` |

**Nota**: Un colaborador puede leer solo su propia fila, no todas las del documento.
El owner ve todas. Esto es correcto para privacidad.

---

### `public.profiles`

| Policy | Operación | Condición |
|---|---|---|
| `Own profile readable` | SELECT | `auth.uid() = id` |
| `Collaborator profiles readable` | SELECT | Compartís un documento con esa persona |
| `Users update own profile` | UPDATE | `auth.uid() = id` |

**Diseño intencional**: No es posible ver perfiles de personas al azar.
Solo ves el perfil de alguien si están en un documento compartido contigo.

---

### `public.projects`

| Policy | Operación | Condición |
|---|---|---|
| `Owner full access projects` | ALL | `auth.uid() = owner_id` |
| `Collaborator reads project` | SELECT | usuario en `project_collaborators` |

---

### `public.project_collaborators`

| Policy | Operación | Condición |
|---|---|---|
| `Owner manages project members` | ALL | usuario es owner del proyecto |
| `User sees own project memberships` | SELECT | `user_id = auth.uid()` |

---

### `public.comments`

| Policy | Operación | Condición |
|---|---|---|
| `User reads accessible doc comments` | SELECT | usuario tiene acceso al documento |
| `Authenticated inserts comment` | INSERT | usuario tiene acceso al documento |
| `Author updates own comment` | UPDATE | `author_id = auth.uid()` + `document_id` no cambia |
| `Author or owner deletes comment` | DELETE | autor del comentario o dueño del documento |

---

## Storage

### Bucket `fonts`

| Policy | Operación | Condición |
|---|---|---|
| `User font access` | ALL | `foldername[1] = auth.uid()` (solo tu carpeta) |
| `Collaborator font read` | SELECT | Sos colaborador de un documento del dueño de la carpeta |

**Estructura de paths**: `{user_id}/{storageKey}.{format}`

**Por qué signed URLs**: Los colaboradores necesitan acceder a las fuentes del dueño del documento.
El storage RLS permite el SELECT, pero para servir el archivo en el navegador usamos signed URLs
con expiración de 1 hora. Esto evita URLs públicas permanentes.

### Bucket `images`

| Policy | Operación | Condición |
|---|---|---|
| `User image access` (en schema.sql) | ALL | `foldername[1] = auth.uid()` |
| `Collaborator image read` | SELECT | Sos colaborador de un documento del dueño |

---

## Funciones RPC

### `get_user_id_by_email(email_input TEXT)`

- **SECURITY DEFINER**: accede a `auth.users` (que no es accesible directamente)
- **GRANT**: solo `authenticated`
- **Riesgo**: permite enumerar si un email existe
- **Mitigación actual**: GRANT restringido; solo funciona con sesión activa
- **Mitigación futura recomendada**: rate limiting vía Edge Function

### `get_profile_by_email(p_email TEXT)`

- **SECURITY DEFINER**: busca en `public.profiles`
- **GRANT**: solo `authenticated`
- **Riesgo**: menor que `get_user_id_by_email` (no accede a `auth.users`)

---

## Flujo de permisos: compartir un documento

```
Owner → DocumentBrowser → "Compartir"
  → ingresa email del colaborador
  → llama get_user_id_by_email(email) [RPC, solo autenticados]
  → si el usuario existe → INSERT en document_collaborators
  → RLS verifica que quien inserta es el owner del documento
  → colaborador puede leer el documento (policy "Collaborator read")
  → si es editor → puede hacer UPDATE (policy "Collaborator edit")
  → owner_id nunca puede cambiar (trigger + RLS)
```

**Limitación actual**: el colaborador debe tener una cuenta preexistente.
Para invitar a alguien sin cuenta, se necesita un flujo de invitación pendiente (no implementado).

---

## Checklist de seguridad Supabase

- [x] RLS habilitado en todas las tablas del schema público
- [x] No hay tablas con `FOR ALL USING (true)` sin restricción
- [x] Storage buckets no son públicos (todos privados)
- [x] Signed URLs con expiración para acceso colaborativo
- [x] `service_role` key nunca en el cliente → solo `anon` key
- [x] Trigger impide cambio de ownership no autorizado
- [x] RPCs con `SECURITY DEFINER` protegidas con GRANT a `authenticated`
- [ ] Rate limiting para RPCs de búsqueda por email (pendiente)
- [ ] Audit log de modificaciones sensibles (pendiente)
- [ ] Alertas en Supabase Dashboard configuradas (pendiente)

---

## Cómo aplicar el schema en Supabase

1. Ir al **SQL Editor** en el dashboard de Supabase
2. Ejecutar en orden:
   - `supabase/schema.sql` (si es proyecto nuevo)
   - `supabase/schema-v2.sql` (tablas de profiles, projects, comments)
   - `supabase/schema-v3-security.sql` (fixes de seguridad)
3. Verificar en **Authentication → Policies** que todas las tablas muestran RLS activo
4. Verificar en **Storage → Policies** que los buckets `fonts` e `images` tienen las políticas correctas

---

## Email confirmación en Supabase Auth

Por defecto, Supabase requiere confirmación de email para nuevas cuentas.
Esto significa que un usuario que se registra con contraseña no puede iniciar sesión
hasta confirmar su email.

**Para magic link**: la confirmación es automática (el click en el link confirma la cuenta).
**Para password signup**: se envía un email de confirmación por separado.

Recomendación: usar **solo magic link** como método de acceso para simplificar el flujo.
El modo password puede mantenerse solo para casos especiales.
