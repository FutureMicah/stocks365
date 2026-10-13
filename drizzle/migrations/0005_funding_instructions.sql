CREATE TABLE public.funding_instructions (
  method text PRIMARY KEY CHECK (method IN ('ach','crypto')),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.funding_instructions TO authenticated;
GRANT ALL ON public.funding_instructions TO service_role;
ALTER TABLE public.funding_instructions ENABLE ROW LEVEL SECURITY;
CREATE POLICY funding_instructions_read ON public.funding_instructions FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.admin_set_funding_instructions(_method text, _details jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Administrator access required'; END IF;
  IF _method NOT IN ('ach','crypto') THEN RAISE EXCEPTION 'Invalid method'; END IF;
  INSERT INTO funding_instructions(method,details,updated_by,updated_at) VALUES(_method,_details,auth.uid(),now())
    ON CONFLICT (method) DO UPDATE SET details=EXCLUDED.details, updated_by=EXCLUDED.updated_by, updated_at=EXCLUDED.updated_at;
  INSERT INTO admin_audit(admin_id,subject_id,action,note) VALUES(auth.uid(),auth.uid(),'deposit_instructions_updated',upper(_method) || ' deposit instructions changed');
END $$;
GRANT EXECUTE ON FUNCTION public.admin_set_funding_instructions(text,jsonb) TO authenticated;
