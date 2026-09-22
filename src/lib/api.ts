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
  const { error } = await supabase.rpc('increment_play_count', { song_id: songId });
  if (error) console.error('play count error', error);
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
  const { error } = await supabase.rpc('increment_view_count', { video_id: videoId });
  if (error) console.error('view count error', error);
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
// Helper to normalize and match songs to artists on the fly
function getArtistMatchedSongs(artist: any, allSongs: any[]): any[] {
  const clean = (str: string) => (str || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
  const artistId = artist.id;
  const artistUserId = artist.user_id;
  const artistName = clean(artist.name);
  const artistStageName = clean(artist.stage_name);

  return allSongs.filter(song => {
    if (song.artist_id && song.artist_id === artistId) return true;
    if (song.user_id && artistUserId && song.user_id === artistUserId) return true;
    
    const songArtistClean = clean(song.artist_name);
    if (songArtistClean && (songArtistClean === artistName || songArtistClean === artistStageName)) return true;
    
    // Fuzzy sub-string match for cases like "Emy Gizy ZMAirForce" vs "Emy-Gizy-ZM-AirForce"
    if (songArtistClean && (artistName.includes(songArtistClean) || songArtistClean.includes(artistName) || 
        artistStageName.includes(songArtistClean) || songArtistClean.includes(artistStageName))) {
      return true;
    }
    return false;
  });
}

// ============================================================
// UNIFIED ARTIST IMAGE RESOLUTION
// ============================================================
export const ARTIST_PLACEHOLDER_CDN = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&h=400&fit=crop&q=80';

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
    const totalPlays = Math.max(Number(artist.play_count) || 0, songsPlays);
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
    const totalPlays = Math.max(Number(artist.play_count) || 0, songsPlays);
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
    else if ((p.payment_type === 'subscription' || p.payment_type === 'plan') && p.user_id && (p.plan_id || p.metadata?.plan_id)) {
      const planId = p.plan_id || p.metadata?.plan_id;
      
      // Fetch plan details from upload_plans
      const { data: plan } = await supabase
        .from('upload_plans')
        .select('*')
        .eq('id', planId)
        .maybeSingle();

      const validityDays = plan?.validity_days || (p.metadata?.plan_type === 'k300_yearly' ? 365 : p.metadata?.plan_type === 'k100_weekly' ? 7 : p.metadata?.plan_type === 'k30_all_platforms' ? 8 : 30);
      const planType = plan?.plan_type || p.metadata?.plan_type || 'k10_single';
      const uploadsAllowed = plan?.uploads_allowed !== undefined ? plan?.uploads_allowed : (planType === 'k10_single' || planType === 'k30_all_platforms' ? 1 : null);

      const now = new Date();
      const expiresAt = new Date(now.getTime() + validityDays * 24 * 60 * 60 * 1000).toISOString();

      // Deactivate any existing active subscriptions for this user
      await supabase
        .from('user_subscriptions')
        .update({ is_active: false })
        .eq('user_id', p.user_id);

      // Insert new active subscription
      const { error: subInsertErr } = await supabase
        .from('user_subscriptions')
        .insert({
          user_id: p.user_id,
          plan_id: planId,
          plan_type: planType,
          uploads_used: 0,
          uploads_allowed: uploadsAllowed,
          activated_at: new Date().toISOString(),
          expires_at: expiresAt,
          is_active: true,
        });

      if (subInsertErr) {
        console.warn('user_subscriptions insert fallback error:', subInsertErr);
      }

      // Also create an in-app notification for the user
      try {
        await supabase.from('notifications').insert({
          user_id: p.user_id,
          title: 'Plan Activated!',
          message: `Your ${plan?.name || 'Upload'} plan is now active. You can start uploading content immediately.`,
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
// USER SUBSCRIPTIONS
// ============================================================
export async function getUserActiveSubscription(userId: string): Promise<UserSubscription | null> {
  const { data, error } = await supabase
    .from('user_subscriptions').select('*, upload_plans(*)').eq('user_id', userId).eq('is_active', true)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) return null;
  return data as UserSubscription | null;
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
  const { data, error } = await supabase.from('app_settings').select('key, value');
  if (error) throw error;
  const map: Record<string, string> = {};
  (data || []).forEach((s: { key: string; value: string }) => { map[s.key] = s.value; });
  return map;
}

export async function updateSetting(key: string, value: string) {
  const { error } = await supabase.from('app_settings').update({ value, updated_at: new Date().toISOString() }).eq('key', key);
  if (error) throw error;
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

export async function createNotification(payload: {
  user_id?: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
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

export async function getVisitorCount(): Promise<number> {
  if (!supabase) return 0;
  const { data, error } = await supabase
    .from('site_stats')
    .select('visitor_count')
    .eq('key', 'main')
    .single();
  if (error || !data) return 0;
  return Number(data.visitor_count);
}

export async function incrementVisitorCount(): Promise<number> {
  if (!supabase) return 0;
  const { data, error } = await supabase.rpc('increment_visitor_count');
  if (error) return 0;
  return Number(data);
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
