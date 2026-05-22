-- Migration: 0010_fulfillment_and_reviews.sql

-- 1. Add submission columns to campaign_participants
ALTER TABLE campaign_participants 
ADD COLUMN IF NOT EXISTS submission_url TEXT,
ADD COLUMN IF NOT EXISTS submission_time TIMESTAMPTZ;
-- 2. Create Reviews Table
CREATE TABLE IF NOT EXISTS reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID REFERENCES campaigns(id) NOT NULL,
  reviewer_id UUID REFERENCES profiles_xhs(id) NOT NULL,
  reviewee_id UUID REFERENCES profiles_xhs(id) NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  content TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- 3. RPC: Submit Work (Influencer)
CREATE OR REPLACE FUNCTION submit_campaign_work(
  p_participant_id UUID,
  p_influencer_id UUID,
  p_access_code TEXT,
  p_submission_url TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_participant RECORD;
BEGIN
  -- Verify Influencer
  PERFORM 1 FROM profiles_xhs 
  WHERE id = p_influencer_id AND access_code = p_access_code AND role = 'influencer';
  
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid influencer credentials'; END IF;

  SELECT * INTO v_participant FROM campaign_participants WHERE id = p_participant_id;
  
  IF v_participant.influencer_id <> p_influencer_id THEN RAISE EXCEPTION 'Permission denied'; END IF;
  
  -- Allow resubmission if submitted but not verified yet? Or strict state?
  -- Let's allow if approved or submitted (resubmit)
  IF v_participant.status NOT IN ('approved', 'submitted') THEN 
    RAISE EXCEPTION 'Status must be approved to submit'; 
  END IF;

  UPDATE campaign_participants
  SET 
    status = 'submitted',
    submission_url = p_submission_url,
    submission_time = NOW()
  WHERE id = p_participant_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- 4. RPC: Verify Work (Merchant)
CREATE OR REPLACE FUNCTION verify_campaign_work(
  p_participant_id UUID,
  p_merchant_id UUID,
  p_access_code TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_participant RECORD;
  v_campaign RECORD;
BEGIN
  -- Verify Merchant
  PERFORM 1 FROM profiles_xhs 
  WHERE id = p_merchant_id AND access_code = p_access_code AND role = 'merchant';
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid merchant credentials'; END IF;

  SELECT * INTO v_participant FROM campaign_participants WHERE id = p_participant_id;
  SELECT * INTO v_campaign FROM campaigns WHERE id = v_participant.campaign_id;
  
  IF v_campaign.merchant_id <> p_merchant_id THEN RAISE EXCEPTION 'Permission denied'; END IF;
  IF v_participant.status <> 'submitted' THEN RAISE EXCEPTION 'Work not submitted yet'; END IF;

  UPDATE campaign_participants
  SET status = 'verified'
  WHERE id = p_participant_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- 5. RPC: Submit Review
CREATE OR REPLACE FUNCTION submit_review(
  p_campaign_id UUID,
  p_reviewer_id UUID,
  p_access_code TEXT,
  p_reviewee_id UUID,
  p_rating INTEGER,
  p_content TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  -- Verify Reviewer
  PERFORM 1 FROM profiles_xhs 
  WHERE id = p_reviewer_id AND access_code = p_access_code;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid credentials'; END IF;

  INSERT INTO reviews (campaign_id, reviewer_id, reviewee_id, rating, content)
  VALUES (p_campaign_id, p_reviewer_id, p_reviewee_id, p_rating, p_content);

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- 6. Update get_campaign_participants to include submission info
DROP FUNCTION IF EXISTS get_campaign_participants(uuid, uuid, text);
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
  submission_url text, -- Added
  submission_time timestamptz, -- Added
  influencer_id uuid, -- Added
  influencer_nickname text,
  influencer_xhs_id text,
  influencer_avatar_url text,
  influencer_whatsapp text,
  influencer_tags text[] -- Added
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
    cp.submission_url, -- Added
    cp.submission_time, -- Added
    p.id as influencer_id, -- Added
    p.nickname as influencer_nickname,
    p.xhs_id as influencer_xhs_id,
    p.avatar_url as influencer_avatar_url,
    p.whatsapp as influencer_whatsapp,
    p.niche_tags as influencer_tags -- Added
  FROM campaign_participants cp
  JOIN profiles_xhs p ON cp.influencer_id = p.id
  WHERE cp.campaign_id = p_campaign_id
  ORDER BY cp.created_at DESC;
END;
$$;
