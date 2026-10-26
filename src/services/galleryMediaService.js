/**
 * Device gallery helpers for BAWAAL clips (expo-media-library).
 * READ permission is required before getAssetsAsync; WRITE for save/delete.
 */
import { Alert, Linking, Platform } from 'react-native';
import {
  createAssetAsync,
  deleteAssetsAsync,
  getAssetsAsync,
  getPermissionsAsync,
  MediaType,
  requestPermissionsAsync,
  SortBy,
} from 'expo-media-library/legacy';

/** Android 13+ granular scopes for video library access. */
const VIDEO_GRANULAR = ['video'];

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

function isGranted(perm) {
  if (!perm) return false;
  if (perm.status === 'granted') return true;
  // iOS limited library still allows listing granted assets
  if (perm.accessPrivileges === 'limited' || perm.accessPrivileges === 'all') {
    return true;
  }
  return false;
}

/**
 * READ access — required before getAssetsAsync.
 * IMPORTANT: writeOnly must be false (true only grants save, not list).
 * @returns {Promise<{ granted: boolean, canAskAgain?: boolean, status?: string }>}
 */
export async function ensureGalleryReadPermission() {
  try {
    const current = await getPermissionsAsync(
      false,
      Platform.OS === 'android' ? VIDEO_GRANULAR : undefined
    );
    if (isGranted(current)) {
      return { granted: true, status: current.status, canAskAgain: current.canAskAgain };
    }

    const asked = await requestPermissionsAsync(
      false,
      Platform.OS === 'android' ? VIDEO_GRANULAR : undefined
    );
    return {
      granted: isGranted(asked),
      status: asked.status,
      canAskAgain: asked.canAskAgain,
    };
  } catch (err) {
    console.warn(
      '[galleryMedia] read permission failed:',
      err?.message || err
    );
    return { granted: false, status: 'undetermined', canAskAgain: true };
  }
}

/**
 * WRITE access — save / delete assets.
 * @returns {Promise<boolean>}
 */
export async function ensureGalleryWritePermission() {
  try {
    // Need full library access for delete on Android 13+
    const read = await ensureGalleryReadPermission();
    if (!read.granted) return false;

    const current = await getPermissionsAsync(
      true,
      Platform.OS === 'android' ? VIDEO_GRANULAR : undefined
    );
    if (isGranted(current)) return true;

    const asked = await requestPermissionsAsync(
      true,
      Platform.OS === 'android' ? VIDEO_GRANULAR : undefined
    );
    return isGranted(asked);
  } catch (err) {
    console.warn(
      '[galleryMedia] write permission failed:',
      err?.message || err
    );
    return false;
  }
}

/**
 * List device videos for the in-app gallery picker.
 * Always awaits READ permission before getAssetsAsync.
 * @param {{ first?: number, after?: string }} [opts]
 * @returns {Promise<{ ok: boolean, assets: object[], endCursor?: string, hasNextPage?: boolean, error?: string, canAskAgain?: boolean }>}
 */
export async function listDeviceVideos(opts = {}) {
  const first = Math.max(1, Math.min(100, Number(opts.first) || 48));
  try {
    const perm = await ensureGalleryReadPermission();
    if (!perm.granted) {
      return {
        ok: false,
        assets: [],
        error: 'permission-denied',
        canAskAgain: perm.canAskAgain !== false,
      };
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
    const missingPerm = /MEDIA_LIBRARY|permission|denied|Missing/i.test(msg);
    return {
      ok: false,
      assets: [],
      error: missingPerm ? 'permission-denied' : msg,
      canAskAgain: true,
    };
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
    console.log('[galleryMedia] deleting selected assets only:', ids);
    // Exact selection only — never album-wide / never unselected ids
    await deleteAssetsAsync(ids);
    console.log('[galleryMedia] deleted selected assets ok:', ids.length);
    return { ok: true, deletedIds: ids };
  } catch (batchErr) {
    // Fallback: delete each selected id alone (still never touches others)
    try {
      console.warn(
        '[galleryMedia] batch delete failed, deleting one-by-one:',
        batchErr?.message || batchErr
      );
      for (const id of ids) {
        await deleteAssetsAsync([id]);
      }
      return { ok: true, deletedIds: ids };
    } catch (err) {
      const msg = err?.message || String(err);
      console.warn('[galleryMedia] multi-delete failed:', msg);
      return { ok: false, error: msg };
    }
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
 * @returns {Promise<boolean>}
 */
export function confirmAndDeleteGalleryAsset(assetId) {
  const id = normalizeMediaLibraryAssetId(assetId);
  if (!id) {
    Alert.alert(
      'Nothing to delete',
      'This clip is not linked to a single gallery asset id.'
    );
    return Promise.resolve(false);
  }
  return confirmAndDeleteSelectedGalleryAssets([id]);
}

/** Open system settings when the user permanently denied gallery access. */
export function openGallerySettings() {
  return Linking.openSettings().catch(() => {});
}
