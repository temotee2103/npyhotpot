-- Migration: 0013_fix_permissions.sql

-- Grant permissions for public access
GRANT USAGE ON SCHEMA public TO anon, authenticated;
-- Profiles
GRANT SELECT ON TABLE profiles_xhs TO anon, authenticated;
-- Campaigns
GRANT SELECT ON TABLE campaigns TO anon, authenticated;
-- Reviews
GRANT SELECT ON TABLE reviews TO anon, authenticated;
-- Ensure RLS is enabled but allows select
ALTER TABLE profiles_xhs ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
-- Re-apply policies just in case (IF NOT EXISTS is not standard for policies, so we drop first)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles_xhs;
CREATE POLICY "Public profiles are viewable by everyone" ON profiles_xhs FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public campaigns are viewable by everyone" ON campaigns;
CREATE POLICY "Public campaigns are viewable by everyone" ON campaigns FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public reviews are viewable by everyone" ON reviews;
CREATE POLICY "Public reviews are viewable by everyone" ON reviews FOR SELECT USING (true);
