import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Users, Music2, Video, CreditCard, Trophy, Image, Settings,
  Pencil, Trash2, Plus,
  Loader2, TrendingUp, Star, Bell, Download, RefreshCw, Eye, EyeOff, KeyRound
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import {
  getAllProfiles, getSongs, getVideos, getAllPayments, getAllAwards,
  getAllBanners, getAllPlans, getSettings,
  approveContent, rejectContent, setTrending, updatePlan, updateSetting,
  deleteSong, deleteVideo, createAward, updateAward, deleteAward,
  createAwardCategory, updateAwardCategory, deleteAwardCategory, setWinner,
  createBanner, updateBanner, deleteBanner, uploadFile,
  getAllDownloads, getAllNominees, updateNomineeStatus, setVideoDownloadsEnabled,
  getAllWinnersOfMonth, upsertWinnerOfMonth, publishWinnerOfMonth,
  getWeeklyTrending, computeAndStoreWeeklyTrending, createNotification
} from '@/lib/api';
import type {
  Profile, Song, Video as VideoType, Payment, Award, AwardCategory,
  HeroBanner, UploadPlan, Download as DownloadType, Nominee, WinnerOfMonth, WeeklyTrending
} from '@/types/index';
import { formatDate, formatCurrency, getPaymentStatusColor, getPaymentStatusLabel } from '@/lib/utils';

export default function AdminPage() {
  const { profile, user } = useAuth();
  const [loading, setLoading] = useState(true);

  // Data
  const [users, setUsers] = useState<Profile[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [videos, setVideos] = useState<VideoType[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [awards, setAwards] = useState<Award[]>([]);
  const [banners, setBanners] = useState<HeroBanner[]>([]);
  const [plans, setPlans] = useState<UploadPlan[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [downloads, setDownloads] = useState<DownloadType[]>([]);
  const [nominees, setNominees] = useState<Nominee[]>([]);
  const [winnersOfMonth, setWinnersOfMonth] = useState<WinnerOfMonth[]>([]);
  const [trendingData, setTrendingData] = useState<WeeklyTrending[]>([]);
  const [trendingRefreshing, setTrendingRefreshing] = useState(false);

  // Reset password dialog (super_admin only)
  const [resetDialog, setResetDialog] = useState(false);
  const [resetTarget, setResetTarget] = useState<Profile | null>(null);
  const [resetPw, setResetPw] = useState('');
  const [resetPwConfirm, setResetPwConfirm] = useState('');
  const [resetPwShow, setResetPwShow] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const isSuperAdmin = profile?.role === 'super_admin';

  const openResetDialog = (u: Profile) => {
    setResetTarget(u);
    setResetPw('');
    setResetPwConfirm('');
    setResetPwShow(false);
    setResetDialog(true);
  };

  const handleResetPassword = async () => {
    if (!resetTarget) return;
    if (!resetPw) { toast.error('Enter a new password'); return; }
    if (resetPw.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    if (resetPw !== resetPwConfirm) { toast.error('Passwords do not match'); return; }
    setResetLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const { data, error } = await supabase.functions.invoke('admin-reset-password', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: { user_id: resetTarget.id, new_password: resetPw },
      });
      if (error || data?.error) {
        toast.error(data?.error || error?.message || 'Reset failed');
        return;
      }
      toast.success(`Password reset for ${resetTarget.username || resetTarget.email}`);
      setResetDialog(false);
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Reset failed');
    } finally { setResetLoading(false); }
  };

  // Winner of Month dialog
  const [womDialog, setWomDialog] = useState(false);
  const [womArtistName, setWomArtistName] = useState('');
  const [womAward, setWomAward] = useState('');
  const [womPrize, setWomPrize] = useState('');
  const [womDescription, setWomDescription] = useState('');
  const [womMonth, setWomMonth] = useState(new Date().getMonth() + 1);
  const [womYear, setWomYear] = useState(new Date().getFullYear());
  const [womPhotoFile, setWomPhotoFile] = useState<File | null>(null);
  const [womSaving, setWomSaving] = useState(false);

  // Notification dialog
  const [notifDialog, setNotifDialog] = useState(false);
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMessage, setNotifMessage] = useState('');
  const [notifType, setNotifType] = useState<'info' | 'success' | 'warning' | 'error'>('info');
  const [notifSending, setNotifSending] = useState(false);

  // Banner dialog
  const [bannerDialog, setBannerDialog] = useState<{ open: boolean; banner?: HeroBanner }>({ open: false });
  const [bannerTitle, setBannerTitle] = useState('');
  const [bannerSubtitle, setBannerSubtitle] = useState('');
  const [bannerBtnText, setBannerBtnText] = useState('');
  const [bannerBtnUrl, setBannerBtnUrl] = useState('');
  const [bannerOrder, setBannerOrder] = useState('0');
  const [bannerActive, setBannerActive] = useState(true);
  const [bannerImageFile, setBannerImageFile] = useState<File | null>(null);
  const [bannerSaving, setBannerSaving] = useState(false);

  // Award dialog
  const [awardDialog, setAwardDialog] = useState<{ open: boolean; award?: Award }>({ open: false });
  const [awardName, setAwardName] = useState('');
  const [awardDesc, setAwardDesc] = useState('');
  const [awardYear, setAwardYear] = useState(new Date().getFullYear().toString());
  const [awardVoting, setAwardVoting] = useState(false);
  const [awardSaving, setAwardSaving] = useState(false);

  // Category dialog
  const [catDialog, setCatDialog] = useState<{ open: boolean; category?: AwardCategory; awardId?: string }>({ open: false });
  const [catName, setCatName] = useState('');
  const [catPrize, setCatPrize] = useState('');
  const [catSaving, setCatSaving] = useState(false);

  // Settings saving
  const [settingSaving, setSettingSaving] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (profile?.role !== 'admin') return;
    const load = async () => {
      setLoading(true);
      try {
        const [u, s, v, p, aw, bn, pl, st, dl, nom, wom, trnd] = await Promise.all([
          getAllProfiles(), getSongs({ limit: 100 }), getVideos({ limit: 100 }),
          getAllPayments(), getAllAwards(), getAllBanners(), getAllPlans(), getSettings(),
          getAllDownloads(), getAllNominees(), getAllWinnersOfMonth(), getWeeklyTrending(),
        ]);
        setUsers(u); setSongs(s); setVideos(v); setPayments(p);
        setAwards(aw); setBanners(bn); setPlans(pl); setSettings(st);
        setDownloads(dl); setNominees(nom); setWinnersOfMonth(wom); setTrendingData(trnd);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, [profile]);

  if (profile?.role !== 'admin') return <Navigate to="/" replace />;

  // Settings updater
  const saveSetting = async (key: string, value: string) => {
    setSettingSaving(prev => ({ ...prev, [key]: true }));
    try {
      await updateSetting(key, value);
      setSettings(prev => ({ ...prev, [key]: value }));
      toast.success('Setting updated');
    } catch { toast.error('Failed to save setting'); }
    finally { setSettingSaving(prev => ({ ...prev, [key]: false })); }
  };

  // Banner CRUD
  const openBannerDialog = (banner?: HeroBanner) => {
    setBannerTitle(banner?.title || '');
    setBannerSubtitle(banner?.subtitle || '');
    setBannerBtnText(banner?.button_text || '');
    setBannerBtnUrl(banner?.button_url || '');
    setBannerOrder(String(banner?.display_order ?? 0));
    setBannerActive(banner?.is_active ?? true);
    setBannerImageFile(null);
    setBannerDialog({ open: true, banner });
  };

  const handleSaveBanner = async () => {
    if (!bannerTitle) { toast.error('Title is required'); return; }
    setBannerSaving(true);
    try {
      let imageUrl = bannerDialog.banner?.image_url || '';
      if (bannerImageFile) {
        imageUrl = await uploadFile('banners', `banner_${Date.now()}.${bannerImageFile.name.split('.').pop()}`, bannerImageFile);
      }
      if (!imageUrl) { toast.error('Upload an image'); setBannerSaving(false); return; }
      const payload = {
        title: bannerTitle, subtitle: bannerSubtitle || undefined,
        button_text: bannerBtnText || undefined, button_url: bannerBtnUrl || undefined,
        display_order: parseInt(bannerOrder), is_active: bannerActive, image_url: imageUrl
      };
      if (bannerDialog.banner) { await updateBanner(bannerDialog.banner.id, payload); }
      else { await createBanner(payload); }
      const updated = await getAllBanners(); setBanners(updated);
      toast.success(`Banner ${bannerDialog.banner ? 'updated' : 'created'}`);
      setBannerDialog({ open: false });
    } catch (e: unknown) { toast.error((e as Error).message || 'Failed to save banner'); }
    finally { setBannerSaving(false); }
  };

  // Award CRUD
  const openAwardDialog = (award?: Award) => {
    setAwardName(award?.name || ''); setAwardDesc(award?.description || '');
    setAwardYear(String(award?.year || new Date().getFullYear()));
    setAwardVoting(award?.voting_open || false);
    setAwardDialog({ open: true, award });
  };

  const handleSaveAward = async () => {
    if (!awardName) { toast.error('Award name required'); return; }
    setAwardSaving(true);
    try {
      const payload = { name: awardName, description: awardDesc || undefined, year: parseInt(awardYear), voting_open: awardVoting, is_active: true };
      if (awardDialog.award) { await updateAward(awardDialog.award.id, payload); }
      else { await createAward(payload); }
      const updated = await getAllAwards(); setAwards(updated);
      toast.success(`Award ${awardDialog.award ? 'updated' : 'created'}`);
      setAwardDialog({ open: false });
    } catch (e: unknown) { toast.error((e as Error).message || 'Failed to save award'); }
    finally { setAwardSaving(false); }
  };

  const openCatDialog = (awardId: string, cat?: AwardCategory) => {
    setCatName(cat?.name || ''); setCatPrize(cat?.grand_prize || '');
    setCatDialog({ open: true, category: cat, awardId });
  };

  const handleSaveCat = async () => {
    if (!catName) { toast.error('Category name required'); return; }
    setCatSaving(true);
    try {
      const payload = { name: catName, grand_prize: catPrize || undefined, is_active: true, award_id: catDialog.awardId! };
      if (catDialog.category) { await updateAwardCategory(catDialog.category.id, payload); }
      else { await createAwardCategory(payload); }
      const updated = await getAllAwards(); setAwards(updated);
      toast.success(`Category ${catDialog.category ? 'updated' : 'created'}`);
      setCatDialog({ open: false });
    } catch (e: unknown) { toast.error((e as Error).message || 'Failed to save category'); }
    finally { setCatSaving(false); }
  };



  const handleRefreshTrending = async () => {
    setTrendingRefreshing(true);
    try {
      await computeAndStoreWeeklyTrending();
      const trnd = await getWeeklyTrending();
      setTrendingData(trnd);
      toast.success('Trending rankings refreshed');
    } catch { toast.error('Failed to refresh trending'); }
    finally { setTrendingRefreshing(false); }
  };

  const handlePublishWinner = async (id: string) => {
    try {
      await publishWinnerOfMonth(id);
      // notify all users
      await createNotification({
        title: '⭐ Winner of the Month Announced!',
        message: 'Check out this month\'s winner of the month on the Awards page.',
        type: 'success',
        notification_type: 'winner_of_month',
        link: '/awards',
      });
      const updated = await getAllWinnersOfMonth();
      setWinnersOfMonth(updated);
      toast.success('Winner published and users notified');
    } catch { toast.error('Failed to publish winner'); }
  };

  const handleSaveWinner = async () => {
    if (!womArtistName || !womAward) { toast.error('Artist name and award are required'); return; }
    setWomSaving(true);
    try {
      let photoUrl: string | undefined;
      if (womPhotoFile) {
        photoUrl = await uploadFile('thumbnails', `wom_${Date.now()}.${womPhotoFile.name.split('.').pop()}`, womPhotoFile);
      }
      await upsertWinnerOfMonth({
        artist_name: womArtistName,
        award: womAward,
        prize: womPrize || undefined,
        description: womDescription || undefined,
        month: womMonth,
        year: womYear,
        photo_url: photoUrl,
        is_published: false,
      });
      const updated = await getAllWinnersOfMonth();
      setWinnersOfMonth(updated);
      toast.success('Winner saved (not yet published)');
      setWomDialog(false);
    } catch { toast.error('Failed to save winner'); }
    finally { setWomSaving(false); }
  };

  const handleSendBroadcast = async () => {
    if (!notifTitle || !notifMessage) { toast.error('Title and message required'); return; }
    setNotifSending(true);
    try {
      await createNotification({
        title: notifTitle, message: notifMessage,
        type: notifType, notification_type: 'general',
      });
      toast.success('Broadcast notification sent to all users');
      setNotifTitle(''); setNotifMessage(''); setNotifDialog(false);
    } catch { toast.error('Failed to send notification'); }
    finally { setNotifSending(false); }
  };

  const stats = {
    users: users.length,
    songs: songs.length,
    videos: videos.length,
    payments: payments.filter(p => p.status === 'successful').length,
    revenue: payments.filter(p => p.status === 'successful').reduce((a, p) => a + p.amount, 0),
  };

  return (
    <div className="min-h-screen pt-20 pb-24 lg:pb-6">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="border-b border-border pb-4 mb-6">
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground">Manage ZedVevo platform</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {[
            { label: 'Users', value: stats.users, icon: Users },
            { label: 'Songs', value: stats.songs, icon: Music2 },
            { label: 'Videos', value: stats.videos, icon: Video },
            { label: 'Payments', value: stats.payments, icon: CreditCard },
            { label: 'Revenue', value: formatCurrency(stats.revenue), icon: TrendingUp },
          ].map(({ label, value, icon: Icon }) => (
            <Card key={label}>
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-accent shrink-0" />
                  <div>
                    <p className="text-lg font-bold leading-tight">{loading ? '...' : value}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="content">
          <TabsList className="flex flex-wrap gap-1 h-auto bg-transparent border border-border rounded-lg p-1 mb-6">
            {[
              { value: 'content',   label: 'Content',   icon: Music2 },
              { value: 'downloads', label: 'Downloads',  icon: Download },
              { value: 'nominees',  label: 'Nominees',   icon: Trophy },
              { value: 'winners',   label: 'Winners',    icon: Star },
              { value: 'trending',  label: 'Trending',   icon: TrendingUp },
              { value: 'users',     label: 'Users',      icon: Users },
              { value: 'payments',  label: 'Payments',   icon: CreditCard },
              { value: 'awards',    label: 'Awards',     icon: Trophy },
              { value: 'banners',   label: 'Banners',    icon: Image },
              { value: 'settings',  label: 'Settings',   icon: Settings },
            ].map(({ value, label, icon: Icon }) => (
              <TabsTrigger key={value} value={value} className="flex items-center gap-1.5 text-xs">
                <Icon className="h-3.5 w-3.5" />{label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Downloads tab */}
          <TabsContent value="downloads">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Downloads ({downloads.length})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {['Title', 'Artist', 'Type', 'User', 'Date'].map(h => (
                      <th key={h} className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={5}><Skeleton className="h-8 w-full mt-2" /></td></tr>
                  ) : downloads.length === 0 ? (
                    <tr><td colSpan={5} className="py-8 text-center text-muted-foreground text-xs">No downloads yet</td></tr>
                  ) : downloads.slice(0, 100).map(d => (
                    <tr key={d.id} className="border-b border-border hover:bg-muted/30">
                      <td className="py-2 px-2 whitespace-nowrap max-w-[160px] truncate font-medium">{d.title}</td>
                      <td className="py-2 px-2 whitespace-nowrap text-muted-foreground">{d.artist_name}</td>
                      <td className="py-2 px-2 whitespace-nowrap">
                        <Badge variant="outline" className="text-[10px] capitalize">{d.content_type}</Badge>
                      </td>
                      <td className="py-2 px-2 whitespace-nowrap text-muted-foreground text-xs">{d.user_id?.slice(0, 8)}…</td>
                      <td className="py-2 px-2 whitespace-nowrap text-muted-foreground text-xs">{formatDate(d.downloaded_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Video download toggle section */}
            <div className="mt-6">
              <h3 className="text-sm font-semibold mb-3">Enable / Disable Video Downloads</h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[400px] text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {['Video', 'Artist', 'Downloads Enabled'].map(h => (
                        <th key={h} className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {videos.filter(v => v.status === 'approved').map(video => (
                      <tr key={video.id} className="border-b border-border hover:bg-muted/30">
                        <td className="py-2 px-2 whitespace-nowrap max-w-[200px] truncate font-medium">{video.title}</td>
                        <td className="py-2 px-2 whitespace-nowrap text-muted-foreground">{video.artist_name}</td>
                        <td className="py-2 px-2 whitespace-nowrap">
                          <Switch
                            checked={!!video.downloads_enabled}
                            onCheckedChange={async v => {
                              await setVideoDownloadsEnabled(video.id, v);
                              setVideos(prev => prev.map(vi => vi.id === video.id ? { ...vi, downloads_enabled: v } : vi));
                              toast.success(`Downloads ${v ? 'enabled' : 'disabled'} for "${video.title}"`);
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* Nominees tab */}
          <TabsContent value="nominees">
            <h2 className="text-sm font-semibold mb-3">Nominees ({nominees.length})</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {['Name', 'Category', 'Status', 'Votes', 'Actions'].map(h => (
                      <th key={h} className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={5}><Skeleton className="h-8 w-full mt-2" /></td></tr>
                  ) : nominees.length === 0 ? (
                    <tr><td colSpan={5} className="py-8 text-center text-muted-foreground text-xs">No nominees yet</td></tr>
                  ) : nominees.map(nom => (
                    <tr key={nom.id} className="border-b border-border hover:bg-muted/30">
                      <td className="py-2 px-2 whitespace-nowrap font-medium">
                        <div className="flex items-center gap-2">
                          {nom.photo_url && <img src={nom.photo_url} alt={nom.name} className="h-6 w-6 rounded-full object-cover shrink-0" />}
                          {nom.name}
                        </div>
                      </td>
                      <td className="py-2 px-2 whitespace-nowrap text-muted-foreground text-xs">
                        {(nom.award_categories as { name?: string } | null)?.name ?? '—'}
                      </td>
                      <td className="py-2 px-2 whitespace-nowrap">
                        <Badge
                          variant={nom.nomination_status === 'approved' ? 'default' : nom.nomination_status === 'rejected' ? 'destructive' : 'secondary'}
                          className="text-[10px] capitalize"
                        >
                          {nom.nomination_status}
                        </Badge>
                      </td>
                      <td className="py-2 px-2 whitespace-nowrap text-muted-foreground">{nom.total_votes ?? 0}</td>
                      <td className="py-2 px-2 whitespace-nowrap">
                        <div className="flex gap-1 flex-wrap">
                          {nom.nomination_status === 'pending_review' && (
                            <>
                              <Button size="sm" className="h-6 text-[10px] px-2 bg-green-600 hover:bg-green-700 text-white"
                                onClick={async () => {
                                  await updateNomineeStatus(nom.id, 'approved');
                                  await createNotification({ user_id: nom.user_id, title: '✅ Nomination Approved', message: `Your nomination for "${nom.name}" has been approved!`, type: 'success', notification_type: 'nomination_approved' });
                                  setNominees(prev => prev.map(n => n.id === nom.id ? { ...n, nomination_status: 'approved' } : n));
                                  toast.success('Nominee approved');
                                }}>Approve</Button>
                              <Button size="sm" variant="destructive" className="h-6 text-[10px] px-2"
                                onClick={async () => {
                                  await updateNomineeStatus(nom.id, 'rejected');
                                  await createNotification({ user_id: nom.user_id, title: '❌ Nomination Rejected', message: `Your nomination for "${nom.name}" was not approved.`, type: 'error', notification_type: 'nomination_rejected' });
                                  setNominees(prev => prev.map(n => n.id === nom.id ? { ...n, nomination_status: 'rejected' } : n));
                                  toast.success('Nominee rejected');
                                }}>Reject</Button>
                            </>
                          )}
                          {nom.nomination_status === 'approved' && (
                            <Button size="sm" className="h-6 text-[10px] px-2 bg-accent hover:bg-accent/90 text-accent-foreground"
                              onClick={async () => {
                                await setWinner(nom.id);
                                await createNotification({ title: '🏆 Award Winner Announced!', message: `${nom.name} has been declared a winner!`, type: 'success', notification_type: 'award_winner', link: '/awards' });
                                setNominees(prev => prev.map(n => n.id === nom.id ? { ...n, nomination_status: 'winner', is_winner: true } : n));
                                toast.success('Winner set');
                              }}>Set Winner</Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* Winner of Month tab */}
          <TabsContent value="winners">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold">Winner of the Month</h2>
              <Button size="sm" className="bg-accent hover:bg-accent/90 text-accent-foreground"
                onClick={() => { setWomArtistName(''); setWomAward(''); setWomPrize(''); setWomDescription(''); setWomPhotoFile(null); setWomMonth(new Date().getMonth() + 1); setWomYear(new Date().getFullYear()); setWomDialog(true); }}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Winner
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {winnersOfMonth.length === 0 ? (
                <p className="text-sm text-muted-foreground col-span-full py-6 text-center">No winners of the month yet</p>
              ) : winnersOfMonth.map(w => (
                <Card key={w.id} className={`border ${w.is_published ? 'border-accent/40' : 'border-border'}`}>
                  <CardContent className="flex gap-3 py-3">
                    <div className="h-14 w-14 rounded-md overflow-hidden bg-muted shrink-0">
                      {w.photo_url
                        ? <img src={w.photo_url} alt={w.artist_name} className="w-full h-full object-cover" />
                        : <Star className="h-6 w-6 text-muted-foreground m-auto" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{w.artist_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{w.award}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(w.year, w.month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}
                      </p>
                      <div className="flex gap-2 mt-2">
                        {!w.is_published ? (
                          <Button size="sm" className="h-6 text-[10px] px-2 bg-accent hover:bg-accent/90 text-accent-foreground"
                            onClick={() => handlePublishWinner(w.id)}>
                            Publish
                          </Button>
                        ) : (
                          <Badge variant="default" className="text-[10px]">Published</Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Trending tab */}
          <TabsContent value="trending">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold">Weekly Trending ({trendingData.length} entries)</h2>
              <Button size="sm" variant="outline" onClick={handleRefreshTrending} disabled={trendingRefreshing}>
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${trendingRefreshing ? 'animate-spin' : ''}`} />
                Recalculate
              </Button>
            </div>
            {trendingData.length === 0 ? (
              <div className="text-center py-10">
                <TrendingUp className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No trending data. Click Recalculate to generate rankings.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {['Rank', 'Title', 'Artist', 'Type', 'Category', 'Value'].map(h => (
                        <th key={h} className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {trendingData.slice(0, 40).map(t => (
                      <tr key={t.id} className="border-b border-border hover:bg-muted/30">
                        <td className="py-2 px-2 whitespace-nowrap font-bold text-accent">#{t.rank}</td>
                        <td className="py-2 px-2 whitespace-nowrap max-w-[160px] truncate font-medium">{t.title}</td>
                        <td className="py-2 px-2 whitespace-nowrap text-muted-foreground">{t.artist_name}</td>
                        <td className="py-2 px-2 whitespace-nowrap">
                          <Badge variant="outline" className="text-[10px] capitalize">{t.content_type}</Badge>
                        </td>
                        <td className="py-2 px-2 whitespace-nowrap text-muted-foreground text-xs capitalize">{t.category.replace(/_/g, ' ')}</td>
                        <td className="py-2 px-2 whitespace-nowrap text-muted-foreground">{t.metric_value.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
          <TabsContent value="content">
            <div className="space-y-6">
              <div>
                <h2 className="text-sm font-semibold mb-3">Songs ({songs.length})</h2>
                <div className="space-y-2 overflow-x-auto">
                  <table className="w-full min-w-[500px] text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground whitespace-nowrap">Title</th>
                        <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground whitespace-nowrap">Artist</th>
                        <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground whitespace-nowrap">Status</th>
                        <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground whitespace-nowrap">Trending</th>
                        <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground whitespace-nowrap">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr><td colSpan={5}><Skeleton className="h-8 w-full mt-2" /></td></tr>
                      ) : songs.slice(0, 30).map(song => (
                        <tr key={song.id} className="border-b border-border hover:bg-muted/30">
                          <td className="py-2 px-2 whitespace-nowrap max-w-[160px] truncate font-medium">{song.title}</td>
                          <td className="py-2 px-2 whitespace-nowrap text-muted-foreground">{song.artist_name}</td>
                          <td className="py-2 px-2 whitespace-nowrap">
                            <Badge variant={song.status === 'approved' ? 'default' : song.status === 'rejected' ? 'destructive' : 'secondary'} className="text-[10px]">
                              {song.status}
                            </Badge>
                          </td>
                          <td className="py-2 px-2 whitespace-nowrap">
                            <Switch
                              checked={song.is_trending}
                              onCheckedChange={async v => {
                                await setTrending('songs', song.id, v);
                                setSongs(prev => prev.map(s => s.id === song.id ? { ...s, is_trending: v } : s));
                              }}
                            />
                          </td>
                          <td className="py-2 px-2 whitespace-nowrap">
                            <div className="flex gap-1">
                              {song.status === 'pending' && (
                                <>
                                  <Button size="sm" className="h-6 text-[10px] px-2 bg-green-600 hover:bg-green-700 text-white"
                                    onClick={async () => { await approveContent('songs', song.id); setSongs(p => p.map(s => s.id === song.id ? { ...s, status: 'approved' as const } : s)); toast.success('Approved'); }}>
                                    Approve
                                  </Button>
                                  <Button size="sm" variant="destructive" className="h-6 text-[10px] px-2"
                                    onClick={async () => { await rejectContent('songs', song.id); setSongs(p => p.map(s => s.id === song.id ? { ...s, status: 'rejected' as const } : s)); toast.success('Rejected'); }}>
                                    Reject
                                  </Button>
                                </>
                              )}
                              <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive"
                                onClick={async () => { if (!confirm('Delete song?')) return; await deleteSong(song.id); setSongs(p => p.filter(s => s.id !== song.id)); toast.success('Deleted'); }}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h2 className="text-sm font-semibold mb-3">Videos ({videos.length})</h2>
                <div className="space-y-2 overflow-x-auto">
                  <table className="w-full min-w-[500px] text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground whitespace-nowrap">Title</th>
                        <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground whitespace-nowrap">Artist</th>
                        <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground whitespace-nowrap">Status</th>
                        <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground whitespace-nowrap">Trending</th>
                        <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground whitespace-nowrap">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr><td colSpan={5}><Skeleton className="h-8 w-full mt-2" /></td></tr>
                      ) : videos.slice(0, 20).map(video => (
                        <tr key={video.id} className="border-b border-border hover:bg-muted/30">
                          <td className="py-2 px-2 whitespace-nowrap max-w-[160px] truncate font-medium">{video.title}</td>
                          <td className="py-2 px-2 whitespace-nowrap text-muted-foreground">{video.artist_name}</td>
                          <td className="py-2 px-2 whitespace-nowrap">
                            <Badge variant={video.status === 'approved' ? 'default' : video.status === 'rejected' ? 'destructive' : 'secondary'} className="text-[10px]">
                              {video.status}
                            </Badge>
                          </td>
                          <td className="py-2 px-2 whitespace-nowrap">
                            <Switch
                              checked={video.is_trending}
                              onCheckedChange={async v => {
                                await setTrending('videos', video.id, v);
                                setVideos(prev => prev.map(vi => vi.id === video.id ? { ...vi, is_trending: v } : vi));
                              }}
                            />
                          </td>
                          <td className="py-2 px-2 whitespace-nowrap">
                            <div className="flex gap-1">
                              {video.status === 'pending' && (
                                <>
                                  <Button size="sm" className="h-6 text-[10px] px-2 bg-green-600 hover:bg-green-700 text-white"
                                    onClick={async () => { await approveContent('videos', video.id); setVideos(p => p.map(v => v.id === video.id ? { ...v, status: 'approved' as const } : v)); toast.success('Approved'); }}>
                                    Approve
                                  </Button>
                                  <Button size="sm" variant="destructive" className="h-6 text-[10px] px-2"
                                    onClick={async () => { await rejectContent('videos', video.id); setVideos(p => p.map(v => v.id === video.id ? { ...v, status: 'rejected' as const } : v)); toast.success('Rejected'); }}>
                                    Reject
                                  </Button>
                                </>
                              )}
                              <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive"
                                onClick={async () => { if (!confirm('Delete video?')) return; await deleteVideo(video.id); setVideos(p => p.filter(v => v.id !== video.id)); toast.success('Deleted'); }}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Users */}
          <TabsContent value="users">
            <h2 className="text-sm font-semibold mb-3">Users ({users.length})</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {['Username', 'Email', 'Role', 'Joined', ...(isSuperAdmin ? ['Actions'] : [])].map(h => (
                      <th key={h} className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={isSuperAdmin ? 5 : 4}><Skeleton className="h-8 w-full mt-2" /></td></tr>
                  ) : users.map(u => (
                    <tr key={u.id} className="border-b border-border hover:bg-muted/30">
                      <td className="py-2 px-2 whitespace-nowrap font-medium">{u.username || '—'}</td>
                      <td className="py-2 px-2 whitespace-nowrap text-muted-foreground text-xs">{u.email || '—'}</td>
                      <td className="py-2 px-2 whitespace-nowrap">
                        <Badge
                          variant={u.role === 'super_admin' ? 'default' : u.role === 'admin' ? 'default' : 'secondary'}
                          className={`text-[10px] ${u.role === 'super_admin' ? 'bg-accent text-accent-foreground' : ''}`}
                        >
                          {u.role}
                        </Badge>
                      </td>
                      <td className="py-2 px-2 whitespace-nowrap text-muted-foreground">{formatDate(u.created_at)}</td>
                      {isSuperAdmin && (
                        <td className="py-2 px-2 whitespace-nowrap">
                          {/* Super admin cannot reset their own password from here */}
                          {u.id !== user?.id && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1"
                              onClick={() => openResetDialog(u)}
                            >
                              <KeyRound className="h-3 w-3" />
                              Reset Password
                            </Button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* Payments */}
          <TabsContent value="payments">
            <h2 className="text-sm font-semibold mb-3">Payments ({payments.length})</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {['Date', 'Type', 'Method', 'Amount', 'Status', 'Lipila TX'].map(h => (
                      <th key={h} className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={6}><Skeleton className="h-8 w-full mt-2" /></td></tr>
                  ) : payments.map(p => (
                    <tr key={p.id} className="border-b border-border hover:bg-muted/30">
                      <td className="py-2 px-2 whitespace-nowrap text-muted-foreground">{formatDate(p.created_at)}</td>
                      <td className="py-2 px-2 whitespace-nowrap capitalize">{(p.payment_type || '').replace('_', ' ')}</td>
                      <td className="py-2 px-2 whitespace-nowrap capitalize">{(p.payment_method || 'lipila').replace('_', ' ')}</td>
                      <td className="py-2 px-2 whitespace-nowrap font-semibold">{formatCurrency(p.amount)}</td>
                      <td className="py-2 px-2 whitespace-nowrap">
                        <span className={`text-xs font-medium ${getPaymentStatusColor(p.status)}`}>{getPaymentStatusLabel(p.status)}</span>
                      </td>
                      <td className="py-2 px-2 whitespace-nowrap text-muted-foreground text-[10px]">{p.lipila_transaction_id || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* Awards */}
          <TabsContent value="awards">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Awards ({awards.length})</h2>
              <Button size="sm" className="bg-accent hover:bg-accent/90 text-accent-foreground" onClick={() => openAwardDialog()}>
                <Plus className="h-3.5 w-3.5 mr-1" />Add Award
              </Button>
            </div>
            <div className="space-y-4">
              {awards.map(award => (
                <Card key={award.id}>
                  <CardHeader className="pb-2 pt-3 px-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-sm">{award.name}</CardTitle>
                        <p className="text-xs text-muted-foreground">{award.year} · {award.voting_open ? 'Voting Open' : 'Voting Closed'}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openAwardDialog(award)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                          onClick={async () => { if (!confirm('Delete award?')) return; await deleteAward(award.id); setAwards(p => p.filter(a => a.id !== award.id)); }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 pb-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-medium">Categories ({award.award_categories?.length || 0})</p>
                      <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => openCatDialog(award.id)}>
                        <Plus className="h-3 w-3 mr-0.5" />Add Category
                      </Button>
                    </div>
                    <div className="space-y-1">
                      {(award.award_categories || []).map(cat => (
                        <div key={cat.id} className="flex items-center justify-between py-1 px-2 rounded bg-muted/50 text-xs">
                          <span className="font-medium">{cat.name}</span>
                          <div className="flex gap-1">
                            {cat.grand_prize && <span className="text-muted-foreground">{cat.grand_prize}</span>}
                            <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => openCatDialog(award.id, cat)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-5 w-5 text-destructive"
                              onClick={async () => { await deleteAwardCategory(cat.id); const u = await getAllAwards(); setAwards(u); }}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Banners */}
          <TabsContent value="banners">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Hero Banners ({banners.length})</h2>
              <Button size="sm" className="bg-accent hover:bg-accent/90 text-accent-foreground" onClick={() => openBannerDialog()}>
                <Plus className="h-3.5 w-3.5 mr-1" />Add Banner
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {banners.map(banner => (
                <div key={banner.id} className="border border-border rounded-lg overflow-hidden">
                  <div className="aspect-video relative bg-muted">
                    <img src={banner.image_url} alt={banner.title} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 flex items-end p-3">
                      <div className="text-white text-sm font-medium">{banner.title}</div>
                    </div>
                  </div>
                  <div className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant={banner.is_active ? 'default' : 'secondary'} className="text-[10px]">
                        {banner.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">Order: {banner.display_order}</span>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openBannerDialog(banner)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                        onClick={async () => { if (!confirm('Delete banner?')) return; await deleteBanner(banner.id); setBanners(p => p.filter(b => b.id !== banner.id)); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Settings */}
          <TabsContent value="settings">
            <div className="space-y-6 max-w-xl">
              <div>
                <h2 className="text-sm font-semibold mb-3">Upload Plan Prices</h2>
                <div className="space-y-3">
                  {plans.map(plan => (
                    <div key={plan.id} className="flex items-center gap-3">
                      <Label className="w-40 shrink-0 text-sm">{plan.name}</Label>
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-muted-foreground text-sm">K</span>
                        <Input
                          type="number"
                          defaultValue={plan.price}
                          className="w-24"
                          onBlur={async e => {
                            const val = parseFloat(e.target.value);
                            if (isNaN(val) || val <= 0) return;
                            try {
                              await updatePlan(plan.id, { price: val });
                              setPlans(prev => prev.map(p => p.id === plan.id ? { ...p, price: val } : p));
                              toast.success('Plan price updated');
                            } catch { toast.error('Failed to update price'); }
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <h2 className="text-sm font-semibold mb-3">Awards Pricing</h2>
                <div className="space-y-3">
                  {[
                    { key: 'nominee_fee', label: 'Nominee Registration Fee', desc: 'K per nomination' },
                    { key: 'vote_min_amount', label: 'Minimum Vote Amount', desc: 'K = 1 vote' },
                  ].map(({ key, label, desc }) => (
                    <div key={key} className="flex items-center gap-3">
                      <div className="w-52 shrink-0">
                        <p className="text-sm font-medium">{label}</p>
                        <p className="text-xs text-muted-foreground">{desc}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-sm">K</span>
                        <Input
                          type="number"
                          defaultValue={settings[key] || ''}
                          className="w-24"
                          onBlur={async e => {
                            const val = e.target.value;
                            if (!val || isNaN(parseFloat(val))) return;
                            await saveSetting(key, val);
                          }}
                        />
                        {settingSaving[key] && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <h2 className="text-sm font-semibold mb-3">Broadcast Notification</h2>
                <Button size="sm" className="bg-accent hover:bg-accent/90 text-accent-foreground"
                  onClick={() => setNotifDialog(true)}>
                  <Bell className="h-3.5 w-3.5 mr-1" />Send to All Users
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Winner of Month Dialog */}
      <Dialog open={womDialog} onOpenChange={setWomDialog}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader><DialogTitle>Add Winner of the Month</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Month *</Label>
                <Select value={String(womMonth)} onValueChange={v => setWomMonth(Number(v))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>
                        {new Date(2024, i).toLocaleString('default', { month: 'long' })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Year *</Label>
                <Input type="number" className="mt-1" value={womYear} onChange={e => setWomYear(Number(e.target.value))} />
              </div>
            </div>
            <div><Label>Artist Name *</Label><Input className="mt-1" value={womArtistName} onChange={e => setWomArtistName(e.target.value)} /></div>
            <div><Label>Award / Category *</Label><Input className="mt-1" value={womAward} onChange={e => setWomAward(e.target.value)} placeholder="e.g. Best New Artist 2025" /></div>
            <div><Label>Prize</Label><Input className="mt-1" value={womPrize} onChange={e => setWomPrize(e.target.value)} placeholder="e.g. K50,000 cash" /></div>
            <div><Label>Description</Label>
              <Textarea className="mt-1" value={womDescription} onChange={e => setWomDescription(e.target.value)} rows={3} />
            </div>
            <div><Label>Photo</Label><Input type="file" accept="image/*" className="mt-1 cursor-pointer" onChange={e => setWomPhotoFile(e.target.files?.[0] || null)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWomDialog(false)}>Cancel</Button>
            <Button className="bg-accent hover:bg-accent/90 text-accent-foreground" onClick={handleSaveWinner} disabled={womSaving}>
              {womSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save (Draft)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Broadcast Notification Dialog */}
      <Dialog open={notifDialog} onOpenChange={setNotifDialog}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader><DialogTitle>Send Broadcast Notification</DialogTitle>
            <DialogDescription>Sends to all users (no user_id = global).</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label>Title *</Label><Input className="mt-1" value={notifTitle} onChange={e => setNotifTitle(e.target.value)} /></div>
            <div><Label>Message *</Label><Textarea className="mt-1" value={notifMessage} onChange={e => setNotifMessage(e.target.value)} rows={3} /></div>
            <div>
              <Label>Type</Label>
              <Select value={notifType} onValueChange={v => setNotifType(v as typeof notifType)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotifDialog(false)}>Cancel</Button>
            <Button className="bg-accent hover:bg-accent/90 text-accent-foreground" onClick={handleSendBroadcast} disabled={notifSending}>
              {notifSending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Send to All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={bannerDialog.open} onOpenChange={open => setBannerDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader><DialogTitle>{bannerDialog.banner ? 'Edit Banner' : 'Add Banner'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label>Title *</Label><Input className="mt-1" value={bannerTitle} onChange={e => setBannerTitle(e.target.value)} /></div>
            <div><Label>Subtitle</Label><Input className="mt-1" value={bannerSubtitle} onChange={e => setBannerSubtitle(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Button Text</Label><Input className="mt-1" value={bannerBtnText} onChange={e => setBannerBtnText(e.target.value)} /></div>
              <div><Label>Button URL</Label><Input className="mt-1" value={bannerBtnUrl} onChange={e => setBannerBtnUrl(e.target.value)} placeholder="/music" /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Display Order</Label><Input type="number" className="mt-1" value={bannerOrder} onChange={e => setBannerOrder(e.target.value)} /></div>
              <div className="flex items-end gap-2 pb-1">
                <Switch checked={bannerActive} onCheckedChange={setBannerActive} />
                <Label>{bannerActive ? 'Active' : 'Inactive'}</Label>
              </div>
            </div>
            <div><Label>Banner Image {bannerDialog.banner ? '(leave empty to keep existing)' : '*'}</Label>
              <Input type="file" accept="image/*" className="mt-1 cursor-pointer" onChange={e => setBannerImageFile(e.target.files?.[0] || null)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBannerDialog({ open: false })}>Cancel</Button>
            <Button className="bg-accent hover:bg-accent/90 text-accent-foreground" onClick={handleSaveBanner} disabled={bannerSaving}>
              {bannerSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Award Dialog */}
      <Dialog open={awardDialog.open} onOpenChange={open => setAwardDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader><DialogTitle>{awardDialog.award ? 'Edit Award' : 'Add Award'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label>Award Name *</Label><Input className="mt-1" value={awardName} onChange={e => setAwardName(e.target.value)} /></div>
            <div><Label>Description</Label><Input className="mt-1" value={awardDesc} onChange={e => setAwardDesc(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Year</Label><Input type="number" className="mt-1" value={awardYear} onChange={e => setAwardYear(e.target.value)} /></div>
              <div className="flex items-end gap-2 pb-1">
                <Switch checked={awardVoting} onCheckedChange={setAwardVoting} />
                <Label>Voting Open</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAwardDialog({ open: false })}>Cancel</Button>
            <Button className="bg-accent hover:bg-accent/90 text-accent-foreground" onClick={handleSaveAward} disabled={awardSaving}>
              {awardSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category Dialog */}
      <Dialog open={catDialog.open} onOpenChange={open => setCatDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader><DialogTitle>{catDialog.category ? 'Edit Category' : 'Add Category'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label>Category Name *</Label><Input className="mt-1" value={catName} onChange={e => setCatName(e.target.value)} /></div>
            <div><Label>Grand Prize</Label><Input className="mt-1" value={catPrize} onChange={e => setCatPrize(e.target.value)} placeholder="e.g. K50,000 cash" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatDialog({ open: false })}>Cancel</Button>
            <Button className="bg-accent hover:bg-accent/90 text-accent-foreground" onClick={handleSaveCat} disabled={catSaving}>
              {catSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog — super_admin only */}
      <Dialog open={resetDialog} onOpenChange={(o) => { setResetDialog(o); }}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-accent" />
              Reset Password
            </DialogTitle>
            <DialogDescription>
              Set a new password for{' '}
              <strong>{resetTarget?.username || resetTarget?.email || 'this user'}</strong>.
              They will be able to sign in with the new password immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>New Password *</Label>
              <div className="relative mt-1">
                <Input
                  type={resetPwShow ? 'text' : 'password'}
                  className="pr-10"
                  placeholder="Min. 8 characters"
                  value={resetPw}
                  onChange={e => setResetPw(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setResetPwShow(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {resetPwShow ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label>Confirm New Password *</Label>
              <Input
                type={resetPwShow ? 'text' : 'password'}
                className="mt-1"
                placeholder="Re-enter new password"
                value={resetPwConfirm}
                onChange={e => setResetPwConfirm(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetDialog(false)}>Cancel</Button>
            <Button
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
              onClick={handleResetPassword}
              disabled={resetLoading}
            >
              {resetLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Reset Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
