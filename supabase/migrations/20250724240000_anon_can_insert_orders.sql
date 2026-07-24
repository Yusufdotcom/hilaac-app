-- Allow guest / Incognito / new-browser customers (Supabase anon role) to insert orders.
-- Table grants were previously revoked from anon; policy + INSERT grant are both required.

DROP POLICY IF EXISTS "anon_can_insert_orders" ON public.orders;

CREATE POLICY "anon_can_insert_orders"
  ON public.orders
  FOR INSERT
  TO anon
  WITH CHECK (auth.role() = 'anon');

GRANT INSERT ON public.orders TO anon;
