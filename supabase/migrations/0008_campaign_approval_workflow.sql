-- Migration: 0008_campaign_approval_workflow.sql

-- 1. Update status default to 'pending' (and migrate old data)
ALTER TABLE campaign_participants ALTER COLUMN status SET DEFAULT 'pending';
UPDATE campaign_participants SET status = 'approved' WHERE status = 'grabbed';
-- 2. New RPC: Apply for Campaign (Replaces grab_campaign logic)
CREATE OR REPLACE FUNCTION apply_for_campaign(
  p_campaign_id UUID,
  p_influencer_id UUID,
  p_access_code TEXT
) RETURNS JSONB AS $$
DECLARE
  v_campaign RECORD;
  v_influencer RECORD;
  v_merchant RECORD;
BEGIN
  -- 1. Verify Influencer
  SELECT * INTO v_influencer FROM profiles_xhs 
  WHERE id = p_influencer_id AND access_code = p_access_code AND role = 'influencer';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid influencer credentials';
  END IF;

  -- 2. Get Campaign
  SELECT * INTO v_campaign FROM campaigns WHERE id = p_campaign_id;
  
  IF NOT FOUND THEN RAISE EXCEPTION 'Campaign not found'; END IF;
  IF v_campaign.status <> 'active' THEN RAISE EXCEPTION 'Campaign is closed'; END IF;
  
  -- Note: We allow applying even if quota is full, merchant decides. 
  -- Or we can block if quota full. Let's block if hard limit.
  IF v_campaign.quota > 0 AND v_campaign.quota_used >= v_campaign.quota THEN
    RAISE EXCEPTION 'Campaign quota full';
  END IF;

  -- 3. Check if already applied
  PERFORM 1 FROM campaign_participants 
  WHERE campaign_id = p_campaign_id AND influencer_id = p_influencer_id;
  
  IF FOUND THEN
    RAISE EXCEPTION 'Already applied for this campaign';
  END IF;

  -- 4. Get Merchant Info (for notification/display if needed)
  SELECT * INTO v_merchant FROM profiles_xhs WHERE id = v_campaign.merchant_id;

  -- 5. Insert Participant (Pending Status, No Promo Code yet)
  INSERT INTO campaign_participants (campaign_id, influencer_id, status, promo_code)
  VALUES (p_campaign_id, p_influencer_id, 'pending', NULL);

  -- 6. Return Data
  RETURN jsonb_build_object(
    'merchant_name', v_merchant.nickname,
    'campaign_title', v_campaign.title,
    'status', 'pending'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- 3. New RPC: Approve Participant
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
  v_collab_count INTEGER;
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

  -- 3. Check Quota again (Concurrency check)
  IF v_campaign.quota > 0 AND v_campaign.quota_used >= v_campaign.quota THEN
    RAISE EXCEPTION 'Quota full';
  END IF;

  -- 4. Get Influencer Info
  SELECT * INTO v_influencer FROM profiles_xhs WHERE id = v_participant.influencer_id;

  -- 5. Generate Promo Code (Logic from old grab_campaign)
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
    'promo_code', v_promo_code
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- 4. New RPC: Reject Participant
CREATE OR REPLACE FUNCTION reject_participant(
  p_participant_id UUID,
  p_merchant_id UUID,
  p_access_code TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_participant RECORD;
  v_campaign RECORD;
BEGIN
  -- 1. Verify Merchant
  PERFORM 1 FROM profiles_xhs 
  WHERE id = p_merchant_id AND access_code = p_access_code AND role = 'merchant';
  
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid merchant credentials'; END IF;

  -- 2. Get Participant & Campaign
  SELECT * INTO v_participant FROM campaign_participants WHERE id = p_participant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Participant not found'; END IF;
  
  SELECT * INTO v_campaign FROM campaigns WHERE id = v_participant.campaign_id;
  IF v_campaign.merchant_id <> p_merchant_id THEN RAISE EXCEPTION 'Permission denied'; END IF;

  -- 3. Update Status
  UPDATE campaign_participants 
  SET status = 'rejected'
  WHERE id = p_participant_id;

  -- Note: If it was approved before, we might want to decrement quota? 
  -- Assuming simple flow: Pending -> Approved/Rejected. 
  -- If we allow rejecting Approved, we should decrement quota.
  IF v_participant.status = 'approved' THEN
    UPDATE campaigns SET quota_used = quota_used - 1 WHERE id = v_campaign.id;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
