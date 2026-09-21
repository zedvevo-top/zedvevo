import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import type { Song, Video, Artist, Sponsor } from '@/types/index';
import {
  getTrendingSongs, getPopularSongs, getNewSongs,
  getTrendingVideos, getFeaturedArtists, getActiveSponsors
} from '@/lib/api';
import HeroSlider from '@/components/hero/HeroSlider';
import SectionRow from '@/components/common/SectionRow';
import MusicCard from '@/components/music/MusicCard';
import VideoCard from '@/components/video/VideoCard';
import VideoPlayer from '@/components/video/VideoPlayer';
import { usePlayer } from '@/contexts/PlayerContext';
import AdBanner from '@/components/ads/AdBanner';

export default function HomePage() {
  const [trendingSongs, setTrendingSongs] = useState<Song[]>([]);
  const [popularSongs, setPopularSongs] = useState<Song[]>([]);
  const [newSongs, setNewSongs] = useState<Song[]>([]);
  const [trendingVideos, setTrendingVideos] = useState<Video[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentVideo, setCurrentVideo] = useState<Video | null>(null);
  const { currentSong, playSong } = usePlayer();
  const playerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      getTrendingSongs(8),
      getPopularSongs(8),
      getNewSongs(8),
      getTrendingVideos(8),
      getFeaturedArtists(8),
      getActiveSponsors(),
    ]).then(([ts, ps, ns, tv, ar, sp]) => {
      setTrendingSongs(ts);
      setPopularSongs(ps);
      setNewSongs(ns);
      setTrendingVideos(tv);
      setArtists(ar);
      setSponsors(sp);
    }).catch(console.error).finally(() => setLoading(false));
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

      {/* Trending Now */}
      <SectionRow title="Trending Now" viewAllLink="/music" loading={loading} grid skeletonCount={6} skeletonClassName="aspect-square">
        {trendingSongs.map(song => (
          <MusicCard key={song.id} song={song} isPlaying={currentSong?.id === song.id} onPlay={s => playSong(s, trendingSongs)} />
        ))}
      </SectionRow>

      {/* Real Ad: Top Leaderboard Placement */}
      <div className="max-w-7xl mx-auto px-4">
        <AdBanner position="home" format="leaderboard" />
      </div>

      <div className="border-t border-border" />

      {/* New Releases */}
      <SectionRow title="New Releases" viewAllLink="/music" loading={loading} grid skeletonCount={6} skeletonClassName="aspect-square">
        {newSongs.map(song => (
          <MusicCard key={song.id} song={song} isPlaying={currentSong?.id === song.id} onPlay={s => playSong(s, newSongs)} />
        ))}
      </SectionRow>

      <div className="border-t border-border" />

      {/* Popular Music */}
      <SectionRow title="Popular Music" viewAllLink="/music" loading={loading} grid skeletonCount={6} skeletonClassName="aspect-square">
        {popularSongs.map(song => (
          <MusicCard key={song.id} song={song} isPlaying={currentSong?.id === song.id} onPlay={s => playSong(s, popularSongs)} />
        ))}
      </SectionRow>

      <div className="border-t border-border" />

      {/* Videos */}
      <SectionRow title="Trending Videos" viewAllLink="/videos" loading={loading} grid skeletonCount={4} skeletonClassName="aspect-video">
        {trendingVideos.length > 0
          ? trendingVideos.map(video => (
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
        {artists.map(artist => (
          <Link key={artist.id} to={`/artist/${artist.id}`} className="text-center group block">
            <div className="h-20 w-20 md:h-28 md:w-28 rounded-full overflow-hidden mx-auto mb-2 bg-muted border-2 border-border group-hover:border-primary group-hover:scale-105 transition-all duration-200">
              {artist.avatar_url || artist.cover_url
                ? <img src={artist.avatar_url || artist.cover_url} alt={artist.name} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-muted-foreground/40">{artist.name ? artist.name[0] : 'A'}</div>
              }
            </div>
            <p className="text-xs font-semibold truncate text-foreground group-hover:text-primary transition-colors">{artist.name}</p>
            <p className="text-[10px] text-muted-foreground">{(artist.play_count || 0).toLocaleString()} plays</p>
          </Link>
        ))}
      </SectionRow>

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
            {sponsors.length > 0 ? (
              sponsors.map(sponsor => (
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
    </div>
  );
}
