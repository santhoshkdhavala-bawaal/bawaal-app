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

function asUuidOrNull(value) {
  if (value == null) return null;
  const s = String(value).trim();
  return UUID_RE.test(s) ? s : null;
}

/**
 * Resolve a PostgreSQL-safe uuid for `videos.user_id`.
 * Handles local handles like "user-santhosh" that are not valid uuids.
 */
async function resolveVideosUserId(explicitId) {
  const fromExplicit = asUuidOrNull(explicitId);
  if (fromExplicit) return fromExplicit;

  if (explicitId != null && String(explicitId).trim()) {
    console.warn(
      `[videoUpload] userId "${explicitId}" is not a uuid — resolving auth session / fallback`
    );
  }

  try {
    const { data } = await supabase.auth.getUser();
    const fromAuth = asUuidOrNull(data?.user?.id);
    if (fromAuth) return fromAuth;
  } catch (_) {
    /* soft-fail */
  }

  // Prefer omitting FK over inventing a random id; nil uuid is last-resort type-safe value.
  // Callers that need a non-null column can still read NIL_USER_UUID from logs.
  return null;
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
    const safeUserId = await resolveVideosUserId(userId);
    const row = {
      video_url: videoPublicUrl,
      category: sportCategory || 'OTHERS',
      caption: caption || '',
    };
    if (safeUserId) {
      row.user_id = safeUserId;
    } else {
      console.warn(
        `[videoUpload] omitting user_id (no valid uuid; raw="${userId ?? ''}"; nil fallback ${NIL_USER_UUID} unused to avoid FK miss)`
      );
    }

    let { data: dbData, error: dbError } = await supabase
      .from('videos')
      .insert([row])
      .select();

    // FK / uuid constraint → retry without user_id
    if (dbError && row.user_id && isUserIdConstraintError(dbError)) {
      console.warn(
        `[videoUpload] videos insert user_id rejected (${dbError.message}) — retrying without user_id`
      );
      const { user_id: _omit, ...withoutUser } = row;
      ({ data: dbData, error: dbError } = await supabase
        .from('videos')
        .insert([withoutUser])
        .select());
    }

    if (dbError) throw dbError;

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
    return { success: false, error: error?.message || String(error) };
  }
}
