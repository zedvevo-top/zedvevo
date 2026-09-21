import { useEffect, useState } from 'react';
import { Search, KeyRound, ShieldCheck, ShieldOff, Eye, EyeOff, Loader2, UserCog, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import { getAllProfiles, updateProfile } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { ARTIST_PLANS } from '@/constants';
import type { Profile, UserRole } from '@/types/index';

export default function AdminUsersPage() {
  const { profile: myProfile, user } = useAuth();
  const isSuperAdmin = myProfile?.role === 'super_admin';

  const [users, setUsers]     = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // Reset password dialog
  const [resetDialog, setResetDialog]       = useState(false);
  const [resetTarget, setResetTarget]       = useState<Profile | null>(null);
  const [resetPw, setResetPw]               = useState('');
  const [resetPwConfirm, setResetPwConfirm] = useState('');
  const [resetPwShow, setResetPwShow]       = useState(false);
  const [resetLoading, setResetLoading]     = useState(false);

  // Role dialog
  const [roleDialog, setRoleDialog]   = useState(false);
  const [roleTarget, setRoleTarget]   = useState<Profile | null>(null);
  const [newRole, setNewRole]         = useState<UserRole>('user');
  const [roleLoading, setRoleLoading] = useState(false);

  // Promote artist dialog
  const [promoteDialog, setPromoteDialog] = useState(false);
  const [promoteTarget, setPromoteTarget] = useState<Profile | null>(null);
  const [promotePlan, setPromotePlan] = useState<'daily' | 'weekly' | 'annual'>('weekly');
  const [promoteLoading, setPromoteLoading] = useState(false);

  useEffect(() => {
    getAllProfiles()
      .then(setUsers)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    const matchSearch = !q || u.username?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.display_name?.toLowerCase().includes(q);
    const matchRole   = roleFilter === 'all' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const openResetDialog = (u: Profile) => {
    setResetTarget(u); setResetPw(''); setResetPwConfirm(''); setResetPwShow(false); setResetDialog(true);
  };

  const handleResetPassword = async () => {
    if (!resetTarget) return;
    if (!resetPw)               { toast.error('Enter a new password'); return; }
    if (resetPw.length < 8)     { toast.error('Password must be at least 8 characters'); return; }
    if (resetPw !== resetPwConfirm) { toast.error('Passwords do not match'); return; }
    setResetLoading(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      const { data, error } = await supabase.functions.invoke('admin-reset-password', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: { user_id: resetTarget.id, new_password: resetPw },
      });
      if (error || data?.error) { toast.error(data?.error || error?.message || 'Reset failed'); return; }
      toast.success(`Password reset for ${resetTarget.username || resetTarget.email}`);
      setResetDialog(false);
    } catch (e: unknown) { toast.error((e as Error).message || 'Reset failed'); }
    finally { setResetLoading(false); }
  };

  const openRoleDialog = (u: Profile) => {
    setRoleTarget(u); setNewRole(u.role); setRoleDialog(true);
  };

  const handleChangeRole = async () => {
    if (!roleTarget) return;
    setRoleLoading(true);
    try {
      await updateProfile(roleTarget.id, { role: newRole });
      setUsers(prev => prev.map(u => u.id === roleTarget.id ? { ...u, role: newRole } : u));
      toast.success(`Role updated to ${newRole}`);
      setRoleDialog(false);
    } catch { toast.error('Failed to update role'); }
    finally { setRoleLoading(false); }
  };

  const openPromoteDialog = (u: Profile) => {
    setPromoteTarget(u);
    setPromotePlan('weekly');
    setPromoteDialog(true);
  };

  const handlePromoteArtist = async () => {
    if (!promoteTarget) return;
    setPromoteLoading(true);
    try {
      // Update profile to artist
      await updateProfile(promoteTarget.id, { role: 'artist', is_artist: true });

      // Create artist record if not exists
      const { data: existingArtist } = await supabase
        .from('artists')
        .select('id')
        .eq('user_id', promoteTarget.id)
        .single();

      if (!existingArtist) {
        await supabase.from('artists').insert({
          user_id: promoteTarget.id,
          stage_name: promoteTarget.display_name || promoteTarget.username || promoteTarget.email?.split('@')[0] || 'Artist',
        });
      }

      // Create subscription
      const plan = ARTIST_PLANS[promotePlan];
      const now = new Date();
      let endDate = new Date(now);
      if (promotePlan === 'daily') endDate.setDate(endDate.getDate() + 1);
      else if (promotePlan === 'weekly') endDate.setDate(endDate.getDate() + 7);
      else endDate.setFullYear(endDate.getFullYear() + 1);

      await supabase.from('artist_subscriptions').upsert({
        user_id: promoteTarget.id,
        plan: promotePlan,
        status: 'active',
        start_date: now.toISOString(),
        end_date: endDate.toISOString(),
        song_limit: plan.songLimit,
        upload_count: 0,
        price: 0,
        currency: 'ZMW',
      }, { onConflict: 'user_id,plan' });

      // Notify user
      await supabase.from('notifications').insert({
        user_id: promoteTarget.id,
        type: 'artist_activated',
        title: 'Artist Access Granted',
        message: `Admin has granted you ${plan.name} artist plan. You can now upload music!`,
        data: { plan: promotePlan },
      });

      setUsers(prev => prev.map(u => u.id === promoteTarget.id ? { ...u, role: 'artist', is_artist: true } : u));
      toast.success(`${promoteTarget.username || promoteTarget.email} is now an artist with ${plan.name} plan`);
      setPromoteDialog(false);
    } catch { toast.error('Failed to promote user to artist'); }
    finally { setPromoteLoading(false); }
  };

  const roleBadge = (role: string) => {
    if (role === 'super_admin') return <Badge className="text-[10px] bg-accent text-accent-foreground">Super Admin</Badge>;
    if (role === 'admin')       return <Badge className="text-[10px]">Admin</Badge>;
    if (role === 'artist')      return <Badge variant="default" className="text-[10px] bg-electric text-white">Artist</Badge>;
    return <Badge variant="secondary" className="text-[10px]">User</Badge>;
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">Users</h1>
        <p className="text-sm text-muted-foreground">{users.length} registered accounts</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search by username, email, name…" className="pl-9 h-8 text-sm"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="h-8 text-sm w-36">
            <SelectValue placeholder="All roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            <SelectItem value="user">User</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="super_admin">Super Admin</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted/40">
            <tr>
              {['Username', 'Email', 'Role', 'Joined', 'Actions'].map(h => (
                <th key={h} className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-t border-border">
                  <td colSpan={5} className="px-3 py-2"><Skeleton className="h-5 w-full" /></td>
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="py-10 text-center text-muted-foreground text-xs">No users found</td></tr>
            ) : filtered.map(u => (
              <tr key={u.id} className="border-t border-border hover:bg-muted/30">
                <td className="py-2.5 px-3 whitespace-nowrap font-medium">{u.username || '—'}</td>
                <td className="py-2.5 px-3 whitespace-nowrap text-muted-foreground text-xs">{u.email || '—'}</td>
                <td className="py-2.5 px-3 whitespace-nowrap">{roleBadge(u.role)}</td>
                <td className="py-2.5 px-3 whitespace-nowrap text-muted-foreground text-xs">{formatDate(u.created_at)}</td>
                <td className="py-2.5 px-3 whitespace-nowrap">
                  <div className="flex gap-1.5">
                    {/* Promote to Artist — admin/super_admin can promote any non-artist user */}
                    {u.role !== 'artist' && u.role !== 'super_admin' && (
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-electric border-electric hover:bg-electric/10"
                        onClick={() => openPromoteDialog(u)}>
                        <Mic className="h-3 w-3" /> Promote Artist
                      </Button>
                    )}
                    {/* Role management — super_admin only, can't change own role */}
                    {isSuperAdmin && u.id !== user?.id && (
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => openRoleDialog(u)}>
                        <UserCog className="h-3 w-3" />
                        Role
                      </Button>
                    )}
                    {/* Reset password — super_admin only, not own account */}
                    {isSuperAdmin && u.id !== user?.id && (
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => openResetDialog(u)}>
                        <KeyRound className="h-3 w-3" />
                        Reset PW
                      </Button>
                    )}
                    {/* Promote/demote quick actions for admins */}
                    {!isSuperAdmin && myProfile?.role === 'admin' && u.role === 'user' && (
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                        onClick={async () => {
                          await updateProfile(u.id, { role: 'admin' });
                          setUsers(p => p.map(x => x.id === u.id ? { ...x, role: 'admin' } : x));
                          toast.success('Promoted to Admin');
                        }}>
                        <ShieldCheck className="h-3 w-3" /> Promote
                      </Button>
                    )}
                    {!isSuperAdmin && myProfile?.role === 'admin' && u.role === 'admin' && u.id !== user?.id && (
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-destructive"
                        onClick={async () => {
                          await updateProfile(u.id, { role: 'user' });
                          setUsers(p => p.map(x => x.id === u.id ? { ...x, role: 'user' } : x));
                          toast.success('Demoted to User');
                        }}>
                        <ShieldOff className="h-3 w-3" /> Demote
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Reset Password Dialog */}
      <Dialog open={resetDialog} onOpenChange={setResetDialog}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4" />Reset Password</DialogTitle>
            <DialogDescription>Set a new password for <strong>{resetTarget?.username || resetTarget?.email}</strong>.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div>
              <Label>New Password</Label>
              <div className="relative mt-1">
                <Input type={resetPwShow ? 'text' : 'password'} className="pr-10" placeholder="Min. 8 characters"
                  value={resetPw} onChange={e => setResetPw(e.target.value)} />
                <button type="button" onClick={() => setResetPwShow(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {resetPwShow ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label>Confirm Password</Label>
              <Input type={resetPwShow ? 'text' : 'password'} className="mt-1" placeholder="Re-enter password"
                value={resetPwConfirm} onChange={e => setResetPwConfirm(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetDialog(false)}>Cancel</Button>
            <Button className="bg-accent hover:bg-accent/90 text-accent-foreground" onClick={handleResetPassword} disabled={resetLoading}>
              {resetLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Reset Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Role Dialog */}
      <Dialog open={roleDialog} onOpenChange={setRoleDialog}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UserCog className="h-4 w-4" />Change Role</DialogTitle>
            <DialogDescription>Update role for <strong>{roleTarget?.username || roleTarget?.email}</strong>.</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label>Role</Label>
            <Select value={newRole} onValueChange={v => setNewRole(v as UserRole)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="super_admin">Super Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleDialog(false)}>Cancel</Button>
            <Button className="bg-accent hover:bg-accent/90 text-accent-foreground" onClick={handleChangeRole} disabled={roleLoading}>
              {roleLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Promote Artist Dialog */}
      <Dialog open={promoteDialog} onOpenChange={setPromoteDialog}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Mic className="h-4 w-4" />Promote to Artist</DialogTitle>
            <DialogDescription>
              Grant artist access to <strong>{promoteTarget?.username || promoteTarget?.email}</strong> with a selected plan. They will be able to upload music immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-4">
            <div>
              <Label>Artist Plan</Label>
              <Select value={promotePlan} onValueChange={v => setPromotePlan(v as 'daily' | 'weekly' | 'annual')}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">
                    Daily — K{ARTIST_PLANS.daily.price} ({ARTIST_PLANS.daily.duration} day access, {ARTIST_PLANS.daily.songLimit === -1 ? 'unlimited' : ARTIST_PLANS.daily.songLimit} uploads)
                  </SelectItem>
                  <SelectItem value="weekly">
                    Weekly — K{ARTIST_PLANS.weekly.price} ({ARTIST_PLANS.weekly.duration} days access, {ARTIST_PLANS.weekly.songLimit === -1 ? 'unlimited' : ARTIST_PLANS.weekly.songLimit} uploads)
                  </SelectItem>
                  <SelectItem value="annual">
                    Annual — K{ARTIST_PLANS.annual.price} ({ARTIST_PLANS.annual.duration} year access, {ARTIST_PLANS.annual.songLimit === -1 ? 'unlimited' : ARTIST_PLANS.annual.songLimit} uploads)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">What happens:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>User profile role set to <span className="text-electric font-medium">Artist</span></li>
                <li>Artist record created if not exists</li>
                <li>Selected plan subscription activated</li>
                <li>User receives in-app notification</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPromoteDialog(false)}>Cancel</Button>
            <Button className="bg-electric hover:bg-electric/90 text-white" onClick={handlePromoteArtist} disabled={promoteLoading}>
              {promoteLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Promote to Artist
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
