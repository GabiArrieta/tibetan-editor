-- =============================================================================
-- Tibetan Editor — Schema v3: Security Hardening
-- Ejecutar DESPUÉS de schema.sql y schema-v2.sql
--
-- Este script corrige los problemas de seguridad identificados en la auditoría:
--
-- 1. Profiles RLS: cualquier usuario autenticado podía leer TODOS los perfiles
-- 2. Projects RLS: colaboradores no podían leer proyectos compartidos
-- 3. Comment UPDATE: sin WITH CHECK → autor podía mover comentario a otro doc
-- 4. get_profile_by_email: ejecutable por usuarios no autenticados
-- 5. Font storage: colaboradores no podían leer fuentes del dueño
-- 6. owner_id escalation: trigger que impide que un editor se robe un documento
-- =============================================================================

-- ─── 1. Profiles RLS: restringir lectura ──────────────────────────────────────
-- Antes: cualquier usuario autenticado veía todos los perfiles (incluyendo emails).
-- Después: solo tu propio perfil + perfiles de personas con quienes compartís docs.

DROP POLICY IF EXISTS "Profiles readable by authenticated" ON public.profiles;

-- Solo podés leer tu propio perfil
DROP POLICY IF EXISTS "Own profile readable" ON public.profiles;
CREATE POLICY "Own profile readable" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Podés leer perfiles de colaboradores en tus documentos
DROP POLICY IF EXISTS "Collaborator profiles readable" ON public.profiles;
CREATE POLICY "Collaborator profiles readable" ON public.profiles
  FOR SELECT
  USING (
    -- El perfil pertenece a alguien que colabora en un doc del que soy dueño
    EXISTS (
      SELECT 1 FROM public.documents d
      JOIN public.document_collaborators dc ON dc.document_id = d.id
      WHERE d.owner_id = auth.uid() AND dc.user_id = profiles.id
    )
    OR
    -- El perfil pertenece al dueño de un doc en el que yo colaboro
    EXISTS (
      SELECT 1 FROM public.documents d
      JOIN public.document_collaborators dc ON dc.document_id = d.id
      WHERE dc.user_id = auth.uid() AND d.owner_id = profiles.id
    )
    OR
    -- Comparten acceso a un mismo documento
    EXISTS (
      SELECT 1 FROM public.document_collaborators dc1
      JOIN public.document_collaborators dc2 ON dc1.document_id = dc2.document_id
      WHERE dc1.user_id = auth.uid() AND dc2.user_id = profiles.id
    )
  );

-- UPDATE: solo tu propio perfil
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ─── 2. Projects RLS: permitir que colaboradores lean proyectos ───────────────
-- Antes: solo el owner podía leer filas de projects → la vista accessible_projects
-- devolvía vacío para colaboradores.
-- Después: colaboradores de project_collaborators también pueden leer el proyecto.

DROP POLICY IF EXISTS "Collaborator reads project" ON public.projects;
CREATE POLICY "Collaborator reads project" ON public.projects
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.project_collaborators
      WHERE project_id = id AND user_id = auth.uid()
    )
  );

-- ─── 3. Comment UPDATE: agregar WITH CHECK para evitar mover comentario a otro doc ──
-- Antes: el autor podía cambiar document_id a cualquier documento.
-- Después: el UPDATE solo procede si el document_id no cambia.

DROP POLICY IF EXISTS "Author updates own comment" ON public.comments;
CREATE POLICY "Author updates own comment" ON public.comments
  FOR UPDATE
  USING (author_id = auth.uid())
  WITH CHECK (
    author_id = auth.uid()
    -- Impedir que se mueva el comentario a un documento diferente
    AND document_id = (
      SELECT c.document_id FROM public.comments c WHERE c.id = comments.id LIMIT 1
    )
  );

-- ─── 4. Fix get_profile_by_email: solo usuarios autenticados ─────────────────
-- El GRANT ya existe en schema-v2.sql, pero por seguridad lo reforzamos.
-- Revocamos acceso a rol 'public' (anon) y lo dejamos solo para 'authenticated'.

REVOKE EXECUTE ON FUNCTION public.get_profile_by_email(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profile_by_email(TEXT) TO authenticated;

-- get_user_id_by_email ya tiene GRANT solo a authenticated en helpers.sql.
-- Lo reforzamos por si se corrió en otro orden:
REVOKE EXECUTE ON FUNCTION public.get_user_id_by_email(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_id_by_email(TEXT) TO authenticated;

-- ─── 5. Font storage: permitir acceso de lectura a colaboradores ──────────────
-- Antes: solo el dueño de la carpeta podía leer/crear signed URLs de sus fuentes.
-- Los colaboradores que intentaban descargar fuentes del dueño recibían error RLS.
-- Después: un colaborador (editor o viewer) puede leer (SELECT) las fuentes
-- de documentos a los que tiene acceso.

-- La política FOR ALL existente sigue aplicando para el propio usuario.
-- Agregamos una política SELECT específica para colaboradores.

DROP POLICY IF EXISTS "Collaborator font read" ON storage.objects;
CREATE POLICY "Collaborator font read" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'fonts'
    AND (
      -- El usuario es el dueño de la carpeta (path component [1])
      (storage.foldername(name))[1] = auth.uid()::text
      OR
      -- El usuario es colaborador de un documento cuyo dueño tiene esa carpeta
      EXISTS (
        SELECT 1
        FROM public.document_collaborators dc
        JOIN public.documents d ON d.id = dc.document_id
        WHERE dc.user_id = auth.uid()
          AND d.owner_id::text = (storage.foldername(name))[1]
      )
    )
  );

-- ─── 6. Images bucket: misma política colaborativa ───────────────────────────

DROP POLICY IF EXISTS "Collaborator image read" ON storage.objects;
CREATE POLICY "Collaborator image read" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'images'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR
      EXISTS (
        SELECT 1
        FROM public.document_collaborators dc
        JOIN public.documents d ON d.id = dc.document_id
        WHERE dc.user_id = auth.uid()
          AND d.owner_id::text = (storage.foldername(name))[1]
      )
    )
  );

-- ─── 7. Trigger: impedir cambio de owner_id por no-dueños ────────────────────
-- Antes: un editor podía hacer upsert con owner_id = su_propio_uuid,
--        robando la propiedad del documento. RLS solo checkeaba si era editor.
-- Después: cualquier intento de cambiar owner_id por alguien que no sea
--          el owner actual lanza un error ANTES del commit.

CREATE OR REPLACE FUNCTION public.prevent_owner_id_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Solo verificar si owner_id cambió
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    -- Permitir solo si quien hace el cambio ES el owner actual
    IF auth.uid() IS DISTINCT FROM OLD.owner_id THEN
      RAISE EXCEPTION 'permission_denied: solo el dueño del documento puede transferir la propiedad'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_document_owner_id ON public.documents;
CREATE TRIGGER guard_document_owner_id
  BEFORE UPDATE OF owner_id ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_owner_id_change();

-- ─── 8. Restricción adicional: editor no puede cambiar owner_id via RLS ──────
-- Reforzamos la política "Collaborator edit" para que su WITH CHECK
-- también exija que owner_id no cambie (doble capa: trigger + RLS).

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
    -- El usuario sigue siendo editor
    EXISTS (
      SELECT 1 FROM public.document_collaborators
      WHERE document_id = id AND user_id = auth.uid() AND role = 'editor'
    )
    -- El owner_id no puede cambiar (verificado también por trigger, pero doble capa)
    AND owner_id = (SELECT d.owner_id FROM public.documents d WHERE d.id = documents.id)
  );

-- ─── 9. Verificar que no haya tablas sin RLS ─────────────────────────────────
-- Ejecutar esta consulta para auditar (no modifica nada):
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY tablename;

-- ─── 10. GRANT de funciones de utilidad: solo para authenticated ─────────────

-- Asegurar que get_user_id_by_email no sea accesible por anon
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    JOIN pg_namespace ON pg_namespace.oid = pg_proc.pronamespace
    WHERE proname = 'get_user_id_by_email' AND nspname = 'public'
  ) THEN
    REVOKE EXECUTE ON FUNCTION public.get_user_id_by_email(TEXT) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.get_user_id_by_email(TEXT) TO authenticated;
  END IF;
END$$;
