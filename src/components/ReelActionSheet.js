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
  Share,
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

function formatCountLabel(base, count) {
  const n = Number(count) || 0;
  return n > 0 ? `${base} · ${n}` : base;
}

function ReelActionSheet({ visible, reel, onClose, onAction, style }) {
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

  const actions = useMemo(
    () =>
      BASE_ACTIONS.map((action) => {
        if (action.id === 'follow') {
          return { ...action, label: following ? 'Unfollow' : 'Follow' };
        }
        if (action.id === 'like') {
          return {
            ...action,
            label: formatCountLabel(likedByMe ? 'Liked' : 'Like', likeCount),
          };
        }
        if (action.id === 'comment' || action.id === 'banter') {
          return {
            ...action,
            label: formatCountLabel(action.label, commentCount),
          };
        }
        return action;
      }),
    [following, likeCount, commentCount, likedByMe]
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
      if (actionId === 'like') {
        // Optimistic count — cloud toggle runs via onAction / dispatchReelSocialAction
        const nextLiked = !likedByMe;
        setLikedByMe(nextLiked);
        setLikeCount((c) => Math.max(0, c + (nextLiked ? 1 : -1)));
      }
      // Share = native system share. Send/DM open the DM picker via onAction.
      if (resolvedId === 'share') {
        await shareReel(reel);
      }
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
      // Keep stack open for like so count stays visible; close for navigation actions
      if (resolvedId !== 'like') {
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
      reel,
      targetKey,
    ]
  );

  if (!visible) return null;

  return (
    <View style={styles.root} pointerEvents="box-none">
      {/* Outside tap dismisses — transparent so video stays visible/playing */}
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Dismiss actions"
      />

      <View style={[styles.stack, style]} pointerEvents="box-none">
        {actions.map((action) => (
          <TouchableOpacity
            key={action.id}
            style={styles.item}
            onPress={() => run(action.id)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={action.label}
          >
            <Image
              source={action.icon}
              style={styles.icon}
              resizeMode="contain"
            />
            <Text style={styles.label} numberOfLines={1}>
              {action.label}
            </Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={onClose}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Close actions"
        >
          <Text style={styles.cancelText}>✕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  stack: {
    position: 'absolute',
    right: REEL_ACTION_STACK.right,
    bottom: REEL_ACTION_STACK.bottom,
    // Clears mute (top:16, h:36) on the same right rail
    top: REEL_ACTION_STACK.top,
    zIndex: REEL_ACTION_STACK.zIndex,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingTop: 8,
  },
  item: {
    alignItems: 'center',
    marginBottom: REEL_ACTION_STACK.itemGap,
    minWidth: 56,
  },
  icon: {
    width: ICON_SIZE,
    height: ICON_SIZE,
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
  cancelBtn: {
    marginTop: 4,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    color: ACCENT,
    fontSize: 18,
    fontWeight: '900',
  },
});

export default memo(ReelActionSheet);
export { BASE_ACTIONS as REEL_ACTIONS };
