-- Migration: 0014_influencer_portfolio.sql

-- RPC: Get Influencer Portfolio (Past Verified Campaigns)
CREATE OR REPLACE FUNCTION get_influencer_portfolio(
  p_influencer_id UUID
)
RETURNS TABLE (
  campaign_id UUID,
  campaign_title TEXT,
  submission_url TEXT,
  submission_time TIMESTAMPTZ,
  rating INTEGER,
  review_content TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cp.campaign_id,
    c.title as campaign_title,
    cp.submission_url,
    cp.submission_time,
    r.rating,
    r.content as review_content
  FROM campaign_participants cp
  JOIN campaigns c ON cp.campaign_id = c.id
  LEFT JOIN reviews r ON r.campaign_id = cp.campaign_id AND r.reviewee_id = cp.influencer_id
  WHERE 
    cp.influencer_id = p_influencer_id 
    AND cp.status = 'verified' -- Only show verified (completed) work
    AND cp.submission_url IS NOT NULL
  ORDER BY cp.submission_time DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Grant access to public (anyone can view portfolio)
GRANT EXECUTE ON FUNCTION get_influencer_portfolio(UUID) TO anon, authenticated, service_role;
