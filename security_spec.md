# ZedVevo Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Default-Deny Catch-All**: No unauthenticated or unauthorized access exists outside explicitly matched collections.
2. **PII Isolation**: `/profiles/{userId}` contains `email` and `phone` and is strictly readable/writable ONLY by the document owner (`request.auth.uid == userId`) or a verified Admin (`topkuchalo@gmail.com` with `email_verified == true` or `/admins/{uid}` entry). Public attribution lives in `/public_profiles/{userId}` and `/artists/{artistId}` without email/phone PII.
3. **Anti-Privilege Escalation**: Non-admin users cannot create or update `/profiles/{userId}` with `role` other than `'user'`, nor modify `role`, `is_artist`, or `upload_access` on update.
4. **Content Moderation Integrity**: Songs (`/songs/{songId}`) and Videos (`/videos/{videoId}`) created by non-admins MUST initialize with `status == 'pending'`, `is_trending == false`, `is_featured == false`, and `user_id == request.auth.uid`. Public reads only return `status == 'approved'` items.
5. **Path Variable Hardening & Volumetric Bounds**: All document IDs are validated with `isValidId(id)` (`<= 128` chars, `^[a-zA-Z0-9_\-]+$`), and every string field enforces `.size()` limits matching `firebase-blueprint.json`.
6. **Payment & Subscription Protection**: `/payments/{paymentId}` and `/user_subscriptions/{subscriptionId}` are readable ONLY by the owning `user_id` or Admin; non-admins cannot forge `status == 'successful'` or `is_active == true`.
7. **Admin-Only Global Configuration**: `/app_settings/{settingKey}`, `/upload_plans/{planId}`, `/awards/{awardId}`, `/award_categories/{categoryId}`, `/hero_banners/{bannerId}`, `/sponsors/{sponsorId}`, `/weekly_trending/{entryId}`, `/winner_of_month/{winnerId}` can only be written by verified Admins.
8. **Secure List Queries**: No `allow list: if isSignedIn();` blanket list rules. Every `allow list` restricts `resource.data` by ownership, public status (`status == 'approved'`, `is_active == true`), or `isAdmin()`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Privilege Escalation on Profile Create**: `{ "id": "attacker", "role": "super_admin", "upload_access": "active" }` -> MUST return `PERMISSION_DENIED`.
2. **Shadow Field Injection on Profile Update**: `{ "display_name": "Evil", "isAdmin": true }` -> MUST return `PERMISSION_DENIED`.
3. **PII Scraping by Non-Owner**: `get /profiles/victim_uid` as another signed-in user -> MUST return `PERMISSION_DENIED`.
4. **Blanket Profiles List**: `list /profiles` as non-admin user -> MUST return `PERMISSION_DENIED`.
5. **Self-Approving Song on Create**: `create /songs/s1` with `{ "user_id": "u1", "status": "approved", ... }` as regular artist -> MUST return `PERMISSION_DENIED`.
6. **Owner Tampering with Song Status/Trending**: `update /songs/s1` changing `status: "approved"` or `is_trending: true` as non-admin owner -> MUST return `PERMISSION_DENIED`.
7. **Identity Spoofing on Song Create**: `create /songs/s2` with `{ "user_id": "someone_else", ... }` -> MUST return `PERMISSION_DENIED`.
8. **ID Poisoning**: `create /songs/AAAA...(1500 chars)` -> MUST return `PERMISSION_DENIED`.
9. **Payment Forgery**: `create /payments/p1` with `{ "user_id": "u1", "status": "successful", "amount": 1000 }` as non-admin -> MUST return `PERMISSION_DENIED`.
10. **Admin Settings Tampering**: `set /app_settings/ad_code_header` as non-admin -> MUST return `PERMISSION_DENIED`.
11. **Unverified Admin Email Spoof**: Request with `token.email == 'topkuchalo@gmail.com'` and `token.email_verified == false` -> MUST return `PERMISSION_DENIED`.
12. **Reading Unapproved Pending Nominee Contact PII**: `list /nominees` without filtering `nomination_status in ['approved', 'winner']` or `user_id == auth.uid` -> MUST return `PERMISSION_DENIED`.
