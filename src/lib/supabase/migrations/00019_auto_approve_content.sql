-- =========================================================================
-- MIGRATION 00019: AUTOMATIC CONTENT APPROVAL TRIGGER
-- Automatically approves all uploaded content (songs and videos) immediately
-- upon upload so artists can see their work live without delay.
-- =========================================================================

-- 1. Update default values on songs and videos tables to 'approved'
ALTER TABLE public.songs ALTER COLUMN status SET DEFAULT 'approved';
ALTER TABLE public.videos ALTER COLUMN status SET DEFAULT 'approved';

-- 2. Automatically approve any existing pending uploads
UPDATE public.songs SET status = 'approved' WHERE status IS NULL OR status = 'pending';
UPDATE public.videos SET status = 'approved' WHERE status IS NULL OR status = 'pending';

-- 3. Trigger function to force new content to approved automatically
CREATE OR REPLACE FUNCTION public.auto_approve_uploaded_content()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status IS NULL OR NEW.status = 'pending' THEN
        NEW.status := 'approved';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Trigger on songs table
DROP TRIGGER IF EXISTS trigger_auto_approve_songs ON public.songs;
CREATE TRIGGER trigger_auto_approve_songs
    BEFORE INSERT ON public.songs
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_approve_uploaded_content();

-- 5. Trigger on videos table
DROP TRIGGER IF EXISTS trigger_auto_approve_videos ON public.videos;
CREATE TRIGGER trigger_auto_approve_videos
    BEFORE INSERT ON public.videos
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_approve_uploaded_content();
