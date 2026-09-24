import { useState, useEffect, useCallback } from 'react';
import { supabase, type Profile } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export function useUserProfile(targetUserId?: string | null) {
  const { user: authUser, profile: authProfile } = useAuth();
  const userId = targetUserId || authUser?.id;

  const [profile, setProfile] = useState<Profile | null>(() => {
    if (!targetUserId || targetUserId === authUser?.id) {
      return authProfile || null;
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(!profile && !!userId);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const { data, error: fetchErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (fetchErr) {
        throw fetchErr;
      }

      if (data) {
        if (data.avatar_url && !data.avatar_url.startsWith('http') && !data.avatar_url.startsWith('data:')) {
          const { data: pub } = supabase.storage.from('avatars').getPublicUrl(data.avatar_url);
          data.avatar_url = pub.publicUrl;
        }
        setProfile(data);
        setError(null);
      } else {
        if (authUser && userId === authUser.id) {
          const meta = authUser.user_metadata || {};
          const fallbackProfile: Profile = {
            id: authUser.id,
            email: authUser.email || '',
            username: meta.username || authUser.email?.split('@')[0] || 'user',
            display_name: meta.display_name || meta.full_name || authUser.email?.split('@')[0] || 'User',
            avatar_url: meta.avatar_url || meta.picture || meta.photo_url || null,
            role: 'user',
            is_artist: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          setProfile(fallbackProfile);
        } else {
          setProfile(null);
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch profile');
      if (authProfile) {
        setProfile(authProfile);
      } else if (authUser && userId === authUser.id) {
        const meta = authUser.user_metadata || {};
        setProfile({
          id: authUser.id,
          email: authUser.email || '',
          username: meta.username || authUser.email?.split('@')[0] || 'user',
          display_name: meta.display_name || meta.full_name || authUser.email?.split('@')[0] || 'User',
          avatar_url: meta.avatar_url || meta.picture || meta.photo_url || null,
          role: 'user',
          is_artist: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [userId, authUser]);

  useEffect(() => {
    if (targetUserId && targetUserId !== authUser?.id) {
      fetchProfile();
    } else if (authProfile) {
      setProfile(authProfile);
      setIsLoading(false);
    } else {
      fetchProfile();
    }
  }, [userId, targetUserId, authProfile, fetchProfile]);

  useEffect(() => {
    if (!userId) return;

    const channelId = `profile_sync_${userId}_${Math.random().toString(36).slice(2, 9)}`;
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
        (payload) => {
          if (payload.new) {
            const updated = payload.new as Profile;
            if (updated.avatar_url && !updated.avatar_url.startsWith('http') && !updated.avatar_url.startsWith('data:')) {
              const { data: pub } = supabase.storage.from('avatars').getPublicUrl(updated.avatar_url);
              updated.avatar_url = pub.publicUrl;
            }
            setProfile(updated);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return {
    profile,
    isLoading,
    error,
    refreshProfile: fetchProfile,
  };
}

export function useProfilesMap(userIds: string[]) {
  const [profilesMap, setProfilesMap] = useState<Record<string, Profile>>({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!userIds || userIds.length === 0) return;
    const uniqueIds = Array.from(new Set(userIds)).filter(Boolean);
    if (uniqueIds.length === 0) return;

    async function fetchBatch() {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .in('id', uniqueIds);

        if (!error && data) {
          const map: Record<string, Profile> = {};
          data.forEach((p: Profile) => {
            if (p.avatar_url && !p.avatar_url.startsWith('http') && !p.avatar_url.startsWith('data:')) {
              const { data: pub } = supabase.storage.from('avatars').getPublicUrl(p.avatar_url);
              p.avatar_url = pub.publicUrl;
            }
            map[p.id] = p;
          });
          setProfilesMap(map);
        }
      } finally {
        setIsLoading(false);
      }
    }

    fetchBatch();
  }, [userIds.join(',')]);

  return { profilesMap, isLoading };
}

export function useAllUserProfiles() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfiles = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error: fetchErr } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchErr) throw fetchErr;
      
      const mapped = (data || []).map(p => {
        if (p.avatar_url && !p.avatar_url.startsWith('http') && !p.avatar_url.startsWith('data:')) {
          const { data: pub } = supabase.storage.from('avatars').getPublicUrl(p.avatar_url);
          p.avatar_url = pub.publicUrl;
        }
        return p;
      });
      
      setProfiles(mapped);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  return { profiles, setProfiles, loading, error, refreshProfiles: fetchProfiles };
}

export function resolveUserAvatarUrl(profile: Partial<Profile> | null) {
  if (!profile) return undefined;
  if (profile.avatar_url) return profile.avatar_url;
  return undefined;
}
