import { useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Loader2, Play, Trophy, Share2, Eye, Heart, Music, Video as VideoIcon } from 'lucide-react';
import { supabase } from '@/db/supabase';
import { usePlayer } from '@/contexts/PlayerContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import VideoPlayer from '@/components/video/VideoPlayer';
import VoteDialog from '@/components/awards/VoteDialog';
import ShareSheet from '@/components/common/ShareSheet';
import ZedVevoWatermark from '@/components/common/ZedVevoWatermark';
import type { Song, Video, Nominee } from '@/types/index';

export default function SharedItemPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { playSong } = usePlayer();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<any>(null);
  const [categoryName, setCategoryName] = useState<string>('');

  // Nominee voting dialog
  const [voteDialogOpen, setVoteDialogOpen] = useState(false);
  const [shareSheetOpen, setShareSheetOpen] = useState(false);

  // Video playing state
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);

  const type: 'song' | 'video' | 'nominee' | '' = location.pathname.startsWith('/song')
    ? 'song'
    : (location.pathname.startsWith('/video') || location.pathname.startsWith('/watch'))
    ? 'video'
    : location.pathname.startsWith('/nominee')
    ? 'nominee'
    : '';

  useEffect(() => {
    if (!id || !type) {
      setError('Invalid link');
      setLoading(false);
      return;
    }

    async function fetchItem() {
      try {
        let table = '';
        if (type === 'song') table = 'songs';
        if (type === 'video') table = 'videos';
        if (type === 'nominee') table = 'nominees';

        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        let query = supabase.from(table).select('*');
        if (isUuid) {
          query = query.eq('id', id);
        } else {
          query = query.eq('slug', id);
        }
        const { data: item, error: fetchErr } = await query.maybeSingle();

        if (fetchErr) throw fetchErr;
        if (!item) throw new Error(`${type} not found`);

        setData(item);

        if (type === 'song') {
          // Automatically play the shared song in the global player
          setTimeout(() => {
            playSong(item as Song, [item as Song]);
          }, 100);
        } else if (type === 'video') {
          // Automatically mount/open the video player modal
          setIsPlayingVideo(true);
        }

        if (type === 'nominee' && item.category_id) {
          const { data: cat } = await supabase
            .from('award_categories')
            .select('name')
            .eq('id', item.category_id)
            .maybeSingle();
          if (cat) setCategoryName(cat.name);
        }
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Failed to load item');
      } finally {
        setLoading(false);
      }
    }

    fetchItem();
  }, [id, type]);

  useEffect(() => {
    if (!data) return;
    let t = 'ZedVevo';
    let d = 'Stream music, watch videos, and vote on ZedVevo';
    let img = `${typeof window !== 'undefined' ? window.location.origin : ''}/og-image.png`;

    if (type === 'song') {
      const artist = data.artist_name || data.artist || 'ZedVevo Artist';
      t = `${data.title} by ${artist} — ZedVevo`;
      d = `Stream and download "${data.title}" by ${artist} on ZedVevo.`;
      const raw = data.cover_url || '';
      img = raw.startsWith('http://') || raw.startsWith('https://') ? raw : (raw ? `${window.location.origin}${raw.startsWith('/') ? '' : '/'}${raw}` : img);
    } else if (type === 'video') {
      const artist = data.artist_name || 'ZedVevo';
      t = `${data.title} - ${artist} (Official Video) | ZedVevo`;
      d = data.description || `Watch "${data.title}" by ${artist} on ZedVevo.`;
      const raw = data.thumbnail_url || '';
      img = raw.startsWith('http://') || raw.startsWith('https://') ? raw : (raw ? `${window.location.origin}${raw.startsWith('/') ? '' : '/'}${raw}` : img);
    }

    document.title = t;
    const setMeta = (selector: string, attrName: string, attrVal: string, content: string) => {
      let el = document.querySelector(selector) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attrName, attrVal);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    setMeta('meta[property="og:title"]', 'property', 'og:title', t);
    setMeta('meta[property="og:description"]', 'property', 'og:description', d);
    setMeta('meta[property="og:image"]', 'property', 'og:image', img);
    setMeta('meta[property="og:image:secure_url"]', 'property', 'og:image:secure_url', img);
    setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', t);
    setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', d);
    setMeta('meta[name="twitter:image"]', 'name', 'twitter:image', img);
  }, [data, type]);
  useEffect(() => {
    if (type !== 'nominee' || !id) return;

    const channel = supabase
      .channel(`realtime_shared_nominee_${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'nominees', filter: `id=eq.${id}` },
        (payload) => {
          setData((prev: any) => ({ ...prev, ...(payload.new as Nominee) }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, type]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4 text-center px-4">
        <h2 className="text-2xl font-bold text-destructive">Item Not Found</h2>
        <p className="text-muted-foreground">{error || 'This content may have been moved or removed.'}</p>
        <Button onClick={() => navigate('/')}>Return to Homepage</Button>
      </div>
    );
  }

  // Set meta tags based on item
  let title = 'ZedVevo';
  let description = 'Stream music, watch videos, and vote on ZedVevo';
  let imageUrl = '';
  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  if (type === 'song') {
    const artist = data.artist_name || data.artist || 'ZedVevo Artist';
    title = `${data.title} - ${artist} | ZedVevo`;
    description = `Stream and download "${data.title}" by ${artist} on ZedVevo.`;
    const raw = data.cover_url || '';
    imageUrl = raw.startsWith('http://') || raw.startsWith('https://') ? raw : (raw ? `${origin}${raw.startsWith('/') ? '' : '/'}${raw}` : `${origin}/og-image.png`);
  } else if (type === 'video') {
    const artist = data.artist_name || 'ZedVevo';
    title = `${data.title} - ${artist} (Official Video) | ZedVevo`;
    description = data.description || `Watch "${data.title}" by ${artist} on ZedVevo.`;
    const raw = data.thumbnail_url || '';
    imageUrl = raw.startsWith('http://') || raw.startsWith('https://') ? raw : (raw ? `${origin}${raw.startsWith('/') ? '' : '/'}${raw}` : `${origin}/og-image.png`);
  } else if (type === 'nominee') {
    title = `Vote for ${data.name} | ZedVevo Awards`;
    description = data.song_title
      ? `Vote for ${data.name} nominated for "${data.song_title}". Every vote counts!`
      : `Vote for ${data.name} in the ZedVevo Awards. Every vote counts!`;
    const raw = data.photo_url || data.avatar_url || '';
    imageUrl = raw.startsWith('http://') || raw.startsWith('https://') ? raw : (raw ? `${origin}${raw.startsWith('/') ? '' : '/'}${raw}` : `${origin}/og-image.png`);
  }

  return (
    <div className="container max-w-4xl mx-auto py-10 px-4">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta property="og:site_name" content="ZedVevo" />
        <meta property="og:type" content={type === 'song' ? 'music.song' : type === 'video' ? 'video.other' : 'website'} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:image" content={imageUrl} />
        <meta property="og:image:secure_url" content={imageUrl} />
        <meta property="og:url" content={currentUrl} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@ZedVevo" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={imageUrl} />
        <script type="application/ld+json">
          {JSON.stringify(
            type === 'song'
              ? {
                  "@context": "https://schema.org",
                  "@type": "MusicRecording",
                  "name": data.title,
                  "description": description,
                  "image": imageUrl,
                  "url": currentUrl,
                  "genre": categoryName || "Zambian Music",
                  "duration": data.duration ? `PT${Math.floor(data.duration / 60)}M${data.duration % 60}S` : undefined,
                  "byArtist": {
                    "@type": "MusicGroup",
                    "name": data.artist_name || data.artist || "ZedVevo Artist"
                  }
                }
              : type === 'video'
              ? {
                  "@context": "https://schema.org",
                  "@type": "VideoObject",
                  "name": data.title,
                  "description": description,
                  "thumbnailUrl": [imageUrl],
                  "uploadDate": data.created_at || new Date().toISOString(),
                  "contentUrl": data.video_url || currentUrl,
                  "embedUrl": currentUrl,
                  "duration": data.duration ? `PT${Math.floor(data.duration / 60)}M${data.duration % 60}S` : undefined
                }
              : {
                  "@context": "https://schema.org",
                  "@type": "Person",
                  "name": data.name,
                  "description": description,
                  "image": imageUrl,
                  "url": currentUrl,
                  "award": categoryName || "ZedVevo Music Award"
                }
          )}
        </script>
      </Helmet>

      {/* Video Player Modal if video type is playing */}
      {type === 'video' && isPlayingVideo && (
        <div className="mb-6">
          <VideoPlayer video={data as Video} onClose={() => setIsPlayingVideo(false)} />
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="flex flex-col md:flex-row gap-6 p-6 sm:p-8 items-start">
          {/* Main Content Thumbnail */}
          <div className="w-full md:w-64 aspect-square rounded-xl overflow-hidden bg-muted shrink-0 border border-border relative">
            <ZedVevoWatermark size="sm" />
            {imageUrl ? (
              <img src={imageUrl} alt={title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-5xl font-bold text-muted-foreground/30">
                {(data.title || data.name || 'Z')[0]}
              </div>
            )}
            {type === 'nominee' && data.is_winner && (
              <div className="absolute top-2 right-2">
                <Badge className="bg-accent text-accent-foreground border-none">Award Winner</Badge>
              </div>
            )}
          </div>

          {/* Details & Direct Actions */}
          <div className="flex-1 min-w-0 space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="uppercase tracking-wider text-[11px] font-semibold">
                {type === 'nominee' ? 'Award Nominee' : type}
              </Badge>
              {categoryName && (
                <Badge variant="secondary" className="text-xs">
                  {categoryName}
                </Badge>
              )}
            </div>

            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                {type === 'nominee' ? data.name : data.title}
              </h1>
              <p className="text-base text-muted-foreground mt-1">
                {type === 'song' && (data.artist_name || data.artist)}
                {type === 'video' && (data.artist_name || 'Official Music Video')}
                {type === 'nominee' && (data.song_title ? `Nominated for "${data.song_title}"` : 'Official Nominee')}
              </p>
            </div>

            {/* Metrics */}
            <div className="flex items-center gap-4 py-2 border-y border-border/60 text-xs text-muted-foreground">
              {type === 'song' && (
                <>
                  <span>{(data.play_count || 0).toLocaleString()} Plays</span>
                  <span>{(data.download_count || 0).toLocaleString()} Downloads</span>
                  <span>{(data.like_count || 0).toLocaleString()} Likes</span>
                </>
              )}
              {type === 'video' && (
                <>
                  <span className="flex items-center gap-1">
                    <Eye className="h-3.5 w-3.5" /> {(data.view_count || 0).toLocaleString()} Views
                  </span>
                  <span className="flex items-center gap-1">
                    <Heart className="h-3.5 w-3.5" /> {(data.like_count || 0).toLocaleString()} Likes
                  </span>
                </>
              )}
              {type === 'nominee' && (
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-accent" />
                  <span className="font-bold text-foreground text-sm">
                    {(data.total_votes || 0).toLocaleString()}
                  </span>
                  <span>Confirmed Votes (Updates Live)</span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex flex-wrap gap-3 items-center">
              {type === 'song' && (
                <Button
                  onClick={() => playSong(data as Song, [data as Song])}
                  size="default"
                  className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2 font-semibold"
                >
                  <Play className="h-4 w-4 fill-current" /> Play Song
                </Button>
              )}

              {type === 'video' && (
                <Button
                  onClick={() => setIsPlayingVideo(true)}
                  size="default"
                  className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2 font-semibold"
                >
                  <Play className="h-4 w-4 fill-current" /> Watch Video
                </Button>
              )}

              {type === 'nominee' && (
                <Button
                  onClick={() => setVoteDialogOpen(true)}
                  size="default"
                  className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2 font-bold px-6"
                >
                  <Trophy className="h-4 w-4" /> Vote for {data.name} (K5/vote)
                </Button>
              )}

              <Button
                variant="outline"
                size="default"
                className="gap-2"
                onClick={() => setShareSheetOpen(true)}
              >
                <Share2 className="h-4 w-4" /> Share Link
              </Button>

              <Button variant="ghost" size="default" onClick={() => navigate(type === 'nominee' ? '/awards' : '/')}>
                {type === 'nominee' ? 'View All Awards' : 'Discover More'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Nominee Vote Dialog with real-time polling */}
      {type === 'nominee' && (
        <VoteDialog
          open={voteDialogOpen}
          onOpenChange={setVoteDialogOpen}
          nominee={data as Nominee}
          pricePerVote={5}
          onVoteSuccess={() => {
            // Updated automatically via realtime
          }}
        />
      )}

      {/* Share Sheet */}
      <ShareSheet
        open={shareSheetOpen}
        onClose={() => setShareSheetOpen(false)}
        url={currentUrl}
        title={title}
        thumbnailUrl={imageUrl}
        embedId={data.id}
        embedType={type === 'video' ? 'video' : 'song'}
      />
    </div>
  );
}
