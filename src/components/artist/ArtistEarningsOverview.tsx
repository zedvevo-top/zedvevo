import React, { useState, useEffect } from 'react';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { getSongs, getVideos, getUserWallet, getUserWalletTransactions } from '@/lib/api';
import { 
  DollarSign, TrendingUp, Music2, Video, Percent, Award, Download, 
  BarChart3, RefreshCw, Layers, Sparkles, HelpCircle, ArrowUpRight, ShieldCheck 
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend
} from 'recharts';

export default function ArtistEarningsOverview({ onRequestPayout }: { onRequestPayout?: () => void }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [wallet, setWallet] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [songs, setSongs] = useState<any[]>([]);
  const [videos, setVideos] = useState<any[]>([]);
  const [globalStats, setGlobalStats] = useState<any[]>([]);
  const [platformMetrics, setPlatformMetrics] = useState({
    totalSongsEngagement: 0,
    totalVideosEngagement: 0,
    totalPlatformEngagement: 0,
    artistEngagement: 0,
    artistRatio: 0,
    estimatedCommunityUSD: 0
  });

  const EXCHANGE_RATE = 27.0; // standard USD to ZMW rate
  const ARTIST_SHARE_PERCENT = 80; // 80% shared with artists

  const loadData = async () => {
    if (!user) return;
    try {
      setLoading(true);
      
      // 1. Fetch user's own wallet, songs, and videos
      const [walletData, txs, artistSongs, artistVideos, statsResult] = await Promise.all([
        getUserWallet(user.id),
        getUserWalletTransactions(user.id),
        getSongs({ userId: user.id }),
        getVideos({ userId: user.id }),
        supabase.from('adsterra_stats').select('*').order('date', { ascending: false }).limit(30)
      ]);

      setWallet(walletData);
      setTransactions(txs || []);
      setSongs(artistSongs || []);
      setVideos(artistVideos || []);
      
      const rawStats = statsResult.data || [];
      // Format date label for chart
      const formattedStats = rawStats.map((s: any) => ({
        ...s,
        formattedDate: new Date(s.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        communityRevenueUSD: parseFloat((s.revenue * 0.8).toFixed(4)),
        communityRevenueZMW: parseFloat((s.revenue * 0.8 * EXCHANGE_RATE).toFixed(2))
      })).reverse();
      setGlobalStats(formattedStats);

      // 2. Fetch platform wide statistics to compute engagement weighting
      const [allSongsRes, allVideosRes, downloadsRes] = await Promise.all([
        supabase.from('songs').select('id, play_count, user_id').eq('status', 'approved'),
        supabase.from('videos').select('id, view_count, user_id').eq('status', 'approved'),
        supabase.from('downloads').select('content_id, content_type')
      ]);

      const allSongs = allSongsRes.data || [];
      const allVideos = allVideosRes.data || [];
      const allDownloads = downloadsRes.data || [];

      // Create download counts map
      const downloadCounts: Record<string, number> = {};
      allDownloads.forEach(dl => {
        if (dl.content_id) {
          downloadCounts[dl.content_id] = (downloadCounts[dl.content_id] || 0) + 1;
        }
      });

      // Calculate total platform-wide scores
      let totalPlatformScore = 0;
      let artistScore = 0;

      // Group by songs
      allSongs.forEach(song => {
        const plays = parseInt(song.play_count || 0);
        const dls = parseInt(downloadCounts[song.id] || 0);
        const songScore = plays + (dls * 3); // Play weight: 1x, Download weight: 3x
        
        totalPlatformScore += songScore;
        if (song.user_id === user.id) {
          artistScore += songScore;
        }
      });

      // Group by videos
      allVideos.forEach(video => {
        const views = parseInt(video.view_count || 0);
        const dls = parseInt(downloadCounts[video.id] || 0);
        const videoScore = (views * 2) + (dls * 5); // View weight: 2x, Download weight: 5x
        
        totalPlatformScore += videoScore;
        if (video.user_id === user.id) {
          artistScore += videoScore;
        }
      });

      // Calculate global ad pool community USD estimation (last 30 days)
      const last30DaysUSD = rawStats.reduce((sum, day) => sum + parseFloat(day.revenue || 0), 0);
      const communityUSD = last30DaysUSD * (ARTIST_SHARE_PERCENT / 100);

      const ratio = totalPlatformScore > 0 ? (artistScore / totalPlatformScore) : 0;

      setPlatformMetrics({
        totalSongsEngagement: allSongs.reduce((sum, s) => sum + (parseInt(s.play_count || 0)), 0),
        totalVideosEngagement: allVideos.reduce((sum, v) => sum + (parseInt(v.view_count || 0)), 0),
        totalPlatformEngagement: totalPlatformScore,
        artistEngagement: artistScore,
        artistRatio: ratio,
        estimatedCommunityUSD: communityUSD
      });

    } catch (error) {
      console.error('Failed to load artist earnings data:', error);
      toast.error('Could not fetch real-time earnings data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const handleSyncNow = async () => {
    setRefreshing(true);
    const toastId = toast.loading('Querying live Adsterra API and updating royalty balances...');
    try {
      const response = await fetch('/api/adsterra-sync', { method: 'POST' });
      const result = await response.json();
      toast.dismiss(toastId);

      if (result.success) {
        toast.success(`Successfully updated! Found $${result.net_new_usd.toFixed(4)} USD in new advertising traffic revenue.`);
        loadData();
      } else {
        throw new Error(result.error || result.details || 'Unable to sync live stats.');
      }
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error(err.message || 'Adsterra sync failed. Try again later.');
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <RefreshCw className="h-10 w-10 text-accent animate-spin" />
        <p className="text-sm text-muted-foreground animate-pulse">Fetching real-time Adsterra performance ledger...</p>
      </div>
    );
  }

  // Calculated values
  const earnedZMW = wallet?.total_earnings || 0;
  const earnedUSD = earnedZMW / EXCHANGE_RATE;
  const availableZMW = wallet?.available_balance || 0;
  const withdrawnZMW = wallet?.total_withdrawn || 0;

  // Custom Chart Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background/95 border border-border p-3.5 rounded-xl shadow-2xl backdrop-blur-md">
          <p className="font-bold text-xs mb-1.5 text-white">{label}</p>
          <div className="space-y-1 text-[11px]">
            <p className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Total Ad Revenue:</span>
              <span className="font-semibold text-emerald-400">${payload[0].payload.revenue.toFixed(2)} USD</span>
            </p>
            <p className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Artist Pool (80%):</span>
              <span className="font-semibold text-accent">K{payload[0].payload.communityRevenueZMW.toFixed(2)} ZMW</span>
            </p>
            <p className="flex items-center justify-between gap-4 border-t border-white/5 pt-1 mt-1">
              <span className="text-muted-foreground">Ad Impressions:</span>
              <span className="font-semibold text-white">{(payload[0].payload.impressions || 0).toLocaleString()}</span>
            </p>
            <p className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Ad Clicks:</span>
              <span className="font-semibold text-white">{(payload[0].payload.clicks || 0).toLocaleString()}</span>
            </p>
            <p className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">eCPM Rate:</span>
              <span className="font-semibold text-white">${(payload[0].payload.cpm || 0).toFixed(2)} USD</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      
      {/* Upper Title banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-accent/10 to-transparent p-5 rounded-2xl border border-accent/20">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge className="bg-accent/20 text-accent hover:bg-accent/20 border-accent/30 text-[10px] uppercase font-bold tracking-wider">
              Adsterra Monetized
            </Badge>
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] text-muted-foreground font-semibold">Live Traffic Pool Connected</span>
          </div>
          <h2 className="text-lg font-black tracking-tight text-white flex items-center gap-1.5">
            <Sparkles className="h-5 w-5 text-accent" /> Artist Ad-Revenue & Royalty Hub
          </h2>
          <p className="text-xs text-muted-foreground max-w-xl leading-normal">
            Every banner view, popunder click, and download event across Zedvevo powers our global Adsterra pool. 
            We distribute <strong>80% of all ad payouts</strong> directly back to active artists proportional to their performance weights.
          </p>
        </div>

        <div className="shrink-0">
          <Button 
            onClick={handleSyncNow} 
            disabled={refreshing}
            size="sm"
            className="bg-accent hover:bg-accent/90 text-accent-foreground font-bold h-9 shadow-lg shadow-accent/10 w-full sm:w-auto"
          >
            {refreshing ? (
              <>
                <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />
                Syncing Live Ledger...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-1.5" />
                Refresh Earnings
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Your Lifetime Share */}
        <Card className="bg-card border-border/60 hover:border-accent/40 transition-all duration-300 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-5 text-accent group-hover:scale-110 transition-transform duration-500">
            <DollarSign className="w-24 h-24" />
          </div>
          <CardContent className="p-5 space-y-1.5">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">YOUR TOTAL REVENUE</span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-emerald-500">K{earnedZMW.toFixed(2)}</span>
              <span className="text-xs text-muted-foreground font-semibold">ZMW</span>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              ≈ ${earnedUSD.toFixed(2)} USD 
              <ArrowUpRight className="h-3 w-3 text-emerald-500" />
            </p>
            <div className="border-t border-border/50 pt-2.5 mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Weighted Share + Purchases</span>
              <span className="font-semibold text-emerald-500">100% Verified</span>
            </div>
          </CardContent>
        </Card>

        {/* Available to Withdraw */}
        <Card className="bg-card border-border/60 hover:border-accent/40 transition-all duration-300 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-5 text-accent group-hover:scale-110 transition-transform duration-500">
            <Percent className="w-24 h-24" />
          </div>
          <CardContent className="p-5 space-y-1.5">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">AVAILABLE BALANCE</span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-accent">K{availableZMW.toFixed(2)}</span>
              <span className="text-xs text-muted-foreground font-semibold">ZMW</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Ready for mobile money or bank transfer
            </p>
            <div className="border-t border-border/50 pt-2.5 mt-1 flex items-center justify-between text-[10px] gap-2">
              <span className="text-muted-foreground">Min. threshold: K50.00</span>
              {onRequestPayout && (
                <Button 
                  size="sm" 
                  onClick={onRequestPayout}
                  disabled={availableZMW < 50}
                  className="text-[10px] h-6 font-bold bg-accent hover:bg-accent/90 text-accent-foreground px-2 py-0"
                >
                  Withdraw
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Your Platform Weight */}
        <Card className="bg-card border-border/60 hover:border-accent/40 transition-all duration-300 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-5 text-accent group-hover:scale-110 transition-transform duration-500">
            <Award className="w-24 h-24" />
          </div>
          <CardContent className="p-5 space-y-1.5">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">YOUR PERFORMANCE INDEX</span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-white">{(platformMetrics.artistRatio * 100).toFixed(4)}%</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {platformMetrics.artistEngagement.toLocaleString()} calculated performance pts
            </p>
            <div className="border-t border-border/50 pt-2.5 mt-1">
              <Progress value={platformMetrics.artistRatio * 100} className="h-1.5 bg-muted" />
            </div>
          </CardContent>
        </Card>

        {/* Global 30-Day Ad Pool */}
        <Card className="bg-card border-border/60 hover:border-accent/40 transition-all duration-300 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-5 text-accent group-hover:scale-110 transition-transform duration-500">
            <Layers className="w-24 h-24" />
          </div>
          <CardContent className="p-5 space-y-1.5">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">30D ADSTERRA ARTIST POOL</span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-white">${platformMetrics.estimatedCommunityUSD.toFixed(2)}</span>
              <span className="text-xs text-muted-foreground font-semibold">USD</span>
            </div>
            <p className="text-xs text-muted-foreground">
              ≈ K{(platformMetrics.estimatedCommunityUSD * EXCHANGE_RATE).toLocaleString(undefined, { maximumFractionDigits: 2 })} ZMW
            </p>
            <div className="border-t border-border/50 pt-2.5 mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Platform-wide Pool (80% net)</span>
              <span className="font-bold text-accent">Active</span>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Central Visual Analytics and Weight breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Real-time Ad Traffic Performance Graph (2/3 width) */}
        <div className="lg:col-span-2 space-y-3">
          <Card className="border border-border/60 bg-card/60 backdrop-blur-md">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-black text-white flex items-center gap-1.5">
                  <BarChart3 className="h-4 w-4 text-accent" /> Live Adsterra Earnings Pool Trend
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  The daily performance pool (USD) generated by global visitors, and the distributed 80% community share.
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-[10px] text-accent border-accent/30 font-extrabold uppercase">
                Last 30 Days
              </Badge>
            </CardHeader>
            <CardContent>
              {globalStats.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-muted-foreground text-xs border border-dashed border-border rounded-xl">
                  <Layers className="h-8 w-8 mb-2 opacity-25 animate-pulse" />
                  No statistics cached. Click "Refresh Earnings" above to fetch from Adsterra.
                </div>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={globalStats} margin={{ top: 10, right: 5, left: -25, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="var(--accent)" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255, 255, 255, 0.05)" />
                      <XAxis 
                        dataKey="formattedDate" 
                        stroke="rgba(255, 255, 255, 0.3)" 
                        fontSize={9} 
                        tickLine={false} 
                      />
                      <YAxis 
                        stroke="rgba(255, 255, 255, 0.3)" 
                        fontSize={9} 
                        tickLine={false} 
                        axisLine={false}
                        tickFormatter={(v) => `$${v}`}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Area 
                        type="monotone" 
                        dataKey="revenue" 
                        stroke="var(--accent)" 
                        strokeWidth={2.5}
                        fillOpacity={1} 
                        fill="url(#colorRevenue)" 
                        name="Platform Pool"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Performance Points Algorithm Explainer (1/3 width) */}
        <div>
          <Card className="border border-border/60 bg-card/60 backdrop-blur-md h-full flex flex-col justify-between">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-black text-white flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-accent" /> Fair Distribution Algorithm
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                How your monthly ad-revenue payout is weighted on Zedvevo:
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs flex-1">
              
              {/* Weighted points description */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5">
                  <span className="flex items-center gap-1.5 font-semibold text-white">
                    <Music2 className="h-3.5 w-3.5 text-blue-400" /> Active Song Stream
                  </span>
                  <Badge className="bg-blue-900/40 text-blue-200 border-blue-500/20 text-[10px]">
                    1 Point
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5">
                  <span className="flex items-center gap-1.5 font-semibold text-white">
                    <Download className="h-3.5 w-3.5 text-emerald-400" /> Song Download Event
                  </span>
                  <Badge className="bg-emerald-900/40 text-emerald-200 border-emerald-500/20 text-[10px]">
                    3 Points
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5">
                  <span className="flex items-center gap-1.5 font-semibold text-white">
                    <Video className="h-3.5 w-3.5 text-purple-400" /> Music Video View
                  </span>
                  <Badge className="bg-purple-900/40 text-purple-200 border-purple-500/20 text-[10px]">
                    2 Points
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5">
                  <span className="flex items-center gap-1.5 font-semibold text-white">
                    <Download className="h-3.5 w-3.5 text-amber-400" /> Video Download Event
                  </span>
                  <Badge className="bg-amber-900/40 text-amber-200 border-amber-500/20 text-[10px]">
                    5 Points
                  </Badge>
                </div>
              </div>

              {/* Engagement breakdown stats */}
              <div className="bg-accent/5 p-3.5 rounded-xl border border-accent/20 space-y-1.5">
                <p className="font-bold text-[10px] text-accent uppercase tracking-wider">Your Engagement Contribution</p>
                <div className="flex justify-between text-xs text-white">
                  <span>Your Content Points:</span>
                  <span className="font-black text-white">{platformMetrics.artistEngagement.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs text-white">
                  <span>Total Platform Points:</span>
                  <span className="font-semibold text-muted-foreground">{platformMetrics.totalPlatformEngagement.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs border-t border-white/5 pt-1.5 mt-1.5 text-accent font-bold">
                  <span>Your Distributed Share:</span>
                  <span>{(platformMetrics.artistRatio * 100).toFixed(4)}%</span>
                </div>
              </div>

            </CardContent>
          </Card>
        </div>

      </div>

      {/* Transaction History Ledger */}
      <Card className="border border-border/60 bg-card/40 backdrop-blur-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-black text-white">Direct Streaming Earnings & Wallet Activity</CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Audit history of ad payouts, direct song purchases, and mobile money withdrawals.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-xs border border-dashed border-border rounded-xl">
              No transactions ledger entries found. Perform your first song upload or wait for streaming listeners to begin earning.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-muted-foreground border-collapse">
                <thead>
                  <tr className="border-b border-white/5 text-[10px] text-white/50 uppercase font-bold tracking-wider">
                    <th className="py-2.5 px-3">Transaction Description</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3 text-right">Amount (ZMW)</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.slice(0, 10).map((tx) => (
                    <tr key={tx.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-3 text-white font-medium max-w-sm truncate">{tx.description}</td>
                      <td className="py-3 px-3">
                        <Badge variant="outline" className={`text-[10px] capitalize font-bold ${
                          tx.type === 'streaming_earnings' ? 'bg-emerald-900/10 text-emerald-400 border-emerald-500/20' :
                          tx.type === 'voting_earnings' ? 'bg-blue-900/10 text-blue-400 border-blue-500/20' :
                          tx.type === 'withdrawals' ? 'bg-red-900/10 text-red-400 border-red-500/20' :
                          'bg-zinc-800 text-white'
                        }`}>
                          {tx.type.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="py-3 px-3">{new Date(tx.created_at || tx.date).toLocaleDateString()}</td>
                      <td className={`py-3 px-3 text-right font-bold ${tx.amount < 0 ? 'text-destructive' : 'text-emerald-500'}`}>
                        {tx.amount < 0 ? '-' : '+'}K{Math.abs(tx.amount).toFixed(2)}
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
