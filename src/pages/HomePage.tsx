import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import type { Song, Video, Artist, Sponsor, Award, Nominee } from '@/types/index';
import { Trophy, Vote, Award as AwardIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  getTrendingSongs, getPopularSongs, getNewSongs, getVideos,
  getTrendingVideos, getFeaturedArtists, getActiveSponsors, getActiveAwards
} from '@/lib/api';
import HeroSlider from '@/components/hero/HeroSlider';
import SectionRow from '@/components/common/SectionRow';
import MusicCard from '@/components/music/MusicCard';
import VideoCard from '@/components/video/VideoCard';
import VideoPlayer from '@/components/video/VideoPlayer';
import { usePlayer } from '@/contexts/PlayerContext';
import { useAuth } from '@/contexts/AuthContext';
import { useFollowingFeedSongs } from '@/hooks';
import AdBanner from '@/components/ads/AdBanner';
import ArtistProfilePreview from '@/components/artist/ArtistProfilePreview';

export default function HomePage() {
  const [trendingSongs, setTrendingSongs] = useState<Song[]>([]);
  const [popularSongs, setPopularSongs] = useState<Song[]>([]);
  const [newSongs, setNewSongs] = useState<Song[]>([]);
  const [trendingVideos, setTrendingVideos] = useState<Video[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [awards, setAwards] = useState<Award[]>([]);

  const [loading, setLoading] = useState(true);

  const [currentVideo, setCurrentVideo] = useState<Video | null>(null);
  const [selectedArtist, setSelectedArtist] = useState<Artist | null>(null);
  const [artistPreviewOpen, setArtistPreviewOpen] = useState(false);
  const { currentSong, playSong } = usePlayer();
  const { user } = useAuth();
  const { data: rawFollowingSongs } = useFollowingFeedSongs();
  const followingSongs = Array.isArray(rawFollowingSongs) ? rawFollowingSongs : [];
  const playerRef = useRef<HTMLDivElement>(null);

  const safeTrendingSongs = Array.isArray(trendingSongs) ? trendingSongs : [];
  const safePopularSongs = Array.isArray(popularSongs) ? popularSongs : [];
  const safeNewSongs = Array.isArray(newSongs) ? newSongs : [];
  const safeTrendingVideos = Array.isArray(trendingVideos) ? trendingVideos : [];
  const safeArtists = Array.isArray(artists) ? artists : [];
  const safeAwards = Array.isArray(awards) ? awards : [];
  const safeSponsors = Array.isArray(sponsors) ? sponsors : [];

  const fetchHomeData = () => {
    Promise.allSettled([
      getTrendingSongs(8),
      getPopularSongs(8),
      getNewSongs(8),
      getTrendingVideos(8),
      getFeaturedArtists(8),
      getActiveSponsors(),
      getActiveAwards(),
    ])
      .then(([ts, ps, ns, tv, ar, sp, aw]) => {
        const tList = (ts.status === 'fulfilled' && ts.value ? ts.value : []) as Song[];
        const pList = (ps.status === 'fulfilled' && ps.value ? ps.value : []) as Song[];
        const nList = (ns.status === 'fulfilled' && ns.value ? ns.value : []) as Song[];

        const resolvedTrending = tList.length > 0 ? tList : (pList.length > 0 ? pList : nList);
        const resolvedPopular = pList.length > 0 ? pList : (nList.length > 0 ? nList : tList);
        const resolvedNew = nList.length > 0 ? nList : (tList.length > 0 ? tList : pList);

        if (resolvedTrending.length > 0) {
          setTrendingSongs(resolvedTrending);
        }
        if (resolvedPopular.length > 0) {
          setPopularSongs(resolvedPopular);
        }
        if (resolvedNew.length > 0) {
          setNewSongs(resolvedNew);
        }

        const vList = (tv.status === 'fulfilled' && tv.value ? tv.value : []) as Video[];
        if (vList.length > 0) {
          setTrendingVideos(vList);
        } else {
          getVideos({ limit: 8 }).then((allVids) => {
            if (allVids.length > 0) {
              setTrendingVideos(allVids);
            }
          }).catch(() => {});
        }

        if (ar.status === 'fulfilled' && ar.value && ar.value.length > 0) {
          setArtists(ar.value);
        }
        if (sp.status === 'fulfilled' && sp.value) {
          setSponsors(sp.value);
        }
        if (aw.status === 'fulfilled' && aw.value && aw.value.length > 0) {
          setAwards(aw.value);
        }
      })
      .catch((err) => console.warn('Home page data load warning:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchHomeData();

    const handleUpdate = () => {
      fetchHomeData();
    };
    window.addEventListener('zedvevo_content_updated', handleUpdate);
    return () => {
      window.removeEventListener('zedvevo_content_updated', handleUpdate);
    };
  }, []);

  const handleVideoPlay = (video: Video) => {
    setCurrentVideo(video);
    // Smooth-scroll to inline player
    setTimeout(() => {
      playerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  return (
    <div className="min-h-screen pb-20 lg:pb-0">
      {/* Hero */}
      <div className="pt-0">
        <HeroSlider />
      </div>

      {/* ── Inline Video Player (shows when a video is selected) ── */}
      {currentVideo && (
        <div ref={playerRef} className="border-b border-border">
          <VideoPlayer video={currentVideo} onClose={() => setCurrentVideo(null)} />
        </div>
      )}

      {/* Following Feed (Artists You Follow) */}
      {user && followingSongs.length > 0 && (
        <>
          <SectionRow title="Following Feed" subtitle="Latest songs from artists you follow" viewAllLink="/artists" grid skeletonCount={6} skeletonClassName="aspect-square">
            {followingSongs.map(song => (
              <MusicCard key={song.id} song={song} isPlaying={currentSong?.id === song.id} onPlay={s => playSong(s, followingSongs)} />
            ))}
          </SectionRow>
          <div className="border-t border-border" />
        </>
      )}

      {/* Trending Now */}
      <SectionRow title="Trending Now" viewAllLink="/music" loading={loading} grid skeletonCount={6} skeletonClassName="aspect-square">
        {safeTrendingSongs.map(song => (
          <MusicCard key={song.id} song={song} isPlaying={currentSong?.id === song.id} onPlay={s => playSong(s, safeTrendingSongs)} />
        ))}
      </SectionRow>

      {/* Real Ad: Top Leaderboard Placement */}
      <div className="max-w-7xl mx-auto px-4">
        <AdBanner position="home" format="leaderboard" />
      </div>

      <div className="border-t border-border" />

      {/* New Releases */}
      <SectionRow title="New Releases" viewAllLink="/music" loading={loading} grid skeletonCount={6} skeletonClassName="aspect-square">
        {safeNewSongs.map(song => (
          <MusicCard key={song.id} song={song} isPlaying={currentSong?.id === song.id} onPlay={s => playSong(s, safeNewSongs)} />
        ))}
      </SectionRow>

      <div className="border-t border-border" />

      {/* Popular Music */}
      <SectionRow title="Popular Music" viewAllLink="/music" loading={loading} grid skeletonCount={6} skeletonClassName="aspect-square">
        {safePopularSongs.map(song => (
          <MusicCard key={song.id} song={song} isPlaying={currentSong?.id === song.id} onPlay={s => playSong(s, safePopularSongs)} />
        ))}
      </SectionRow>

      <div className="border-t border-border" />

      {/* Videos */}
      <SectionRow title="Trending Videos" viewAllLink="/videos" loading={loading} grid skeletonCount={4} skeletonClassName="aspect-video">
        {safeTrendingVideos.length > 0
          ? safeTrendingVideos.map(video => (
              <VideoCard
                key={video.id}
                video={video}
                active={currentVideo?.id === video.id}
                onPlay={handleVideoPlay}
              />
            ))
          : !loading && (
              <div className="col-span-full text-center py-10 text-muted-foreground">
                <p className="text-sm">No videos yet — be the first to upload!</p>
                <Link to="/upload" className="text-xs text-accent hover:underline mt-1 inline-block">Upload Video →</Link>
              </div>
            )
        }
      </SectionRow>

      {/* Real Ad: Mid-page Feed Placement */}
      <div className="max-w-7xl mx-auto px-4">
        <AdBanner position="home" format="feed" />
      </div>

      <div className="border-t border-border" />

      {/* Featured Artists — ordered by newest */}
      <SectionRow title="New Artists" viewAllLink="/artists" loading={loading} grid skeletonCount={6} skeletonClassName="aspect-square">
        {safeArtists.map(artist => (
          <button
            key={artist.id}
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setSelectedArtist(artist);
              setArtistPreviewOpen(true);
            }}
            className="text-center group block w-full focus:outline-none cursor-pointer"
          >
            <div className="h-20 w-20 md:h-28 md:w-28 rounded-full overflow-hidden mx-auto mb-2 bg-muted border-2 border-border group-hover:border-primary group-hover:scale-105 transition-all duration-200">
              <img
                src={artist.avatar_url || artist.cover_image_url || artist.cover_url || '/app-icon.png'}
                alt={artist.stage_name || artist.name || 'Artist'}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = '/app-icon.png';
                }}
              />
            </div>
            <p className="text-xs font-semibold truncate text-foreground group-hover:text-primary transition-colors">{artist.stage_name || artist.name || 'Artist'}</p>
            <p className="text-[10px] text-muted-foreground">{(artist.play_count || 0).toLocaleString()} plays</p>
          </button>
        ))}
      </SectionRow>

      {/* Official Awards & Nominees Spotlight */}
      {safeAwards.flatMap(a => (a.award_categories || []).flatMap(c => c.nominees || [])).length > 0 && (
        <>
          <div className="border-t border-border" />
          <section className="py-8 bg-card/40">
            <div className="max-w-7xl mx-auto px-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-accent" />
                  <h2 className="text-sm md:text-base font-bold tracking-tight text-foreground">
                    ZedVevo Music Awards 2026 Nominees
                  </h2>
                </div>
                <Link to="/awards" className="text-xs text-accent hover:underline font-semibold flex items-center gap-1">
                  View All Categories & Vote →
                </Link>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {safeAwards.flatMap(a => (a.award_categories || []).flatMap(c => c.nominees || [])).slice(0, 6).map(nom => (
                  <Link
                    key={nom.id}
                    to="/awards"
                    className="group bg-card border border-border/80 hover:border-accent/80 rounded-xl overflow-hidden transition-all duration-200 flex flex-col hover:shadow-lg"
                  >
                    <div className="aspect-square bg-muted relative overflow-hidden">
                      <img
                        src={nom.photo_url || '/app-icon.png'}
                        alt={nom.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = '/app-icon.png';
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                      <div className="absolute bottom-2 left-2 right-2 text-white">
                        <p className="font-bold text-xs truncate">{nom.name}</p>
                        {nom.song_title && <p className="text-[10px] text-white/70 truncate">{nom.song_title}</p>}
                      </div>
                    </div>
                    <div className="p-2.5 flex items-center justify-between bg-card text-xs">
                      <div>
                        <p className="font-bold text-foreground text-xs">{(nom.total_votes || 0).toLocaleString()}</p>
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Votes</p>
                      </div>
                      <Button size="sm" className="h-6 px-2.5 text-[10px] bg-accent text-accent-foreground hover:bg-accent/90">
                        Vote
                      </Button>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        </>
      )}

      {/* Sponsors & Official Partners */}
      <div className="border-t border-border" />
      <section className="py-8 bg-muted/20">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs md:text-sm font-semibold text-muted-foreground uppercase tracking-widest">
              Official Partners & Award Sponsors
            </h2>
            <Link to="/awards" className="text-xs text-primary hover:underline font-medium">
              View Awards & Sponsors →
            </Link>
          </div>
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-6">
            {safeSponsors.length > 0 ? (
              safeSponsors.map(sponsor => (
                <a
                  key={sponsor.id}
                  href={sponsor.website_url || '#'}
                  target={sponsor.website_url?.startsWith('http') ? '_blank' : '_self'}
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-2 rounded-lg bg-card/60 border border-border/40 hover:border-primary/40 transition-all opacity-80 hover:opacity-100 shadow-sm"
                >
                  {sponsor.logo_url ? (
                    <img src={sponsor.logo_url} alt={sponsor.name} className="h-7 max-w-[120px] object-contain" />
                  ) : null}
                  <span className="text-xs font-medium text-foreground">{sponsor.name}</span>
                </a>
              ))
            ) : (
              <div className="w-full">
                <AdBanner position="home" format="compact" />
              </div>
            )}
          </div>
        </div>
      </section>

      <ArtistProfilePreview
        artist={selectedArtist}
        open={artistPreviewOpen}
        onClose={() => setArtistPreviewOpen(false)}
      />
    </div>
  );
}
