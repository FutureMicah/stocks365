-- Remove practice-account starting balance. New users start at $0.
ALTER TABLE public.profiles ALTER COLUMN cash SET DEFAULT 0;

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'));
  INSERT INTO public.watchlist (user_id, symbol) VALUES (NEW.id,'AAPL'),(NEW.id,'NVDA'),(NEW.id,'MSFT'),(NEW.id,'TSLA'),(NEW.id,'AMZN');
  RETURN NEW;
END $$;
