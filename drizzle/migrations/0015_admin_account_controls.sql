-- Account lifecycle controls for administrators: suspend, ban, adjust cash, soft-delete marker.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active'
    CHECK (account_status IN ('active', 'suspended', 'banned')),
  ADD COLUMN IF NOT EXISTS status_note text,
  ADD COLUMN IF NOT EXISTS status_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS status_changed_by uuid;

COMMENT ON COLUMN public.profiles.account_status IS 'active | suspended | banned — enforced by app and RPCs';

-- Set status (suspend / ban / restore). Admins only; cannot target self or super_admin.
CREATE OR REPLACE FUNCTION public.admin_set_account_status(
  _subject uuid,
  _status text,
  _note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Administrator access required';
  END IF;
  IF _subject = auth.uid() THEN
    RAISE EXCEPTION 'You cannot change your own account status';
  END IF;
  IF _status NOT IN ('active', 'suspended', 'banned') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;
  IF public.has_role(_subject, 'super_admin') THEN
    RAISE EXCEPTION 'Cannot change status of a super administrator';
  END IF;

  UPDATE public.profiles
  SET
    account_status = _status,
    status_note = nullif(trim(coalesce(_note, '')), ''),
    status_changed_at = now(),
    status_changed_by = auth.uid()
  WHERE id = _subject;

  IF NOT FOUND THEN RAISE EXCEPTION 'Account not found'; END IF;

  INSERT INTO public.admin_audit (admin_id, subject_id, action, note)
  VALUES (
    auth.uid(),
    _subject,
    'account_' || _status,
    coalesce(nullif(trim(coalesce(_note, '')), ''), 'Status set to ' || _status)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_account_status(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_account_status(uuid, text, text) TO authenticated;

-- Adjust cash balance (set absolute amount). Records transaction + audit.
CREATE OR REPLACE FUNCTION public.admin_set_cash(
  _subject uuid,
  _cash numeric,
  _note text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _prev numeric;
  _delta numeric;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Administrator access required';
  END IF;
  IF _cash IS NULL OR _cash < 0 OR _cash > 100000000 THEN
    RAISE EXCEPTION 'Cash must be between 0 and 100,000,000';
  END IF;
  IF abs(_cash * 100 - round(_cash * 100)) > 0.000001 THEN
    RAISE EXCEPTION 'Use no more than two decimal places';
  END IF;
  IF length(trim(coalesce(_note, ''))) < 3 THEN
    RAISE EXCEPTION 'A note of at least 3 characters is required';
  END IF;

  SELECT cash INTO _prev FROM public.profiles WHERE id = _subject FOR UPDATE;
  IF _prev IS NULL THEN RAISE EXCEPTION 'Account not found'; END IF;

  _delta := round(_cash, 2) - _prev;
  UPDATE public.profiles SET cash = round(_cash, 2) WHERE id = _subject;

  IF _delta <> 0 THEN
    INSERT INTO public.transactions (user_id, type, amount, method, note)
    VALUES (
      _subject,
      CASE WHEN _delta > 0 THEN 'deposit' ELSE 'withdrawal' END,
      _delta,
      'admin',
      'Admin balance adjustment: ' || trim(_note)
    );
  END IF;

  INSERT INTO public.admin_audit (admin_id, subject_id, action, note)
  VALUES (
    auth.uid(),
    _subject,
    'cash_adjusted',
    format('Cash set to %s (was %s). %s', round(_cash, 2), _prev, trim(_note))
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_cash(uuid, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_cash(uuid, numeric, text) TO authenticated;

-- Prepare delete + audit. App calls auth.admin.deleteUser after this RPC.
CREATE OR REPLACE FUNCTION public.admin_delete_user(_subject uuid, _note text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Administrator access required';
  END IF;
  IF _subject = auth.uid() THEN
    RAISE EXCEPTION 'You cannot delete your own account';
  END IF;
  IF public.has_role(_subject, 'super_admin') THEN
    RAISE EXCEPTION 'Cannot delete a super administrator';
  END IF;
  IF length(trim(coalesce(_note, ''))) < 3 THEN
    RAISE EXCEPTION 'A note of at least 3 characters is required';
  END IF;

  INSERT INTO public.admin_audit (admin_id, subject_id, action, note)
  VALUES (auth.uid(), _subject, 'account_deleted', trim(_note));

  UPDATE public.profiles
  SET account_status = 'banned',
      status_note = trim(_note),
      status_changed_at = now(),
      status_changed_by = auth.uid()
  WHERE id = _subject;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_user(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.assert_account_active(_uid uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _st text;
BEGIN
  SELECT account_status INTO _st FROM public.profiles WHERE id = _uid;
  IF _st IS NULL THEN RAISE EXCEPTION 'Profile not found'; END IF;
  IF _st = 'suspended' THEN
    RAISE EXCEPTION 'This account is suspended. Contact support.';
  END IF;
  IF _st = 'banned' THEN
    RAISE EXCEPTION 'This account has been banned.';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_account_active(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assert_account_active(uuid) TO authenticated, service_role;
