-- 1. Campaigns Table
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID REFERENCES profiles_xhs(id) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  requirements TEXT, -- JSON or Text
  budget_range TEXT,
  quota INTEGER DEFAULT 0,
  quota_used INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active', -- active, closed
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- 2. Campaign Participants Table (To track who grabbed)
CREATE TABLE IF NOT EXISTS campaign_participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID REFERENCES campaigns(id) NOT NULL,
  influencer_id UUID REFERENCES profiles_xhs(id) NOT NULL,
  status TEXT DEFAULT 'grabbed', -- grabbed, completed
  promo_code TEXT, -- Auto-generated code
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_id, influencer_id)
);
-- 3. RPC to Create Campaign
CREATE OR REPLACE FUNCTION create_campaign(
  p_merchant_id UUID,
  p_access_code TEXT,
  p_title TEXT,
  p_description TEXT,
  p_requirements TEXT,
  p_budget_range TEXT,
  p_quota INTEGER
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

  INSERT INTO campaigns (merchant_id, title, description, requirements, budget_range, quota)
  VALUES (p_merchant_id, p_title, p_description, p_requirements, p_budget_range, p_quota)
  RETURNING id INTO v_campaign_id;

  RETURN v_campaign_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- 4. RPC for "Smart Grab"
CREATE OR REPLACE FUNCTION grab_campaign(
  p_campaign_id UUID,
  p_influencer_id UUID,
  p_access_code TEXT -- Influencer's access code
) RETURNS JSONB AS $$
DECLARE
  v_campaign RECORD;
  v_influencer RECORD;
  v_merchant RECORD;
  v_promo_code TEXT;
  v_collab_count INTEGER;
  v_participant_id UUID;
BEGIN
  -- 1. Verify Influencer
  SELECT * INTO v_influencer FROM profiles_xhs 
  WHERE id = p_influencer_id AND access_code = p_access_code AND role = 'influencer';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid influencer credentials';
  END IF;

  -- 2. Get Campaign & Lock row for quota update
  SELECT * INTO v_campaign FROM campaigns WHERE id = p_campaign_id FOR UPDATE;
  
  IF NOT FOUND THEN RAISE EXCEPTION 'Campaign not found'; END IF;
  IF v_campaign.status <> 'active' THEN RAISE EXCEPTION 'Campaign is closed'; END IF;
  IF v_campaign.quota > 0 AND v_campaign.quota_used >= v_campaign.quota THEN
    RAISE EXCEPTION 'Campaign quota full';
  END IF;

  -- 3. Check if already grabbed
  PERFORM 1 FROM campaign_participants 
  WHERE campaign_id = p_campaign_id AND influencer_id = p_influencer_id;
  
  IF FOUND THEN
    RAISE EXCEPTION 'Already grabbed this campaign';
  END IF;

  -- 4. Get Merchant Info for Code Generation
  SELECT * INTO v_merchant FROM profiles_xhs WHERE id = v_campaign.merchant_id;

  -- 5. Calculate Collab Count (Past interactions)
  SELECT COUNT(*) INTO v_collab_count 
  FROM campaign_participants cp
  JOIN campaigns c ON cp.campaign_id = c.id
  WHERE c.merchant_id = v_campaign.merchant_id 
  AND cp.influencer_id = p_influencer_id;

  -- 6. Generate Promo Code: BRAND-INF-01
  -- Simple logic: MerchantName(3chars) + InfName(3chars) + Random(3digits)
  -- Handle cases where nickname is null or short
  v_promo_code := UPPER(SUBSTRING(COALESCE(v_merchant.nickname, 'BRD'), 1, 3)) || '-' || 
                  UPPER(SUBSTRING(COALESCE(v_influencer.nickname, 'INF'), 1, 3)) || '-' || 
                  FLOOR(RANDOM() * 900 + 100)::TEXT;

  -- 7. Insert Participant
  INSERT INTO campaign_participants (campaign_id, influencer_id, promo_code)
  VALUES (p_campaign_id, p_influencer_id, v_promo_code)
  RETURNING id INTO v_participant_id;

  -- 8. Update Quota
  UPDATE campaigns 
  SET quota_used = quota_used + 1 
  WHERE id = p_campaign_id;

  -- 9. Return Data for WhatsApp
  RETURN jsonb_build_object(
    'merchant_whatsapp', v_merchant.whatsapp,
    'merchant_name', v_merchant.nickname,
    'campaign_title', v_campaign.title,
    'promo_code', v_promo_code,
    'collab_count', v_collab_count + 1 -- Current one counts as new interaction start
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- 5. RPC to Create Merchant (Similar to create_influencer_profile)
CREATE OR REPLACE FUNCTION create_merchant_profile(
  p_nickname TEXT, -- Brand Name
  p_xhs_id TEXT, -- Login ID / Handle
  p_bio TEXT, -- Brand Intro
  p_niche_tags TEXT[], -- Industry
  p_whatsapp TEXT,
  p_avatar_url TEXT DEFAULT ''
) RETURNS JSONB AS $$
DECLARE
  v_id UUID;
  v_access_code TEXT;
BEGIN
  -- Generate random 6-digit access code
  v_access_code := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');

  INSERT INTO profiles_xhs (role, nickname, xhs_id, bio, niche_tags, whatsapp, avatar_url, access_code)
  VALUES ('merchant', p_nickname, p_xhs_id, p_bio, p_niche_tags, p_whatsapp, p_avatar_url, v_access_code)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'id', v_id,
    'access_code', v_access_code
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
