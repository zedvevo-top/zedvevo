import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType, sanitizeId, stripUndefined, truncateStr } from '@/lib/firebase';
import type {
  Artist,
  Award,
  AwardCategory,
  Download,
  HeroBanner,
  Nominee,
  Notification,
  Payment,
  Profile,
  Song,
  Sponsor,
  UploadPlan,
  UserSubscription,
  Video,
  Vote,
  WeeklyTrending,
  WinnerOfMonth,
} from '@/types/index';

function isAdminSession(): boolean {
  return (
    auth.currentUser?.email?.toLowerCase() === 'topkuchalo@gmail.com' &&
    auth.currentUser?.emailVerified === true
  );
}

function sortByDateDesc<T extends { created_at?: string; downloaded_at?: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const da = new Date(a.created_at || a.downloaded_at || 0).getTime();
    const dbTime = new Date(b.created_at || b.downloaded_at || 0).getTime();
    return dbTime - da;
  });
}

// ============================================================
// SONGS
// ============================================================
export async function fbGetSongs(opts: { status?: string; limit?: number; userId?: string } = {}): Promise<Song[]> {
  const path = 'songs';
  try {
    const admin = isAdminSession();
    const isSelf = Boolean(opts.userId && auth.currentUser?.uid && opts.userId === auth.currentUser.uid);
    let qRef;
    if (opts.userId) {
      qRef = (admin || isSelf)
        ? query(collection(db, path), where('user_id', '==', opts.userId))
        : query(collection(db, path), where('user_id', '==', opts.userId), where('status', '==', 'approved'));
    } else if (opts.status && (opts.status === 'approved' || admin)) {
      qRef = query(collection(db, path), where('status', '==', opts.status));
    } else if (!admin) {
      qRef = query(collection(db, path), where('status', '==', 'approved'));
    } else {
      qRef = query(collection(db, path));
    }

    const snap = await getDocs(qRef);
    let rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Song);
    if (opts.status && opts.userId) {
      rows = rows.filter((r) => r.status === opts.status);
    }
    rows = sortByDateDesc(rows);
    return opts.limit ? rows.slice(0, opts.limit) : rows;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function fbGetSongById(id: string): Promise<Song | null> {
  const path = `songs/${id}`;
  try {
    const snap = await getDoc(doc(db, 'songs', sanitizeId(id)));
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as Song) : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function fbCreateSong(payload: Partial<Song>): Promise<string> {
  const id = sanitizeId(payload.id || `song_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  const path = `songs/${id}`;
  try {
    const now = new Date().toISOString();
    const docData = stripUndefined({
      id,
      user_id: sanitizeId(payload.user_id || auth.currentUser?.uid || 'system'),
      artist_id: payload.artist_id ? sanitizeId(payload.artist_id) : null,
      title: truncateStr(payload.title || 'Untitled', 200) || 'Untitled',
      artist_name: truncateStr(payload.artist_name || 'Artist', 200) || 'Artist',
      album: truncateStr(payload.album, 200),
      genre: truncateStr(payload.genre, 100),
      cover_url: truncateStr(payload.cover_url, 1024),
      thumbnail_url: truncateStr(payload.thumbnail_url, 1024),
      file_url: truncateStr(payload.file_url || '', 1024) || '',
      duration: payload.duration != null ? Number(payload.duration) : null,
      play_count: Number(payload.play_count ?? 0),
      like_count: Number(payload.like_count ?? 0),
      download_count: Number(payload.download_count ?? 0),
      share_count: Number(payload.share_count ?? 0),
      featured_artists: truncateStr(payload.featured_artists, 250),
      producer: truncateStr(payload.producer, 200),
      status: payload.status && isAdminSession() ? payload.status : 'pending',
      is_trending: isAdminSession() ? Boolean(payload.is_trending ?? false) : false,
      is_featured: isAdminSession() ? Boolean(payload.is_featured ?? false) : false,
      created_at: payload.created_at || now,
      updated_at: now,
    });
    await setDoc(doc(db, 'songs', id), docData);
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function fbUpdateSong(id: string, payload: Partial<Song>): Promise<void> {
  const cleanId = sanitizeId(id);
  const path = `songs/${cleanId}`;
  try {
    await updateDoc(doc(db, 'songs', cleanId), stripUndefined({ ...payload, updated_at: new Date().toISOString() }));
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function fbDeleteSong(id: string): Promise<void> {
  const cleanId = sanitizeId(id);
  const path = `songs/${cleanId}`;
  try {
    await deleteDoc(doc(db, 'songs', cleanId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ============================================================
// VIDEOS
// ============================================================
export async function fbGetVideos(opts: { status?: string; limit?: number; userId?: string } = {}): Promise<Video[]> {
  const path = 'videos';
  try {
    const admin = isAdminSession();
    const isSelf = Boolean(opts.userId && auth.currentUser?.uid && opts.userId === auth.currentUser.uid);
    let qRef;
    if (opts.userId) {
      qRef = (admin || isSelf)
        ? query(collection(db, path), where('user_id', '==', opts.userId))
        : query(collection(db, path), where('user_id', '==', opts.userId), where('status', '==', 'approved'));
    } else if (opts.status && (opts.status === 'approved' || admin)) {
      qRef = query(collection(db, path), where('status', '==', opts.status));
    } else if (!admin) {
      qRef = query(collection(db, path), where('status', '==', 'approved'));
    } else {
      qRef = query(collection(db, path));
    }

    const snap = await getDocs(qRef);
    let rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Video);
    if (opts.status && opts.userId) {
      rows = rows.filter((r) => r.status === opts.status);
    }
    rows = sortByDateDesc(rows);
    return opts.limit ? rows.slice(0, opts.limit) : rows;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function fbGetVideoById(id: string): Promise<Video | null> {
  const cleanId = sanitizeId(id);
  const path = `videos/${cleanId}`;
  try {
    const snap = await getDoc(doc(db, 'videos', cleanId));
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as Video) : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function fbCreateVideo(payload: Partial<Video>): Promise<string> {
  const id = sanitizeId(payload.id || `video_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  const path = `videos/${id}`;
  try {
    const now = new Date().toISOString();
    const docData = stripUndefined({
      id,
      user_id: sanitizeId(payload.user_id || auth.currentUser?.uid || 'system'),
      artist_id: payload.artist_id ? sanitizeId(payload.artist_id) : null,
      title: truncateStr(payload.title || 'Untitled Video', 200) || 'Untitled Video',
      artist_name: truncateStr(payload.artist_name || 'Artist', 200) || 'Artist',
      description: truncateStr(payload.description, 2000),
      genre: truncateStr(payload.genre, 100),
      thumbnail_url: truncateStr(payload.thumbnail_url, 1024),
      file_url: truncateStr(payload.file_url || '', 1024) || '',
      duration: payload.duration != null ? Number(payload.duration) : null,
      view_count: Number(payload.view_count ?? 0),
      like_count: Number(payload.like_count ?? 0),
      download_count: Number(payload.download_count ?? 0),
      share_count: Number(payload.share_count ?? 0),
      downloads_enabled: payload.downloads_enabled !== false,
      featured_artists: truncateStr(payload.featured_artists, 250),
      producer: truncateStr(payload.producer, 200),
      status: payload.status && isAdminSession() ? payload.status : 'pending',
      is_trending: isAdminSession() ? Boolean(payload.is_trending ?? false) : false,
      is_featured: isAdminSession() ? Boolean(payload.is_featured ?? false) : false,
      youtube_url: truncateStr(payload.youtube_url, 512),
      youtube_id: truncateStr(payload.youtube_id, 64),
      is_youtube: Boolean(payload.is_youtube ?? false),
      created_at: payload.created_at || now,
      updated_at: now,
    });
    await setDoc(doc(db, 'videos', id), docData);
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function fbUpdateVideo(id: string, payload: Partial<Video>): Promise<void> {
  const cleanId = sanitizeId(id);
  const path = `videos/${cleanId}`;
  try {
    await updateDoc(doc(db, 'videos', cleanId), stripUndefined({ ...payload, updated_at: new Date().toISOString() }));
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function fbDeleteVideo(id: string): Promise<void> {
  const cleanId = sanitizeId(id);
  const path = `videos/${cleanId}`;
  try {
    await deleteDoc(doc(db, 'videos', cleanId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ============================================================
// ARTISTS & PROFILES
// ============================================================
export async function fbGetArtists(limitCount = 100): Promise<Artist[]> {
  const path = 'artists';
  try {
    const snap = await getDocs(query(collection(db, path), limit(limitCount)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Artist);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function fbGetArtistById(id: string): Promise<Artist | null> {
  const cleanId = sanitizeId(id);
  const path = `artists/${cleanId}`;
  try {
    const snap = await getDoc(doc(db, 'artists', cleanId));
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as Artist) : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function fbGetAllProfiles(): Promise<Profile[]> {
  const path = 'profiles';
  try {
    const snap = await getDocs(collection(db, path));
    return sortByDateDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Profile));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function fbGetProfile(userId: string): Promise<Profile | null> {
  const cleanId = sanitizeId(userId);
  const path = `profiles/${cleanId}`;
  try {
    const snap = await getDoc(doc(db, 'profiles', cleanId));
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as Profile) : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function fbUpsertProfile(profile: Partial<Profile> & { id: string }): Promise<void> {
  const cleanId = sanitizeId(profile.id);
  const path = `profiles/${cleanId}`;
  try {
    const now = new Date().toISOString();
    const privDoc = stripUndefined({
      id: cleanId,
      email: truncateStr(profile.email, 254),
      phone: truncateStr(profile.phone, 32),
      username: truncateStr(profile.username, 64),
      display_name: truncateStr(profile.display_name, 120),
      avatar_url: truncateStr(profile.avatar_url, 1024),
      bio: truncateStr(profile.bio, 5000),
      role: profile.role || 'user',
      is_artist: Boolean(profile.is_artist ?? false),
      upload_access: truncateStr(profile.upload_access || 'inactive', 32),
      created_at: profile.created_at || now,
      updated_at: now,
    });
    await setDoc(doc(db, 'profiles', cleanId), privDoc, { merge: true });

    const pubDoc = stripUndefined({
      id: cleanId,
      username: truncateStr(profile.username, 64),
      display_name: truncateStr(profile.display_name, 120),
      avatar_url: truncateStr(profile.avatar_url, 1024),
      bio: truncateStr(profile.bio, 5000),
      is_artist: Boolean(profile.is_artist ?? false),
      created_at: profile.created_at || now,
    });
    await setDoc(doc(db, 'public_profiles', cleanId), pubDoc, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// ============================================================
// BANNERS, SPONSORS, PLANS, SETTINGS
// ============================================================
export async function fbGetBanners(activeOnly = true): Promise<HeroBanner[]> {
  const path = 'hero_banners';
  try {
    const qRef = activeOnly
      ? query(collection(db, path), where('is_active', '==', true))
      : query(collection(db, path));
    const snap = await getDocs(qRef);
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as HeroBanner)
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function fbGetSponsors(activeOnly = true): Promise<Sponsor[]> {
  const path = 'sponsors';
  try {
    const qRef = activeOnly
      ? query(collection(db, path), where('is_active', '==', true))
      : query(collection(db, path));
    const snap = await getDocs(qRef);
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as Sponsor)
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function fbGetUploadPlans(activeOnly = true): Promise<UploadPlan[]> {
  const path = 'upload_plans';
  try {
    const qRef = activeOnly
      ? query(collection(db, path), where('is_active', '==', true))
      : query(collection(db, path));
    const snap = await getDocs(qRef);
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as UploadPlan)
      .sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function fbGetSettings(includePrivate = false): Promise<Record<string, string>> {
  const path = 'app_settings';
  try {
    const qRef = includePrivate && isAdminSession()
      ? query(collection(db, path))
      : query(collection(db, path), where('is_public', '==', true));
    const snap = await getDocs(qRef);
    const map: Record<string, string> = {};
    snap.docs.forEach((d) => {
      const data = d.data();
      map[data.key || d.id] = typeof data.value === 'string' ? data.value : JSON.stringify(data.value ?? '');
    });
    return map;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function fbUpsertSetting(key: string, value: string, description?: string): Promise<void> {
  const cleanKey = sanitizeId(key);
  const path = `app_settings/${cleanKey}`;
  try {
    const lower = cleanKey.toLowerCase();
    const isSensitive =
      lower.includes('secret') ||
      lower.includes('private') ||
      lower.includes('password') ||
      lower.includes('api_key') ||
      lower.includes('token');
    await setDoc(
      doc(db, 'app_settings', cleanKey),
      stripUndefined({
        key: cleanKey,
        value: truncateStr(value, 500000) ?? '',
        description: truncateStr(description, 500),
        is_public: !isSensitive,
        updated_at: new Date().toISOString(),
      }),
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// ============================================================
// AWARDS, CATEGORIES, NOMINEES, VOTES
// ============================================================
export async function fbGetAwards(activeOnly = true): Promise<Award[]> {
  const path = 'awards';
  try {
    const qRef = activeOnly
      ? query(collection(db, path), where('is_active', '==', true))
      : query(collection(db, path));
    const [awardsSnap, catsSnap, nomSnap] = await Promise.all([
      getDocs(qRef),
      getDocs(activeOnly ? query(collection(db, 'award_categories'), where('is_active', '==', true)) : query(collection(db, 'award_categories'))),
      getDocs(activeOnly ? query(collection(db, 'nominees'), where('nomination_status', 'in', ['approved', 'winner'])) : query(collection(db, 'nominees'))),
    ]);

    const nominees = nomSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Nominee);
    const categories = catsSnap.docs.map((d) => {
      const cat = { id: d.id, ...d.data() } as AwardCategory;
      cat.nominees = nominees.filter((n) => n.category_id === cat.id);
      return cat;
    });

    return sortByDateDesc(
      awardsSnap.docs.map((d) => {
        const award = { id: d.id, ...d.data() } as Award;
        award.award_categories = categories.filter((c) => c.award_id === award.id);
        return award;
      })
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function fbGetNominees(approvedOnly = true): Promise<Nominee[]> {
  const path = 'nominees';
  try {
    const qRef = approvedOnly
      ? query(collection(db, path), where('nomination_status', 'in', ['approved', 'winner']))
      : query(collection(db, path));
    const snap = await getDocs(qRef);
    return sortByDateDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Nominee));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function fbGetVotes(userId?: string): Promise<Vote[]> {
  const path = 'votes';
  try {
    const qRef = userId
      ? query(collection(db, path), where('user_id', '==', userId))
      : query(collection(db, path));
    const snap = await getDocs(qRef);
    return sortByDateDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Vote));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

// ============================================================
// PAYMENTS, SUBSCRIPTIONS, LIKES, DOWNLOADS, TRENDING
// ============================================================
export async function fbGetPayments(userId?: string): Promise<Payment[]> {
  const path = 'payments';
  try {
    const qRef = userId
      ? query(collection(db, path), where('user_id', '==', userId))
      : query(collection(db, path));
    const snap = await getDocs(qRef);
    return sortByDateDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Payment));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function fbGetSubscriptions(userId: string): Promise<UserSubscription[]> {
  const path = 'user_subscriptions';
  try {
    const snap = await getDocs(query(collection(db, path), where('user_id', '==', sanitizeId(userId))));
    return sortByDateDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as UserSubscription));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function fbGetDownloads(userId?: string): Promise<Download[]> {
  const path = 'downloads';
  try {
    const qRef = userId
      ? query(collection(db, path), where('user_id', '==', sanitizeId(userId)))
      : query(collection(db, path));
    const snap = await getDocs(qRef);
    return sortByDateDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Download));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function fbGetWeeklyTrending(): Promise<WeeklyTrending[]> {
  const path = 'weekly_trending';
  try {
    const snap = await getDocs(collection(db, path));
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as WeeklyTrending)
      .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function fbGetWinnersOfMonth(publishedOnly = true): Promise<WinnerOfMonth[]> {
  const path = 'winner_of_month';
  try {
    const qRef = publishedOnly
      ? query(collection(db, path), where('is_published', '==', true))
      : query(collection(db, path));
    const snap = await getDocs(qRef);
    return sortByDateDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as WinnerOfMonth));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function fbGetNotifications(userId?: string): Promise<Notification[]> {
  const path = 'notifications';
  try {
    const qRef = userId
      ? query(collection(db, path), where('user_id', '==', sanitizeId(userId)))
      : query(collection(db, path), where('user_id', '==', null));
    const snap = await getDocs(qRef);
    return sortByDateDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Notification));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}
