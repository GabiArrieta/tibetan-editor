-- =============================================================================
-- Tibetan Editor — Supabase Schema v2 (Migration desde v1)
-- Ejecutar en el SQL Editor de tu proyecto Supabase DESPUÉS de schema.sql
-- =============================================================================

-- ─── 1. Profiles ─────────────────────────────────────────────────────────────
-- Extensión de auth.users con datos de display.
-- Se crea automáticamente al registrarse (via trigger).

CREATE TABLE IF NOT EXISTS public.profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        TEXT,
  display_name TEXT,
  avatar_url   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profiles readable by authenticated" ON public.profiles;
CREATE POLICY "Profiles readable by authenticated" ON public.profiles
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Trigger: crear profile al hacer signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── 2. Projects ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.projects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL DEFAULT 'Proyecto sin título',
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS projects_owner_idx ON public.projects(owner_id);
CREATE INDEX IF NOT EXISTS projects_updated_idx ON public.projects(updated_at DESC);

DROP TRIGGER IF EXISTS set_projects_updated_at ON public.projects;
CREATE TRIGGER set_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner full access projects" ON public.projects;
CREATE POLICY "Owner full access projects" ON public.projects
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- ─── 3. Enlazar documents con projects ───────────────────────────────────────
-- Backward compatible: project_id es nullable

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS documents_project_idx ON public.documents(project_id);

-- ─── 4. Project collaborators ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.project_collaborators (
  project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('viewer', 'editor')) DEFAULT 'editor',
  invited_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS project_collaborators_user_idx ON public.project_collaborators(user_id);

ALTER TABLE public.project_collaborators ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner manages project collaborators" ON public.project_collaborators;
CREATE POLICY "Owner manages project collaborators" ON public.project_collaborators
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_id AND owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "User sees own project collaborations" ON public.project_collaborators;
CREATE POLICY "User sees own project collaborations" ON public.project_collaborators
  FOR SELECT USING (user_id = auth.uid());

-- ─── 5. Comments ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.comments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id    UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  author_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  row_id         TEXT NOT NULL,
  lane_key       TEXT CHECK (lane_key IN ('tibetan', 'phonetic', 'translation')),
  body           TEXT NOT NULL,
  status         TEXT NOT NULL CHECK (status IN ('open', 'resolved')) DEFAULT 'open',
  anchor_text    TEXT,
  anchor_offset  INTEGER,
  anchor_length  INTEGER,
  resolved_at    TIMESTAMPTZ,
  resolved_by    UUID REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS comments_document_idx ON public.comments(document_id);
CREATE INDEX IF NOT EXISTS comments_row_idx ON public.comments(row_id);
CREATE INDEX IF NOT EXISTS comments_status_idx ON public.comments(status);
CREATE INDEX IF NOT EXISTS comments_author_idx ON public.comments(author_id);

DROP TRIGGER IF EXISTS set_comments_updated_at ON public.comments;
CREATE TRIGGER set_comments_updated_at
  BEFORE UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- Quién puede VER comentarios: dueño del documento + colaboradores
DROP POLICY IF EXISTS "Document members see comments" ON public.comments;
CREATE POLICY "Document members see comments" ON public.comments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_id
        AND (
          d.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.document_collaborators dc
            WHERE dc.document_id = d.id AND dc.user_id = auth.uid()
          )
        )
    )
  );

-- Quién puede CREAR comentarios: colaboradores editor + dueño
DROP POLICY IF EXISTS "Editors insert comments" ON public.comments;
CREATE POLICY "Editors insert comments" ON public.comments
  FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_id
        AND (
          d.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.document_collaborators dc
            WHERE dc.document_id = d.id AND dc.user_id = auth.uid() AND dc.role = 'editor'
          )
        )
    )
  );

-- Quién puede ACTUALIZAR comentarios: el autor del comentario
DROP POLICY IF EXISTS "Author updates own comment" ON public.comments;
CREATE POLICY "Author updates own comment" ON public.comments
  FOR UPDATE
  USING (author_id = auth.uid());

-- Quién puede BORRAR: autor + dueño del documento
DROP POLICY IF EXISTS "Author or owner deletes comment" ON public.comments;
CREATE POLICY "Author or owner deletes comment" ON public.comments
  FOR DELETE
  USING (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_id AND d.owner_id = auth.uid()
    )
  );

-- ─── 6. Storage: bucket images ───────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'images',
  'images',
  false,
  10485760,  -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "User image access" ON storage.objects;
CREATE POLICY "User image access" ON storage.objects
  FOR ALL
  USING (
    bucket_id = 'images' AND
    (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'images' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- ─── 7. RPC: get_profile_by_email ────────────────────────────────────────────

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

-- ─── 8. Vista accessible_projects ────────────────────────────────────────────

CREATE OR REPLACE VIEW public.accessible_projects AS
  SELECT
    p.id,
    p.name,
    p.description,
    p.owner_id,
    p.created_at,
    p.updated_at,
    'owner' AS access_role
  FROM public.projects p
  WHERE p.owner_id = auth.uid()

  UNION ALL

  SELECT
    p.id,
    p.name,
    p.description,
    p.owner_id,
    p.created_at,
    p.updated_at,
    pc.role AS access_role
  FROM public.projects p
  JOIN public.project_collaborators pc ON pc.project_id = p.id
  WHERE pc.user_id = auth.uid();
