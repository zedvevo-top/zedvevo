import type { User as SupabaseUser } from '@supabase/supabase-js';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { auth, googleProvider } from '@/lib/firebase';
import { fbGetProfile, fbUpsertProfile } from '@/lib/firebaseDb';
import { clearStaleAuthStorage, supabase } from '@/lib/supabase';
import { ensureAdminDocForCurrentUser, isFirestoreSeeded, migrateAllDataToFirebase } from '@/services/firebaseMigration';
import { autoActivateAllSuccessfulArtistPlans } from '@/services/lipila';
import { useAuthStore } from '@/store/authStore';
import type { Profile } from '@/types/index';

export interface AppUser {
  id: string;
  email?: string;
  displayName?: string | null;
  photoURL?: string | null;
  provider?: 'firebase' | 'supabase';
}

function fromSupabaseUser(u: SupabaseUser): AppUser {
  return {
    id: u.id,
    email: u.email,
    provider: 'supabase',
  };
}

function fromFirebaseUser(u: FirebaseUser): AppUser {
  return {
    id: u.uid,
    email: u.email ?? undefined,
    displayName: u.displayName,
    photoURL: u.photoURL,
    provider: 'firebase',
  };
}

function isRefreshTokenErr(err: any): boolean {
  if (!err) return false;
  const msg = typeof err === 'string' ? err : `${err.message || ''} ${err.error_description || ''} ${err.name || ''} ${err.code || ''} ${JSON.stringify(err)}`;
  const lower = msg.toLowerCase();
  return lower.includes('refresh token') || lower.includes('not found') || lower.includes('invalid_grant');
}

export async function getFirebaseOrProvisionProfile(fbUser: FirebaseUser): Promise<Profile | null> {
  const email = fbUser.email || '';
  const isOwner = email.toLowerCase() === 'topkuchalo@gmail.com' && fbUser.emailVerified;

  if (isOwner) {
    await ensureAdminDocForCurrentUser();
  }

  let existing: Profile | null = null;
  try {
    existing = await fbGetProfile(fbUser.uid);
  } catch {
    // ignore read error if doc does not exist yet
  }

  const now = new Date().toISOString();
  const resolvedRole = isOwner ? 'super_admin' : (existing?.role || 'user');
  const prof: Profile = {
    id: fbUser.uid,
    email: email || existing?.email,
    phone: existing?.phone,
    username: existing?.username || (email ? email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_') : `user_${fbUser.uid.slice(0, 6)}`),
    display_name: existing?.display_name || fbUser.displayName || (isOwner ? 'Admin TopKuchalo' : (email ? email.split('@')[0] : 'User')),
    avatar_url: existing?.avatar_url || fbUser.photoURL || undefined,
    bio: existing?.bio,
    role: resolvedRole,
    is_artist: isOwner ? true : Boolean(existing?.is_artist ?? false),
    upload_access: isOwner ? 'active' : (existing?.upload_access || 'inactive'),
    created_at: existing?.created_at || now,
    updated_at: now,
  };

  try {
    await fbUpsertProfile(prof);
  } catch (err) {
    console.warn('[Auth] Could not upsert Firestore profile:', err);
  }

  try {
    localStorage.setItem('zed_current_profile', JSON.stringify(prof));
  } catch { /* ignore */ }
  useAuthStore.getState().setUser(prof as any);

  return prof;
}

export async function getProfile(userId: string): Promise<Profile | null> {
  // Check Firebase current user first
  if (auth.currentUser && auth.currentUser.uid === userId) {
    return getFirebaseOrProvisionProfile(auth.currentUser);
  }

  let { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    if (error.code === 'PGRST303' || error.message?.includes('JWT issued at future')) {
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
    const isOwnerEmail = data.email?.toLowerCase() === 'topkuchalo@gmail.com' || (data.username && data.username.toLowerCase() === 'topkuchalo');
    if (isOwnerEmail && data.role !== 'super_admin') {
      data.role = 'super_admin';
      data.is_artist = true;
      data.upload_access = 'active';
      try {
        await supabase.from('profiles').update({ role: 'super_admin', is_artist: true, upload_access: 'active' }).eq('id', userId);
      } catch {
        // ignore update fallback error
      }
    } else if (data.role === 'super_admin' || data.role === 'admin') {
      data.is_artist = true;
    }
    try {
      localStorage.setItem('zed_current_profile', JSON.stringify(data));
    } catch { /* ignore */ }
    useAuthStore.getState().setUser(data as any);
  }

  return data;
}

interface AuthContextType {
  user: AppUser | null;
  firebaseUser: FirebaseUser | null;
  profile: Profile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
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
  firebaseUser: null,
  profile: null,
  loading: true,
  signInWithGoogle: noop,
  signInWithEmail: noop,
  signUpWithEmail: noop,
  signInWithUsername: noop,
  signOut: noop,
  refreshProfile: noop,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(() => {
    try {
      const raw = localStorage.getItem('zed_current_profile');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);
  const autoMigratedRef = useRef(false);

  const updateProfileState = (prof: Profile | null) => {
    setProfile(prof);
    try {
      if (prof) {
        localStorage.setItem('zed_current_profile', JSON.stringify(prof));
      } else {
        localStorage.removeItem('zed_current_profile');
      }
    } catch { /* ignore */ }
  };

  const refreshProfile = async () => {
    if (firebaseUser) {
      const prof = await getFirebaseOrProvisionProfile(firebaseUser);
      updateProfileState(prof);
      return;
    }
    if (!user) { updateProfileState(null); return; }
    const profileData = await getProfile(user.id);
    updateProfileState(profileData);
  };

  const initialLoadRef = useRef(true);

  useEffect(() => {
    const safetyTimeout = setTimeout(() => {
      setLoading(false);
      initialLoadRef.current = false;
    }, 1200);

    // 1. Firebase Auth listener (Google Sign-In)
    const unsubFirebase = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        setUser(fromFirebaseUser(fbUser));
        const prof = await getFirebaseOrProvisionProfile(fbUser);
        updateProfileState(prof);
        setLoading(false);

        // If owner signs in via Google, ensure Firestore database has all music, users, and data populated
        if (fbUser.email?.toLowerCase() === 'topkuchalo@gmail.com' && fbUser.emailVerified && !autoMigratedRef.current) {
          autoMigratedRef.current = true;
          try {
            const seeded = await isFirestoreSeeded();
            if (!seeded) {
              toast.info('Populating Firebase Firestore with all music, users, and data...');
              const res = await migrateAllDataToFirebase();
              toast.success(`Firebase database ready! Synced ${res.totalWritten} records (music, users, awards & settings).`);
            }
          } catch (err) {
            console.warn('[FirebaseMigration] Auto-seed notice:', err);
          }
        }
      }
    });

    // 2. Supabase legacy session restore (fallback if not signed into Firebase)
    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        if (auth.currentUser) return; // Firebase session takes precedence
        if (error) {
          if (isRefreshTokenErr(error)) {
            clearStaleAuthStorage();
            supabase.auth.signOut().catch(() => {});
          }
          setUser(null);
          updateProfileState(null);
          return;
        }
        if (session?.user) {
          setUser(fromSupabaseUser(session.user));
          getProfile(session.user.id).then(updateProfileState);
          autoActivateAllSuccessfulArtistPlans(session.user.id).catch(() => {});
        } else if (!auth.currentUser) {
          setUser(null);
          updateProfileState(null);
        }
      })
      .catch(error => {
        if (isRefreshTokenErr(error)) {
          clearStaleAuthStorage();
          supabase.auth.signOut().catch(() => {});
        } else if (error?.message && !error.message.includes('Failed to fetch') && !error.message.includes('NetworkError') && !error.message.includes('network')) {
          toast.error(`Session notice: ${error.message}`);
        }
      })
      .finally(() => {
        clearTimeout(safetyTimeout);
        setLoading(false);
        setTimeout(() => {
          initialLoadRef.current = false;
        }, 800);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (auth.currentUser) return; // Firebase session active
      if (session?.user) {
        setUser(fromSupabaseUser(session.user));
        getProfile(session.user.id).then((prof) => {
          updateProfileState(prof);
          if (event === 'SIGNED_IN' && !initialLoadRef.current) {
            toast.success(`Welcome back, ${prof?.display_name || session.user.email}!`);
          }
        });
        autoActivateAllSuccessfulArtistPlans(session.user.id).catch(() => {});
      } else {
        setUser(null);
        updateProfileState(null);
        useAuthStore.getState().setUser(null);
        if (event === 'SIGNED_OUT' && !initialLoadRef.current) {
          toast.info('You have logged out successfully.');
        } else if (event === 'USER_UPDATED' && !session && !initialLoadRef.current) {
          toast.warning('Your login session expired. Please log in again.');
        }
      }
    });

    return () => {
      unsubFirebase();
      subscription.unsubscribe();
    };
  }, []);

  // Realtime profile synchronization for Supabase sessions
  useEffect(() => {
    if (!user?.id || user.provider === 'firebase') return;
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
  }, [user?.id, user?.provider]);

  const signInWithGoogle = async () => {
    const result = await signInWithPopup(auth, googleProvider);
    if (result.user) {
      setFirebaseUser(result.user);
      setUser(fromFirebaseUser(result.user));
      const prof = await getFirebaseOrProvisionProfile(result.user);
      updateProfileState(prof);
      toast.success(`Signed in with Google as ${prof?.display_name || result.user.email}`);
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) {
        if (error.message?.toLowerCase().includes('rate') || (error as any).status === 429) {
          throw new Error('Too many login attempts. Please wait 60 seconds and try again.');
        }
        throw error;
      }
    } catch (err: any) {
      if (err.message?.toLowerCase().includes('rate') || err.status === 429) {
        throw new Error('Too many login attempts. Please wait 60 seconds and try again.');
      }
      throw err;
    }
  };

  const signUpWithEmail = async (
    email: string,
    password: string,
    username: string,
    displayName?: string,
  ) => {
    const authEmail = email.trim().toLowerCase();
    try {
      const { data, error } = await supabase.auth.signUp({ email: authEmail, password });
      if (error) {
        if (error.message?.toLowerCase().includes('rate') || (error as any).status === 429) {
          throw new Error('Too many requests. Please wait 60 seconds and try again.');
        }
        throw error;
      }
      if (data.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          username: username.toLowerCase(),
          display_name: displayName || username,
          email: authEmail,
          role: 'user',
        }, { onConflict: 'id' });
      }
    } catch (err: any) {
      if (err.message?.toLowerCase().includes('rate') || err.status === 429) {
        throw new Error('Too many requests. Please wait 60 seconds and try again.');
      }
      throw err;
    }
  };

  const signInWithUsername = async (usernameOrEmail: string, password: string) => {
    const email = usernameOrEmail.includes('@')
      ? usernameOrEmail.trim().toLowerCase()
      : `${usernameOrEmail.toLowerCase()}@zedvevo.app`;
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        if (error.message?.toLowerCase().includes('rate') || (error as any).status === 429) {
          throw new Error('Too many login attempts. Please wait 60 seconds and try again.');
        }
        throw error;
      }
    } catch (err: any) {
      if (err.message?.toLowerCase().includes('rate') || err.status === 429) {
        throw new Error('Too many login attempts. Please wait 60 seconds and try again.');
      }
      throw err;
    }
  };

  const signOut = async () => {
    await Promise.allSettled([
      firebaseSignOut(auth),
      supabase.auth.signOut(),
    ]);
    setFirebaseUser(null);
    setUser(null);
    updateProfileState(null);
    useAuthStore.getState().setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      firebaseUser,
      profile,
      loading,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      signInWithUsername,
      signOut,
      refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
