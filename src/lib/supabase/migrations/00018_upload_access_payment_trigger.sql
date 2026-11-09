-- =========================================================================
-- MIGRATION 00018: AUTOMATIC UPLOAD_ACCESS ENTITLEMENT TRIGGER
-- Monitors the 'payments' table. When a payment related to an 'upload' product
-- transitions to 'SUCCESSFUL' (or 'COMPLETED'), automatically updates the
-- corresponding user's 'upload_access' entitlement to 'active'.
-- =========================================================================

-- 1. Ensure upload_access column exists on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS upload_access TEXT DEFAULT 'inactive';

-- 2. Ensure consumed and status columns exist on user_subscriptions
ALTER TABLE public.user_subscriptions ADD COLUMN IF NOT EXISTS consumed BOOLEAN DEFAULT FALSE;
ALTER TABLE public.user_subscriptions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- 3. Trigger function to handle payment status transition to SUCCESSFUL for upload products
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
                -- If plan_id was not explicitly specified, find default plan
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

-- 4. Attach trigger to payments table
DROP TRIGGER IF EXISTS trigger_upload_payment_success ON public.payments;
CREATE TRIGGER trigger_upload_payment_success
    AFTER INSERT OR UPDATE OF status ON public.payments
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_upload_payment_success();
