-- ============================================
-- ZEDVEVO PRODUCTION UPGRADE: FINANCIAL & REVENUE SCHEMA
-- Run this SQL in your Supabase SQL Editor to enable Wallets,
-- Withdrawals, Adsterra statistics, and Android Release (AAB) tracking.
-- ============================================

-- 1. USER WALLETS TABLE
CREATE TABLE IF NOT EXISTS user_wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
    available_balance DECIMAL(12, 2) NOT NULL DEFAULT 0.00 CHECK (available_balance >= 0),
    pending_balance DECIMAL(12, 2) NOT NULL DEFAULT 0.00 CHECK (pending_balance >= 0),
    total_earnings DECIMAL(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_earnings >= 0),
    total_withdrawn DECIMAL(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_withdrawn >= 0),
    currency TEXT NOT NULL DEFAULT 'ZMW',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for user_wallets
ALTER TABLE user_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own wallet" ON user_wallets
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all wallets" ON user_wallets
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND role IN ('admin', 'super_admin')
        )
    );

-- 2. WALLET TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS wallet_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('streaming_earnings', 'voting_earnings', 'refunds', 'withdrawals', 'admin_adjustment', 'other')),
    amount DECIMAL(12, 2) NOT NULL,
    balance_before DECIMAL(12, 2) NOT NULL,
    balance_after DECIMAL(12, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
    description TEXT,
    payment_reference TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for wallet_transactions
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions" ON wallet_transactions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all transactions" ON wallet_transactions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND role IN ('admin', 'super_admin')
        )
    );

-- 3. WITHDRAWALS TABLE
CREATE TABLE IF NOT EXISTS withdrawals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
    currency TEXT NOT NULL DEFAULT 'ZMW',
    status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'processing', 'approved', 'paid', 'failed', 'rejected', 'cancelled')),
    payment_method TEXT NOT NULL CHECK (payment_method IN ('mtn', 'airtel', 'zamtel', 'bank')),
    account_details JSONB NOT NULL DEFAULT '{}'::jsonb,
    reference_id TEXT UNIQUE NOT NULL,
    external_id TEXT,
    admin_notes TEXT,
    failure_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for withdrawals
ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own withdrawals" ON withdrawals
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own withdrawals" ON withdrawals
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all withdrawals" ON withdrawals
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND role IN ('admin', 'super_admin')
        )
    );

-- 4. GOOGLE PLAY AAB RELEASES TABLE
CREATE TABLE IF NOT EXISTS android_releases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_name TEXT NOT NULL,
    version_code INTEGER NOT NULL UNIQUE,
    release_notes TEXT,
    release_status TEXT NOT NULL DEFAULT 'draft' CHECK (release_status IN ('draft', 'uploaded', 'in_review', 'published', 'rejected')),
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for android_releases
ALTER TABLE android_releases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published releases" ON android_releases
    FOR SELECT USING (release_status = 'published');

CREATE POLICY "Admins can manage releases" ON android_releases
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND role IN ('admin', 'super_admin')
        )
    );

-- 5. ADSTERRA STATS CACHE TABLE
CREATE TABLE IF NOT EXISTS adsterra_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL UNIQUE,
    impressions BIGINT NOT NULL DEFAULT 0,
    clicks BIGINT NOT NULL DEFAULT 0,
    ctr DECIMAL(6, 4) NOT NULL DEFAULT 0.00,
    cpm DECIMAL(10, 4) NOT NULL DEFAULT 0.00,
    revenue DECIMAL(12, 4) NOT NULL DEFAULT 0.00,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for adsterra_stats
ALTER TABLE adsterra_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view adsterra stats" ON adsterra_stats
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND role IN ('admin', 'super_admin')
        )
    );

-- 6. INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_user_wallets_user_id ON user_wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_id ON wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id ON withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_android_releases_status ON android_releases(release_status);

-- ============================================
-- AUTO-PROVISION WALLET ON PROFILE CREATION
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user_wallet()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_wallets (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trigger_create_wallet_on_profile
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_wallet();

-- Backfill wallets for existing users
INSERT INTO public.user_wallets (user_id)
SELECT id FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;
