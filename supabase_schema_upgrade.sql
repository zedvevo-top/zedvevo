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

-- ============================================
-- AUTOMATIC UPLOAD_ACCESS ENTITLEMENT TRIGGER
-- ============================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS upload_access TEXT DEFAULT 'inactive';
ALTER TABLE public.user_subscriptions ADD COLUMN IF NOT EXISTS consumed BOOLEAN DEFAULT FALSE;
ALTER TABLE public.user_subscriptions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

CREATE OR REPLACE FUNCTION public.handle_upload_payment_success()
RETURNS TRIGGER AS $$
DECLARE
    v_is_upload_product BOOLEAN := FALSE;
    v_plan_type TEXT;
    v_validity_days INT := 30;
    v_uploads_allowed INT := NULL;
    v_is_one_time BOOLEAN := FALSE;
    v_plan_id UUID;
    v_expires_at TIMESTAMPTZ;
BEGIN
    -- Only act when payment status transitions to 'SUCCESSFUL' or 'COMPLETED'
    IF (UPPER(NEW.status::text) IN ('SUCCESSFUL', 'COMPLETED')) AND 
       (TG_OP = 'INSERT' OR OLD.status IS NULL OR UPPER(OLD.status::text) NOT IN ('SUCCESSFUL', 'COMPLETED')) AND
       (NEW.user_id IS NOT NULL) THEN

        -- Verify if this payment record is related to an 'upload' product/plan
        IF (NEW.payment_type IN ('upload', 'upload_plan', 'plan', 'artist_subscription', 'subscription') OR
            NEW.payment_type ILIKE '%upload%' OR
            NEW.payment_type ILIKE '%plan%' OR
            NEW.plan_id IS NOT NULL OR
            NEW.subscription_id IS NOT NULL OR
            (NEW.metadata->>'type') ILIKE '%upload%' OR
            (NEW.metadata->>'plan_type') IS NOT NULL OR
            (NEW.metadata->>'plan_id') IS NOT NULL OR
            (NEW.metadata->>'item_type') ILIKE '%upload%' OR
            (NEW.metadata->>'item_type') = 'plan' OR
            (NEW.metadata->>'description') ILIKE '%upload%') THEN

            v_is_upload_product := TRUE;
        END IF;

        IF v_is_upload_product THEN
            -- 1. AUTOMATICALLY SET USER'S 'upload_access' ENTITLEMENT TO 'active'
            UPDATE public.profiles
            SET upload_access = 'active',
                is_artist = TRUE,
                role = CASE WHEN role IN ('admin', 'super_admin') THEN role ELSE 'artist' END,
                updated_at = NOW()
            WHERE id = NEW.user_id;

            -- 2. Determine plan parameters for subscription records
            v_plan_id := NEW.plan_id;
            IF v_plan_id IS NULL AND (NEW.metadata->>'plan_id') ~ '^[0-9a-fA-F-]{36}$' THEN
                v_plan_id := (NEW.metadata->>'plan_id')::UUID;
            END IF;

            v_plan_type := COALESCE(NEW.metadata->>'plan_type', 'k10_single');
            IF v_plan_type IN ('daily', 'k10_single', 'single') THEN
                v_plan_type := 'k10_single';
                v_validity_days := 1;
                v_uploads_allowed := 1;
                v_is_one_time := TRUE;
            ELSIF v_plan_type IN ('weekly', 'k100_weekly') THEN
                v_plan_type := 'k100_weekly';
                v_validity_days := 7;
                v_uploads_allowed := NULL;
                v_is_one_time := FALSE;
            ELSIF v_plan_type IN ('annual', 'yearly', 'k300_yearly') THEN
                v_plan_type := 'k300_yearly';
                v_validity_days := 365;
                v_uploads_allowed := NULL;
                v_is_one_time := FALSE;
            END IF;

            -- If plan_id exists, look up validity_days and uploads_allowed from upload_plans
            IF v_plan_id IS NOT NULL THEN
                SELECT uploads_allowed, validity_days
                INTO v_uploads_allowed, v_validity_days
                FROM public.upload_plans
                WHERE id = v_plan_id;

                IF v_uploads_allowed = 1 THEN
                    v_is_one_time := TRUE;
                END IF;
            END IF;

            v_expires_at := NOW() + (COALESCE(v_validity_days, 30) || ' days')::INTERVAL;

            -- 3. Deactivate any prior subscriptions for this user
            UPDATE public.user_subscriptions
            SET is_active = FALSE, status = 'inactive'
            WHERE user_id = NEW.user_id;

            -- 4. Create active user_subscriptions record
            IF v_plan_id IS NOT NULL THEN
                INSERT INTO public.user_subscriptions (
                    user_id, plan_id, plan_type, uploads_used, uploads_allowed,
                    activated_at, expires_at, is_active, status, consumed, created_at
                ) VALUES (
                    NEW.user_id, v_plan_id, v_plan_type::public.plan_type, 0, v_uploads_allowed,
                    NOW(), v_expires_at, TRUE, 'active', FALSE, NOW()
                );
            ELSE
                SELECT id INTO v_plan_id FROM public.upload_plans ORDER BY price ASC LIMIT 1;
                IF v_plan_id IS NOT NULL THEN
                    INSERT INTO public.user_subscriptions (
                        user_id, plan_id, plan_type, uploads_used, uploads_allowed,
                        activated_at, expires_at, is_active, status, consumed, created_at
                    ) VALUES (
                        NEW.user_id, v_plan_id, v_plan_type::public.plan_type, 0, v_uploads_allowed,
                        NOW(), v_expires_at, TRUE, 'active', FALSE, NOW()
                    );
                END IF;
            END IF;

            -- 5. Ensure artist record exists with all registered details
            INSERT INTO public.artists (user_id, name, stage_name, bio, avatar_url, created_at, updated_at)
            SELECT 
                NEW.user_id,
                COALESCE(display_name, full_name, username, 'Artist'),
                COALESCE(display_name, full_name, username, 'Artist'),
                bio,
                avatar_url,
                NOW(),
                NOW()
            FROM public.profiles WHERE id = NEW.user_id
            ON CONFLICT (user_id) DO UPDATE
            SET stage_name = EXCLUDED.stage_name,
                name = EXCLUDED.name,
                updated_at = NOW();

        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_auto_activate_upload_access ON public.payments;
DROP TRIGGER IF EXISTS trigger_upload_payment_success ON public.payments;
CREATE TRIGGER trigger_upload_payment_success
    AFTER INSERT OR UPDATE OF status ON public.payments
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_upload_payment_success();


