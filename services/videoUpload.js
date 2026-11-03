import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase, BAWAAL_VIDEOS_BUCKET } from '../lib/supabase';
import {
  ensurePublicBawaalVideoUrl,
  sanitizePlayableFeedUri,
  sanitizeVideoUriForUpload,
  stabilizeLocalVideoUri,
} from '../src/services/uploadService';

/**
 * Storage bucket names (table `videos` is separate).
 * Primary matches supabase_schema.sql + BAWAAL_VIDEOS_BUCKET.
 * Fallbacks cover legacy Expo uploads and a common dashboard name.
 */
const PRIMARY_VIDEO_BUCKET = BAWAAL_VIDEOS_BUCKET || 'bawaal-videos';
const FALLBACK_VIDEO_BUCKETS = ['bawaalvideos', 'videos'];

/** Nil UUID — type-safe placeholder when no auth/profile uuid is available. */
const NIL_USER_UUID = '00000000-0000-0000-0000-000000000000';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MIN_VIDEO_BYTES = 1024;

const BUCKET_SETUP_HINT =
  `Create a public Storage bucket named "${PRIMARY_VIDEO_BUCKET}" in the Supabase dashboard ` +
  '(Storage → New bucket → public), or run supabase_schema.sql in the SQL Editor.';

const RLS_SETUP_HINT =
  'RLS blocked the insert. In Supabase SQL Editor run the videos_insert_anon policy from ' +
  'supabase_schema.sql (insert to anon, authenticated with check (true)), or enable ' +
  'Anonymous sign-ins under Authentication → Providers.';

function asUuidOrNull(value) {
  if (value == null) return null;
  const s = String(value).trim();
  return UUID_RE.test(s) ? s : null;
}

function isBucketMissingError(err) {
  const msg = String(err?.message || err?.error || err || '').toLowerCase();
  const status = err?.statusCode ?? err?.status ?? err?.status_code;
  return (
    status === 404 ||
    /bucket not found|does not exist|no such bucket|the resource was not found/i.test(
      msg
    )
  );
}

function isUserIdConstraintError(err) {
  const msg = String(err?.message || err?.details || err || '');
  return /user_id|invalid input syntax for type uuid|foreign key|violates|23503|22P02/i.test(
    msg
  );
}

function isRlsError(err) {
  const msg = String(err?.message || err?.details || err?.code || err || '');
  return /row-level security|rls|42501|permission denied|new row violates/i.test(
    msg
  );
}

function base64ToUint8Array(base64) {
  const cleaned = String(base64 || '').replace(/[^A-Za-z0-9+/=]/g, '');
  if (!cleaned) throw new Error('Empty base64 video payload');
  if (typeof globalThis.atob !== 'function') {
    throw new Error('atob unavailable for base64 video decode');
  }
  const binary = globalThis.atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Read local recorder URI → Uint8Array (fetch ArrayBuffer, then FileSystem base64).
 */
async function readLocalVideoBytes(fileUri) {
  console.log('[videoUpload] read bytes:', fileUri);

  try {
    const res = await fetch(fileUri);
    if (res.ok) {
      const buffer = await res.arrayBuffer();
      if (buffer && buffer.byteLength >= MIN_VIDEO_BYTES) {
        console.log('[videoUpload] arrayBuffer size=', buffer.byteLength);
        return new Uint8Array(buffer);
      }
      console.warn(
        '[videoUpload] arrayBuffer too small:',
        buffer?.byteLength
      );
    }
  } catch (fetchErr) {
    console.warn(
      '[videoUpload] fetch/arrayBuffer failed:',
      fetchErr?.message || fetchErr
    );
  }

  try {
    const blobRes = await fetch(fileUri);
    if (blobRes.ok) {
      const blob = await blobRes.blob();
      if (blob && blob.size >= MIN_VIDEO_BYTES) {
        const buffer = await blob.arrayBuffer();
        if (buffer?.byteLength >= MIN_VIDEO_BYTES) {
          console.log('[videoUpload] blob→arrayBuffer size=', buffer.byteLength);
          return new Uint8Array(buffer);
        }
      }
    }
  } catch (blobErr) {
    console.warn(
      '[videoUpload] blob path failed:',
      blobErr?.message || blobErr
    );
  }

  const encoding =
    FileSystem.EncodingType?.Base64 ||
    FileSystem.EncodingType?.BASE64 ||
    'base64';
  const base64 = await FileSystem.readAsStringAsync(fileUri, { encoding });
  const bytes = base64ToUint8Array(base64);
  console.log('[videoUpload] base64 size=', bytes.byteLength);
  if (bytes.byteLength < MIN_VIDEO_BYTES) {
    throw new Error(
      `Decoded video too small (${bytes.byteLength} bytes) — refusing upload`
    );
  }
  return bytes;
}

/** Prefer ArrayBuffer body for Supabase JS on Android; Blob as fallback. */
function bytesToUploadBody(bytes, contentType = 'video/mp4') {
  try {
    if (bytes?.buffer instanceof ArrayBuffer) {
      const start = bytes.byteOffset || 0;
      const end = start + bytes.byteLength;
      return bytes.buffer.slice(start, end);
    }
  } catch (_) {
    /* fall through */
  }
  if (typeof Blob !== 'undefined') {
    try {
      return new Blob([bytes], { type: contentType });
    } catch (_) {
      try {
        return new Blob([bytes.buffer], { type: contentType });
      } catch (__) {
        /* fall through */
      }
    }
  }
  return bytes;
}

/** Canonical public HTTPS URL for either bawaal-videos or legacy bawaalvideos. */
function normalizePublicVideoUrl(raw, bucket, filePath) {
  const ensured = ensurePublicBawaalVideoUrl(raw) || raw;
  if (typeof ensured === 'string' && /^https?:\/\//i.test(ensured)) {
    // Fix missing /public/ for the hyphenated bucket too
    if (
      ensured.includes('/storage/v1/object/') &&
      ensured.includes('bawaal-videos') &&
      !ensured.includes('/object/public/bawaal-videos/')
    ) {
      return ensured
        .replace(
          '/storage/v1/object/bawaal-videos/',
          '/storage/v1/object/public/bawaal-videos/'
        )
        .replace(
          '/storage/v1/object/sign/bawaal-videos/',
          '/storage/v1/object/public/bawaal-videos/'
        );
    }
    return ensured;
  }
  try {
    const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
    return (
      ensurePublicBawaalVideoUrl(data?.publicUrl) || data?.publicUrl || null
    );
  } catch (_) {
    return null;
  }
}

/**
 * Ensure the Supabase client has a session so RLS policies that require
 * `authenticated` / `auth.uid()` can succeed. Soft-falls back to anon role.
 */
async function ensureAuthSession() {
  try {
    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();
    if (sessionError) {
      console.warn(
        '[videoUpload] getSession failed:',
        sessionError.message || sessionError
      );
    }
    if (sessionData?.session?.user?.id) {
      console.log(
        `[videoUpload] active session user=${sessionData.session.user.id}`
      );
      return sessionData.session;
    }
  } catch (err) {
    console.warn('[videoUpload] getSession threw:', err?.message || err);
  }

  console.warn(
    '[videoUpload] no active session — attempting anonymous sign-in for RLS'
  );
  try {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) {
      console.warn(
        '[videoUpload] anonymous sign-in failed:',
        error.message || error
      );
      return null;
    }
    if (data?.session?.user?.id) {
      console.log(
        `[videoUpload] anonymous session ready user=${data.session.user.id}`
      );
      return data.session;
    }
  } catch (err) {
    console.warn(
      '[videoUpload] anonymous sign-in threw:',
      err?.message || err
    );
  }
  return null;
}

async function resolveVideosUserId(explicitId, session) {
  const fromExplicit = asUuidOrNull(explicitId);
  if (fromExplicit) return fromExplicit;

  if (explicitId != null && String(explicitId).trim()) {
    console.warn(
      `[videoUpload] userId "${explicitId}" is not a uuid — using session / auth`
    );
  }

  const fromSession = asUuidOrNull(session?.user?.id);
  if (fromSession) return fromSession;

  try {
    const { data } = await supabase.auth.getUser();
    const fromAuth = asUuidOrNull(data?.user?.id);
    if (fromAuth) return fromAuth;
  } catch (_) {
    /* soft-fail */
  }

  return null;
}

async function insertVideosRow(row) {
  let id = row?.id && UUID_RE.test(String(row.id)) ? String(row.id) : null;
  if (!id) {
    try {
      id =
        typeof globalThis.crypto?.randomUUID === 'function'
          ? globalThis.crypto.randomUUID()
          : null;
    } catch (_) {
      id = null;
    }
  }
  if (!id) {
    id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
  const payload = { ...row, id };
  const upsert = await supabase
    .from('videos')
    .upsert([payload], { onConflict: 'id' })
    .select();
  if (!upsert.error) return upsert;
  const msg = String(upsert.error?.message || upsert.error?.code || '');
  if (/23505|duplicate key|videos_pkey/i.test(msg)) {
    return { data: [payload], error: null };
  }
  return upsert;
}

/**
 * Upload a recorded clip to Supabase Storage and insert a `videos` row.
 * Used by VideoPublishModal after SPARKS / challenge capture.
 *
 * Reads local file:// via ArrayBuffer / Blob / FileSystem, then uploads
 * binary to `bawaal-videos` (fallback: `bawaalvideos`, `videos`).
 */
export async function uploadVideoToSupabase(
  videoUri,
  userId,
  sportCategory,
  caption
) {
  const attemptedBuckets = [];

  try {
    if (!videoUri || typeof videoUri !== 'string') {
      return { success: false, error: 'Missing video URI' };
    }

    let cleaned =
      sanitizePlayableFeedUri(videoUri) ||
      sanitizeVideoUriForUpload(videoUri) ||
      String(videoUri).trim();
    if (!cleaned) {
      return { success: false, error: 'Missing or invalid video URI' };
    }
    if (cleaned.startsWith('/') && !cleaned.startsWith('file://')) {
      cleaned = `file://${cleaned}`;
    }

    // Already remote — skip Storage, still upsert videos row when possible
    if (/^https?:\/\//i.test(cleaned)) {
      const publicExisting =
        normalizePublicVideoUrl(cleaned, PRIMARY_VIDEO_BUCKET, '') || cleaned;
      const session = await ensureAuthSession();
      const safeUserId = await resolveVideosUserId(userId, session);
      const baseRow = {
        video_url: publicExisting,
        category: sportCategory || 'OTHERS',
        caption: caption || '',
      };
      const row = safeUserId ? { ...baseRow, user_id: safeUserId } : baseRow;
      const result = await insertVideosRow(row);
      return {
        success: true,
        data: result.data?.[0] || { ...row, video_url: publicExisting },
        url: publicExisting,
        bucket: PRIMARY_VIDEO_BUCKET,
      };
    }

    try {
      const stable = await stabilizeLocalVideoUri(cleaned);
      if (stable) cleaned = stable;
    } catch (stabErr) {
      console.warn(
        '[videoUpload] stabilize failed:',
        stabErr?.message || stabErr
      );
    }

    if (
      Platform.OS === 'android' &&
      !cleaned.startsWith('file://') &&
      !cleaned.startsWith('content://')
    ) {
      cleaned = cleaned.startsWith('/')
        ? `file://${cleaned}`
        : `file:///${cleaned}`;
    }

    const fileExt =
      (cleaned.split('.').pop() || 'mp4').split('?')[0].toLowerCase() || 'mp4';
    const safeUser = String(userId || 'anon').replace(/[^\w-]/g, '_');
    const fileName = `challenge_${Date.now()}_${safeUser}.${fileExt}`;
    const filePath = `battles/${fileName}`;
    const contentType = `video/${fileExt === 'mov' ? 'quicktime' : 'mp4'}`;

    const session = await ensureAuthSession();

    console.log(
      `[videoUpload] targeting Storage bucket "${PRIMARY_VIDEO_BUCKET}" → ${filePath}`
    );

    const bytes = await readLocalVideoBytes(cleaned);
    const body = bytesToUploadBody(bytes, contentType);
    console.log(
      '[videoUpload] upload body type=',
      body?.constructor?.name,
      'bytes=',
      bytes.byteLength
    );

    const bucketsToTry = [
      PRIMARY_VIDEO_BUCKET,
      ...FALLBACK_VIDEO_BUCKETS.filter((b) => b !== PRIMARY_VIDEO_BUCKET),
    ];

    let usedBucket = null;
    let lastStorageError = null;

    for (let i = 0; i < bucketsToTry.length; i += 1) {
      const bucket = bucketsToTry[i];
      attemptedBuckets.push(bucket);
      console.log(`[videoUpload] uploading to bucket "${bucket}"…`);

      const { error: storageError } = await supabase.storage
        .from(bucket)
        .upload(filePath, body, {
          contentType,
          upsert: true,
          cacheControl: '3600',
        });

      if (!storageError) {
        usedBucket = bucket;
        break;
      }

      lastStorageError = storageError;
      console.warn(
        `[videoUpload] upload failed for bucket "${bucket}":`,
        storageError?.message || storageError
      );

      if (!isBucketMissingError(storageError)) {
        throw storageError;
      }

      const next = bucketsToTry[i + 1];
      console.warn(
        `[videoUpload] bucket "${bucket}" missing — ${
          next ? `retrying "${next}"` : BUCKET_SETUP_HINT
        }`
      );
    }

    if (!usedBucket) {
      const detail = lastStorageError?.message || String(lastStorageError);
      console.error(
        `[videoUpload] no usable Storage bucket. Tried: ${attemptedBuckets.join(
          ', '
        )}. ${BUCKET_SETUP_HINT}`
      );
      return {
        success: false,
        error: `Storage bucket not found (tried: ${attemptedBuckets.join(
          ', '
        )}). ${BUCKET_SETUP_HINT} (${detail})`,
      };
    }

    if (usedBucket !== PRIMARY_VIDEO_BUCKET) {
      console.warn(
        `[videoUpload] used fallback bucket "${usedBucket}" — prefer creating "${PRIMARY_VIDEO_BUCKET}"`
      );
    }

    const { data: publicUrlData } = supabase.storage
      .from(usedBucket)
      .getPublicUrl(filePath);

    const videoPublicUrl = normalizePublicVideoUrl(
      publicUrlData?.publicUrl,
      usedBucket,
      filePath
    );
    if (!videoPublicUrl) {
      return { success: false, error: 'Missing public URL after upload' };
    }

    console.log(
      `[videoUpload] public URL ready (bucket="${usedBucket}"):`,
      videoPublicUrl
    );

    let safeUserId = await resolveVideosUserId(userId, session);
    if (
      session?.user?.id &&
      safeUserId &&
      safeUserId !== session.user.id &&
      !asUuidOrNull(userId)
    ) {
      safeUserId = session.user.id;
    }

    const baseRow = {
      video_url: videoPublicUrl,
      category: sportCategory || 'OTHERS',
      caption: caption || '',
    };

    const attempts = [];
    if (safeUserId) {
      attempts.push({ ...baseRow, user_id: safeUserId });
    }
    if (session?.user?.id && session.user.id !== safeUserId) {
      attempts.push({ ...baseRow, user_id: session.user.id });
    }
    attempts.push({ ...baseRow });
    if (!safeUserId && !session?.user?.id) {
      attempts.push({ ...baseRow, user_id: NIL_USER_UUID });
    }

    const seen = new Set();
    const uniqueAttempts = attempts.filter((row) => {
      const key = JSON.stringify(row);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    let dbData = null;
    let dbError = null;

    for (let i = 0; i < uniqueAttempts.length; i += 1) {
      const row = uniqueAttempts[i];
      console.log(
        `[videoUpload] videos insert attempt ${i + 1}/${uniqueAttempts.length}`,
        row.user_id ? `user_id=${row.user_id}` : 'user_id=omitted'
      );
      const result = await insertVideosRow(row);
      dbData = result.data;
      dbError = result.error;
      if (!dbError) break;

      const retryable =
        isRlsError(dbError) ||
        isUserIdConstraintError(dbError) ||
        /42501|23503|22P02/i.test(String(dbError.code || ''));
      console.warn(
        `[videoUpload] videos insert failed:`,
        dbError.message || dbError.code || dbError
      );
      if (!retryable || i === uniqueAttempts.length - 1) break;
      console.warn('[videoUpload] retrying videos insert with alternate payload…');
    }

    if (dbError) {
      // Storage succeeded — still return public URL so Arena can hydrate locally
      console.warn(
        '[videoUpload] DB insert missed; returning Storage public URL for local feed',
        dbError.message || dbError
      );
      return {
        success: true,
        data: {
          id: null,
          video_url: videoPublicUrl,
          category: sportCategory || 'OTHERS',
          caption: caption || '',
        },
        url: videoPublicUrl,
        bucket: usedBucket,
        dbWarning: isRlsError(dbError)
          ? `${dbError.message || 'RLS policy blocked insert'}. ${RLS_SETUP_HINT}`
          : dbError.message || String(dbError),
      };
    }

    return {
      success: true,
      data: dbData?.[0] || null,
      url: videoPublicUrl,
      bucket: usedBucket,
    };
  } catch (error) {
    console.error(
      `[videoUpload] Error uploading video (buckets tried: ${
        attemptedBuckets.join(', ') || PRIMARY_VIDEO_BUCKET
      }):`,
      error?.message || error
    );
    const msg = error?.message || String(error);
    if (isRlsError(error)) {
      return { success: false, error: `${msg}. ${RLS_SETUP_HINT}` };
    }
    return { success: false, error: msg };
  }
}
