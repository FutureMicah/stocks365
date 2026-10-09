ALTER TABLE public.profiles ADD COLUMN ssn_last4 text, ADD COLUMN id_document_path text, ADD COLUMN id_type text, ADD COLUMN date_of_birth date, ADD COLUMN address text, ADD COLUMN kyc_status text NOT NULL DEFAULT 'unverified', ADD COLUMN kyc_submitted_at timestamptz;
ALTER TABLE public.transactions ADD COLUMN fee numeric(16,2) NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.execute_trade_v2(_uid uuid, _symbol text, _side text, _qty numeric, _price numeric, _fee_rate numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _cash numeric; _h record; _gross numeric := round(_qty * _price, 2); _fee numeric;
BEGIN
  IF _qty <= 0 OR _price <= 0 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
  _fee := round(_gross * _fee_rate, 2);
  SELECT cash INTO _cash FROM profiles WHERE id = _uid FOR UPDATE;
  SELECT * INTO _h FROM holdings WHERE user_id = _uid AND symbol = _symbol FOR UPDATE;
  IF _side = 'buy' THEN
    IF _cash < _gross + _fee THEN RAISE EXCEPTION 'Not enough cash'; END IF;
    UPDATE profiles SET cash = cash - _gross - _fee WHERE id = _uid;
    INSERT INTO holdings (user_id, symbol, qty, avg_cost) VALUES (_uid, _symbol, _qty, _price)
    ON CONFLICT (user_id, symbol) DO UPDATE SET
      avg_cost = (holdings.qty * holdings.avg_cost + EXCLUDED.qty * EXCLUDED.avg_cost) / (holdings.qty + EXCLUDED.qty),
      qty = holdings.qty + EXCLUDED.qty;
    INSERT INTO transactions (user_id, type, symbol, qty, price, amount, fee) VALUES (_uid, 'buy', _symbol, _qty, _price, -(_gross + _fee), _fee);
  ELSIF _side = 'sell' THEN
    IF _h IS NULL OR _h.qty < _qty THEN RAISE EXCEPTION 'Not enough shares'; END IF;
    UPDATE profiles SET cash = cash + _gross - _fee WHERE id = _uid;
    IF _h.qty = _qty THEN DELETE FROM holdings WHERE user_id = _uid AND symbol = _symbol;
    ELSE UPDATE holdings SET qty = qty - _qty WHERE user_id = _uid AND symbol = _symbol; END IF;
    INSERT INTO transactions (user_id, type, symbol, qty, price, amount, fee) VALUES (_uid, 'sell', _symbol, _qty, _price, _gross - _fee, _fee);
  ELSE RAISE EXCEPTION 'Invalid side'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.execute_trade_v2(uuid,text,text,numeric,numeric,numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.execute_trade_v2(uuid,text,text,numeric,numeric,numeric) TO service_role;

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ssn text := NEW.raw_user_meta_data->>'ssn_last4';
BEGIN
  INSERT INTO public.profiles (id, full_name, ssn_last4) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    CASE WHEN _ssn ~ '^[0-9]{4}$' THEN _ssn ELSE NULL END);
  INSERT INTO public.transactions (user_id, type, amount, method, note) VALUES (NEW.id, 'deposit', 100000, 'bonus', 'Practice account starting balance');
  INSERT INTO public.watchlist (user_id, symbol) VALUES (NEW.id,'AAPL'),(NEW.id,'NVDA'),(NEW.id,'MSFT'),(NEW.id,'TSLA'),(NEW.id,'AMZN');
  RETURN NEW;
END $$;

CREATE POLICY "kyc own upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'kyc-docs' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "kyc own read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'kyc-docs' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "kyc own update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'kyc-docs' AND (storage.foldername(name))[1] = auth.uid()::text);