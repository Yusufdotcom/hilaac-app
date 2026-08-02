-- H4 follow-up: live orders policies use is_staff(restaurant_id), which
-- previously ignored profiles.is_active and bypassed get_my_restaurant_id().

CREATE OR REPLACE FUNCTION public.is_staff(restaurant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.restaurant_id = $1
      AND profiles.id = auth.uid()
      AND profiles.is_active = true
      AND profiles.role IN ('owner', 'manager', 'waiter', 'kitchen', 'cashier')
  );
END;
$$;
