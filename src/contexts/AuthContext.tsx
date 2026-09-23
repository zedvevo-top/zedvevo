import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react';
import { supabase } from '@/db/supabase';
import type { User } from '@supabase/supabase-js';
import type { Profile } from '@/types/index';
import { toast } from 'sonner';
import { autoActivateAllSuccessfulArtistPlans } from '@/services/lipila';
import { useAuthStore } from '@/store/authStore';

export async function getProfile(userId: string): Promise<Profile | null> {
  let { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    if (error.code === 'PGRST303' || error.message?.includes('JWT issued at future')) {
      // Wait 1s for server time synchronization and retry
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const retry = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      if (!retry.error) {
        data = retry.data;
      }
    } else {
      console.warn('Failed to fetch profile:', error.message || error);
    }
  }

  // Auto-provision profile row if not present
  if (!data && userId) {
    try {
      const { data: authData } = await supabase.auth.getUser();
      const email = authData?.user?.email || '';
      const isOwner = email.toLowerCase() === 'topkuchalo@gmail.com';
      const initialProfile = {
        id: userId,
        email: email || undefined,
        username: email ? email.split('@')[0] : `user_${userId.slice(0, 6)}`,
        display_name: isOwner ? 'Admin TopKuchalo' : (email ? email.split('@')[0] : 'User'),
        role: isOwner ? 'super_admin' : 'user',
        is_artist: isOwner,
        upload_access: isOwner ? 'active' : 'none',
      };
      const { data: inserted } = await supabase
        .from('profiles')
        .upsert(initialProfile)
        .select('*')
        .maybeSingle();
      if (inserted) {
        data = inserted;
      }
    } catch {
      // Ignore provision failure
    }
  }

  if (data) {
    // Check if the user is the designated super admin (topkuchalo@gmail.com)
    const isOwnerEmail = data.email?.toLowerCase() === 'topkuchalo@gmail.com' || (data.username && data.username.toLowerCase() === 'topkuchalo');
    if (isOwnerEmail && data.role !== 'super_admin') {
      data.role = 'super_admin';
      data.is_artist = true;
      data.upload_access = 'active';
      await supabase.from('profiles').update({ role: 'super_admin', is_artist: true, upload_access: 'active' }).eq('id', userId).catch(() => {});
    } else if (data.role === 'super_admin' || data.role === 'admin') {
      // Admins and super_admins always have artist upload privileges
      data.is_artist = true;
    }
    // Synchronize to useAuthStore
    useAuthStore.getState().setUser(data as any);
  }

  return data;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, username: string, displayName?: string) => Promise<void>;
  /** @deprecated kept for any remaining callers — maps to signInWithEmail */
  signInWithUsername: (usernameOrEmail: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const noop = async () => {};

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signInWithEmail: noop,
  signUpWithEmail: noop,
  signInWithUsername: noop,
  signOut: noop,
  refreshProfile: noop,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = async () => {
    if (!user) { setProfile(null); return; }
    const profileData = await getProfile(user.id);
    setProfile(profileData);
  };

  const initialLoadRef = useRef(true);

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        if (error) {
          if (error.message?.toLowerCase().includes('refresh token') || error.message?.toLowerCase().includes('not found')) {
            toast.warning('Your login session has expired. Please log in again.');
            supabase.auth.signOut().catch(() => {});
          }
          setUser(null);
          setProfile(null);
          return;
        }
        setUser(session?.user ?? null);
        if (session?.user) {
          autoActivateAllSuccessfulArtistPlans().then(() => {
            getProfile(session.user.id).then(setProfile);
          });
        }
      })
      .catch(error => {
        if (error?.message?.toLowerCase().includes('refresh token') || error?.message?.toLowerCase().includes('not found')) {
          toast.warning('Your login session has expired. Please log in again.');
          supabase.auth.signOut().catch(() => {});
        } else if (error?.message) {
          toast.error(`Session error: ${error.message}`);
        }
      })
      .finally(() => {
        setLoading(false);
        // Turn off initial load flag after session resolution is done
        setTimeout(() => {
          initialLoadRef.current = false;
        }, 1000);
      });

    // Do NOT use await inside onAuthStateChange – use .then() to avoid deadlocks.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        autoActivateAllSuccessfulArtistPlans().then(() => {
          getProfile(session.user.id).then((prof) => {
            setProfile(prof);
            if (event === 'SIGNED_IN' && !initialLoadRef.current) {
              toast.success(`Welcome back, ${prof?.display_name || session.user.email}!`);
            }
          });
        });
      } else {
        setProfile(null);
        useAuthStore.getState().setUser(null);
        if (event === 'SIGNED_OUT' && !initialLoadRef.current) {
          toast.info('You have logged out successfully.');
        } else if (event === 'USER_UPDATED' && !session && !initialLoadRef.current) {
          toast.warning('Your login session expired. Please log in again.');
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Realtime profile synchronization so changes (like upload_access and artist promotion) reflect instantly
  useEffect(() => {
    if (!user?.id) return;
    const channelId = `auth_profile_sync_${user.id}_${Math.random().toString(36).slice(2, 9)}`;
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        () => {
          getProfile(user.id).then(setProfile);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Sign in directly with real email
  const signInWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) throw error;
  };

  // Register with real Gmail / any email
  const signUpWithEmail = async (
    email: string,
    password: string,
    username: string,
    displayName?: string,
  ) => {
    const authEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signUp({ email: authEmail, password });
    if (error) throw error;
    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        username: username.toLowerCase(),
        display_name: displayName || username,
        email: authEmail,
        role: 'user',
      }, { onConflict: 'id' });
    }
  };

  // Backward-compat shim: if caller passes a bare username (no @) we still work
  const signInWithUsername = async (usernameOrEmail: string, password: string) => {
    const email = usernameOrEmail.includes('@')
      ? usernameOrEmail.trim().toLowerCase()
      : `${usernameOrEmail.toLowerCase()}@zedvevo.app`;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signInWithEmail, signUpWithEmail, signInWithUsername, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
