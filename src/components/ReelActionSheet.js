/**
 * Instagram-style reel action sheet
 * (DM / Like / Follow·Unfollow / Share / Repost / Tag / Banter).
 * Follow lives only here — never as a canvas overlay CTA.
 */
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  TouchableOpacity,
  Platform,
  Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  isFollowingReelOwner,
  setFollowingReelOwner,
} from '../services/reelSocialService';

const WHITE = '#FFFFFF';
const BG = '#0A0A0A';
const SURFACE = '#121212';
const MUTED = '#A9A9A9';
const ACCENT = '#FF5A00';
const HAIRLINE = 'rgba(255,255,255,0.12)';

const BASE_ACTIONS = [
  { id: 'dm', label: 'DM' },
  { id: 'banner_like', label: 'Like' },
  { id: 'follow', label: 'Follow' },
  { id: 'share', label: 'Share' },
  { id: 'repost', label: 'Repost' },
  { id: 'tag', label: 'Tag' },
  { id: 'banter', label: 'Banter' },
];

function followTargetKey(reel) {
  return String(
    reel?.user_id ||
      reel?.userId ||
      reel?.hostId ||
      reel?.author ||
      reel?.handle ||
      reel?.id ||
      ''
  ).trim();
}

async function shareReel(reel) {
  const postId = reel?.id != null ? String(reel.id) : '';
  const handle = String(reel?.author || reel?.handle || 'athlete').replace(/^@/, '');
  try {
    await Share.share({
      title: 'BAWAAL Arena',
      message: postId
        ? `Check @${handle} on BAWAAL: https://bawaal.app/reel/${postId}`
        : `Check @${handle} on BAWAAL`,
    });
  } catch (err) {
    console.warn('[ReelActionSheet] share failed:', err?.message || err);
  }
}

function ReelActionSheet({ visible, reel, onClose, onAction }) {
  const insets = useSafeAreaInsets();
  const targetKey = followTargetKey(reel);
  const [following, setFollowing] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!visible || !targetKey) {
      setFollowing(false);
      return undefined;
    }
    void isFollowingReelOwner(targetKey).then((on) => {
      if (alive) setFollowing(!!on);
    });
    return () => {
      alive = false;
    };
  }, [visible, targetKey]);

  const actions = useMemo(
    () =>
      BASE_ACTIONS.map((action) =>
        action.id === 'follow'
          ? { ...action, label: following ? 'Unfollow' : 'Follow' }
          : action
      ),
    [following]
  );

  const run = useCallback(
    async (actionId) => {
      let resolvedId = actionId;
      if (actionId === 'follow') {
        const next = !following;
        setFollowing(next);
        resolvedId = next ? 'follow' : 'unfollow';
        void setFollowingReelOwner(targetKey, next).catch(() => {});
      }
      if (resolvedId === 'share') {
        await shareReel(reel);
      }
      try {
        onAction?.(resolvedId, reel);
      } catch (_) {
        /* ignore */
      }
      onClose?.();
    },
    [following, onAction, onClose, reel, targetKey]
  );

  return (
    <Modal
      visible={!!visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, 14) },
          ]}
        >
          <View style={styles.handle} />
          <Text style={styles.title}>ACTIONS</Text>
          {actions.map((action, index) => (
            <TouchableOpacity
              key={action.id}
              style={[
                styles.row,
                index === actions.length - 1 && styles.rowLast,
              ]}
              onPress={() => run(action.id)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={action.label}
            >
              <Text style={styles.rowText}>{action.label}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={onClose}
            activeOpacity={0.85}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    backgroundColor: BG,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255,90,0,0.28)',
    paddingTop: 10,
    paddingHorizontal: 14,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.4,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: -4 },
      },
      android: { elevation: 12 },
      default: {},
    }),
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.22)',
    marginBottom: 12,
  },
  title: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  row: {
    backgroundColor: SURFACE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: HAIRLINE,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  rowLast: {
    marginBottom: 12,
  },
  rowText: {
    color: WHITE,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,90,0,0.45)',
  },
  cancelText: {
    color: ACCENT,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
});

export default memo(ReelActionSheet);
export { BASE_ACTIONS as REEL_ACTIONS };
