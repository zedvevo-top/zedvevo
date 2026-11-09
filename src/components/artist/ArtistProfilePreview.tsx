import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Music, Play, Pause, BadgeCheck, Music2, Share2, Eye, Award } from 'lucide-react';
import { supabase } from '@/db/supabase';
import { usePlayer } from '@/contexts/PlayerContext';
import { toast } from 'sonner';
import { 
  resolveArtistAvatar, 
  resolveArtistAvatarWithStorage, 
  ARTIST_PLACEHOLDER_CDN 
} from '@/lib/api';
import type { Artist, Song } from '@/types/index';

interface ArtistProfilePreviewProps {
  artist: Artist | null;
  open: boolean;
  onClose: () => void;
}

export default function ArtistProfilePreview({ artist, open, onClose }: ArtistProfilePreviewProps) {
  const { playSong, currentSong, playing } = usePlayer();
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(false);
  const [verifiedAvatar, setVerifiedAvatar] = useState<string>('');
  const [realPlays, setRealPlays] = useState<number>(0);

  useEffect(() => {
    if (!artist?.id || !open) return;

    async function fetchArtistSongsAndVerify() {
      setLoading(true);
      try {
        // 1. Fetch approved songs from database
        const { data: songsData, error: songsError } = await supabase
          .from('songs')
          .select('*')
          .eq('status', 'approved')
          .order('created_at', { ascending: false });

        if (songsError) throw songsError;
        if (!artist) return;

        const clean = (str: string) => (str || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
        const artistId = artist.id;
        const artistUserId = artist.user_id;
        const artistName = clean(artist.name);
        const artistStageName = clean(artist.stage_name || '');

        const matched = (songsData || []).filter((song: any) => {
          if (song.artist_id && song.artist_id === artistId) return true;
          if (song.user_id && artistUserId && song.user_id === artistUserId) return true;
          const songArtistClean = clean(song.artist_name);
          if (songArtistClean && (songArtistClean === artistName || songArtistClean === artistStageName)) return true;
          if (songArtistClean && (artistName.includes(songArtistClean) || songArtistClean.includes(artistName) || 
              artistStageName.includes(songArtistClean) || songArtistClean.includes(artistStageName))) {
            return true;
          }
          return false;
        });

        setSongs(matched);

        // 2. Calculate real, authentic play count from matching songs
        const totalPlays = matched.reduce((sum: number, s: any) => sum + (s.play_count || 0), 0);
        // Fallback to direct artist play_count if totalPlays is 0
        setRealPlays(totalPlays > 0 ? totalPlays : (artist.play_count || 0));

        // 3. Unified Image Verification Layer: validates 'avatar_url' against Supabase storage, profile, songs, and CDN fallback
        const avatarUrl = await resolveArtistAvatarWithStorage(artist, matched);
        setVerifiedAvatar(avatarUrl);

      } catch (err: any) {
        console.error('Error in ArtistProfilePreview fetch/verify:', err);
        toast.error('Failed to load artist details');
      } finally {
        setLoading(false);
      }
    }

    fetchArtistSongsAndVerify();
  }, [artist, open]);

  if (!artist) return null;

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    const shareUrl = `${window.location.origin}/artist/${artist.id}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl)
        .then(() => toast.success('Artist profile link copied to clipboard!'))
        .catch(() => toast.error('Failed to copy link'));
    } else {
      toast.success(`Artist Link: ${shareUrl}`);
    }
  };

  const handlePlaySong = (song: Song) => {
    playSong(song);
    toast.success(`Playing "${song.title}"`);
  };

  // Unified artist image resolver for every render ensuring consistent artist imagery
  const avatarSrc = resolveArtistAvatar(artist, verifiedAvatar);
  const coverSrc = artist.cover_url || artist.cover_image_url || avatarSrc;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent id="artist-profile-dialog" className="max-w-[calc(100%-2rem)] md:max-w-2xl p-0 overflow-hidden bg-background">
        {/* Banner with cover */}
        <div className="relative w-full h-44 md:h-56 bg-muted">
          <img 
            src={coverSrc} 
            alt={artist.name} 
            className="w-full h-full object-cover brightness-75"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=1000';
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-black/30" />
          
          <Button
            size="icon"
            variant="ghost"
            onClick={handleShare}
            className="absolute top-3 right-3 h-8 w-8 rounded-full bg-black/40 text-white hover:bg-black/60 border border-white/10"
            title="Share Artist Profile"
          >
            <Share2 className="h-4 w-4" />
          </Button>

          {/* Artist details over header */}
          <div className="absolute bottom-4 left-4 right-4 flex items-end gap-3 md:gap-4">
            <div className="h-16 w-16 md:h-24 md:w-24 rounded-full border-4 border-background bg-muted overflow-hidden shrink-0 shadow-lg">
              <img 
                src={avatarSrc} 
                alt={artist.name} 
                className="w-full h-full object-cover" 
                onError={(e) => {
                  (e.target as HTMLImageElement).src = ARTIST_PLACEHOLDER_CDN;
                }}
              />
            </div>
            <div className="space-y-1 text-white">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="text-lg md:text-2xl font-bold tracking-tight text-white drop-shadow-md">
                  {artist.stage_name || artist.name}
                </h2>
                <Badge className="bg-accent/90 hover:bg-accent text-accent-foreground flex items-center gap-0.5 py-0 px-1.5 text-[9px] md:text-[10px] font-semibold select-none shadow-sm">
                  <BadgeCheck className="h-3 w-3" />
                  Verified
                </Badge>
              </div>
              <p className="text-xs text-white/90 font-medium drop-shadow-sm flex items-center gap-1">
                <Music2 className="h-3 w-3 text-accent" />
                {artist.genre || 'General'} Artist
              </p>
            </div>
          </div>
        </div>

        {/* Profile Content */}
        <div className="p-4 md:p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Bio section */}
          <div className="space-y-1.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">About the Artist</h3>
            <p className="text-sm text-foreground/90 leading-relaxed bg-muted/30 p-3 rounded-lg border border-border/40 whitespace-pre-line">
              {artist.bio?.trim() || `No biography has been added for ${artist.stage_name || artist.name} yet.`}
            </p>
          </div>

          {/* Metrics Row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-center">
            <div className="bg-muted/40 rounded-lg py-2 px-1 border border-border/20">
              <p className="text-base font-bold text-foreground">{(realPlays).toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
                <Eye className="h-3 w-3 text-accent" />Total Plays
              </p>
            </div>
            <div className="bg-muted/40 rounded-lg py-2 px-1 border border-border/20">
              <p className="text-base font-bold text-foreground">{loading ? '...' : songs.length}</p>
              <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
                <Music className="h-3 w-3 text-accent" />Original Songs
              </p>
            </div>
            <div className="col-span-2 sm:col-span-1 bg-muted/40 rounded-lg py-2 px-1 border border-border/20 flex flex-col justify-center">
              <p className="text-xs font-bold text-accent flex items-center justify-center gap-1">
                <Award className="h-3.5 w-3.5 animate-pulse" />
                Original Creator
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Verified ZedVevo Signee</p>
            </div>
          </div>

          {/* Songs listing */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Music className="h-3 w-3" />
              Original Songs ({songs.length})
            </h3>

            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-lg border border-border/30">
                    <Skeleton className="h-10 w-10 rounded-md" />
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                    <Skeleton className="h-8 w-8 rounded-full" />
                  </div>
                ))}
              </div>
            ) : songs.length === 0 ? (
              <div className="text-center py-6 border-2 border-dashed border-border/40 rounded-lg bg-muted/10">
                <Music2 className="h-8 w-8 text-muted-foreground/30 mx-auto mb-1.5" />
                <p className="text-xs text-muted-foreground">No approved original songs found for this artist yet.</p>
              </div>
            ) : (
              <ScrollArea className="h-48 rounded-md border border-border/40 p-2">
                <div className="space-y-1.5">
                  {songs.map((song) => {
                    const isCurrent = currentSong?.id === song.id;
                    return (
                      <div
                        key={song.id}
                        className={`flex items-center gap-3 p-2 rounded-md hover:bg-muted/40 border border-transparent hover:border-border/30 transition-all ${
                          isCurrent ? 'bg-accent/10 border-accent/30' : ''
                        }`}
                      >
                        <div className="h-10 w-10 rounded overflow-hidden shrink-0 bg-muted border border-border/20">
                          {song.cover_url ? (
                            <img src={song.cover_url} alt={song.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Music className="h-4 w-4 text-muted-foreground/40" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <h4 className={`text-xs font-semibold truncate ${isCurrent ? 'text-accent' : 'text-foreground'}`}>
                            {song.title}
                          </h4>
                          <p className="text-[10px] text-muted-foreground truncate">{song.genre || 'General'}</p>
                        </div>

                        <Button
                          size="icon"
                          variant={isCurrent && playing ? 'default' : 'outline'}
                          onClick={() => handlePlaySong(song)}
                          className={`h-8 w-8 rounded-full shrink-0 ${
                            isCurrent && playing ? 'bg-accent text-accent-foreground hover:bg-accent/90' : ''
                          }`}
                        >
                          {isCurrent && playing ? (
                            <Pause className="h-3 w-3 fill-current" />
                          ) : (
                            <Play className="h-3 w-3 fill-current ml-0.5" />
                          )}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
