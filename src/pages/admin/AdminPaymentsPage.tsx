import { useEffect, useState } from 'react';
import { Search, Download, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { getAllPayments, applyPaymentBenefits } from '@/lib/api';
import { formatDate, formatCurrency, getPaymentStatusColor, getPaymentStatusLabel } from '@/lib/utils';
import type { Payment } from '@/types/index';
import { toast } from 'sonner';

type StatusFilter = 'all' | 'successful' | 'pending' | 'failed' | 'cancelled';
type MethodFilter = 'all' | 'mobile_money' | 'card';

export default function AdminPaymentsPage() {
  const [payments, setPayments]   = useState<Payment[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [methodFilter, setMethodFilter] = useState<MethodFilter>('all');

  useEffect(() => {
    getAllPayments()
      .then(setPayments)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleRefreshPayments = async () => {
    setRefreshing(true);
    const toastId = toast.loading('Syncing and verifying payment gateways...');
    try {
      const fresh = await getAllPayments();
      setPayments(fresh);
      toast.dismiss(toastId);
      toast.success('Payments Refreshed Successfully!', {
        description: `Verified ${fresh.length} transactions from gateway and database.`
      });
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error('Failed to refresh payments: ' + err.message);
    } finally {
      setRefreshing(false);
    }
  };

  const filtered = payments.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q || p.lipila_transaction_id?.toLowerCase().includes(q) || p.user_id?.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    const matchMethod = methodFilter === 'all' || p.payment_method === methodFilter;
    return matchSearch && matchStatus && matchMethod;
  });

  const totalRevenue = payments.filter(p => p.status === 'successful').reduce((a, p) => a + p.amount, 0);
  const successCount = payments.filter(p => p.status === 'successful').length;

  const exportCsv = () => {
    const rows = [
      ['Date', 'Type', 'Method', 'Amount', 'Status', 'Transaction ID'],
      ...filtered.map(p => [
        formatDate(p.created_at), p.payment_type, p.payment_method,
        p.amount, p.status, p.lipila_transaction_id || '',
      ]),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const a = document.createElement('a'); a.href = 'data:text/csv,' + encodeURIComponent(csv);
    a.download = 'payments.csv'; a.click();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold">Payments</h1>
          <p className="text-sm text-muted-foreground">
            {successCount} successful · Total revenue {formatCurrency(totalRevenue)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs border-accent/40 text-accent hover:bg-accent/10" onClick={handleRefreshPayments} disabled={refreshing}>
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh Payments'}
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" onClick={exportCsv}>
            <Download className="h-3.5 w-3.5" />Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search by transaction ID or user…" className="pl-9 h-8 text-sm"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="h-8 text-sm w-36"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="successful">Successful</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={methodFilter} onValueChange={v => setMethodFilter(v as MethodFilter)}>
          <SelectTrigger className="h-8 text-sm w-36"><SelectValue placeholder="All methods" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All methods</SelectItem>
            <SelectItem value="mobile_money">Mobile Money</SelectItem>
            <SelectItem value="card">Card</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[680px] text-sm">
          <thead className="bg-muted/40">
            <tr>
              {['Date', 'Type', 'Method', 'Amount', 'Status', 'Transaction ID', 'Actions'].map(h => (
                <th key={h} className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? Array.from({ length: 8 }).map((_, i) => (
              <tr key={i} className="border-t border-border">
                <td colSpan={7} className="px-3 py-2"><Skeleton className="h-5 w-full" /></td>
              </tr>
            )) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="py-10 text-center text-muted-foreground text-xs">No payments found</td></tr>
            ) : filtered.map(p => (
              <tr key={p.id} className="border-t border-border hover:bg-muted/30">
                <td className="py-2.5 px-3 whitespace-nowrap text-muted-foreground text-xs">{formatDate(p.created_at)}</td>
                <td className="py-2.5 px-3 whitespace-nowrap capitalize">{(p.payment_type || '').replace('_', ' ')}</td>
                <td className="py-2.5 px-3 whitespace-nowrap">
                  <Badge variant="outline" className="text-[10px] capitalize">{(p.payment_method || 'lipila').replace('_', ' ')}</Badge>
                </td>
                <td className="py-2.5 px-3 whitespace-nowrap font-semibold">{formatCurrency(p.amount)}</td>
                <td className="py-2.5 px-3 whitespace-nowrap">
                  <span className={`text-xs font-medium ${getPaymentStatusColor(p.status)}`}>{getPaymentStatusLabel(p.status)}</span>
                </td>
                <td className="py-2.5 px-3 whitespace-nowrap text-muted-foreground text-[10px] font-mono">{p.lipila_transaction_id || '—'}</td>
                <td className="py-2.5 px-3 whitespace-nowrap">
                  <div className="flex gap-1.5">
                    {p.status !== 'successful' && (
                      <Button size="sm" variant="default" className="h-6 text-[10px] bg-accent text-accent-foreground hover:bg-accent/90" onClick={async () => {
                        try {
                          const { supabase } = await import('@/db/supabase');
                          const { error } = await supabase.from('payments').update({
                            status: 'successful',
                            updated_at: new Date().toISOString(),
                          }).eq('id', p.id);
                          if (error) throw error;
                          
                          // 1. Run universal benefits handler (handles subscriptions, votes, nominees)
                          await applyPaymentBenefits(p.id);

                          // Check if payment is related to upload / plan / artist access
                          const isUploadPayment = 
                            p.payment_type === 'plan' || 
                            p.payment_type === 'upload' || 
                            p.payment_type === 'subscription' || 
                            p.payment_type === 'artist_subscription' ||
                            p.payment_type === 'upload_plan' ||
                            !!p.plan_id || 
                            !!p.metadata?.plan_id || 
                            !!p.metadata?.plan_type ||
                            (p.metadata?.type as string)?.includes('upload') ||
                            (p.metadata?.item_type as string)?.includes('upload') ||
                            p.amount === 10 || p.amount === 15 || p.amount === 100 || p.amount === 300;

                          if (isUploadPayment && p.user_id) {
                            // Fetch user's registered details from profiles
                            const { data: userProfile } = await supabase
                              .from('profiles')
                              .select('*')
                              .eq('id', p.user_id)
                              .maybeSingle();

                            const registeredArtistName = userProfile?.display_name || 
                                                         (userProfile as any)?.full_name || 
                                                         userProfile?.username || 
                                                         userProfile?.email?.split('@')[0] || 
                                                         'Artist';

                            // Always upgrade user to artist and grant active upload entitlement
                            await supabase
                              .from('profiles')
                              .update({
                                is_artist: true,
                                role: (userProfile?.role === 'admin' || userProfile?.role === 'super_admin') ? userProfile.role : 'artist',
                                upload_access: 'active',
                                updated_at: new Date().toISOString()
                              })
                              .eq('id', p.user_id);

                            // Always ensure artist record is created/updated with their registered details
                            await supabase.from('artists').upsert({
                              user_id: p.user_id,
                              name: registeredArtistName,
                              stage_name: registeredArtistName,
                              bio: userProfile?.bio || undefined,
                              avatar_url: userProfile?.avatar_url || undefined,
                              updated_at: new Date().toISOString()
                            }, { onConflict: 'user_id' });

                            // Activate user subscription
                            let planType = (p.metadata?.plan_type as string) || 'k10_single';
                            if (p.metadata?.plan_id === 'daily' || planType === 'daily') planType = 'k10_single';
                            else if (p.metadata?.plan_id === 'weekly' || planType === 'weekly') planType = 'k100_weekly';
                            else if (p.metadata?.plan_id === 'annual' || planType === 'yearly' || planType === 'annual') planType = 'k300_yearly';

                            const isOneTime = planType === 'k10_single';
                            const validityDays = planType === 'k300_yearly' ? 365 : planType === 'k100_weekly' ? 7 : 30;
                            const endDate = new Date(Date.now() + validityDays * 86400000).toISOString();

                            await supabase.from('user_subscriptions')
                              .update({ is_active: false, status: 'inactive' })
                              .eq('user_id', p.user_id);

                            await supabase.from('user_subscriptions').insert({
                              user_id: p.user_id,
                              plan_id: p.plan_id || p.metadata?.plan_id || '00000000-0000-0000-0000-000000000001',
                              plan_type: planType,
                              uploads_used: 0,
                              uploads_allowed: isOneTime ? 1 : null,
                              activated_at: new Date().toISOString(),
                              expires_at: endDate,
                              is_active: true,
                              status: 'active',
                              consumed: false
                            });

                            await supabase.from('artist_subscriptions').upsert({
                              user_id: p.user_id,
                              plan: planType === 'k100_weekly' ? 'weekly' : planType === 'k300_yearly' ? 'annual' : 'daily',
                              status: 'active',
                              start_date: new Date().toISOString(),
                              end_date: endDate,
                              song_limit: isOneTime ? 1 : -1,
                              upload_count: 0,
                              price: p.amount,
                              currency: 'ZMW',
                              payment_id: p.id
                            }, { onConflict: 'user_id,plan' });

                            // Send in-app notification
                            try {
                              await supabase.from('notifications').insert({
                                user_id: p.user_id,
                                title: 'Upload Plan & Artist Account Activated',
                                message: `Admin approved your payment. You are now an active artist (${registeredArtistName}) with full upload access!`,
                                type: 'info',
                                notification_type: 'subscription_activated'
                              });
                            } catch { /* ignore notification failure */ }

                            toast.success(`Payment approved! ${registeredArtistName} upgraded to artist with active upload access.`);
                          } 
                          // 2. If it's a vote payment
                          else if (p.payment_type === 'vote' && p.metadata?.nominee_id) {
                            const nomineeId = p.metadata.nominee_id;
                            const voteCount = p.metadata.vote_count || Math.max(1, Math.floor(p.amount / 5));
                            
                            const { data: existingVote } = await supabase
                              .from('votes')
                              .select('id')
                              .eq('payment_id', p.id)
                              .maybeSingle();

                            if (!existingVote) {
                              await supabase.from('votes').insert({
                                nominee_id: nomineeId,
                                user_id: p.user_id || null,
                                payment_id: p.id,
                                vote_count: voteCount,
                              });

                              const { data: nom } = await supabase
                                .from('nominees')
                                .select('total_votes')
                                .eq('id', nomineeId)
                                .single();
                              
                              const newTotal = (nom?.total_votes || 0) + voteCount;
                              await supabase
                                .from('nominees')
                                .update({ total_votes: newTotal })
                                .eq('id', nomineeId);
                            }
                            toast.success(`Payment approved and ${voteCount} votes added to nominee!`);
                          } 
                          // 3. If it's nominee registration
                          else if (p.payment_type === 'nominee_registration' && p.metadata?.nominee_id) {
                            await supabase.from('nominees').update({
                              registration_status: 'completed',
                              nomination_status: 'approved',
                            }).eq('id', p.metadata.nominee_id);
                            toast.success('Payment approved and nominee registration confirmed!');
                          } 
                          else {
                            toast.success('Payment successfully marked as approved');
                          }
                          
                          setPayments(prev => prev.map(pay => pay.id === p.id ? { ...pay, status: 'successful' } : pay));
                        } catch (err: any) {
                          toast.error(err.message || 'Failed to approve');
                        }
                      }}>Approve</Button>
                    )}
                    {p.status === 'pending' && (
                      <Button size="sm" variant="destructive" className="h-6 text-[10px]" onClick={async () => {
                        try {
                          const { supabase } = await import('@/db/supabase');
                          const { error } = await supabase.from('payments').update({
                            status: 'failed',
                            updated_at: new Date().toISOString(),
                          }).eq('id', p.id);
                          if (error) throw error;
                          import('sonner').then(m => m.toast.success('Payment rejected/marked as failed'));
                          setPayments(prev => prev.map(pay => pay.id === p.id ? { ...pay, status: 'failed' } : pay));
                        } catch (err: any) {
                          import('sonner').then(m => m.toast.error(err.message || 'Failed to reject'));
                        }
                      }}>Reject</Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">Showing {filtered.length} of {payments.length} payments</p>
    </div>
  );
}
