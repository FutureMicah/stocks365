-- Count only roles tied to real auth users so bootstrap is not blocked by orphan rows.
-- Also treat "admin exists" only when a live account holds admin or super_admin.

CREATE OR REPLACE FUNCTION public.admin_bootstrap_available()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    INNER JOIN auth.users u ON u.id = ur.user_id
    WHERE ur.role IN ('admin'::public.app_role, 'super_admin'::public.app_role)
  );
$$;

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
    SELECT 1
    FROM public.user_roles ur
    INNER JOIN auth.users u ON u.id = ur.user_id
    WHERE ur.role IN ('admin'::public.app_role, 'super_admin'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'An administrator already exists. Sign in as that account, or ask a super administrator to invite you.';
  END IF;

  DELETE FROM public.user_roles ur
  WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = ur.user_id);

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

CREATE OR REPLACE FUNCTION public.list_admin_emails()
RETURNS TABLE (email text, roles text[])
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.email::text,
         array_agg(ur.role::text ORDER BY ur.role::text)
  FROM public.user_roles ur
  INNER JOIN auth.users u ON u.id = ur.user_id
  WHERE ur.role IN ('admin'::public.app_role, 'super_admin'::public.app_role)
  GROUP BY u.email;
$$;

REVOKE ALL ON FUNCTION public.list_admin_emails() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_admin_emails() TO service_role;
