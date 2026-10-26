/**
 * Device gallery helpers for BAWAAL clips (expo-media-library).
 */
import { Alert } from 'react-native';
import {
  createAssetAsync,
  deleteAssetsAsync,
  getPermissionsAsync,
  requestPermissionsAsync,
} from 'expo-media-library/legacy';

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
    const assetId =
      (asset && (asset.id || asset.assetId || asset.uri)) || undefined;
    console.log('[galleryMedia] saved asset:', assetId);
    return { ok: true, assetId: assetId ? String(assetId) : undefined };
  } catch (err) {
    const msg = err?.message || String(err);
    console.warn('[galleryMedia] save failed:', msg);
    return { ok: false, error: msg };
  }
}

/**
 * Delete one or more gallery assets by id.
 * @param {string|string[]} assetIds
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function deleteGalleryAssets(assetIds) {
  const ids = (Array.isArray(assetIds) ? assetIds : [assetIds])
    .map((id) => (id == null ? '' : String(id).trim()))
    .filter(Boolean);

  if (ids.length === 0) {
    return { ok: false, error: 'missing-asset-id' };
  }

  try {
    const granted = await ensureGalleryWritePermission();
    if (!granted) {
      return { ok: false, error: 'permission-denied' };
    }
    await deleteAssetsAsync(ids);
    console.log('[galleryMedia] deleted assets:', ids);
    return { ok: true };
  } catch (err) {
    const msg = err?.message || String(err);
    console.warn('[galleryMedia] delete failed:', msg);
    return { ok: false, error: msg };
  }
}

/**
 * Confirm with the user, then delete. Resolves true when deleted.
 * @param {string} assetId
 * @param {{ title?: string, message?: string }} [copy]
 * @returns {Promise<boolean>}
 */
export function confirmAndDeleteGalleryAsset(assetId, copy = {}) {
  return new Promise((resolve) => {
    if (!assetId) {
      Alert.alert('Nothing to delete', 'No gallery clip is linked to this video.');
      resolve(false);
      return;
    }

    Alert.alert(
      copy.title || 'Delete from gallery?',
      copy.message ||
        'This permanently removes the clip from your phone gallery. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              const res = await deleteGalleryAssets(assetId);
              if (!res.ok) {
                Alert.alert(
                  'Delete failed',
                  res.error === 'permission-denied'
                    ? 'Gallery permission is required to delete clips.'
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
