import { useEffect, useState } from 'react';
import { Bell, Plus, Loader2, Activity, Smartphone, CheckCircle, AlertCircle, RefreshCw, Trash2, Terminal, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/db/supabase';
import { createNotification } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import type { Notification } from '@/types/index';
import { pushDiagnosticStore, type PushLogEntry, type AndroidSessionMetrics } from '@/services/pushDiagnosticStore';
import { showAdminPopNotification } from '@/services/adminNotificationService';

type NotifType = 'info' | 'success' | 'warning' | 'error';

export default function AdminNotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState<NotifType>('info');
  const [sending, setSending] = useState(false);

  // Push Diagnostics state
  const [logs, setLogs] = useState<PushLogEntry[]>(pushDiagnosticStore.getLogs());
  const [metrics, setMetrics] = useState<AndroidSessionMetrics>(pushDiagnosticStore.getMetrics());
  const [logFilter, setLogFilter] = useState<'all' | 'realtime' | 'deliver' | 'error'>('all');

  useEffect(() => {
    // Subscribe to live push diagnostic updates
    const unsubscribe = pushDiagnosticStore.subscribe(() => {
      setLogs([...pushDiagnosticStore.getLogs()]);
      setMetrics(pushDiagnosticStore.getMetrics());
    });

    (async () => {
      try {
        const { data } = await supabase
          .from('notifications')
          .select('*')
          .is('user_id', null)
          .order('created_at', { ascending: false })
          .limit(50);
        setNotifications((data ?? []) as Notification[]);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      unsubscribe();
    };
  }, []);

  const handleSend = async () => {
    if (!title || !message) {
      toast.error('Title and message required');
      return;
    }
    setSending(true);
    try {
      await createNotification({ title, message, type, notification_type: 'general' });
      pushDiagnosticStore.addLog('deliver_success', 'AdminBroadcast', `Broadcast notification sent: ${title}`, { title, message });
      toast.success('Broadcast sent to all users');
      // Refresh list
      const { data } = await supabase.from('notifications').select('*').is('user_id', null).order('created_at', { ascending: false }).limit(50);
      setNotifications((data ?? []) as Notification[]);
      setTitle('');
      setMessage('');
    } catch {
      pushDiagnosticStore.addLog('deliver_fail', 'AdminBroadcast', `Failed to send broadcast notification: ${title}`);
      toast.error('Failed to send');
    } finally {
      setSending(false);
    }
  };

  const handleTestTestPush = async () => {
    const testTitle = '🔔 Android Diagnostic Push Test';
    const testBody = `Service Worker & Realtime test at ${new Date().toLocaleTimeString()}`;
    pushDiagnosticStore.addLog('sw_event', 'ManualTest', 'Triggering manual diagnostic test push notification');

    void showAdminPopNotification(testTitle, {
      body: testBody,
      icon: '/app-icon.png',
      tag: `test-${Date.now()}`,
      data: { url: '/admin/notifications' },
    });
    toast.info('Test push notification dispatched to browser/OS');
  };

  const filteredLogs = logs.filter((log) => {
    if (logFilter === 'realtime') return log.type === 'realtime_event';
    if (logFilter === 'deliver') return log.type === 'deliver_success';
    if (logFilter === 'error') return log.type === 'error' || log.type === 'deliver_fail';
    return true;
  });

  const typeColor = (t: string) => {
    if (t === 'success') return 'default';
    if (t === 'error') return 'destructive';
    return 'secondary';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Notifications & Android Push Diagnostics</h1>
        <p className="text-sm text-muted-foreground">
          Manage system broadcasts and monitor real-time Android device push delivery status
        </p>
      </div>

      <Tabs defaultValue="diagnostics" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 bg-muted/60 p-1 rounded-xl">
          <TabsTrigger value="diagnostics" className="gap-2 text-xs font-bold">
            <Activity className="h-3.5 w-3.5 text-accent" />
            Android Push Panel
          </TabsTrigger>
          <TabsTrigger value="broadcasts" className="gap-2 text-xs font-bold">
            <Bell className="h-3.5 w-3.5 text-primary" />
            Send Broadcast
          </TabsTrigger>
        </TabsList>

        {/* DIAGNOSTICS PANEL TAB */}
        <TabsContent value="diagnostics" className="space-y-6 pt-4">
          {/* Status Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl border border-border bg-card shadow-sm space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium">Service Worker Status</span>
                <Smartphone className="h-4 w-4 text-accent" />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className="text-lg font-black capitalize text-foreground">{metrics.swStatus}</span>
              </div>
              <p className="text-[11px] text-muted-foreground truncate">{metrics.deviceInfo}</p>
            </div>

            <div className="p-4 rounded-2xl border border-border bg-card shadow-sm space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium">Total Realtime Events</span>
                <Activity className="h-4 w-4 text-cyan-400" />
              </div>
              <div className="text-2xl font-black text-foreground pt-1">{metrics.totalEvents}</div>
              <p className="text-[11px] text-muted-foreground">Session: {metrics.sessionId}</p>
            </div>

            <div className="p-4 rounded-2xl border border-border bg-card shadow-sm space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium">Delivered / Success</span>
                <CheckCircle className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-black text-emerald-500 pt-1">{metrics.successCount}</div>
              <p className="text-[11px] text-muted-foreground">Active push triggers</p>
            </div>

            <div className="p-4 rounded-2xl border border-border bg-card shadow-sm space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium">Delivery Failures</span>
                <AlertCircle className="h-4 w-4 text-destructive" />
              </div>
              <div className="text-2xl font-black text-destructive pt-1">{metrics.failCount}</div>
              <p className="text-[11px] text-muted-foreground">Unreachable device states</p>
            </div>
          </div>

          {/* Diagnostic Controls & Live Log Stream */}
          <div className="border border-border rounded-2xl bg-card p-5 space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
              <div className="flex items-center gap-2">
                <Terminal className="h-5 w-5 text-accent" />
                <div>
                  <h3 className="text-sm font-bold text-foreground">Universal Notification Trace Logs</h3>
                  <p className="text-xs text-muted-foreground">Live real-time push event stream from UniversalNotificationListener</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="h-8 text-xs font-semibold gap-1.5" onClick={handleTestTestPush}>
                  <Bell className="h-3.5 w-3.5 text-accent" />
                  Test Push
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs text-muted-foreground hover:text-destructive gap-1"
                  onClick={() => pushDiagnosticStore.clearLogs()}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear Logs
                </Button>
              </div>
            </div>

            {/* Log Filter Pills */}
            <div className="flex items-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setLogFilter('all')}
                className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                  logFilter === 'all' ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                All Logs ({logs.length})
              </button>
              <button
                type="button"
                onClick={() => setLogFilter('realtime')}
                className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                  logFilter === 'realtime' ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                Realtime ({logs.filter((l) => l.type === 'realtime_event').length})
              </button>
              <button
                type="button"
                onClick={() => setLogFilter('deliver')}
                className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                  logFilter === 'deliver' ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                Delivered ({logs.filter((l) => l.type === 'deliver_success').length})
              </button>
              <button
                type="button"
                onClick={() => setLogFilter('error')}
                className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                  logFilter === 'error' ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                Errors ({logs.filter((l) => l.type === 'error' || l.type === 'deliver_fail').length})
              </button>
            </div>

            {/* Terminal Console Output */}
            <div className="bg-slate-950 text-slate-200 rounded-xl p-4 font-mono text-xs max-h-[380px] overflow-y-auto space-y-2 border border-slate-800 shadow-inner">
              {filteredLogs.length === 0 ? (
                <div className="py-8 text-center text-slate-500">
                  <Activity className="h-6 w-6 mx-auto mb-2 opacity-40 animate-pulse" />
                  No push diagnostic events logged yet. Trigger an action or click "Test Push".
                </div>
              ) : (
                filteredLogs.map((log) => {
                  const isErr = log.type === 'error' || log.type === 'deliver_fail';
                  const isSuccess = log.type === 'deliver_success';
                  const isRealtime = log.type === 'realtime_event';

                  return (
                    <div key={log.id} className="flex items-start gap-2 border-b border-slate-900/80 pb-1.5 last:border-0">
                      <span className="text-slate-500 shrink-0 select-none">[{log.timestamp}]</span>
                      <span
                        className={`px-1.5 py-0.2 rounded text-[10px] uppercase font-bold shrink-0 ${
                          isErr
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                            : isSuccess
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : isRealtime
                            ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {log.source}
                      </span>
                      <span className={`flex-1 break-words ${isErr ? 'text-red-300' : isSuccess ? 'text-emerald-300' : 'text-slate-200'}`}>
                        {log.message}
                      </span>
                      {log.details && (
                        <span className="text-[10px] text-slate-500 truncate max-w-[150px] hidden sm:inline-block">
                          {JSON.stringify(log.details)}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </TabsContent>

        {/* BROADCAST COMPOSE TAB */}
        <TabsContent value="broadcasts" className="space-y-6 pt-4">
          <div className="max-w-lg space-y-4 border border-border bg-card rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-accent" />
              <p className="text-sm font-semibold">New Broadcast</p>
            </div>
            <div>
              <Label>Title *</Label>
              <Input
                className="mt-1"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Platform Update"
              />
            </div>
            <div>
              <Label>Message *</Label>
              <Textarea
                className="mt-1 resize-none"
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Notification message…"
              />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as NotifType)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="error">Error / Alert</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              className="bg-accent hover:bg-accent/90 text-accent-foreground gap-1.5 w-full font-bold"
              onClick={handleSend}
              disabled={sending}
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
              Send Broadcast to All Devices
            </Button>
          </div>

          <div>
            <p className="text-sm font-semibold mb-3">Recent Broadcasts</p>
            <div className="overflow-x-auto rounded-2xl border border-border bg-card">
              <table className="w-full min-w-[480px] text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    {['Title', 'Message', 'Type', 'Sent'].map((h) => (
                      <th
                        key={h}
                        className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-2">
                        <Skeleton className="h-5 w-full" />
                      </td>
                    </tr>
                  ) : notifications.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-muted-foreground text-xs">
                        No broadcasts sent yet
                      </td>
                    </tr>
                  ) : (
                    notifications.map((n) => (
                      <tr key={n.id} className="border-t border-border hover:bg-muted/30">
                        <td className="py-2.5 px-3 whitespace-nowrap font-medium max-w-[160px] truncate">
                          {n.title}
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground text-xs max-w-[200px] truncate">
                          {n.message}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <Badge variant={typeColor(n.type)} className="text-[10px] capitalize">
                            {n.type}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap text-muted-foreground text-xs">
                          {formatDate(n.created_at)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
