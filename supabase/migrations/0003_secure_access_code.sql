-- Secure access_code column and provide secure verification RPC

-- 1. Revoke default SELECT permission on profiles_xhs
REVOKE SELECT ON profiles_xhs FROM anon, authenticated;
-- 2. Grant SELECT only on non-sensitive columns
GRANT SELECT (
  id, 
  role, 
  nickname, 
  xhs_id, 
  avatar_url, 
  bio, 
  niche_tags, 
  whatsapp, 
  created_at
) ON profiles_xhs TO anon, authenticated;
-- 3. RPC to Verify Credentials securely (Returns profile data if valid)
CREATE OR REPLACE FUNCTION verify_influencer_credentials(
  p_xhs_id text,
  p_access_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  found_profile jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', id,
    'nickname', nickname,
    'bio', bio,
    'whatsapp', whatsapp,
    'niche_tags', niche_tags
  ) INTO found_profile
  FROM profiles_xhs
  WHERE xhs_id = p_xhs_id AND access_code = p_access_code;

  IF found_profile IS NULL THEN
    RAISE EXCEPTION 'Invalid credentials';
  END IF;

  RETURN found_profile;
END;
$$;
