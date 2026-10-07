CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  phone text,
  cash numeric(16,2) NOT NULL DEFAULT 100000,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (full_name, phone) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE public.holdings (
  user_id uuid NOT NULL,
  symbol text NOT NULL,
  qty numeric(18,4) NOT NULL DEFAULT 0,
  avg_cost numeric(16,4) NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, symbol)
);
GRANT SELECT ON public.holdings TO authenticated;
GRANT ALL ON public.holdings TO service_role;
ALTER TABLE public.holdings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own holdings" ON public.holdings FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  symbol text,
  qty numeric(18,4),
  price numeric(16,4),
  amount numeric(16,2) NOT NULL,
  method text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.transactions (user_id, created_at DESC);
GRANT SELECT ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tx" ON public.transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.watchlist (
  user_id uuid NOT NULL,
  symbol text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, symbol)
);
GRANT SELECT, INSERT, DELETE ON public.watchlist TO authenticated;
GRANT ALL ON public.watchlist TO service_role;
ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own wl read" ON public.watchlist FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own wl ins" ON public.watchlist FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own wl del" ON public.watchlist FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL,
  principal numeric(16,2) NOT NULL,
  rate numeric(6,3) NOT NULL,
  term_months int NOT NULL,
  monthly_payment numeric(16,2) NOT NULL,
  balance numeric(16,2) NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.loans TO authenticated;
GRANT ALL ON public.loans TO service_role;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own loans" ON public.loans FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'));
  INSERT INTO public.transactions (user_id, type, amount, method, note) VALUES (NEW.id, 'deposit', 100000, 'bonus', 'Practice account starting balance');
  INSERT INTO public.watchlist (user_id, symbol) VALUES (NEW.id,'AAPL'),(NEW.id,'NVDA'),(NEW.id,'MSFT'),(NEW.id,'TSLA'),(NEW.id,'AMZN');
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.execute_trade(_uid uuid, _symbol text, _side text, _qty numeric, _price numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _cash numeric; _h record; _total numeric := round(_qty * _price, 2);
BEGIN
  IF _qty <= 0 OR _price <= 0 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
  SELECT cash INTO _cash FROM profiles WHERE id = _uid FOR UPDATE;
  SELECT * INTO _h FROM holdings WHERE user_id = _uid AND symbol = _symbol FOR UPDATE;
  IF _side = 'buy' THEN
    IF _cash < _total THEN RAISE EXCEPTION 'Not enough cash'; END IF;
    UPDATE profiles SET cash = cash - _total WHERE id = _uid;
    INSERT INTO holdings (user_id, symbol, qty, avg_cost) VALUES (_uid, _symbol, _qty, _price)
    ON CONFLICT (user_id, symbol) DO UPDATE SET
      avg_cost = (holdings.qty * holdings.avg_cost + EXCLUDED.qty * EXCLUDED.avg_cost) / (holdings.qty + EXCLUDED.qty),
      qty = holdings.qty + EXCLUDED.qty;
  ELSIF _side = 'sell' THEN
    IF _h IS NULL OR _h.qty < _qty THEN RAISE EXCEPTION 'Not enough shares'; END IF;
    UPDATE profiles SET cash = cash + _total WHERE id = _uid;
    IF _h.qty = _qty THEN DELETE FROM holdings WHERE user_id = _uid AND symbol = _symbol;
    ELSE UPDATE holdings SET qty = qty - _qty WHERE user_id = _uid AND symbol = _symbol; END IF;
  ELSE RAISE EXCEPTION 'Invalid side'; END IF;
  INSERT INTO transactions (user_id, type, symbol, qty, price, amount) VALUES (_uid, _side, _symbol, _qty, _price, CASE WHEN _side='buy' THEN -_total ELSE _total END);
END $$;

CREATE OR REPLACE FUNCTION public.cash_move(_uid uuid, _type text, _amount numeric, _method text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _cash numeric;
BEGIN
  IF _amount <= 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  SELECT cash INTO _cash FROM profiles WHERE id = _uid FOR UPDATE;
  IF _type = 'withdrawal' THEN
    IF _cash < _amount THEN RAISE EXCEPTION 'Not enough cash'; END IF;
    UPDATE profiles SET cash = cash - _amount WHERE id = _uid;
    INSERT INTO transactions (user_id, type, amount, method) VALUES (_uid, 'withdrawal', -_amount, _method);
  ELSIF _type = 'deposit' THEN
    UPDATE profiles SET cash = cash + _amount WHERE id = _uid;
    INSERT INTO transactions (user_id, type, amount, method) VALUES (_uid, 'deposit', _amount, _method);
  ELSE RAISE EXCEPTION 'Invalid type'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.open_loan(_uid uuid, _kind text, _principal numeric, _rate numeric, _term int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _r numeric := _rate / 100 / 12; _pmt numeric;
BEGIN
  IF _principal <= 0 OR _term <= 0 THEN RAISE EXCEPTION 'Invalid loan'; END IF;
  IF (SELECT count(*) FROM loans WHERE user_id = _uid AND status = 'active') >= 3 THEN RAISE EXCEPTION 'Maximum of 3 active loans'; END IF;
  _pmt := CASE WHEN _r = 0 THEN _principal / _term ELSE _principal * _r / (1 - power(1 + _r, -_term)) END;
  INSERT INTO loans (user_id, kind, principal, rate, term_months, monthly_payment, balance) VALUES (_uid, _kind, _principal, _rate, _term, round(_pmt,2), _principal);
  UPDATE profiles SET cash = cash + _principal WHERE id = _uid;
  INSERT INTO transactions (user_id, type, amount, method, note) VALUES (_uid, 'loan', _principal, _kind, upper(_kind) || ' funds drawn');
END $$;

CREATE OR REPLACE FUNCTION public.repay_loan(_uid uuid, _loan uuid, _amount numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _l record; _cash numeric; _pay numeric;
BEGIN
  SELECT * INTO _l FROM loans WHERE id = _loan AND user_id = _uid AND status='active' FOR UPDATE;
  IF _l IS NULL THEN RAISE EXCEPTION 'Loan not found'; END IF;
  _pay := least(_amount, _l.balance);
  SELECT cash INTO _cash FROM profiles WHERE id = _uid FOR UPDATE;
  IF _pay <= 0 OR _cash < _pay THEN RAISE EXCEPTION 'Not enough cash'; END IF;
  UPDATE profiles SET cash = cash - _pay WHERE id = _uid;
  UPDATE loans SET balance = balance - _pay, status = CASE WHEN balance - _pay <= 0 THEN 'paid' ELSE status END WHERE id = _loan;
  INSERT INTO transactions (user_id, type, amount, method, note) VALUES (_uid, 'loan_payment', -_pay, _l.kind, 'Loan repayment');
END $$;

REVOKE ALL ON FUNCTION public.execute_trade(uuid,text,text,numeric,numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cash_move(uuid,text,numeric,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.open_loan(uuid,text,numeric,numeric,int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.repay_loan(uuid,uuid,numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.execute_trade(uuid,text,text,numeric,numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.cash_move(uuid,text,numeric,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.open_loan(uuid,text,numeric,numeric,int) TO service_role;
GRANT EXECUTE ON FUNCTION public.repay_loan(uuid,uuid,numeric) TO service_role;