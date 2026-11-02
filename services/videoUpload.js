import { supabase, BAWAAL_VIDEOS_BUCKET } from '../lib/supabase';

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

/**
 * Resolve a PostgreSQL-safe uuid for `videos.user_id`.
 * Prefer explicit uuid → session/auth uuid. Never pass handles like "user-santhosh".
 */
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
  // Prefer upsert with a uuid id so re-publish / double-persist never hits videos_pkey
  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
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
  // Duplicate key → treat as soft success (idempotent publish)
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
 * Storage bucket: `bawaal-videos` (fallback: `bawaalvideos`, `videos`).
 * DB table columns: user_id (uuid), video_url, caption, category.
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

    const cleaned = videoUri.trim();
    const fileExt =
      (cleaned.split('.').pop() || 'mp4').split('?')[0].toLowerCase() || 'mp4';
    const safeUser = String(userId || 'anon').replace(/[^\w-]/g, '_');
    const fileName = `${safeUser}_${Date.now()}.${fileExt}`;
    const filePath = `battles/${fileName}`;
    const contentType = `video/${fileExt === 'mov' ? 'quicktime' : fileExt}`;

    // Auth first — Storage + videos RLS often require authenticated / auth.uid()
    const session = await ensureAuthSession();

    console.log(
      `[videoUpload] targeting Storage bucket "${PRIMARY_VIDEO_BUCKET}" → ${filePath}`
    );

    const response = await fetch(cleaned);
    const blob = await response.blob();

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
        .upload(filePath, blob, {
          contentType,
          upsert: false,
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

    const videoPublicUrl = publicUrlData?.publicUrl;
    if (!videoPublicUrl) {
      return { success: false, error: 'Missing public URL after upload' };
    }

    console.log(
      `[videoUpload] public URL ready (bucket="${usedBucket}"):`,
      videoPublicUrl
    );

    // Schema: user_id uuid, video_url text, caption text, category text
    let safeUserId = await resolveVideosUserId(userId, session);
    // RLS policies that require auth.uid() = user_id need the session uuid.
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
    // Match owner-scoped RLS: force auth.uid() when we have a session
    if (session?.user?.id && session.user.id !== safeUserId) {
      attempts.push({ ...baseRow, user_id: session.user.id });
    }
    // Open anon policy / nullable user_id
    attempts.push({ ...baseRow });
    // Last-resort type-safe dummy (only if open policies allow any uuid)
    if (!safeUserId && !session?.user?.id) {
      attempts.push({ ...baseRow, user_id: NIL_USER_UUID });
    }

    // Deduplicate by JSON shape
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
      if (isRlsError(dbError)) {
        console.error(`[videoUpload] ${RLS_SETUP_HINT}`);
        return {
          success: false,
          error: `${dbError.message || 'RLS policy blocked insert'}. ${RLS_SETUP_HINT}`,
        };
      }
      throw dbError;
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
