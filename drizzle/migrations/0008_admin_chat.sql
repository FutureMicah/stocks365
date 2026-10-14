-- Admin-initiated support chat. Admin starts threads; users may reply only after a thread exists.
CREATE TABLE public.chat_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);
GRANT SELECT ON public.chat_threads TO authenticated;
GRANT ALL ON public.chat_threads TO service_role;
ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;
-- Users can see that their own thread exists (to open the inbox). Admins see all.
CREATE POLICY chat_threads_user ON public.chat_threads FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  body text NOT NULL CHECK (char_length(trim(body)) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chat_messages_thread_created ON public.chat_messages (thread_id, created_at);
GRANT SELECT ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
-- Users only read messages in their own thread; admins read every message (full history).
CREATE POLICY chat_messages_read ON public.chat_messages FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.chat_threads t
      WHERE t.id = thread_id AND t.user_id = auth.uid()
    )
  );

-- Admin starts (or reuses) a thread with a user and optionally posts the first message.
CREATE OR REPLACE FUNCTION public.admin_open_chat(_user uuid, _body text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tid uuid;
  _msg text := nullif(trim(coalesce(_body, '')), '');
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Administrator access required';
  END IF;
  IF _user = auth.uid() THEN
    RAISE EXCEPTION 'You cannot open a chat with yourself';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user) THEN
    RAISE EXCEPTION 'Account not found';
  END IF;
  INSERT INTO public.chat_threads (user_id, created_by)
  VALUES (_user, auth.uid())
  ON CONFLICT (user_id) DO UPDATE SET last_message_at = public.chat_threads.last_message_at
  RETURNING id INTO _tid;
  IF _tid IS NULL THEN
    SELECT id INTO _tid FROM public.chat_threads WHERE user_id = _user;
  END IF;
  IF _msg IS NOT NULL THEN
    INSERT INTO public.chat_messages (thread_id, sender_id, body) VALUES (_tid, auth.uid(), _msg);
    UPDATE public.chat_threads SET last_message_at = now() WHERE id = _tid;
  END IF;
  RETURN _tid;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_open_chat(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_open_chat(uuid, text) TO authenticated;

-- Send a message: admin anytime; user only on their existing thread.
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
  IF length(_msg) < 1 OR length(_msg) > 2000 THEN
    RAISE EXCEPTION 'Message must be between 1 and 2000 characters';
  END IF;
  SELECT * INTO _t FROM public.chat_threads WHERE id = _thread FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conversation not found'; END IF;
  IF public.has_role(auth.uid(), 'admin') THEN
    NULL; -- admin may message any thread
  ELSIF _t.user_id = auth.uid() THEN
    NULL; -- user may reply on their own thread only
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
REVOKE ALL ON FUNCTION public.chat_send(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.chat_send(uuid, text) TO authenticated;
