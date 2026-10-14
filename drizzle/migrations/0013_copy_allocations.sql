-- Persist copy-trading allocations so the book survives devices and browsers.
CREATE TABLE IF NOT EXISTS public.copy_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trader_id text NOT NULL,
  amount numeric(18, 2) NOT NULL CHECK (amount > 0),
  positions jsonb NOT NULL DEFAULT '[]'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, trader_id)
);

CREATE INDEX IF NOT EXISTS copy_allocations_user ON public.copy_allocations (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.copy_allocations TO authenticated;
GRANT ALL ON public.copy_allocations TO service_role;

ALTER TABLE public.copy_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS copy_own ON public.copy_allocations;
CREATE POLICY copy_own ON public.copy_allocations
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
