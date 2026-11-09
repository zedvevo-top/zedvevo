import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/db/supabase';
import { Plus, Pencil, Trash2, Loader2, Bell, Download, Globe, Search, Share2, Sparkles, CheckCircle2, Copy, Image as ImageIcon, Upload, RefreshCw, Shield, Volume2, Play, Music } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  getAllPlans, updatePlan, getAllBanners, createBanner, updateBanner, deleteBanner,
  getSettings, updateSetting, createNotification, uploadFile, getAllDownloads,
  getAllSettingsKeys, createSetting, deleteSetting,
} from '@/lib/api';
import { formatDate } from '@/lib/utils';
import type { UploadPlan, HeroBanner, Download as DownloadType, AppSetting } from '@/types/index';
import ZedVevoWatermark from '@/components/common/ZedVevoWatermark';
import { playZedVevoIntroTag, playZedVevoOutroTag, playZedVevoIntroTagSequence } from '@/services/audioTagService';

type NotifType = 'info' | 'success' | 'warning' | 'error';

export default function AdminSettingsPage() {
  const [plans, setPlans]         = useState<UploadPlan[]>([]);
  const [banners, setBanners]     = useState<HeroBanner[]>([]);
  const [settings, setSettings]   = useState<Record<string, string>>({});
  const [downloads, setDownloads] = useState<DownloadType[]>([]);
  const [loading, setLoading]     = useState(true);

  // Banner dialog
  const [bannerDlg, setBannerDlg]   = useState<{ open: boolean; banner?: HeroBanner }>({ open: false });
  const [banTitle, setBanTitle]   = useState('');
  const [banSub, setBanSub]       = useState('');
  const [banBtnText, setBanBtnText] = useState('');
  const [banBtnUrl, setBanBtnUrl] = useState('');
  const [banOrder, setBanOrder]   = useState('0');
  const [banActive, setBanActive] = useState(true);
  const [banImage, setBanImage]   = useState<File | null>(null);
  const [banSaving, setBanSaving] = useState(false);

  // Notification broadcast
  const [notifTitle, setNotifTitle]   = useState('');
  const [notifMsg, setNotifMsg]       = useState('');
  const [notifType, setNotifType]     = useState<NotifType>('info');
  const [notifSending, setNotifSending] = useState(false);

  // Setting saving tracker
  const [settingSaving, setSettingSaving] = useState<Record<string, boolean>>({});

  const [allSettingsKeys, setAllSettingsKeys] = useState<AppSetting[]>([]);
  const [newKeyDlg, setNewKeyDlg] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newVal, setNewVal] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newSaving, setNewSaving] = useState(false);

  // Watermark & Audio Tag settings state
  const watermarkIconFileRef = useRef<HTMLInputElement>(null);
  const [watermarkUploading, setWatermarkUploading] = useState(false);
  const [watermarkIconInput, setWatermarkIconInput] = useState('');

  const audioTagCustomFileRef = useRef<HTMLInputElement>(null);
  const audioBrandingJingleRef = useRef<HTMLInputElement>(null);
  const audioBrandingVoiceRef = useRef<HTMLInputElement>(null);
  
  const [audioTagUploading, setAudioTagUploading] = useState(false);
  const [audioBrandingJingleUploading, setAudioBrandingJingleUploading] = useState(false);
  const [audioBrandingVoiceUploading, setAudioBrandingVoiceUploading] = useState(false);

  const [audioTagCustomInput, setAudioTagCustomInput] = useState('');
  const [audioBrandingJingleInput, setAudioBrandingJingleInput] = useState('');
  const [audioBrandingVoiceInput, setAudioBrandingVoiceInput] = useState('');

  const [audioIntroText, setAudioIntroText] = useState('');
  const [audioOutroText, setAudioOutroText] = useState('');

  useEffect(() => {
    setWatermarkIconInput(settings['watermark_app_icon_url'] || '');
    setAudioTagCustomInput(settings['audio_tag_custom_file_url'] || '');
    setAudioBrandingJingleInput(settings['audio_branding_jingle_url'] || '');
    setAudioBrandingVoiceInput(settings['audio_branding_voice_url'] || '');

    if (settings['audio_tag_intro_text']) {
      setAudioIntroText(settings['audio_tag_intro_text']);
    } else {
      setAudioIntroText('Thank You For Streaming On Zed Vevo');
    }
    if (settings['audio_tag_outro_text']) {
      setAudioOutroText(settings['audio_tag_outro_text']);
    } else {
      setAudioOutroText('Are You An Artist or Content Creator? Download Zed Vevo App And Discover How To Earn Money');
    }
  }, [settings]);

  const handleAudioBrandingJingleUpload = async (file: File) => {
    setAudioBrandingJingleUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'mp3';
      const path = `watermarks/rock-jingle-${Date.now()}.${ext}`;
      let publicUrl = '';
      try {
        publicUrl = await uploadFile('songs', path, file);
      } catch {
        const reader = new FileReader();
        publicUrl = await new Promise<string>((resolve) => {
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(file);
        });
      }
      setAudioBrandingJingleInput(publicUrl);
      await saveSetting('audio_branding_jingle_url', publicUrl);
      await saveSetting('audio_tag_custom_file_url', publicUrl);
      window.dispatchEvent(new CustomEvent('zed_settings_updated'));
      toast.success('Rock style jingle audio uploaded and attached globally!');
    } catch (err: any) {
      toast.error('Could not upload rock jingle audio: ' + (err.message || 'Unknown error'));
    } finally {
      setAudioBrandingJingleUploading(false);
    }
  };

  const handleAudioBrandingVoiceUpload = async (file: File) => {
    setAudioBrandingVoiceUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'mp3';
      const path = `watermarks/voice-message-${Date.now()}.${ext}`;
      let publicUrl = '';
      try {
        publicUrl = await uploadFile('songs', path, file);
      } catch {
        const reader = new FileReader();
        publicUrl = await new Promise<string>((resolve) => {
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(file);
        });
      }
      setAudioBrandingVoiceInput(publicUrl);
      await saveSetting('audio_branding_voice_url', publicUrl);
      window.dispatchEvent(new CustomEvent('zed_settings_updated'));
      toast.success('Thank You voice message audio uploaded and attached globally!');
    } catch (err: any) {
      toast.error('Could not upload voice message audio: ' + (err.message || 'Unknown error'));
    } finally {
      setAudioBrandingVoiceUploading(false);
    }
  };

  const handleSaveAudioBrandingJingleUrl = async () => {
    await saveSetting('audio_branding_jingle_url', audioBrandingJingleInput.trim());
    await saveSetting('audio_tag_custom_file_url', audioBrandingJingleInput.trim());
    window.dispatchEvent(new CustomEvent('zed_settings_updated'));
    toast.success('Rock jingle URL saved');
  };

  const handleSaveAudioBrandingVoiceUrl = async () => {
    await saveSetting('audio_branding_voice_url', audioBrandingVoiceInput.trim());
    window.dispatchEvent(new CustomEvent('zed_settings_updated'));
    toast.success('Voice message URL saved');
  };

  const handleAudioTagCustomFileUpload = async (file: File) => {
    setAudioTagUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'mp3';
      const path = `watermarks/audio-jingle-${Date.now()}.${ext}`;
      let publicUrl = '';
      try {
        publicUrl = await uploadFile('songs', path, file);
      } catch {
        const reader = new FileReader();
        publicUrl = await new Promise<string>((resolve) => {
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(file);
        });
      }
      setAudioTagCustomInput(publicUrl);
      await saveSetting('audio_tag_custom_file_url', publicUrl);
      window.dispatchEvent(new CustomEvent('zed_settings_updated'));
      toast.success('Custom audio jingle tag uploaded and set!');
    } catch (err: any) {
      toast.error('Could not upload audio jingle: ' + (err.message || 'Unknown error'));
    } finally {
      setAudioTagUploading(false);
    }
  };

  const handleSaveAudioTagCustomUrl = async () => {
    await saveSetting('audio_tag_custom_file_url', audioTagCustomInput.trim());
    window.dispatchEvent(new CustomEvent('zed_settings_updated'));
    toast.success('Custom audio tag URL updated');
  };

  const watermarkEnabled = settings['watermark_enabled'] !== 'false';
  const watermarkUseAppIcon = settings['watermark_use_app_icon'] !== 'false';
  const audioTagEnabled = settings['audio_tag_enabled'] !== 'false';
  const audioTagIntroBeat = settings['audio_tag_intro_beat'] !== 'false';
  const audioTagSpeed = settings['audio_tag_speed'] || '0.84';
  const audioTagOutroEnabled = settings['audio_tag_outro_enabled'] !== 'false';

  const currentWatermarkIcon =
    settings['watermark_app_icon_url'] ||
    settings['app_logo_url'] ||
    settings['app_icon_url'] ||
    '/app-icon.png';

  const handleWatermarkIconUpload = async (file: File) => {
    setWatermarkUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const path = `branding/watermark-icon-${Date.now()}.${ext}`;
      let publicUrl = '';
      try {
        publicUrl = await uploadFile('covers', path, file);
      } catch {
        const reader = new FileReader();
        publicUrl = await new Promise<string>((resolve) => {
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(file);
        });
      }
      setWatermarkIconInput(publicUrl);
      await saveSetting('watermark_app_icon_url', publicUrl);
      window.dispatchEvent(new CustomEvent('zed_settings_updated'));
      toast.success('Watermark app icon uploaded and applied globally!');
    } catch (err: any) {
      toast.error('Could not upload watermark icon: ' + (err.message || 'Unknown error'));
    } finally {
      setWatermarkUploading(false);
    }
  };

  const handleSaveWatermarkIconUrl = async () => {
    if (!watermarkIconInput.trim()) return;
    await saveSetting('watermark_app_icon_url', watermarkIconInput.trim());
    window.dispatchEvent(new CustomEvent('zed_settings_updated'));
    toast.success('Watermark icon URL saved and applied globally!');
  };

  const toggleWatermarkEnabled = async (checked: boolean) => {
    await saveSetting('watermark_enabled', checked ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent('zed_settings_updated'));
  };

  const toggleWatermarkUseAppIcon = async (checked: boolean) => {
    await saveSetting('watermark_use_app_icon', checked ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent('zed_settings_updated'));
  };

  const toggleAudioTagEnabled = async (checked: boolean) => {
    await saveSetting('audio_tag_enabled', checked ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent('zed_settings_updated'));
  };

  const toggleAudioTagIntroBeat = async (checked: boolean) => {
    await saveSetting('audio_tag_intro_beat', checked ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent('zed_settings_updated'));
  };

  const toggleAudioTagOutroEnabled = async (checked: boolean) => {
    await saveSetting('audio_tag_outro_enabled', checked ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent('zed_settings_updated'));
  };

  const handleSaveIntroText = async () => {
    if (!audioIntroText.trim()) return;
    await saveSetting('audio_tag_intro_text', audioIntroText.trim());
    window.dispatchEvent(new CustomEvent('zed_settings_updated'));
    toast.success('Intro speech message saved');
  };

  const handleSaveOutroText = async () => {
    if (!audioOutroText.trim()) return;
    await saveSetting('audio_tag_outro_text', audioOutroText.trim());
    window.dispatchEvent(new CustomEvent('zed_settings_updated'));
    toast.success('Outro promo message saved');
  };

  const handleSaveSpeed = async (val: string) => {
    await saveSetting('audio_tag_speed', val);
    window.dispatchEvent(new CustomEvent('zed_settings_updated'));
    toast.success('Voice tag pace updated');
  };

  // SEO Audit State
  const [auditSongsCount, setAuditSongsCount] = useState(0);
  const [auditVideosCount, setAuditVideosCount] = useState(0);
  const [auditArtistsCount, setAuditArtistsCount] = useState(0);
  const [auditNomineesCount, setAuditNomineesCount] = useState(0);

  const [missingSongCovers, setMissingSongCovers] = useState<any[]>([]);
  const [missingSongDescriptions, setMissingSongDescriptions] = useState<any[]>([]);
  const [missingVideoThumbnails, setMissingVideoThumbnails] = useState<any[]>([]);
  const [missingVideoDescriptions, setMissingVideoDescriptions] = useState<any[]>([]);
  const [missingArtistBios, setMissingArtistBios] = useState<any[]>([]);
  const [missingArtistAvatars, setMissingArtistAvatars] = useState<any[]>([]);

  const [checkingAudit, setCheckingAudit] = useState(false);
  const [healthScore, setHealthScore] = useState(100);

  const runSeoAudit = async () => {
    setCheckingAudit(true);
    try {
      // 1. Songs audit
      const { data: songsData } = await supabase
        .from('songs')
        .select('id, title, description, cover_url, slug')
        .eq('status', 'approved');

      const songs = songsData || [];
      setAuditSongsCount(songs.length);

      const missingCovers = songs.filter((s: any) => !s.cover_url);
      const missingDescriptions = songs.filter((s: any) => !s.description || s.description.trim().length < 5);
      setMissingSongCovers(missingCovers);
      setMissingSongDescriptions(missingDescriptions);

      // 2. Videos audit
      const { data: videosData } = await supabase
        .from('videos')
        .select('id, title, description, thumbnail_url, slug');

      const videos = videosData || [];
      setAuditVideosCount(videos.length);

      const missingThumbnails = videos.filter((v: any) => !v.thumbnail_url);
      const missingVideoDescs = videos.filter((v: any) => !v.description || v.description.trim().length < 5);
      setMissingVideoThumbnails(missingThumbnails);
      setMissingVideoDescriptions(missingVideoDescs);

      // 3. Artists audit
      const { data: artistsData } = await supabase
        .from('artists')
        .select('id, stage_name, bio, cover_image_url');

      const artists = artistsData || [];
      setAuditArtistsCount(artists.length);

      const missingBios = artists.filter((a: any) => !a.bio || a.bio.trim().length < 5);
      const missingAvatars = artists.filter((a: any) => !a.cover_image_url);
      setMissingArtistBios(missingBios);
      setMissingArtistAvatars(missingAvatars);

      // 4. Nominees count
      const { data: nomineesData } = await supabase
        .from('nominees')
        .select('id');
      setAuditNomineesCount((nomineesData || []).length);

      // Calculate score out of 100
      let totalChecks = 6;
      let passedChecks = 0;

      if (missingCovers.length === 0) passedChecks++;
      if (missingDescriptions.length === 0) passedChecks++;
      if (missingThumbnails.length === 0) passedChecks++;
      if (missingVideoDescs.length === 0) passedChecks++;
      if (missingBios.length === 0) passedChecks++;
      if (missingAvatars.length === 0) passedChecks++;

      const score = Math.round((passedChecks / totalChecks) * 100);
      setHealthScore(score);
    } catch (err) {
      console.error('SEO audit error:', err);
    } finally {
      setCheckingAudit(false);
    }
  };

  useEffect(() => {
    runSeoAudit();
  }, []);

  useEffect(() => {
    Promise.all([getAllPlans(), getAllBanners(), getSettings(), getAllDownloads(), getAllSettingsKeys()])
      .then(([p, b, s, d, k]) => {
        setPlans(p);
        setBanners(b);
        setSettings(s);
        setDownloads(d);
        setAllSettingsKeys(k);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const refreshSettings = async () => {
    const [s, k] = await Promise.all([getSettings(), getAllSettingsKeys()]);
    setSettings(s);
    setAllSettingsKeys(k);
  };

  const saveSetting = async (key: string, value: string) => {
    setSettingSaving(p => ({ ...p, [key]: true }));
    try {
      await updateSetting(key, value);
      setSettings(p => ({ ...p, [key]: value }));
      setAllSettingsKeys(prev => prev.map(item => item.key === key ? { ...item, value } : item));
      toast.success('Setting saved');
    } catch {
      toast.error('Failed to save setting');
    } finally {
      setSettingSaving(p => ({ ...p, [key]: false }));
    }
  };

  const handleCreateSetting = async () => {
    if (!newKey.trim() || !newVal.trim()) {
      toast.error('Key and value required');
      return;
    }
    setNewSaving(true);
    try {
      await createSetting(newKey.trim(), newVal.trim(), newDesc.trim() || undefined);
      await refreshSettings();
      toast.success('New setting created');
      setNewKeyDlg(false);
      setNewKey('');
      setNewVal('');
      setNewDesc('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create setting');
    } finally {
      setNewSaving(false);
    }
  };

  const handleDeleteSetting = async (key: string) => {
    if (!confirm(`Are you sure you want to delete setting "${key}"?`)) return;
    try {
      await deleteSetting(key);
      await refreshSettings();
      toast.success(`Setting "${key}" deleted`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete setting');
    }
  };

  // Banner helpers
  const openBannerDlg = (banner?: HeroBanner) => {
    setBanTitle(banner?.title || ''); setBanSub(banner?.subtitle || '');
    setBanBtnText(banner?.button_text || ''); setBanBtnUrl(banner?.button_url || '');
    setBanOrder(String(banner?.display_order ?? 0)); setBanActive(banner?.is_active ?? true);
    setBanImage(null); setBannerDlg({ open: true, banner });
  };
  const handleSaveBanner = async () => {
    if (!banTitle) { toast.error('Title required'); return; }
    setBanSaving(true);
    try {
      let imageUrl = bannerDlg.banner?.image_url || '';
      if (banImage) imageUrl = await uploadFile('banners', `banner_${Date.now()}.${banImage.name.split('.').pop()}`, banImage);
      if (!imageUrl) { toast.error('Upload an image'); return; }
      const payload = { title: banTitle, subtitle: banSub || undefined, button_text: banBtnText || undefined, button_url: banBtnUrl || undefined, display_order: parseInt(banOrder), is_active: banActive, image_url: imageUrl };
      if (bannerDlg.banner) { await updateBanner(bannerDlg.banner.id, payload); }
      else { await createBanner(payload); }
      setBanners(await getAllBanners());
      toast.success(`Banner ${bannerDlg.banner ? 'updated' : 'created'}`);
      setBannerDlg({ open: false });
    } catch (e: unknown) { toast.error((e as Error).message); }
    finally { setBanSaving(false); }
  };

  const handleSendBroadcast = async () => {
    if (!notifTitle || !notifMsg) { toast.error('Title and message required'); return; }
    setNotifSending(true);
    try {
      await createNotification({ title: notifTitle, message: notifMsg, type: notifType, notification_type: 'general' });
      toast.success('Broadcast sent to all users');
      setNotifTitle(''); setNotifMsg('');
    } catch { toast.error('Failed to send broadcast'); }
    finally { setNotifSending(false); }
  };

  // Favicon & Branding state
  const [faviconUploading, setFaviconUploading] = useState(false);
  const [faviconUrlInput, setFaviconUrlInput] = useState('');
  const faviconFileRef = useRef<HTMLInputElement>(null);
  const logoFileRef = useRef<HTMLInputElement>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoUrlInput, setLogoUrlInput] = useState('');

  const currentFavicon = settings['app_favicon_url'] || settings['favicon_url'] || '/app-icon.png';
  const currentLogo = settings['app_logo_url'] || settings['logo_url'] || '/app-icon.png';

  const applyFaviconLive = (url: string) => {
    const icon = document.getElementById('dynamic-favicon') as HTMLLinkElement;
    if (icon) icon.href = url;
    const appleIcon = document.getElementById('dynamic-apple-favicon') as HTMLLinkElement;
    if (appleIcon) appleIcon.href = url;
    window.dispatchEvent(new CustomEvent('favicon_changed', { detail: url }));
  };

  const handleSaveFavicon = async (urlToSave: string) => {
    if (!urlToSave.trim()) return;
    try {
      await saveSetting('app_favicon_url', urlToSave.trim());
      await saveSetting('favicon_url', urlToSave.trim());
      applyFaviconLive(urlToSave.trim());
      toast.success('App favicon updated and applied live instantly!');
    } catch (err: any) {
      toast.error('Failed to update favicon: ' + (err.message || 'Unknown error'));
    }
  };

  const handleFaviconFileUpload = async (file: File) => {
    setFaviconUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const path = `branding/favicon-${Date.now()}.${ext}`;
      let publicUrl = '';
      try {
        publicUrl = await uploadFile('covers', path, file);
      } catch {
        const reader = new FileReader();
        publicUrl = await new Promise<string>((resolve) => {
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(file);
        });
      }
      setFaviconUrlInput(publicUrl);
      await handleSaveFavicon(publicUrl);
    } catch (err: any) {
      toast.error('Could not upload favicon: ' + (err.message || 'Unknown error'));
    } finally {
      setFaviconUploading(false);
    }
  };

  const handleLogoFileUpload = async (file: File) => {
    setLogoUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const path = `branding/logo-${Date.now()}.${ext}`;
      let publicUrl = '';
      try {
        publicUrl = await uploadFile('covers', path, file);
      } catch {
        const reader = new FileReader();
        publicUrl = await new Promise<string>((resolve) => {
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(file);
        });
      }
      setLogoUrlInput(publicUrl);
      await saveSetting('app_logo_url', publicUrl);
      await saveSetting('logo_url', publicUrl);
      toast.success('App logo updated successfully!');
    } catch (err: any) {
      toast.error('Could not upload logo: ' + (err.message || 'Unknown error'));
    } finally {
      setLogoUploading(false);
    }
  };

  const FAVICON_PRESETS = [
    { label: 'Gold Shield', url: '/app-icon.png', color: 'from-amber-500 to-yellow-600' },
    { label: 'Neon Soundwave', url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=64&h=64&fit=crop&crop=faces', color: 'from-primary to-accent' },
    { label: 'Emerald Vinyl', url: 'https://images.unsplash.com/photo-1539185441755-769473a23570?w=64&h=64&fit=crop&crop=faces', color: 'from-emerald-500 to-teal-600' },
    { label: 'Zambian Flame', url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=64&h=64&fit=crop&crop=faces', color: 'from-red-500 to-orange-500' },
  ];

  const exportDownloads = () => {
    const rows = [
      ['Date', 'Title', 'Artist', 'Type', 'User ID'],
      ...downloads.map(d => [formatDate(d.downloaded_at), d.title, d.artist_name, d.content_type, d.user_id]),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const a = document.createElement('a'); a.href = 'data:text/csv,' + encodeURIComponent(csv);
    a.download = 'downloads.csv'; a.click();
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage plans, banners, notifications, and app settings</p>
      </div>

      <Tabs defaultValue="plans">
        <TabsList className="h-8 flex-wrap">
          <TabsTrigger value="plans"    className="text-xs">Upload Plans</TabsTrigger>
          <TabsTrigger value="banners"  className="text-xs">Banners</TabsTrigger>
          <TabsTrigger value="notifications" className="text-xs">Notifications</TabsTrigger>
          <TabsTrigger value="downloads" className="text-xs">Downloads</TabsTrigger>
          <TabsTrigger value="app"      className="text-xs">App Config</TabsTrigger>
          <TabsTrigger value="branding" className="text-xs flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-amber-400" />
            Branding & Favicon
          </TabsTrigger>
          <TabsTrigger value="watermark" className="text-xs flex items-center gap-1.5">
            <Shield className="h-3 w-3 text-red-500" />
            Watermark & Voice Tags
          </TabsTrigger>
          <TabsTrigger value="seo"      className="text-xs flex items-center gap-1.5">
            <Globe className="h-3 w-3 text-accent" />
            SEO & Google Search
          </TabsTrigger>
        </TabsList>

        {/* Plans */}
        <TabsContent value="plans" className="mt-4">
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[600px] text-sm">
              <thead className="bg-muted/40">
                <tr>{['Plan', 'Price', 'Duration', 'Max Uploads', 'Active', 'Action'].map(h => (
                  <th key={h} className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {loading ? <tr><td colSpan={6} className="px-3 py-2"><Skeleton className="h-5 w-full" /></td></tr>
                : plans.map(plan => {
                  const [editPrice, setEditPrice] = [plan.price.toString(), () => {}];
                  return (
                    <PlanRow key={plan.id} plan={plan} onSave={async (updates) => {
                      await updatePlan(plan.id, updates);
                      setPlans(p => p.map(pl => pl.id === plan.id ? { ...pl, ...updates } : pl));
                      toast.success('Plan updated');
                    }} />
                  );
                  void editPrice; void setEditPrice;
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Banners */}
        <TabsContent value="banners" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Button size="sm" className="bg-accent hover:bg-accent/90 text-accent-foreground gap-1.5 text-xs" onClick={() => openBannerDlg()}>
              <Plus className="h-3.5 w-3.5" />Add Banner
            </Button>
          </div>
          {loading ? <Skeleton className="h-20 w-full" /> : banners.map(b => (
            <Card key={b.id}>
              <CardContent className="flex items-center gap-3 py-2.5 px-4">
                <div className="h-10 w-16 rounded overflow-hidden bg-muted shrink-0">
                  {b.image_url && <img src={b.image_url} alt={b.title} className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{b.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant={b.is_active ? 'default' : 'secondary'} className="text-[10px]">{b.is_active ? 'Active' : 'Inactive'}</Badge>
                    <span className="text-xs text-muted-foreground">Order: {b.display_order}</span>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openBannerDlg(b)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                    onClick={async () => { if (!confirm('Delete banner?')) return; await deleteBanner(b.id); setBanners(p => p.filter(x => x.id !== b.id)); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications" className="mt-4">
          <div className="max-w-lg space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Bell className="h-4 w-4 text-accent" />
              <p className="text-sm font-semibold">Broadcast to All Users</p>
            </div>
            <div><Label>Title *</Label><Input className="mt-1" value={notifTitle} onChange={e => setNotifTitle(e.target.value)} placeholder="e.g. New Feature Released" /></div>
            <div><Label>Message *</Label><Textarea className="mt-1 resize-none" rows={3} value={notifMsg} onChange={e => setNotifMsg(e.target.value)} placeholder="Message body…" /></div>
            <div>
              <Label>Type</Label>
              <Select value={notifType} onValueChange={v => setNotifType(v as NotifType)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="bg-accent hover:bg-accent/90 text-accent-foreground gap-1.5" onClick={handleSendBroadcast} disabled={notifSending}>
              {notifSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
              Send Broadcast
            </Button>
          </div>
        </TabsContent>

        {/* Downloads */}
        <TabsContent value="downloads" className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{downloads.length} total downloads</p>
            <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" onClick={exportDownloads}>
              <Download className="h-3.5 w-3.5" />Export CSV
            </Button>
          </div>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="bg-muted/40">
                <tr>{['Title', 'Artist', 'Type', 'User', 'Date'].map(h => (
                  <th key={h} className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {loading ? <tr><td colSpan={5} className="px-3 py-2"><Skeleton className="h-5 w-full" /></td></tr>
                : downloads.slice(0, 100).map(d => (
                  <tr key={d.id} className="border-t border-border hover:bg-muted/30">
                    <td className="py-2.5 px-3 whitespace-nowrap max-w-[160px] truncate font-medium">{d.title}</td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-muted-foreground">{d.artist_name}</td>
                    <td className="py-2.5 px-3 whitespace-nowrap"><Badge variant="outline" className="text-[10px] capitalize">{d.content_type}</Badge></td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-muted-foreground text-xs">{d.user_id?.slice(0, 8)}…</td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-muted-foreground text-xs">{formatDate(d.downloaded_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* App Config */}
        <TabsContent value="app" className="mt-4 space-y-6">
          <div>
            <h2 className="text-base font-semibold">Core Platform Settings</h2>
            <p className="text-xs text-muted-foreground">Primary configuration parameters fetched from Supabase</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { key: 'site_name', label: 'Site Name', type: 'text' },
              { key: 'site_tagline', label: 'Tagline', type: 'text' },
              { key: 'theme_primary_color', label: 'Primary Brand Color (HSL, e.g., 220 13% 10%)', type: 'text' },
              { key: 'theme_accent_color', label: 'Accent Highlight Color (HSL, e.g., 28 85% 50%)', type: 'text' },
              { key: 'theme_border_radius', label: 'Theme Border Radius (e.g., 0.375rem, 0.5rem)', type: 'text' },
              { key: 'theme_mode', label: 'Default Theme Mode (dark / light)', type: 'text' },
              { key: 'vote_min_amount', label: 'Price Per Vote (ZMW)', type: 'number' },
              { key: 'nominee_registration_fee', label: 'Nominee Registration Fee (ZMW)', type: 'number' },
              { key: 'contact_email', label: 'Contact Email', type: 'email' },
              { key: 'currency', label: 'Platform Currency', type: 'text' },
              { key: 'max_file_size_mb', label: 'Max Upload Size (MB)', type: 'number' },
              { key: 'maintenance_mode', label: 'Maintenance Mode (true/false)', type: 'text' },
              { key: 'ad_code_header', label: 'Global Header/Script Code (Popunder, Social Bar, Auto Ads)', type: 'textarea' },
              { key: 'ad_code_leaderboard', label: 'Leaderboard Banner HTML/Script Code (Horizontal Ads)', type: 'textarea' },
              { key: 'ad_code_feed', label: 'Feed Banner HTML/Script Code (Mid-Page Ads)', type: 'textarea' },
            ].map(({ key, label, type }) => (
              <SettingRow
                key={key}
                label={label}
                type={type}
                value={settings[key] || ''}
                saving={!!settingSaving[key]}
                onSave={v => saveSetting(key, v)}
              />
            ))}
          </div>

          {/* Dynamic Supabase app_settings table */}
          <div className="pt-6 border-t border-border space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">All Supabase Settings ({allSettingsKeys.length})</h3>
                <p className="text-xs text-muted-foreground">Direct access to all keys in the app_settings table</p>
              </div>
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => setNewKeyDlg(true)}>
                <Plus className="h-3.5 w-3.5" /> Add Setting Key
              </Button>
            </div>

            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full min-w-[560px] text-xs">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="text-left py-2.5 px-3 font-semibold text-muted-foreground">Key</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-muted-foreground">Value</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-muted-foreground">Description</th>
                    <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {allSettingsKeys.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-muted-foreground">No settings keys loaded</td>
                    </tr>
                  ) : (
                    allSettingsKeys.map((item) => (
                      <tr key={item.key} className="hover:bg-muted/20">
                        <td className="py-2.5 px-3 font-mono font-medium text-accent">{item.key}</td>
                        <td className="py-2.5 px-3">
                          <Input
                            defaultValue={item.value}
                            className="h-7 text-xs max-w-xs"
                            onBlur={(e) => {
                              if (e.target.value !== item.value) {
                                saveSetting(item.key, e.target.value);
                              }
                            }}
                          />
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground max-w-xs truncate">{item.description || '—'}</td>
                        <td className="py-2.5 px-3 text-right">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteSetting(item.key)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* Branding & Favicon Tab */}
        <TabsContent value="branding" className="mt-4 space-y-5">
          {/* Live Browser Tab Simulator */}
          <Card className="border-amber-500/30 bg-card/60">
            <CardContent className="p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-400" />
                  <h3 className="text-sm font-semibold">Live Browser Tab & Favicon Simulator</h3>
                </div>
                <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-500/40">
                  Real-time Preview
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                This is how your application's favicon and title appear inside browser tabs, bookmarks, and mobile home screens.
              </p>

              {/* Browser mockup */}
              <div className="rounded-xl border border-border bg-muted/60 p-2 sm:p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5 px-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                  </div>
                  {/* Active Browser Tab */}
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-t-lg bg-background border-t border-x border-border shadow-sm max-w-xs text-xs font-medium text-foreground">
                    <img
                      src={currentFavicon}
                      alt="Favicon"
                      className="w-4 h-4 rounded-sm object-cover shrink-0"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/app-icon.png'; }}
                    />
                    <span className="truncate">{settings['site_title'] || 'ZedVevo — Zambian Music & Videos'}</span>
                    <span className="text-[10px] text-muted-foreground ml-auto">✕</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Favicon Settings */}
            <Card>
              <CardContent className="p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-primary" />
                    <h4 className="text-sm font-semibold">App Favicon (Tab Icon)</h4>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">
                    16x16 / 32x32 / SVG
                  </Badge>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl border border-border bg-muted/50 p-2 flex items-center justify-center shrink-0 overflow-hidden shadow-inner">
                    <img
                      src={currentFavicon}
                      alt="App Favicon"
                      className="w-full h-full object-contain"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/app-icon.png'; }}
                    />
                  </div>
                  <div className="space-y-2 flex-1 min-w-0">
                    <input
                      ref={faviconFileRef}
                      type="file"
                      accept="image/*,.ico,.svg,.png"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleFaviconFileUpload(file);
                      }}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs gap-1.5"
                        onClick={() => faviconFileRef.current?.click()}
                        disabled={faviconUploading}
                      >
                        {faviconUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                        Upload Custom Favicon
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs gap-1 text-muted-foreground"
                        onClick={() => void handleSaveFavicon('/app-icon.png')}
                      >
                        <RefreshCw className="h-3 w-3" /> Reset
                      </Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">Supports PNG, SVG, ICO or WebP formats.</p>
                  </div>
                </div>

                {/* Direct URL Input */}
                <div className="space-y-1.5 pt-2 border-t border-border/60">
                  <Label className="text-xs">Favicon Image URL</Label>
                  <div className="flex gap-2">
                    <Input
                      className="h-8 text-xs font-mono"
                      placeholder="https://.../favicon.png"
                      value={faviconUrlInput || currentFavicon}
                      onChange={(e) => setFaviconUrlInput(e.target.value)}
                    />
                    <Button
                      size="sm"
                      className="h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground shrink-0"
                      onClick={() => void handleSaveFavicon(faviconUrlInput || currentFavicon)}
                    >
                      Apply URL
                    </Button>
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="space-y-2 pt-2 border-t border-border/60">
                  <Label className="text-xs text-muted-foreground">Quick Presets</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {FAVICON_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => void handleSaveFavicon(preset.url)}
                        className={`flex items-center gap-2 p-2 rounded-lg border text-left text-xs transition-all hover:border-primary/60 bg-card ${
                          currentFavicon === preset.url ? 'border-primary ring-1 ring-primary' : 'border-border/60'
                        }`}
                      >
                        <img
                          src={preset.url}
                          alt={preset.label}
                          className="w-5 h-5 rounded object-cover shrink-0"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/app-icon.png'; }}
                        />
                        <span className="truncate font-medium">{preset.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* App Logo & Brand Settings */}
            <Card>
              <CardContent className="p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-accent" />
                    <h4 className="text-sm font-semibold">Brand Identity & App Logo</h4>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">
                    Main Header & PWA
                  </Badge>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl border border-border bg-muted/50 p-2 flex items-center justify-center shrink-0 overflow-hidden shadow-inner">
                    <img
                      src={currentLogo}
                      alt="App Logo"
                      className="w-full h-full object-contain"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/app-icon.png'; }}
                    />
                  </div>
                  <div className="space-y-2 flex-1 min-w-0">
                    <input
                      ref={logoFileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleLogoFileUpload(file);
                      }}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs gap-1.5"
                      onClick={() => logoFileRef.current?.click()}
                      disabled={logoUploading}
                    >
                      {logoUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                      Upload Header Logo
                    </Button>
                    <p className="text-[11px] text-muted-foreground">Used on navigation headers and mobile install banners.</p>
                  </div>
                </div>

                {/* Direct Logo URL */}
                <div className="space-y-1.5 pt-2 border-t border-border/60">
                  <Label className="text-xs">Logo Image URL</Label>
                  <div className="flex gap-2">
                    <Input
                      className="h-8 text-xs font-mono"
                      placeholder="https://.../logo.png"
                      value={logoUrlInput || currentLogo}
                      onChange={(e) => setLogoUrlInput(e.target.value)}
                    />
                    <Button
                      size="sm"
                      className="h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground shrink-0"
                      onClick={async () => {
                        const targetUrl = logoUrlInput || currentLogo;
                        await saveSetting('app_logo_url', targetUrl);
                        await saveSetting('logo_url', targetUrl);
                        toast.success('App logo updated!');
                      }}
                    >
                      Apply Logo
                    </Button>
                  </div>
                </div>

                {/* Site Brand Name */}
                <div className="pt-2 border-t border-border/60">
                  <SettingRow
                    label="Platform Brand Display Name"
                    type="text"
                    value={settings['site_name'] || 'ZedVevo'}
                    saving={!!settingSaving['site_name']}
                    onSave={v => saveSetting('site_name', v)}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Media Watermark & Audio Voice Tag Settings Tab */}
        <TabsContent value="watermark" className="mt-4 space-y-6">
          <Card className="border-red-500/20 bg-gradient-to-r from-red-500/10 via-amber-500/5 to-transparent">
            <CardContent className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-red-500" />
                  <h2 className="text-base font-bold">Media Watermark & Audio Voice Tag Engine</h2>
                  <Badge className="bg-red-500 text-white text-[10px]">ZedVevo Core</Badge>
                </div>
                <p className="text-xs text-muted-foreground max-w-2xl">
                  Configure visual watermark overlays on media cards, video streams, and song covers with your app icon, plus automatic female voice stream greetings and artist recruitment outro promos.
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Visual Media Watermark Settings */}
            <Card>
              <CardContent className="p-5 space-y-5">
                <div className="flex items-center gap-2 pb-3 border-b border-border">
                  <Shield className="h-4 w-4 text-red-500" />
                  <h3 className="text-sm font-semibold">Visual Watermark Overlay Configuration</h3>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border">
                  <div>
                    <Label className="text-sm font-medium">Enable Watermark Overlay</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Shows the ZEDVEVO badge on video playback, song covers, thumbnails, and shared media
                    </p>
                  </div>
                  <Switch
                    checked={watermarkEnabled}
                    onCheckedChange={toggleWatermarkEnabled}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border">
                  <div>
                    <Label className="text-sm font-medium">Use App Icon in Watermark</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Embeds the official app icon image on the watermark badge
                    </p>
                  </div>
                  <Switch
                    checked={watermarkUseAppIcon}
                    onCheckedChange={toggleWatermarkUseAppIcon}
                    disabled={!watermarkEnabled}
                  />
                </div>

                {/* Watermark App Icon Upload Input Field */}
                <div className="space-y-3 p-3 rounded-lg bg-muted/40 border border-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm font-medium">Watermark App Icon Image</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Upload custom icon image or enter image URL for the watermark badge
                      </p>
                    </div>
                    <div className="h-10 w-10 rounded-full border-2 border-amber-400/80 overflow-hidden bg-black/60 shrink-0 shadow-md flex items-center justify-center">
                      <img
                        src={currentWatermarkIcon}
                        alt="Watermark Icon"
                        className="h-full w-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).src = '/app-icon.png'; }}
                      />
                    </div>
                  </div>

                  <input
                    type="file"
                    ref={watermarkIconFileRef}
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleWatermarkIconUpload(file);
                    }}
                  />

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs h-8"
                      onClick={() => watermarkIconFileRef.current?.click()}
                      disabled={watermarkUploading}
                    >
                      {watermarkUploading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Upload className="h-3.5 w-3.5 text-amber-400" />
                      )}
                      Upload Icon File
                    </Button>

                    <div className="flex-1 flex gap-1.5">
                      <Input
                        value={watermarkIconInput}
                        onChange={(e) => setWatermarkIconInput(e.target.value)}
                        placeholder="https://.../icon.png"
                        className="text-xs h-8"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="text-xs h-8 shrink-0"
                        onClick={handleSaveWatermarkIconUrl}
                      >
                        Save URL
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Live Watermark Preview */}
                <div className="space-y-2 pt-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Live Watermark Preview
                  </Label>
                  <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-gradient-to-br from-slate-900 via-zinc-800 to-black border border-border flex items-center justify-center group shadow-inner">
                    <ZedVevoWatermark forceShow={true} size="md" className="top-3 left-3" />
                    <div className="text-center p-4">
                      <Music className="h-8 w-8 text-amber-400 mx-auto mb-2 opacity-80" />
                      <p className="text-xs font-medium text-white/90">Sample Song Artwork & Video Stream</p>
                      <p className="text-[10px] text-white/50">Watermark overlay positioning demo</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Audio Branding & Jingle Settings */}
            <Card>
              <CardContent className="p-5 space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <Volume2 className="h-4 w-4 text-amber-500" />
                    <h3 className="text-sm font-semibold">Audio Branding & Merged Jingle Engine</h3>
                  </div>
                  <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-400">
                    Auto-Attached To Streams & Downloads
                  </Badge>
                </div>

                {/* 1. Upload 'Rock' Style Jingle Audio */}
                <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/30 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                      <Music className="h-3.5 w-3.5" /> 1. 'Rock' Style Jingle Beat Audio File
                    </Label>
                    <span className="text-[10px] text-muted-foreground">MP3 / WAV format</span>
                  </div>

                  <input
                    type="file"
                    ref={audioBrandingJingleRef}
                    accept="audio/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleAudioBrandingJingleUpload(file);
                    }}
                  />

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs h-8 border-amber-500/40 hover:bg-amber-500/20 shrink-0"
                      onClick={() => audioBrandingJingleRef.current?.click()}
                      disabled={audioBrandingJingleUploading}
                    >
                      {audioBrandingJingleUploading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Upload className="h-3.5 w-3.5 text-amber-400" />
                      )}
                      Upload Rock Jingle
                    </Button>

                    <Input
                      value={audioBrandingJingleInput}
                      onChange={(e) => setAudioBrandingJingleInput(e.target.value)}
                      placeholder="https://.../rock_jingle.mp3 or leave blank for synth"
                      className="text-xs h-8 flex-1"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="text-xs h-8 shrink-0"
                      onClick={handleSaveAudioBrandingJingleUrl}
                    >
                      Save
                    </Button>
                  </div>
                </div>

                {/* 2. Upload 'Thank You' Voice Message Audio */}
                <div className="p-3.5 rounded-lg bg-red-500/10 border border-red-500/30 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-rose-400 flex items-center gap-1.5">
                      <Volume2 className="h-3.5 w-3.5" /> 2. 'Thank You' Voice Message Audio File
                    </Label>
                    <span className="text-[10px] text-muted-foreground">MP3 / WAV format</span>
                  </div>

                  <input
                    type="file"
                    ref={audioBrandingVoiceRef}
                    accept="audio/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleAudioBrandingVoiceUpload(file);
                    }}
                  />

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs h-8 border-red-500/40 hover:bg-red-500/20 shrink-0"
                      onClick={() => audioBrandingVoiceRef.current?.click()}
                      disabled={audioBrandingVoiceUploading}
                    >
                      {audioBrandingVoiceUploading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Upload className="h-3.5 w-3.5 text-rose-400" />
                      )}
                      Upload Voice Message
                    </Button>

                    <Input
                      value={audioBrandingVoiceInput}
                      onChange={(e) => setAudioBrandingVoiceInput(e.target.value)}
                      placeholder="https://.../thank_you_voice.mp3 or leave blank for AI voice"
                      className="text-xs h-8 flex-1"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="text-xs h-8 shrink-0"
                      onClick={handleSaveAudioBrandingVoiceUrl}
                    >
                      Save
                    </Button>
                  </div>
                </div>

                {/* Intro Greeting & Merged Logic Controls */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border">
                    <div>
                      <Label className="text-sm font-medium">Enable Intro Audio Jingle Watermark</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Merges and plays jingle & voice over beat to completion BEFORE starting main track
                      </p>
                    </div>
                    <Switch
                      checked={audioTagEnabled}
                      onCheckedChange={toggleAudioTagEnabled}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border">
                    <div>
                      <Label className="text-sm font-medium">Active Rock Music Beat Layer</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Plays driving electric guitar power chords & rock drums under the voice tag
                      </p>
                    </div>
                    <Switch
                      checked={audioTagIntroBeat}
                      onCheckedChange={toggleAudioTagIntroBeat}
                      disabled={!audioTagEnabled}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Voice-Over Script Text</Label>
                    <div className="flex gap-2">
                      <Input
                        value={audioIntroText}
                        onChange={(e) => setAudioIntroText(e.target.value)}
                        placeholder="Thank You For Streaming On Zed Vevo"
                        disabled={!audioTagEnabled}
                        className="text-xs"
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={handleSaveIntroText}
                        disabled={!audioTagEnabled}
                        className="text-xs shrink-0"
                      >
                        Save Script
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 items-center">
                    <div>
                      <Label className="text-xs font-medium">Voice Tone & Speed</Label>
                      <Select
                        value={audioTagSpeed}
                        onValueChange={handleSaveSpeed}
                        disabled={!audioTagEnabled}
                      >
                        <SelectTrigger className="mt-1 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0.80">0.80 (Very Slow & Catchy)</SelectItem>
                          <SelectItem value="0.88">0.88 (International Studio Pace - Recommended)</SelectItem>
                          <SelectItem value="0.95">0.95 (Upbeat Studio Pace)</SelectItem>
                          <SelectItem value="1.00">1.00 (Standard)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="pt-5">
                      <Button
                        size="sm"
                        className="w-full bg-gradient-to-r from-amber-500 to-red-500 hover:from-amber-600 hover:to-red-600 text-slate-950 font-bold gap-1.5 text-xs h-8 shadow-md"
                        onClick={() => playZedVevoIntroTagSequence()}
                      >
                        <Play className="h-3.5 w-3.5 fill-current" />
                        Test Merged Jingle & Voice Tag
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="border-t border-border pt-4 space-y-4">
                  {/* Outro Promotional Message */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border">
                    <div>
                      <Label className="text-sm font-medium">Enable End-of-Song Artist Promo</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Promotes app download & artist earnings 7s before song ends
                      </p>
                    </div>
                    <Switch
                      checked={audioTagOutroEnabled}
                      onCheckedChange={toggleAudioTagOutroEnabled}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Outro Promo Message Text</Label>
                    <Textarea
                      rows={2}
                      value={audioOutroText}
                      onChange={(e) => setAudioOutroText(e.target.value)}
                      placeholder="Are You An Artist or Content Creator? Download Zed Vevo App And Discover How To Earn Money"
                      disabled={!audioTagOutroEnabled}
                      className="text-xs resize-none"
                    />
                    <div className="flex justify-between items-center pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-xs h-8"
                        onClick={() => playZedVevoOutroTag()}
                      >
                        <Volume2 className="h-3.5 w-3.5 text-amber-500" />
                        Test Outro Promo
                      </Button>

                      <Button
                        size="sm"
                        className="bg-accent hover:bg-accent/90 text-accent-foreground text-xs h-8"
                        onClick={handleSaveOutroText}
                        disabled={!audioTagOutroEnabled}
                      >
                        Save Outro Message
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* SEO & Google Search Discoverability Tab */}
        <TabsContent value="seo" className="mt-4 space-y-5">
          {/* SEO Health Summary Indicator */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border-accent/40 bg-card/40 flex flex-col justify-between">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">SEO Audit Score</span>
                  <Badge variant={healthScore > 80 ? 'default' : 'destructive'} className="text-[10px]">
                    {healthScore > 80 ? 'Good' : 'Needs Optimization'}
                  </Badge>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black text-accent">{healthScore}%</span>
                  <span className="text-xs text-muted-foreground">Crawler Health</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Based on complete metadata check across songs, videos, and artist profiles in Supabase.
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-card/30 flex flex-col justify-between">
              <CardContent className="p-4 space-y-2">
                <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Database Page Index</span>
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  <div className="flex justify-between items-center bg-muted/40 px-2 py-1 rounded text-xs font-mono">
                    <span className="text-muted-foreground">Songs:</span>
                    <span className="font-bold text-foreground">{auditSongsCount}</span>
                  </div>
                  <div className="flex justify-between items-center bg-muted/40 px-2 py-1 rounded text-xs font-mono">
                    <span className="text-muted-foreground">Videos:</span>
                    <span className="font-bold text-foreground">{auditVideosCount}</span>
                  </div>
                  <div className="flex justify-between items-center bg-muted/40 px-2 py-1 rounded text-xs font-mono">
                    <span className="text-muted-foreground">Artists:</span>
                    <span className="font-bold text-foreground">{auditArtistsCount}</span>
                  </div>
                  <div className="flex justify-between items-center bg-muted/40 px-2 py-1 rounded text-xs font-mono">
                    <span className="text-muted-foreground">Awards:</span>
                    <span className="font-bold text-foreground">{auditNomineesCount}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-emerald-500/30 bg-card/30 flex flex-col justify-between">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>Crawl Sitemap & Robots</span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px] px-2.5 w-full justify-start font-mono text-muted-foreground relative overflow-hidden group"
                      onClick={() => {
                        navigator.clipboard.writeText('https://zedvevo.xyz/sitemap.xml');
                        toast.success('Sitemap URL copied to clipboard!');
                      }}
                    >
                      <Copy className="h-3 w-3 mr-1.5 text-accent" />
                      sitemap.xml
                    </Button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px] px-2.5 w-full justify-start font-mono text-muted-foreground"
                      onClick={() => {
                        navigator.clipboard.writeText('https://zedvevo.xyz/robots.txt');
                        toast.success('robots.txt URL copied to clipboard!');
                      }}
                    >
                      <Copy className="h-3 w-3 mr-1.5 text-accent" />
                      robots.txt
                    </Button>
                  </div>
                </div>
                <Button
                  size="sm"
                  className="h-7 text-[10px] w-full font-bold uppercase tracking-wider"
                  onClick={runSeoAudit}
                  disabled={checkingAudit}
                >
                  {checkingAudit ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                  Refresh Crawler Audit
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Google Search Listing */}
            <Card className="md:col-span-2 border-accent/30 bg-card/60">
              <CardContent className="p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Search className="h-4 w-4 text-accent" />
                    <h3 className="text-sm font-semibold">Google Search Engine Discoverability (YouTube-like Indexing)</h3>
                  </div>
                  <Badge variant="outline" className="text-[10px] text-accent border-accent/40">
                    Live Search Snippet
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Configure search keywords, Google verification, and canonical tags so ZedVevo songs, videos, and artists rank prominently on Google search.
                </p>

                {/* Google Search Live Preview Simulator */}
                <div className="p-3.5 rounded-lg bg-background border border-border/80 space-y-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">ZedVevo</span>
                    <span>›</span>
                    <span className="truncate">{settings['site_url'] || 'https://zedvevo.xyz'}</span>
                  </div>
                  <p className="text-base sm:text-lg font-medium text-blue-400 hover:underline cursor-pointer truncate">
                    {settings['site_title'] || 'ZedVevo — Zambia’s Premier Music, Videos & Entertainment Platform'}
                  </p>
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {settings['site_description'] || 'Stream, listen, watch and download the latest Zambian music, official music videos, and artist profiles on ZedVevo. Free MP3 downloads and streaming.'}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Core Metadata Fields */}
            <Card>
              <CardContent className="p-4 space-y-3.5">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Primary Meta Tags</h4>
                <SettingRow
                  label="Search Engine Title (Google Title)"
                  type="text"
                  value={settings['site_title'] || 'ZedVevo — Zambia’s #1 Music & Entertainment Platform'}
                  saving={!!settingSaving['site_title']}
                  onSave={v => saveSetting('site_title', v)}
                />
                <SettingRow
                  label="Meta Description (Search Snippet)"
                  type="textarea"
                  value={settings['site_description'] || 'Stream, watch and download latest Zambian music and high definition videos on ZedVevo.'}
                  saving={!!settingSaving['site_description']}
                  onSave={v => saveSetting('site_description', v)}
                />
                <SettingRow
                  label="Google Search Keywords (comma-separated)"
                  type="text"
                  value={settings['site_keywords'] || 'zed music, zambian music, zedvevo, download mp3 zambia, zambian artists, zed videos'}
                  saving={!!settingSaving['site_keywords']}
                  onSave={v => saveSetting('site_keywords', v)}
                />
              </CardContent>
            </Card>

            {/* Verification & Social Share Preview */}
            <Card>
              <CardContent className="p-4 space-y-3.5">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Google Verification & Social Sharing</h4>
                <SettingRow
                  label="Google Search Console Verification Tag"
                  type="text"
                  value={settings['google_site_verification'] || ''}
                  saving={!!settingSaving['google_site_verification']}
                  onSave={v => saveSetting('google_site_verification', v)}
                />
                <SettingRow
                  label="Default Social Share Image (OpenGraph Image URL)"
                  type="text"
                  value={settings['og_image'] || 'https://zedvevo.xyz/og-image.png'}
                  saving={!!settingSaving['og_image']}
                  onSave={v => saveSetting('og_image', v)}
                />
                <SettingRow
                  label="Canonical Base URL"
                  type="text"
                  value={settings['site_url'] || 'https://zedvevo.xyz'}
                  saving={!!settingSaving['site_url']}
                  onSave={v => saveSetting('site_url', v)}
                />
                <SettingRow
                  label="Twitter / X Creator Handle"
                  type="text"
                  value={settings['twitter_handle'] || '@ZedVevo'}
                  saving={!!settingSaving['twitter_handle']}
                  onSave={v => saveSetting('twitter_handle', v)}
                />
              </CardContent>
            </Card>

            {/* Crawlability Audit Details */}
            <Card className="md:col-span-2">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center gap-1.5 border-b border-border/60 pb-2">
                  <Globe className="h-4 w-4 text-accent" />
                  <h4 className="text-sm font-semibold">SEO Indexing Audit Checklist (Actionable Diagnostics)</h4>
                </div>

                <div className="space-y-4 text-xs">
                  {/* Songs Audit */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">1. Uploaded Music Tracks ({auditSongsCount})</span>
                      <Badge variant={missingSongCovers.length === 0 && missingSongDescriptions.length === 0 ? 'secondary' : 'outline'} className="text-[10px]">
                        {missingSongCovers.length === 0 && missingSongDescriptions.length === 0 ? '✓ Validated' : 'Warnings'}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                      <div className="bg-muted/30 p-2 rounded border border-border/40">
                        <p className="font-semibold text-foreground mb-1">Missing Cover Images ({missingSongCovers.length})</p>
                        {missingSongCovers.length === 0 ? (
                          <p className="text-emerald-400">✓ All tracks have beautiful thumbnail covers.</p>
                        ) : (
                          <div className="max-h-20 overflow-y-auto font-mono text-[10px]">
                            {missingSongCovers.map((s: any) => (
                              <div key={s.id}>• {s.title}</div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="bg-muted/30 p-2 rounded border border-border/40">
                        <p className="font-semibold text-foreground mb-1">Missing/Short Descriptions ({missingSongDescriptions.length})</p>
                        {missingSongDescriptions.length === 0 ? (
                          <p className="text-emerald-400">✓ All tracks have search-friendly descriptions.</p>
                        ) : (
                          <div className="max-h-20 overflow-y-auto font-mono text-[10px]">
                            {missingSongDescriptions.map((s: any) => (
                              <div key={s.id}>• {s.title}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Videos Audit */}
                  <div className="space-y-1.5 pt-2 border-t border-border/40">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">2. Music Videos & Clips ({auditVideosCount})</span>
                      <Badge variant={missingVideoThumbnails.length === 0 && missingVideoDescriptions.length === 0 ? 'secondary' : 'outline'} className="text-[10px]">
                        {missingVideoThumbnails.length === 0 && missingVideoDescriptions.length === 0 ? '✓ Validated' : 'Warnings'}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                      <div className="bg-muted/30 p-2 rounded border border-border/40">
                        <p className="font-semibold text-foreground mb-1">Missing Thumbnails ({missingVideoThumbnails.length})</p>
                        {missingVideoThumbnails.length === 0 ? (
                          <p className="text-emerald-400">✓ All videos have dynamic thumbnails.</p>
                        ) : (
                          <div className="max-h-20 overflow-y-auto font-mono text-[10px]">
                            {missingVideoThumbnails.map((v: any) => (
                              <div key={v.id}>• {v.title}</div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="bg-muted/30 p-2 rounded border border-border/40">
                        <p className="font-semibold text-foreground mb-1">Missing/Short Descriptions ({missingVideoDescriptions.length})</p>
                        {missingVideoDescriptions.length === 0 ? (
                          <p className="text-emerald-400">✓ All videos have detailed meta descriptions.</p>
                        ) : (
                          <div className="max-h-20 overflow-y-auto font-mono text-[10px]">
                            {missingVideoDescriptions.map((v: any) => (
                              <div key={v.id}>• {v.title}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Artists Audit */}
                  <div className="space-y-1.5 pt-2 border-t border-border/40">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">3. Artist Profiles ({auditArtistsCount})</span>
                      <Badge variant={missingArtistBios.length === 0 && missingArtistAvatars.length === 0 ? 'secondary' : 'outline'} className="text-[10px]">
                        {missingArtistBios.length === 0 && missingArtistAvatars.length === 0 ? '✓ Validated' : 'Warnings'}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                      <div className="bg-muted/30 p-2 rounded border border-border/40">
                        <p className="font-semibold text-foreground mb-1">Missing Profiles/Bios ({missingArtistBios.length})</p>
                        {missingArtistBios.length === 0 ? (
                          <p className="text-emerald-400">✓ All artists have detailed biography content.</p>
                        ) : (
                          <div className="max-h-20 overflow-y-auto font-mono text-[10px]">
                            {missingArtistBios.map((a: any) => (
                              <div key={a.id}>• {a.stage_name}</div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="bg-muted/30 p-2 rounded border border-border/40">
                        <p className="font-semibold text-foreground mb-1">Missing Avatar Images ({missingArtistAvatars.length})</p>
                        {missingArtistAvatars.length === 0 ? (
                          <p className="text-emerald-400">✓ All artists have official avatar covers.</p>
                        ) : (
                          <div className="max-h-20 overflow-y-auto font-mono text-[10px]">
                            {missingArtistAvatars.map((a: any) => (
                              <div key={a.id}>• {a.stage_name}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* New Setting Dialog */}
      <Dialog open={newKeyDlg} onOpenChange={setNewKeyDlg}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Setting</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div>
              <Label>Key *</Label>
              <Input
                className="mt-1 font-mono text-xs"
                placeholder="e.g. hero_announcement_text"
                value={newKey}
                onChange={e => setNewKey(e.target.value)}
              />
            </div>
            <div>
              <Label>Value *</Label>
              <Input
                className="mt-1"
                placeholder="Setting value"
                value={newVal}
                onChange={e => setNewVal(e.target.value)}
              />
            </div>
            <div>
              <Label>Description (Optional)</Label>
              <Input
                className="mt-1"
                placeholder="Brief description of this setting"
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewKeyDlg(false)}>Cancel</Button>
            <Button
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
              onClick={handleCreateSetting}
              disabled={newSaving}
            >
              {newSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save Setting
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Banner dialog */}
      <Dialog open={bannerDlg.open} onOpenChange={o => setBannerDlg({ open: o })}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <DialogHeader><DialogTitle>{bannerDlg.banner ? 'Edit' : 'New'} Banner</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div><Label>Title *</Label><Input className="mt-1" value={banTitle} onChange={e => setBanTitle(e.target.value)} /></div>
            <div><Label>Subtitle</Label><Input className="mt-1" value={banSub} onChange={e => setBanSub(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Button Text</Label><Input className="mt-1" value={banBtnText} onChange={e => setBanBtnText(e.target.value)} /></div>
              <div><Label>Button URL</Label><Input className="mt-1" value={banBtnUrl} onChange={e => setBanBtnUrl(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Order</Label><Input className="mt-1" type="number" value={banOrder} onChange={e => setBanOrder(e.target.value)} /></div>
              <div className="flex items-end gap-2 pb-0.5"><Switch checked={banActive} onCheckedChange={setBanActive} /><Label>Active</Label></div>
            </div>
            <div><Label>Image {!bannerDlg.banner && '*'}</Label><Input className="mt-1" type="file" accept="image/*" onChange={e => setBanImage(e.target.files?.[0] || null)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBannerDlg({ open: false })}>Cancel</Button>
            <Button className="bg-accent hover:bg-accent/90 text-accent-foreground" onClick={handleSaveBanner} disabled={banSaving}>
              {banSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Inline sub-components to avoid prop-drilling issues in a single-file page
function PlanRow({ plan, onSave }: { plan: UploadPlan; onSave: (u: Partial<UploadPlan>) => void }) {
  const [price, setPrice]   = useState(plan.price.toString());
  const [active, setActive] = useState(plan.is_active);
  return (
    <tr className="border-t border-border hover:bg-muted/30">
      <td className="py-2.5 px-3 whitespace-nowrap font-medium capitalize">{plan.plan_type.replace(/_/g, ' ')}</td>
      <td className="py-2.5 px-3 whitespace-nowrap">
        <Input className="h-7 w-24 text-xs" value={price} onChange={e => setPrice(e.target.value)} type="number" />
      </td>
      <td className="py-2.5 px-3 whitespace-nowrap text-muted-foreground text-xs">{plan.validity_days ? `${plan.validity_days}d` : '—'}</td>
      <td className="py-2.5 px-3 whitespace-nowrap text-muted-foreground">{plan.uploads_allowed ?? '—'}</td>
      <td className="py-2.5 px-3 whitespace-nowrap"><Switch checked={active} onCheckedChange={v => { setActive(v); onSave({ is_active: v }); }} /></td>
      <td className="py-2.5 px-3 whitespace-nowrap">
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onSave({ price: parseFloat(price), is_active: active })}>Save</Button>
      </td>
    </tr>
  );
}

function SettingRow({ label, type, value: init, saving, onSave }: {
  label: string; type: string; value: string; saving: boolean; onSave: (v: string) => void;
}) {
  const [val, setVal] = useState(init);
  // Sync external changes
  useEffect(() => { setVal(init); }, [init]);
  return (
    <div className={type === 'textarea' ? 'col-span-1 md:col-span-2' : ''}>
      <Label>{label}</Label>
      {type === 'textarea' ? (
        <div className="space-y-2 mt-1">
          <Textarea className="w-full text-xs font-mono min-h-[100px] bg-background" value={val} onChange={e => setVal(e.target.value)} placeholder="Paste your script / HTML code here..." />
          <Button size="sm" variant="outline" className="h-8 text-xs shrink-0" onClick={() => onSave(val)} disabled={saving}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save Ad Code'}
          </Button>
        </div>
      ) : (
        <div className="flex gap-2 mt-1">
          <Input type={type} className="flex-1 h-8 text-sm" value={val} onChange={e => setVal(e.target.value)} />
          <Button size="sm" variant="outline" className="h-8 text-xs shrink-0" onClick={() => onSave(val)} disabled={saving}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
          </Button>
        </div>
      )}
    </div>
  );
}
