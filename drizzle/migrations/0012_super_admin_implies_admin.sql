-- super_admin should pass every check that expects admin (RLS + RPCs use has_role(..., 'admin')).
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND (
        role = _role
        OR (_role = 'admin'::public.app_role AND role = 'super_admin'::public.app_role)
      )
  );
$$;

-- Ensure every super_admin also has an explicit admin row.
INSERT INTO public.user_roles (user_id, role)
SELECT ur.user_id, 'admin'::public.app_role
FROM public.user_roles ur
WHERE ur.role = 'super_admin'::public.app_role
ON CONFLICT (user_id, role) DO NOTHING;
