/**
 * In-app device gallery — checkbox multi-select + delete only selected clips.
 * Also supports picking one video to import into the creation flow.
 */
import React, { memo, useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  confirmAndDeleteSelectedGalleryAssets,
  ensureGalleryReadPermission,
  listDeviceVideos,
  openGallerySettings,
} from '../services/galleryMediaService';

export type DeviceGalleryAsset = {
  id: string;
  uri: string;
  filename: string;
  duration: number;
  width: number;
  height: number;
  creationTime: number;
};

type DeviceGalleryModalProps = {
  visible: boolean;
  onClose: () => void;
  /** Import a single video into the camera → post flow */
  onPickVideo?: (asset: DeviceGalleryAsset) => void;
};

function formatDuration(sec: number) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

function DeviceGalleryModal({
  visible,
  onClose,
  onPickVideo,
}: DeviceGalleryModalProps) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [assets, setAssets] = useState<DeviceGalleryAsset[]>([]);
  const [endCursor, setEndCursor] = useState<string | undefined>();
  const [hasNextPage, setHasNextPage] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [needsPermission, setNeedsPermission] = useState(false);
  const [canAskAgain, setCanAskAgain] = useState(true);

  const selectedCount = selectedIds.size;

  const loadPage = useCallback(
    async (opts?: { reset?: boolean; cursor?: string }) => {
      const reset = !!opts?.reset;
      if (reset) {
        setLoading(true);
        setSelectedIds(new Set());
      } else setRefreshing(true);
      setError('');
      setNeedsPermission(false);
      try {
        // Explicit await BEFORE getAssetsAsync (Android rejects otherwise)
        const perm = await ensureGalleryReadPermission();
        if (!perm.granted) {
          setNeedsPermission(true);
          setCanAskAgain(perm.canAskAgain !== false);
          setError('Gallery permission is required to browse your videos.');
          if (reset) setAssets([]);
          return;
        }

        const res = await listDeviceVideos({
          first: 24,
          after: opts?.cursor,
        });
        if (!res.ok) {
          const denied = res.error === 'permission-denied';
          setNeedsPermission(denied);
          setCanAskAgain(res.canAskAgain !== false);
          setError(
            denied
              ? 'Gallery permission is required to browse your videos.'
              : res.error || 'Could not load gallery.'
          );
          if (reset) setAssets([]);
          return;
        }
        const pageAssets = res.assets as DeviceGalleryAsset[];
        setAssets((prev) =>
          reset ? pageAssets : [...prev, ...pageAssets]
        );
        setEndCursor(res.endCursor);
        setHasNextPage(!!res.hasNextPage);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleDeleteSelected = useCallback(async () => {
    if (selectedIds.size === 0 || deleting) return;
    setDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      const ok = await confirmAndDeleteSelectedGalleryAssets(ids);
      if (!ok) return;
      setSelectedIds(new Set());
      await loadPage({ reset: true });
    } finally {
      setDeleting(false);
    }
  }, [selectedIds, deleting, loadPage]);

  const handleUseSelected = useCallback(() => {
    if (!onPickVideo || selectedIds.size === 0) return;
    const id = Array.from(selectedIds)[0];
    const asset = assets.find((a) => a.id === id);
    if (!asset) return;
    onPickVideo(asset);
    onClose();
  }, [onPickVideo, selectedIds, assets, onClose]);

  const headerTitle = useMemo(() => {
    if (selectedCount > 0) return `${selectedCount} selected`;
    return 'Device gallery';
  }, [selectedCount]);

  const renderItem = useCallback(
    ({ item }: { item: DeviceGalleryAsset }) => {
      const selected = selectedIds.has(item.id);
      return (
        <Pressable
          style={styles.cell}
          onPress={() => toggleSelect(item.id)}
          onLongPress={() => {
            if (onPickVideo) {
              onPickVideo(item);
              onClose();
            }
          }}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: selected }}
          accessibilityLabel={item.filename}
        >
          {item.uri ? (
            <Image
              source={{ uri: item.uri }}
              style={styles.thumb}
              resizeMode="cover"
              fadeDuration={0}
            />
          ) : (
            <View style={[styles.thumb, styles.thumbFallback]}>
              <Text style={styles.thumbFallbackText}>🎬</Text>
            </View>
          )}
          <View style={styles.durationPill}>
            <Text style={styles.durationText}>
              {formatDuration(item.duration)}
            </Text>
          </View>
          <View
            style={[styles.checkbox, selected && styles.checkboxOn]}
          >
            {selected ? <Text style={styles.checkMark}>✓</Text> : null}
          </View>
          <Text style={styles.fileName} numberOfLines={1}>
            {item.filename}
          </Text>
        </Pressable>
      );
    },
    [selectedIds, toggleSelect, onPickVideo, onClose]
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      onShow={() => {
        void loadPage({ reset: true });
      }}
      presentationStyle="fullScreen"
    >
      <View
        style={[
          styles.root,
          {
            paddingTop: Math.max(insets.top, 12),
            paddingBottom: Math.max(insets.bottom, 12),
          },
        ]}
      >
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12} style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>Close</Text>
          </Pressable>
          <Text style={styles.headerTitle}>{headerTitle}</Text>
          <Pressable
            onPress={clearSelection}
            hitSlop={12}
            style={styles.headerBtn}
            disabled={selectedCount === 0}
          >
            <Text
              style={[
                styles.headerBtnText,
                selectedCount === 0 && styles.headerBtnMuted,
              ]}
            >
              Clear
            </Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color="#FFFFFF" size="large" />
            <Text style={styles.hint}>Loading videos…</Text>
          </View>
        ) : error || needsPermission ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>
              {error || 'Gallery permission is required.'}
            </Text>
            <Pressable
              style={styles.retryBtn}
              onPress={() => {
                if (needsPermission && canAskAgain === false) {
                  void openGallerySettings();
                  return;
                }
                void loadPage({ reset: true });
              }}
            >
              <Text style={styles.retryText}>
                {needsPermission
                  ? canAskAgain === false
                    ? 'Open Settings'
                    : 'Allow gallery access'
                  : 'Retry'}
              </Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={assets}
            keyExtractor={(item) => item.id}
            numColumns={3}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            refreshing={refreshing}
            onRefresh={() => void loadPage({ reset: true })}
            onEndReached={() => {
              if (hasNextPage && endCursor && !loading && !refreshing) {
                void loadPage({ cursor: endCursor });
              }
            }}
            onEndReachedThreshold={0.6}
            initialNumToRender={12}
            maxToRenderPerBatch={9}
            windowSize={5}
            removeClippedSubviews
            updateCellsBatchingPeriod={40}
            ListEmptyComponent={
              <Text style={styles.empty}>No videos found on this device.</Text>
            }
          />
        )}

        <View style={styles.footer}>
          <Pressable
            style={[
              styles.deleteBtn,
              (selectedCount === 0 || deleting) && styles.btnDisabled,
            ]}
            disabled={selectedCount === 0 || deleting}
            onPress={() => {
              void handleDeleteSelected();
            }}
          >
            {deleting ? (
              <ActivityIndicator color="#FF8A80" />
            ) : (
              <Text style={styles.deleteBtnText}>
                🗑️ Delete selected
                {selectedCount > 0 ? ` (${selectedCount})` : ''}
              </Text>
            )}
          </Pressable>

          {onPickVideo ? (
            <Pressable
              style={[
                styles.useBtn,
                selectedCount === 0 && styles.btnDisabled,
              ]}
              disabled={selectedCount === 0}
              onPress={handleUseSelected}
            >
              <Text style={styles.useBtnText}>
                Use for post
                {selectedCount > 1 ? ' (first)' : ''}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.18)',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  headerBtn: {
    minWidth: 56,
  },
  headerBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  headerBtnMuted: {
    opacity: 0.35,
  },
  list: {
    padding: 6,
    paddingBottom: 24,
  },
  cell: {
    flex: 1 / 3,
    aspectRatio: 0.72,
    margin: 4,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#151515',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  thumb: {
    width: '100%',
    flex: 1,
    backgroundColor: '#222',
  },
  thumbFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbFallbackText: {
    fontSize: 22,
  },
  durationPill: {
    position: 'absolute',
    left: 6,
    bottom: 28,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  durationText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
  checkbox: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  checkMark: {
    color: '#000',
    fontSize: 13,
    fontWeight: '900',
  },
  fileName: {
    color: '#A3A3A3',
    fontSize: 10,
    paddingHorizontal: 6,
    paddingVertical: 5,
  },
  footer: {
    paddingHorizontal: 14,
    paddingTop: 10,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.18)',
  },
  deleteBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,138,128,0.7)',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  deleteBtnText: {
    color: '#FF8A80',
    fontWeight: '800',
    fontSize: 13,
  },
  useBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  useBtnText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 13,
  },
  btnDisabled: {
    opacity: 0.35,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  hint: {
    color: '#A3A3A3',
    fontSize: 13,
  },
  errorText: {
    color: '#FF8A80',
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '700',
  },
  retryBtn: {
    borderColor: '#FFF',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  retryText: {
    color: '#FFF',
    fontWeight: '800',
  },
  empty: {
    color: '#737373',
    textAlign: 'center',
    marginTop: 48,
    fontSize: 13,
  },
});

export default memo(DeviceGalleryModal);
