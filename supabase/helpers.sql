-- =============================================================================
-- Funciones auxiliares — ejecutar DESPUÉS de schema.sql
-- =============================================================================

-- Función para buscar el user_id a partir de un email.
-- Necesaria para la feature de "compartir documento por email".
-- SECURITY DEFINER permite acceder a auth.users desde el cliente.

CREATE OR REPLACE FUNCTION public.get_user_id_by_email(email_input TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  found_id UUID;
BEGIN
  SELECT id INTO found_id
  FROM auth.users
  WHERE email = email_input
  LIMIT 1;

  RETURN found_id;
END;
$$;

-- Permitir que cualquier usuario autenticado llame a esta función
GRANT EXECUTE ON FUNCTION public.get_user_id_by_email(TEXT) TO authenticated;

-- =============================================================================
-- NOTA: Esta función expone si un email está registrado o no.
-- Para mayor privacidad, podés reemplazarla por un sistema de invitaciones
-- donde el usuario invitado recibe un email de notificación.
-- =============================================================================
