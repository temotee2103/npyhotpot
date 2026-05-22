-- Migration: 0011_add_campaign_tags.sql

-- 1. Add tags column to campaigns table
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
-- 2. Update Create Campaign RPC
CREATE OR REPLACE FUNCTION create_campaign(
  p_merchant_id UUID,
  p_access_code TEXT,
  p_title TEXT,
  p_description TEXT,
  p_requirements TEXT,
  p_budget_range TEXT,
  p_quota INTEGER,
  p_offer_details TEXT DEFAULT NULL,
  p_tags TEXT[] DEFAULT '{}' -- New param
) RETURNS UUID AS $$
DECLARE
  v_campaign_id UUID;
BEGIN
  -- Verify merchant access code
  PERFORM 1 FROM profiles_xhs 
  WHERE id = p_merchant_id AND access_code = p_access_code AND role = 'merchant';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid merchant credentials';
  END IF;

  INSERT INTO campaigns (merchant_id, title, description, requirements, budget_range, quota, offer_details, tags)
  VALUES (p_merchant_id, p_title, p_description, p_requirements, p_budget_range, p_quota, p_offer_details, p_tags)
  RETURNING id INTO v_campaign_id;

  RETURN v_campaign_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- 3. Update Update Campaign RPC
-- Drop old version to avoid ambiguity
DROP FUNCTION IF EXISTS update_campaign(uuid, uuid, text, text, text, text, text, integer, text, text);
CREATE OR REPLACE FUNCTION update_campaign(
  p_campaign_id UUID,
  p_merchant_id UUID,
  p_access_code TEXT,
  p_title TEXT,
  p_description TEXT,
  p_requirements TEXT,
  p_budget_range TEXT,
  p_quota INTEGER,
  p_status TEXT,
  p_offer_details TEXT DEFAULT NULL,
  p_tags TEXT[] DEFAULT '{}' -- New param
) RETURNS BOOLEAN AS $$
BEGIN
  -- Verify merchant
  PERFORM 1 FROM profiles_xhs 
  WHERE id = p_merchant_id AND access_code = p_access_code AND role = 'merchant';
  
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid merchant credentials'; END IF;

  UPDATE campaigns
  SET 
    title = p_title,
    description = p_description,
    requirements = p_requirements,
    budget_range = p_budget_range,
    quota = p_quota,
    status = p_status,
    offer_details = p_offer_details,
    tags = p_tags,
    updated_at = NOW()
  WHERE id = p_campaign_id AND merchant_id = p_merchant_id;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- 4. Update Get Merchant Campaigns RPC (to include tags)
DROP FUNCTION IF EXISTS get_merchant_campaigns(uuid, text);
CREATE OR REPLACE FUNCTION get_merchant_campaigns(
  p_merchant_id uuid,
  p_access_code text
)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  requirements text,
  offer_details text,
  tags text[], -- Added
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
    SELECT 1 FROM profiles_xhs p
    WHERE p.id = p_merchant_id AND p.access_code = p_access_code AND p.role = 'merchant'
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
    c.offer_details,
    c.tags, -- Added
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
