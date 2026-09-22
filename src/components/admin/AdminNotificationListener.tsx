import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { isAdminEmail } from '@/lib/authHelpers';
import { startAdminNotificationMonitor } from '@/services/adminNotificationService';

export function AdminNotificationListener() {
  const user = useAuthStore((state) => state.user);
  const isAdminState = useAuthStore((state) => state.isAdmin);

  const isAdmin = Boolean(
    isAdminState ||
    (user && (user.role === 'admin' || user.role === 'super_admin' || (user.email && isAdminEmail(user.email))))
  );

  useEffect(() => {
    if (!isAdmin) return;

    // Start background monitor for songs, nominees, and votes
    const cleanup = startAdminNotificationMonitor(true);

    return () => {
      cleanup();
    };
  }, [isAdmin]);

  return null;
}
