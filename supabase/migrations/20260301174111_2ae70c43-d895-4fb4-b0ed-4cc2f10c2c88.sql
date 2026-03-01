CREATE POLICY "Users can view own invite by email"
  ON public.admin_invites
  FOR SELECT
  USING (
    email = lower((select auth.jwt() ->> 'email'))
  );