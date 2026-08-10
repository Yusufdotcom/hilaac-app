-- Owner/manager avatar for Admin TopBar (Phase 1).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-avatars', 'profile-avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "public read profile-avatars" ON storage.objects;
CREATE POLICY "public read profile-avatars" ON storage.objects
  FOR SELECT USING (bucket_id = 'profile-avatars');

-- Path: {auth.uid()}/avatar-...
DROP POLICY IF EXISTS "users upload own profile-avatars" ON storage.objects;
CREATE POLICY "users upload own profile-avatars" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'profile-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "users update own profile-avatars" ON storage.objects;
CREATE POLICY "users update own profile-avatars" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'profile-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'profile-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "users delete own profile-avatars" ON storage.objects;
CREATE POLICY "users delete own profile-avatars" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'profile-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
