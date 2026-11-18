import {
  collection,
  doc,
  getCountFromServer,
  getDocs,
  limit,
  query,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType, sanitizeId, stripUndefined, truncateStr } from '@/lib/firebase';
import { supabase } from '@/lib/supabase';

export interface CollectionMigrationProgress {
  collection: string;
  fetched: number;
  written: number;
  status: 'pending' | 'syncing' | 'done' | 'error';
  error?: string;
}

export interface FirebaseDatabaseCounts {
  songs: number;
  videos: number;
  artists: number;
  profiles: number;
  awards: number;
  award_categories: number;
  nominees: number;
  votes: number;
  upload_plans: number;
  hero_banners: number;
  sponsors: number;
  app_settings: number;
  payments: number;
  content_likes: number;
  weekly_trending: number;
}

async function fetchAllFromSupabase(table: string, orderCol = 'created_at'): Promise<any[]> {
  const allRows: any[] = [];
  const pageSize = 500;
  let offset = 0;

  while (true) {
    try {
      const q = supabase
        .from(table)
        .select('*')
        .range(offset, offset + pageSize - 1);

      const { data, error } = orderCol ? await q.order(orderCol, { ascending: false }) : await q;

      if (error) {
        // Fallback without order column if column does not exist
        if (orderCol && error.message?.includes(orderCol)) {
          return fetchAllFromSupabase(table, '');
        }
        console.warn(`[Migration] Skip table ${table}:`, error.message);
        break;
      }

      if (!data || data.length === 0) break;
      allRows.push(...data);
      if (data.length < pageSize) break;
      offset += pageSize;
    } catch (err) {
      console.warn(`[Migration] Error fetching ${table}:`, err);
      break;
    }
  }
  return allRows;
}

async function batchUpsertFirestore(
  collectionName: string,
  docs: Array<{ id: string; data: Record<string, any> }>
): Promise<number> {
  if (docs.length === 0) return 0;
  const chunkSize = 350;
  let written = 0;

  for (let i = 0; i < docs.length; i += chunkSize) {
    const chunk = docs.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const item of chunk) {
      const docRef = doc(db, collectionName, item.id);
      batch.set(docRef, item.data, { merge: true });
    }
    try {
      await batch.commit();
      written += chunk.length;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, collectionName);
    }
  }
  return written;
}

export async function ensureAdminDocForCurrentUser(): Promise<boolean> {
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.emailVerified) return false;
  if (currentUser.email?.toLowerCase() !== 'topkuchalo@gmail.com') return false;

  try {
    await setDoc(
      doc(db, 'admins', currentUser.uid),
      {
        uid: currentUser.uid,
        email: currentUser.email,
        role: 'super_admin',
        created_at: new Date().toISOString(),
      },
      { merge: true }
    );
    return true;
  } catch (error) {
    console.warn('[FirebaseMigration] Admin bootstrap check:', error);
    return false;
  }
}

function mapProfile(row: any): { id: string; data: Record<string, any> } {
  const id = sanitizeId(row.id);
  const allowedRoles = ['user', 'artist', 'admin', 'super_admin', 'judge'];
  const role = allowedRoles.includes(row.role) ? row.role : 'user';
  return {
    id,
    data: stripUndefined({
      id,
      email: truncateStr(row.email, 254),
      phone: truncateStr(row.phone, 32),
      username: truncateStr(row.username, 64),
      display_name: truncateStr(row.display_name || row.full_name, 120),
      avatar_url: truncateStr(row.avatar_url, 1024),
      bio: truncateStr(row.bio, 5000),
      role,
      is_artist: Boolean(row.is_artist ?? (role === 'artist' || role === 'admin' || role === 'super_admin')),
      upload_access: truncateStr(row.upload_access || (role === 'super_admin' ? 'active' : 'inactive'), 32),
      created_at: truncateStr(row.created_at || new Date().toISOString(), 64),
      updated_at: truncateStr(row.updated_at || new Date().toISOString(), 64),
    }),
  };
}

function mapPublicProfile(row: any): { id: string; data: Record<string, any> } {
  const id = sanitizeId(row.id);
  return {
    id,
    data: stripUndefined({
      id,
      username: truncateStr(row.username, 64),
      display_name: truncateStr(row.display_name || row.full_name, 120),
      avatar_url: truncateStr(row.avatar_url, 1024),
      bio: truncateStr(row.bio, 5000),
      is_artist: Boolean(row.is_artist ?? (row.role === 'artist' || row.role === 'admin' || row.role === 'super_admin')),
      created_at: truncateStr(row.created_at || new Date().toISOString(), 64),
    }),
  };
}

function mapArtist(row: any): { id: string; data: Record<string, any> } {
  const id = sanitizeId(row.id);
  return {
    id,
    data: stripUndefined({
      id,
      user_id: row.user_id ? sanitizeId(row.user_id) : null,
      profile_id: row.profile_id ? sanitizeId(row.profile_id) : null,
      name: truncateStr(row.name || row.stage_name || 'ZedVevo Artist', 160) || 'ZedVevo Artist',
      stage_name: truncateStr(row.stage_name || row.name, 160),
      bio: truncateStr(row.bio, 5000),
      avatar_url: truncateStr(row.avatar_url, 1024),
      cover_url: truncateStr(row.cover_url || row.cover_image_url, 1024),
      genre: truncateStr(row.genre, 100),
      is_featured: Boolean(row.is_featured ?? row.featured ?? false),
      verified: Boolean(row.verified ?? false),
      play_count: Number(row.play_count ?? 0),
      total_followers: Number(row.total_followers ?? 0),
      created_at: truncateStr(row.created_at || new Date().toISOString(), 64),
    }),
  };
}

function mapSong(row: any): { id: string; data: Record<string, any> } {
  const id = sanitizeId(row.id);
  const status = ['pending', 'approved', 'rejected'].includes(row.status) ? row.status : 'approved';
  return {
    id,
    data: stripUndefined({
      id,
      user_id: sanitizeId(row.user_id || 'system'),
      artist_id: row.artist_id ? sanitizeId(row.artist_id) : null,
      title: truncateStr(row.title || 'Untitled Track', 200) || 'Untitled Track',
      artist_name: truncateStr(row.artist_name || 'Unknown Artist', 200) || 'Unknown Artist',
      album: truncateStr(row.album, 200),
      genre: truncateStr(row.genre, 100),
      cover_url: truncateStr(row.cover_url, 1024),
      thumbnail_url: truncateStr(row.thumbnail_url, 1024),
      file_url: truncateStr(row.file_url || row.audio_url || '', 1024) || '',
      duration: row.duration != null ? Number(row.duration) : null,
      play_count: Number(row.play_count ?? 0),
      like_count: Number(row.like_count ?? 0),
      download_count: Number(row.download_count ?? 0),
      share_count: Number(row.share_count ?? 0),
      featured_artists: truncateStr(row.featured_artists, 250),
      producer: truncateStr(row.producer, 200),
      status,
      is_trending: Boolean(row.is_trending ?? false),
      is_featured: Boolean(row.is_featured ?? false),
      created_at: truncateStr(row.created_at || new Date().toISOString(), 64),
      updated_at: truncateStr(row.updated_at || new Date().toISOString(), 64),
    }),
  };
}

function mapVideo(row: any): { id: string; data: Record<string, any> } {
  const id = sanitizeId(row.id);
  const status = ['pending', 'approved', 'rejected'].includes(row.status) ? row.status : 'approved';
  return {
    id,
    data: stripUndefined({
      id,
      user_id: sanitizeId(row.user_id || 'system'),
      artist_id: row.artist_id ? sanitizeId(row.artist_id) : null,
      title: truncateStr(row.title || 'Untitled Video', 200) || 'Untitled Video',
      artist_name: truncateStr(row.artist_name || 'Unknown Artist', 200) || 'Unknown Artist',
      description: truncateStr(row.description, 2000),
      genre: truncateStr(row.genre, 100),
      thumbnail_url: truncateStr(row.thumbnail_url, 1024),
      file_url: truncateStr(row.file_url || row.video_url || '', 1024) || '',
      duration: row.duration != null ? Number(row.duration) : null,
      view_count: Number(row.view_count ?? 0),
      like_count: Number(row.like_count ?? 0),
      download_count: Number(row.download_count ?? 0),
      share_count: Number(row.share_count ?? 0),
      downloads_enabled: row.downloads_enabled !== false,
      featured_artists: truncateStr(row.featured_artists, 250),
      producer: truncateStr(row.producer, 200),
      status,
      is_trending: Boolean(row.is_trending ?? false),
      is_featured: Boolean(row.is_featured ?? false),
      youtube_url: truncateStr(row.youtube_url, 512),
      youtube_id: truncateStr(row.youtube_id, 64),
      is_youtube: Boolean(row.is_youtube ?? false),
      created_at: truncateStr(row.created_at || new Date().toISOString(), 64),
      updated_at: truncateStr(row.updated_at || new Date().toISOString(), 64),
    }),
  };
}

function mapUploadPlan(row: any): { id: string; data: Record<string, any> } {
  const id = sanitizeId(row.id);
  return {
    id,
    data: stripUndefined({
      id,
      name: truncateStr(row.name || 'Upload Plan', 120) || 'Upload Plan',
      plan_type: truncateStr(row.plan_type || 'k10_single', 64) || 'k10_single',
      price: Number(row.price ?? 0),
      description: truncateStr(row.description, 500),
      uploads_allowed: row.uploads_allowed != null ? Number(row.uploads_allowed) : null,
      validity_days: row.validity_days != null ? Number(row.validity_days) : null,
      is_active: row.is_active !== false,
      created_at: truncateStr(row.created_at || new Date().toISOString(), 64),
    }),
  };
}

function mapAward(row: any): { id: string; data: Record<string, any> } {
  const id = sanitizeId(row.id);
  return {
    id,
    data: stripUndefined({
      id,
      name: truncateStr(row.name || 'ZedVevo Music Awards', 200) || 'ZedVevo Music Awards',
      description: truncateStr(row.description, 1000),
      year: row.year != null ? Number(row.year) : 2026,
      season_label: truncateStr(row.season_label, 100),
      is_active: row.is_active !== false,
      voting_open: Boolean(row.voting_open ?? true),
      nominees_open: row.nominees_open !== false,
      voting_starts_at: truncateStr(row.voting_starts_at, 64),
      voting_ends_at: truncateStr(row.voting_ends_at, 64),
      created_at: truncateStr(row.created_at || new Date().toISOString(), 64),
    }),
  };
}

function mapAwardCategory(row: any): { id: string; data: Record<string, any> } {
  const id = sanitizeId(row.id);
  return {
    id,
    data: stripUndefined({
      id,
      award_id: sanitizeId(row.award_id),
      name: truncateStr(row.name || 'Category', 160) || 'Category',
      description: truncateStr(row.description, 500),
      grand_prize: truncateStr(row.grand_prize, 200),
      is_active: row.is_active !== false,
      created_at: truncateStr(row.created_at || new Date().toISOString(), 64),
    }),
  };
}

function mapNominee(row: any): { id: string; data: Record<string, any> } {
  const id = sanitizeId(row.id);
  const statuses = ['pending_payment', 'pending_review', 'approved', 'rejected', 'winner'];
  const nomination_status = statuses.includes(row.nomination_status) ? row.nomination_status : 'approved';
  return {
    id,
    data: stripUndefined({
      id,
      user_id: sanitizeId(row.user_id || 'system'),
      category_id: sanitizeId(row.category_id),
      name: truncateStr(row.name || 'Nominee', 200) || 'Nominee',
      bio: truncateStr(row.bio, 2000),
      photo_url: truncateStr(row.photo_url, 1024),
      song_title: truncateStr(row.song_title, 200),
      song_url: truncateStr(row.song_url, 1024),
      video_url: truncateStr(row.video_url, 1024),
      total_votes: Number(row.total_votes ?? 0),
      payment_id: row.payment_id ? sanitizeId(row.payment_id) : null,
      registration_status: truncateStr(row.registration_status || 'completed', 32),
      nomination_status,
      is_winner: Boolean(row.is_winner ?? false),
      achievements: truncateStr(row.achievements, 1000),
      social_links: row.social_links && typeof row.social_links === 'object' ? row.social_links : null,
      contact_email: truncateStr(row.contact_email, 254),
      created_at: truncateStr(row.created_at || new Date().toISOString(), 64),
    }),
  };
}

function mapVote(row: any): { id: string; data: Record<string, any> } {
  const id = sanitizeId(row.id);
  return {
    id,
    data: stripUndefined({
      id,
      user_id: row.user_id ? sanitizeId(row.user_id) : null,
      nominee_id: sanitizeId(row.nominee_id),
      category_id: sanitizeId(row.category_id),
      amount: Number(row.amount ?? 0),
      vote_count: Number(row.vote_count ?? 1),
      payment_id: row.payment_id ? sanitizeId(row.payment_id) : null,
      payment_status: truncateStr(row.payment_status || 'pending', 32) || 'pending',
      vote_approval_status: truncateStr(row.vote_approval_status, 32),
      created_at: truncateStr(row.created_at || new Date().toISOString(), 64),
    }),
  };
}

function mapPayment(row: any): { id: string; data: Record<string, any> } {
  const id = sanitizeId(row.id);
  const allowedStatuses = ['pending', 'successful', 'failed', 'cancelled', 'insufficient_funds', 'invalid_transaction'];
  const status = allowedStatuses.includes(row.status) ? row.status : 'pending';
  return {
    id,
    data: stripUndefined({
      id,
      user_id: row.user_id ? sanitizeId(row.user_id) : null,
      amount: Number(row.amount ?? 0),
      currency: truncateStr(row.currency || 'ZMW', 16),
      payment_method: truncateStr(row.payment_method, 64),
      lipila_transaction_id: truncateStr(row.lipila_transaction_id, 128),
      lipila_reference: truncateStr(row.lipila_reference, 128),
      plan_id: row.plan_id ? truncateStr(row.plan_id, 128) : null,
      subscription_id: row.subscription_id ? truncateStr(row.subscription_id, 128) : null,
      payment_type: truncateStr(row.payment_type || 'plan', 64) || 'plan',
      status,
      failure_reason: truncateStr(row.failure_reason, 500),
      phone_number: truncateStr(row.phone_number, 32),
      idempotency_key: truncateStr(row.idempotency_key, 128),
      metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata : null,
      created_at: truncateStr(row.created_at || new Date().toISOString(), 64),
      updated_at: truncateStr(row.updated_at || new Date().toISOString(), 64),
    }),
  };
}

function mapHeroBanner(row: any): { id: string; data: Record<string, any> } {
  const id = sanitizeId(row.id);
  return {
    id,
    data: stripUndefined({
      id,
      image_url: truncateStr(row.image_url || '', 1024) || '',
      title: truncateStr(row.title || 'ZedVevo', 200) || 'ZedVevo',
      subtitle: truncateStr(row.subtitle, 300),
      button_text: truncateStr(row.button_text, 80),
      button_url: truncateStr(row.button_url, 512),
      starts_at: truncateStr(row.starts_at, 64),
      ends_at: truncateStr(row.ends_at, 64),
      is_active: row.is_active !== false,
      display_order: Number(row.display_order ?? 0),
      created_at: truncateStr(row.created_at || new Date().toISOString(), 64),
    }),
  };
}

function mapSponsor(row: any): { id: string; data: Record<string, any> } {
  const id = sanitizeId(row.id);
  const tiers = ['gold', 'silver', 'bronze'];
  const tier = tiers.includes(row.tier) ? row.tier : 'bronze';
  return {
    id,
    data: stripUndefined({
      id,
      award_id: row.award_id ? sanitizeId(row.award_id) : null,
      name: truncateStr(row.name || 'Sponsor', 200) || 'Sponsor',
      headline: truncateStr(row.headline, 300),
      logo_url: truncateStr(row.logo_url, 1024),
      banner_url: truncateStr(row.banner_url, 1024),
      website_url: truncateStr(row.website_url, 512),
      cta_text: truncateStr(row.cta_text, 80),
      cta_url: truncateStr(row.cta_url, 512),
      tier,
      display_order: Number(row.display_order ?? 0),
      is_active: row.is_active !== false,
      position: truncateStr(row.position, 64),
      impression_count: Number(row.impression_count ?? 0),
      click_count: Number(row.click_count ?? 0),
      created_at: truncateStr(row.created_at || new Date().toISOString(), 64),
    }),
  };
}

function mapAppSetting(row: any): { id: string; data: Record<string, any> } {
  const key = sanitizeId(row.key);
  const lower = key.toLowerCase();
  const isSensitive =
    lower.includes('secret') ||
    lower.includes('private') ||
    lower.includes('password') ||
    lower.includes('api_key') ||
    lower.includes('token');
  const valStr = typeof row.value === 'string' ? row.value : JSON.stringify(row.value ?? '');
  return {
    id: key,
    data: stripUndefined({
      key,
      value: truncateStr(valStr, 500000) ?? '',
      description: truncateStr(row.description, 500),
      is_public: !isSensitive,
      updated_at: truncateStr(row.updated_at || new Date().toISOString(), 64),
    }),
  };
}

function mapContentLike(row: any): { id: string; data: Record<string, any> } {
  const id = sanitizeId(row.id);
  return {
    id,
    data: stripUndefined({
      id,
      user_id: sanitizeId(row.user_id),
      content_id: sanitizeId(row.content_id),
      content_type: row.content_type === 'video' ? 'video' : 'song',
      created_at: truncateStr(row.created_at || new Date().toISOString(), 64),
    }),
  };
}

function mapWeeklyTrending(row: any): { id: string; data: Record<string, any> } {
  const id = sanitizeId(row.id);
  return {
    id,
    data: stripUndefined({
      id,
      week_start: truncateStr(row.week_start || '', 32) || '',
      content_id: sanitizeId(row.content_id),
      content_type: row.content_type === 'video' ? 'video' : 'song',
      rank: Number(row.rank ?? 1),
      category: truncateStr(row.category || 'most_played', 64) || 'most_played',
      metric_value: Number(row.metric_value ?? 0),
      title: truncateStr(row.title, 200),
      artist_name: truncateStr(row.artist_name, 200),
      cover_url: truncateStr(row.cover_url, 1024),
      created_at: truncateStr(row.created_at || new Date().toISOString(), 64),
    }),
  };
}

function mapUserSubscription(row: any): { id: string; data: Record<string, any> } {
  const id = sanitizeId(row.id);
  return {
    id,
    data: stripUndefined({
      id,
      user_id: sanitizeId(row.user_id),
      plan_id: sanitizeId(row.plan_id),
      plan_type: truncateStr(row.plan_type || 'k10_single', 64) || 'k10_single',
      uploads_used: Number(row.uploads_used ?? 0),
      uploads_allowed: row.uploads_allowed != null ? Number(row.uploads_allowed) : null,
      activated_at: truncateStr(row.activated_at, 64),
      expires_at: truncateStr(row.expires_at, 64),
      is_active: Boolean(row.is_active ?? false),
      consumed: Boolean(row.consumed ?? false),
      status: truncateStr(row.status, 32),
      created_at: truncateStr(row.created_at || new Date().toISOString(), 64),
    }),
  };
}

function mapDownload(row: any): { id: string; data: Record<string, any> } {
  const id = sanitizeId(row.id);
  return {
    id,
    data: stripUndefined({
      id,
      user_id: sanitizeId(row.user_id),
      content_id: sanitizeId(row.content_id),
      content_type: row.content_type === 'video' ? 'video' : 'song',
      file_url: truncateStr(row.file_url || '', 1024) || '',
      title: truncateStr(row.title || 'Track', 200) || 'Track',
      artist_name: truncateStr(row.artist_name, 200),
      cover_url: truncateStr(row.cover_url, 1024),
      downloaded_at: truncateStr(row.downloaded_at || new Date().toISOString(), 64),
    }),
  };
}

function mapNotification(row: any): { id: string; data: Record<string, any> } {
  const id = sanitizeId(row.id);
  return {
    id,
    data: stripUndefined({
      id,
      user_id: row.user_id ? sanitizeId(row.user_id) : null,
      title: truncateStr(row.title || 'Notification', 200) || 'Notification',
      message: truncateStr(row.message || '', 2000) || '',
      type: truncateStr(row.type || 'info', 64),
      notification_type: truncateStr(row.notification_type || 'general', 64) || 'general',
      link: truncateStr(row.link, 512),
      is_read: Boolean(row.is_read ?? false),
      created_at: truncateStr(row.created_at || new Date().toISOString(), 64),
    }),
  };
}

function mapWinnerOfMonth(row: any): { id: string; data: Record<string, any> } {
  const id = sanitizeId(row.id);
  return {
    id,
    data: stripUndefined({
      id,
      month: Number(row.month ?? 1),
      year: Number(row.year ?? 2026),
      artist_name: truncateStr(row.artist_name || 'Artist', 200) || 'Artist',
      award: truncateStr(row.award || 'Winner of the Month', 200) || 'Winner of the Month',
      award_category: truncateStr(row.award_category, 200),
      photo_url: truncateStr(row.photo_url, 1024),
      prize: truncateStr(row.prize, 200),
      description: truncateStr(row.description, 1000),
      is_published: Boolean(row.is_published ?? true),
      created_at: truncateStr(row.created_at || new Date().toISOString(), 64),
      updated_at: truncateStr(row.updated_at || new Date().toISOString(), 64),
    }),
  };
}

export async function getFirestoreCollectionCounts(): Promise<FirebaseDatabaseCounts> {
  const counts: FirebaseDatabaseCounts = {
    songs: 0,
    videos: 0,
    artists: 0,
    profiles: 0,
    awards: 0,
    award_categories: 0,
    nominees: 0,
    votes: 0,
    upload_plans: 0,
    hero_banners: 0,
    sponsors: 0,
    app_settings: 0,
    payments: 0,
    content_likes: 0,
    weekly_trending: 0,
  };

  const keys = Object.keys(counts) as (keyof FirebaseDatabaseCounts)[];
  await Promise.all(
    keys.map(async (colName) => {
      try {
        // For public/admin check, attempt count query
        let qRef;
        if (colName === 'songs' || colName === 'videos') {
          const isAdminUser = auth.currentUser?.email?.toLowerCase() === 'topkuchalo@gmail.com';
          qRef = isAdminUser
            ? query(collection(db, colName))
            : query(collection(db, colName), where('status', '==', 'approved'));
        } else if (colName === 'nominees') {
          const isAdminUser = auth.currentUser?.email?.toLowerCase() === 'topkuchalo@gmail.com';
          qRef = isAdminUser
            ? query(collection(db, colName))
            : query(collection(db, colName), where('nomination_status', 'in', ['approved', 'winner']));
        } else if (colName === 'upload_plans' || colName === 'hero_banners' || colName === 'sponsors' || colName === 'awards' || colName === 'award_categories') {
          const isAdminUser = auth.currentUser?.email?.toLowerCase() === 'topkuchalo@gmail.com';
          qRef = isAdminUser
            ? query(collection(db, colName))
            : query(collection(db, colName), where('is_active', '==', true));
        } else if (colName === 'app_settings') {
          const isAdminUser = auth.currentUser?.email?.toLowerCase() === 'topkuchalo@gmail.com';
          qRef = isAdminUser
            ? query(collection(db, colName))
            : query(collection(db, colName), where('is_public', '==', true));
        } else {
          qRef = query(collection(db, colName));
        }
        const snap = await getCountFromServer(qRef);
        counts[colName] = snap.data().count;
      } catch {
        counts[colName] = 0;
      }
    })
  );

  return counts;
}

export async function getSourceDatabaseCounts(): Promise<FirebaseDatabaseCounts> {
  const counts: FirebaseDatabaseCounts = {
    songs: 0,
    videos: 0,
    artists: 0,
    profiles: 0,
    awards: 0,
    award_categories: 0,
    nominees: 0,
    votes: 0,
    upload_plans: 0,
    hero_banners: 0,
    sponsors: 0,
    app_settings: 0,
    payments: 0,
    content_likes: 0,
    weekly_trending: 0,
  };

  const keys = Object.keys(counts) as (keyof FirebaseDatabaseCounts)[];
  await Promise.all(
    keys.map(async (table) => {
      try {
        const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
        if (!error && typeof count === 'number') {
          counts[table] = count;
        }
      } catch {
        counts[table] = 0;
      }
    })
  );

  return counts;
}

export async function isFirestoreSeeded(): Promise<boolean> {
  try {
    const snap = await getDocs(query(collection(db, 'songs'), where('status', '==', 'approved'), limit(1)));
    return !snap.empty;
  } catch {
    return false;
  }
}

let activeMigrationPromise: Promise<{
  success: boolean;
  totalWritten: number;
  details: CollectionMigrationProgress[];
}> | null = null;

/**
 * Full database migration: Syncs all users, music, videos, artists, awards, nominees,
 * votes, plans, banners, sponsors, settings, likes, trending, and payments into Firestore.
 * Must be executed while signed in as Admin (topkuchalo@gmail.com).
 */
export async function migrateAllDataToFirebase(
  onProgress?: (items: CollectionMigrationProgress[]) => void
): Promise<{ success: boolean; totalWritten: number; details: CollectionMigrationProgress[] }> {
  if (activeMigrationPromise) {
    return activeMigrationPromise;
  }

  activeMigrationPromise = runMigration(onProgress).finally(() => {
    activeMigrationPromise = null;
  });

  return activeMigrationPromise;
}

async function runMigration(
  onProgress?: (items: CollectionMigrationProgress[]) => void
): Promise<{ success: boolean; totalWritten: number; details: CollectionMigrationProgress[] }> {
  if (!auth.currentUser) {
    throw new Error('Please sign in with Google as Admin (topkuchalo@gmail.com) to populate Firebase Firestore.');
  }

  await ensureAdminDocForCurrentUser();

  const tasks: Array<{
    name: string;
    sourceTable: string;
    orderCol: string;
    mapper: (row: any) => { id: string; data: Record<string, any> };
    extraPublicCollection?: { name: string; mapper: (row: any) => { id: string; data: Record<string, any> } };
  }> = [
    { name: 'profiles', sourceTable: 'profiles', orderCol: 'created_at', mapper: mapProfile, extraPublicCollection: { name: 'public_profiles', mapper: mapPublicProfile } },
    { name: 'artists', sourceTable: 'artists', orderCol: 'created_at', mapper: mapArtist },
    { name: 'songs', sourceTable: 'songs', orderCol: 'created_at', mapper: mapSong },
    { name: 'videos', sourceTable: 'videos', orderCol: 'created_at', mapper: mapVideo },
    { name: 'upload_plans', sourceTable: 'upload_plans', orderCol: 'created_at', mapper: mapUploadPlan },
    { name: 'user_subscriptions', sourceTable: 'user_subscriptions', orderCol: 'created_at', mapper: mapUserSubscription },
    { name: 'awards', sourceTable: 'awards', orderCol: 'created_at', mapper: mapAward },
    { name: 'award_categories', sourceTable: 'award_categories', orderCol: 'created_at', mapper: mapAwardCategory },
    { name: 'nominees', sourceTable: 'nominees', orderCol: 'created_at', mapper: mapNominee },
    { name: 'votes', sourceTable: 'votes', orderCol: 'created_at', mapper: mapVote },
    { name: 'hero_banners', sourceTable: 'hero_banners', orderCol: 'created_at', mapper: mapHeroBanner },
    { name: 'sponsors', sourceTable: 'sponsors', orderCol: 'created_at', mapper: mapSponsor },
    { name: 'app_settings', sourceTable: 'app_settings', orderCol: 'updated_at', mapper: mapAppSetting },
    { name: 'content_likes', sourceTable: 'content_likes', orderCol: 'created_at', mapper: mapContentLike },
    { name: 'user_library', sourceTable: 'user_library', orderCol: 'created_at', mapper: mapContentLike },
    { name: 'downloads', sourceTable: 'downloads', orderCol: 'downloaded_at', mapper: mapDownload },
    { name: 'notifications', sourceTable: 'notifications', orderCol: 'created_at', mapper: mapNotification },
    { name: 'weekly_trending', sourceTable: 'weekly_trending', orderCol: 'created_at', mapper: mapWeeklyTrending },
    { name: 'winner_of_month', sourceTable: 'winner_of_month', orderCol: 'created_at', mapper: mapWinnerOfMonth },
    { name: 'payments', sourceTable: 'payments', orderCol: 'created_at', mapper: mapPayment },
  ];

  const progress: CollectionMigrationProgress[] = tasks.map((t) => ({
    collection: t.name,
    fetched: 0,
    written: 0,
    status: 'pending',
  }));
  onProgress?.([...progress]);

  let totalWritten = 0;

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    progress[i] = { ...progress[i], status: 'syncing' };
    onProgress?.([...progress]);

    try {
      const rows = await fetchAllFromSupabase(task.sourceTable, task.orderCol);
      progress[i].fetched = rows.length;
      onProgress?.([...progress]);

      if (rows.length > 0) {
        const mapped = rows.map(task.mapper);
        const written = await batchUpsertFirestore(task.name, mapped);
        totalWritten += written;
        progress[i].written = written;

        if (task.extraPublicCollection) {
          const extraMapped = rows.map(task.extraPublicCollection.mapper);
          const extraWritten = await batchUpsertFirestore(task.extraPublicCollection.name, extraMapped);
          totalWritten += extraWritten;
        }
      }

      progress[i].status = 'done';
      onProgress?.([...progress]);
    } catch (err: any) {
      console.error(`[Migration] Failed syncing ${task.name}:`, err);
      progress[i].status = 'error';
      progress[i].error = err?.message || 'Sync error';
      onProgress?.([...progress]);
    }
  }

  try {
    localStorage.setItem('zedvevo_firebase_last_sync', new Date().toISOString());
  } catch { /* ignore */ }

  return {
    success: progress.every((p) => p.status !== 'error'),
    totalWritten,
    details: progress,
  };
}
