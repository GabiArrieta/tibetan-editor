# Tibetan Editor — Plan Supabase (Schema v2)

## Contexto

El schema v1 tiene `documents` y `document_collaborators`. Esta versión agrega soporte para:
- **Proyectos** (contenedores multi-documento)
- **Comentarios** editoriales por documento/fila
- **Profiles** (nombre visible para colaboradores)

---

## Tablas

### `profiles` (nueva)
Extensión de `auth.users` con datos de perfil públicos. Necesaria para mostrar nombre/email de colaboradores sin exponer `auth.users`.

```sql
CREATE TABLE public.profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Relaciones**: 1:1 con `auth.users`.

**RLS**: Cualquier usuario autenticado puede leer profiles. Solo el propio usuario puede modificar su profile.

---

### `projects` (nueva)
Contenedores de documentos. En fase inicial 1 proyecto = 1 documento, pero la tabla soporta N documentos por proyecto para el futuro.

```sql
CREATE TABLE public.projects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL DEFAULT 'Proyecto sin título',
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Índices**: `projects_owner_idx ON projects(owner_id)`, `projects_updated_idx ON projects(updated_at DESC)`.

**RLS**:
- `Owner full access`: el dueño puede hacer todo
- `Collaborator read`: colaboradores de cualquier doc del proyecto pueden ver el proyecto

---

### `documents` (modificada)
Agrega `project_id` para enlazar al proyecto contenedor.

```sql
ALTER TABLE public.documents
  ADD COLUMN project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;
```

**Nota**: `project_id` es nullable para backward compatibility con documentos creados antes de la v2.

---

### `project_collaborators` (nueva)
Compartir proyectos completos (todos sus documentos) con otros usuarios.

```sql
CREATE TABLE public.project_collaborators (
  project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('viewer', 'editor')) DEFAULT 'editor',
  invited_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (project_id, user_id)
);
```

---

### `comments` (nueva)
Comentarios editoriales asociados a un documento y una fila.

```sql
CREATE TABLE public.comments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  author_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  row_id       TEXT NOT NULL,          -- ID de la Row en el TibetanDocument
  lane_key     TEXT CHECK (lane_key IN ('tibetan', 'phonetic', 'translation')),
  body         TEXT NOT NULL,
  status       TEXT NOT NULL CHECK (status IN ('open', 'resolved')) DEFAULT 'open',
  anchor_text  TEXT,                   -- Texto seleccionado al crear el comentario (best-effort)
  anchor_offset INTEGER,               -- Offset en el texto del lane
  anchor_length INTEGER,
  resolved_at  TIMESTAMPTZ,
  resolved_by  UUID REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX comments_document_idx ON public.comments(document_id);
CREATE INDEX comments_row_idx ON public.comments(row_id);
CREATE INDEX comments_status_idx ON public.comments(status);
```

**RLS**:
- Pueden ver comentarios: dueño del documento + colaboradores
- Pueden crear comentarios: colaboradores con rol 'editor'
- Pueden resolver/editar: el autor del comentario + dueño del documento
- Pueden eliminar: autor del comentario + dueño del documento

---

## Relaciones

```
auth.users
  └─ profiles (1:1)
  └─ projects (1:N, owner_id)
       └─ project_collaborators (N:M con auth.users)
       └─ documents (1:N, project_id nullable)
            └─ document_collaborators (N:M con auth.users)
            └─ comments (1:N)
```

---

## Storage

### Bucket `fonts`
Ya existe en v1. Sin cambios.

### Bucket `images` (nuevo para portadas)
```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'images', 'images', false,
  10485760,  -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
) ON CONFLICT (id) DO NOTHING;
```

**RLS**: igual que `fonts` — cada usuario accede solo a su carpeta.

---

## Autenticación

### Flujos implementados
- Email + contraseña (sign up / sign in)
- Magic link (passwordless)

### Flujos pendientes
- **Password reset**: Supabase `resetPasswordForEmail()` + manejo de `PASSWORD_RECOVERY` event en `onAuthStateChange`
- **Email confirmation**: mostrar mensaje "revisá tu correo" después de sign up

### Recomendaciones de configuración
En el dashboard de Supabase → Authentication → Settings:
- `Site URL`: URL de producción de Vercel
- `Redirect URLs`: agregar URLs de preview de Vercel (`https://*.vercel.app`)
- Email confirmation: habilitado en producción, deshabilitado en desarrollo
- Session duration: 7 días (por defecto)

---

## Permisos RLS — Resumen completo

| Tabla | Acción | Quién puede |
|-------|--------|-------------|
| `profiles` | SELECT | Cualquier autenticado |
| `profiles` | UPDATE | Solo el propio usuario |
| `projects` | ALL | Dueño |
| `projects` | SELECT | Colaboradores del proyecto |
| `documents` | ALL | Dueño |
| `documents` | SELECT | Colaboradores (viewer + editor) |
| `documents` | UPDATE | Colaboradores editor |
| `document_collaborators` | ALL | Dueño del documento |
| `document_collaborators` | SELECT | El propio colaborador |
| `project_collaborators` | ALL | Dueño del proyecto |
| `comments` | SELECT | Dueño del doc + colaboradores |
| `comments` | INSERT | Colaboradores editor |
| `comments` | UPDATE | Autor del comentario |
| `comments` | DELETE | Autor + dueño del documento |

---

## Funciones RPC necesarias

```sql
-- Ya existe en v1 (helpers.sql)
-- get_user_id_by_email(email TEXT) RETURNS UUID

-- Nueva: obtener profile por email para invitar colaboradores
CREATE OR REPLACE FUNCTION public.get_profile_by_email(p_email TEXT)
RETURNS TABLE(id UUID, email TEXT, display_name TEXT)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql AS $$
  SELECT p.id, p.email, p.display_name
  FROM public.profiles p
  WHERE p.email = p_email
  LIMIT 1;
$$;
```

---

## Realtime (fase futura)

Supabase Realtime permite subscripciones en tiempo real a cambios de tablas.

Para colaboración básica (varios usuarios ven cambios de otros sin conflictos):
```typescript
supabase
  .channel('document-changes')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'documents',
    filter: `id=eq.${documentId}`
  }, (payload) => {
    // Merge strategy: last-write-wins con timestamp check
    const remoteDoc = payload.new.content as TibetanDocument
    if (remoteDoc.updatedAt > localDoc.updatedAt) {
      loadDocument(remoteDoc)
    }
  })
  .subscribe()
```

**Limitación importante**: last-write-wins funciona bien con 1-2 editores. Con más usuarios y ediciones simultáneas se requiere CRDT (Yjs/Automerge). Documentar esta limitación claramente en la UI.

---

## Migration Script

Ver `supabase/schema-v2.sql` para el script completo de migración desde v1 a v2.
