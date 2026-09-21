import { useEffect, useState } from 'react';
import { Bell, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/db/supabase';
import { createNotification } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import type { Notification } from '@/types/index';

type NotifType = 'info' | 'success' | 'warning' | 'error';

export default function AdminNotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading]   = useState(true);

  const [title, setTitle]   = useState('');
  const [message, setMessage] = useState('');
  const [type, setType]     = useState<NotifType>('info');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from('notifications')
          .select('*')
          .is('user_id', null)
          .order('created_at', { ascending: false })
          .limit(50);
        setNotifications((data ?? []) as Notification[]);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  const handleSend = async () => {
    if (!title || !message) { toast.error('Title and message required'); return; }
    setSending(true);
    try {
      await createNotification({ title, message, type, notification_type: 'general' });
      toast.success('Broadcast sent to all users');
      // Refresh list
      const { data } = await supabase.from('notifications').select('*').is('user_id', null).order('created_at', { ascending: false }).limit(50);
      setNotifications((data ?? []) as Notification[]);
      setTitle(''); setMessage('');
    } catch { toast.error('Failed to send'); }
    finally { setSending(false); }
  };

  const typeColor = (t: string) => {
    if (t === 'success') return 'default';
    if (t === 'error')   return 'destructive';
    return 'secondary';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Notifications</h1>
        <p className="text-sm text-muted-foreground">Send broadcast notifications to all users</p>
      </div>

      {/* Compose */}
      <div className="max-w-lg space-y-4 border border-border rounded-lg p-5">
        <div className="flex items-center gap-2">
          <Plus className="h-4 w-4 text-accent" />
          <p className="text-sm font-semibold">New Broadcast</p>
        </div>
        <div><Label>Title *</Label><Input className="mt-1" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Platform Update" /></div>
        <div><Label>Message *</Label><Textarea className="mt-1 resize-none" rows={3} value={message} onChange={e => setMessage(e.target.value)} placeholder="Notification message…" /></div>
        <div>
          <Label>Type</Label>
          <Select value={type} onValueChange={v => setType(v as NotifType)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="error">Error / Alert</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button className="bg-accent hover:bg-accent/90 text-accent-foreground gap-1.5" onClick={handleSend} disabled={sending}>
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
          Send to All Users
        </Button>
      </div>

      {/* History */}
      <div>
        <p className="text-sm font-semibold mb-3">Recent Broadcasts</p>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="bg-muted/40">
              <tr>{['Title', 'Message', 'Type', 'Sent'].map(h => (
                <th key={h} className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={4} className="px-3 py-2"><Skeleton className="h-5 w-full" /></td></tr>
              : notifications.length === 0 ? <tr><td colSpan={4} className="py-8 text-center text-muted-foreground text-xs">No broadcasts sent yet</td></tr>
              : notifications.map(n => (
                <tr key={n.id} className="border-t border-border hover:bg-muted/30">
                  <td className="py-2.5 px-3 whitespace-nowrap font-medium max-w-[160px] truncate">{n.title}</td>
                  <td className="py-2.5 px-3 text-muted-foreground text-xs max-w-[200px] truncate">{n.message}</td>
                  <td className="py-2.5 px-3 whitespace-nowrap"><Badge variant={typeColor(n.type)} className="text-[10px] capitalize">{n.type}</Badge></td>
                  <td className="py-2.5 px-3 whitespace-nowrap text-muted-foreground text-xs">{formatDate(n.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
