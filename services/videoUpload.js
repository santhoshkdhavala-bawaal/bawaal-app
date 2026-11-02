import { supabase, BAWAAL_VIDEOS_BUCKET } from '../lib/supabase';

/**
 * Upload a recorded clip to Supabase Storage and insert a `videos` row.
 * Used by VideoPublishModal after SPARKS / challenge capture.
 */
export async function uploadVideoToSupabase(
  videoUri,
  userId,
  sportCategory,
  caption
) {
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
    const bucket = BAWAAL_VIDEOS_BUCKET || 'bawaal-videos';

    const response = await fetch(cleaned);
    const blob = await response.blob();

    const { error: storageError } = await supabase.storage
      .from(bucket)
      .upload(filePath, blob, {
        contentType: `video/${fileExt === 'mov' ? 'quicktime' : fileExt}`,
        upsert: false,
      });

    if (storageError) throw storageError;

    const { data: publicUrlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    const videoPublicUrl = publicUrlData?.publicUrl;
    if (!videoPublicUrl) {
      return { success: false, error: 'Missing public URL after upload' };
    }

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
    };
  } catch (error) {
    console.error('Error uploading video:', error?.message || error);
    return { success: false, error: error?.message || String(error) };
  }
}
