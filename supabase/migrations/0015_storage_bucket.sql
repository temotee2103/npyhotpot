-- Migration: 0015_storage_bucket.sql

-- 1. Create the storage bucket 'avatars' if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;
-- 2. Enable RLS on storage.objects (it might be enabled by default, but good to ensure)
-- ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Upload Access" ON storage.objects;
DROP POLICY IF EXISTS "Update Access" ON storage.objects;
-- 4. Create Policies

-- Policy: Anyone can view avatars (Public Read)
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'avatars' );
-- Policy: Anyone can upload avatars (Since we use custom auth/anon, we allow anon uploads)
-- In a stricter prod environment, we might validate the filename matches a user ID or use a signed URL.
CREATE POLICY "Upload Access"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'avatars' );
-- Policy: Allow updates
CREATE POLICY "Update Access"
ON storage.objects FOR UPDATE
WITH CHECK ( bucket_id = 'avatars' );
