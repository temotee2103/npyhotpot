-- Enable Guest Access / Access Code Management
-- Run this in Supabase SQL Editor

-- 1. Modify profiles_xhs table to remove Auth dependency and add access_code
ALTER TABLE profiles_xhs DROP CONSTRAINT IF EXISTS profiles_xhs_id_fkey;
ALTER TABLE profiles_xhs ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE profiles_xhs ADD COLUMN IF NOT EXISTS access_code text;
-- 2. RPC to Create Influencer (Returns ID and Access Code)
CREATE OR REPLACE FUNCTION create_influencer_profile(
  p_nickname text,
  p_xhs_id text,
  p_avatar_url text,
  p_bio text,
  p_niche_tags text[],
  p_whatsapp text,
  p_services jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_id uuid;
  new_code text;
  service_item jsonb;
BEGIN
  -- Generate random 6-digit code
  new_code := floor(random() * (999999 - 100000 + 1) + 100000)::text;
  
  -- Insert Profile (Generate new UUID)
  INSERT INTO profiles_xhs (
    id, role, nickname, xhs_id, avatar_url, bio, niche_tags, whatsapp, access_code
  ) VALUES (
    gen_random_uuid(), 'influencer', p_nickname, p_xhs_id, p_avatar_url, p_bio, p_niche_tags, p_whatsapp, new_code
  ) RETURNING id INTO new_id;

  -- Insert Services
  IF p_services IS NOT NULL THEN
    FOR service_item IN SELECT * FROM jsonb_array_elements(p_services)
    LOOP
      INSERT INTO influencer_services_xhs (
        profile_id, service_type, price, description
      ) VALUES (
        new_id,
        service_item->>'service_type',
        (service_item->>'price')::numeric,
        service_item->>'description'
      );
    END LOOP;
  END IF;

  RETURN jsonb_build_object('id', new_id, 'access_code', new_code);
END;
$$;
-- 3. RPC to Update Influencer
CREATE OR REPLACE FUNCTION update_influencer_profile(
  p_id uuid,
  p_access_code text,
  p_nickname text,
  p_xhs_id text,
  p_avatar_url text,
  p_bio text,
  p_niche_tags text[],
  p_whatsapp text,
  p_services jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  service_item jsonb;
  valid_code boolean;
BEGIN
  -- Verify Access Code
  SELECT EXISTS(
    SELECT 1 FROM profiles_xhs WHERE id = p_id AND access_code = p_access_code
  ) INTO valid_code;

  IF NOT valid_code THEN
    RAISE EXCEPTION 'Invalid access code';
  END IF;

  -- Update Profile
  UPDATE profiles_xhs SET
    nickname = p_nickname,
    xhs_id = p_xhs_id,
    avatar_url = p_avatar_url,
    bio = p_bio,
    niche_tags = p_niche_tags,
    whatsapp = p_whatsapp
  WHERE id = p_id;

  -- Update Services (Delete all and re-insert)
  DELETE FROM influencer_services_xhs WHERE profile_id = p_id;

  IF p_services IS NOT NULL THEN
    FOR service_item IN SELECT * FROM jsonb_array_elements(p_services)
    LOOP
      INSERT INTO influencer_services_xhs (
        profile_id, service_type, price, description
      ) VALUES (
        p_id,
        service_item->>'service_type',
        (service_item->>'price')::numeric,
        service_item->>'description'
      );
    END LOOP;
  END IF;

  RETURN true;
END;
$$;
-- 4. RPC to Delete Influencer
CREATE OR REPLACE FUNCTION delete_influencer_profile(
  p_id uuid,
  p_access_code text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  valid_code boolean;
BEGIN
  -- Verify Access Code
  SELECT EXISTS(
    SELECT 1 FROM profiles_xhs WHERE id = p_id AND access_code = p_access_code
  ) INTO valid_code;

  IF NOT valid_code THEN
    RAISE EXCEPTION 'Invalid access code';
  END IF;

  -- Delete Profile (Cascade should handle services if configured, otherwise delete services first)
  DELETE FROM influencer_services_xhs WHERE profile_id = p_id;
  DELETE FROM profiles_xhs WHERE id = p_id;

  RETURN true;
END;
$$;
