-- Merchant Dashboard Support Functions

-- 1. Get Merchant Campaigns (Secure)
CREATE OR REPLACE FUNCTION get_merchant_campaigns(
  p_merchant_id uuid,
  p_access_code text
)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  requirements text,
  budget_range text,
  quota integer,
  quota_used integer,
  status text,
  created_at timestamptz,
  participant_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  is_valid boolean;
BEGIN
  -- Verify Merchant
  SELECT EXISTS(
    SELECT 1 FROM profiles_xhs 
    WHERE id = p_merchant_id AND access_code = p_access_code AND role = 'merchant'
  ) INTO is_valid;

  IF NOT is_valid THEN
    RAISE EXCEPTION 'Invalid merchant credentials';
  END IF;

  RETURN QUERY
  SELECT 
    c.id,
    c.title,
    c.description,
    c.requirements,
    c.budget_range,
    c.quota,
    c.quota_used,
    c.status,
    c.created_at,
    (SELECT COUNT(*) FROM campaign_participants cp WHERE cp.campaign_id = c.id) as participant_count
  FROM campaigns c
  WHERE c.merchant_id = p_merchant_id
  ORDER BY c.created_at DESC;
END;
$$;
-- 2. Update Campaign (Secure)
CREATE OR REPLACE FUNCTION update_campaign(
  p_campaign_id uuid,
  p_merchant_id uuid,
  p_access_code text,
  p_title text,
  p_description text,
  p_requirements text,
  p_budget_range text,
  p_quota integer,
  p_status text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  is_valid boolean;
BEGIN
  -- Verify Merchant matches Campaign owner
  SELECT EXISTS(
    SELECT 1 
    FROM campaigns c
    JOIN profiles_xhs p ON c.merchant_id = p.id
    WHERE c.id = p_campaign_id 
      AND p.id = p_merchant_id 
      AND p.access_code = p_access_code 
      AND p.role = 'merchant'
  ) INTO is_valid;

  IF NOT is_valid THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  UPDATE campaigns
  SET 
    title = p_title,
    description = p_description,
    requirements = p_requirements,
    budget_range = p_budget_range,
    quota = p_quota,
    status = p_status,
    updated_at = NOW()
  WHERE id = p_campaign_id;

  RETURN true;
END;
$$;
-- 3. Get Campaign Participants (Secure)
CREATE OR REPLACE FUNCTION get_campaign_participants(
  p_campaign_id uuid,
  p_merchant_id uuid,
  p_access_code text
)
RETURNS TABLE (
  participant_id uuid,
  status text,
  promo_code text,
  created_at timestamptz,
  influencer_nickname text,
  influencer_xhs_id text,
  influencer_avatar_url text,
  influencer_whatsapp text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  is_valid boolean;
BEGIN
  -- Verify Merchant owns the campaign
  SELECT EXISTS(
    SELECT 1 
    FROM campaigns c
    JOIN profiles_xhs p ON c.merchant_id = p.id
    WHERE c.id = p_campaign_id 
      AND p.id = p_merchant_id 
      AND p.access_code = p_access_code
  ) INTO is_valid;

  IF NOT is_valid THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  RETURN QUERY
  SELECT 
    cp.id as participant_id,
    cp.status,
    cp.promo_code,
    cp.created_at,
    p.nickname as influencer_nickname,
    p.xhs_id as influencer_xhs_id,
    p.avatar_url as influencer_avatar_url,
    p.whatsapp as influencer_whatsapp
  FROM campaign_participants cp
  JOIN profiles_xhs p ON cp.influencer_id = p.id
  WHERE cp.campaign_id = p_campaign_id
  ORDER BY cp.created_at DESC;
END;
$$;
