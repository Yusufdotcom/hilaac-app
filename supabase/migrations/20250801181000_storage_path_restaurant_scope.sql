-- H7: Authenticated uploads to menu-images / restaurant-logos must be under
-- {restaurant_id}/... matching the caller's restaurant (or a restaurant they own).

CREATE OR REPLACE FUNCTION public.can_write_restaurant_storage(object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    auth.role() = 'authenticated'
    AND public.is_manager_or_owner()
    AND (
      (storage.foldername(object_name))[1] = public.get_my_restaurant_id()::text
      OR EXISTS (
        SELECT 1
        FROM public.restaurants r
        WHERE r.id::text = (storage.foldername(object_name))[1]
          AND r.owner_id = auth.uid()
      )
    );
$$;

REVOKE ALL ON FUNCTION public.can_write_restaurant_storage(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_write_restaurant_storage(text) TO authenticated;

DROP POLICY IF EXISTS "staff upload menu-images" ON storage.objects;
CREATE POLICY "staff upload menu-images" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'menu-images'
    AND public.can_write_restaurant_storage(name)
  );

DROP POLICY IF EXISTS "staff update menu-images" ON storage.objects;
CREATE POLICY "staff update menu-images" ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'menu-images'
    AND public.can_write_restaurant_storage(name)
  )
  WITH CHECK (
    bucket_id = 'menu-images'
    AND public.can_write_restaurant_storage(name)
  );

DROP POLICY IF EXISTS "staff upload restaurant-logos" ON storage.objects;
CREATE POLICY "staff upload restaurant-logos" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'restaurant-logos'
    AND public.can_write_restaurant_storage(name)
  );

DROP POLICY IF EXISTS "staff update restaurant-logos" ON storage.objects;
CREATE POLICY "staff update restaurant-logos" ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'restaurant-logos'
    AND public.can_write_restaurant_storage(name)
  )
  WITH CHECK (
    bucket_id = 'restaurant-logos'
    AND public.can_write_restaurant_storage(name)
  );
