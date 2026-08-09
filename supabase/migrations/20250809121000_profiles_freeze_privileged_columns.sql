-- N3: Block privilege escalation via self-UPDATE of role / restaurant_id / is_active.
-- Owner/manager may still update other non-owner staff rows (existing RLS).
-- service_role / no JWT (auth.uid() null) is allowed for Admin API paths.

CREATE OR REPLACE FUNCTION public.profiles_prevent_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admin / service-role paths (no end-user JWT).
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Owner/manager updating another non-owner staff row in their restaurant.
  IF NEW.id IS DISTINCT FROM auth.uid()
     AND public.is_manager_or_owner()
     AND OLD.role IS DISTINCT FROM 'owner'
     AND NEW.role IS DISTINCT FROM 'owner'
     AND NEW.restaurant_id = public.get_my_restaurant_id()
  THEN
    RETURN NEW;
  END IF;

  -- Self-update (or any other path): freeze privileged columns.
  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.restaurant_id IS DISTINCT FROM OLD.restaurant_id
     OR NEW.is_active IS DISTINCT FROM OLD.is_active
  THEN
    RAISE EXCEPTION 'Cannot change role, restaurant_id, or is_active on this profile'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_prevent_privilege_escalation ON public.profiles;
CREATE TRIGGER profiles_prevent_privilege_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_prevent_privilege_escalation();
