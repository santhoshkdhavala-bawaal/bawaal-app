/**
 * Device gallery helpers for BAWAAL clips (expo-media-library).
 * Delete always targets ONE MediaLibrary asset id — never a file/content URI.
 */
import { Alert } from 'react-native';
import {
  createAssetAsync,
  deleteAssetsAsync,
  getPermissionsAsync,
  requestPermissionsAsync,
} from 'expo-media-library/legacy';

/**
 * MediaLibrary asset ids only — reject file:// / content:// / paths.
 * Passing a URI to deleteAssetsAsync can mis-target or wipe unexpected items.
 * @param {unknown} value
 * @returns {string|null}
 */
export function normalizeMediaLibraryAssetId(value) {
  if (value == null) return null;
  const id = String(value).trim();
  if (!id) return null;
  if (
    /^(file|content|ph|assets-library|http|https):/i.test(id) ||
    id.startsWith('/') ||
    id.includes('://')
  ) {
    console.warn(
      '[galleryMedia] rejected non-asset id (looks like a URI/path):',
      id.slice(0, 80)
    );
    return null;
  }
  return id;
}

/**
 * Ensure write access to the media library.
 * @returns {Promise<boolean>}
 */
export async function ensureGalleryWritePermission() {
  try {
    const current = await getPermissionsAsync(true);
    if (current.status === 'granted') return true;
    const asked = await requestPermissionsAsync(true);
    return asked.status === 'granted';
  } catch (err) {
    console.warn(
      '[galleryMedia] permission check failed:',
      err?.message || err
    );
    return false;
  }
}

/**
 * Save a local video URI into the Camera Roll / Gallery.
 * @param {string} videoUri
 * @returns {Promise<{ ok: boolean, assetId?: string, error?: string }>}
 */
export async function saveVideoToGallery(videoUri) {
  if (!videoUri || typeof videoUri !== 'string') {
    return { ok: false, error: 'missing-uri' };
  }
  try {
    const granted = await ensureGalleryWritePermission();
    if (!granted) {
      return { ok: false, error: 'permission-denied' };
    }
    const asset = await createAssetAsync(videoUri);
    // ONLY MediaLibrary `id` — never fall back to uri (breaks precise delete)
    const assetId = normalizeMediaLibraryAssetId(asset?.id);
    console.log('[galleryMedia] saved asset id:', assetId || '(none)');
    return {
      ok: true,
      assetId: assetId || undefined,
    };
  } catch (err) {
    const msg = err?.message || String(err);
    console.warn('[galleryMedia] save failed:', msg);
    return { ok: false, error: msg };
  }
}

/**
 * Delete exactly one gallery asset by MediaLibrary id.
 * @param {string} assetId
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function deleteGalleryAsset(assetId) {
  const id = normalizeMediaLibraryAssetId(assetId);
  if (!id) {
    return { ok: false, error: 'invalid-asset-id' };
  }

  try {
    const granted = await ensureGalleryWritePermission();
    if (!granted) {
      return { ok: false, error: 'permission-denied' };
    }
    // Strict single-id array — never batch / never URI
    console.log('[galleryMedia] deleting single asset:', id);
    await deleteAssetsAsync([id]);
    console.log('[galleryMedia] deleted single asset ok:', id);
    return { ok: true };
  } catch (err) {
    const msg = err?.message || String(err);
    console.warn('[galleryMedia] delete failed:', msg);
    return { ok: false, error: msg };
  }
}

/** @deprecated Use deleteGalleryAsset — kept for callers that pass one id */
export async function deleteGalleryAssets(assetIds) {
  const first = Array.isArray(assetIds) ? assetIds[0] : assetIds;
  return deleteGalleryAsset(first);
}

/**
 * Confirm with the user, then delete ONLY that one clip.
 * @param {string} assetId
 * @param {{ title?: string, message?: string }} [copy]
 * @returns {Promise<boolean>}
 */
export function confirmAndDeleteGalleryAsset(assetId, copy = {}) {
  return new Promise((resolve) => {
    const id = normalizeMediaLibraryAssetId(assetId);
    if (!id) {
      Alert.alert(
        'Nothing to delete',
        'This clip is not linked to a single gallery asset id.'
      );
      resolve(false);
      return;
    }

    Alert.alert(
      copy.title || 'Delete this clip?',
      copy.message ||
        'Only this selected video will be removed from your phone gallery. Other clips stay untouched.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              const res = await deleteGalleryAsset(id);
              if (!res.ok) {
                Alert.alert(
                  'Delete failed',
                  res.error === 'permission-denied'
                    ? 'Gallery permission is required to delete clips.'
                    : res.error === 'invalid-asset-id'
                      ? 'Could not identify this single clip to delete.'
                      : res.error || 'Could not delete this clip.'
                );
                resolve(false);
                return;
              }
              resolve(true);
            })();
          },
        },
      ]
    );
  });
}
