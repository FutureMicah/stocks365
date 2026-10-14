-- Destination details for withdrawals (bank transfer / crypto payout).
ALTER TABLE public.cash_requests
  ADD COLUMN IF NOT EXISTS destination text;

CREATE OR REPLACE FUNCTION public.request_cash(_type text, _method text, _amount numeric, _destination text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cash numeric;
  _dest text := nullif(trim(coalesce(_destination, '')), '');
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF _type NOT IN ('deposit', 'withdrawal') THEN RAISE EXCEPTION 'Invalid request type'; END IF;
  IF _method NOT IN ('ach', 'crypto') THEN RAISE EXCEPTION 'Invalid method'; END IF;
  IF _amount IS NULL OR _amount < 1 OR _amount > 10000000 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  IF abs(_amount * 100 - round(_amount * 100)) > 0.000001 THEN RAISE EXCEPTION 'Use no more than two decimal places'; END IF;

  IF _type = 'withdrawal' THEN
    IF _dest IS NULL OR length(_dest) < 8 THEN
      RAISE EXCEPTION 'Withdrawal destination is required';
    END IF;
    IF length(_dest) > 1000 THEN RAISE EXCEPTION 'Destination is too long'; END IF;
    SELECT cash INTO _cash FROM profiles WHERE id = auth.uid();
    IF _cash IS NULL THEN RAISE EXCEPTION 'Profile not found'; END IF;
    IF _cash < _amount + COALESCE((
      SELECT sum(amount) FROM cash_requests
      WHERE user_id = auth.uid() AND type = 'withdrawal' AND status = 'pending'
    ), 0) THEN
      RAISE EXCEPTION 'Amount exceeds your available cash';
    END IF;
  ELSE
    _dest := NULL;
  END IF;

  INSERT INTO cash_requests (user_id, type, method, amount, destination)
  VALUES (auth.uid(), _type, _method, round(_amount, 2), _dest);
END;
$$;

REVOKE ALL ON FUNCTION public.request_cash(text, text, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_cash(text, text, numeric, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.request_cash(_type text, _method text, _amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.request_cash(_type, _method, _amount, NULL);
END;
$$;
REVOKE ALL ON FUNCTION public.request_cash(text, text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_cash(text, text, numeric) TO authenticated;
