-- One-time claim: when no admin or super_admin exists, the calling user becomes both.
CREATE OR REPLACE FUNCTION public.bootstrap_first_admin()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.user_roles WHERE role IN ('admin'::public.app_role, 'super_admin'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'An administrator already exists';
  END IF;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), 'admin'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), 'super_admin'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  INSERT INTO public.admin_audit (admin_id, subject_id, action, note)
  VALUES (auth.uid(), auth.uid(), 'admin_bootstrap', 'First administrator claimed');
END;
$$;

REVOKE ALL ON FUNCTION public.bootstrap_first_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bootstrap_first_admin() TO authenticated, service_role;

-- True when the system still has no admin or super_admin (for UI gating).
CREATE OR REPLACE FUNCTION public.admin_bootstrap_available()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE role IN ('admin'::public.app_role, 'super_admin'::public.app_role)
  );
$$;

REVOKE ALL ON FUNCTION public.admin_bootstrap_available() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_bootstrap_available() TO authenticated, service_role;
