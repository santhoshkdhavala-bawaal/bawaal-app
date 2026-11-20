/**
 * LOCKED — Instagram / TikTok-style floating vertical action stack on the video canvas.
 * (DM / Like / Follow·Unfollow / Share / Save / Banter / Comment / Send).
 * Follow lives only here — never as a canvas overlay CTA.
 * Renders inline (no Modal) so the reel keeps playing underneath.
 * Geometry from `src/constants/arenaReelOverlay.js` — clears top-right mute.
 */
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  TouchableOpacity,
} from 'react-native';
import {
  isFollowingReelOwner,
  setFollowingReelOwner,
} from '../services/reelSocialService';
import {
  BAWAAL_ORANGE,
  REEL_ACTION_STACK,
} from '../constants/arenaReelOverlay';

const WHITE = '#FFFFFF';
const ACCENT = BAWAAL_ORANGE;
const ICON_SIZE = REEL_ACTION_STACK.iconSize;

const BASE_ACTIONS = [
  { id: 'dm', label: 'DM', icon: require('../../assets/bawaal_dm.png') },
  { id: 'like', label: 'Like', icon: require('../../assets/bawaal_like.png') },
  { id: 'follow', label: 'Follow', icon: require('../../assets/bawaal_follow.png') },
  { id: 'share', label: 'Share', icon: require('../../assets/bawaal_share.png') },
  { id: 'save', label: 'Save', icon: require('../../assets/bawaal_save.png') },
  { id: 'banter', label: 'Banter', icon: require('../../assets/bawaal_banter.png') },
  { id: 'comment', label: 'Comment', icon: require('../../assets/bawaal_comment.png') },
  { id: 'send', label: 'Send', icon: require('../../assets/bawaal_send.png') },
];

/**
 * Secondary social actions — live inside the ⋮ popup only.
 * Order: Like → Banter → Share → DM → Comment (DM fully included).
 */
export const REEL_SECONDARY_ACTION_IDS = Object.freeze([
  'like',
  'banter',
  'share',
  'dm',
  'comment',
]);

/** Slim rail essentials (above vault skull / ⋮). */
export const REEL_ESSENTIAL_ACTION_IDS = Object.freeze(['follow']);

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

function formatCountLabel(base, count) {
  const n = Number(count) || 0;
  return n > 0 ? `${base} · ${n}` : base;
}

function ReelActionSheet({
  visible,
  reel,
  onClose,
  onAction,
  style,
  /** Always-on rail — no dismiss backdrop; stack stays on the video. */
  persistent = false,
  /** Clean visual stack — icons only (no RESHARE / BANTER / MORE text). */
  showLabels = true,
  /** Hide the ✕ row when the stack is a permanent rail. */
  showClose = true,
  /**
   * Optional allow-list of action ids.
   * ⋮ popup uses secondary socials; slim rail uses essentials only.
   */
  actionIds = null,
  /** Compact ⋮ dropdown — tighter rows, uncluttered labels. */
  compact = false,
}) {
  const targetKey = followTargetKey(reel);
  const [following, setFollowing] = useState(false);
  const [likeCount, setLikeCount] = useState(Number(reel?.likeCount) || 0);
  const [commentCount, setCommentCount] = useState(
    Number(reel?.commentCount) || 0
  );
  const [likedByMe, setLikedByMe] = useState(!!reel?.likedByMe);

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

  useEffect(() => {
    if (!visible) return;
    setLikeCount(Number(reel?.likeCount) || 0);
    setCommentCount(Number(reel?.commentCount) || 0);
    setLikedByMe(!!reel?.likedByMe);
  }, [visible, reel?.id, reel?.likeCount, reel?.commentCount, reel?.likedByMe]);

  const actions = useMemo(() => {
    const byId = Object.fromEntries(
      BASE_ACTIONS.map((action) => [action.id, action])
    );
    // Preserve caller order (Like → Banter → Share → DM → Comment).
    const ordered =
      Array.isArray(actionIds) && actionIds.length > 0
        ? actionIds.map((id) => byId[String(id)]).filter(Boolean)
        : BASE_ACTIONS;

    return ordered.map((action) => {
      if (action.id === 'follow') {
        return { ...action, label: following ? 'Unfollow' : 'Follow' };
      }
      if (action.id === 'like') {
        return {
          ...action,
          label: formatCountLabel(likedByMe ? 'Liked' : 'Like', likeCount),
        };
      }
      // Banter stays an explicit menu label (never renamed / omitted).
      if (action.id === 'banter') {
        return { ...action, label: 'Banter' };
      }
      if (action.id === 'comment') {
        return {
          ...action,
          label: formatCountLabel('Comment', commentCount),
        };
      }
      if (action.id === 'dm') {
        return { ...action, label: 'DM' };
      }
      return action;
    });
  }, [actionIds, following, likeCount, commentCount, likedByMe]);

  const run = useCallback(
    async (actionId) => {
      let resolvedId = actionId;
      if (actionId === 'follow') {
        const next = !following;
        setFollowing(next);
        resolvedId = next ? 'follow' : 'unfollow';
        void setFollowingReelOwner(targetKey, next).catch(() => {});
      }
      if (actionId === 'like') {
        const nextLiked = !likedByMe;
        setLikedByMe(nextLiked);
        setLikeCount((c) => Math.max(0, c + (nextLiked ? 1 : -1)));
      }
      // Share must NOT auto-trigger Share.share / navigator.share here —
      // parents open BAWAAL SHARE REEL (or their own handler) via onAction only.
      try {
        onAction?.(resolvedId, {
          ...reel,
          likeCount,
          commentCount,
          likedByMe,
        });
      } catch (_) {
        /* ignore */
      }
      if (!persistent && resolvedId !== 'like') {
        onClose?.();
      }
    },
    [
      following,
      likedByMe,
      likeCount,
      commentCount,
      onAction,
      onClose,
      persistent,
      reel,
      targetKey,
    ]
  );

  if (!visible) return null;

  return (
    <View
      style={persistent ? styles.persistentRoot : styles.root}
      pointerEvents="box-none"
    >
      {!persistent ? (
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Dismiss actions"
        />
      ) : null}

      <View
        style={[styles.stack, compact && styles.stackCompact, style]}
        pointerEvents="box-none"
      >
        {actions.map((action) => (
          <TouchableOpacity
            key={action.id}
            style={[styles.item, compact && styles.itemCompact]}
            onPress={() => run(action.id)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={action.label}
          >
            <Image
              source={action.icon}
              style={[
                styles.icon,
                !showLabels && styles.iconSolo,
                compact && styles.iconCompact,
              ]}
              resizeMode="contain"
            />
            {showLabels ? (
              <Text
                style={[styles.label, compact && styles.labelCompact]}
                numberOfLines={1}
              >
                {action.label}
              </Text>
            ) : null}
          </TouchableOpacity>
        ))}

        {showClose && !persistent ? (
          <TouchableOpacity
            style={[styles.cancelBtn, compact && styles.cancelBtnCompact]}
            onPress={onClose}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Close actions"
          >
            <Text style={styles.cancelText}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
  },
  persistentRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 28,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  stack: {
    position: 'absolute',
    right: REEL_ACTION_STACK.right,
    bottom: REEL_ACTION_STACK.bottom,
    top: REEL_ACTION_STACK.top,
    zIndex: REEL_ACTION_STACK.zIndex,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingTop: 8,
  },
  stackCompact: {
    paddingTop: 4,
  },
  item: {
    alignItems: 'center',
    marginBottom: REEL_ACTION_STACK.itemGap,
    minWidth: 44,
  },
  itemCompact: {
    marginBottom: 6,
    minWidth: 52,
  },
  icon: {
    width: ICON_SIZE,
    height: ICON_SIZE,
  },
  iconSolo: {
    width: ICON_SIZE + 2,
    height: ICON_SIZE + 2,
  },
  iconCompact: {
    width: 24,
    height: 24,
  },
  label: {
    marginTop: 4,
    color: WHITE,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  labelCompact: {
    marginTop: 2,
    fontSize: 9,
    letterSpacing: 0.3,
  },
  cancelBtn: {
    marginTop: 4,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnCompact: {
    marginTop: 2,
  },
  cancelText: {
    color: ACCENT,
    fontSize: 18,
    fontWeight: '900',
  },
});

export default memo(ReelActionSheet);
export { BASE_ACTIONS as REEL_ACTIONS };
