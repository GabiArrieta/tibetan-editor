-- =============================================================================
-- Tibetan Editor — Supabase Schema
-- Ejecutar esto en el SQL Editor de tu proyecto Supabase
-- =============================================================================

-- 1. Tabla de documentos
-- El contenido del documento se guarda como JSONB (el TibetanDocument serializado)
-- Las fuentes NO se incluyen aquí — van a Supabase Storage

CREATE TABLE IF NOT EXISTS public.documents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL DEFAULT 'Sin título',
  content      JSONB NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index para listar documentos del usuario rápido
CREATE INDEX IF NOT EXISTS documents_owner_idx ON public.documents(owner_id);
CREATE INDEX IF NOT EXISTS documents_updated_idx ON public.documents(updated_at DESC);

-- 2. Tabla de colaboradores por documento
-- Permite compartir documentos con otros usuarios por email

CREATE TABLE IF NOT EXISTS public.document_collaborators (
  document_id  UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role         TEXT NOT NULL CHECK (role IN ('viewer', 'editor')) DEFAULT 'editor',
  invited_by   UUID REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (document_id, user_id)
);

CREATE INDEX IF NOT EXISTS collaborators_user_idx ON public.document_collaborators(user_id);

-- 3. Trigger para actualizar updated_at automáticamente

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON public.documents;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================================================
-- Row Level Security (RLS)
-- Cada usuario solo puede ver sus propios documentos + los compartidos con él
-- =============================================================================

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_collaborators ENABLE ROW LEVEL SECURITY;

-- Documentos: el dueño puede hacer todo
DROP POLICY IF EXISTS "Owner full access" ON public.documents;
CREATE POLICY "Owner full access" ON public.documents
  FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Documentos: colaboradores pueden leer
DROP POLICY IF EXISTS "Collaborator read" ON public.documents;
CREATE POLICY "Collaborator read" ON public.documents
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.document_collaborators
      WHERE document_id = id AND user_id = auth.uid()
    )
  );

-- Documentos: colaboradores con rol 'editor' pueden actualizar
DROP POLICY IF EXISTS "Collaborator edit" ON public.documents;
CREATE POLICY "Collaborator edit" ON public.documents
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.document_collaborators
      WHERE document_id = id AND user_id = auth.uid() AND role = 'editor'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.document_collaborators
      WHERE document_id = id AND user_id = auth.uid() AND role = 'editor'
    )
  );

-- Colaboradores: el dueño del documento puede gestionar colaboradores
DROP POLICY IF EXISTS "Owner manages collaborators" ON public.document_collaborators;
CREATE POLICY "Owner manages collaborators" ON public.document_collaborators
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.documents
      WHERE id = document_id AND owner_id = auth.uid()
    )
  );

-- Colaboradores: cada usuario puede ver sus propias entradas
DROP POLICY IF EXISTS "User sees own collaborations" ON public.document_collaborators;
CREATE POLICY "User sees own collaborations" ON public.document_collaborators
  FOR SELECT
  USING (user_id = auth.uid());

-- =============================================================================
-- Supabase Storage: bucket para fuentes custom (crear en el dashboard)
-- =============================================================================

-- INSTRUCCIÓN MANUAL:
-- En Supabase Dashboard → Storage → New bucket
-- Nombre: "fonts"
-- Public: NO (privado)
-- El código usa signed URLs para acceder a las fuentes

-- Si querés hacerlo por SQL:
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'fonts',
  'fonts',
  false,
  5242880, -- 5MB max por fuente
  ARRAY['font/ttf', 'font/otf', 'font/woff', 'font/woff2',
        'application/octet-stream', 'application/x-font-ttf',
        'application/x-font-woff']
)
ON CONFLICT (id) DO NOTHING;

-- RLS para Storage: cada usuario accede solo a sus fuentes
DROP POLICY IF EXISTS "User font access" ON storage.objects;
CREATE POLICY "User font access" ON storage.objects
  FOR ALL
  USING (
    bucket_id = 'fonts' AND
    (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'fonts' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- =============================================================================
-- Vista útil: documentos + info del colaborador (para DocumentBrowser)
-- =============================================================================

CREATE OR REPLACE VIEW public.accessible_documents AS
  SELECT
    d.id,
    d.title,
    d.owner_id,
    d.created_at,
    d.updated_at,
    'owner' AS access_role,
    (SELECT COUNT(*) FROM public.document_collaborators WHERE document_id = d.id) AS collaborator_count
  FROM public.documents d
  WHERE d.owner_id = auth.uid()

  UNION ALL

  SELECT
    d.id,
    d.title,
    d.owner_id,
    d.created_at,
    d.updated_at,
    dc.role AS access_role,
    (SELECT COUNT(*) FROM public.document_collaborators WHERE document_id = d.id) AS collaborator_count
  FROM public.documents d
  JOIN public.document_collaborators dc ON dc.document_id = d.id
  WHERE dc.user_id = auth.uid();
