-- Add plan tracking columns to invites table
ALTER TABLE invites ADD COLUMN IF NOT EXISTS plan_type TEXT NOT NULL DEFAULT 'trial';
ALTER TABLE invites ADD COLUMN IF NOT EXISTS plan_start_at TIMESTAMPTZ;
ALTER TABLE invites ADD COLUMN IF NOT EXISTS plan_end_at TIMESTAMPTZ;
