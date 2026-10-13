ALTER TABLE public.profiles ALTER COLUMN cash SET DEFAULT 0;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_role_key UNIQUE (user_id, role);

CREATE TABLE public.cash_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('deposit','withdrawal')),
  method text NOT NULL CHECK (method IN ('ach','crypto')),
  amount numeric NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cash_requests TO authenticated;
GRANT ALL ON public.cash_requests TO service_role;
ALTER TABLE public.cash_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_cash_requests ON public.cash_requests FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY admin_cash_requests ON public.cash_requests FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE POLICY admin_roles_read ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY admin_holdings_read ON public.holdings FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.request_cash(_type text, _method text, _amount numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _cash numeric;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF _amount <= 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  IF _type = 'withdrawal' THEN
    SELECT cash INTO _cash FROM profiles WHERE id = auth.uid();
    IF _cash < _amount + COALESCE((SELECT sum(amount) FROM cash_requests WHERE user_id=auth.uid() AND type='withdrawal' AND status='pending'),0) THEN RAISE EXCEPTION 'Amount exceeds your available cash'; END IF;
  END IF;
  INSERT INTO cash_requests(user_id,type,method,amount) VALUES (auth.uid(),_type,_method,round(_amount,2));
END $$;
GRANT EXECUTE ON FUNCTION public.request_cash(text,text,numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_decide_cash(_id uuid, _approve boolean, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _r record; _cash numeric;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Administrator access required'; END IF;
  SELECT * INTO _r FROM cash_requests WHERE id=_id AND status='pending' FOR UPDATE;
  IF _r IS NULL THEN RAISE EXCEPTION 'Request is no longer pending'; END IF;
  IF _approve THEN
    SELECT cash INTO _cash FROM profiles WHERE id=_r.user_id FOR UPDATE;
    IF _r.type='withdrawal' THEN
      IF _cash < _r.amount THEN RAISE EXCEPTION 'Customer cash is below the withdrawal amount'; END IF;
      UPDATE profiles SET cash=cash-_r.amount WHERE id=_r.user_id;
      INSERT INTO transactions(user_id,type,amount,method,note) VALUES(_r.user_id,'withdrawal',-_r.amount,_r.method,'Approved by administrator');
    ELSE
      UPDATE profiles SET cash=cash+_r.amount WHERE id=_r.user_id;
      INSERT INTO transactions(user_id,type,amount,method,note) VALUES(_r.user_id,'deposit',_r.amount,_r.method,'Approved by administrator');
    END IF;
  END IF;
  UPDATE cash_requests SET status=CASE WHEN _approve THEN 'approved' ELSE 'rejected' END, note=_note, reviewed_by=auth.uid(), reviewed_at=now() WHERE id=_id;
  INSERT INTO admin_audit(admin_id,subject_id,action,note) VALUES(auth.uid(),_r.user_id,_r.type || CASE WHEN _approve THEN '_approved' ELSE '_rejected' END, COALESCE(NULLIF(trim(_note),''),'—') || ' (' || _r.amount || ' ' || _r.method || ')');
END $$;
GRANT EXECUTE ON FUNCTION public.admin_decide_cash(uuid,boolean,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.open_loan(_uid uuid, _kind text, _principal numeric, _rate numeric, _term integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _r numeric := _rate / 100 / 12; _pmt numeric;
BEGIN
  IF _principal <= 0 OR _term <= 0 THEN RAISE EXCEPTION 'Invalid loan'; END IF;
  IF (SELECT count(*) FROM loans WHERE user_id = _uid AND status IN ('active','pending')) >= 3 THEN RAISE EXCEPTION 'Maximum of 3 open loans'; END IF;
  _pmt := CASE WHEN _r = 0 THEN _principal / _term ELSE _principal * _r / (1 - power(1 + _r, -_term)) END;
  INSERT INTO loans (user_id, kind, principal, rate, term_months, monthly_payment, balance, status) VALUES (_uid, _kind, _principal, _rate, _term, round(_pmt,2), _principal, 'pending');
END $$;

CREATE OR REPLACE FUNCTION public.admin_decide_loan(_id uuid, _approve boolean, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _l record;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Administrator access required'; END IF;
  SELECT * INTO _l FROM loans WHERE id=_id AND status='pending' FOR UPDATE;
  IF _l IS NULL THEN RAISE EXCEPTION 'Loan is no longer pending'; END IF;
  IF _approve THEN
    UPDATE loans SET status='active' WHERE id=_id;
    UPDATE profiles SET cash=cash+_l.principal WHERE id=_l.user_id;
    INSERT INTO transactions(user_id,type,amount,method,note) VALUES(_l.user_id,'loan',_l.principal,_l.kind,'Loan approved by administrator');
  ELSE
    UPDATE loans SET status='rejected' WHERE id=_id;
  END IF;
  INSERT INTO admin_audit(admin_id,subject_id,action,note) VALUES(auth.uid(),_l.user_id,'loan_' || CASE WHEN _approve THEN 'approved' ELSE 'rejected' END, COALESCE(NULLIF(trim(_note),''),'—'));
END $$;
GRANT EXECUTE ON FUNCTION public.admin_decide_loan(uuid,boolean,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ssn text := NEW.raw_user_meta_data->>'ssn_last4';
BEGIN
  INSERT INTO public.profiles (id, full_name, ssn_last4, cash) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    CASE WHEN _ssn ~ '^[0-9]{4}$' THEN _ssn ELSE NULL END, 0);
  INSERT INTO public.watchlist (user_id, symbol) VALUES (NEW.id,'AAPL'),(NEW.id,'NVDA'),(NEW.id,'MSFT'),(NEW.id,'TSLA'),(NEW.id,'AMZN');
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.grant_super_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL AND lower(NEW.email) = 'futuremicah4@gmail.com' THEN
    INSERT INTO public.user_roles(user_id,role) VALUES (NEW.id,'super_admin'),(NEW.id,'admin') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created_super_admin AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.grant_super_admin();
CREATE TRIGGER on_auth_user_confirmed_super_admin AFTER UPDATE OF email_confirmed_at ON auth.users FOR EACH ROW WHEN (old.email_confirmed_at IS NULL AND new.email_confirmed_at IS NOT NULL) EXECUTE FUNCTION public.grant_super_admin();

INSERT INTO public.user_roles(user_id,role) SELECT id, r FROM auth.users, unnest(ARRAY['super_admin','admin']::public.app_role[]) r WHERE lower(email)='futuremicah4@gmail.com' AND email_confirmed_at IS NOT NULL ON CONFLICT DO NOTHING;
UPDATE public.profiles SET cash = 0 WHERE cash <> 0;
DELETE FROM public.transactions WHERE method = 'bonus';