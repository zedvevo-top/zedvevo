import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, isConfigured, type Song, type Album, type Artist, type Playlist } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { mockSongs, mockAlbums, mockArtists } from '@/lib/mockData'
import { resolveArtistAvatar } from '@/lib/api'

// Helper to normalize artist objects across different schema variants
export function normalizeArtist(a: any): Artist {
  const name = a.name || a.stage_name || 'Artist'
  const firstSongCover = (a.songs || []).find((s: any) => s.cover_url)?.cover_url;
  const avatar = resolveArtistAvatar(a, firstSongCover);
  const cover = a.cover_url || a.cover_image_url || avatar
  return {
    ...a,
    id: a.id,
    user_id: a.user_id || a.id,
    name: name,
    stage_name: a.stage_name || name,
    bio: a.bio || '',
    avatar_url: avatar,
    cover_url: cover,
    cover_image_url: cover,
    genre: a.genre || 'Afrobeats / Zed',
    is_featured: a.is_featured ?? a.featured ?? false,
    featured: a.is_featured ?? a.featured ?? false,
    verified: a.verified ?? true,
    play_count: Number(a.play_count) || 0,
    monthly_listeners: a.monthly_listeners !== undefined && a.monthly_listeners !== null ? Number(a.monthly_listeners) : (Number(a.play_count) || 0),
    total_followers: a.total_followers !== undefined && a.total_followers !== null ? Number(a.total_followers) : Math.max(0, Math.floor((Number(a.play_count) || 0) * 0.3)),
    total_streams: Number(a.play_count) || Number(a.total_streams) || 0,
    website: a.website || null,
    social_links: a.social_links || {},
    created_at: a.created_at || new Date().toISOString(),
    user: a.user || {
      id: a.user_id || a.id,
      avatar_url: avatar,
      full_name: name,
      username: name.toLowerCase().replace(/\s+/g, '_'),
    },
  }
}

// Songs Hooks
export function useSongs(genreId?: string, limit = 20) {
  return useQuery({
    queryKey: ['songs', { genreId, limit }],
    queryFn: async () => {
      if (!isConfigured) return mockSongs.slice(0, limit)
      const query = supabase
        .from('songs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)

      const { data, error } = await query
      if (error || !data || data.length === 0) return mockSongs.slice(0, limit)
      return data as Song[]
    },
  })
}

export function useFeaturedSongs(limit = 10) {
  return useQuery({
    queryKey: ['songs', 'featured', limit],
    queryFn: async () => {
      if (!isConfigured) return mockSongs.filter(s => s.is_featured).slice(0, limit)
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .order('play_count', { ascending: false })
        .limit(limit)

      if (error || !data || data.length === 0) return mockSongs.filter(s => s.is_featured).slice(0, limit)
      return data as Song[]
    },
  })
}

export function useTrendingSongs(limit = 20) {
  return useQuery({
    queryKey: ['songs', 'trending', limit],
    queryFn: async () => {
      if (!isConfigured) return mockSongs.slice(0, limit)
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .order('play_count', { ascending: false })
        .limit(limit)

      if (error || !data || data.length === 0) return mockSongs.slice(0, limit)
      return data as Song[]
    },
  })
}

export function useSong(slug: string) {
  return useQuery({
    queryKey: ['song', slug],
    queryFn: async () => {
      if (!isConfigured) return mockSongs.find(s => s.slug === slug) || mockSongs[0]
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .or(`slug.eq.${slug},id.eq.${slug}`)
        .single()

      if (error) return mockSongs.find(s => s.slug === slug) || mockSongs[0]
      return data as Song
    },
    enabled: !!slug,
  })
}

export function useArtistSongs(artistId: string) {
  return useQuery({
    queryKey: ['songs', 'artist', artistId],
    queryFn: async () => {
      if (!isConfigured) return mockSongs.filter(s => s.artist_id === artistId)

      // Fetch the artist record to know user_id and stage/artist name
      const { data: artist } = await supabase
        .from('artists')
        .select('*')
        .eq('id', artistId)
        .maybeSingle();

      const { data: allSongs, error } = await supabase
        .from('songs')
        .select('*')
        .eq('status', 'approved')
        .order('created_at', { ascending: false });

      if (error || !allSongs) return [];

      const clean = (str: string) => (str || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
      const artistName = clean(artist?.name || '');
      const artistStageName = clean(artist?.stage_name || '');
      const artistUserId = artist?.user_id;

      const matched = allSongs.filter((song: any) => {
        if (song.artist_id && song.artist_id === artistId) return true;
        if (song.user_id && artistUserId && song.user_id === artistUserId) return true;
        const songArtistClean = clean(song.artist_name);
        if (songArtistClean && artistName && (songArtistClean === artistName || artistName.includes(songArtistClean) || songArtistClean.includes(artistName))) return true;
        if (songArtistClean && artistStageName && (songArtistClean === artistStageName || artistStageName.includes(songArtistClean) || songArtistClean.includes(artistStageName))) return true;
        return false;
      });

      return matched as Song[];
    },
    enabled: !!artistId,
  })
}

// Albums Hooks
export function useFeaturedAlbums(limit = 10) {
  return useQuery({
    queryKey: ['albums', 'featured', limit],
    queryFn: async () => {
      if (!isConfigured) return mockAlbums.filter(a => a.is_featured).slice(0, limit)
      const { data, error } = await supabase
        .from('albums')
        .select('*, artist:artists(*), genre:categories(*)')
        .eq('is_featured', true)
        .eq('deleted_at', null)
        .order('total_streams', { ascending: false })
        .limit(limit)

      if (error) return mockAlbums.filter(a => a.is_featured).slice(0, limit)
      return (data || mockAlbums.filter(a => a.is_featured).slice(0, limit)) as Album[]
    },
  })
}

export function useAlbum(slug: string) {
  return useQuery({
    queryKey: ['album', slug],
    queryFn: async () => {
      if (!isConfigured) return mockAlbums.find(a => a.slug === slug) || mockAlbums[0]
      const { data, error } = await supabase
        .from('albums')
        .select('*, artist:artists(*), genre:categories(*)')
        .eq('slug', slug)
        .single()

      if (error) return mockAlbums.find(a => a.slug === slug) || mockAlbums[0]
      return data as Album
    },
    enabled: !!slug,
  })
}

export function useArtistAlbums(artistId: string) {
  return useQuery({
    queryKey: ['albums', 'artist', artistId],
    queryFn: async () => {
      if (!isConfigured) return mockAlbums.filter(a => a.artist_id === artistId)
      const { data, error } = await supabase
        .from('albums')
        .select('*, genre:categories(*)')
        .eq('artist_id', artistId)
        .eq('deleted_at', null)
        .order('release_date', { ascending: false })

      if (error) return mockAlbums.filter(a => a.artist_id === artistId)
      return (data || mockAlbums.filter(a => a.artist_id === artistId)) as Album[]
    },
    enabled: !!artistId,
  })
}

// Artists Hooks
export function useArtists(limit = 50) {
  return useQuery({
    queryKey: ['artists', { limit }],
    queryFn: async () => {
      if (!isConfigured) return mockArtists.map(normalizeArtist).slice(0, limit)
      const { data: artists, error } = await supabase
        .from('artists')
        .select('*')

      if (error || !artists || artists.length === 0) {
        return mockArtists.map(normalizeArtist).slice(0, limit)
      }

      const { data: songs } = await supabase
        .from('songs')
        .select('id, play_count, cover_url, artist_name, user_id, artist_id')
        .eq('status', 'approved')

      const clean = (str: string) => (str || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
      const allSongs = Array.isArray(songs) ? songs : [];
      const artistList = [...artists];
      const existingNames = new Set(artistList.map((a: any) => clean(a.stage_name || a.name)));

      allSongs.forEach((song) => {
        if (!song.artist_name) return;
        const cName = clean(song.artist_name);
        if (cName && !existingNames.has(cName)) {
          existingNames.add(cName);
          artistList.push({
            id: song.artist_id || song.user_id || `artist-${cName}`,
            user_id: song.user_id,
            name: song.artist_name,
            stage_name: song.artist_name,
            avatar_url: song.cover_url,
            cover_url: song.cover_url,
            verified: true,
            bio: 'Official ZedVevo Artist',
            created_at: new Date().toISOString(),
          });
        }
      });

      const mapped = artistList.map((artist: any) => {
        const artistId = artist.id;
        const artistUserId = artist.user_id;
        const artistName = clean(artist.name);
        const artistStageName = clean(artist.stage_name);

        const matchedSongs = allSongs.filter(song => {
          if (song.artist_id && song.artist_id === artistId) return true;
          if (song.user_id && artistUserId && song.user_id === artistUserId) return true;
          const songArtistClean = clean(song.artist_name);
          if (songArtistClean && (songArtistClean === artistName || songArtistClean === artistStageName)) return true;
          if (songArtistClean && (artistName.includes(songArtistClean) || songArtistClean.includes(artistName) || 
              artistStageName.includes(songArtistClean) || songArtistClean.includes(artistStageName))) {
            return true;
          }
          return false;
        });

        const songsPlays = matchedSongs.reduce((sum: number, song: any) => sum + (Number(song.play_count) || 0), 0);
        const totalPlays = matchedSongs.length > 0 ? songsPlays : (Number(artist.play_count) || 0);
        return normalizeArtist({ ...artist, songs: matchedSongs, play_count: totalPlays });
      });

      // Prioritize real active artists
      mapped.sort((a: any, b: any) => {
        const aName = a.name || '';
        const bName = b.name || '';
        const aIsGeneric = aName.toLowerCase() === 'artist' || aName.toLowerCase().includes('zedvevo artist') || aName.toLowerCase() === 'top';
        const bIsGeneric = bName.toLowerCase() === 'artist' || bName.toLowerCase().includes('zedvevo artist') || bName.toLowerCase() === 'top';

        if (aIsGeneric && !bIsGeneric) return 1;
        if (!aIsGeneric && bIsGeneric) return -1;

        const aSongs = (a.songs || []).length;
        const bSongs = (b.songs || []).length;
        if (aSongs > 0 && bSongs === 0) return -1;
        if (aSongs === 0 && bSongs > 0) return 1;

        return (b.play_count || 0) - (a.play_count || 0);
      });

      return mapped.slice(0, limit);
    },
  })
}

export function useFeaturedArtists(limit = 10) {
  return useQuery({
    queryKey: ['artists', 'featured', limit],
    queryFn: async () => {
      if (!isConfigured) return mockArtists.filter(a => a.featured || a.is_featured).map(normalizeArtist).slice(0, limit)
      const { data: artists, error } = await supabase
        .from('artists')
        .select('*')

      if (error || !artists || artists.length === 0) {
        return mockArtists.map(normalizeArtist).slice(0, limit)
      }

      const { data: songs } = await supabase
        .from('songs')
        .select('id, play_count, cover_url, artist_name, user_id, artist_id')
        .eq('status', 'approved')

      const clean = (str: string) => (str || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
      const allSongs = Array.isArray(songs) ? songs : [];
      const artistList = [...artists];
      const existingNames = new Set(artistList.map((a: any) => clean(a.stage_name || a.name)));

      allSongs.forEach((song) => {
        if (!song.artist_name) return;
        const cName = clean(song.artist_name);
        if (cName && !existingNames.has(cName)) {
          existingNames.add(cName);
          artistList.push({
            id: song.artist_id || song.user_id || `artist-${cName}`,
            user_id: song.user_id,
            name: song.artist_name,
            stage_name: song.artist_name,
            avatar_url: song.cover_url,
            cover_url: song.cover_url,
            verified: true,
            bio: 'Official ZedVevo Artist',
            created_at: new Date().toISOString(),
          });
        }
      });

      const mapped = artistList.map((artist: any) => {
        const artistId = artist.id;
        const artistUserId = artist.user_id;
        const artistName = clean(artist.name);
        const artistStageName = clean(artist.stage_name);

        const matchedSongs = allSongs.filter(song => {
          if (song.artist_id && song.artist_id === artistId) return true;
          if (song.user_id && artistUserId && song.user_id === artistUserId) return true;
          const songArtistClean = clean(song.artist_name);
          if (songArtistClean && (songArtistClean === artistName || songArtistClean === artistStageName)) return true;
          if (songArtistClean && (artistName.includes(songArtistClean) || songArtistClean.includes(artistName) || 
              artistStageName.includes(songArtistClean) || songArtistClean.includes(artistStageName))) {
            return true;
          }
          return false;
        });

        const songsPlays = matchedSongs.reduce((sum: number, song: any) => sum + (Number(song.play_count) || 0), 0);
        const totalPlays = matchedSongs.length > 0 ? songsPlays : (Number(artist.play_count) || 0);
        return normalizeArtist({ ...artist, songs: matchedSongs, play_count: totalPlays });
      });

      // Prioritize real active artists
      mapped.sort((a: any, b: any) => {
        const aName = a.name || '';
        const bName = b.name || '';
        const aIsGeneric = aName.toLowerCase() === 'artist' || aName.toLowerCase().includes('zedvevo artist') || aName.toLowerCase() === 'top';
        const bIsGeneric = bName.toLowerCase() === 'artist' || bName.toLowerCase().includes('zedvevo artist') || bName.toLowerCase() === 'top';

        if (aIsGeneric && !bIsGeneric) return 1;
        if (!aIsGeneric && bIsGeneric) return -1;

        const aSongs = (a.songs || []).length;
        const bSongs = (b.songs || []).length;
        if (aSongs > 0 && bSongs === 0) return -1;
        if (aSongs === 0 && bSongs > 0) return 1;

        return (b.play_count || 0) - (a.play_count || 0);
      });

      return mapped.slice(0, limit);
    },
  })
}

export function useArtist(id: string) {
  return useQuery({
    queryKey: ['artist', id],
    queryFn: async () => {
      if (!isConfigured) {
        const found = mockArtists.find(a => a.id === id) || mockArtists[0]
        return normalizeArtist(found)
      }
      const { data: artist, error } = await supabase
        .from('artists')
        .select('*')
        .eq('id', id)
        .single()

      if (error || !artist) {
        const found = mockArtists.find(a => a.id === id) || mockArtists[0]
        return normalizeArtist(found)
      }

      const { data: songs } = await supabase
        .from('songs')
        .select('id, play_count, cover_url, artist_name, user_id, artist_id')
        .eq('status', 'approved')

      const clean = (str: string) => (str || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
      const allSongs = Array.isArray(songs) ? songs : [];

      const artistId = artist.id;
      const artistUserId = artist.user_id;
      const artistName = clean(artist.name);
      const artistStageName = clean(artist.stage_name);

      const matchedSongs = allSongs.filter(song => {
        if (song.artist_id && song.artist_id === artistId) return true;
        if (song.user_id && artistUserId && song.user_id === artistUserId) return true;
        const songArtistClean = clean(song.artist_name);
        if (songArtistClean && (songArtistClean === artistName || songArtistClean === artistStageName)) return true;
        if (songArtistClean && (artistName.includes(songArtistClean) || songArtistClean.includes(artistName) || 
            artistStageName.includes(songArtistClean) || songArtistClean.includes(artistStageName))) {
          return true;
        }
        return false;
      });

      const songsPlays = matchedSongs.reduce((sum: number, song: any) => sum + (Number(song.play_count) || 0), 0);
      const totalPlays = matchedSongs.length > 0 ? songsPlays : (Number(artist.play_count) || 0);
      return normalizeArtist({ ...artist, songs: matchedSongs, play_count: totalPlays })
    },
    enabled: !!id,
  })
}

// Playlists Hooks
export function usePlaylists() {
  const user = useAuthStore((state) => state.user)
  return useQuery({
    queryKey: ['playlists', user?.id],
    queryFn: async () => {
      if (!user || !isConfigured) return []
      const { data, error } = await supabase
        .from('playlists')
        .select('*, playlist_songs(count)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    },
  })
}

export function useCreatePlaylist() {
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.user)
  return useMutation({
    mutationFn: async ({ name, description, isPublic }: { name: string; description?: string; isPublic?: boolean }) => {
      if (!user || !supabase) throw new Error('Not authenticated')
      const { data, error } = await supabase
        .from('playlists')
        .insert({ user_id: user.id, name, description, is_public: isPublic })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['playlists'] }) },
  })
}

export function useAddToPlaylist() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ playlistId, songId }: { playlistId: string; songId: string }) => {
      if (!supabase) throw new Error('Supabase not configured')
      const { error } = await supabase.from('playlist_songs').insert({ playlist_id: playlistId, song_id: songId })
      if (error) throw error
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['playlists'] }) },
  })
}

export function useRemoveFromPlaylist() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ playlistId, songId }: { playlistId: string; songId: string }) => {
      if (!supabase) throw new Error('Supabase not configured')
      const { error } = await supabase.from('playlist_songs').delete().eq('playlist_id', playlistId).eq('song_id', songId)
      if (error) throw error
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['playlists'] }) },
  })
}

// Likes/Favorites Hooks
export function useLikeSong() {
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.user)
  return useMutation({
    mutationFn: async ({ songId, action }: { songId: string; action: 'like' | 'unlike' }) => {
      if (!user || !supabase) throw new Error('Not authenticated')
      if (action === 'like') {
        const { error } = await supabase.from('likes').insert({ user_id: user.id, song_id: songId })
        if (error && error.code !== '23505') throw error
      } else {
        const { error } = await supabase.from('likes').delete().eq('user_id', user.id).eq('song_id', songId)
        if (error) throw error
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['likes'] }) },
  })
}

export function useLikedSongs() {
  const user = useAuthStore((state) => state.user)
  return useQuery({
    queryKey: ['likes', user?.id],
    queryFn: async () => {
      if (!user || !supabase) return []
      const { data, error } = await supabase
        .from('likes')
        .select('song_id')
        .eq('user_id', user.id)

      if (error) return []
      return data.map((l) => l.song_id)
    },
  })
}

// Follow Artist Hooks
export function useFollowArtist() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (artistId: string) => {
      const user = useAuthStore.getState().user
      if (!user || !supabase) throw new Error('Not authenticated')
      const { error } = await supabase.from('artist_followers').insert({ user_id: user.id, artist_id: artistId })
      if (error && error.code !== '23505') throw error
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['artist_followers'] }) },
  })
}

export function useUnfollowArtist() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (artistId: string) => {
      const user = useAuthStore.getState().user
      if (!user || !supabase) throw new Error('Not authenticated')
      const { error } = await supabase.from('artist_followers').delete().eq('user_id', user.id).eq('artist_id', artistId)
      if (error) throw error
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['artist_followers'] }) },
  })
}

// Alias exports for compatibility
export const useFavoriteSong = useSong
export function useToggleFavorite() {
  return useMutation({
    mutationFn: async ({ songId, action }: { songId: string; action: 'like' | 'unlike' }) => {
      const user = useAuthStore.getState().user
      if (!user || !supabase) throw new Error('Not authenticated')
      if (action === 'like') {
        const { error } = await supabase.from('likes').insert({ user_id: user.id, song_id: songId })
        if (error && error.code !== '23505') throw error
      } else {
        const { error } = await supabase.from('likes').delete().eq('user_id', user.id).eq('song_id', songId)
        if (error) throw error
      }
    },
  })
}
export const useFavorites = useLikedSongs
export function useCreateSong() {
  return useMutation({
    mutationFn: async (data: any) => {
      if (!supabase) throw new Error('Supabase not configured')
      const { data: song, error } = await supabase.from('songs').insert(data).select().single()
      if (error) throw error
      return song
    },
  })
}
export function useAlbums() {
  return useQuery({
    queryKey: ['albums'],
    queryFn: async () => {
      if (!isConfigured) return mockAlbums
      const { data, error } = await supabase.from('albums').select('*, artist:artists(*)').eq('deleted_at', null).order('created_at', { ascending: false }).limit(50)
      if (error) return mockAlbums
      return (data || mockAlbums) as Album[]
    },
  })
}
