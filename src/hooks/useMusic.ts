import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, isConfigured, type Song, type Album, type Artist, type Playlist } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { mockSongs, mockAlbums, mockArtists } from '@/lib/mockData'

// Helper to normalize artist objects across different schema variants
export function normalizeArtist(a: any): Artist {
  const name = a.name || a.stage_name || 'Artist'
  const avatar = a.avatar_url || a.cover_url || a.cover_image_url || a.user?.avatar_url || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400'
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
    play_count: a.play_count ?? a.total_streams ?? 0,
    monthly_listeners: a.monthly_listeners ?? a.play_count ?? 12500,
    total_followers: a.total_followers ?? Math.floor((a.play_count || 1000) / 3),
    total_streams: a.total_streams ?? a.play_count ?? 0,
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
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .eq('artist_id', artistId)
        .order('created_at', { ascending: false })

      if (error || !data || data.length === 0) return mockSongs.filter(s => s.artist_id === artistId)
      return data as Song[]
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
      const { data, error } = await supabase
        .from('artists')
        .select('*, songs(play_count)')
        .order('play_count', { ascending: false })
        .limit(limit)

      if (error || !data || data.length === 0) {
        return mockArtists.map(normalizeArtist).slice(0, limit)
      }
      return data.map((artist: any) => {
        const songsPlays = (artist.songs || []).reduce((sum: number, song: any) => sum + (Number(song.play_count) || 0), 0);
        const totalPlays = Math.max(Number(artist.play_count) || 0, songsPlays);
        return normalizeArtist({ ...artist, play_count: totalPlays });
      })
    },
  })
}

export function useFeaturedArtists(limit = 10) {
  return useQuery({
    queryKey: ['artists', 'featured', limit],
    queryFn: async () => {
      if (!isConfigured) return mockArtists.filter(a => a.featured || a.is_featured).map(normalizeArtist).slice(0, limit)
      const { data, error } = await supabase
        .from('artists')
        .select('*, songs(play_count)')
        .order('play_count', { ascending: false })
        .limit(limit)

      if (error || !data || data.length === 0) {
        return mockArtists.map(normalizeArtist).slice(0, limit)
      }
      return data.map((artist: any) => {
        const songsPlays = (artist.songs || []).reduce((sum: number, song: any) => sum + (Number(song.play_count) || 0), 0);
        const totalPlays = Math.max(Number(artist.play_count) || 0, songsPlays);
        return normalizeArtist({ ...artist, play_count: totalPlays });
      })
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
      const { data, error } = await supabase
        .from('artists')
        .select('*, songs(play_count)')
        .eq('id', id)
        .single()

      if (error || !data) {
        const found = mockArtists.find(a => a.id === id) || mockArtists[0]
        return normalizeArtist(found)
      }
      const songsPlays = (data.songs || []).reduce((sum: number, song: any) => sum + (Number(song.play_count) || 0), 0);
      const totalPlays = Math.max(Number(data.play_count) || 0, songsPlays);
      return normalizeArtist({ ...data, play_count: totalPlays })
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
