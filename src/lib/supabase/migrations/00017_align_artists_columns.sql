-- Migration 00017: Align artists and sponsors columns for full compatibility
-- Adds missing columns so artists and real ads function seamlessly across all schemas

-- 1. Artists Table Extensions
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS stage_name TEXT;
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS monthly_listeners INTEGER DEFAULT 0;
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS total_followers INTEGER DEFAULT 0;
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS total_streams INTEGER DEFAULT 0;
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT true;
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT false;
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS cover_image_url TEXT;
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}'::jsonb;

-- Sync existing data
UPDATE public.artists SET stage_name = name WHERE stage_name IS NULL AND name IS NOT NULL;
UPDATE public.artists SET name = stage_name WHERE name IS NULL AND stage_name IS NOT NULL;
UPDATE public.artists SET cover_image_url = cover_url WHERE cover_image_url IS NULL AND cover_url IS NOT NULL;
UPDATE public.artists SET featured = is_featured WHERE featured IS NULL AND is_featured IS NOT NULL;

-- 2. Sponsors Table Extensions for Real Ads
ALTER TABLE public.sponsors ADD COLUMN IF NOT EXISTS banner_url TEXT;
ALTER TABLE public.sponsors ADD COLUMN IF NOT EXISTS headline TEXT;
ALTER TABLE public.sponsors ADD COLUMN IF NOT EXISTS cta_text TEXT DEFAULT 'Learn More';
ALTER TABLE public.sponsors ADD COLUMN IF NOT EXISTS cta_url TEXT;
ALTER TABLE public.sponsors ADD COLUMN IF NOT EXISTS impression_count INTEGER DEFAULT 0;
ALTER TABLE public.sponsors ADD COLUMN IF NOT EXISTS click_count INTEGER DEFAULT 0;
ALTER TABLE public.sponsors ADD COLUMN IF NOT EXISTS position TEXT DEFAULT 'all'; -- 'all', 'home', 'music', 'videos', 'awards'

-- 3. Seed initial real sponsors/ads if table is empty
INSERT INTO public.sponsors (name, headline, logo_url, banner_url, website_url, cta_text, tier, display_order, is_active, position)
SELECT 
  'MTN Mobile Money',
  'Send, Receive & Pay Anywhere with MTN MoMo — Fast, Secure & Reliable',
  'https://images.unsplash.com/photo-1556742049-0a67c5574f73?w=200',
  'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=1200&h=300&fit=crop',
  'https://www.mtn.zm/momo',
  'Use MoMo Now',
  'gold',
  1,
  true,
  'all'
WHERE NOT EXISTS (SELECT 1 FROM public.sponsors LIMIT 1);

INSERT INTO public.sponsors (name, headline, logo_url, banner_url, website_url, cta_text, tier, display_order, is_active, position)
SELECT 
  'Airtel Money Zambia',
  'Top up your airtime, pay bills and stream uninterrupted with Airtel Money',
  'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=200',
  'https://images.unsplash.com/photo-1512428559087-560fa5ceab42?w=1200&h=300&fit=crop',
  'https://www.airtel.co.zm',
  'Dial *115#',
  'gold',
  2,
  true,
  'all'
WHERE (SELECT COUNT(*) FROM public.sponsors) < 2;

INSERT INTO public.sponsors (name, headline, logo_url, banner_url, website_url, cta_text, tier, display_order, is_active, position)
SELECT 
  'ZedVevo Music Awards 2026',
  'Vote for your favorite Zambian artists & celebrate our rich musical heritage',
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=200',
  'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1200&h=300&fit=crop',
  '/awards',
  'Cast Votes',
  'silver',
  3,
  true,
  'awards'
WHERE (SELECT COUNT(*) FROM public.sponsors) < 3;
