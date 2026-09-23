import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react';
import { supabase } from '@/db/supabase';
import type { User } from '@supabase/supabase-js';
import type { Profile } from '@/types/index';
import { toast } from 'sonner';

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
        return retry.data;
      }
    }
    console.warn('Failed to fetch profile:', error.message || error);
    return null;
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
          getProfile(session.user.id).then(setProfile);
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
        getProfile(session.user.id).then((prof) => {
          setProfile(prof);
          if (event === 'SIGNED_IN' && !initialLoadRef.current) {
            toast.success(`Welcome back, ${prof?.display_name || session.user.email}!`);
          }
        });
      } else {
        setProfile(null);
        if (event === 'SIGNED_OUT' && !initialLoadRef.current) {
          toast.info('You have logged out successfully.');
        } else if (event === 'USER_UPDATED' && !session && !initialLoadRef.current) {
          toast.warning('Your login session expired. Please log in again.');
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

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
