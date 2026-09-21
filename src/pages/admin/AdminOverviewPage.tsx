import { useEffect, useState } from 'react';
import {
  Users, Music2, Video, CreditCard, TrendingUp, Download, Trophy, CheckCircle2,
  Eye,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  getAllProfiles, getSongs, getVideos, getAllPayments, getAllDownloads,
  getVisitorCount, incrementVisitorCount,
} from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import type { Payment } from '@/types/index';

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

function buildStatusPie(songs: { status: string }[], videos: { status: string }[]) {
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
  const [songs, setSongs]   = useState<{ status: string }[]>([]);
  const [videos, setVideos] = useState<{ status: string }[]>([]);
  const [payments, setPayments]   = useState<Payment[]>([]);
  const [downloads, setDownloads] = useState(0);
  const [visitors, setVisitors]   = useState(0);

  useEffect(() => {
    Promise.all([
      getAllProfiles(), getSongs({ limit: 500 }), getVideos({ limit: 500 }),
      getAllPayments(), getAllDownloads(),
    ]).then(([u, s, v, p, d]) => {
      setUsers(u.length); setSongs(s); setVideos(v); setPayments(p); setDownloads(d.length);
    }).catch(console.error).finally(() => setLoading(false));

    // Increment visitor count and fetch updated total
    incrementVisitorCount()
      .then(count => setVisitors(count))
      .catch(() => getVisitorCount().then(setVisitors).catch(console.error));
  }, []);

  const successPayments = payments.filter(p => p.status === 'successful');
  const revenue         = successPayments.reduce((a, p) => a + p.amount, 0);
  const pendingSongs    = songs.filter(s => s.status === 'pending').length;
  const pendingVideos   = videos.filter(v => v.status === 'pending').length;
  const monthlyRevenue  = buildMonthlyRevenue(payments);
  const statusPie       = buildStatusPie(songs, videos);

  const stats = [
    { label: 'Total Users',      value: users,                        icon: Users,        color: 'text-blue-500' },
    { label: 'Songs',            value: songs.length,                 icon: Music2,       color: 'text-purple-500' },
    { label: 'Videos',           value: videos.length,                icon: Video,        color: 'text-pink-500' },
    { label: 'Total Revenue',    value: formatCurrency(revenue),      icon: CreditCard,   color: 'text-green-500' },
    { label: 'Transactions',    value: successPayments.length,       icon: TrendingUp,   color: 'text-accent' },
    { label: 'Downloads',       value: downloads,                    icon: Download,     color: 'text-orange-500' },
    { label: 'Pending Content', value: pendingSongs + pendingVideos, icon: CheckCircle2, color: 'text-yellow-500' },
    { label: 'Visitors',         value: visitors,                     icon: Eye,          color: 'text-cyan-500' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Overview</h1>
        <p className="text-sm text-muted-foreground">Platform snapshot at a glance</p>
      </div>

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

        {/* Content status pie */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold">Content Status</CardTitle>
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
      </div>

      {/* Payment method bar */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-5">
          <CardTitle className="text-sm font-semibold">Payments by Method</CardTitle>
        </CardHeader>
        <CardContent className="px-2 pb-4">
          {loading ? <Skeleton className="h-32 w-full" /> : (() => {
            const mm = successPayments.filter(p => p.payment_method === 'mobile_money').length;
            const cd = successPayments.filter(p => p.payment_method === 'card').length;
            const barData = [{ name: 'Mobile Money', count: mm }, { name: 'Card', count: cd }];
            return (
              <div className="w-full min-w-0 overflow-hidden">
                <ResponsiveContainer width="100%" height={140}>
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
  );
}
