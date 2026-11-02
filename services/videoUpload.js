import { supabase, BAWAAL_VIDEOS_BUCKET } from '../lib/supabase';

/** Canonical Storage bucket (matches supabase_schema.sql). */
const PRIMARY_VIDEO_BUCKET = BAWAAL_VIDEOS_BUCKET || 'bawaal-videos';
/** Legacy Expo uploads still use this name — keep as soft fallback. */
const LEGACY_VIDEO_BUCKET = 'bawaalvideos';

const BUCKET_SETUP_HINT =
  'Create a public Storage bucket named "bawaal-videos" in the Supabase dashboard ' +
  '(Storage → New bucket → public), or run supabase_schema.sql in the SQL Editor.';

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

/**
 * Upload a recorded clip to Supabase Storage and insert a `videos` row.
 * Used by VideoPublishModal after SPARKS / challenge capture.
 *
 * Storage bucket: `bawaal-videos` (fallback: `bawaalvideos`).
 * DB table: `videos` (separate from the Storage bucket name).
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

    const bucketsToTry = [PRIMARY_VIDEO_BUCKET];
    if (LEGACY_VIDEO_BUCKET !== PRIMARY_VIDEO_BUCKET) {
      bucketsToTry.push(LEGACY_VIDEO_BUCKET);
    }

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
        // Non-missing errors (RLS, mime, size) — do not silently hop buckets.
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
        `[videoUpload] used legacy bucket "${usedBucket}" — prefer creating "${PRIMARY_VIDEO_BUCKET}"`
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

    const { data: dbData, error: dbError } = await supabase
      .from('videos')
      .insert([
        {
          user_id: userId || null,
          video_url: videoPublicUrl,
          category: sportCategory || 'OTHERS',
          caption: caption || '',
        },
      ])
      .select();

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
