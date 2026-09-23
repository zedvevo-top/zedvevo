import BackToHome from '@/components/common/BackToHome';
import { useState, useEffect, useCallback } from 'react';
import { Upload, Music2, Video, CreditCard, Phone, Loader2, CheckCircle2, XCircle, Clock, AlertCircle, Rocket, Globe, ExternalLink, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/ui/avatar';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import type { UploadPlan, UserSubscription, PaymentStatus } from '@/types/index';
import { getActivePlans, getUserActiveSubscription, uploadFile, applyPaymentBenefits, checkUploadEntitlement } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import { generateIdempotencyKey, formatCurrency, formatDate, snakeCaseFileName } from '@/lib/utils';
import { Navigate, useNavigate } from 'react-router-dom';
import CardPaymentForm from '@/components/payment/CardPaymentForm';
import FreshTunesPortalModal from '@/components/distribution/FreshTunesPortalModal';
import { processUnifiedPayment, listenForPaymentStatus } from '@/lib/paymentProcessor';
import PaymentStatusOverlay from '@/components/payment/PaymentStatusOverlay';

type PayMethod = 'mobile_money' | 'card';

export default function UploadPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [plans, setPlans] = useState<UploadPlan[]>([]);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [loading, setLoading] = useState(true);

  // Payment dialog state
  const [payDialog, setPayDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<UploadPlan | null>(null);
  const [payMethod, setPayMethod] = useState<PayMethod>('mobile_money');
  const [phone, setPhone] = useState('');
  const [payLoading, setPayLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null);
  const [activePaymentId, setActivePaymentId] = useState<string | null>(null);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [showFreshTunesModal, setShowFreshTunesModal] = useState(false);

  // Upload form
  const [uploadType, setUploadType] = useState<'song' | 'video'>('song');
  const [title, setTitle] = useState('');
  const [artistName, setArtistName] = useState('');
  const [registeredInfo, setRegisteredInfo] = useState<{
    displayName: string;
    fullName?: string;
    username?: string;
    email?: string;
    phone?: string;
    stageName?: string;
  } | null>(null);
  const [album, setAlbum] = useState('');
  const [genre, setGenre] = useState('');
  const [featuredArtists, setFeaturedArtists] = useState('');
  const [producer, setProducer] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [autoThumb, setAutoThumb] = useState<string | null>(null); // base64 data URL
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(profile);

  const fetchSubscription = useCallback(async () => {
    if (!user) return null;
    try {
      // 1. Fetch fresh profile directly from database
      const { data: freshProf } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
      if (freshProf) {
        setCurrentProfile(freshProf);
      }
      // 2. Evaluate entitlement with payment check
      const sub = await getUserActiveSubscription(user.id);
      setSubscription(sub);
      return sub;
    } catch (err) {
      console.error('Error fetching subscription:', err);
      return null;
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    // 1. Gather all registered details from profile and auth
    const effectiveProf = currentProfile || profile;
    const regDisplayName = effectiveProf?.display_name || '';
    const regFullName = (effectiveProf as any)?.full_name || user.user_metadata?.full_name || '';
    const regUsername = effectiveProf?.username || user.user_metadata?.username || '';
    const regEmail = user.email || '';
    const regPhone = effectiveProf?.phone || (user as any)?.phone || '';

    // Primary artist name from registration details
    const primaryRegisteredName = regDisplayName || regFullName || regUsername || (regEmail ? regEmail.split('@')[0] : '') || 'Artist';

    // Query artists table for stage_name
    supabase.from('artists').select('stage_name, name').eq('user_id', user.id).maybeSingle()
      .then(({ data: artistRecord }) => {
        const bestStageName = artistRecord?.stage_name || artistRecord?.name || primaryRegisteredName;
        setArtistName(prev => (prev.trim() === '' ? bestStageName : prev));
        setRegisteredInfo({
          displayName: regDisplayName,
          fullName: regFullName,
          username: regUsername,
          email: regEmail,
          phone: regPhone,
          stageName: bestStageName
        });
      })
      .catch(() => {
        setArtistName(prev => (prev.trim() === '' ? primaryRegisteredName : prev));
        setRegisteredInfo({
          displayName: regDisplayName,
          fullName: regFullName,
          username: regUsername,
          email: regEmail,
          phone: regPhone,
          stageName: primaryRegisteredName
        });
      });

    // Admins skip plan check entirely
    if ((effectiveProf?.role === 'admin' || effectiveProf?.role === 'super_admin')) { setLoading(false); return; }
    Promise.all([getActivePlans(), fetchSubscription()])
      .then(([p]) => { setPlans(p); })
      .catch(console.error)
      .finally(() => setLoading(false));

    // Realtime: re-fetch subscription whenever a user_subscriptions row changes for this user
    const channelSub = supabase
      .channel(`user_sub_${user.id}_${Math.random().toString(36).slice(2, 9)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_subscriptions', filter: `user_id=eq.${user.id}` },
        () => {
          fetchSubscription();
        }
      )
      .subscribe();

    // Realtime: re-fetch subscription whenever profiles row changes (e.g., admin approvals / trigger)
    const channelProfile = supabase
      .channel(`user_profile_${user.id}_${Math.random().toString(36).slice(2, 9)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        () => {
          fetchSubscription();
        }
      )
      .subscribe();

    // Realtime: re-fetch subscription whenever payments row changes for this user (e.g., admin approves payment)
    const channelPayments = supabase
      .channel(`user_payments_sub_${user.id}_${Math.random().toString(36).slice(2, 9)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payments', filter: `user_id=eq.${user.id}` },
        () => {
          fetchSubscription();
        }
      )
      .subscribe();

    return () => { 
      supabase.removeChannel(channelSub); 
      supabase.removeChannel(channelProfile);
      supabase.removeChannel(channelPayments);
    };
  }, [user, profile, fetchSubscription]);

  // Create a stylized graphic cover if thumbnail extraction fails or user has no cover image
  const generateDefaultCover = useCallback((itemTitle: string, itemArtist: string, type: 'song' | 'video'): string => {
    const canvas = document.createElement('canvas');
    canvas.width = type === 'song' ? 600 : 800;
    canvas.height = type === 'song' ? 600 : 450;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // Gradient background
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    if (type === 'video') {
      grad.addColorStop(0, '#0f172a');
      grad.addColorStop(0.5, '#1e1b4b');
      grad.addColorStop(1, '#0f766e');
    } else {
      grad.addColorStop(0, '#18181b');
      grad.addColorStop(0.5, '#312e81');
      grad.addColorStop(1, '#0284c7');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Decorative circle
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2 - 30, type === 'song' ? 100 : 80, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fill();

    // Brand badge
    ctx.fillStyle = '#06b6d4';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ZEDVEVO', canvas.width / 2, 60);

    // Track/Video Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    const displayTitle = itemTitle || (type === 'video' ? 'Music Video' : 'New Single');
    ctx.fillText(displayTitle.length > 25 ? displayTitle.slice(0, 25) + '...' : displayTitle, canvas.width / 2, canvas.height / 2 + 50);

    // Artist name
    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 22px sans-serif';
    const displayArtist = itemArtist || 'ZedVevo Artist';
    ctx.fillText(displayArtist.length > 30 ? displayArtist.slice(0, 30) + '...' : displayArtist, canvas.width / 2, canvas.height / 2 + 90);

    return canvas.toDataURL('image/jpeg', 0.85);
  }, []);

  // Robust video thumbnail generator with seeked listener, metadata checks, and fallback
  const generateVideoThumbnail = useCallback((videoFile: File): Promise<string> => {
    return new Promise((resolve) => {
      let resolved = false;
      const url = URL.createObjectURL(videoFile);
      const vid = document.createElement('video');
      vid.preload = 'auto';
      vid.muted = true;
      vid.playsInline = true;
      vid.crossOrigin = 'anonymous';

      const cleanup = () => {
        try { URL.revokeObjectURL(url); } catch {}
      };

      const captureFrame = () => {
        if (resolved) return;
        try {
          const canvas = document.createElement('canvas');
          canvas.width = vid.videoWidth || 640;
          canvas.height = vid.videoHeight || 360;
          const ctx = canvas.getContext('2d');
          if (ctx && vid.videoWidth > 0 && vid.videoHeight > 0) {
            ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            resolved = true;
            cleanup();
            resolve(dataUrl);
            return;
          }
        } catch (e) {
          console.warn('Could not snapshot canvas frame:', e);
        }

        // Fallback to stylized cover
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve(generateDefaultCover(title || videoFile.name.replace(/\.[^/.]+$/, ''), artistName, 'video'));
        }
      };

      vid.onloadedmetadata = () => {
        const seekTime = Math.min(1.0, (vid.duration || 1) / 2);
        vid.currentTime = seekTime;
      };

      vid.onseeked = captureFrame;
      vid.onloadeddata = () => {
        if (!resolved && vid.currentTime > 0) captureFrame();
      };

      vid.onerror = () => {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve(generateDefaultCover(title || videoFile.name.replace(/\.[^/.]+$/, ''), artistName, 'video'));
        }
      };

      // Timeout fallback after 3.5 seconds
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve(generateDefaultCover(title || videoFile.name.replace(/\.[^/.]+$/, ''), artistName, 'video'));
        }
      }, 3500);

      vid.src = url;
      vid.load();
    });
  }, [artistName, generateDefaultCover, title]);

  const handleVideoFileChange = async (selectedFile: File) => {
    setFile(selectedFile);
    setAutoThumb(null);
    try {
      const thumb = await generateVideoThumbnail(selectedFile);
      if (thumb) setAutoThumb(thumb);
    } catch { /* safely fallback */ }
  };

  // Convert base64 dataURL to a Blob/File for upload
  const dataUrlToFile = (dataUrl: string, filename: string): File => {
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new File([u8arr], filename, { type: mime });
  };

  // Poll payment status
  const pollPayment = async (paymentId: string) => {
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      try {
        const { data } = await supabase.from('payments').select('status').eq('id', paymentId).maybeSingle();
        if (data?.status && data.status !== 'pending') {
          clearInterval(interval);
          setPaymentStatus(data.status as PaymentStatus);
          if (data.status === 'completed' || data.status === 'successful') {
            await applyPaymentBenefits(paymentId).catch(() => {});
            await fetchSubscription();
            setPayDialog(false);
            
            const isAllPlatforms = (selectedPlan?.plan_type === 'k100_weekly' ||
              selectedPlan?.plan_type === 'k300_yearly' ||
              selectedPlan?.name?.toLowerCase().includes('streaming') ||
              selectedPlan?.name?.toLowerCase().includes('fresh')) &&
              selectedPlan?.plan_type !== 'k10_single' &&
              (selectedPlan?.price || 0) >= 100;

            if (isAllPlatforms) {
              setShowFreshTunesModal(true);
              toast.success('All Streaming Platforms plan activated! Opening in-app frame...');
            } else {
              toast.success('Payment verified! You can now upload content.');
            }
          } else if (data.status === 'insufficient_funds') {
            toast.error('Insufficient funds. Please top up and try again.');
          } else {
            toast.error(`Payment ${data.status}. Please try again.`);
          }
        }
      } catch { /* ignore polling errors */ }
      if (attempts >= 30) { clearInterval(interval); setPaymentStatus('failed'); }
    }, 5000);
  };

  const openPayDialog = (plan: UploadPlan) => {
    setSelectedPlan(plan);
    setPayMethod('mobile_money');
    setPhone('');
    setPaymentStatus(null);
    setActivePaymentId(null);
    setPaymentUrl(null);
    setPayDialog(true);
  };

  const handlePayment = async () => {
    if (!selectedPlan) return;
    if (payMethod === 'mobile_money' && !phone) { toast.error('Enter your phone number'); return; }
    setPayLoading(true);
    try {
      const result = await processUnifiedPayment({
        amount: selectedPlan.price,
        payment_method: payMethod,
        phone_number: payMethod === 'mobile_money' ? phone : undefined,
        description: `ZedVevo ${selectedPlan.name} Upload Plan`,
        payment_type: 'plan',
        plan_id: selectedPlan.id,
        user_id: user!.id,
        metadata: { user_id: user!.id, plan_type: selectedPlan.plan_type, plan_id: selectedPlan.id }
      });

      if (!result.success) {
        setPaymentStatus('failed');
        toast.error(result.error || 'Payment failed.');
        setPayLoading(false);
        return;
      }

      if (result.status === 'completed' || result.status === 'successful') {
        setPaymentStatus('completed');
        if (result.payment_id) {
          await applyPaymentBenefits(result.payment_id).catch(() => {});
        }
        await fetchSubscription();
        setPayDialog(false);
        setPayLoading(false);
        toast.success('Payment approved! Your upload plan is now active.');
        return;
      }

      // STRICT PENDING STATE
      setActivePaymentId(result.payment_id || null);
      setPaymentStatus('pending');
      toast.info('Mobile Money prompt sent to your phone! Enter your PIN on your phone to confirm.');

      // Realtime listener for Lipila confirmation
      listenForPaymentStatus(result.payment_id!, async (statusRes) => {
        if (statusRes.status === 'completed' || statusRes.status === 'successful') {
          setPaymentStatus('completed');
          if (result.payment_id) {
            await applyPaymentBenefits(result.payment_id).catch(() => {});
          }
          await fetchSubscription();
          setPayDialog(false);
          toast.success('Lipila confirmed payment! Your upload plan is now active.');
        } else if (statusRes.status === 'failed') {
          setPaymentStatus('failed');
          toast.error(statusRes.failure_reason || 'Payment failed or was declined on phone.');
        }
        setPayLoading(false);
      });
    } catch (e: unknown) {
      console.error('[payment] unexpected error:', e);
      toast.error((e as Error).message || 'Payment failed. Please try again.');
      setPaymentStatus('failed');
      setPayLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!title || !artistName || !file) { toast.error('Fill in all required fields'); return; }
    const isAdmin = (profile?.role === 'admin' || profile?.role === 'super_admin');
    const hasUploadAccess = profile?.upload_access === 'active' || (profile?.is_artist && profile?.upload_access !== 'inactive');
    const hasValidSub = !!subscription && subscription.is_active && !subscription.consumed;
    if (!isAdmin && !hasUploadAccess && !hasValidSub) { 
      toast.error('No active upload plan or your previous upload token has expired.'); 
      return; 
    }
    setUploading(true);
    setUploadProgress(0);
    try {
      const ext = file.name.split('.').pop();
      const bucket = uploadType === 'song' ? 'songs' : 'videos';
      const fileName = `${user.id}/${snakeCaseFileName(title)}_${Date.now()}.${ext}`;
      setUploadProgress(20);
      const fileUrl = await uploadFile(bucket, fileName, file);
      if (!fileUrl) throw new Error('Failed to upload file to storage');
      setUploadProgress(60);

      let coverUrl: string | undefined;
      if (coverFile) {
        const coverExt = coverFile.name.split('.').pop();
        const coverPath = `${user.id}/cover_${Date.now()}.${coverExt}`;
        coverUrl = await uploadFile('thumbnails', coverPath, coverFile);
      } else if (uploadType === 'video' && autoThumb) {
        // Always upload the auto-generated canvas thumbnail for videos
        const thumbFile = dataUrlToFile(autoThumb, `thumb_${Date.now()}.jpg`);
        coverUrl = await uploadFile('thumbnails', `${user.id}/thumb_${Date.now()}.jpg`, thumbFile);
      }
      // If still no thumbail and it's a video, retry generating one more time from the file
      if (uploadType === 'video' && !coverUrl && file) {
        try {
          const retryThumb = await generateVideoThumbnail(file);
          const thumbFile = dataUrlToFile(retryThumb, `thumb_retry_${Date.now()}.jpg`);
          coverUrl = await uploadFile('thumbnails', `${user.id}/thumb_${Date.now()}.jpg`, thumbFile);
        } catch { /* best-effort */ }
      } else if (uploadType === 'song' && !coverUrl) {
        try {
          const defaultSongCover = generateDefaultCover(title, artistName, 'song');
          if (defaultSongCover) {
            const thumbFile = dataUrlToFile(defaultSongCover, `cover_${Date.now()}.jpg`);
            coverUrl = await uploadFile('thumbnails', `${user.id}/cover_${Date.now()}.jpg`, thumbFile);
          }
        } catch { /* best-effort */ }
      }
      setUploadProgress(80);

      // Synchronize artist record in database
      const finalArtistName = artistName.trim() || registeredInfo?.stageName || registeredInfo?.displayName || registeredInfo?.fullName || registeredInfo?.username || 'Artist';
      try {
        await supabase.from('artists').upsert({
          user_id: user.id,
          name: finalArtistName,
          stage_name: finalArtistName,
          bio: profile?.bio || undefined,
          avatar_url: profile?.avatar_url || undefined,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
      } catch (e) {
        console.warn('Artist record upsert fallback:', e);
      }

      // Confirm file write and insert record to database (always approved immediately)
      const uploadStatus = 'approved';
      const recordPayload = uploadType === 'song' ? {
        user_id: user.id, title, artist_name: finalArtistName,
        album: album || null, genre: genre || null,
        featured_artists: featuredArtists || null,
        producer: producer || null,
        file_url: fileUrl, cover_url: coverUrl || null,
        status: uploadStatus,
      } : {
        user_id: user.id, title, artist_name: finalArtistName,
        genre: genre || null,
        featured_artists: featuredArtists || null,
        producer: producer || null,
        file_url: fileUrl,
        thumbnail_url: coverUrl || null,
        status: uploadStatus,
      };

      const { error: insertErr } = uploadType === 'song'
        ? await supabase.from('songs').insert(recordPayload)
        : await supabase.from('videos').insert(recordPayload);

      if (insertErr) {
        throw new Error('Database insert failed: ' + insertErr.message);
      }

      // ONLY AFTER FILE WRITE & DATABASE CONFIRMATION:
      // For one-time upload plans, mark entitlement as expired / inactive (consumed=true)
      if (!isAdmin && subscription) {
        const isOneTime = subscription.plan_type === 'k10_single' || 
                          subscription.uploads_allowed === 1 || 
                          subscription.upload_plans?.name?.toLowerCase().includes('single') ||
                          subscription.upload_plans?.name?.toLowerCase().includes('basic');

        const newUsed = (subscription.uploads_used || 0) + 1;

        if (isOneTime) {
          // Token consumed: set consumed = true, is_active = false, status = 'inactive'
          if (!subscription.id.startsWith('pay-') && !subscription.id.startsWith('profile-')) {
            await supabase.from('user_subscriptions')
              .update({ 
                uploads_used: newUsed, 
                consumed: true, 
                is_active: false, 
                status: 'inactive' 
              })
              .eq('id', subscription.id);
          }

          await supabase.from('artist_subscriptions')
            .update({ 
              upload_count: newUsed, 
              status: 'expired' 
            })
            .eq('user_id', user.id);

          // Update profile upload_access to inactive
          await supabase.from('profiles')
            .update({ upload_access: 'inactive' })
            .eq('id', user.id);

          setSubscription(null);
          setCurrentProfile(prev => prev ? { ...prev, upload_access: 'inactive' } : null);

          // Notify user their single upload token has been consumed and expired
          await supabase.from('notifications').insert({
            user_id: user.id,
            title: 'Single Upload Consumed',
            message: 'Your single upload has been successfully published. Your one-time upload token has expired. Purchase a new plan to upload more content.',
            type: 'info',
            notification_type: 'package_expiry',
          });
        } else {
          // Multi-upload or subscription plan
          const hasReachedLimit = subscription.uploads_allowed !== null && newUsed >= subscription.uploads_allowed;
          if (!subscription.id.startsWith('pay-') && !subscription.id.startsWith('profile-')) {
            await supabase.from('user_subscriptions')
              .update({ 
                uploads_used: newUsed,
                is_active: !hasReachedLimit,
                status: hasReachedLimit ? 'inactive' : 'active',
                consumed: hasReachedLimit
              })
              .eq('id', subscription.id);
          }

          await supabase.from('artist_subscriptions')
            .update({ upload_count: newUsed })
            .eq('user_id', user.id);

          if (hasReachedLimit) {
            setSubscription(null);
            setCurrentProfile(prev => prev ? { ...prev, upload_access: 'inactive' } : null);
          } else {
            setSubscription(prev => prev ? { ...prev, uploads_used: newUsed } : null);
          }
        }
      } else if (!isAdmin && hasUploadAccess) {
        // Expire direct upload access after single upload confirmation
        await supabase.from('profiles')
          .update({ upload_access: 'inactive' })
          .eq('id', user.id);
        setCurrentProfile(prev => prev ? { ...prev, upload_access: 'inactive' } : null);
        setSubscription(null);
      }

      setUploadProgress(100);
      toast.success('Upload approved and published live immediately on ZedVevo!');
      setTitle(''); setArtistName(''); setAlbum(''); setGenre('');
      setFeaturedArtists(''); setProducer('');
      setFile(null); setCoverFile(null); setAutoThumb(null);
      setUploadProgress(0);
      // Redirect to the uploaded content page
      navigate(uploadType === 'song' ? '/music' : '/videos');
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Upload failed');
    } finally { setUploading(false); }
  };

  const effectiveProf = currentProfile || profile;
  const isAdmin = (effectiveProf?.role === 'admin' || effectiveProf?.role === 'super_admin');
  const hasUploadAccess = effectiveProf?.upload_access === 'active' || (effectiveProf?.is_artist && effectiveProf?.upload_access !== 'inactive');
  const hasValidSub = !!subscription && subscription.is_active && !subscription.consumed && (subscription.uploads_allowed === null || (subscription.uploads_used || 0) < subscription.uploads_allowed);
  const canUpload = isAdmin || hasUploadAccess || hasValidSub;

  // 1. Strict check: is this a 1 song / single upload plan?
  const isOneSongUploadPlan = Boolean(
    subscription?.plan_type === 'k10_single' ||
    subscription?.plan_type === 'daily' ||
    subscription?.plan_type === 'single' ||
    subscription?.plan_type === '1_song' ||
    subscription?.plan_type === 'single_upload' ||
    subscription?.uploads_allowed === 1 ||
    subscription?.upload_plans?.uploads_allowed === 1 ||
    subscription?.upload_plans?.plan_type === 'k10_single' ||
    subscription?.upload_plans?.plan_type === 'daily' ||
    (subscription?.upload_plans?.price != null && subscription.upload_plans.price < 100) ||
    subscription?.upload_plans?.name?.toLowerCase().includes('single') ||
    subscription?.upload_plans?.name?.toLowerCase().includes('1 upload') ||
    subscription?.upload_plans?.name?.toLowerCase().includes('one upload') ||
    subscription?.upload_plans?.name?.toLowerCase().includes('1 song') ||
    subscription?.upload_plans?.name?.toLowerCase().includes('daily') ||
    subscription?.upload_plans?.name?.toLowerCase().includes('basic') ||
    (!subscription && (hasUploadAccess || !isAdmin))
  );

  // 2. Multi-platform distribution (FreshTunes) is ONLY unlocked when user explicitly holds an active K100/K300 plan.
  // When the user's plan is for 1 song upload, all streaming platform buttons MUST NEVER be shown under any circumstances.
  const isMultiPlatformPlanOrAdmin = Boolean(
    !isOneSongUploadPlan &&
    subscription &&
    (
      subscription.plan_type === 'k100_weekly' ||
      subscription.plan_type === 'k300_yearly' ||
      subscription.plan_type === 'weekly' ||
      subscription.plan_type === 'annual' ||
      subscription.plan_type === 'yearly' ||
      subscription.upload_plans?.plan_type === 'k100_weekly' ||
      subscription.upload_plans?.plan_type === 'k300_yearly' ||
      (subscription.upload_plans?.price != null && subscription.upload_plans.price >= 100) ||
      (subscription.amount != null && subscription.amount >= 100)
    )
  );

  const handleOpenFreshTunes = useCallback(() => {
    if (!isMultiPlatformPlanOrAdmin) return;
    // Open in app frame without redirecting
    setShowFreshTunesModal(true);
  }, [isMultiPlatformPlanOrAdmin]);

  if (!user) return <Navigate to="/login" replace />;

  if (loading) return (
    <div className="min-h-screen pt-20 flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="min-h-screen pt-20 pb-24 lg:pb-6">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <BackToHome />
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-1">Upload Content</h1>
          <p className="text-sm text-muted-foreground">Share your music and videos with Zambia</p>
        </div>

        {/* Active plan banner — displays all registered artist details */}
        {canUpload && (
          <Card className="mb-6 border-accent/30 bg-accent/5">
            <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 px-4">
              <div className="flex items-start gap-3">
                <UserAvatar 
                  src={profile?.avatar_url} 
                  name={artistName || registeredInfo?.stageName || registeredInfo?.displayName || registeredInfo?.fullName || registeredInfo?.username || 'Artist'} 
                  size="md"
                  className="mt-0.5"
                />
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-foreground">
                      {subscription?.upload_plans?.name || (profile?.role === 'artist' ? 'Artist Plan Active' : 'Upload Access Active')}
                    </p>
                    <Badge variant="outline" className="text-[10px] bg-accent/15 text-accent border-accent/40 font-semibold uppercase tracking-wider">
                      Artist Active
                    </Badge>
                    {isMultiPlatformPlanOrAdmin && (
                      <Badge className="text-[10px] bg-emerald-500/15 text-emerald-500 border border-emerald-500/40 font-semibold uppercase tracking-wider flex items-center gap-1">
                        <Sparkles className="h-2.5 w-2.5" /> All Streaming Unlocked
                      </Badge>
                    )}
                  </div>
                  
                  {/* Show registered details clearly */}
                  <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span>
                      Artist Name:{' '}
                      <strong className="text-foreground font-semibold">
                        {artistName || registeredInfo?.stageName || registeredInfo?.displayName || registeredInfo?.fullName || registeredInfo?.username || 'Registered Artist'}
                      </strong>
                    </span>
                    {registeredInfo?.username && (
                      <span>Username: <strong className="text-foreground">@{registeredInfo.username}</strong></span>
                    )}
                    {registeredInfo?.email && (
                      <span>Email: <strong className="text-foreground">{registeredInfo.email}</strong></span>
                    )}
                    {registeredInfo?.phone && (
                      <span>Phone: <strong className="text-foreground">{registeredInfo.phone}</strong></span>
                    )}
                  </div>
                  <p className="text-[11px] text-accent font-medium">
                    ✓ Your artist account and upload plan are active. You can upload content now!
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:items-end gap-2 shrink-0">
                {subscription && (
                  <div className="text-left sm:text-right">
                    <span className="text-xs font-semibold text-foreground block">
                      {subscription.plan_type === 'k10_single' || subscription.uploads_allowed === 1
                        ? '1 of 1 Upload Active'
                        : 'Unlimited Uploads'}
                    </span>
                    {subscription.expires_at && (
                      <span className="text-[10px] text-muted-foreground block">
                        Expires {formatDate(subscription.expires_at)}
                      </span>
                    )}
                  </div>
                )}
                {isMultiPlatformPlanOrAdmin && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleOpenFreshTunes}
                    className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium flex items-center gap-1.5 shadow-xs"
                  >
                    <Globe className="h-3.5 w-3.5" />
                    <span>All Streaming Upload</span>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Plans grid — ONLY shown when no active plan or after plan expires */}
        {!canUpload && !isAdmin && (
          <div className="space-y-4 mb-6">
            <h2 className="text-base font-semibold">Choose an Upload Plan</h2>
            <p className="text-xs text-muted-foreground -mt-2 mb-3">
              Your previous upload token has expired or you do not have an active upload plan. Choose a plan to unlock uploads.
            </p>
            <div className="grid gap-3">
              {plans.map(plan => (
                <button
                  key={plan.id}
                  onClick={() => openPayDialog(plan)}
                  className="text-left w-full border border-border rounded-lg p-4 transition-colors hover:border-accent focus:outline-none focus:border-accent"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{plan.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{plan.description}</p>
                    </div>
                    <p className="text-xl font-bold text-accent shrink-0 ml-4">{formatCurrency(plan.price)}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Upload form — shown when admin or has active sub */}
        {canUpload && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Upload Content</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Type toggle */}
              <div className={`grid gap-2 ${isMultiPlatformPlanOrAdmin ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-2'}`}>
                <button
                  type="button"
                  onClick={() => setUploadType('song')}
                  className={`flex items-center justify-center gap-2 p-3 rounded-lg border text-sm font-medium transition-colors ${uploadType === 'song' ? 'border-accent bg-accent/5 text-accent' : 'border-border'}`}
                >
                  <Music2 className="h-4 w-4" /> Song (MP3)
                </button>
                <button
                  type="button"
                  onClick={() => setUploadType('video')}
                  className={`flex items-center justify-center gap-2 p-3 rounded-lg border text-sm font-medium transition-colors ${uploadType === 'video' ? 'border-accent bg-accent/5 text-accent' : 'border-border'}`}
                >
                  <Video className="h-4 w-4" /> Video (MP4)
                </button>
                {isMultiPlatformPlanOrAdmin && (
                  <button
                    type="button"
                    onClick={handleOpenFreshTunes}
                    className="flex items-center justify-center gap-2 p-3 rounded-lg border border-emerald-500/60 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 text-sm font-semibold transition-all shadow-xs group"
                  >
                    <Globe className="h-4 w-4 transition-transform group-hover:rotate-12" />
                    <span>All Streaming (FreshTunes)</span>
                  </button>
                )}
              </div>

              {/* Distribution section - Strictly hidden for 1 song upload plans */}
              {isMultiPlatformPlanOrAdmin ? (
                <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 px-4 py-3.5 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                  <div className="flex gap-3 items-start">
                    <Globe className="h-5 w-5 mt-0.5 shrink-0 text-emerald-500" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <p className="text-xs font-bold text-foreground">
                          All Streaming Platforms Distribution Active 🌍
                        </p>
                        <Badge className="text-[10px] bg-emerald-500 text-white border-0 py-0 px-1.5 font-bold uppercase">
                          VIP FreshTunes
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Your plan unlocks global distribution to Spotify, Apple Music, YouTube Music, Deezer, Boomplay, TikTok & Amazon via FreshTunes with 100% royalties kept.
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    onClick={handleOpenFreshTunes}
                    size="sm"
                    className="shrink-0 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm"
                  >
                    <Globe className="h-3.5 w-3.5" />
                    <span>Open In-App Frame</span>
                  </Button>
                </div>
              ) : uploadType === 'video' ? (
                <div className="rounded-lg border px-4 py-3 flex gap-3 items-start border-accent/40 bg-accent/5">
                  <Rocket className="h-4 w-4 mt-0.5 shrink-0 text-accent" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold mb-0.5 text-accent">
                      Video Distribution coming soon 🚀
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Music videos uploaded to ZedVevo will be featured across the ZedVevo music network and video charts.
                    </p>
                  </div>
                </div>
              ) : null}

              <div>
                <Label>Title *</Label>
                <Input className="mt-1" value={title} onChange={e => setTitle(e.target.value)} placeholder="Enter title" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label>Artist Name *</Label>
                  {registeredInfo && (
                    <span className="text-[11px] text-muted-foreground">
                      Registered name: <span className="text-accent font-medium">{registeredInfo.stageName || registeredInfo.displayName || registeredInfo.fullName || registeredInfo.username}</span>
                      {registeredInfo.username && ` (@${registeredInfo.username})`}
                    </span>
                  )}
                </div>
                <Input 
                  className="mt-1" 
                  value={artistName} 
                  onChange={e => setArtistName(e.target.value)} 
                  placeholder="Artist or band name" 
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Auto-populated with your registered artist details. This is the artist credited on ZedVevo.
                </p>
              </div>
              {uploadType === 'song' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Album</Label>
                    <Input className="mt-1" value={album} onChange={e => setAlbum(e.target.value)} placeholder="Album name" />
                  </div>
                  <div>
                    <Label>Genre</Label>
                    <Input className="mt-1" value={genre} onChange={e => setGenre(e.target.value)} placeholder="e.g. Afrobeats" />
                  </div>
                </div>
              )}
              {/* Featured Artists & Producer — both song and video */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Featured Artists</Label>
                  <Input className="mt-1" value={featuredArtists} onChange={e => setFeaturedArtists(e.target.value)} placeholder="e.g. Slapdee, Bobby East" />
                </div>
                <div>
                  <Label>Producer</Label>
                  <Input className="mt-1" value={producer} onChange={e => setProducer(e.target.value)} placeholder="e.g. Mag44" />
                </div>
              </div>
              {uploadType === 'video' && (
                <div>
                  <Label>Genre</Label>
                  <Input className="mt-1" value={genre} onChange={e => setGenre(e.target.value)} placeholder="e.g. Music Video" />
                </div>
              )}

              <div>
                <Label>{uploadType === 'song' ? 'MP3 File *' : 'MP4 File *'}</Label>
                <Input
                  type="file"
                  accept={uploadType === 'song' ? 'audio/mpeg,audio/*' : 'video/mp4,video/*'}
                  className="mt-1 cursor-pointer"
                  onChange={e => {
                    const f = e.target.files?.[0] || null;
                    if (uploadType === 'video' && f) handleVideoFileChange(f);
                    else setFile(f);
                  }}
                />
              </div>

              {/* Auto-generated thumbnail preview */}
              {uploadType === 'video' && autoThumb && !coverFile && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Auto-generated thumbnail preview</p>
                  <img src={autoThumb} alt="Auto thumbnail" className="w-full max-w-xs rounded-lg object-cover aspect-video border border-border" />
                </div>
              )}

              <div>
                <Label>{uploadType === 'song' ? 'Cover Art (optional)' : 'Custom Thumbnail (optional)'}</Label>
                <Input
                  type="file"
                  accept="image/*"
                  className="mt-1 cursor-pointer"
                  onChange={e => setCoverFile(e.target.files?.[0] || null)}
                />
                {uploadType === 'video' && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {autoThumb ? 'Thumbnail auto-generated from video. Upload a custom one to override.' : 'A thumbnail will be generated from your video automatically.'}
                  </p>
                )}
              </div>

              {uploading && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Uploading...</span><span>{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} />
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                <Button
                  className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold h-11"
                  onClick={handleUpload}
                  disabled={uploading}
                >
                  {uploading
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Uploading...</>
                    : <><Upload className="h-4 w-4 mr-2" />Upload {uploadType === 'song' ? 'Song to ZedVevo' : 'Video to ZedVevo'}</>
                  }
                </Button>
                {isMultiPlatformPlanOrAdmin && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleOpenFreshTunes}
                    className="border-emerald-500/50 bg-emerald-500/10 hover:bg-emerald-500/20 text-foreground font-semibold h-11 flex items-center justify-center gap-1.5"
                  >
                    <Globe className="h-4 w-4 text-emerald-500" />
                    <span>All Streaming Upload (FreshTunes)</span>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Payment Dialog ────────────────────────────────────────── */}
      <Dialog open={payDialog} onOpenChange={open => { if (!payLoading) setPayDialog(open); }}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedPlan ? `Pay for ${selectedPlan.name}` : 'Choose Payment'}
            </DialogTitle>
            {selectedPlan && (
              <DialogDescription>
                Amount due: <span className="font-semibold text-accent">{formatCurrency(selectedPlan.price)}</span>
              </DialogDescription>
            )}
          </DialogHeader>

          {/* Centralized Payment Status Overlay */}
          {(paymentStatus === 'pending' || paymentStatus === 'completed' || paymentStatus === 'successful' || paymentStatus === 'insufficient_funds' || paymentStatus === 'failed' || paymentStatus === 'cancelled') ? (
            <PaymentStatusOverlay
              status={
                paymentStatus === 'pending' ? 'pending' :
                (paymentStatus === 'completed' || paymentStatus === 'successful') ? 'success' :
                'failed'
              }
              amount={selectedPlan?.price || 0}
              description={`Plan: ${selectedPlan?.name || 'Upload Plan'}`}
              phone={phone}
              failureReason={paymentStatus === 'insufficient_funds' ? 'Insufficient funds. Please top up your wallet.' : 'Payment declined or timed out.'}
              onClose={() => {
                setPayDialog(false);
                setPaymentStatus(null);
              }}
              onRetry={() => setPaymentStatus(null)}
              paymentId={activePaymentId || undefined}
            />
          ) : (
            <div className="space-y-4 py-2">
              {/* Amount summary */}
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-sm text-muted-foreground">Plan</span>
                <span className="text-sm font-medium">{selectedPlan?.name}</span>
              </div>
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <span className="text-sm text-muted-foreground">Amount</span>
                <span className="font-bold text-accent text-lg">{selectedPlan ? formatCurrency(selectedPlan.price) : '—'}</span>
              </div>

              {/* Method selector */}
              <div>
                <Label className="text-sm mb-2 block">Payment Method</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setPayMethod('mobile_money')}
                    className={`flex items-center justify-center gap-2 p-3 rounded-lg border text-sm font-medium transition-colors ${
                      payMethod === 'mobile_money' ? 'border-accent bg-accent/5 text-accent' : 'border-border text-foreground'
                    }`}
                  >
                    <Phone className="h-4 w-4 shrink-0" />
                    <span>Mobile Money</span>
                  </button>
                  <button
                    onClick={() => setPayMethod('card')}
                    className={`relative flex items-center justify-center gap-2 p-3 rounded-lg border text-sm font-medium transition-colors ${
                      payMethod === 'card' ? 'border-accent bg-accent/5 text-accent' : 'border-border text-foreground'
                    }`}
                  >
                    <CreditCard className="h-4 w-4 shrink-0" />
                    <span>Card</span>
                    <Badge className="absolute -top-2 -right-2 text-[9px] px-1.5 py-0 bg-accent text-accent-foreground border border-accent animate-pulse">
                      Visa/MC
                    </Badge>
                  </button>
                </div>
              </div>

              {payMethod === 'card' ? (
                <div className="pt-2 border-t border-border/50">
                  <CardPaymentForm
                    amount={selectedPlan?.price || 0}
                    paymentType="plan"
                    metadata={{
                      user_id: user!.id,
                      plan_id: selectedPlan?.id,
                      plan_type: selectedPlan?.plan_type,
                    }}
                    onSuccess={async (paymentId) => {
                      setPaymentStatus('successful');
                      setPayDialog(false);

                      const isAllPlatforms = (selectedPlan?.plan_type === 'k100_weekly' ||
                        selectedPlan?.plan_type === 'k300_yearly' ||
                        selectedPlan?.name?.toLowerCase().includes('streaming') ||
                        selectedPlan?.name?.toLowerCase().includes('fresh')) &&
                        selectedPlan?.plan_type !== 'k10_single' &&
                        (selectedPlan?.price || 0) >= 100;

                      if (user?.id) {
                        try {
                          const sub = await getUserActiveSubscription(user.id);
                          setSubscription(sub);
                        } catch {
                          // Ignore fetch error
                        }
                      }

                      if (isAllPlatforms) {
                        setShowFreshTunesModal(true);
                        toast.success('All Streaming Platforms Plan Activated! Opening in-app frame...');
                      } else {
                        toast.success('Your plan is now active! You can start uploading right now.');
                      }
                    }}
                    onCancel={() => setPayDialog(false)}
                    buttonLabel={`Pay ${selectedPlan ? formatCurrency(selectedPlan.price) : ''} & Activate`}
                  />
                </div>
              ) : (
                <>
                  {/* Mobile money phone input */}
                  {payMethod === 'mobile_money' && (
                    <div>
                      <Label>Phone Number *</Label>
                      <Input
                        className="mt-1"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        placeholder="e.g. 0977123456"
                        type="tel"
                      />
                    </div>
                  )}

                  {/* Security note */}
                  <div className="flex items-start gap-2 bg-muted/40 rounded-lg p-3 text-xs text-muted-foreground">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 text-accent mt-0.5" />
                    Your plan activates only after Lipila verifies your payment server-side.
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-1">
                    <Button variant="outline" className="flex-1" onClick={() => setPayDialog(false)} disabled={payLoading}>
                      Cancel
                    </Button>
                    <Button
                      className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground"
                      onClick={handlePayment}
                      disabled={payLoading}
                    >
                      {payLoading
                        ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing…</>
                        : `Pay ${selectedPlan ? formatCurrency(selectedPlan.price) : ''}`
                      }
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* FreshTunes Distribution Portal Modal (Opens Real Web with App Theme) */}
      <FreshTunesPortalModal
        open={showFreshTunesModal}
        onOpenChange={setShowFreshTunesModal}
        onProceedToUpload={() => {
          setShowFreshTunesModal(false);
          window.scrollTo({ top: 300, behavior: 'smooth' });
        }}
      />
    </div>
  );
}
