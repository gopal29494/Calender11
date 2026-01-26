
-- Add is_active column to connected_accounts to support soft delete
ALTER TABLE connected_accounts 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
