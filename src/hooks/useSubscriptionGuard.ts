import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getUserActiveSubscription } from '@/lib/api';
import { supabase } from '@/db/supabase';
import { toast } from 'sonner';

export interface UseSubscriptionGuardReturn {
  canUpload: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  subscription: any | null;
  showRenewalDialog: boolean;
  setShowRenewalDialog: (open: boolean) => void;
  checkSubscription: () => Promise<boolean>;
  interceptUpload: (onSuccess: () => void | Promise<void>, onBlocked?: () => void) => Promise<boolean>;
  handleUploadAttempt: (onSuccess: () => void | Promise<void>, onBlocked?: () => void) => boolean;
}

export function useSubscriptionGuard(): UseSubscriptionGuardReturn {
  const { user, profile } = useAuth();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [subscription, setSubscription] = useState<any | null>(null);
  const [canUpload, setCanUpload] = useState<boolean>(false);
  const [showRenewalDialog, setShowRenewalDialog] = useState<boolean>(false);
  const isMountedRef = useRef<boolean>(true);

  const userId = user?.id;
  const userRole = profile?.role;
  const isAdmin = userRole === 'admin' || userRole === 'super_admin';

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const isBusyRef = useRef<boolean>(false);

  const checkSubscription = useCallback(async (): Promise<boolean> => {
    if (isBusyRef.current) return canUpload;
    isBusyRef.current = true;
    
    if (!userId) {
      isBusyRef.current = false;
      if (isMountedRef.current) {
        setIsLoading(false);
        setCanUpload(false);
      }
      return false;
    }

    try {
      if (isAdmin) {
        if (isMountedRef.current) {
          setCanUpload(true);
          setIsLoading(false);
        }
        return true;
      }

      const activeSub = await getUserActiveSubscription(userId);
      if (isMountedRef.current) {
        setSubscription(activeSub);
      }

      const status = activeSub?.status?.toLowerCase();
      const isExpired = !activeSub || 
                        !activeSub.is_active || 
                        activeSub.consumed || 
                        status === 'expired' || 
                        status === 'inactive' || 
                        (activeSub.expires_at && new Date(activeSub.expires_at) < new Date()) || 
                        (activeSub.uploads_allowed !== null && (activeSub.uploads_used || 0) >= activeSub.uploads_allowed);

      const allowed = !isExpired;
      if (isMountedRef.current) {
        setCanUpload(allowed);
      }
      return allowed;
    } catch (err) {
      console.warn('useSubscriptionGuard error:', err);
      const fallbackAllowed = Boolean(isAdmin);
      if (isMountedRef.current) {
        setCanUpload(fallbackAllowed);
      }
      return fallbackAllowed;
    } finally {
      isBusyRef.current = false;
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [userId, isAdmin]);

  useEffect(() => {
    void checkSubscription();

    if (!userId) return;
    const channelName = `sub_hook_${userId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_subscriptions', filter: `user_id=eq.${userId}` },
        () => { 
            // Simple debounce to prevent rapid fire
            setTimeout(() => { void checkSubscription(); }, 1000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, checkSubscription]);

  const interceptUpload = useCallback(
    async (onSuccess: () => void | Promise<void>, onBlocked?: () => void): Promise<boolean> => {
      if (isAdmin) {
        await onSuccess();
        return true;
      }

      // Refresh & check subscription state
      const allowed = await checkSubscription();

      if (allowed) {
        await onSuccess();
        return true;
      } else {
        // Trigger PlanRenewalDialog for expired/planless artists
        if (isMountedRef.current) {
          setShowRenewalDialog(true);
        }
        toast.error('Artist upload plan required. Please select a plan to publish your content.');
        if (onBlocked) {
          onBlocked();
        }
        return false;
      }
    },
    [isAdmin, checkSubscription]
  );

  const handleUploadAttempt = useCallback(
    (onSuccess: () => void | Promise<void>, onBlocked?: () => void): boolean => {
      if (isAdmin) {
        void onSuccess();
        return true;
      }

      const status = subscription?.status?.toLowerCase();
      const isExpired = !subscription || 
                        !subscription.is_active || 
                        subscription.consumed || 
                        status === 'expired' || 
                        status === 'inactive' || 
                        (subscription.expires_at && new Date(subscription.expires_at) < new Date()) || 
                        (subscription.uploads_allowed !== null && (subscription.uploads_used || 0) >= subscription.uploads_allowed);

      if (!isExpired) {
        void onSuccess();
        return true;
      } else {
        // Trigger PlanRenewalDialog for expired/planless artists
        if (isMountedRef.current) {
          setShowRenewalDialog(true);
        }
        toast.error('Artist upload plan expired or limit reached. Select a plan below to unlock uploading.');
        if (onBlocked) {
          onBlocked();
        }
        return false;
      }
    },
    [isAdmin, subscription]
  );

  return {
    canUpload,
    isAdmin,
    isLoading,
    subscription,
    showRenewalDialog,
    setShowRenewalDialog,
    checkSubscription,
    interceptUpload,
    handleUploadAttempt,
  };
}

export default useSubscriptionGuard;
