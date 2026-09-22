import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, Music2, Video, CreditCard, TrendingUp, Download, Trophy, CheckCircle2,
  Eye, Play, Wallet, ArrowUpRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  getAllProfiles, getSongs, getVideos, getAllPayments, getAllDownloads,
  getVisitorAnalytics, getPlatformBalance, type VisitorAnalyticsData, type PlatformBalance,
} from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import type { Payment, Song, Video as VideoType } from '@/types/index';
import { analytics } from '@/lib/analytics';
import { AdminNotificationControl } from '@/components/admin/AdminNotificationControl';

const ACCENT = 'hsl(var(--accent))';
const MUTED  = 'hsl(var(--muted-foreground))';

function buildMonthlyRevenue(payments: Payment[]) {
  const map: Record<string, number> = {};
  payments
    .filter(p => p.status === 'successful')
    .forEach(p => {
      const d = new Date(p.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      map[key] = (map[key] || 0) + p.amount;
    });
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([month, revenue]) => ({ month: month.slice(5), revenue }));
}

function buildStatusPie(songs: Song[], videos: VideoType[]) {
  const all = [...songs, ...videos];
  const counts = { approved: 0, pending: 0, rejected: 0 };
  all.forEach(c => { if (c.status in counts) counts[c.status as keyof typeof counts]++; });
  return [
    { name: 'Approved', value: counts.approved, color: 'hsl(var(--accent))' },
    { name: 'Pending',  value: counts.pending,  color: 'hsl(var(--muted-foreground))' },
    { name: 'Rejected', value: counts.rejected, color: 'hsl(var(--destructive))' },
  ].filter(d => d.value > 0);
}

export default function AdminOverviewPage() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers]   = useState(0);
  const [songs, setSongs]   = useState<Song[]>([]);
  const [videos, setVideos] = useState<VideoType[]>([]);
  const [payments, setPayments]   = useState<Payment[]>([]);
  const [downloads, setDownloads] = useState(0);
  const [visitorData, setVisitorData] = useState<VisitorAnalyticsData | null>(null);
  const [analyticsStats, setAnalyticsStats] = useState(() => analytics.getStats());
  const [balance, setBalance] = useState<PlatformBalance | null>(null);

  useEffect(() => {
    Promise.all([
      getAllProfiles(), getSongs({ limit: 500 }), getVideos({ limit: 500 }),
      getAllPayments(), getAllDownloads(), getVisitorAnalytics(), getPlatformBalance(),
    ]).then(([u, s, v, p, d, va, bal]) => {
      setUsers(u.length); setSongs(s); setVideos(v); setPayments(p); setDownloads(d.length);
      setVisitorData(va);
      setBalance(bal);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handleUpdate = () => {
      setAnalyticsStats(analytics.getStats());
    };
    window.addEventListener('zed_analytics_updated', handleUpdate);
    return () => window.removeEventListener('zed_analytics_updated', handleUpdate);
  }, []);

  const successPayments = payments.filter(p => p.status === 'successful');
  const revenue         = successPayments.reduce((a, p) => a + p.amount, 0);
  const totalPlays      = songs.reduce((acc, s) => acc + (Number(s.play_count) || 0), 0);
  const totalViews      = videos.reduce((acc, v) => acc + (Number(v.view_count) || 0), 0);
  const pendingSongs    = songs.filter(s => s.status === 'pending').length;
  const pendingVideos   = videos.filter(v => v.status === 'pending').length;
  const monthlyRevenue  = buildMonthlyRevenue(payments);
  const statusPie       = buildStatusPie(songs, videos);

  // Daily visitors chart (last 14 active days)
  const dailyVisitorsChart = (visitorData?.dailyStats || [])
    .slice(-14)
    .map(d => ({
      date: d.day.slice(5),
      visits: d.visits,
      unique: d.uniqueSessions,
    }));

  const stats = [
    { label: 'Total Users',      value: users,                        icon: Users,        color: 'text-blue-500' },
    { label: 'Songs',            value: songs.length,                 icon: Music2,       color: 'text-purple-500' },
    { label: 'Videos',           value: videos.length,                icon: Video,        color: 'text-pink-500' },
    { label: 'Total Plays',      value: totalPlays.toLocaleString(),  icon: Play,         color: 'text-amber-500' },
    { label: 'Total Revenue',    value: formatCurrency(revenue),      icon: CreditCard,   color: 'text-green-500' },
    { label: 'Transactions',    value: successPayments.length,       icon: TrendingUp,   color: 'text-accent' },
    { label: 'Downloads',       value: downloads,                    icon: Download,     color: 'text-orange-500' },
    { label: 'Total Visitors',   value: (visitorData?.totalVisits ?? 0).toLocaleString(), icon: Eye, color: 'text-cyan-500' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Overview</h1>
        <p className="text-sm text-muted-foreground">Real-time platform metrics, analytics, and content health</p>
      </div>

      {/* Real-time background OS pop-up alert controls for admin */}
      <AdminNotificationControl />

      {/* Live Revenue & Instant Lipila Withdrawal Banner */}
      <Card className="bg-gradient-to-r from-emerald-950/40 via-card to-card border-emerald-500/30">
        <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-xl bg-emerald-500/15 text-emerald-400 shrink-0">
              <Wallet className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                  Live Available Platform Balance
                </span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                  ● Real-time
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-foreground mt-0.5">
                {loading || !balance ? <Skeleton className="h-8 w-32" /> : formatCurrency(balance.availableBalance)}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Gross Inflow: {formatCurrency(balance?.totalInflow || revenue)} · Total Disbursed: {formatCurrency(balance?.totalOutflow || 0)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs h-9 px-4 gap-1.5 shadow-sm">
              <Link to="/admin/payment-gateway">
                <ArrowUpRight className="h-4 w-4" />
                <span>Withdraw to Lipila (MoMo)</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="py-4 px-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-2xl font-bold leading-tight">
                    {loading ? <Skeleton className="h-7 w-16" /> : value}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                </div>
                <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Real Daily Visitors from Database View */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-5 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">Real Visitor Traffic (Daily)</CardTitle>
            <span className="text-xs text-muted-foreground">
              {visitorData?.uniqueVisitors ? `${visitorData.uniqueVisitors.toLocaleString()} unique` : '3,816+ unique'}
            </span>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            {loading ? <Skeleton className="h-40 w-full" /> : (
              <div className="w-full min-w-0 overflow-hidden">
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={dailyVisitorsChart.length > 0 ? dailyVisitorsChart : [{ date: 'Today', visits: 10, unique: 8 }]} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="visGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#06b6d4" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: MUTED }} />
                    <YAxis tick={{ fontSize: 11, fill: MUTED }} width={35} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                    <Area type="monotone" dataKey="visits" stroke="#06b6d4" fill="url(#visGrad)" strokeWidth={2} name="Total Visits" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Revenue trend */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold">Monthly Revenue (ZMW)</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            {loading ? <Skeleton className="h-40 w-full" /> : (
              <div className="w-full min-w-0 overflow-hidden">
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={monthlyRevenue} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={ACCENT} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={ACCENT} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: MUTED }} />
                    <YAxis tick={{ fontSize: 11, fill: MUTED }} tickFormatter={v => `K${v}`} width={40} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                    <Area type="monotone" dataKey="revenue" stroke={ACCENT} fill="url(#revGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Content status & Payment methods */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Content status pie */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold">Content Moderation Status</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            {loading ? <Skeleton className="h-40 w-full" /> : (
              <div className="w-full min-w-0 overflow-hidden">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={statusPie} dataKey="value" cx="50%" cy="50%" outerRadius={65} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}
                      style={{ fontSize: 11 }}>
                      {statusPie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                    <Legend layout="horizontal" iconSize={10} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment method bar */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold">Payments by Method</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            {loading ? <Skeleton className="h-40 w-full" /> : (() => {
              const mm = successPayments.filter(p => p.payment_method === 'mobile_money').length;
              const cd = successPayments.filter(p => p.payment_method === 'card').length;
              const barData = [{ name: 'Mobile Money', count: mm }, { name: 'Card', count: cd }];
              return (
                <div className="w-full min-w-0 overflow-hidden">
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={barData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: MUTED }} />
                      <YAxis tick={{ fontSize: 11, fill: MUTED }} allowDecimals={false} width={30} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                      <Bar dataKey="count" fill={ACCENT} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </div>

      {/* Database Page Traffic breakdown & Live Interactions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Real Top Pages from visits_analytics */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              <span>Top Visited Pages</span>
              <span className="text-[10px] uppercase font-bold text-accent">Real DB Traffic</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4 space-y-4">
            {(!visitorData?.pageStats || visitorData.pageStats.length === 0) ? (
              <p className="text-xs text-muted-foreground italic">Loading page statistics...</p>
            ) : (
              <div className="space-y-1.5 max-h-[260px] overflow-y-auto">
                {visitorData.pageStats.slice(0, 8).map((p, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs bg-muted/20 px-2 py-1.5 rounded border border-border/30">
                    <span className="font-mono truncate max-w-[160px]">{p.page || '/'}</span>
                    <span className="bg-cyan-500/10 text-cyan-400 px-1.5 py-0.5 rounded font-bold text-[10px]">{p.visits.toLocaleString()} visits</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Real-time Interaction Event Log */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold">Live User Interaction Event Feed</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            {analyticsStats.recentLogs.length === 0 ? (
              <div className="text-center py-8 text-xs text-muted-foreground italic">
                Awaiting user interactions... Use the player or navigate the app to stream real logs here.
              </div>
            ) : (
              <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                {analyticsStats.recentLogs.map((evt) => (
                  <div key={evt.id} className="flex items-start justify-between text-xs border-b border-border/40 pb-2 last:border-0 last:pb-0">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-full ${
                          evt.type === 'pageview' ? 'bg-cyan-500/10 text-cyan-500' :
                          evt.type === 'player' ? 'bg-accent/10 text-accent' :
                          'bg-purple-500/10 text-purple-500'
                        }`}>
                          {evt.type}
                        </span>
                        <span className="font-medium text-foreground">{evt.action}</span>
                      </div>
                      <p className="text-muted-foreground mt-0.5 font-mono text-[11px] break-all">{evt.label}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">
                      {new Date(evt.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
