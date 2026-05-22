-- Fix login issues caused by RLS hiding access_code column
-- Run this migration to fix merchant login and ensure role security

-- 1. Update verify_influencer_credentials to strictly check role='influencer'
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
    'xhs_id', xhs_id,
    'bio', bio,
    'whatsapp', whatsapp,
    'niche_tags', niche_tags,
    'avatar_url', avatar_url
  ) INTO found_profile
  FROM profiles_xhs
  WHERE xhs_id = p_xhs_id 
    AND access_code = p_access_code 
    AND role = 'influencer'; -- Enforce role

  IF found_profile IS NULL THEN
    RAISE EXCEPTION 'Invalid credentials or not an influencer';
  END IF;

  RETURN found_profile;
END;
$$;
-- 2. Create verify_merchant_credentials for Merchant Login
CREATE OR REPLACE FUNCTION verify_merchant_credentials(
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
    'xhs_id', xhs_id,
    'bio', bio,
    'whatsapp', whatsapp,
    'niche_tags', niche_tags,
    'avatar_url', avatar_url
  ) INTO found_profile
  FROM profiles_xhs
  WHERE xhs_id = p_xhs_id 
    AND access_code = p_access_code 
    AND role = 'merchant'; -- Enforce role

  IF found_profile IS NULL THEN
    RAISE EXCEPTION 'Invalid credentials or not a merchant';
  END IF;

  RETURN found_profile;
END;
$$;
