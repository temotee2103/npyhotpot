-- Add whatsapp column to profiles_xhs table
ALTER TABLE profiles_xhs ADD COLUMN whatsapp text;
-- Add comment
COMMENT ON COLUMN profiles_xhs.whatsapp IS 'WhatsApp contact number for the influencer';
