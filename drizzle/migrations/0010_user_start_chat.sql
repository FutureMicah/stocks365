-- Let any signed-in user open (or reuse) their support thread and send the first message.
CREATE OR REPLACE FUNCTION public.user_open_chat(_body text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tid uuid;
  _msg text := nullif(trim(coalesce(_body, '')), '');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in required';
  END IF;

  INSERT INTO public.chat_threads (user_id, created_by)
  VALUES (auth.uid(), auth.uid())
  ON CONFLICT (user_id) DO UPDATE
    SET last_message_at = public.chat_threads.last_message_at
  RETURNING id INTO _tid;

  IF _tid IS NULL THEN
    SELECT id INTO _tid FROM public.chat_threads WHERE user_id = auth.uid();
  END IF;

  IF _msg IS NOT NULL THEN
    IF length(_msg) > 2000 THEN
      RAISE EXCEPTION 'Message must be at most 2000 characters';
    END IF;
    INSERT INTO public.chat_messages (thread_id, sender_id, body)
    VALUES (_tid, auth.uid(), _msg);
    UPDATE public.chat_threads SET last_message_at = now() WHERE id = _tid;
  END IF;

  RETURN _tid;
END;
$$;

REVOKE ALL ON FUNCTION public.user_open_chat(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_open_chat(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.chat_send(_thread uuid, _body text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _t public.chat_threads%ROWTYPE;
  _msg text := trim(_body);
  _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF length(_msg) < 1 OR length(_msg) > 2000 THEN
    RAISE EXCEPTION 'Message must be between 1 and 2000 characters';
  END IF;
  SELECT * INTO _t FROM public.chat_threads WHERE id = _thread FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conversation not found'; END IF;
  IF public.has_role(auth.uid(), 'admin') THEN
    NULL;
  ELSIF _t.user_id = auth.uid() THEN
    NULL;
  ELSE
    RAISE EXCEPTION 'Not allowed to message this conversation';
  END IF;
  INSERT INTO public.chat_messages (thread_id, sender_id, body)
  VALUES (_thread, auth.uid(), _msg)
  RETURNING id INTO _id;
  UPDATE public.chat_threads SET last_message_at = now() WHERE id = _thread;
  RETURN _id;
END;
$$;
