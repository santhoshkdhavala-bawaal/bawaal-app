/**
 * Device gallery helpers for BAWAAL clips (expo-media-library).
 * Delete always uses MediaLibrary asset ids — never file:// / content:// URIs.
 */
import { Alert } from 'react-native';
import {
  createAssetAsync,
  deleteAssetsAsync,
  getAssetsAsync,
  getPermissionsAsync,
  MediaType,
  requestPermissionsAsync,
  SortBy,
} from 'expo-media-library/legacy';

/**
 * MediaLibrary asset ids only — reject file:// / content:// / paths.
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
 * List device videos for the in-app gallery picker.
 * @param {{ first?: number, after?: string }} [opts]
 * @returns {Promise<{ ok: boolean, assets: object[], endCursor?: string, hasNextPage?: boolean, error?: string }>}
 */
export async function listDeviceVideos(opts = {}) {
  const first = Math.max(1, Math.min(100, Number(opts.first) || 48));
  try {
    const granted = await ensureGalleryWritePermission();
    if (!granted) {
      return { ok: false, assets: [], error: 'permission-denied' };
    }

    const page = await getAssetsAsync({
      first,
      after: opts.after || undefined,
      mediaType: [MediaType.video],
      sortBy: [[SortBy.creationTime, false]],
    });

    const assets = (page?.assets || [])
      .map((a) => {
        const id = normalizeMediaLibraryAssetId(a?.id);
        if (!id) return null;
        return {
          id,
          uri: typeof a.uri === 'string' ? a.uri : '',
          filename: a.filename || 'video.mp4',
          duration: typeof a.duration === 'number' ? a.duration : 0,
          width: a.width || 0,
          height: a.height || 0,
          creationTime: a.creationTime || 0,
          mediaType: a.mediaType,
        };
      })
      .filter(Boolean);

    return {
      ok: true,
      assets,
      endCursor: page?.endCursor,
      hasNextPage: !!page?.hasNextPage,
    };
  } catch (err) {
    const msg = err?.message || String(err);
    console.warn('[galleryMedia] listDeviceVideos failed:', msg);
    return { ok: false, assets: [], error: msg };
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
 * Delete exactly the given MediaLibrary asset ids (one or many).
 * Never expands beyond the provided selection.
 * @param {string|string[]} assetIds
 * @returns {Promise<{ ok: boolean, deletedIds?: string[], error?: string }>}
 */
export async function deleteGalleryAssetsByIds(assetIds) {
  const ids = [
    ...new Set(
      (Array.isArray(assetIds) ? assetIds : [assetIds])
        .map((id) => normalizeMediaLibraryAssetId(id))
        .filter(Boolean)
    ),
  ];

  if (ids.length === 0) {
    return { ok: false, error: 'missing-asset-id' };
  }

  try {
    const granted = await ensureGalleryWritePermission();
    if (!granted) {
      return { ok: false, error: 'permission-denied' };
    }
    console.log('[galleryMedia] deleting selected assets:', ids);
    await deleteAssetsAsync(ids);
    console.log('[galleryMedia] deleted selected assets ok:', ids.length);
    return { ok: true, deletedIds: ids };
  } catch (err) {
    const msg = err?.message || String(err);
    console.warn('[galleryMedia] multi-delete failed:', msg);
    return { ok: false, error: msg };
  }
}

/**
 * Delete exactly one gallery asset by MediaLibrary id.
 * @param {string} assetId
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function deleteGalleryAsset(assetId) {
  return deleteGalleryAssetsByIds([assetId]);
}

/** @deprecated Prefer deleteGalleryAssetsByIds */
export async function deleteGalleryAssets(assetIds) {
  return deleteGalleryAssetsByIds(assetIds);
}

/**
 * Confirm, then delete ONLY the provided selected ids.
 * @param {string[]} assetIds
 * @returns {Promise<boolean>}
 */
export function confirmAndDeleteSelectedGalleryAssets(assetIds) {
  return new Promise((resolve) => {
    const ids = [
      ...new Set(
        (Array.isArray(assetIds) ? assetIds : [])
          .map((id) => normalizeMediaLibraryAssetId(id))
          .filter(Boolean)
      ),
    ];

    if (ids.length === 0) {
      Alert.alert('Nothing selected', 'Select one or more videos to delete.');
      resolve(false);
      return;
    }

    Alert.alert(
      ids.length === 1 ? 'Delete this clip?' : `Delete ${ids.length} clips?`,
      'Only the videos you checked will be removed from your phone gallery. Everything else stays untouched.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              const res = await deleteGalleryAssetsByIds(ids);
              if (!res.ok) {
                Alert.alert(
                  'Delete failed',
                  res.error === 'permission-denied'
                    ? 'Gallery permission is required to delete clips.'
                    : res.error || 'Could not delete the selected clips.'
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
                    : res.error === 'invalid-asset-id' ||
                        res.error === 'missing-asset-id'
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
