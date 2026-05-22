-- Fix ambiguous column reference in get_merchant_campaigns
-- The output parameter 'id' conflicts with 'id' column in the validation query

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
  -- Use alias 'p' for profiles_xhs to avoid ambiguity with output parameter 'id'
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
