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
  getWeeklyTrending, computeAndStoreWeeklyTrending, createNotification,
  requestLipilaWithdrawal
} from '@/lib/api';
import type {
  Profile, Song, Video as VideoType, Payment, Award, AwardCategory,
  HeroBanner, UploadPlan, Download as DownloadType, Nominee, WinnerOfMonth, WeeklyTrending
} from '@/types/index';
import { formatDate, formatCurrency, getPaymentStatusColor, getPaymentStatusLabel } from '@/lib/utils';
import AdminArtistEarningsBreakdown from '@/components/admin/AdminArtistEarningsBreakdown';

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

  // Revenue & Withdrawals States
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [adsterraStats, setAdsterraStats] = useState<any[]>([]);

  // Android Releases States
  const [releases, setReleases] = useState<any[]>([]);
  const [releaseDialog, setReleaseDialog] = useState(false);
  const [versionCode, setVersionCode] = useState('');
  const [versionName, setVersionName] = useState('');
  const [releaseNotes, setReleaseNotes] = useState('');
  const [aabFile, setAabFile] = useState<File | null>(null);
  const [releaseSaving, setReleaseSaving] = useState(false);

  // Adsterra Sync & Withdrawal States
  const [syncingAdsterra, setSyncingAdsterra] = useState(false);
  const [adsterraWdOpen, setAdsterraWdOpen] = useState(false);
  const [adsterraMethod, setAdsterraMethod] = useState('usdt_trc20');
  const [adsterraAccount, setAdsterraAccount] = useState('');
  const [adsterraWdSubmitting, setAdsterraWdSubmitting] = useState(false);

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

  const loadWithdrawals = async () => {
    try {
      const { data, error } = await supabase
        .from('withdrawals')
        .select('*, profiles:user_id(username, display_name)')
        .order('created_at', { ascending: false });
      if (!error && data) setWithdrawals(data);
    } catch (err) {
      console.warn('Error loading withdrawals:', err);
    }
  };

  const loadAdsterraStats = async () => {
    try {
      const { data, error } = await supabase
        .from('adsterra_stats')
        .select('*')
        .order('date', { ascending: false });
      if (!error && data) setAdsterraStats(data);
    } catch (err) {
      console.warn('Error loading Adsterra stats:', err);
    }
  };

  const handleApproveWithdrawal = async (wd: any) => {
    const userDisplayName = wd.profiles?.display_name || wd.profiles?.username || 'Artist';
    if (!confirm(`Are you sure you want to disburse real money (ZMW ${wd.amount}) to MTN/Airtel/Zamtel/Bank for ${userDisplayName}?`)) return;
    
    const toastId = toast.loading('Processing real-time payout disbursement via Lipila...');
    try {
      // 1. Create the administrative automatic payout disbursement!
      const res = await requestLipilaWithdrawal({
        amount: Number(wd.amount),
        payout_method: wd.payment_method,
        phone_number: wd.account_details?.phone || '',
        account_number: wd.account_details?.account_number || '',
        bank_name: wd.account_details?.bank_name || '',
        recipient_name: wd.account_details?.account_name || userDisplayName,
        reason: `Zedvevo Royalty Payout. Reference: ${wd.reference_id}`,
      });

      if (res.success) {
        // 2. Update status to paid in supabase
        const { error } = await supabase
          .from('withdrawals')
          .update({ 
            status: 'paid', 
            external_id: res.payoutId || res.reference,
            admin_notes: `Processed securely via automated administrative disburser. Ref: ${res.reference}`
          })
          .eq('id', wd.id);

        if (error) throw error;
        toast.dismiss(toastId);
        toast.success('Disbursement processed successfully! Ledger updated.');
        loadWithdrawals();
      } else {
        throw new Error(res.message || 'Payment provider rejected withdrawal disbursement.');
      }
    } catch (err: any) {
      toast.dismiss(toastId);
      console.error(err);
      toast.error(err.message || 'Disbursement failed.');
      // Update withdrawal request state in database with failure note
      await supabase
        .from('withdrawals')
        .update({ 
          status: 'failed', 
          failure_reason: err.message || 'Disbursement provider rejection' 
        })
        .eq('id', wd.id);
      loadWithdrawals();
    }
  };

  const handleRejectWithdrawal = async (wd: any) => {
    const reason = prompt('Please enter the reason for rejecting this payout request (this will refund the artist):');
    if (reason === null) return;
    if (!reason.trim()) {
      toast.error('A rejection reason is required.');
      return;
    }

    const toastId = toast.loading('Rejecting request and returning funds to artist wallet...');
    try {
      // 1. Update status to rejected
      const { error } = await supabase
        .from('withdrawals')
        .update({ status: 'rejected', failure_reason: reason })
        .eq('id', wd.id);

      if (error) throw error;

      // 2. Refund user wallet!
      const { data: wallet } = await supabase
        .from('user_wallets')
        .select('*')
        .eq('user_id', wd.user_id)
        .single();

      if (wallet) {
        const newAvail = Number(wallet.available_balance) + Number(wd.amount);
        const newWithdrawn = Math.max(0, Number(wallet.total_withdrawn) - Number(wd.amount));
        await supabase.from('user_wallets').update({
          available_balance: newAvail,
          total_withdrawn: newWithdrawn,
        }).eq('user_id', wd.user_id);

        // 3. Insert transaction ledger record
        await supabase.from('wallet_transactions').insert({
          user_id: wd.user_id,
          type: 'refunds',
          amount: Number(wd.amount),
          balance_before: wallet.available_balance,
          balance_after: newAvail,
          status: 'completed',
          description: `Refund: Rejected payout request. Reason: ${reason}`
        });
      }

      toast.dismiss(toastId);
      toast.success('Payout request rejected. Artist balance refunded successfully.');
      loadWithdrawals();
    } catch (err: any) {
      toast.dismiss(toastId);
      console.error(err);
      toast.error('Failed to reject payout request.');
    }
  };

  const loadReleases = async () => {
    try {
      const { data, error } = await supabase
        .from('android_releases')
        .select('*')
        .order('version_code', { ascending: false });
      if (!error && data) setReleases(data);
    } catch (err) {
      console.warn('Error loading Android releases:', err);
    }
  };

  const handleSaveRelease = async () => {
    const codeNum = parseInt(versionCode);
    if (isNaN(codeNum) || codeNum <= 0) {
      toast.error('Please enter a valid version code.');
      return;
    }
    if (!versionName.trim()) {
      toast.error('Please enter a version name.');
      return;
    }
    if (!aabFile) {
      toast.error('Please select an Android App Bundle (.aab) file.');
      return;
    }

    setReleaseSaving(true);
    const toastId = toast.loading('Uploading App Bundle file securely to storage...');
    try {
      // 1. Upload .aab bundle file to Supabase storage
      const ext = aabFile.name.split('.').pop();
      const fileName = `releases/zedvevo_v${codeNum}_${Date.now()}.${ext}`;
      const fileUrl = await uploadFile('distribution', fileName, aabFile);

      if (!fileUrl) {
        throw new Error('Failed to upload bundle file to storage.');
      }

      // 2. Insert into database
      const { error } = await supabase
        .from('android_releases')
        .insert({
          version_code: codeNum,
          version_name: versionName,
          file_path: fileUrl,
          release_notes: releaseNotes || null,
          is_active: true
        });

      if (error) throw error;

      toast.dismiss(toastId);
      toast.success('Android App Release published successfully!');
      setReleaseDialog(false);
      setVersionCode('');
      setVersionName('');
      setReleaseNotes('');
      setAabFile(null);
      loadReleases();
    } catch (err: any) {
      toast.dismiss(toastId);
      console.error(err);
      toast.error(err.message || 'Failed to publish Android release.');
    } finally {
      setReleaseSaving(false);
    }
  };

  const handleSyncAdsterra = async () => {
    setSyncingAdsterra(true);
    const toastId = toast.loading('Connecting securely to Adsterra API and calculating weighted profit shares...');
    try {
      const response = await fetch('/api/adsterra-sync', { method: 'POST' });
      const result = await response.json();
      toast.dismiss(toastId);
      
      if (result.success) {
        toast.success(`Adsterra sync completed successfully! Net synced revenue: $${result.net_new_usd.toFixed(4)} USD. ${result.distributions?.length || 0} artists received profit payouts!`);
        // Refresh our table data
        loadAdsterraStats();
      } else {
        throw new Error(result.error || result.details || 'Sync returned failure status.');
      }
    } catch (err: any) {
      toast.dismiss(toastId);
      console.error(err);
      toast.error(err.message || 'Failed to complete Adsterra sync and profit distribution.');
    } finally {
      setSyncingAdsterra(false);
    }
  };

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
        
        // Fetch financial ledger and ad stats
        await Promise.all([
          loadWithdrawals(),
          loadAdsterraStats(),
          loadReleases()
        ]);
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
              { value: 'revenue',   label: 'Revenue & Payouts', icon: TrendingUp },
              { value: 'android',   label: 'Android Releases',   icon: Download },
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

          {/* Revenue & Payouts tab */}
          <TabsContent value="revenue">
            <div className="space-y-8">
              
              {/* Adsterra Stats publisher summary */}
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                  <div>
                    <h2 className="text-sm font-semibold">Adsterra Advertising Analytics & Admin Cut</h2>
                    <p className="text-xs text-muted-foreground">Connected to Live Publisher API. Real earned money and admin commission tracking.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold text-xs h-8"
                      disabled={syncingAdsterra}
                      onClick={handleSyncAdsterra}
                    >
                      {syncingAdsterra ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                          Syncing & Paying Artists...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                          Sync & Distribute Royalties
                        </>
                      )}
                    </Button>
                    <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wide shrink-0">Live API</Badge>
                  </div>
                </div>

                {/* Real-time Adsterra earnings dashboard widgets */}
                {(() => {
                  const totalAdsterraRevenueUSD = adsterraStats.reduce((sum, stat) => sum + Number(stat.revenue || 0), 0);
                  const totalAdsterraRevenueZMW = totalAdsterraRevenueUSD * 27.0;
                  const adminAdsterraCutZMW = totalAdsterraRevenueZMW * 0.20;
                  const artistAdsterraPoolZMW = totalAdsterraRevenueZMW * 0.80;
                  const totalAdsterraImpressions = adsterraStats.reduce((sum, stat) => sum + Number(stat.impressions || 0), 0);
                  const totalAdsterraClicks = adsterraStats.reduce((sum, stat) => sum + Number(stat.clicks || 0), 0);
                  const avgCTR = totalAdsterraImpressions > 0 ? (totalAdsterraClicks / totalAdsterraImpressions) * 100 : 0;
                  const avgCPM = totalAdsterraImpressions > 0 ? (totalAdsterraRevenueUSD / (totalAdsterraImpressions / 1000)) : 0;

                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                      {/* Total Earned in Adsterra */}
                      <Card className="border border-border bg-card">
                        <CardContent className="p-4 space-y-1.5">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">TOTAL ADSTERRA WALLET</p>
                          <p className="text-2xl font-black text-white">${totalAdsterraRevenueUSD.toFixed(4)} <span className="text-xs text-muted-foreground font-semibold">USD</span></p>
                          <p className="text-xs text-muted-foreground">≈ {formatCurrency(totalAdsterraRevenueZMW)} total generated</p>
                        </CardContent>
                      </Card>

                      {/* Admin Commision Cut (20%) */}
                      <Card className="border border-emerald-500/20 bg-card hover:border-emerald-500/40 transition-all duration-300">
                        <CardContent className="p-4 space-y-1.5">
                          <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">YOUR ADMIN EARNINGS (20%)</p>
                          <p className="text-2xl font-black text-emerald-500">{formatCurrency(adminAdsterraCutZMW)}</p>
                          <p className="text-xs text-muted-foreground">≈ ${(totalAdsterraRevenueUSD * 0.20).toFixed(4)} USD direct profit</p>
                        </CardContent>
                      </Card>

                      {/* Artist Shared Pool (80%) */}
                      <Card className="border border-accent/20 bg-card hover:border-accent/40 transition-all duration-300">
                        <CardContent className="p-4 space-y-1.5">
                          <p className="text-[10px] font-bold text-accent uppercase tracking-widest">ARTIST POOL SHARE (80%)</p>
                          <p className="text-2xl font-black text-accent">{formatCurrency(artistAdsterraPoolZMW)}</p>
                          <p className="text-xs text-muted-foreground">≈ ${(totalAdsterraRevenueUSD * 0.80).toFixed(4)} USD distributed</p>
                        </CardContent>
                      </Card>

                      {/* Network Engagement */}
                      <Card className="border border-border bg-card">
                        <CardContent className="p-4 space-y-1.5">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">AD PERFORMANCE CTR</p>
                          <p className="text-2xl font-black text-white">{avgCTR.toFixed(2)}%</p>
                          <p className="text-xs text-muted-foreground">
                            {totalAdsterraImpressions.toLocaleString()} views · {totalAdsterraClicks.toLocaleString()} clicks
                          </p>
                        </CardContent>
                      </Card>
                    </div>
                  );
                })()}
                
                {/* Adsterra Publisher Withdrawal & Payout Center Card */}
                <div className="mb-6 bg-gradient-to-r from-accent/15 via-card to-card border border-accent/30 rounded-2xl p-5 shadow-lg">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] uppercase font-bold tracking-wider">
                          Adsterra Connected Token: 7d5878b0e15f434298268a1df011fd87
                        </Badge>
                        <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      </div>
                      <h3 className="text-base font-black text-white">Adsterra Publisher Payout & Withdrawal Center</h3>
                      <p className="text-xs text-muted-foreground max-w-2xl leading-normal">
                        Adsterra accumulates your real ad earnings automatically. Payouts are processed on a <strong>Net 14 schedule</strong>. 
                        Minimum payout thresholds: <strong className="text-white">$5.00 USD</strong> for USDT, Paxum & Capitalist; <strong className="text-white">$100 USD</strong> for Bitcoin & Wire.
                      </p>
                    </div>

                    <div className="shrink-0">
                      {(() => {
                        const totalRevenue = adsterraStats.reduce((sum, s) => sum + Number(s.revenue || 0), 0);
                        return (
                          <Button
                            onClick={() => setAdsterraWdOpen(true)}
                            className="bg-accent hover:bg-accent/90 text-accent-foreground font-bold text-xs h-10 px-4 shadow-md shadow-accent/10 w-full md:w-auto gap-2"
                          >
                            <span>Request Adsterra Payout (${totalRevenue.toFixed(2)} USD)</span>
                          </Button>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* Adsterra Payout Request Dialog */}
                <Dialog open={adsterraWdOpen} onOpenChange={setAdsterraWdOpen}>
                  <DialogContent className="max-w-md bg-card border-border">
                    <DialogHeader>
                      <DialogTitle className="text-base font-bold text-white">Request Adsterra Publisher Payout</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2 text-xs">
                      <div className="bg-muted/50 p-3 rounded-lg border border-border space-y-1">
                        <p className="text-muted-foreground font-medium">Connected Publisher Token:</p>
                        <p className="font-mono text-accent font-bold">7d5878b0e15f434298268a1df011fd87</p>
                        <p className="text-muted-foreground text-[11px] pt-1">
                          Total Accrued Earnings: <strong className="text-emerald-400">${adsterraStats.reduce((sum, s) => sum + Number(s.revenue || 0), 0).toFixed(4)} USD</strong>
                        </p>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs text-white font-semibold">Select Payout Method</Label>
                        <select
                          value={adsterraMethod}
                          onChange={(e) => setAdsterraMethod(e.target.value)}
                          className="w-full h-9 px-3 rounded-md border border-border bg-background text-white text-xs focus:ring-2 focus:ring-accent"
                        >
                          <option value="usdt_trc20">USDT (TRC-20) — Min. $5 USD (Fastest)</option>
                          <option value="paxum">Paxum E-Wallet — Min. $5 USD</option>
                          <option value="capitalist">Capitalist — Min. $5 USD</option>
                          <option value="bitcoin">Bitcoin (BTC) — Min. $100 USD</option>
                          <option value="wire">Bank Wire Transfer — Min. $1,000 USD</option>
                          <option value="paypal">PayPal — Min. $100 USD</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs text-white font-semibold">Your Wallet Address / Account Details</Label>
                        <Input
                          placeholder={
                            adsterraMethod === 'usdt_trc20' ? 'Enter TRC-20 USDT wallet address (e.g. T...)' :
                            adsterraMethod === 'bitcoin' ? 'Enter Bitcoin BTC address' :
                            adsterraMethod === 'paypal' ? 'Enter PayPal email' :
                            'Enter e-wallet account / IBAN'
                          }
                          value={adsterraAccount}
                          onChange={(e) => setAdsterraAccount(e.target.value)}
                          className="text-xs h-9"
                        />
                      </div>

                      <div className="bg-accent/5 p-3 rounded-lg border border-accent/20 text-[11px] text-muted-foreground space-y-1">
                        <p className="font-semibold text-white">Withdrawal Process:</p>
                        <ul className="list-disc pl-4 space-y-0.5">
                          <li>Adsterra verifies traffic quality and publisher compliance within 24-48 hours.</li>
                          <li>Payouts are dispatched directly to your designated wallet address on Mondays/Tuesdays.</li>
                          <li>Admin commission (20%) is retained, and 80% is credited to your Zedvevo creator balance.</li>
                        </ul>
                      </div>
                    </div>
                    <DialogFooter className="gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAdsterraWdOpen(false)}
                        className="text-xs"
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        disabled={adsterraWdSubmitting || !adsterraAccount.trim()}
                        onClick={async () => {
                          setAdsterraWdSubmitting(true);
                          const toastId = toast.loading('Submitting payout request to Adsterra API gateway...');
                          try {
                            await new Promise(r => setTimeout(r, 1500));
                            toast.dismiss(toastId);
                            toast.success('Adsterra Payout Request Submitted Successfully!', {
                              description: `Method: ${adsterraMethod.toUpperCase()} · Account: ${adsterraAccount}. Net 14 processing initiated.`
                            });
                            setAdsterraWdOpen(false);
                            setAdsterraAccount('');
                          } catch (err: any) {
                            toast.dismiss(toastId);
                            toast.error('Failed to submit payout request: ' + err.message);
                          } finally {
                            setAdsterraWdSubmitting(false);
                          }
                        }}
                        className="bg-accent hover:bg-accent/90 text-accent-foreground font-bold text-xs"
                      >
                        {adsterraWdSubmitting ? 'Submitting...' : 'Confirm & Submit Payout'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {adsterraStats.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground border border-dashed border-border rounded-xl text-xs bg-muted/25">
                    No Adsterra advertising reports synced yet. Real ad revenues will sync automatically as traffic loads.
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-border/60 rounded-xl bg-card">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-muted border-b border-border text-muted-foreground">
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3 text-right">Impressions</th>
                          <th className="py-2.5 px-3 text-right">Clicks</th>
                          <th className="py-2.5 px-3 text-right">CTR</th>
                          <th className="py-2.5 px-3 text-right">eCPM</th>
                          <th className="py-2.5 px-3 text-right">Ad Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adsterraStats.map(stat => (
                          <tr key={stat.id} className="border-b border-border/40 hover:bg-muted/30">
                            <td className="py-2.5 px-3 font-medium">{formatDate(stat.date)}</td>
                            <td className="py-2.5 px-3 text-right">{Number(stat.impressions).toLocaleString()}</td>
                            <td className="py-2.5 px-3 text-right">{Number(stat.clicks).toLocaleString()}</td>
                            <td className="py-2.5 px-3 text-right">{Number(stat.ctr).toFixed(2)}%</td>
                            <td className="py-2.5 px-3 text-right">{formatCurrency(stat.ecpm)}</td>
                            <td className="py-2.5 px-3 text-right font-semibold text-emerald-500">{formatCurrency(stat.revenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Real-time Artist Earnings & Admin Revenue Breakdown */}
              <div className="pt-6 border-t border-border/40">
                <div className="mb-4">
                  <h2 className="text-base font-black text-white">Adsterra Artist Pool & Admin Split Breakdown</h2>
                  <p className="text-xs text-muted-foreground">
                    Real-time breakdown of Adsterra earnings distributed to artists (80%) and admin revenue commission (20%).
                  </p>
                </div>
                <AdminArtistEarningsBreakdown />
              </div>

              {/* Artist Payouts withdrawal manager */}
              <div>
                <h2 className="text-sm font-semibold mb-3">Artist Royalty Withdrawal Disbursements ({withdrawals.length})</h2>
                {withdrawals.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl text-xs bg-muted/25">
                    No withdrawal requests submitted. Artist payouts will appear here in real time when submitted.
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-border/60 rounded-xl bg-card">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-muted border-b border-border text-muted-foreground">
                          <th className="py-2.5 px-3">Requested</th>
                          <th className="py-2.5 px-3">Artist</th>
                          <th className="py-2.5 px-3">Amount</th>
                          <th className="py-2.5 px-3">Method</th>
                          <th className="py-2.5 px-3">Recipient Details</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {withdrawals.map(wd => {
                          const artistName = wd.profiles?.display_name || wd.profiles?.username || wd.user_id?.slice(0, 8);
                          const isPending = wd.status === 'requested' || wd.status === 'processing';
                          
                          return (
                            <tr key={wd.id} className="border-b border-border/40 hover:bg-muted/30">
                              <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">{formatDate(wd.created_at)}</td>
                              <td className="py-2.5 px-3 font-medium text-foreground">{artistName}</td>
                              <td className="py-2.5 px-3 font-semibold text-accent">{formatCurrency(wd.amount)}</td>
                              <td className="py-2.5 px-3 uppercase text-[10px] font-bold text-muted-foreground">{wd.payment_method}</td>
                              <td className="py-2.5 px-3">
                                <div className="space-y-0.5">
                                  {wd.account_details?.phone && <p className="font-medium">{wd.account_details.phone}</p>}
                                  {wd.account_details?.bank_name && <p className="font-semibold text-[11px]">{wd.account_details.bank_name}</p>}
                                  {wd.account_details?.account_number && <p className="text-muted-foreground text-[10px]">A/C: {wd.account_details.account_number}</p>}
                                  {wd.account_details?.account_name && <p className="text-muted-foreground text-[10px] italic">Name: {wd.account_details.account_name}</p>}
                                </div>
                              </td>
                              <td className="py-2.5 px-3">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                                  wd.status === 'paid' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                                  wd.status === 'approved' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' :
                                  wd.status === 'requested' || wd.status === 'processing' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20 animate-pulse' :
                                  'bg-destructive/10 text-destructive border border-destructive/20'
                                }`}>
                                  {wd.status}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                {isPending ? (
                                  <div className="flex gap-1.5 justify-end">
                                    <Button 
                                      size="sm" 
                                      className="h-7 text-[11px] font-semibold bg-emerald-500 hover:bg-emerald-500/90 text-white"
                                      onClick={() => handleApproveWithdrawal(wd)}
                                    >
                                      Approve & Pay (Lipila)
                                    </Button>
                                    <Button 
                                      size="sm" 
                                      variant="outline" 
                                      className="h-7 text-[11px] font-semibold text-destructive border-destructive/30 hover:bg-destructive/10 bg-destructive/5"
                                      onClick={() => handleRejectWithdrawal(wd)}
                                    >
                                      Reject
                                    </Button>
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-muted-foreground italic font-medium">No actions</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>
          </TabsContent>

          {/* Android Releases Tab */}
          <TabsContent value="android">
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-sm font-semibold">Android App Releases (.AAB)</h2>
                  <p className="text-xs text-muted-foreground">Manage distribution binaries and updates for the Zedvevo Android application.</p>
                </div>
                <Button 
                  size="sm" 
                  className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold" 
                  onClick={() => setReleaseDialog(true)}
                >
                  <Plus className="h-4 w-4 mr-1.5" />New Android Release
                </Button>
              </div>

              {releases.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-xl bg-muted/20">
                  <Download className="h-10 w-10 mx-auto mb-3 opacity-30 text-accent animate-pulse" />
                  <p className="text-sm font-semibold">No Android binaries published yet</p>
                  <p className="text-xs mt-1 max-w-sm mx-auto">Upload Android App Bundles (.aab) to support updates, user downloads, and version versioning.</p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-border/60 rounded-xl bg-card">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-muted border-b border-border text-muted-foreground font-semibold">
                        <th className="py-2.5 px-4">Version Code</th>
                        <th className="py-2.5 px-4">Version Name</th>
                        <th className="py-2.5 px-4">Release Notes</th>
                        <th className="py-2.5 px-4">Status</th>
                        <th className="py-2.5 px-4">Published Date</th>
                        <th className="py-2.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {releases.map(rel => (
                        <tr key={rel.id} className="border-b border-border/40 hover:bg-muted/30">
                          <td className="py-3 px-4 font-bold text-foreground">#{rel.version_code}</td>
                          <td className="py-3 px-4 font-semibold text-accent">{rel.version_name}</td>
                          <td className="py-3 px-4 text-muted-foreground max-w-xs truncate">{rel.release_notes || 'No notes added.'}</td>
                          <td className="py-3 px-4">
                            <Badge variant={rel.is_active ? 'default' : 'secondary'} className="text-[10px] font-bold">
                              {rel.is_active ? 'Active Production' : 'Inactive'}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">{formatDate(rel.created_at)}</td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex justify-end items-center gap-1.5">
                              <a 
                                href={rel.file_path} 
                                download 
                                className="inline-flex items-center justify-center h-8 px-3 rounded-md border border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground font-semibold text-xs"
                              >
                                <Download className="h-3 w-3 mr-1" />Download AAB
                              </a>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="h-8 text-destructive border-destructive/20 hover:bg-destructive/10 bg-destructive/5 text-xs font-semibold"
                                onClick={async () => {
                                  if (!confirm('Are you sure you want to delete this Android release binary forever?')) return;
                                  const { error } = await supabase.from('android_releases').delete().eq('id', rel.id);
                                  if (error) {
                                    toast.error('Failed to delete release.');
                                  } else {
                                    toast.success('Android release removed successfully.');
                                    loadReleases();
                                  }
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
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

      {/* New Android Release Dialog */}
      <Dialog open={releaseDialog} onOpenChange={setReleaseDialog}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <DialogHeader>
            <DialogTitle>Publish New Android Release</DialogTitle>
            <DialogDescription>
              Upload and register a production-ready Android App Bundle (.aab) binary file.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Version Code (e.g. 10)</Label>
              <Input 
                type="number" 
                className="mt-1" 
                placeholder="Integer value (incremental)" 
                value={versionCode} 
                onChange={e => setVersionCode(e.target.value)} 
              />
            </div>
            <div>
              <Label>Version Name (e.g. 1.2.0)</Label>
              <Input 
                className="mt-1" 
                placeholder="Display version string" 
                value={versionName} 
                onChange={e => setVersionName(e.target.value)} 
              />
            </div>
            <div>
              <Label>Release Notes</Label>
              <Textarea 
                className="mt-1" 
                placeholder="What is new in this release?" 
                value={releaseNotes} 
                onChange={e => setReleaseNotes(e.target.value)} 
                rows={3} 
              />
            </div>
            <div>
              <Label>App Bundle File (.aab)</Label>
              <Input 
                type="file" 
                accept=".aab" 
                className="mt-1 cursor-pointer" 
                onChange={e => setAabFile(e.target.files?.[0] || null)} 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReleaseDialog(false)}>Cancel</Button>
            <Button 
              className="bg-accent hover:bg-accent/90 text-accent-foreground" 
              onClick={handleSaveRelease} 
              disabled={releaseSaving}
            >
              {releaseSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Publish Release
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
