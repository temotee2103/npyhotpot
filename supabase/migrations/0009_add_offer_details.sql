-- Migration: 0009_add_offer_details.sql

-- 1. Add column
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS offer_details TEXT;
-- 2. Update Create Campaign RPC
CREATE OR REPLACE FUNCTION create_campaign(
  p_merchant_id UUID,
  p_access_code TEXT,
  p_title TEXT,
  p_description TEXT,
  p_requirements TEXT,
  p_budget_range TEXT,
  p_quota INTEGER,
  p_offer_details TEXT DEFAULT NULL -- New param
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

  INSERT INTO campaigns (merchant_id, title, description, requirements, budget_range, quota, offer_details)
  VALUES (p_merchant_id, p_title, p_description, p_requirements, p_budget_range, p_quota, p_offer_details)
  RETURNING id INTO v_campaign_id;

  RETURN v_campaign_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- 3. Update Update Campaign RPC
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
  p_offer_details TEXT DEFAULT NULL -- New param
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
    updated_at = NOW()
  WHERE id = p_campaign_id AND merchant_id = p_merchant_id;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- 4. Update Approve Participant RPC (to return offer details)
CREATE OR REPLACE FUNCTION approve_participant(
  p_participant_id UUID,
  p_merchant_id UUID,
  p_access_code TEXT
) RETURNS JSONB AS $$
DECLARE
  v_participant RECORD;
  v_campaign RECORD;
  v_merchant RECORD;
  v_influencer RECORD;
  v_promo_code TEXT;
BEGIN
  -- 1. Verify Merchant
  SELECT * INTO v_merchant FROM profiles_xhs 
  WHERE id = p_merchant_id AND access_code = p_access_code AND role = 'merchant';
  
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid merchant credentials'; END IF;

  -- 2. Get Participant & Campaign
  SELECT * INTO v_participant FROM campaign_participants WHERE id = p_participant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Participant not found'; END IF;
  
  SELECT * INTO v_campaign FROM campaigns WHERE id = v_participant.campaign_id;
  IF v_campaign.merchant_id <> p_merchant_id THEN RAISE EXCEPTION 'Permission denied'; END IF;

  IF v_participant.status = 'approved' THEN RAISE EXCEPTION 'Already approved'; END IF;

  -- 3. Check Quota again
  IF v_campaign.quota > 0 AND v_campaign.quota_used >= v_campaign.quota THEN
    RAISE EXCEPTION 'Quota full';
  END IF;

  -- 4. Get Influencer Info
  SELECT * INTO v_influencer FROM profiles_xhs WHERE id = v_participant.influencer_id;

  -- 5. Generate Promo Code
  v_promo_code := UPPER(SUBSTRING(COALESCE(v_merchant.nickname, 'BRD'), 1, 3)) || '-' || 
                  UPPER(SUBSTRING(COALESCE(v_influencer.nickname, 'INF'), 1, 3)) || '-' || 
                  FLOOR(RANDOM() * 900 + 100)::TEXT;

  -- 6. Update Participant
  UPDATE campaign_participants 
  SET status = 'approved', promo_code = v_promo_code
  WHERE id = p_participant_id;

  -- 7. Update Campaign Quota
  UPDATE campaigns 
  SET quota_used = quota_used + 1 
  WHERE id = v_campaign.id;

  RETURN jsonb_build_object(
    'success', true,
    'promo_code', v_promo_code,
    'offer_details', v_campaign.offer_details -- Return this so UI can show it
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- 5. Update Get Merchant Campaigns RPC (to include offer_details)
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
  offer_details text, -- Added
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
    c.offer_details, -- Added
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
