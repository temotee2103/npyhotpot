-- Migration: 0012_review_stats.sql

-- 1. Add rating stats to profiles
ALTER TABLE profiles_xhs 
ADD COLUMN IF NOT EXISTS avg_rating NUMERIC(3,1) DEFAULT 0,
ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;
-- 2. Function to update stats automatically
CREATE OR REPLACE FUNCTION update_profile_rating()
RETURNS TRIGGER AS $$
DECLARE
  target_id UUID;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    target_id := OLD.reviewee_id;
  ELSE
    target_id := NEW.reviewee_id;
  END IF;

  UPDATE profiles_xhs
  SET 
    avg_rating = (SELECT COALESCE(ROUND(AVG(rating), 1), 0) FROM reviews WHERE reviewee_id = target_id),
    review_count = (SELECT COUNT(*) FROM reviews WHERE reviewee_id = target_id)
  WHERE id = target_id;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- 3. Create Trigger
DROP TRIGGER IF EXISTS on_review_change ON reviews;
CREATE TRIGGER on_review_change
AFTER INSERT OR UPDATE OR DELETE ON reviews
FOR EACH ROW EXECUTE FUNCTION update_profile_rating();
-- 4. Update get_campaign_participants to include rating
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
  submission_url text,
  submission_time timestamptz,
  influencer_id uuid,
  influencer_nickname text,
  influencer_xhs_id text,
  influencer_avatar_url text,
  influencer_whatsapp text,
  influencer_tags text[],
  influencer_rating numeric, -- Added
  influencer_review_count integer -- Added
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
    cp.submission_url,
    cp.submission_time,
    p.id as influencer_id,
    p.nickname as influencer_nickname,
    p.xhs_id as influencer_xhs_id,
    p.avatar_url as influencer_avatar_url,
    p.whatsapp as influencer_whatsapp,
    p.niche_tags as influencer_tags,
    p.avg_rating as influencer_rating, -- Added
    p.review_count as influencer_review_count -- Added
  FROM campaign_participants cp
  JOIN profiles_xhs p ON cp.influencer_id = p.id
  WHERE cp.campaign_id = p_campaign_id
  ORDER BY cp.created_at DESC;
END;
$$;
