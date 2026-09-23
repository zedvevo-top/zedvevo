import BackToHome from '@/components/common/BackToHome';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import ArtistEarningsOverview from '@/components/artist/ArtistEarningsOverview';
import { Music2, Video, CreditCard, Trophy, Bell, BarChart2, Loader2,
  Pencil, Trash2, Upload, CheckCircle2, XCircle, Clock, TrendingUp, Lock, Mail, Calendar, ShieldCheck, Sparkles
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import type { Song, Video as VideoType, Payment, UserSubscription, Nominee, Vote, Notification } from '@/types/index';
import {
  getSongs, getVideos, getUserPayments, getUserSubscriptions,
  getUserNominations, getUserVotes, getUserNotifications,
  deleteSong, deleteVideo, markNotificationRead, updateProfile, uploadFile,
  getUserWallet, getUserWalletTransactions, getUserWithdrawals, requestUserWithdrawal
} from '@/lib/api';
import { storageService } from '@/services/storageService';
import { supabase } from '@/db/supabase';
import { formatDate, formatCurrency, getPaymentStatusColor, getPaymentStatusLabel } from '@/lib/utils';
import { Navigate } from 'react-router-dom';

export default function DashboardPage() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [songs, setSongs] = useState<Song[]>([]);
  const [videos, setVideos] = useState<VideoType[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [subscriptions, setSubscriptions] = useState<UserSubscription[]>([]);
  const [nominations, setNominations] = useState<Nominee[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Wallet States
  const [wallet, setWallet] = useState<any>(null);
  const [walletTx, setWalletTx] = useState<any[]>([]);
  const [userWithdrawals, setUserWithdrawals] = useState<any[]>([]);
  const [wdDialog, setWdDialog] = useState(false);
  const [wdAmount, setWdAmount] = useState('');
  const [wdMethod, setWdMethod] = useState<'mtn' | 'airtel' | 'zamtel' | 'bank'>('mtn');
  const [wdPhone, setWdPhone] = useState('');
  const [wdBankName, setWdBankName] = useState('');
  const [wdAccountNo, setWdAccountNo] = useState('');
  const [wdAccountName, setWdAccountName] = useState('');
  const [wdSubmitting, setWdSubmitting] = useState(false);

  // Edit profile
  const [editDialog, setEditDialog] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  // Edit content dialog
  const [editSong, setEditSong] = useState<Song | null>(null);
  const [editSongTitle, setEditSongTitle] = useState('');
  const [editSongArtist, setEditSongArtist] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      try {
        const [s, v, p, sub, nom, vot, notif, w, wt, wd] = await Promise.all([
          getSongs({ userId: user.id }),
          getVideos({ userId: user.id }),
          getUserPayments(user.id),
          getUserSubscriptions(user.id),
          getUserNominations(user.id),
          getUserVotes(user.id),
          getUserNotifications(user.id),
          getUserWallet(user.id),
          getUserWalletTransactions(user.id),
          getUserWithdrawals(user.id),
        ]);
        setSongs(s); setVideos(v); setPayments(p);
        setSubscriptions(sub); setNominations(nom); setVotes(vot); setNotifications(notif);
        setWallet(w); setWalletTx(wt); setUserWithdrawals(wd);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, [user]);

  if (!user) return <Navigate to="/login" replace />;

  const activeSub = subscriptions.find(s => s.is_active);
  const unreadCount = notifications.filter(n => !n.is_read).length;

  const handleSaveProfile = async () => {
    if (!user || !profile) return;
    setSaving(true);
    try {
      let avatarUrl = profile.avatar_url;
      if (avatarFile) {
        const uploadRes = await storageService.uploadProfilePicture(avatarFile, user.id);
        if (uploadRes.success && uploadRes.url) {
          avatarUrl = uploadRes.url;
        } else {
          avatarUrl = await uploadFile('avatars', `${user.id}/avatar_${Date.now()}.${avatarFile.name.split('.').pop()}`, avatarFile);
        }
      }
      await updateProfile(user.id, { display_name: displayName, bio, avatar_url: avatarUrl || undefined });
      await refreshProfile();
      toast.success('Profile updated successfully');
      setEditDialog(false);
      setAvatarFile(null);
    } catch { toast.error('Failed to update profile'); }
    finally { setSaving(false); }
  };

  const openEditProfile = () => {
    setDisplayName(profile?.display_name || '');
    setBio(profile?.bio || '');
    setAvatarFile(null);
    setEditDialog(true);
  };

  const handleDeleteSong = async (id: string) => {
    if (!confirm('Delete this song?')) return;
    try { await deleteSong(id); setSongs(prev => prev.filter(s => s.id !== id)); toast.success('Song deleted'); }
    catch { toast.error('Failed to delete song'); }
  };

  const handleDeleteVideo = async (id: string) => {
    if (!confirm('Delete this video?')) return;
    try { await deleteVideo(id); setVideos(prev => prev.filter(v => v.id !== id)); toast.success('Video deleted'); }
    catch { toast.error('Failed to delete video'); }
  };

  const handleEditSong = async () => {
    if (!editSong) return;
    setEditLoading(true);
    try {
      await supabase.from('songs').update({ title: editSongTitle, artist_name: editSongArtist }).eq('id', editSong.id);
      setSongs(prev => prev.map(s => s.id === editSong.id ? { ...s, title: editSongTitle, artist_name: editSongArtist } : s));
      toast.success('Song updated');
      setEditSong(null);
    } catch { toast.error('Failed to update song'); }
    finally { setEditLoading(false); }
  };

  const handleRequestWithdrawal = async () => {
    if (!user) return;
    const amountNum = parseFloat(wdAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error('Please enter a valid withdrawal amount.');
      return;
    }
    if (amountNum < 50) {
      toast.error('The minimum withdrawal limit is ZMW 50.00.');
      return;
    }
    if (!wallet || wallet.available_balance < amountNum) {
      toast.error('Insufficient available balance to complete this withdrawal request.');
      return;
    }
    if (wdMethod !== 'bank' && !wdPhone.trim()) {
      toast.error('Please enter a valid mobile money number.');
      return;
    }
    if (wdMethod === 'bank' && (!wdBankName.trim() || !wdAccountNo.trim())) {
      toast.error('Please enter complete bank and account information.');
      return;
    }

    setWdSubmitting(true);
    try {
      const acctDetails = wdMethod === 'bank' 
        ? { bank_name: wdBankName, account_number: wdAccountNo, account_name: wdAccountName }
        : { phone: wdPhone };

      const newWd = await requestUserWithdrawal({
        userId: user.id,
        amount: amountNum,
        paymentMethod: wdMethod,
        accountDetails: acctDetails
      });

      setUserWithdrawals(prev => [newWd, ...prev]);
      // Instantly update local wallet balance in UI
      setWallet(prev => ({
        ...prev,
        available_balance: prev.available_balance - amountNum,
        total_withdrawn: (prev.total_withdrawn || 0) + amountNum
      }));

      // Reload transactions
      const wt = await getUserWalletTransactions(user.id);
      setWalletTx(wt);

      toast.success('Withdrawal request submitted successfully!');
      setWdDialog(false);
      // Reset form
      setWdAmount('');
      setWdPhone('');
      setWdBankName('');
      setWdAccountNo('');
      setWdAccountName('');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to submit withdrawal request.');
    } finally {
      setWdSubmitting(false);
    }
  };

  const statusIcon = (status: string) => {
    if (status === 'approved') return <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />;
    if (status === 'rejected') return <XCircle className="h-3.5 w-3.5 text-destructive" />;
    return <Clock className="h-3.5 w-3.5 text-yellow-600" />;
  };

  const roleLabel = (role?: string) => {
    if (role === 'super_admin') return <Badge className="text-xs bg-accent text-accent-foreground font-semibold">Super Admin</Badge>;
    if (role === 'admin')       return <Badge className="text-xs bg-blue-600 text-white font-semibold">Admin</Badge>;
    if (role === 'artist')      return <Badge className="text-xs bg-electric text-white font-semibold">Artist</Badge>;
    return <Badge variant="secondary" className="text-xs">User</Badge>;
  };

  return (
    <div className="min-h-screen pt-20 pb-24 lg:pb-6">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <BackToHome />
        {/* Profile header */}
        <div className="bg-card border border-border rounded-xl p-5 mb-6 shadow-xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <UserAvatar
                src={profile?.avatar_url}
                name={profile?.display_name || profile?.username || 'User'}
                size="xl"
                className="border-2 border-accent/40"
              />
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-bold text-foreground">
                    {profile?.display_name || profile?.username || 'User'}
                  </h1>
                  {roleLabel(profile?.role)}
                  {(profile?.is_artist || profile?.upload_access === 'active') && (
                    <Badge variant="outline" className="text-xs text-emerald-500 border-emerald-500/30 bg-emerald-500/10">
                      Upload Access
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground font-mono">@{profile?.username || 'no_username'}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1 flex-wrap">
                  {profile?.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="h-3.5 w-3.5" />
                      {profile.email}
                    </span>
                  )}
                  {profile?.created_at && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      Joined {formatDate(profile.created_at)}
                    </span>
                  )}
                </div>
                {profile?.bio && (
                  <p className="text-xs text-foreground/80 pt-1 max-w-xl line-clamp-2">
                    {profile.bio}
                  </p>
                )}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={openEditProfile} className="shrink-0 self-end sm:self-center gap-1.5">
              <Pencil className="h-4 w-4" /> Edit Profile
            </Button>
          </div>

          {/* Quick profile activity summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-border/60">
            <div className="text-center sm:text-left">
              <span className="text-xs text-muted-foreground block">Uploaded Songs</span>
              <span className="text-lg font-bold text-foreground">{songs.length}</span>
            </div>
            <div className="text-center sm:text-left">
              <span className="text-xs text-muted-foreground block">Uploaded Videos</span>
              <span className="text-lg font-bold text-foreground">{videos.length}</span>
            </div>
            <div className="text-center sm:text-left">
              <span className="text-xs text-muted-foreground block">Award Nominations</span>
              <span className="text-lg font-bold text-foreground">{nominations.length}</span>
            </div>
            <div className="text-center sm:text-left">
              <span className="text-xs text-muted-foreground block">Votes Cast</span>
              <span className="text-lg font-bold text-foreground">{votes.length}</span>
            </div>
          </div>
        </div>

        {/* Active plan */}
        {activeSub && (
          <Card className="mb-6 border-accent/30 bg-accent/5">
            <CardContent className="py-3 flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-accent shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{activeSub.upload_plans?.name}</p>
                <p className="text-xs text-muted-foreground">
                  {activeSub.plan_type === 'k10_single'
                    ? `${1 - (activeSub.uploads_used || 0)} upload(s) remaining`
                    : `Unlimited${activeSub.expires_at ? ` · Expires ${formatDate(activeSub.expires_at)}` : ''}`}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => navigate('/upload')}>
                <Upload className="h-4 w-4 mr-1" />Upload
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs defaultValue="music">
          <TabsList className="flex flex-wrap gap-1 h-auto mb-6 bg-transparent border border-border rounded-lg p-1">
            {[
              { value: 'music', icon: Music2, label: 'Music', count: songs.length },
              { value: 'videos', icon: Video, label: 'Videos', count: videos.length },
              { value: 'earnings', icon: TrendingUp, label: 'Earnings', count: undefined },
              { value: 'payments', icon: CreditCard, label: 'Payments', count: payments.length },
              { value: 'awards', icon: Trophy, label: 'Awards', count: nominations.length },
              { value: 'notifications', icon: Bell, label: 'Notifications', count: unreadCount || undefined },
            ].map(({ value, icon: Icon, label, count }) => (
              <TabsTrigger key={value} value={value} className="flex items-center gap-1.5 text-xs">
                <Icon className="h-3.5 w-3.5" />{label}
                {count !== undefined && count > 0 && (
                  <span className="text-[10px] bg-accent text-accent-foreground rounded-full px-1.5 py-0.5 leading-none">{count}</span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* My Music */}
          <TabsContent value="music">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">My Music ({songs.length})</h2>
              <Button size="sm" onClick={() => navigate('/upload')} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                <Upload className="h-3.5 w-3.5 mr-1" />Upload
              </Button>
            </div>
            {loading ? <Skeleton className="h-32 rounded-lg" /> :
              songs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-lg">
                  <Music2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No music uploaded yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {songs.map(song => (
                    <div key={song.id} className="flex items-center gap-3 p-3 border border-border rounded-lg">
                      <div className="h-10 w-10 rounded bg-muted shrink-0 overflow-hidden">
                        {song.cover_url ? <img src={song.cover_url} alt={song.title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Music2 className="h-4 w-4 text-muted-foreground/50" /></div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{song.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{song.artist_name}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center gap-1">{statusIcon(song.status)}<span className="text-xs capitalize hidden sm:inline">{song.status}</span></div>
                        <Button size="icon" variant="ghost" className="h-7 w-7"
                          onClick={() => { setEditSong(song); setEditSongTitle(song.title); setEditSongArtist(song.artist_name); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteSong(song.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            }
          </TabsContent>

          {/* My Videos */}
          <TabsContent value="videos">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">My Videos ({videos.length})</h2>
              <Button size="sm" onClick={() => navigate('/upload')} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                <Upload className="h-3.5 w-3.5 mr-1" />Upload
              </Button>
            </div>
            {loading ? <Skeleton className="h-32 rounded-lg" /> :
              videos.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-lg">
                  <Video className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No videos uploaded yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {videos.map(video => (
                    <div key={video.id} className="flex items-center gap-3 p-3 border border-border rounded-lg">
                      <div className="h-10 w-16 rounded bg-muted shrink-0 overflow-hidden">
                        {video.thumbnail_url ? <img src={video.thumbnail_url} alt={video.title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Video className="h-4 w-4 text-muted-foreground/50" /></div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{video.title}</p>
                        <p className="text-xs text-muted-foreground">{video.view_count} views</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center gap-1">{statusIcon(video.status)}</div>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteVideo(video.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            }
          </TabsContent>

          {/* Real Artist Royalty Wallet and Earnings Dashboard */}
          <TabsContent value="earnings">
            <ArtistEarningsOverview onRequestPayout={() => setWdDialog(true)} />
          </TabsContent>

          {/* Payments */}
          <TabsContent value="payments">
            <h2 className="text-sm font-semibold mb-3">Payment History</h2>
            {loading ? <Skeleton className="h-32 rounded-lg" /> :
              payments.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-lg">
                  <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No payments yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {payments.map(pmt => (
                    <div key={pmt.id} className="p-3 border border-border rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium capitalize">{(pmt.payment_type || '').replace('_', ' ')}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(pmt.created_at)} · {(pmt.payment_method || 'lipila').replace('_', ' ')}</p>
                          {pmt.failure_reason && <p className="text-xs text-destructive mt-0.5">{pmt.failure_reason}</p>}
                        </div>
                        <div className="text-right shrink-0 ml-4">
                          <p className="text-sm font-semibold">{formatCurrency(pmt.amount)}</p>
                          <p className={`text-xs font-medium ${getPaymentStatusColor(pmt.status)}`}>{getPaymentStatusLabel(pmt.status)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            }
          </TabsContent>

          {/* Awards */}
          <TabsContent value="awards">
            <div className="space-y-6">
              <div>
                <h2 className="text-sm font-semibold mb-3">My Nominations ({nominations.length})</h2>
                {nominations.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground border border-dashed border-border rounded-lg">
                    <Trophy className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No nominations yet.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {nominations.map(nom => (
                      <div key={nom.id} className="p-3 border border-border rounded-lg flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{nom.name}</p>
                          <p className="text-xs text-muted-foreground">{(nom.award_categories as { name: string; awards?: { name: string } } | null)?.name} · {(nom.award_categories as { name: string; awards?: { name: string } } | null)?.awards?.name}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">{nom.total_votes} votes</p>
                          <Badge variant={nom.registration_status === 'successful' ? 'default' : 'secondary'} className="text-[10px]">
                            {nom.registration_status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <h2 className="text-sm font-semibold mb-3">My Votes ({votes.length})</h2>
                {votes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground border border-dashed border-border rounded-lg">
                    <p className="text-sm">No votes cast yet.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {votes.map(vote => (
                      <div key={vote.id} className="p-3 border border-border rounded-lg flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{(vote.nominees as { name: string } | null)?.name}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(vote.created_at)} · {vote.vote_count} vote(s)</p>
                        </div>
                        <p className="text-sm font-semibold">{formatCurrency(vote.amount)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Notifications */}
          <TabsContent value="notifications">
            <h2 className="text-sm font-semibold mb-3">Notifications</h2>
            {notifications.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-lg">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No notifications.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {notifications.map(notif => (
                  <div
                    key={notif.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${notif.is_read ? 'border-border bg-transparent' : 'border-accent/30 bg-accent/5'}`}
                    onClick={() => { if (!notif.is_read) { markNotificationRead(notif.id); setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n)); } }}
                  >
                    <p className="text-sm font-medium">{notif.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{notif.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{formatDate(notif.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Profile Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader><DialogTitle>Edit Profile</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-4">
              <UserAvatar 
                src={avatarFile ? URL.createObjectURL(avatarFile) : profile?.avatar_url} 
                name={displayName || profile?.username || 'User'} 
                size="lg" 
              />
              <div className="flex-1">
                <Label>Avatar Photo</Label>
                <Input 
                  type="file" 
                  accept="image/*" 
                  className="mt-1 cursor-pointer text-xs" 
                  onChange={e => setAvatarFile(e.target.files?.[0] || null)} 
                />
              </div>
            </div>
            <div>
              <Label>Display Name</Label>
              <Input className="mt-1" value={displayName} onChange={e => setDisplayName(e.target.value)} />
            </div>
            <div>
              <Label>Bio</Label>
              <Input className="mt-1" value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell us about yourself" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(false)}>Cancel</Button>
            <Button className="bg-accent hover:bg-accent/90 text-accent-foreground" onClick={handleSaveProfile} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save Profile
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Song Dialog */}
      <Dialog open={!!editSong} onOpenChange={open => !open && setEditSong(null)}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader><DialogTitle>Edit Song</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Title</Label>
              <Input className="mt-1" value={editSongTitle} onChange={e => setEditSongTitle(e.target.value)} />
            </div>
            <div>
              <Label>Artist Name</Label>
              <Input className="mt-1" value={editSongArtist} onChange={e => setEditSongArtist(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSong(null)}>Cancel</Button>
            <Button className="bg-accent hover:bg-accent/90 text-accent-foreground" onClick={handleEditSong} disabled={editLoading}>
              {editLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request Withdrawal Dialog */}
      <Dialog open={wdDialog} onOpenChange={setWdDialog}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader><DialogTitle>Request Payout Withdrawal</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-accent/5 p-3 rounded-lg border border-accent/20 text-xs">
              <p className="font-bold text-accent">Available Balance: {formatCurrency(wallet?.available_balance || 0)}</p>
              <p className="text-muted-foreground mt-0.5">Please fill in your recipient details accurately to prevent delayed processing.</p>
            </div>

            <div>
              <Label>Amount (ZMW / K)</Label>
              <Input 
                type="number" 
                placeholder="Minimum K50.00" 
                className="mt-1" 
                value={wdAmount} 
                onChange={e => setWdAmount(e.target.value)} 
              />
            </div>

            <div>
              <Label>Payout Method</Label>
              <select 
                className="w-full mt-1 bg-background border border-input rounded-md px-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                value={wdMethod}
                onChange={e => setWdMethod(e.target.value as any)}
              >
                <option value="mtn">MTN Mobile Money</option>
                <option value="airtel">Airtel Money</option>
                <option value="zamtel">Zamtel Kwacha</option>
                <option value="bank">Direct Bank Transfer</option>
              </select>
            </div>

            {wdMethod !== 'bank' ? (
              <div>
                <Label>Mobile Number (Registered Name must match)</Label>
                <Input 
                  placeholder="e.g. 097XXXXXXXX" 
                  className="mt-1" 
                  value={wdPhone} 
                  onChange={e => setWdPhone(e.target.value)} 
                />
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <Label>Bank Name</Label>
                  <Input 
                    placeholder="e.g. FNB, ABSA, Atlas Mara" 
                    className="mt-1" 
                    value={wdBankName} 
                    onChange={e => setWdBankName(e.target.value)} 
                  />
                </div>
                <div>
                  <Label>Account Number</Label>
                  <Input 
                    placeholder="Account Number" 
                    className="mt-1" 
                    value={wdAccountNo} 
                    onChange={e => setWdAccountNo(e.target.value)} 
                  />
                </div>
                <div>
                  <Label>Account Holder Name (Full Registered Name)</Label>
                  <Input 
                    placeholder="Full Account Name" 
                    className="mt-1" 
                    value={wdAccountName} 
                    onChange={e => setWdAccountName(e.target.value)} 
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWdDialog(false)}>Cancel</Button>
            <Button 
              className="bg-accent hover:bg-accent/90 text-accent-foreground" 
              onClick={handleRequestWithdrawal} 
              disabled={wdSubmitting}
            >
              {wdSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
