-- Allow SQL-editor/admin execution while keeping self-delete restrictions for authenticated users

CREATE OR REPLACE FUNCTION public.delete_user_completely(user_id_to_delete uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text := auth.role();
  v_db_role text := current_user;
BEGIN
  IF v_db_role NOT IN ('postgres', 'supabase_admin')
     AND v_role IS DISTINCT FROM 'service_role' THEN
    IF v_uid IS NULL THEN
      RAISE EXCEPTION 'AUTH_REQUIRED';
    END IF;

    IF v_uid <> user_id_to_delete THEN
      RAISE EXCEPTION 'FORBIDDEN';
    END IF;
  END IF;

  DELETE FROM auth.users WHERE id = user_id_to_delete;
END;
$$;
