import BackToHome from '@/components/common/BackToHome';
import { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp, Music2, Video as VideoIcon, Heart, Download, Play, Eye,
  Loader2, RefreshCw, Trophy, Users, Search, Share2, Flame, Award, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  getWeeklyTrending, computeAndStoreWeeklyTrending,
  getTrendingSongs, getTrendingVideos, getAllNominees,
  getFeaturedArtists, getSongById, getVideoById, getSettings
} from '@/lib/api';
import type { WeeklyTrending, Song, Video, Nominee, Artist } from '@/types/index';
import { useAuth } from '@/contexts/AuthContext';
import { usePlayer } from '@/contexts/PlayerContext';
import { supabase } from '@/db/supabase';
import VideoPlayer from '@/components/video/VideoPlayer';
import VoteDialog from '@/components/awards/VoteDialog';
import ShareSheet from '@/components/common/ShareSheet';

const WEEKLY_CATEGORIES = [
  { value: 'most_played', label: 'Most Played', icon: Play, color: 'text-accent' },
  { value: 'most_downloaded', label: 'Most Downloaded', icon: Download, color: 'text-emerald-500' },
  { value: 'most_viewed', label: 'Most Viewed', icon: Eye, color: 'text-blue-500' },
  { value: 'most_liked', label: 'Most Liked', icon: Heart, color: 'text-rose-500' },
];

export default function TrendingPage() {
  const { profile } = useAuth();
  const { currentSong, playSong } = usePlayer();

  const [activeTab, setActiveTab] = useState('all');
  const [weeklyTab, setWeeklyTab] = useState('most_played');
  const [searchQuery, setSearchQuery] = useState('');

  // Data states
  const [trendingSongs, setTrendingSongs] = useState<Song[]>([]);
  const [trendingVideos, setTrendingVideos] = useState<Video[]>([]);
  const [nominees, setNominees] = useState<Nominee[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [weeklyData, setWeeklyData] = useState<Record<string, WeeklyTrending[]>>({});
  const [settings, setSettings] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Active Video Player Modal
  const [currentVideo, setCurrentVideo] = useState<Video | null>(null);

  // Vote Dialog
  const [voteDialogOpen, setVoteDialogOpen] = useState(false);
  const [selectedNominee, setSelectedNominee] = useState<Nominee | null>(null);

  // Share Sheet
  const [shareData, setShareData] = useState<{
    open: boolean;
    url: string;
    title: string;
    thumbnailUrl?: string;
  }>({
    open: false,
    url: '',
    title: '',
  });

  const loadAllTrendingData = async () => {
    setLoading(true);
    try {
      const [songs, vids, noms, arts, played, downloaded, viewed, liked, siteSettings] =
        await Promise.all([
          getTrendingSongs(20),
          getTrendingVideos(12),
          getAllNominees(),
          getFeaturedArtists(12),
          getWeeklyTrending('most_played'),
          getWeeklyTrending('most_downloaded'),
          getWeeklyTrending('most_viewed'),
          getWeeklyTrending('most_liked'),
          getSettings(),
        ]);

      setTrendingSongs(songs);
      setTrendingVideos(vids);
      // Sort nominees descending by votes
      const sortedNoms = [...noms].sort((a, b) => (b.total_votes || 0) - (a.total_votes || 0));
      setNominees(sortedNoms);
      setArtists(arts);
      setWeeklyData({
        most_played: played,
        most_downloaded: downloaded,
        most_viewed: viewed,
        most_liked: liked,
      });
      setSettings(siteSettings);
    } catch (err) {
      console.error('Failed to load trending data:', err);
      toast.error('Failed to load some trending content');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllTrendingData();
  }, []);

  // Realtime updates for nominees and songs
  useEffect(() => {
    const nomineeChannel = supabase
      .channel('realtime_trending_nominees')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'nominees' },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Nominee;
            setNominees((prev) => {
              const next = prev.map((n) => (n.id === updated.id ? updated : n));
              return next.sort((a, b) => (b.total_votes || 0) - (a.total_votes || 0));
            });
          }
        }
      )
      .subscribe();

    const songChannel = supabase
      .channel('realtime_trending_songs')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'songs' },
        (payload) => {
          const updated = payload.new as Song;
          setTrendingSongs((prev) =>
            prev.map((s) => (s.id === updated.id ? updated : s))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(nomineeChannel);
      supabase.removeChannel(songChannel);
    };
  }, []);

  // Admin refresh handler
  const handleRefresh = async () => {
    if (profile?.role !== 'admin') return;
    setRefreshing(true);
    try {
      await computeAndStoreWeeklyTrending();
      await loadAllTrendingData();
      toast.success('Weekly trending rankings successfully recalculated!');
    } catch {
      toast.error('Failed to refresh trending calculations');
    } finally {
      setRefreshing(false);
    }
  };

  // Content play handlers
  const handlePlaySong = (song: Song) => {
    playSong(song, trendingSongs);
  };

  const handlePlayVideo = (video: Video) => {
    setCurrentVideo(video);
  };

  const handleWeeklyPlay = async (item: WeeklyTrending) => {
    try {
      if (item.content_type === 'song') {
        const song = await getSongById(item.content_id);
        if (song) playSong(song);
      } else {
        const video = await getVideoById(item.content_id);
        if (video) setCurrentVideo(video);
      }
    } catch {
      toast.error('Could not play content');
    }
  };

  // Open Share Dialog
  const openShare = (url: string, title: string, thumbnailUrl?: string) => {
    setShareData({
      open: true,
      url,
      title,
      thumbnailUrl,
    });
  };

  // Filtered queries
  const q = searchQuery.toLowerCase().trim();

  const filteredSongs = useMemo(() => {
    if (!q) return trendingSongs;
    return trendingSongs.filter(
      (s) => s.title.toLowerCase().includes(q) || s.artist_name.toLowerCase().includes(q)
    );
  }, [trendingSongs, q]);

  const filteredVideos = useMemo(() => {
    if (!q) return trendingVideos;
    return trendingVideos.filter(
      (v) => v.title.toLowerCase().includes(q) || (v.artist_name || '').toLowerCase().includes(q)
    );
  }, [trendingVideos, q]);

  const filteredNominees = useMemo(() => {
    if (!q) return nominees;
    return nominees.filter(
      (n) => n.name.toLowerCase().includes(q) || (n.song_title || '').toLowerCase().includes(q)
    );
  }, [nominees, q]);

  const filteredArtists = useMemo(() => {
    if (!q) return artists;
    return artists.filter((a) => a.name.toLowerCase().includes(q));
  }, [artists, q]);

  // Featured #1 trending item (Top song)
  const topSong = trendingSongs[0];
  const topNominee = nominees[0];

  return (
    <div className="min-h-screen pt-20 pb-24 lg:pb-12 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <BackToHome />

        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-4 border-b border-border mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2.5 text-foreground">
              <Flame className="h-7 w-7 text-accent fill-accent/20" />
              ZedVevo Trending
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Live Zambian music charts, viral music videos, and award leaders
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search trending..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9 text-xs bg-muted/40"
              />
            </div>

            {profile?.role === 'admin' && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
                className="h-9 gap-1.5 text-xs shrink-0"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Recalculate</span> Charts
              </Button>
            )}
          </div>
        </div>

        {/* Hero Spotlight on #1 Trending */}
        {topSong && !searchQuery && (
          <div className="mb-8 rounded-2xl overflow-hidden border border-border bg-gradient-to-r from-card via-card/90 to-muted/50 p-6 sm:p-8 flex flex-col md:flex-row items-center gap-6 relative shadow-sm">
            <div className="absolute top-4 left-4 z-10">
              <Badge className="bg-accent text-accent-foreground flex items-center gap-1 font-semibold text-xs px-2.5 py-0.5">
                <Sparkles className="h-3 w-3" /> #1 Trending Song
              </Badge>
            </div>

            <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-xl overflow-hidden bg-muted shrink-0 border border-border shadow-md mt-4 md:mt-0 relative group">
              {topSong.cover_url ? (
                <img src={topSong.cover_url} alt={topSong.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-muted-foreground/30">
                  {topSong.title[0]}
                </div>
              )}
              <button
                onClick={() => handlePlaySong(topSong)}
                className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Play className="h-10 w-10 text-white fill-current" />
              </button>
            </div>

            <div className="flex-1 text-center md:text-left min-w-0">
              <p className="text-xs font-semibold text-accent uppercase tracking-wider">Top Chart Breaker</p>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground truncate mt-1">
                {topSong.title}
              </h2>
              <p className="text-base text-muted-foreground mt-0.5">{topSong.artist_name}</p>

              <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 mt-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1 font-medium">
                  <Play className="h-3.5 w-3.5 text-accent fill-current" />
                  {topSong.play_count.toLocaleString()} Plays
                </span>
                <span className="flex items-center gap-1 font-medium">
                  <Download className="h-3.5 w-3.5 text-emerald-500" />
                  {topSong.download_count.toLocaleString()} Downloads
                </span>
                <span className="flex items-center gap-1 font-medium">
                  <Heart className="h-3.5 w-3.5 text-rose-500 fill-current" />
                  {topSong.like_count.toLocaleString()} Likes
                </span>
              </div>

              <div className="flex items-center justify-center md:justify-start gap-3 mt-5">
                <Button
                  onClick={() => handlePlaySong(topSong)}
                  className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold px-6 gap-2"
                >
                  <Play className="h-4 w-4 fill-current" />
                  {currentSong?.id === topSong.id ? 'Now Playing' : 'Play Track'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    openShare(
                      `${window.location.origin}/song/${topSong.id}`,
                      `${topSong.title} - ${topSong.artist_name}`,
                      topSong.cover_url || undefined
                    )
                  }
                  className="gap-2"
                >
                  <Share2 className="h-4 w-4" /> Share
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Primary Tabs Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-muted/60 p-1 flex-wrap h-auto gap-1 border border-border/80">
            <TabsTrigger value="all" className="text-xs gap-1.5 py-1.5 px-3">
              <TrendingUp className="h-3.5 w-3.5" /> All Trending
            </TabsTrigger>
            <TabsTrigger value="songs" className="text-xs gap-1.5 py-1.5 px-3">
              <Music2 className="h-3.5 w-3.5 text-accent" /> Trending Songs ({filteredSongs.length})
            </TabsTrigger>
            <TabsTrigger value="videos" className="text-xs gap-1.5 py-1.5 px-3">
              <VideoIcon className="h-3.5 w-3.5 text-blue-500" /> Trending Videos ({filteredVideos.length})
            </TabsTrigger>
            <TabsTrigger value="nominees" className="text-xs gap-1.5 py-1.5 px-3">
              <Trophy className="h-3.5 w-3.5 text-amber-500" /> Award Nominees ({filteredNominees.length})
            </TabsTrigger>
            <TabsTrigger value="artists" className="text-xs gap-1.5 py-1.5 px-3">
              <Users className="h-3.5 w-3.5 text-emerald-500" /> Top Artists ({filteredArtists.length})
            </TabsTrigger>
            <TabsTrigger value="weekly" className="text-xs gap-1.5 py-1.5 px-3">
              <Award className="h-3.5 w-3.5 text-purple-500" /> Weekly Charts
            </TabsTrigger>
          </TabsList>

          {/* ══════════════════ TAB 1: ALL TRENDING OVERVIEW ══════════════════ */}
          <TabsContent value="all" className="space-y-8 mt-4">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-48 rounded-xl" />
                ))}
              </div>
            ) : (
              <>
                {/* Two Column Grid: Top Trending Songs & Top Award Nominees */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  {/* Left Column: Top 6 Songs */}
                  <div className="lg:col-span-7 space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-bold flex items-center gap-2">
                        <Music2 className="h-5 w-5 text-accent" /> Top Songs Chart
                      </h2>
                      <button
                        onClick={() => setActiveTab('songs')}
                        className="text-xs text-accent hover:underline font-medium"
                      >
                        View All ({trendingSongs.length}) →
                      </button>
                    </div>

                    <div className="bg-card border border-border rounded-xl divide-y divide-border/60 overflow-hidden shadow-sm">
                      {filteredSongs.slice(0, 6).map((song, idx) => (
                        <div
                          key={song.id}
                          className="flex items-center gap-3.5 p-3 hover:bg-muted/40 transition-colors group cursor-pointer"
                          onClick={() => handlePlaySong(song)}
                        >
                          <span
                            className={`w-6 text-center font-bold text-sm shrink-0 ${
                              idx < 3 ? 'text-accent' : 'text-muted-foreground'
                            }`}
                          >
                            {idx + 1}
                          </span>
                          <div className="h-11 w-11 rounded-lg overflow-hidden bg-muted shrink-0 relative border border-border/50">
                            {song.cover_url ? (
                              <img src={song.cover_url} alt={song.title} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-xs font-bold text-muted-foreground/40">
                                {song.title[0]}
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <Play className="h-4 w-4 text-white fill-current" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm truncate group-hover:text-accent">
                              {song.title}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">{song.artist_name}</p>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-xs text-muted-foreground font-medium hidden sm:inline">
                              {song.play_count.toLocaleString()} plays
                            </span>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              title="Share song"
                              onClick={(e) => {
                                e.stopPropagation();
                                openShare(
                                  `${window.location.origin}/song/${song.id}`,
                                  `${song.title} - ${song.artist_name}`,
                                  song.cover_url || undefined
                                );
                              }}
                            >
                              <Share2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right Column: Top Award Nominees Leaderboard */}
                  <div className="lg:col-span-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-bold flex items-center gap-2">
                        <Trophy className="h-5 w-5 text-accent" /> Awards Leaders
                      </h2>
                      <button
                        onClick={() => setActiveTab('nominees')}
                        className="text-xs text-accent hover:underline font-medium"
                      >
                        Vote Nominees →
                      </button>
                    </div>

                    <div className="bg-card border border-border rounded-xl divide-y divide-border/60 overflow-hidden shadow-sm">
                      {filteredNominees.slice(0, 5).map((nominee, idx) => (
                        <div key={nominee.id} className="flex items-center gap-3.5 p-3">
                          <span
                            className={`w-6 text-center font-bold text-sm shrink-0 ${
                              idx === 0 ? 'text-accent' : 'text-muted-foreground'
                            }`}
                          >
                            #{idx + 1}
                          </span>
                          <div className="h-11 w-11 rounded-lg overflow-hidden bg-muted shrink-0 border border-border">
                            {nominee.photo_url ? (
                              <img src={nominee.photo_url} alt={nominee.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-sm font-bold text-muted-foreground/30">
                                {nominee.name[0]}
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm truncate">{nominee.name}</p>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {nominee.song_title || 'Nominee'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="text-right">
                              <span className="text-xs font-bold text-foreground">
                                {nominee.total_votes.toLocaleString()}
                              </span>
                              <p className="text-[9px] text-muted-foreground uppercase">Votes</p>
                            </div>
                            <Button
                              size="sm"
                              className="h-7 text-xs bg-accent text-accent-foreground hover:bg-accent/90 px-3 font-semibold"
                              onClick={() => {
                                setSelectedNominee(nominee);
                                setVoteDialogOpen(true);
                              }}
                            >
                              Vote
                            </Button>
                          </div>
                        </div>
                      ))}

                      {filteredNominees.length === 0 && (
                        <div className="p-6 text-center text-xs text-muted-foreground">
                          No nominees listed yet.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Section: Trending Music Videos */}
                <div className="space-y-4 pt-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                      <VideoIcon className="h-5 w-5 text-blue-500" /> Trending Videos
                    </h2>
                    <button
                      onClick={() => setActiveTab('videos')}
                      className="text-xs text-accent hover:underline font-medium"
                    >
                      View All Videos ({trendingVideos.length}) →
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {filteredVideos.slice(0, 4).map((video) => (
                      <div
                        key={video.id}
                        className="group bg-card border border-border rounded-xl overflow-hidden hover:border-accent transition-all flex flex-col cursor-pointer"
                        onClick={() => handlePlayVideo(video)}
                      >
                        <div className="aspect-video bg-muted relative overflow-hidden">
                          {video.thumbnail_url ? (
                            <img
                              src={video.thumbnail_url}
                              alt={video.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <VideoIcon className="h-8 w-8 text-muted-foreground/30" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Play className="h-8 w-8 text-white fill-current" />
                          </div>
                        </div>
                        <div className="p-3 flex-1 flex flex-col justify-between">
                          <div>
                            <p className="font-semibold text-sm truncate group-hover:text-accent">
                              {video.title}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">{video.artist_name || 'ZedVevo'}</p>
                          </div>
                          <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/40 text-[11px] text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Eye className="h-3 w-3" /> {(video.view_count || 0).toLocaleString()}
                            </span>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={(e) => {
                                e.stopPropagation();
                                openShare(
                                  `${window.location.origin}/video/${video.id}`,
                                  video.title,
                                  video.thumbnail_url || undefined
                                );
                              }}
                            >
                              <Share2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </TabsContent>

          {/* ══════════════════ TAB 2: TRENDING SONGS ══════════════════ */}
          <TabsContent value="songs" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">All Trending Songs</h2>
                <p className="text-xs text-muted-foreground">Ranked by play count and viral popularity in Zambia</p>
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl divide-y divide-border/60 overflow-hidden shadow-sm">
              {filteredSongs.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  No trending songs found matching your search.
                </div>
              ) : (
                filteredSongs.map((song, idx) => (
                  <div
                    key={song.id}
                    className="flex items-center gap-3.5 p-3.5 hover:bg-muted/40 transition-colors group cursor-pointer"
                    onClick={() => handlePlaySong(song)}
                  >
                    <span
                      className={`w-7 text-center font-bold text-sm shrink-0 ${
                        idx < 3 ? 'text-accent' : 'text-muted-foreground'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <div className="h-12 w-12 rounded-lg overflow-hidden bg-muted shrink-0 relative border border-border">
                      {song.cover_url ? (
                        <img src={song.cover_url} alt={song.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-sm font-bold text-muted-foreground/30">
                          {song.title[0]}
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Play className="h-5 w-5 text-white fill-current" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm truncate group-hover:text-accent">
                          {song.title}
                        </p>
                        {song.is_trending && (
                          <Badge variant="outline" className="text-[10px] text-accent border-accent/40 py-0">
                            Trending
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{song.artist_name}</p>
                    </div>

                    <div className="flex items-center gap-4 shrink-0 text-xs text-muted-foreground">
                      <span className="hidden md:inline-flex items-center gap-1">
                        <Play className="h-3.5 w-3.5 text-accent" /> {song.play_count.toLocaleString()}
                      </span>
                      <span className="hidden sm:inline-flex items-center gap-1">
                        <Download className="h-3.5 w-3.5 text-emerald-500" /> {song.download_count.toLocaleString()}
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        title="Share Permanent Link"
                        onClick={(e) => {
                          e.stopPropagation();
                          openShare(
                            `${window.location.origin}/song/${song.id}`,
                            `${song.title} - ${song.artist_name}`,
                            song.cover_url || undefined
                          );
                        }}
                      >
                        <Share2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs gap-1.5"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePlaySong(song);
                        }}
                      >
                        <Play className="h-3 w-3 fill-current" /> Play
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          {/* ══════════════════ TAB 3: TRENDING VIDEOS ══════════════════ */}
          <TabsContent value="videos" className="space-y-4">
            <div>
              <h2 className="text-lg font-bold">Trending Music Videos</h2>
              <p className="text-xs text-muted-foreground">Top streamed videos across ZedVevo</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredVideos.length === 0 ? (
                <div className="col-span-full py-12 text-center text-sm text-muted-foreground">
                  No trending videos found.
                </div>
              ) : (
                filteredVideos.map((video) => (
                  <div
                    key={video.id}
                    className="group bg-card border border-border rounded-xl overflow-hidden hover:border-accent transition-all flex flex-col cursor-pointer"
                    onClick={() => handlePlayVideo(video)}
                  >
                    <div className="aspect-video bg-muted relative overflow-hidden">
                      {video.thumbnail_url ? (
                        <img
                          src={video.thumbnail_url}
                          alt={video.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <VideoIcon className="h-8 w-8 text-muted-foreground/30" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Play className="h-10 w-10 text-white fill-current" />
                      </div>
                    </div>
                    <div className="p-3.5 flex-1 flex flex-col justify-between">
                      <div>
                        <p className="font-semibold text-sm truncate group-hover:text-accent">
                          {video.title}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{video.artist_name || 'ZedVevo'}</p>
                      </div>
                      <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/40 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1 font-medium">
                          <Eye className="h-3.5 w-3.5" /> {(video.view_count || 0).toLocaleString()} views
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            openShare(
                              `${window.location.origin}/video/${video.id}`,
                              video.title,
                              video.thumbnail_url || undefined
                            );
                          }}
                        >
                          <Share2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          {/* ══════════════════ TAB 4: AWARD NOMINEES LEADERBOARD ══════════════════ */}
          <TabsContent value="nominees" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">Awards Leaderboard</h2>
                <p className="text-xs text-muted-foreground">
                  Official confirmed votes verified by Supabase & Lipila (K5 per vote)
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredNominees.length === 0 ? (
                <div className="col-span-full py-12 text-center text-sm text-muted-foreground">
                  No nominees found.
                </div>
              ) : (
                filteredNominees.map((nominee, idx) => (
                  <div
                    key={nominee.id}
                    className="bg-card border border-border rounded-xl p-4 flex flex-col justify-between hover:border-accent transition-all shadow-sm"
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="relative">
                        <div className="h-16 w-16 rounded-xl overflow-hidden bg-muted shrink-0 border border-border">
                          {nominee.photo_url ? (
                            <img src={nominee.photo_url} alt={nominee.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xl font-bold text-muted-foreground/30">
                              {nominee.name[0]}
                            </div>
                          )}
                        </div>
                        <span className="absolute -top-1.5 -left-1.5 bg-background border border-border rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold">
                          #{idx + 1}
                        </span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-base truncate">{nominee.name}</p>
                        {nominee.song_title && (
                          <p className="text-xs text-muted-foreground truncate">{nominee.song_title}</p>
                        )}
                        <div className="mt-2 flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] border-accent/40 text-accent font-semibold">
                            {nominee.total_votes.toLocaleString()} Votes
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border/50">
                      <Button
                        size="sm"
                        className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground font-bold text-xs h-8"
                        onClick={() => {
                          setSelectedNominee(nominee);
                          setVoteDialogOpen(true);
                        }}
                      >
                        Vote (K5/vote)
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8 shrink-0"
                        title="Share nominee permanent link"
                        onClick={() =>
                          openShare(
                            `${window.location.origin}/nominee/${nominee.id}`,
                            `Vote for ${nominee.name} - ZedVevo Awards`,
                            nominee.photo_url || undefined
                          )
                        }
                      >
                        <Share2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          {/* ══════════════════ TAB 5: TRENDING ARTISTS ══════════════════ */}
          <TabsContent value="artists" className="space-y-4">
            <div>
              <h2 className="text-lg font-bold">Top Trending Zambian Artists</h2>
              <p className="text-xs text-muted-foreground">Most listened artists across the platform</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {filteredArtists.length === 0 ? (
                <div className="col-span-full py-12 text-center text-sm text-muted-foreground">
                  No artists found.
                </div>
              ) : (
                filteredArtists.map((artist, idx) => (
                  <div
                    key={artist.id}
                    className="bg-card border border-border rounded-xl p-4 text-center group hover:border-accent transition-all"
                  >
                    <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-full overflow-hidden mx-auto mb-3 bg-muted border-2 border-border group-hover:border-accent transition-colors">
                      <img
                        src={artist.avatar_url || artist.cover_image_url || artist.cover_url || '/app-icon.png'}
                        alt={artist.stage_name || artist.name || 'Artist'}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = '/app-icon.png';
                        }}
                      />
                    </div>
                    <p className="text-xs font-bold truncate group-hover:text-accent">{artist.stage_name || artist.name || 'Artist'}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {artist.play_count.toLocaleString()} plays
                    </p>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          {/* ══════════════════ TAB 6: WEEKLY CHARTS ══════════════════ */}
          <TabsContent value="weekly" className="space-y-4">
            <div>
              <h2 className="text-lg font-bold">Weekly Performance Charts</h2>
              <p className="text-xs text-muted-foreground">
                Official weekly rankings aggregated by plays, downloads, views, and likes
              </p>
            </div>

            <Tabs value={weeklyTab} onValueChange={setWeeklyTab}>
              <TabsList className="mb-4 flex-wrap h-auto gap-1">
                {WEEKLY_CATEGORIES.map((cat) => (
                  <TabsTrigger key={cat.value} value={cat.value} className="flex items-center gap-1.5 text-xs">
                    <cat.icon className={`h-3.5 w-3.5 ${cat.color}`} />
                    <span>{cat.label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>

              {WEEKLY_CATEGORIES.map((cat) => {
                const items = weeklyData[cat.value] || [];
                return (
                  <TabsContent key={cat.value} value={cat.value}>
                    {items.length === 0 ? (
                      // Smart fallback: display live songs or videos if weekly aggregation hasn't run
                      <div className="bg-card border border-border rounded-xl p-6 text-center">
                        <TrendingUp className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                        <p className="text-sm font-semibold">Weekly Calculation Standby</p>
                        <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                          Rankings update every Sunday. You can still explore the live charts in the Trending Songs & Videos tabs.
                        </p>
                        {profile?.role === 'admin' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-3 text-xs"
                            onClick={handleRefresh}
                            disabled={refreshing}
                          >
                            Calculate Weekly Trends Now
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="bg-card border border-border rounded-xl divide-y divide-border/60 overflow-hidden shadow-sm">
                        {items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center gap-3.5 p-3 hover:bg-muted/40 cursor-pointer transition-colors group"
                            onClick={() => handleWeeklyPlay(item)}
                          >
                            <span
                              className={`text-base font-bold w-7 text-center shrink-0 ${
                                item.rank <= 3 ? 'text-accent' : 'text-muted-foreground/50'
                              }`}
                            >
                              {item.rank}
                            </span>
                            <div className="h-11 w-11 rounded-lg shrink-0 overflow-hidden bg-muted flex items-center justify-center border border-border/50">
                              {item.cover_url ? (
                                <img src={item.cover_url} alt={item.title} className="w-full h-full object-cover" />
                              ) : item.content_type === 'song' ? (
                                <Music2 className="h-5 w-5 text-muted-foreground" />
                              ) : (
                                <VideoIcon className="h-5 w-5 text-muted-foreground" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold truncate group-hover:text-accent">
                                {item.title}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">{item.artist_name}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge variant="outline" className="text-[10px] capitalize hidden sm:inline-flex">
                                {item.content_type}
                              </Badge>
                              <span className="text-xs text-muted-foreground font-semibold">
                                {item.metric_value.toLocaleString()}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                );
              })}
            </Tabs>
          </TabsContent>
        </Tabs>
      </div>

      {/* Video Player Modal */}
      {currentVideo && (
        <VideoPlayer video={currentVideo} onClose={() => setCurrentVideo(null)} />
      )}

      {/* Shared Vote Dialog */}
      <VoteDialog
        open={voteDialogOpen}
        onOpenChange={setVoteDialogOpen}
        nominee={selectedNominee}
        pricePerVote={parseFloat(settings.vote_min_amount || '5')}
        onVoteSuccess={() => {
          // Realtime automatically updates the list
        }}
      />

      {/* Share Sheet Modal */}
      <ShareSheet
        open={shareData.open}
        onClose={() => setShareData((prev) => ({ ...prev, open: false }))}
        url={shareData.url}
        title={shareData.title}
        thumbnailUrl={shareData.thumbnailUrl}
      />
    </div>
  );
}
