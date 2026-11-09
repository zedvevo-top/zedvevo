-- ============================================
-- AWARDS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS awards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    year INTEGER NOT NULL,
    season_label TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    voting_open BOOLEAN DEFAULT FALSE,
    voting_starts_at TIMESTAMPTZ,
    voting_ends_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- AWARD CATEGORIES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS award_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    award_id UUID NOT NULL REFERENCES awards(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    grand_prize TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- NOMINEES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS nominees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES award_categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    bio TEXT,
    photo_url TEXT,
    song_title TEXT,
    song_url TEXT,
    video_url TEXT,
    total_votes INTEGER DEFAULT 0,
    payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
    registration_status TEXT DEFAULT 'pending' CHECK (registration_status IN ('pending', 'completed', 'failed')),
    nomination_status TEXT DEFAULT 'pending_payment' CHECK (nomination_status IN ('pending_payment', 'pending_review', 'approved', 'rejected', 'winner')),
    is_winner BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- VOTES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS votes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    nominee_id UUID NOT NULL REFERENCES nominees(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES award_categories(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    vote_count INTEGER DEFAULT 1,
    payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
    payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'successful', 'failed', 'cancelled', 'insufficient_funds', 'invalid_transaction')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_award_categories_award_id ON award_categories(award_id);
CREATE INDEX IF NOT EXISTS idx_nominees_category_id ON nominees(category_id);
CREATE INDEX IF NOT EXISTS idx_nominees_user_id ON nominees(user_id);
CREATE INDEX IF NOT EXISTS idx_nominees_payment_id ON nominees(payment_id);
CREATE INDEX IF NOT EXISTS idx_votes_nominee_id ON votes(nominee_id);
CREATE INDEX IF NOT EXISTS idx_votes_user_id ON votes(user_id);
CREATE INDEX IF NOT EXISTS idx_votes_category_id ON votes(category_id);
CREATE INDEX IF NOT EXISTS idx_votes_payment_id ON votes(payment_id);

-- ============================================
-- POLICIES (RLS)
-- ============================================

-- Awards - everyone can read
CREATE POLICY "Awards are readable by everyone" ON awards
    FOR SELECT USING (true);

-- Award Categories - everyone can read
CREATE POLICY "Award categories are readable by everyone" ON award_categories
    FOR SELECT USING (true);

-- Nominees - everyone can read approved nominees
CREATE POLICY "Read approved nominees" ON nominees
    FOR SELECT USING (nomination_status = 'approved' OR nomination_status = 'winner');

-- Nominees - users can insert their own
CREATE POLICY "Users can create their own nominations" ON nominees
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Nominees - users can read their own
CREATE POLICY "Users can read their own nominations" ON nominees
    FOR SELECT USING (auth.uid() = user_id);

-- Nominees - admins can read all
CREATE POLICY "Admins can read all nominees" ON nominees
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND role IN ('admin', 'super_admin'))
    );

-- Votes - users can create votes
CREATE POLICY "Users can create votes" ON votes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Votes - users can read their own votes
CREATE POLICY "Users can read their own votes" ON votes
    FOR SELECT USING (auth.uid() = user_id);

-- Votes - anyone can read aggregate vote counts (for nominees)
CREATE POLICY "Vote counts are readable" ON votes
    FOR SELECT USING (true);

-- ============================================
-- TRIGGERS
-- ============================================

-- Update nominees total_votes when a vote is created
CREATE OR REPLACE FUNCTION update_nominee_vote_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE nominees
    SET total_votes = (SELECT COUNT(*) FROM votes WHERE nominee_id = NEW.nominee_id)
    WHERE id = NEW.nominee_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_nominee_votes
AFTER INSERT ON votes
FOR EACH ROW
EXECUTE FUNCTION update_nominee_vote_count();
