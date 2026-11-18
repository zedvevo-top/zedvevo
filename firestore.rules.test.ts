/**
 * Firestore Security Rules Test Specification (Dirty Dozen Adversarial Suite)
 * Verifies all 12 Dirty Dozen payloads against firestore.rules constraints.
 */

export interface DirtyDozenCase {
  id: number;
  name: string;
  collection: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  auth: { uid?: string; email?: string; email_verified?: boolean } | null;
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_CASES: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Privilege Escalation on Profile Create',
    collection: 'profiles/attacker_uid',
    operation: 'create',
    auth: { uid: 'attacker_uid', email: 'attacker@example.com', email_verified: true },
    payload: { id: 'attacker_uid', role: 'super_admin', upload_access: 'active' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Shadow Field Injection on Profile Update',
    collection: 'profiles/attacker_uid',
    operation: 'update',
    auth: { uid: 'attacker_uid', email: 'attacker@example.com', email_verified: true },
    payload: { display_name: 'Hacker', isAdmin: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'PII Scraping by Non-Owner',
    collection: 'profiles/victim_uid',
    operation: 'get',
    auth: { uid: 'attacker_uid', email: 'attacker@example.com', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Blanket Profiles List',
    collection: 'profiles',
    operation: 'list',
    auth: { uid: 'attacker_uid', email: 'attacker@example.com', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Self-Approving Song on Create',
    collection: 'songs/song_evil_1',
    operation: 'create',
    auth: { uid: 'artist_1', email: 'artist1@example.com', email_verified: true },
    payload: {
      id: 'song_evil_1',
      user_id: 'artist_1',
      title: 'Fake Hit',
      artist_name: 'Artist',
      file_url: 'https://example.com/a.mp3',
      status: 'approved',
      is_trending: true,
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Owner Tampering with Song Status/Trending',
    collection: 'songs/song_1',
    operation: 'update',
    auth: { uid: 'artist_1', email: 'artist1@example.com', email_verified: true },
    payload: { status: 'approved', is_trending: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Identity Spoofing on Song Create',
    collection: 'songs/song_evil_2',
    operation: 'create',
    auth: { uid: 'attacker_uid', email: 'attacker@example.com', email_verified: true },
    payload: {
      id: 'song_evil_2',
      user_id: 'victim_uid',
      title: 'Spoofed',
      artist_name: 'Victim',
      file_url: 'https://example.com/b.mp3',
      status: 'pending',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'ID Poisoning (>128 chars)',
    collection: `songs/${'A'.repeat(200)}`,
    operation: 'create',
    auth: { uid: 'artist_1', email: 'artist1@example.com', email_verified: true },
    payload: {
      id: 'A'.repeat(200),
      user_id: 'artist_1',
      title: 'Long ID',
      artist_name: 'Artist',
      file_url: 'https://example.com/c.mp3',
      status: 'pending',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Payment Forgery',
    collection: 'payments/pay_forged_1',
    operation: 'create',
    auth: { uid: 'attacker_uid', email: 'attacker@example.com', email_verified: true },
    payload: {
      id: 'pay_forged_1',
      user_id: 'attacker_uid',
      amount: 1000,
      payment_type: 'plan',
      status: 'successful',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Admin Settings Tampering',
    collection: 'app_settings/ad_code_header',
    operation: 'create',
    auth: { uid: 'attacker_uid', email: 'attacker@example.com', email_verified: true },
    payload: { key: 'ad_code_header', value: '<script>evil()</script>' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Unverified Admin Email Spoof',
    collection: 'app_settings/site_name',
    operation: 'update',
    auth: { uid: 'spoof_uid', email: 'topkuchalo@gmail.com', email_verified: false },
    payload: { key: 'site_name', value: 'Hacked' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Reading Unapproved Pending Nominees',
    collection: 'nominees',
    operation: 'list',
    auth: null,
    expected: 'PERMISSION_DENIED',
  },
];
