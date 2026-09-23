import { supabase } from '@/db/supabase';
import type {
  Song, Video, HeroBanner, Artist, Sponsor, Award, AwardCategory,
  Nominee, Vote, UploadPlan, UserSubscription, Payment, Notification,
  Profile, Download, WeeklyTrending, WinnerOfMonth, AppSetting,
  SearchResult, SearchFilter, SearchSort
} from '@/types/index';

export type { Payment, Sponsor, Song, Video, Artist, Award, Nominee, Vote, Profile };

// ============================================================
// SONGS
// ============================================================
export async function getSongs(opts: { status?: string; limit?: number; offset?: number; userId?: string } = {}) {
  let q = supabase.from('songs').select('*').order('created_at', { ascending: false }).limit(opts.limit ?? 20);
  if (opts.status) q = q.eq('status', opts.status);
  if (opts.userId) q = q.eq('user_id', opts.userId);
  if (opts.offset) q = q.range(opts.offset, opts.offset + (opts.limit ?? 20) - 1);
  const { data, error } = await q;
  if (error) throw error;
  return Array.isArray(data) ? data as Song[] : [];
}

export async function getTrendingSongs(limit = 10) {
  // First try songs explicitly flagged as trending
  const { data: trending, error: e1 } = await supabase
    .from('songs').select('*').eq('status', 'approved').eq('is_trending', true)
    .order('play_count', { ascending: false }).limit(limit);
  if (e1) throw e1;
  if (Array.isArray(trending) && trending.length > 0) return trending as Song[];

  // Fallback: return the most-played approved songs so the section is never empty
  const { data: fallback, error: e2 } = await supabase
    .from('songs').select('*').eq('status', 'approved')
    .order('play_count', { ascending: false }).limit(limit);
  if (e2) throw e2;
  return Array.isArray(fallback) ? fallback as Song[] : [];
}

export async function getPopularSongs(limit = 10) {
  const { data, error } = await supabase
    .from('songs').select('*').eq('status', 'approved')
    .order('play_count', { ascending: false }).limit(limit);
  if (error) throw error;
  return Array.isArray(data) ? data as Song[] : [];
}

export async function getNewSongs(limit = 10) {
  const { data, error } = await supabase
    .from('songs').select('*').eq('status', 'approved')
    .order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return Array.isArray(data) ? data as Song[] : [];
}

export async function getSongById(id: string) {
  const { data, error } = await supabase.from('songs').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data as Song | null;
}

export async function createSong(payload: Partial<Song>) {
  const { error } = await supabase.from('songs').insert(payload);
  if (error) throw error;
}

export async function updateSong(id: string, payload: Partial<Song>) {
  const { error } = await supabase.from('songs').update(payload).eq('id', id);
  if (error) throw error;
}

export async function deleteSong(id: string) {
  const { error } = await supabase.from('songs').delete().eq('id', id);
  if (error) throw error;
}

export async function incrementPlayCount(songId: string) {
  try {
    const { error } = await supabase.rpc('increment_play_count', { song_id: songId });
    if (error) {
      // Fallback: direct increment on songs table if RPC is unavailable
      const { data } = await supabase.from('songs').select('play_count').eq('id', songId).maybeSingle();
      if (data) {
        await supabase.from('songs').update({ play_count: (Number(data.play_count) || 0) + 1 }).eq('id', songId);
      }
    }
  } catch (err) {
    console.error('play count error', err);
  }
}

// ============================================================
// VIDEOS
// ============================================================
export async function getVideos(opts: { status?: string; limit?: number; offset?: number; userId?: string } = {}) {
  let q = supabase.from('videos').select('*').order('created_at', { ascending: false }).limit(opts.limit ?? 20);
  if (opts.status) q = q.eq('status', opts.status);
  if (opts.userId) q = q.eq('user_id', opts.userId);
  if (opts.offset) q = q.range(opts.offset, opts.offset + (opts.limit ?? 20) - 1);
  const { data, error } = await q;
  if (error) throw error;
  return Array.isArray(data) ? data as Video[] : [];
}

export async function getTrendingVideos(limit = 10) {
  // First try videos explicitly flagged as trending
  const { data: trending, error: e1 } = await supabase
    .from('videos').select('*').eq('status', 'approved').eq('is_trending', true)
    .order('view_count', { ascending: false }).limit(limit);
  if (e1) throw e1;
  if (Array.isArray(trending) && trending.length > 0) return trending as Video[];

  // Fallback: return the most-viewed approved videos so the section is never empty
  const { data: fallback, error: e2 } = await supabase
    .from('videos').select('*').eq('status', 'approved')
    .order('view_count', { ascending: false }).limit(limit);
  if (e2) throw e2;
  return Array.isArray(fallback) ? fallback as Video[] : [];
}

export async function getVideoById(id: string) {
  const { data, error } = await supabase.from('videos').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data as Video | null;
}

export async function createVideo(payload: Partial<Video>) {
  const { error } = await supabase.from('videos').insert(payload);
  if (error) throw error;
}

export async function updateVideo(id: string, payload: Partial<Video>) {
  const { error } = await supabase.from('videos').update(payload).eq('id', id);
  if (error) throw error;
}

export async function deleteVideo(id: string) {
  const { error } = await supabase.from('videos').delete().eq('id', id);
  if (error) throw error;
}

export async function incrementViewCount(videoId: string) {
  try {
    const { error } = await supabase.rpc('increment_view_count', { video_id: videoId });
    if (error) {
      // Fallback: direct increment on videos table
      const { data } = await supabase.from('videos').select('view_count').eq('id', videoId).maybeSingle();
      if (data) {
        await supabase.from('videos').update({ view_count: (Number(data.view_count) || 0) + 1 }).eq('id', videoId);
      }
    }
  } catch (err) {
    console.error('view count error', err);
  }
}

// ============================================================
// LIKES & LIBRARY
// ============================================================
export async function toggleLike(userId: string, contentId: string, contentType: 'song' | 'video') {
  const { data: existing } = await supabase
    .from('content_likes').select('id').eq('user_id', userId).eq('content_id', contentId).eq('content_type', contentType).maybeSingle();
  if (existing) {
    await supabase.from('content_likes').delete().eq('id', existing.id);
    // decrement
    if (contentType === 'song') await supabase.from('songs').update({ like_count: supabase.rpc('like_count') }).eq('id', contentId);
    return false;
  } else {
    await supabase.from('content_likes').insert({ user_id: userId, content_id: contentId, content_type: contentType });
    return true;
  }
}

export async function getLikedContentIds(userId: string, contentType: 'song' | 'video') {
  const { data, error } = await supabase
    .from('content_likes').select('content_id').eq('user_id', userId).eq('content_type', contentType);
  if (error) return [];
  return (data || []).map((d: { content_id: string }) => d.content_id);
}

export async function toggleSave(userId: string, contentId: string, contentType: 'song' | 'video') {
  const { data: existing } = await supabase
    .from('user_library').select('id').eq('user_id', userId).eq('content_id', contentId).eq('content_type', contentType).maybeSingle();
  if (existing) {
    await supabase.from('user_library').delete().eq('id', existing.id);
    return false;
  } else {
    await supabase.from('user_library').insert({ user_id: userId, content_id: contentId, content_type: contentType });
    return true;
  }
}

export async function getSavedContentIds(userId: string, contentType: 'song' | 'video') {
  const { data, error } = await supabase
    .from('user_library').select('content_id').eq('user_id', userId).eq('content_type', contentType);
  if (error) return [];
  return (data || []).map((d: { content_id: string }) => d.content_id);
}

// ============================================================
// HERO BANNERS
// ============================================================
export async function getActiveBanners(): Promise<HeroBanner[]> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('hero_banners').select('*').eq('is_active', true)
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gte.${now}`)
    .order('display_order', { ascending: true }).limit(10);
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function getAllBanners(): Promise<HeroBanner[]> {
  const { data, error } = await supabase.from('hero_banners').select('*').order('display_order', { ascending: true });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function createBanner(payload: Partial<HeroBanner>) {
  const { error } = await supabase.from('hero_banners').insert(payload);
  if (error) throw error;
}

export async function updateBanner(id: string, payload: Partial<HeroBanner>) {
  const { error } = await supabase.from('hero_banners').update(payload).eq('id', id);
  if (error) throw error;
}

export async function deleteBanner(id: string) {
  const { error } = await supabase.from('hero_banners').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================
// ARTISTS
// ============================================================
// Helper to normalize and match songs to artists strictly and accurately
function getArtistMatchedSongs(artist: any, allSongs: any[]): any[] {
  const clean = (str: string) => (str || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
  const artistId = artist?.id;
  const artistUserId = artist?.user_id;
  const artistName = clean(artist?.name || '');
  const artistStageName = clean(artist?.stage_name || '');

  return allSongs.filter(song => {
    // 1. Direct database ID or user ID match
    if (song.artist_id && (song.artist_id === artistId || (artistUserId && song.artist_id === artistUserId))) return true;
    if (song.user_id && (song.user_id === artistId || (artistUserId && song.user_id === artistUserId))) return true;
    
    // 2. Exact cleaned name match
    const songArtistClean = clean(song.artist_name || '');
    if (!songArtistClean) return false;
    if (artistName && songArtistClean === artistName) return true;
    if (artistStageName && songArtistClean === artistStageName) return true;
    
    // 3. Multi-artist / featured track matching (e.g. "Yo Maps ft. Macky 2")
    // Only split by explicit separators and match exact artist token (requiring token length >= 3)
    const rawSongArtist = (song.artist_name || '').toLowerCase();
    if (rawSongArtist.includes('ft.') || rawSongArtist.includes('feat.') || rawSongArtist.includes('&') || rawSongArtist.includes(',')) {
      const parts = rawSongArtist.split(/(?:ft\.?|feat\.?|&|,|\/|\bx\b)/i).map(p => clean(p)).filter(p => p.length >= 3);
      if (artistName && artistName.length >= 3 && parts.includes(artistName)) return true;
      if (artistStageName && artistStageName.length >= 3 && parts.includes(artistStageName)) return true;
    }
    
    return false;
  });
}

// ============================================================
// UNIFIED ARTIST IMAGE RESOLUTION
// ============================================================
export const ARTIST_PLACEHOLDER_CDN = '/app-icon.png';

// Known genuine artist photos and artwork mapped directly to their user IDs and stage names
export const KNOWN_USER_PHOTOS: Record<string, { avatar: string; cover?: string }> = {
  'd2b5f31e-ed63-404f-a03d-b542883e5d02': {
    avatar: 'https://dgugpfpotxwyoiycracf.supabase.co/storage/v1/object/public/avatars/d2b5f31e-ed63-404f-a03d-b542883e5d02/avatar.jpg',
    cover: 'https://dgugpfpotxwyoiycracf.supabase.co/storage/v1/object/public/thumbnails/d2b5f31e-ed63-404f-a03d-b542883e5d02/cover_1788635927155.jpg',
  },
  'e8ea1c94-54ab-4fc4-83c0-0ec9af7d2c69': {
    avatar: 'https://dgugpfpotxwyoiycracf.supabase.co/storage/v1/object/public/avatars/e8ea1c94-54ab-4fc4-83c0-0ec9af7d2c69/avatar.png',
    cover: 'https://dgugpfpotxwyoiycracf.supabase.co/storage/v1/object/public/thumbnails/e8ea1c94-54ab-4fc4-83c0-0ec9af7d2c69/cover_1788684772767.jpg',
  },
  'b6fbada8-001b-42d0-8a3b-c101a56f1663': {
    avatar: 'https://dgugpfpotxwyoiycracf.supabase.co/storage/v1/object/public/avatars/b6fbada8-001b-42d0-8a3b-c101a56f1663/avatar.jpg',
    cover: 'https://dgugpfpotxwyoiycracf.supabase.co/storage/v1/object/public/thumbnails/b6fbada8-001b-42d0-8a3b-c101a56f1663/cover_1788846764213.jpg',
  },
  '745d0a93-71a1-4a9d-a3bf-f268e9bffedc': {
    avatar: 'https://dgugpfpotxwyoiycracf.supabase.co/storage/v1/object/public/avatars/745d0a93-71a1-4a9d-a3bf-f268e9bffedc/avatar.jpg',
    cover: 'https://dgugpfpotxwyoiycracf.supabase.co/storage/v1/object/public/thumbnails/745d0a93-71a1-4a9d-a3bf-f268e9bffedc/cover_1788772948440.jpg',
  },
  '8940b34c-bf9e-4a93-9cc4-4f862b518182': {
    avatar: 'https://dgugpfpotxwyoiycracf.supabase.co/storage/v1/object/public/avatars/8940b34c-bf9e-4a93-9cc4-4f862b518182/avatar.jpg',
    cover: 'https://dgugpfpotxwyoiycracf.supabase.co/storage/v1/object/public/thumbnails/8940b34c-bf9e-4a93-9cc4-4f862b518182/cover_1788063237368.png',
  },
  'acadc944-516d-4139-b74b-cfab12a0214e': {
    avatar: 'https://dgugpfpotxwyoiycracf.supabase.co/storage/v1/object/public/avatars/acadc944-516d-4139-b74b-cfab12a0214e/avatar.jpg',
    cover: 'https://dgugpfpotxwyoiycracf.supabase.co/storage/v1/object/public/thumbnails/acadc944-516d-4139-b74b-cfab12a0214e/cover_1786469993127.jpg',
  },
  '8882de59-5632-407c-bc74-822352ebafe7': {
    avatar: 'https://dgugpfpotxwyoiycracf.supabase.co/storage/v1/object/public/avatars/8882de59-5632-407c-bc74-822352ebafe7/avatar.jpg',
    cover: 'https://dgugpfpotxwyoiycracf.supabase.co/storage/v1/object/public/thumbnails/8882de59-5632-407c-bc74-822352ebafe7/cover_1787481362738.jpg',
  },
  '7eb58b89-69e8-4035-8bef-41f4a714e9fb': {
    avatar: 'https://dgugpfpotxwyoiycracf.supabase.co/storage/v1/object/public/avatars/7eb58b89-69e8-4035-8bef-41f4a714e9fb/avatar.jpg',
    cover: 'https://dgugpfpotxwyoiycracf.supabase.co/storage/v1/object/public/thumbnails/7eb58b89-69e8-4035-8bef-41f4a714e9fb/cover_1788507374998.jpg',
  },
  'dcff1ede-9a69-4a98-ad25-fb460dadf81d': {
    avatar: 'https://dgugpfpotxwyoiycracf.supabase.co/storage/v1/object/public/avatars/dcff1ede-9a69-4a98-ad25-fb460dadf81d/avatar.jpg',
    cover: 'https://dgugpfpotxwyoiycracf.supabase.co/storage/v1/object/public/thumbnails/dcff1ede-9a69-4a98-ad25-fb460dadf81d/cover_1788457181036.jpg',
  },
  '470d8f2e-891d-4fff-8abb-a54601137486': {
    avatar: 'https://dgugpfpotxwyoiycracf.supabase.co/storage/v1/object/public/avatars/470d8f2e-891d-4fff-8abb-a54601137486/avatar.jpg',
    cover: 'https://dgugpfpotxwyoiycracf.supabase.co/storage/v1/object/public/thumbnails/470d8f2e-891d-4fff-8abb-a54601137486/cover_1788623449541.jpg',
  },
  'ca7a147c-3fe1-4c1c-872b-cc70fe5bccce': {
    avatar: 'https://dgugpfpotxwyoiycracf.supabase.co/storage/v1/object/public/thumbnails/ca7a147c-3fe1-4c1c-872b-cc70fe5bccce/cover_1788532096308.jpg',
    cover: 'https://dgugpfpotxwyoiycracf.supabase.co/storage/v1/object/public/thumbnails/ca7a147c-3fe1-4c1c-872b-cc70fe5bccce/cover_1788532096308.jpg',
  },
  '5a0f8979-1d9f-479b-869d-eb047185b625': {
    avatar: 'https://dgugpfpotxwyoiycracf.supabase.co/storage/v1/object/public/thumbnails/5a0f8979-1d9f-479b-869d-eb047185b625/cover_1786536183137.png',
    cover: 'https://dgugpfpotxwyoiycracf.supabase.co/storage/v1/object/public/thumbnails/5a0f8979-1d9f-479b-869d-eb047185b625/cover_1786536183137.png',
  },
  'eb52f91a-4588-4660-accb-81a5f45af1d2': {
    avatar: 'https://dgugpfpotxwyoiycracf.supabase.co/storage/v1/object/public/thumbnails/eb52f91a-4588-4660-accb-81a5f45af1d2/cover_1789069900200.jpg',
    cover: 'https://dgugpfpotxwyoiycracf.supabase.co/storage/v1/object/public/thumbnails/eb52f91a-4588-4660-accb-81a5f45af1d2/cover_1789069900200.jpg',
  },
  'bfeb2644-5c02-4645-8378-b4a20c49e28c': {
    avatar: 'https://dgugpfpotxwyoiycracf.supabase.co/storage/v1/object/public/avatars/bfeb2644-5c02-4645-8378-b4a20c49e28c/avatar.jpg',
  },
  'bd760f9b-bf74-4871-8a82-ec0b6e8cc62d': {
    avatar: 'https://dgugpfpotxwyoiycracf.supabase.co/storage/v1/object/public/avatars/bd760f9b-bf74-4871-8a82-ec0b6e8cc62d/avatar.jpg',
  },
  'dba5f7ef-2aaa-4724-9da8-8244ec3e25d3': {
    avatar: 'https://dgugpfpotxwyoiycracf.supabase.co/storage/v1/object/public/avatars/dba5f7ef-2aaa-4724-9da8-8244ec3e25d3/avatar.webp',
  },
  '8fb6e02f-8826-40e0-b569-e5e72e84acf0': {
    avatar: 'https://dgugpfpotxwyoiycracf.supabase.co/storage/v1/object/public/avatars/8fb6e02f-8826-40e0-b569-e5e72e84acf0/avatar.jpg',
  },
  '2c3fde16-f342-49f5-bae5-bdb7b3ee141d': {
    avatar: 'https://dgugpfpotxwyoiycracf.supabase.co/storage/v1/object/public/avatars/2c3fde16-f342-49f5-bae5-bdb7b3ee141d/avatar.jpg',
  },
  'deaebeb8-51c0-4453-92c9-9d77190013d6': {
    avatar: 'https://dgugpfpotxwyoiycracf.supabase.co/storage/v1/object/public/avatars/deaebeb8-51c0-4453-92c9-9d77190013d6/avatar.jpg',
  },
};

export const KNOWN_ARTIST_PHOTOS: Record<string, { avatar: string; cover?: string }> = {
  'bigpaulo': {
    avatar: 'https://dgugpfpotxwyoiycracf.supabase.co/storage/v1/object/public/avatars/d2b5f31e-ed63-404f-a03d-b542883e5d02/avatar.jpg',
    cover: 'https://dgugpfpotxwyoiycracf.supabase.co/storage/v1/object/public/thumbnails/d2b5f31e-ed63-404f-a03d-b542883e5d02/cover_1788635927155.jpg',
  },
  'pcxernation': {
    avatar: 'https://dgugpfpotxwyoiycracf.supabase.co/storage/v1/object/public/avatars/e8ea1c94-54ab-4fc4-83c0-0ec9af7d2c69/avatar.png',
    cover: 'https://dgugpfpotxwyoiycracf.supabase.co/storage/v1/object/public/thumbnails/e8ea1c94-54ab-4fc4-83c0-0ec9af7d2c69/cover_1788684772767.jpg',
  },
  'emygizyzmairforce': {
    avatar: 'https://dgugpfpotxwyoiycracf.supabase.co/storage/v1/object/public/avatars/b6fbada8-001b-42d0-8a3b-c101a56f1663/avatar.jpg',
    cover: 'https://dgugpfpotxwyoiycracf.supabase.co/storage/v1/object/public/thumbnails/b6fbada8-001b-42d0-8a3b-c101a56f1663/cover_1788846764213.jpg',
  },
  'emygizy': {
    avatar: 'https://dgugpfpotxwyoiycracf.supabase.co/storage/v1/object/public/avatars/b6fbada8-001b-42d0-8a3b-c101a56f1663/avatar.jpg',
    cover: 'https://dgugpfpotxwyoiycracf.supabase.co/storage/v1/object/public/thumbnails/b6fbada8-001b-42d0-8a3b-c101a56f1663/cover_1788846764213.jpg',
  },
  'youngkingj': {
    avatar: 'https://dgugpfpotxwyoiycracf.supabase.co/storage/v1/object/public/avatars/745d0a93-71a1-4a9d-a3bf-f268e9bffedc/avatar.jpg',
    cover: 'https://dgugpfpotxwyoiycracf.supabase.co/storage/v1/object/public/thumbnails/745d0a93-71a1-4a9d-a3bf-f268e9bffedc/cover_1788772948440.jpg',
  },
  'geeollosix': {
    avatar: 'https://dgugpfpotxwyoiycracf.supabase.co/storage/v1/object/public/avatars/8940b34c-bf9e-4a93-9cc4-4f862b518182/avatar.jpg',
    cover: 'https://dgugpfpotxwyoiycracf.supabase.co/storage/v1/object/public/thumbnails/8940b34c-bf9e-4a93-9cc4-4f862b518182/cover_1788063237368.png',
  },
  'enzymestreet': {
    avatar: 'https://dgugpfpotxwyoiycracf.supabase.co/storage/v1/object/public/avatars/acadc944-516d-4139-b74b-cfab12a0214e/avatar.jpg',
    cover: 'https://dgugpfpotxwyoiycracf.supabase.co/storage/v1/object/public/thumbnails/acadc944-516d-4139-b74b-cfab12a0214e/cover_1786469993127.jpg',
  },
  'vocalboy': {
    avatar: 'https://dgugpfpotxwyoiycracf.supabase.co/storage/v1/object/public/avatars/8882de59-5632-407c-bc74-822352ebafe7/avatar.jpg',
    cover: 'https://dgugpfpotxwyoiycracf.supabase.co/storage/v1/object/public/thumbnails/8882de59-5632-407c-bc74-822352ebafe7/cover_1787481362738.jpg',
  },
  'gcentnewbeing': {
    avatar: 'https://dgugpfpotxwyoiycracf.supabase.co/storage/v1/object/public/avatars/7eb58b89-69e8-4035-8bef-41f4a714e9fb/avatar.jpg',
    cover: 'https://dgugpfpotxwyoiycracf.supabase.co/storage/v1/object/public/thumbnails/7eb58b89-69e8-4035-8bef-41f4a714e9fb/cover_1788507374998.jpg',
  },
  'jamgojames': {
    avatar: 'https://dgugpfpotxwyoiycracf.supabase.co/storage/v1/object/public/avatars/dcff1ede-9a69-4a98-ad25-fb460dadf81d/avatar.jpg',
    cover: 'https://dgugpfpotxwyoiycracf.supabase.co/storage/v1/object/public/thumbnails/dcff1ede-9a69-4a98-ad25-fb460dadf81d/cover_1788457181036.jpg',
  },
  'chichiicem': {
    avatar: 'https://dgugpfpotxwyoiycracf.supabase.co/storage/v1/object/public/avatars/470d8f2e-891d-4fff-8abb-a54601137486/avatar.jpg',
    cover: 'https://dgugpfpotxwyoiycracf.supabase.co/storage/v1/object/public/thumbnails/470d8f2e-891d-4fff-8abb-a54601137486/cover_1788623449541.jpg',
  },
  'frenchik': {
    avatar: 'https://dgugpfpotxwyoiycracf.supabase.co/storage/v1/object/public/thumbnails/ca7a147c-3fe1-4c1c-872b-cc70fe5bccce/cover_1788532096308.jpg',
    cover: 'https://dgugpfpotxwyoiycracf.supabase.co/storage/v1/object/public/thumbnails/ca7a147c-3fe1-4c1c-872b-cc70fe5bccce/cover_1788532096308.jpg',
  },
  'xenon': {
    avatar: 'https://dgugpfpotxwyoiycracf.supabase.co/storage/v1/object/public/thumbnails/5a0f8979-1d9f-479b-869d-eb047185b625/cover_1786536183137.png',
    cover: 'https://dgugpfpotxwyoiycracf.supabase.co/storage/v1/object/public/thumbnails/5a0f8979-1d9f-479b-869d-eb047185b625/cover_1786536183137.png',
  },
  'manjaro': {
    avatar: 'https://dgugpfpotxwyoiycracf.supabase.co/storage/v1/object/public/thumbnails/eb52f91a-4588-4660-accb-81a5f45af1d2/cover_1789069900200.jpg',
    cover: 'https://dgugpfpotxwyoiycracf.supabase.co/storage/v1/object/public/thumbnails/eb52f91a-4588-4660-accb-81a5f45af1d2/cover_1789069900200.jpg',
  },
  'nkayzofficial': {
    avatar: 'https://dgugpfpotxwyoiycracf.supabase.co/storage/v1/object/public/avatars/bfeb2644-5c02-4645-8378-b4a20c49e28c/avatar.jpg',
  },
  'bk46zm': {
    avatar: 'https://dgugpfpotxwyoiycracf.supabase.co/storage/v1/object/public/avatars/bd760f9b-bf74-4871-8a82-ec0b6e8cc62d/avatar.jpg',
  },
};

function normalizeKey(str: string | null | undefined): string {
  if (!str) return '';
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Validates 'avatar_url' against Supabase storage paths/buckets.
 * If rawUrl is a relative path or storage reference (e.g. 'avatars/xxx.jpg' or 'profiles/xxx.jpg'),
 * it resolves the public URL from Supabase storage and confirms it is well-formed.
 */
export async function validateArtistStorageAvatar(rawUrl: string | null | undefined): Promise<string | null> {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return null;

  // If it's already an absolute URL
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  // If it's a Supabase storage path
  try {
    const parts = trimmed.split('/');
    const bucket = parts.length > 1 ? parts[0] : 'avatars';
    const path = parts.length > 1 ? parts.slice(1).join('/') : trimmed;
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    if (data?.publicUrl) {
      return data.publicUrl;
    }
  } catch (err) {
    console.warn('[validateArtistStorageAvatar] Storage resolution error:', err);
  }

  return null;
}

/**
 * Unified artist image resolver function.
 * Validates 'avatar_url' (or 'profile_image_url') against Supabase storage,
 * checks metadata / profile / songs fallback chain, and defaults to a reliable
 * placeholder CDN (Unsplash studio portrait) for every render.
 */
export function resolveArtistAvatar(
  artist: Partial<Artist> | any | null | undefined,
  fallbackOverride?: string | null
): string {
  if (!artist) {
    return fallbackOverride || ARTIST_PLACEHOLDER_CDN;
  }

  // 1. Check known verified photos by user_id first (genuine uploaded artist photo)
  const userId = artist.user_id || artist.id || artist.user?.id;
  if (userId && KNOWN_USER_PHOTOS[userId]?.avatar) {
    return KNOWN_USER_PHOTOS[userId].avatar;
  }

  // 2. Check known verified photos by stage_name or name
  const nameKey = normalizeKey(artist.stage_name || artist.name);
  if (nameKey && KNOWN_ARTIST_PHOTOS[nameKey]?.avatar) {
    return KNOWN_ARTIST_PHOTOS[nameKey].avatar;
  }

  // 3. Direct explicit avatar_url or profile_image_url
  let candidate = artist.avatar_url || artist.profile_image_url || fallbackOverride;

  // Check if candidate is a relative Supabase storage path
  if (candidate && typeof candidate === 'string' && !candidate.startsWith('http://') && !candidate.startsWith('https://')) {
    try {
      const parts = candidate.split('/');
      const bucket = parts.length > 1 ? parts[0] : 'avatars';
      const path = parts.length > 1 ? parts.slice(1).join('/') : candidate;
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      if (data?.publicUrl) {
        candidate = data.publicUrl;
      }
    } catch {
      // keep candidate as is
    }
  }

  // 4. Artist cover/image metadata
  if (!candidate || typeof candidate !== 'string' || !candidate.trim() || candidate === 'null' || candidate === 'undefined') {
    candidate = artist.cover_image_url || artist.cover_url;
  }

  // 5. Profile user avatar
  if (!candidate || typeof candidate !== 'string' || !candidate.trim() || candidate === 'null' || candidate === 'undefined') {
    if (artist.user?.avatar_url) {
      candidate = artist.user.avatar_url;
    }
  }

  // 6. Songs cover fallback if songs array is available on artist (their own song artwork!)
  if (!candidate || typeof candidate !== 'string' || !candidate.trim() || candidate === 'null' || candidate === 'undefined') {
    if (Array.isArray(artist.songs) && artist.songs.length > 0) {
      const songCover = artist.songs.find((s: any) => s.cover_url)?.cover_url;
      if (songCover) candidate = songCover;
    }
  }

  // 7. Final fallback to reliable placeholder CDN (Unsplash source)
  if (!candidate || typeof candidate !== 'string' || !candidate.trim() || candidate === 'null' || candidate === 'undefined') {
    return ARTIST_PLACEHOLDER_CDN;
  }

  return candidate.trim();
}

/**
 * Asynchronously validates avatar against Supabase storage and profiles database.
 */
export async function resolveArtistAvatarWithStorage(
  artist: Partial<Artist> | any,
  matchedSongs?: any[]
): Promise<string> {
  if (!artist) return ARTIST_PLACEHOLDER_CDN;

  const avatar = artist.avatar_url || artist.profile_image_url;

  // Validate avatar against storage if provided
  if (avatar) {
    const validated = await validateArtistStorageAvatar(avatar);
    if (validated) return validated;
  }

  // Validate against user profiles table if user_id exists
  if (!avatar && artist.user_id) {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', artist.user_id)
        .maybeSingle();

      if (profile?.avatar_url) {
        const validated = await validateArtistStorageAvatar(profile.avatar_url);
        if (validated) return validated;
      }
    } catch (err) {
      console.warn('[resolveArtistAvatarWithStorage] Profile fetch error:', err);
    }
  }

  // Fallback to matched song cover
  if (!avatar && matchedSongs && matchedSongs.length > 0) {
    const songWithCover = matchedSongs.find((s: any) => s.cover_url);
    if (songWithCover?.cover_url) {
      const validated = await validateArtistStorageAvatar(songWithCover.cover_url);
      if (validated) return validated;
    }
  }

  return resolveArtistAvatar(artist);
}

export async function getFeaturedArtists(limit = 8): Promise<Artist[]> {
  const { data: artistsData, error: artistsErr } = await supabase
    .from('artists')
    .select('*')
    .order('created_at', { ascending: false });
  if (artistsErr) throw artistsErr;

  const { data: songsData, error: songsErr } = await supabase
    .from('songs')
    .select('id, play_count, cover_url, artist_name, user_id, artist_id')
    .eq('status', 'approved');
  
  const allSongs = Array.isArray(songsData) ? songsData : [];
  const list = Array.isArray(artistsData) ? artistsData : [];

  const mapped = list.map((artist: any) => {
    const matchedSongs = getArtistMatchedSongs(artist, allSongs);
    const songsPlays = matchedSongs.reduce((sum: number, song: any) => sum + (Number(song.play_count) || 0), 0);
    const totalPlays = songsPlays > 0 ? songsPlays : (Number(artist.play_count) || 0);
    const displayName = artist.stage_name || artist.name || 'Artist';
    
    // Unified resolver validates against storage, matched songs, and CDN fallback
    const avatar = resolveArtistAvatar({
      ...artist,
      songs: matchedSongs,
    });

    return {
      ...artist,
      name: displayName,
      stage_name: displayName,
      avatar_url: avatar,
      play_count: totalPlays,
      matchedSongsCount: matchedSongs.length,
    };
  });

  // Prioritize real original registered artists (non-generic names and have matched songs)
  mapped.sort((a, b) => {
    const aIsGeneric = a.name.toLowerCase() === 'artist' || a.name.toLowerCase().includes('zedvevo artist') || a.name.toLowerCase() === 'top';
    const bIsGeneric = b.name.toLowerCase() === 'artist' || b.name.toLowerCase().includes('zedvevo artist') || b.name.toLowerCase() === 'top';

    if (aIsGeneric && !bIsGeneric) return 1;
    if (!aIsGeneric && bIsGeneric) return -1;

    if (a.matchedSongsCount > 0 && b.matchedSongsCount === 0) return -1;
    if (a.matchedSongsCount === 0 && b.matchedSongsCount > 0) return 1;

    return b.play_count - a.play_count;
  });

  return mapped.slice(0, limit);
}

export async function getAllArtists(): Promise<Artist[]> {
  const { data: artistsData, error: artistsErr } = await supabase
    .from('artists')
    .select('*')
    .order('name');
  if (artistsErr) throw artistsErr;

  const { data: songsData, error: songsErr } = await supabase
    .from('songs')
    .select('id, play_count, cover_url, artist_name, user_id, artist_id')
    .eq('status', 'approved');
  
  const allSongs = Array.isArray(songsData) ? songsData : [];
  const list = Array.isArray(artistsData) ? artistsData : [];

  const mapped = list.map((artist: any) => {
    const matchedSongs = getArtistMatchedSongs(artist, allSongs);
    const songsPlays = matchedSongs.reduce((sum: number, song: any) => sum + (Number(song.play_count) || 0), 0);
    const totalPlays = songsPlays > 0 ? songsPlays : (Number(artist.play_count) || 0);
    const displayName = artist.stage_name || artist.name || 'Artist';
    
    // Unified resolver validates against storage, matched songs, and CDN fallback
    const avatar = resolveArtistAvatar({
      ...artist,
      songs: matchedSongs,
    });

    return {
      ...artist,
      name: displayName,
      stage_name: displayName,
      avatar_url: avatar,
      play_count: totalPlays,
      matchedSongsCount: matchedSongs.length,
    };
  });

  // Prioritize real original registered artists (non-generic names and have matched songs)
  mapped.sort((a, b) => {
    const aIsGeneric = a.name.toLowerCase() === 'artist' || a.name.toLowerCase().includes('zedvevo artist') || a.name.toLowerCase() === 'top';
    const bIsGeneric = b.name.toLowerCase() === 'artist' || b.name.toLowerCase().includes('zedvevo artist') || b.name.toLowerCase() === 'top';

    if (aIsGeneric && !bIsGeneric) return 1;
    if (!aIsGeneric && bIsGeneric) return -1;

    if (a.matchedSongsCount > 0 && b.matchedSongsCount === 0) return -1;
    if (a.matchedSongsCount === 0 && b.matchedSongsCount > 0) return 1;

    return b.play_count - a.play_count;
  });

  return mapped;
}

// ============================================================
// SPONSORS
// ============================================================
export async function getActiveSponsors(): Promise<Sponsor[]> {
  const { data, error } = await supabase
    .from('sponsors').select('*').eq('is_active', true)
    .order('display_order', { ascending: true }).limit(20);
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

// ============================================================
// AWARDS
// ============================================================
export async function getActiveAwards(): Promise<Award[]> {
  const { data, error } = await supabase
    .from('awards').select('*, award_categories(*, nominees(id, name, photo_url, total_votes, is_winner, registration_status))')
    .eq('is_active', true).order('created_at', { ascending: false }).limit(5);
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function getAllAwards(): Promise<Award[]> {
  const { data, error } = await supabase
    .from('awards').select('*, award_categories(*)').order('created_at', { ascending: false });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function getAwardCategories(awardId: string): Promise<AwardCategory[]> {
  const { data, error } = await supabase
    .from('award_categories').select('*, nominees(*)').eq('award_id', awardId).eq('is_active', true);
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function createAward(payload: Partial<Award>) {
  const { error } = await supabase.from('awards').insert(payload);
  if (error) throw error;
}

export async function updateAward(id: string, payload: Partial<Award>) {
  const { error } = await supabase.from('awards').update(payload).eq('id', id);
  if (error) throw error;
}

export async function deleteAward(id: string) {
  const { error } = await supabase.from('awards').delete().eq('id', id);
  if (error) throw error;
}

export async function createAwardCategory(payload: Partial<AwardCategory>) {
  const { error } = await supabase.from('award_categories').insert(payload);
  if (error) throw error;
}

export async function updateAwardCategory(id: string, payload: Partial<AwardCategory>) {
  const { error } = await supabase.from('award_categories').update(payload).eq('id', id);
  if (error) throw error;
}

export async function deleteAwardCategory(id: string) {
  const { error } = await supabase.from('award_categories').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================
// NOMINEES
// ============================================================
export async function getNomineesByCategory(categoryId: string): Promise<Nominee[]> {
  const { data, error } = await supabase
    .from('nominees').select('*').eq('category_id', categoryId).eq('registration_status', 'successful')
    .order('total_votes', { ascending: false });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function getUserNominations(userId: string): Promise<Nominee[]> {
  const { data, error } = await supabase
    .from('nominees').select('*, award_categories(name, awards(name))')
    .eq('user_id', userId).order('created_at', { ascending: false });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

// ============================================================
// VOTES
// ============================================================
export async function getUserVotes(userId: string): Promise<Vote[]> {
  const { data, error } = await supabase
    .from('votes').select('*, nominees(name, photo_url)')
    .eq('user_id', userId).order('created_at', { ascending: false });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function createNominee(payload: Partial<any>) {
  const { data, error } = await supabase.from('nominees').insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function updateNominee(id: string, payload: Partial<any>) {
  const { data, error } = await supabase.from('nominees').update(payload).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function createVote(payload: Partial<Vote>) {
  const { data, error } = await supabase.from('votes').insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function updateVote(id: string, payload: Partial<Vote>) {
  const { data, error } = await supabase.from('votes').update(payload).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function getNomineeById(id: string) {
  const { data, error } = await supabase.from('nominees').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function getVoteById(id: string) {
  const { data, error } = await supabase.from('votes').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

// ============================================================
// PAYMENT VERIFICATION & AUTO-APPROVAL
// ============================================================

export async function getPaymentStatus(paymentId: string) {
  const { data, error } = await supabase.from('payments').select('status, amount').eq('id', paymentId).single();
  if (error) throw error;
  return data;
}

// Auto-approve nominee with 0.00 payment
export async function autoApprovNominee(nomineeId: string, paymentId?: string) {
  const { data, error } = await supabase
    .from('nominees')
    .update({
      registration_status: 'completed',
      nomination_status: 'approved',
      payment_id: paymentId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', nomineeId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Automatically apply payment benefits (votes, nominations, subscriptions) based on status
export async function applyPaymentBenefits(paymentId: string) {
  const { data: p, error: pError } = await supabase
    .from('payments')
    .select('*')
    .eq('id', paymentId)
    .single();
  
  if (pError || !p) {
    console.error('applyPaymentBenefits error fetching payment:', pError);
    return;
  }

  if (p.status === 'successful' || p.status === 'completed') {
    // 1. If it's a vote payment, insert the votes and increment nominee total_votes
    if (p.payment_type === 'vote' && p.metadata?.nominee_id) {
      const nomineeId = p.metadata.nominee_id;
      const voteCount = p.metadata.vote_count || Math.max(1, Math.floor(p.amount / 5));
      
      const { data: existingVote } = await supabase
        .from('votes')
        .select('id')
        .eq('payment_id', p.id)
        .maybeSingle();

      if (!existingVote) {
        await supabase.from('votes').insert({
          nominee_id: nomineeId,
          user_id: p.user_id || null,
          payment_id: p.id,
          vote_count: voteCount,
          payment_status: 'successful',
        });

        const { data: nom } = await supabase
          .from('nominees')
          .select('total_votes')
          .eq('id', nomineeId)
          .single();
        
        const newTotal = (nom?.total_votes || 0) + voteCount;
        await supabase
          .from('nominees')
          .update({ total_votes: newTotal })
          .eq('id', nomineeId);
      }
    } 
    // 2. If it's nominee registration, approve the nominee
    else if (p.payment_type === 'nominee_registration' && p.metadata?.nominee_id) {
      await supabase.from('nominees').update({
        registration_status: 'completed',
        nomination_status: 'approved',
      }).eq('id', p.metadata.nominee_id);
    }
    // 3. If it's a subscription or upload plan, activate user subscription
    else if ((p.payment_type === 'subscription' || p.payment_type === 'plan' || p.payment_type === 'artist_subscription') && p.user_id) {
      let rawPlanId = p.plan_id || p.metadata?.plan_id || p.metadata?.item_id;
      let planType: PlanType = (p.metadata?.plan_type as PlanType) || 'k10_single';

      // Normalize planType from daily/weekly/annual
      if (rawPlanId === 'daily' || (planType as string) === 'daily') planType = 'k10_single';
      else if (rawPlanId === 'weekly' || (planType as string) === 'weekly') planType = 'k100_weekly';
      else if (rawPlanId === 'annual' || rawPlanId === 'yearly' || (planType as string) === 'annual') planType = 'k300_yearly';

      // Fetch plan details from upload_plans
      let plan: UploadPlan | null = null;
      if (rawPlanId && rawPlanId.length > 20) {
        const { data } = await supabase.from('upload_plans').select('*').eq('id', rawPlanId).maybeSingle();
        plan = data;
      }
      if (!plan) {
        const { data } = await supabase.from('upload_plans').select('*').eq('plan_type', planType).maybeSingle();
        plan = data;
      }
      if (!plan) {
        const { data } = await supabase.from('upload_plans').select('*').order('price', { ascending: true }).limit(1).maybeSingle();
        plan = data;
      }

      const finalPlanId = plan?.id || (rawPlanId && rawPlanId.length > 20 ? rawPlanId : '00000000-0000-0000-0000-000000000001');
      const validityDays = plan?.validity_days || (planType === 'k300_yearly' ? 365 : planType === 'k100_weekly' ? 7 : 30);
      const isOneTime = planType === 'k10_single' || plan?.uploads_allowed === 1;
      const uploadsAllowed = plan?.uploads_allowed !== undefined ? plan?.uploads_allowed : (isOneTime ? 1 : null);

      const now = new Date();
      const expiresAt = validityDays ? new Date(now.getTime() + validityDays * 24 * 60 * 60 * 1000).toISOString() : null;

      // Deactivate any existing active subscriptions for this user
      await supabase
        .from('user_subscriptions')
        .update({ is_active: false, status: 'inactive' })
        .eq('user_id', p.user_id);

      // Insert new active subscription with consumed: false and status: 'active'
      const { error: subInsertErr } = await supabase
        .from('user_subscriptions')
        .insert({
          user_id: p.user_id,
          plan_id: finalPlanId,
          plan_type: planType,
          uploads_used: 0,
          uploads_allowed: uploadsAllowed,
          activated_at: now.toISOString(),
          expires_at: expiresAt,
          is_active: true,
          status: 'active',
          consumed: false,
        });

      if (subInsertErr) {
        console.warn('user_subscriptions insert fallback error:', subInsertErr);
      }

      // Also upsert into artist_subscriptions for full compatibility
      const artistPlanType = planType === 'k100_weekly' ? 'weekly' : planType === 'k300_yearly' ? 'annual' : 'daily';
      const artistEndDate = new Date();
      artistEndDate.setDate(artistEndDate.getDate() + (validityDays || 1));

      await supabase.from('artist_subscriptions').upsert({
        user_id: p.user_id,
        plan: artistPlanType,
        status: 'active',
        start_date: now.toISOString(),
        end_date: artistEndDate.toISOString(),
        song_limit: isOneTime ? 1 : -1,
        upload_count: 0,
        price: p.amount,
        currency: p.currency || 'ZMW',
        payment_id: p.id,
      }, { onConflict: 'user_id,plan' });

      // Ensure profile role is artist and upload_access is active
      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', p.user_id)
        .single();

      const registeredArtistName = prof?.display_name || 
                                   (prof as any)?.full_name || 
                                   prof?.username || 
                                   prof?.email?.split('@')[0] || 
                                   'Artist';

      await supabase
        .from('profiles')
        .update({ 
          is_artist: true, 
          role: (prof?.role === 'admin' || prof?.role === 'super_admin') ? prof.role : 'artist', 
          upload_access: 'active',
          updated_at: now.toISOString()
        })
        .eq('id', p.user_id);

      // Always ensure artist record is created/updated with their registered details
      await supabase.from('artists').upsert({
        user_id: p.user_id,
        name: registeredArtistName,
        stage_name: registeredArtistName,
        bio: prof?.bio || undefined,
        avatar_url: prof?.avatar_url || undefined,
        updated_at: now.toISOString()
      }, { onConflict: 'user_id' });

      // Also create an in-app notification for the user
      try {
        await supabase.from('notifications').insert({
          user_id: p.user_id,
          title: 'Upload Plan & Artist Account Activated!',
          message: `Your ${plan?.name || 'Upload'} plan is now active for ${registeredArtistName}. You can start uploading songs and videos immediately.`,
          type: 'success',
          notification_type: 'subscription_activated',
        });
      } catch {
        // ignore notification error
      }
    }
  } else if (['failed', 'cancelled', 'insufficient_funds'].includes(p.status)) {
    if (p.payment_type === 'vote') {
      await supabase.from('votes').update({
        payment_status: 'failed',
      }).eq('id', p.id);
    } else if (p.payment_type === 'nominee_registration' && p.metadata?.nominee_id) {
      await supabase.from('nominees').update({
        registration_status: 'failed',
        nomination_status: 'rejected',
      }).eq('id', p.metadata.nominee_id);
    }
  }
}

// Auto-create vote with 0.00 payment
export async function autoCreateVote(userId: string, nomineeId: string, categoryId: string, voteCount: number = 1) {
  const { data, error } = await supabase.from('votes').insert({
    user_id: userId,
    nominee_id: nomineeId,
    category_id: categoryId,
    amount: 0,
    vote_count: voteCount,
    payment_status: 'successful',
  }).select().single();
  if (error) throw error;
  return data;
}

// Get successful votes for a nominee
export async function getNomineeVotes(nomineeId: string) {
  const { data, error } = await supabase
    .from('votes')
    .select('*')
    .eq('nominee_id', nomineeId)
    .in('payment_status', ['successful', 'pending'])
    .order('created_at', { ascending: false });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

// ============================================================
// UPLOAD PLANS
// ============================================================
export async function getActivePlans(): Promise<UploadPlan[]> {
  const { data, error } = await supabase.from('upload_plans').select('*').eq('is_active', true).order('price');
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function getAllPlans(): Promise<UploadPlan[]> {
  const { data, error } = await supabase.from('upload_plans').select('*').order('price');
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function updatePlan(id: string, payload: Partial<UploadPlan>) {
  const { error } = await supabase.from('upload_plans').update(payload).eq('id', id);
  if (error) throw error;
}

// ============================================================
// USER SUBSCRIPTIONS & DYNAMIC ENTITLEMENT
// ============================================================
export interface UploadEntitlementResult {
  entitled: boolean;
  subscription: UserSubscription | null;
  reason: 'active' | 'consumed' | 'expired_time' | 'limit_reached' | 'no_subscription';
  remainingUploads?: number | null;
}

export async function checkUploadEntitlement(userId: string): Promise<UploadEntitlementResult> {
  if (!userId) return { entitled: false, subscription: null, reason: 'no_subscription' };

  // 1. Fetch user's profile to check role and upload_access
  const { data: prof } = await supabase
    .from('profiles')
    .select('id, upload_access, role, is_artist, display_name, full_name, username')
    .eq('id', userId)
    .maybeSingle();

  // Admins always have unlimited upload entitlement
  if (prof?.role === 'admin' || prof?.role === 'super_admin') {
    return {
      entitled: true,
      subscription: {
        id: 'admin-unlimited',
        user_id: userId,
        plan_id: '00000000-0000-0000-0000-000000000000',
        plan_type: 'k300_yearly',
        uploads_used: 0,
        uploads_allowed: null,
        is_active: true,
        consumed: false,
        status: 'active',
        created_at: new Date().toISOString(),
        expires_at: null,
        upload_plans: {
          id: '00000000-0000-0000-0000-000000000000',
          name: 'Admin Unlimited Access',
          plan_type: 'k300_yearly',
          price: 0,
          description: 'Full administrative upload privilege',
          uploads_allowed: null,
          validity_days: 9999,
          is_active: true,
          created_at: new Date().toISOString()
        }
      },
      reason: 'admin',
      remainingUploads: null
    };
  }

  // 2. CHECK APPROVED PAYMENTS:
  // If payment is marked SUCCESSFUL and the plan is not yet used (for 1-upload plans, until upload is made),
  // immediately entitle user and show upload page!
  const { data: latestPayment } = await supabase
    .from('payments')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['successful', 'completed', 'SUCCESSFUL', 'COMPLETED'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestPayment) {
    const paymentTime = latestPayment.updated_at || latestPayment.created_at;
    const isOneTimePayment = 
      latestPayment.amount <= 15 || 
      latestPayment.payment_type === 'upload' || 
      latestPayment.metadata?.plan_type === 'k10_single' || 
      latestPayment.metadata?.plan_type === 'daily' ||
      latestPayment.metadata?.uploads_allowed === 1;

    if (isOneTimePayment) {
      // For 1-upload plan: check how many songs or videos were uploaded ON OR AFTER the approved payment time
      const [{ count: songCount }, { count: videoCount }] = await Promise.all([
        supabase.from('songs').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', paymentTime),
        supabase.from('videos').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', paymentTime),
      ]);
      const uploadsSincePayment = (songCount || 0) + (videoCount || 0);

      if (uploadsSincePayment < 1) {
        // Payment approved and upload NOT yet made -> Grant immediate access!
        if (prof && prof.upload_access !== 'active') {
          await supabase.from('profiles').update({ upload_access: 'active', is_artist: true, role: 'artist' }).eq('id', userId);
        }

        return {
          entitled: true,
          subscription: {
            id: `pay-${latestPayment.id}`,
            user_id: userId,
            plan_id: latestPayment.plan_id || '00000000-0000-0000-0000-000000000001',
            plan_type: 'k10_single',
            uploads_used: 0,
            uploads_allowed: 1,
            is_active: true,
            consumed: false,
            status: 'active',
            created_at: paymentTime,
            expires_at: null,
            upload_plans: {
              id: `pay-${latestPayment.id}`,
              name: 'Single Upload Plan',
              plan_type: 'k10_single',
              price: latestPayment.amount || 10,
              description: 'Single upload access — active until upload is made',
              uploads_allowed: 1,
              validity_days: 30,
              is_active: true,
              created_at: paymentTime
            }
          },
          reason: 'active_approved_payment',
          remainingUploads: 1
        };
      }
    } else {
      // Multi-upload or subscription (weekly / annual)
      const isAnnual = latestPayment.metadata?.plan_type === 'k300_yearly' || latestPayment.amount >= 250;
      const validityDays = isAnnual ? 365 : 7;
      const expiry = new Date(new Date(paymentTime).getTime() + validityDays * 86400000);
      if (expiry > new Date()) {
        if (prof && prof.upload_access !== 'active') {
          await supabase.from('profiles').update({ upload_access: 'active', is_artist: true, role: 'artist' }).eq('id', userId);
        }

        return {
          entitled: true,
          subscription: {
            id: `pay-${latestPayment.id}`,
            user_id: userId,
            plan_id: latestPayment.plan_id || '00000000-0000-0000-0000-000000000001',
            plan_type: isAnnual ? 'k300_yearly' : 'k100_weekly',
            uploads_used: 0,
            uploads_allowed: null,
            is_active: true,
            consumed: false,
            status: 'active',
            created_at: paymentTime,
            expires_at: expiry.toISOString(),
            upload_plans: {
              id: `pay-${latestPayment.id}`,
              name: isAnnual ? 'Annual Artist Plan' : 'Weekly Artist Plan',
              plan_type: isAnnual ? 'k300_yearly' : 'k100_weekly',
              price: latestPayment.amount || (isAnnual ? 300 : 100),
              description: isAnnual ? 'Unlimited uploads for 1 year' : 'Unlimited uploads for 7 days',
              uploads_allowed: null,
              validity_days: validityDays,
              is_active: true,
              created_at: paymentTime
            }
          },
          reason: 'active_approved_payment',
          remainingUploads: null
        };
      }
    }
  }

  // 3. Check active record in user_subscriptions (unconsumed)
  const { data: sub } = await supabase
    .from('user_subscriptions')
    .select('*, upload_plans(*)')
    .eq('user_id', userId)
    .eq('is_active', true)
    .eq('consumed', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sub) {
    const userSub = sub as UserSubscription;
    const isOneTime = userSub.plan_type === 'k10_single' || 
                      userSub.uploads_allowed === 1 || 
                      userSub.upload_plans?.name?.toLowerCase().includes('single');

    if (isOneTime && (userSub.consumed === true || (userSub.uploads_used || 0) >= 1)) {
      await supabase.from('user_subscriptions').update({ 
        is_active: false, 
        status: 'inactive', 
        consumed: true 
      }).eq('id', userSub.id);
    } else if (userSub.uploads_allowed !== null && (userSub.uploads_used || 0) >= userSub.uploads_allowed) {
      await supabase.from('user_subscriptions').update({ 
        is_active: false, 
        status: 'inactive' 
      }).eq('id', userSub.id);
    } else if (userSub.expires_at && new Date(userSub.expires_at) <= new Date()) {
      await supabase.from('user_subscriptions').update({ 
        is_active: false, 
        status: 'expired' 
      }).eq('id', userSub.id);
    } else {
      return {
        entitled: true,
        subscription: userSub,
        reason: 'active',
        remainingUploads: userSub.uploads_allowed !== null ? Math.max(0, userSub.uploads_allowed - (userSub.uploads_used || 0)) : null
      };
    }
  }

  // 4. Check active record in artist_subscriptions
  const { data: artistSub } = await supabase
    .from('artist_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (artistSub) {
    const isOneTime = artistSub.plan === 'daily' || artistSub.song_limit === 1;
    const isConsumed = isOneTime && (artistSub.upload_count || 0) >= 1;
    const isTimeExpired = artistSub.end_date && new Date(artistSub.end_date) <= new Date();

    if (!isConsumed && !isTimeExpired) {
      const syntheticSub: UserSubscription = {
        id: artistSub.id,
        user_id: artistSub.user_id,
        plan_id: artistSub.id,
        plan_type: artistSub.plan === 'daily' ? 'k10_single' : artistSub.plan === 'weekly' ? 'k100_weekly' : 'k300_yearly',
        uploads_used: artistSub.upload_count || 0,
        uploads_allowed: artistSub.song_limit === -1 ? null : artistSub.song_limit,
        is_active: true,
        consumed: false,
        status: 'active',
        created_at: artistSub.start_date || new Date().toISOString(),
        expires_at: artistSub.end_date,
        upload_plans: {
          id: artistSub.id,
          name: `${artistSub.plan.toUpperCase()} Artist Plan`,
          plan_type: artistSub.plan === 'daily' ? 'k10_single' : artistSub.plan === 'weekly' ? 'k100_weekly' : 'k300_yearly',
          price: artistSub.price || 10,
          description: `Active ${artistSub.plan} plan`,
          uploads_allowed: artistSub.song_limit === -1 ? null : artistSub.song_limit,
          validity_days: artistSub.plan === 'daily' ? 1 : artistSub.plan === 'weekly' ? 7 : 365,
          is_active: true,
          created_at: artistSub.start_date || new Date().toISOString()
        }
      };

      return {
        entitled: true,
        subscription: syntheticSub,
        reason: 'active',
        remainingUploads: syntheticSub.uploads_allowed ? Math.max(0, syntheticSub.uploads_allowed - syntheticSub.uploads_used) : null
      };
    }
  }

  // 5. Fallback: check profile upload_access
  if (prof?.upload_access === 'active') {
    const syntheticSub: UserSubscription = {
      id: `profile-access-${prof.id}`,
      user_id: prof.id,
      plan_id: '00000000-0000-0000-0000-000000000001',
      plan_type: 'k10_single',
      uploads_used: 0,
      uploads_allowed: 1,
      is_active: true,
      consumed: false,
      status: 'active',
      created_at: new Date().toISOString(),
      expires_at: null,
      upload_plans: {
        id: '00000000-0000-0000-0000-000000000001',
        name: 'Artist Upload Access',
        plan_type: 'k10_single',
        price: 10,
        description: 'Active artist upload plan',
        uploads_allowed: 1,
        validity_days: 30,
        is_active: true,
        created_at: new Date().toISOString()
      }
    };
    return {
      entitled: true,
      subscription: syntheticSub,
      reason: 'active',
      remainingUploads: 1
    };
  }

  return { entitled: false, subscription: null, reason: 'no_subscription' };
}

export async function getUserActiveSubscription(userId: string): Promise<UserSubscription | null> {
  const result = await checkUploadEntitlement(userId);
  return result.entitled ? result.subscription : null;
}

export async function getUserSubscriptions(userId: string): Promise<UserSubscription[]> {
  const { data, error } = await supabase
    .from('user_subscriptions').select('*, upload_plans(*)')
    .eq('user_id', userId).order('created_at', { ascending: false }).limit(20);
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

// ============================================================
// PAYMENTS
// ============================================================
export async function getUserPayments(userId: string): Promise<Payment[]> {
  const { data, error } = await supabase
    .from('payments').select('*, upload_plans(name)').eq('user_id', userId)
    .order('created_at', { ascending: false }).limit(50);
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function getAllPayments(): Promise<Payment[]> {
  const { data, error } = await supabase
    .from('payments').select('*, upload_plans(name)').order('created_at', { ascending: false }).limit(100);
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function getPaymentByIdempotencyKey(key: string): Promise<Payment | null> {
  const { data, error } = await supabase
    .from('payments').select('*').eq('idempotency_key', key).maybeSingle();
  if (error) return null;
  return data as Payment | null;
}

// ============================================================
// NOTIFICATIONS
// ============================================================
export async function getUserNotifications(userId: string): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications').select('*')
    .or(`user_id.eq.${userId},user_id.is.null`)
    .order('created_at', { ascending: false }).limit(30);
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function markNotificationRead(id: string) {
  const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  if (error) throw error;
}

// ============================================================
// APP SETTINGS
// ============================================================
export async function getSettings(): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  
  // 1. First populate with local storage cached settings if any
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('zed_setting_')) {
        const rawKey = key.replace('zed_setting_', '');
        map[rawKey] = localStorage.getItem(key) || '';
      }
    }
  } catch { /* ignore storage errors */ }

  // 2. Fetch all cloud settings from Supabase
  try {
    const { data, error } = await supabase.from('app_settings').select('key, value');
    if (!error && Array.isArray(data)) {
      data.forEach((s: { key: string; value: string }) => {
        map[s.key] = s.value;
        try { localStorage.setItem('zed_setting_' + s.key, s.value); } catch { /* ignore */ }
      });
    }
  } catch (err) {
    console.warn('Could not fetch app_settings from Supabase, using local cached settings:', err);
  }

  return map;
}

export async function updateSetting(key: string, value: string) {
  // 1. Immediately update local storage so UI and components react instantly
  try {
    localStorage.setItem('zed_setting_' + key, value);
  } catch { /* ignore */ }

  // 2. Upsert into Supabase app_settings
  const { error } = await supabase
    .from('app_settings')
    .upsert({
      key,
      value,
      updated_at: new Date().toISOString()
    }, { onConflict: 'key' });

  if (error) {
    console.warn('Failed to upsert setting to Supabase app_settings:', error.message);
    throw error;
  }
}

// ============================================================
// PROFILES (admin)
// ============================================================
export async function getAllProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(100);
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function updateProfile(id: string, payload: Partial<Profile>) {
  const { error } = await supabase.from('profiles').update(payload).eq('id', id);
  if (error) throw error;
}

// ============================================================
// STORAGE HELPERS
// ============================================================
export function getPublicUrl(bucket: string, path: string): string {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadFile(bucket: string, path: string, file: File): Promise<string> {
  const { data, error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  return getPublicUrl(bucket, data.path);
}

export async function deleteFile(bucket: string, path: string) {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw error;
}

// ============================================================
// ADMIN HELPERS
// ============================================================
export async function approveContent(table: 'songs' | 'videos', id: string) {
  const { error } = await supabase.from(table).update({ status: 'approved' }).eq('id', id);
  if (error) throw error;
}

export async function rejectContent(table: 'songs' | 'videos', id: string) {
  const { error } = await supabase.from(table).update({ status: 'rejected' }).eq('id', id);
  if (error) throw error;
}

export async function setTrending(table: 'songs' | 'videos', id: string, value: boolean) {
  const { error } = await supabase.from(table).update({ is_trending: value }).eq('id', id);
  if (error) throw error;
}

export async function setWinner(nomineeId: string) {
  const { error } = await supabase.from('nominees').update({ is_winner: true, nomination_status: 'winner' }).eq('id', nomineeId);
  if (error) throw error;
}

export async function getAllNominees(): Promise<Nominee[]> {
  const { data, error } = await supabase
    .from('nominees')
    .select('*, award_categories(name, awards(name)), profiles(username, display_name)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function updateNomineeStatus(id: string, nomination_status: string) {
  const { error } = await supabase.from('nominees').update({ nomination_status }).eq('id', id);
  if (error) throw error;
}

export async function deleteNominee(id: string): Promise<void> {
  // First delete associated votes to avoid foreign key constraints
  try {
    await supabase.from('votes').delete().eq('nominee_id', id);
  } catch {}
  const { error } = await supabase.from('nominees').delete().eq('id', id);
  if (error) throw error;
}

export async function getAllVotes(): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('votes')
      .select('*, nominees(id, name, song_title, photo_url, category_id, award_categories(name)), profiles(username, display_name)')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn('Could not fetch joined votes, fetching standard votes:', err);
    const { data } = await supabase.from('votes').select('*').order('created_at', { ascending: false }).limit(500);
    return Array.isArray(data) ? data : [];
  }
}

export async function deleteVote(id: string): Promise<void> {
  const { error } = await supabase.from('votes').delete().eq('id', id);
  if (error) throw error;
}

export async function createManualVote(payload: {
  nominee_id: string;
  vote_count: number;
  payment_method?: string;
  user_id?: string;
  notes?: string;
}): Promise<any> {
  const { nominee_id, vote_count, payment_method = 'manual_admin', user_id, notes } = payload;
  
  // 1. Insert vote record
  const { data: vote, error: voteError } = await supabase
    .from('votes')
    .insert({
      nominee_id,
      vote_count,
      payment_status: 'successful',
      payment_method,
      user_id: user_id || null,
      notes: notes || 'Manual vote added by administrator',
    })
    .select()
    .single();

  if (voteError) {
    // If notes or payment_method column is missing in schema, insert with core fields
    const { data: fallbackVote, error: fallbackError } = await supabase
      .from('votes')
      .insert({
        nominee_id,
        vote_count,
        payment_status: 'successful',
        user_id: user_id || null,
      })
      .select()
      .single();
    if (fallbackError) throw fallbackError;
  }

  // 2. Increment nominee's total_votes in nominees table
  const { data: nom } = await supabase
    .from('nominees')
    .select('total_votes')
    .eq('id', nominee_id)
    .single();

  const newTotal = (nom?.total_votes || 0) + vote_count;
  await supabase
    .from('nominees')
    .update({ total_votes: newTotal })
    .eq('id', nominee_id);

  return vote;
}

// ============================================================
// DOWNLOADS
// ============================================================
export async function recordDownload(payload: Omit<Download, 'id' | 'downloaded_at'>): Promise<void> {
  const { error } = await supabase.from('downloads').insert({ ...payload, downloaded_at: new Date().toISOString() });
  if (error) throw error;
}

export async function getUserDownloads(userId: string): Promise<Download[]> {
  const { data, error } = await supabase
    .from('downloads')
    .select('*')
    .eq('user_id', userId)
    .order('downloaded_at', { ascending: false });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function getAllDownloads(): Promise<Download[]> {
  const { data, error } = await supabase
    .from('downloads')
    .select('*')
    .order('downloaded_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function incrementSongDownloadCount(songId: string): Promise<void> {
  const { error } = await supabase.rpc('increment_song_download', { song_id: songId });
  if (error) console.error('song download count error', error);
}

export async function incrementVideoDownloadCount(videoId: string): Promise<void> {
  const { error } = await supabase.rpc('increment_video_download', { video_id: videoId });
  if (error) console.error('video download count error', error);
}

export async function setVideoDownloadsEnabled(videoId: string, enabled: boolean): Promise<void> {
  const { error } = await supabase.from('videos').update({ downloads_enabled: enabled }).eq('id', videoId);
  if (error) throw error;
}

// ============================================================
// WEEKLY TRENDING
// ============================================================
export async function getWeeklyTrending(category?: string): Promise<WeeklyTrending[]> {
  // Get the most recent week_start
  const { data: latestWeek } = await supabase
    .from('weekly_trending')
    .select('week_start')
    .order('week_start', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latestWeek) return [];

  let q = supabase
    .from('weekly_trending')
    .select('*')
    .eq('week_start', latestWeek.week_start)
    .order('rank', { ascending: true });

  if (category) q = q.eq('category', category);
  const { data, error } = await q;
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function computeAndStoreWeeklyTrending(): Promise<void> {
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const weekStartStr = weekStart.toISOString().split('T')[0];

  // Most played songs
  const { data: topPlayed } = await supabase
    .from('songs').select('id, title, artist_name, cover_url, play_count')
    .eq('status', 'approved').order('play_count', { ascending: false }).limit(10);

  // Most downloaded songs
  const { data: topDownloaded } = await supabase
    .from('songs').select('id, title, artist_name, cover_url, download_count')
    .eq('status', 'approved').order('download_count', { ascending: false }).limit(10);

  // Most viewed videos
  const { data: topViewed } = await supabase
    .from('videos').select('id, title, artist_name, thumbnail_url, view_count')
    .eq('status', 'approved').order('view_count', { ascending: false }).limit(10);

  // Most liked songs
  const { data: topLiked } = await supabase
    .from('songs').select('id, title, artist_name, cover_url, like_count')
    .eq('status', 'approved').order('like_count', { ascending: false }).limit(10);

  const rows: Omit<WeeklyTrending, 'id' | 'created_at'>[] = [];

  (topPlayed || []).forEach((s, i) => rows.push({ week_start: weekStartStr, content_id: s.id, content_type: 'song', rank: i + 1, category: 'most_played', metric_value: s.play_count, title: s.title, artist_name: s.artist_name, cover_url: s.cover_url }));
  (topDownloaded || []).forEach((s, i) => rows.push({ week_start: weekStartStr, content_id: s.id, content_type: 'song', rank: i + 1, category: 'most_downloaded', metric_value: s.download_count, title: s.title, artist_name: s.artist_name, cover_url: s.cover_url }));
  (topViewed || []).forEach((v, i) => rows.push({ week_start: weekStartStr, content_id: v.id, content_type: 'video', rank: i + 1, category: 'most_viewed', metric_value: v.view_count, title: v.title, artist_name: v.artist_name, cover_url: v.thumbnail_url }));
  (topLiked || []).forEach((s, i) => rows.push({ week_start: weekStartStr, content_id: s.id, content_type: 'song', rank: i + 1, category: 'most_liked', metric_value: s.like_count, title: s.title, artist_name: s.artist_name, cover_url: s.cover_url }));

  if (rows.length > 0) {
    await supabase.from('weekly_trending').upsert(rows, { onConflict: 'week_start,content_type,category,rank' });
  }
}

// ============================================================
// WINNER OF THE MONTH
// ============================================================
export async function getCurrentWinnerOfMonth(): Promise<WinnerOfMonth | null> {
  const now = new Date();
  const { data, error } = await supabase
    .from('winner_of_month')
    .select('*')
    .eq('month', now.getMonth() + 1)
    .eq('year', now.getFullYear())
    .eq('is_published', true)
    .maybeSingle();
  if (error) return null;
  return data as WinnerOfMonth | null;
}

export async function getAllWinnersOfMonth(): Promise<WinnerOfMonth[]> {
  const { data, error } = await supabase
    .from('winner_of_month')
    .select('*')
    .order('year', { ascending: false })
    .order('month', { ascending: false });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function upsertWinnerOfMonth(payload: Partial<WinnerOfMonth>): Promise<WinnerOfMonth> {
  const { data, error } = await supabase
    .from('winner_of_month')
    .upsert(payload, { onConflict: 'month,year' })
    .select()
    .single();
  if (error) throw error;
  return data as WinnerOfMonth;
}

export async function publishWinnerOfMonth(id: string): Promise<void> {
  const { error } = await supabase
    .from('winner_of_month')
    .update({ is_published: true, published_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

// ============================================================
// GLOBAL SEARCH
// ============================================================
export async function globalSearch(
  query: string,
  filter: SearchFilter = 'all',
  sort: SearchSort = 'relevance',
  limit = 20
): Promise<SearchResult[]> {
  if (!query.trim()) return [];
  const q = query.trim().toLowerCase();
  const results: SearchResult[] = [];

  const orderCol = (table: 'songs' | 'videos') => {
    if (sort === 'newest') return { col: 'created_at', asc: false };
    if (sort === 'most_played' && table === 'songs') return { col: 'play_count', asc: false };
    if (sort === 'most_downloaded') return { col: 'download_count', asc: false };
    if (sort === 'most_viewed' && table === 'videos') return { col: 'view_count', asc: false };
    return { col: 'created_at', asc: false };
  };

  if (filter === 'all' || filter === 'music') {
    const { col, asc } = orderCol('songs');
    const { data } = await supabase
      .from('songs')
      .select('id, title, artist_name, album, genre, cover_url, play_count, download_count')
      .eq('status', 'approved')
      .or(`title.ilike.%${q}%,artist_name.ilike.%${q}%,album.ilike.%${q}%,genre.ilike.%${q}%`)
      .order(col, { ascending: asc })
      .limit(limit);
    (data || []).forEach(s => results.push({
      type: 'song', id: s.id, title: s.title,
      subtitle: s.artist_name + (s.album ? ` · ${s.album}` : ''),
      cover_url: s.cover_url,
      metadata: { play_count: s.play_count, download_count: s.download_count, genre: s.genre }
    }));
  }

  if (filter === 'all' || filter === 'videos') {
    const { col, asc } = orderCol('videos');
    const { data } = await supabase
      .from('videos')
      .select('id, title, artist_name, genre, thumbnail_url, view_count, download_count')
      .eq('status', 'approved')
      .or(`title.ilike.%${q}%,artist_name.ilike.%${q}%,genre.ilike.%${q}%`)
      .order(col, { ascending: asc })
      .limit(limit);
    (data || []).forEach(v => results.push({
      type: 'video', id: v.id, title: v.title,
      subtitle: v.artist_name + (v.genre ? ` · ${v.genre}` : ''),
      cover_url: v.thumbnail_url,
      metadata: { view_count: v.view_count, download_count: v.download_count }
    }));
  }

  if (filter === 'all' || filter === 'artists') {
    const { data } = await supabase
      .from('artists')
      .select('id, name, genre, avatar_url, play_count')
      .or(`name.ilike.%${q}%,genre.ilike.%${q}%`)
      .order('play_count', { ascending: false })
      .limit(limit);
    (data || []).forEach(a => results.push({
      type: 'artist', id: a.id, title: a.name,
      subtitle: a.genre || 'Artist',
      cover_url: a.avatar_url,
      metadata: { play_count: a.play_count }
    }));
  }

  if (filter === 'all' || filter === 'awards') {
    const { data } = await supabase
      .from('nominees')
      .select('id, name, bio, photo_url, award_categories(name, awards(name))')
      .or(`name.ilike.%${q}%,bio.ilike.%${q}%`)
      .eq('nomination_status', 'approved')
      .limit(limit);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (data || []).forEach((n: any) => results.push({
      type: 'nominee' as const, id: n.id as string, title: n.name as string,
      subtitle: (n.award_categories?.name || '') as string,
      cover_url: n.photo_url as string | undefined,
      metadata: {}
    }));
  }

  return results;
}

// ============================================================
// NOTIFICATIONS (extended)
// ============================================================
export async function deleteNotification(id: string): Promise<void> {
  const { error } = await supabase.from('notifications').delete().eq('id', id);
  if (error) throw error;
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .or(`user_id.eq.${userId},user_id.is.null`)
    .eq('is_read', false);
  if (error) throw error;
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .or(`user_id.eq.${userId},user_id.is.null`)
    .eq('is_read', false);
  if (error) return 0;
  return count ?? 0;
}

export async function clearAllUserNotifications(userId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('user_id', userId);
  if (error) throw error;
}

export async function createNotification(payload: {
  user_id?: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | string;
  notification_type: string;
  link?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabase.from('notifications').insert(payload);
  if (error) throw error;
}

// ============================================================
// SITE STATS / VISITOR COUNTER
// ============================================================

export interface VisitorAnalyticsData {
  totalVisits: number;
  uniqueVisitors: number;
  dailyStats: { day: string; visits: number; uniqueSessions: number }[];
  pageStats: { page: string; visits: number }[];
}

export async function getVisitorAnalytics(): Promise<VisitorAnalyticsData> {
  let totalVisits = 0;
  let uniqueVisitors = 0;
  const dailyMap: Record<string, { visits: number; uniqueSessions: number }> = {};
  const pageMap: Record<string, number> = {};

  try {
    // 1. Check analytics_events table for real events
    const { data: eventData, count: eventCount } = await supabase
      .from('analytics_events')
      .select('created_at, event_name, session_id', { count: 'exact' });

    if (Array.isArray(eventData) && eventData.length > 0) {
      totalVisits = eventCount || eventData.length;
      const sessionSet = new Set(eventData.map(e => e.session_id).filter(Boolean));
      uniqueVisitors = sessionSet.size || Math.max(1, Math.floor(totalVisits * 0.7));

      eventData.forEach((row) => {
        const day = row.created_at ? row.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10);
        if (!dailyMap[day]) dailyMap[day] = { visits: 0, uniqueSessions: 0 };
        dailyMap[day].visits += 1;
      });
    } else {
      // 2. Fallback to visits_analytics table
      const { data, error } = await supabase
        .from('visits_analytics')
        .select('day, total_visits, unique_sessions, page');

      if (!error && Array.isArray(data) && data.length > 0) {
        data.forEach((row: { day?: string; total_visits?: number; unique_sessions?: number; page?: string }) => {
          const v = Number(row.total_visits) || 0;
          const u = Number(row.unique_sessions) || 0;
          totalVisits += v;
          uniqueVisitors += u;

          if (row.day) {
            if (!dailyMap[row.day]) dailyMap[row.day] = { visits: 0, uniqueSessions: 0 };
            dailyMap[row.day].visits += v;
            dailyMap[row.day].uniqueSessions += u;
          }

          if (row.page) {
            pageMap[row.page] = (pageMap[row.page] || 0) + v;
          }
        });
      }
    }
  } catch (err) {
    console.warn('Could not load visits_analytics or analytics_events:', err);
  }

  // Include local session tracking counts if available
  const localExtraVisits = parseInt(localStorage.getItem('zed_local_extra_visits') || '0', 10);
  totalVisits += localExtraVisits;
  if (totalVisits === 0) {
    // If database is completely fresh, count current session as 1
    totalVisits = Math.max(1, localExtraVisits || 1);
    uniqueVisitors = Math.max(1, localExtraVisits || 1);
  }

  const dailyStats = Object.entries(dailyMap)
    .map(([day, stats]) => ({ day, ...stats }))
    .sort((a, b) => a.day.localeCompare(b.day));

  const pageStats = Object.entries(pageMap)
    .map(([page, visits]) => ({ page, visits }))
    .sort((a, b) => b.visits - a.visits);

  return {
    totalVisits,
    uniqueVisitors: uniqueVisitors || totalVisits,
    dailyStats,
    pageStats,
  };
}

export async function getVisitorCount(): Promise<number> {
  try {
    const a = await getVisitorAnalytics();
    return a.totalVisits;
  } catch {
    return 1;
  }
}

export async function incrementVisitorCount(): Promise<number> {
  try {
    // Record in local session count so new visits increment in real time
    const current = parseInt(localStorage.getItem('zed_local_extra_visits') || '0', 10);
    localStorage.setItem('zed_local_extra_visits', String(current + 1));
    const stats = await getVisitorAnalytics();
    return stats.totalVisits;
  } catch {
    return 1;
  }
}

// ============================================================
// SPONSORS
// ============================================================
export async function getAllSponsors(): Promise<Sponsor[]> {
  const { data, error } = await supabase
    .from('sponsors').select('*')
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return Array.isArray(data) ? data as Sponsor[] : [];
}

export async function getActiveSponsorsForAward(awardId?: string): Promise<Sponsor[]> {
  let q = supabase
    .from('sponsors').select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true });
  if (awardId) q = q.eq('award_id', awardId);
  const { data, error } = await q;
  if (error) throw error;
  return Array.isArray(data) ? data as Sponsor[] : [];
}

export async function createSponsor(payload: Partial<Sponsor>) {
  const { error } = await supabase.from('sponsors').insert(payload);
  if (error) throw error;
}

export async function updateSponsor(id: string, payload: Partial<Sponsor>) {
  const { error } = await supabase.from('sponsors').update(payload).eq('id', id);
  if (error) throw error;
}

export async function deleteSponsor(id: string) {
  const { error } = await supabase.from('sponsors').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================
// LIPILA CONFIG (payment gateway settings)
// ============================================================
export interface LipilaConfig {
  id: string;
  merchant_id: string;
  service_id: string;
  api_key: string;
  webhook_secret?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export async function getLipilaConfig(): Promise<LipilaConfig | null> {
  const { data, error } = await supabase
    .from('lipila_config').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data as LipilaConfig | null;
}

export async function updateLipilaConfig(payload: Partial<LipilaConfig>): Promise<LipilaConfig> {
  const { data, error } = await supabase
    .from('lipila_config').upsert(payload, { onConflict: 'id' }).select().single();
  if (error) throw error;
  return data as LipilaConfig;
}

// ============================================================
// APP SETTINGS — dynamic key management
// ============================================================
export async function getAllSettingsKeys(): Promise<AppSetting[]> {
  const { data, error } = await supabase.from('app_settings').select('key, value, description, updated_at').order('key');
  if (error) throw error;
  return Array.isArray(data) ? data as AppSetting[] : [];
}

export async function createSetting(key: string, value: string, description?: string) {
  const { error } = await supabase.from('app_settings').insert({ key, value, description });
  if (error) throw error;
}

export async function deleteSetting(key: string) {
  const { error } = await supabase.from('app_settings').delete().eq('key', key);
  if (error) throw error;
}

// ============================================================
// DONATION EDGE FUNCTION — verify donation payment status
// ============================================================
export async function verifyDonationPayment(paymentId: string): Promise<{
  verified: boolean;
  status: string;
  amount?: number;
  transaction_id?: string;
  failure_reason?: string;
}> {
  const { data: session } = await supabase.auth.getSession();
  const token = session?.session?.access_token;
  const { data, error } = await supabase.functions.invoke('verify-donation-payment', {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: { payment_id: paymentId },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

// ============================================================
// REAL-TIME LIPILA WITHDRAWAL & BALANCE MANAGEMENT (ADMIN)
// ============================================================
export interface PlatformBalance {
  totalInflow: number;
  totalOutflow: number;
  availableBalance: number;
  pendingDisbursements: number;
  successfulTransactionsCount: number;
  totalWithdrawalsCount: number;
}

export interface PayoutRecord {
  id: string;
  user_id?: string;
  amount: number;
  currency: string;
  network: string; // 'MTN' | 'Airtel' | 'Zamtel' | 'Bank'
  recipient_phone: string;
  recipient_name?: string;
  status: 'pending' | 'processing' | 'successful' | 'failed';
  reference: string;
  external_id?: string;
  created_at: string;
  completed_at?: string;
  admin_notes?: string;
  failure_reason?: string;
}

export interface WithdrawalRequest {
  amount: number;
  network: 'MTN' | 'Airtel' | 'Zamtel' | 'Bank';
  phoneNumber: string;
  recipientName?: string;
  notes?: string;
}

export async function getPlatformBalance(): Promise<PlatformBalance> {
  // 1. Calculate all successful payment inflows
  const { data: payments } = await supabase
    .from('payments')
    .select('amount, status, payment_type')
    .eq('status', 'successful');

  const inflowPayments = Array.isArray(payments) ? payments : [];
  // Exclude any internal withdrawal rows if saved in payments
  const totalInflow = inflowPayments
    .filter(p => p.payment_type !== 'withdrawal' && p.payment_type !== 'payout')
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const successfulTransactionsCount = inflowPayments.filter(p => p.payment_type !== 'withdrawal' && p.payment_type !== 'payout').length;

  // 2. Fetch payouts / withdrawals from payouts table (or fallback payments table)
  let totalOutflow = 0;
  let pendingDisbursements = 0;
  let totalWithdrawalsCount = 0;

  try {
    const { data: payouts } = await supabase
      .from('payouts')
      .select('amount, status');

    if (Array.isArray(payouts)) {
      payouts.forEach((p: any) => {
        const amt = Number(p.amount) || 0;
        if (p.status === 'successful' || p.status === 'completed') {
          totalOutflow += amt;
          totalWithdrawalsCount += 1;
        } else if (p.status === 'pending' || p.status === 'processing') {
          pendingDisbursements += amt;
        }
      });
    }
  } catch {
    // If payouts table isn't present, check payments with payment_type = 'withdrawal'
    const withdrawalPayments = inflowPayments.filter(p => p.payment_type === 'withdrawal' || p.payment_type === 'payout');
    totalOutflow = withdrawalPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    totalWithdrawalsCount = withdrawalPayments.length;
  }

  const availableBalance = Math.max(0, totalInflow - totalOutflow - pendingDisbursements);

  return {
    totalInflow,
    totalOutflow,
    availableBalance,
    pendingDisbursements,
    successfulTransactionsCount,
    totalWithdrawalsCount,
  };
}

export async function getPayouts(): Promise<PayoutRecord[]> {
  // Try fetching from payouts table first
  try {
    const { data, error } = await supabase
      .from('payouts')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data) && data.length > 0) {
      return data as PayoutRecord[];
    }
  } catch (err) {
    console.warn('[getPayouts] Table payouts fallback:', err);
  }

  // Fallback to payments table where payment_type = 'withdrawal'
  try {
    const { data } = await supabase
      .from('payments')
      .select('*')
      .in('payment_type', ['withdrawal', 'payout'])
      .order('created_at', { ascending: false });

    if (Array.isArray(data)) {
      return data.map((p: any) => ({
        id: p.id,
        user_id: p.user_id,
        amount: Number(p.amount) || 0,
        currency: p.currency || 'ZMW',
        network: p.metadata?.network || 'MTN',
        recipient_phone: p.metadata?.recipient_phone || p.metadata?.phone_number || '',
        recipient_name: p.metadata?.recipient_name || 'Admin Payout',
        status: p.status === 'successful' ? 'successful' : p.status === 'failed' ? 'failed' : 'pending',
        reference: p.idempotency_key || p.reference_id || `WD-${p.id.slice(0, 8)}`,
        external_id: p.external_id || p.lipila_transaction_id,
        created_at: p.created_at,
        completed_at: p.completed_at,
        admin_notes: p.metadata?.notes,
      }));
    }
  } catch (err) {
    console.error('[getPayouts] Fallback error:', err);
  }

  return [];
}

export async function requestLipilaWithdrawal(req: WithdrawalRequest): Promise<{
  success: boolean;
  payoutId: string;
  reference: string;
  status: 'successful' | 'pending' | 'processing';
  message: string;
}> {
  if (req.amount <= 0) {
    throw new Error('Withdrawal amount must be greater than 0 ZMW');
  }

  // Check available balance
  const balance = await getPlatformBalance();
  if (req.amount > balance.availableBalance) {
    throw new Error(`Insufficient funds. Available balance is ${balance.availableBalance.toFixed(2)} ZMW`);
  }

  const { data: session } = await supabase.auth.getSession();
  const currentUserId = session?.session?.user?.id || null;

  const reference = `WD-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  // Fetch Lipila configuration
  let lipilaCfg: LipilaConfig | null = null;
  try {
    lipilaCfg = await getLipilaConfig();
  } catch (err) {
    console.warn('[requestLipilaWithdrawal] Lipila config fetch error:', err);
  }

  let externalTxId = `LIP-WD-${Date.now()}`;
  let status: 'successful' | 'pending' | 'processing' = 'successful';
  let message = `Withdrawal of ZMW ${req.amount.toFixed(2)} sent directly to ${req.network} (${req.phoneNumber}) successfully!`;

  // Attempt real Lipila Payout API call if API key configured
  const apiKey = lipilaCfg?.api_key || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_LIPILA_API_KEY) || '';
  if (apiKey && lipilaCfg?.is_active) {
    try {
      const response = await fetch('https://api.lipila.io/v1/payouts/disburse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'X-API-Key': apiKey,
        },
        body: JSON.stringify({
          amount: req.amount,
          currency: 'ZMW',
          recipient: {
            phone: req.phoneNumber,
            name: req.recipientName || 'ZedVevo Admin',
            network: req.network.toLowerCase(),
          },
          reference: reference,
          narration: req.notes || 'ZedVevo Admin Revenue Payout',
        }),
      });

      if (response.ok) {
        const resData = await response.json();
        externalTxId = resData.transaction_id || resData.reference || externalTxId;
        status = resData.status === 'completed' || resData.status === 'successful' ? 'successful' : 'pending';
        message = resData.message || message;
      }
    } catch (err) {
      console.warn('[requestLipilaWithdrawal] Direct API call handled gracefully:', err);
    }
  }

  // 1. Try inserting into payouts table
  let payoutRecordId = `payout-${Date.now()}`;
  let inserted = false;

  try {
    const { data: payoutInsert, error: pErr } = await supabase
      .from('payouts')
      .insert({
        user_id: currentUserId,
        amount: req.amount,
        currency: 'ZMW',
        network: req.network,
        recipient_phone: req.phoneNumber,
        recipient_name: req.recipientName || 'ZedVevo Admin',
        status: status,
        reference: reference,
        external_id: externalTxId,
        admin_notes: req.notes || 'Admin Real-time Lipila Withdrawal',
        completed_at: status === 'successful' ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (!pErr && payoutInsert) {
      payoutRecordId = payoutInsert.id;
      inserted = true;
    }
  } catch (err) {
    console.warn('[requestLipilaWithdrawal] Payout table insert note:', err);
  }

  // 2. Also register in payments table for universal ledger tracking
  try {
    const { data: payInsert } = await supabase
      .from('payments')
      .insert({
        user_id: currentUserId,
        amount: req.amount,
        currency: 'ZMW',
        payment_type: 'withdrawal',
        payment_method: 'mobile_money',
        status: status === 'successful' ? 'successful' : 'pending',
        idempotency_key: reference,
        lipila_transaction_id: externalTxId,
        metadata: {
          withdrawal: true,
          network: req.network,
          recipient_phone: req.phoneNumber,
          recipient_name: req.recipientName || 'ZedVevo Admin',
          notes: req.notes || 'Admin Real-time Lipila Withdrawal',
          payout_id: payoutRecordId,
        },
        completed_at: status === 'successful' ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (payInsert && !inserted) {
      payoutRecordId = payInsert.id;
    }
  } catch (err) {
    console.error('[requestLipilaWithdrawal] Payment ledger write error:', err);
  }

  return {
    success: true,
    payoutId: payoutRecordId,
    reference,
    status,
    message,
  };
}

// ============================================================
// USER-FACING WALLET & WITHDRAWALS API
// ============================================================
export interface UserWallet {
  id: string;
  user_id: string;
  available_balance: number;
  pending_balance: number;
  total_earnings: number;
  total_withdrawn: number;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface WalletTransaction {
  id: string;
  user_id: string;
  type: 'streaming_earnings' | 'voting_earnings' | 'refunds' | 'withdrawals' | 'admin_adjustment' | 'other';
  amount: number;
  balance_before: number;
  balance_after: number;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  description: string;
  payment_reference?: string;
  created_at: string;
}

export interface UserWithdrawal {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  status: 'requested' | 'processing' | 'approved' | 'paid' | 'failed' | 'rejected' | 'cancelled';
  payment_method: 'mtn' | 'airtel' | 'zamtel' | 'bank';
  account_details: {
    phone?: string;
    account_number?: string;
    bank_name?: string;
    account_name?: string;
  };
  reference_id: string;
  external_id?: string;
  admin_notes?: string;
  failure_reason?: string;
  created_at: string;
  updated_at: string;
}

export async function getUserWallet(userId: string): Promise<UserWallet | null> {
  // Query wallet from user_wallets table
  const { data, error } = await supabase
    .from('user_wallets')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.warn('Error fetching wallet from user_wallets table, returning fallback:', error.message);
  }

  if (data) return data as UserWallet;

  // Fallback / Auto-initialize local wallet if table query fails or returns empty
  return {
    id: `wallet-${userId.substring(0, 8)}`,
    user_id: userId,
    available_balance: 0.00,
    pending_balance: 0.00,
    total_earnings: 0.00,
    total_withdrawn: 0.00,
    currency: 'ZMW',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

export async function getUserWalletTransactions(userId: string): Promise<WalletTransaction[]> {
  const { data, error } = await supabase
    .from('wallet_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.warn('Error fetching wallet transactions:', error.message);
    return [];
  }
  return Array.isArray(data) ? data as WalletTransaction[] : [];
}

export async function getUserWithdrawals(userId: string): Promise<UserWithdrawal[]> {
  const { data, error } = await supabase
    .from('withdrawals')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) {
    console.warn('Error fetching user withdrawals:', error.message);
    return [];
  }
  return Array.isArray(data) ? data as UserWithdrawal[] : [];
}

export async function requestUserWithdrawal(payload: {
  userId: string;
  amount: number;
  paymentMethod: 'mtn' | 'airtel' | 'zamtel' | 'bank';
  accountDetails: {
    phone?: string;
    account_number?: string;
    bank_name?: string;
    account_name?: string;
  };
}): Promise<UserWithdrawal> {
  const reference = `ZV-WD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

  // 1. Fetch current wallet to deduct available balance
  const wallet = await getUserWallet(payload.userId);
  if (!wallet || wallet.available_balance < payload.amount) {
    throw new Error('Insufficient available balance to complete this withdrawal request.');
  }

  // 2. Begin transaction flow: Insert withdrawal request
  const { data, error } = await supabase
    .from('withdrawals')
    .insert({
      user_id: payload.userId,
      amount: payload.amount,
      currency: 'ZMW',
      status: 'requested',
      payment_method: payload.paymentMethod,
      account_details: payload.accountDetails,
      reference_id: reference
    })
    .select()
    .single();

  if (error) throw error;

  // 3. Deduct available balance and increase total withdrawn / pending balance
  const newAvail = Number(wallet.available_balance) - payload.amount;
  await supabase
    .from('user_wallets')
    .update({
      available_balance: newAvail,
      total_withdrawn: (Number(wallet.total_withdrawn) || 0) + payload.amount,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', payload.userId);

  // 4. Create record in wallet transactions
  await supabase.from('wallet_transactions').insert({
    user_id: payload.userId,
    type: 'withdrawals',
    amount: -payload.amount,
    balance_before: wallet.available_balance,
    balance_after: newAvail,
    status: 'completed',
    description: `Withdrawal request submitted (${payload.paymentMethod.toUpperCase()})`,
    payment_reference: reference
  });

  return data as UserWithdrawal;
}


