-- 00012_production_voting_lipila.sql
-- Make votes.user_id nullable so server can create anonymous votes
ALTER TABLE votes ALTER COLUMN user_id DROP NOT NULL;

-- Ensure payments has idempotency and Lipila tracking fields
ALTER TABLE payments ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS lipila_transaction_id TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS metadata JSONB;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

-- Unique indexes to enforce idempotency and prevent duplicate Lipila trans
CREATE UNIQUE INDEX IF NOT EXISTS ix_payments_lipila_transaction_id ON payments (lipila_transaction_id);
CREATE UNIQUE INDEX IF NOT EXISTS ix_payments_idempotency_key ON payments (idempotency_key) WHERE idempotency_key IS NOT NULL;

-- Prevent duplicate vote rows for same payment (one vote record per payment)
CREATE UNIQUE INDEX IF NOT EXISTS uq_votes_payment_id ON votes (payment_id) WHERE payment_id IS NOT NULL;
