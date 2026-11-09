import React, { useState, useEffect } from 'react';
import { supabase } from '@/db/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DollarSign, PieChart, Users, Sparkles, RefreshCw, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminArtistEarningsBreakdown() {
  const [loading, setLoading] = useState(true);
  const [artistsEarnings, setArtistsEarnings] = useState<any[]>([]);
  const [summary, setSummary] = useState({
    totalAdsterraUSD: 0,
    adminCutUSD: 0,
    artistPoolUSD: 0,
    totalEngagementPoints: 0
  });

  const EXCHANGE_RATE = 27.0; // USD to ZMW
  const ADMIN_PERCENT = 20; // Admin 20%
  const ARTIST_POOL_PERCENT = 80; // Artists 80%

  const loadBreakdown = async () => {
    try {
      setLoading(true);

      // 1. Fetch Adsterra global stats
      const { data: statsData } = await supabase
        .from('adsterra_stats')
        .select('*');

      const totalUSD = (statsData || []).reduce((sum, s) => sum + Number(s.revenue || 0), 0);
      const adminUSD = totalUSD * (ADMIN_PERCENT / 100);
      const poolUSD = totalUSD * (ARTIST_POOL_PERCENT / 100);

      // 2. Fetch all artists and their songs/videos
      const [artistsRes, songsRes, videosRes, downloadsRes] = await Promise.all([
        supabase.from('users').select('*').eq('is_artist', true),
        supabase.from('songs').select('id, title, play_count, user_id, artist_name'),
        supabase.from('videos').select('id, title, view_count, user_id, artist_name'),
        supabase.from('downloads').select('content_id, content_type')
      ]);

      const artists = artistsRes.data || [];
      const songs = songsRes.data || [];
      const videos = videosRes.data || [];
      const downloads = downloadsRes.data || [];

      const downloadMap: Record<string, number> = {};
      downloads.forEach(d => {
        if (d.content_id) {
          downloadMap[d.content_id] = (downloadMap[d.content_id] || 0) + 1;
        }
      });

      // Calculate score per artist
      let totalPlatformScore = 0;
      const artistScores: Record<string, { artist: any; score: number; songsCount: number; videosCount: number }> = {};

      artists.forEach(artist => {
        artistScores[artist.id] = {
          artist,
          score: 0,
          songsCount: 0,
          videosCount: 0
        };
      });

      songs.forEach(song => {
        const uid = song.user_id;
        const plays = Number(song.play_count || 0);
        const dls = Number(downloadMap[song.id] || 0);
        const score = plays + (dls * 3);

        totalPlatformScore += score;
        if (uid && artistScores[uid]) {
          artistScores[uid].score += score;
          artistScores[uid].songsCount += 1;
        }
      });

      videos.forEach(video => {
        const uid = video.user_id;
        const views = Number(video.view_count || 0);
        const dls = Number(downloadMap[video.id] || 0);
        const score = (views * 2) + (dls * 5);

        totalPlatformScore += score;
        if (uid && artistScores[uid]) {
          artistScores[uid].score += score;
          artistScores[uid].videosCount += 1;
        }
      });

      // Build breakdown array
      const breakdown = Object.values(artistScores).map(item => {
        const ratio = totalPlatformScore > 0 ? (item.score / totalPlatformScore) : 0;
        const earnedUSD = poolUSD * ratio;
        const earnedZMW = earnedUSD * EXCHANGE_RATE;

        return {
          id: item.artist.id,
          name: item.artist.full_name || item.artist.username || 'Independent Artist',
          email: item.artist.email,
          avatar: item.artist.avatar_url,
          songsCount: item.songsCount,
          videosCount: item.videosCount,
          score: item.score,
          ratio: ratio * 100,
          earnedUSD,
          earnedZMW
        };
      }).sort((a, b) => b.earnedUSD - a.earnedUSD);

      setArtistsEarnings(breakdown);
      setSummary({
        totalAdsterraUSD: totalUSD,
        adminCutUSD: adminUSD,
        artistPoolUSD: poolUSD,
        totalEngagementPoints: totalPlatformScore
      });

    } catch (err) {
      console.error('Failed to load artist earnings breakdown:', err);
      toast.error('Could not load Adsterra earnings breakdown');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBreakdown();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-xs gap-2">
        <RefreshCw className="h-4 w-4 animate-spin text-accent" />
        Calculating real-time artist earnings and admin commission splits...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Top Banner & Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        {/* Total Adsterra Revenue */}
        <Card className="border border-border/60 bg-card/60 backdrop-blur-xl rounded-3xl overflow-hidden shadow-sm">
          <CardContent className="p-5 space-y-1.5">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Total Adsterra Pool</span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-white">${summary.totalAdsterraUSD.toFixed(2)}</span>
              <span className="text-xs text-muted-foreground font-semibold">USD</span>
            </div>
            <p className="text-xs text-muted-foreground">≈ K{(summary.totalAdsterraUSD * EXCHANGE_RATE).toFixed(2)} ZMW</p>
          </CardContent>
        </Card>

        {/* Admin 20% Cut */}
        <Card className="border border-emerald-500/30 bg-emerald-950/10 backdrop-blur-xl rounded-3xl overflow-hidden shadow-sm">
          <CardContent className="p-5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Admin Cut (20%)</span>
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[9px]">Platform Fee</Badge>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-emerald-400">${summary.adminCutUSD.toFixed(2)}</span>
              <span className="text-xs text-emerald-400/80 font-semibold">USD</span>
            </div>
            <p className="text-xs text-emerald-500/80">≈ K{(summary.adminCutUSD * EXCHANGE_RATE).toFixed(2)} ZMW direct profit</p>
          </CardContent>
        </Card>

        {/* Artist 80% Pool */}
        <Card className="border border-accent/30 bg-accent/5 backdrop-blur-xl rounded-3xl overflow-hidden shadow-sm">
          <CardContent className="p-5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-accent uppercase tracking-wider">Artist Shared Pool (80%)</span>
              <Badge className="bg-accent/20 text-accent border-accent/30 text-[9px]">Proportional Split</Badge>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-accent">${summary.artistPoolUSD.toFixed(2)}</span>
              <span className="text-xs text-accent/80 font-semibold">USD</span>
            </div>
            <p className="text-xs text-accent/80">≈ K{(summary.artistPoolUSD * EXCHANGE_RATE).toFixed(2)} ZMW shared among artists</p>
          </CardContent>
        </Card>

      </div>

      {/* Breakdown Table Card */}
      <Card className="border border-border/60 bg-card/60 backdrop-blur-xl rounded-3xl overflow-hidden shadow-sm">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-black text-white flex items-center gap-1.5">
              <Users className="h-4 w-4 text-accent" /> Real-time Earnings Breakdown By Artist
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Earnings allocated proportionally based on engagement index (streams, video views, and downloads).
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={loadBreakdown}
            className="h-8 text-xs gap-1.5 rounded-xl border-border hover:bg-white/5"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </CardHeader>

        <CardContent>
          {artistsEarnings.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-xs border border-dashed border-border rounded-2xl">
              No registered artists with content found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-muted-foreground border-collapse">
                <thead>
                  <tr className="border-b border-white/5 text-[10px] text-white/50 uppercase font-bold tracking-wider">
                    <th className="py-3 px-3">Artist</th>
                    <th className="py-3 px-3 text-center">Content Uploads</th>
                    <th className="py-3 px-3 text-center">Performance Weight</th>
                    <th className="py-3 px-3 text-right">Share (%)</th>
                    <th className="py-3 px-3 text-right">Earnings (USD)</th>
                    <th className="py-3 px-3 text-right">Earnings (ZMW)</th>
                  </tr>
                </thead>
                <tbody>
                  {artistsEarnings.map((artist) => (
                    <tr key={artist.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-3 flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-accent/20 text-accent font-bold flex items-center justify-center overflow-hidden shrink-0">
                          {artist.avatar ? (
                            <img src={artist.avatar} alt={artist.name} className="w-full h-full object-cover" />
                          ) : (
                            artist.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-white truncate">{artist.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{artist.email}</p>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="font-semibold text-white">{artist.songsCount} songs</span> · <span className="font-semibold text-white">{artist.videosCount} videos</span>
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-medium text-white">
                        {artist.score.toLocaleString()} pts
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-accent">
                        {artist.ratio.toFixed(2)}%
                      </td>
                      <td className="py-3 px-3 text-right font-extrabold text-emerald-400">
                        ${artist.earnedUSD.toFixed(4)}
                      </td>
                      <td className="py-3 px-3 text-right font-extrabold text-white">
                        K{artist.earnedZMW.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
