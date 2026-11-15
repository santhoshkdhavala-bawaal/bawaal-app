/**
 * Floating vault emoji burst — proprietary BawaalEmoji particles only.
 *
 * Layer: absoluteFill over the video/arena card (top/left/right/bottom 0).
 * Spawn: lower half of that card (~75% height, horizontal center).
 * Motion: kick slightly down, then float upward across the feed.
 */
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  StyleSheet,
  View,
} from 'react-native';
import { BawaalEmoji } from '../../components/BawaalEmoji';

/** Visible float duration — linger long enough to read the reaction. */
export const BURST_DURATION_MS = 2800;
/** Unmount delay — must be >= animation life so particles do not vanish early. */
export const BURST_CLEANUP_MS = 3000;
export const BURST_PARTICLE_COUNT = 7;
export const BURST_MAX_PARTICLES = 42;
export const BURST_EMOJI_SIZE = 48;

/** Horizontal radial spread (px) */
export const BURST_X_SPREAD = 150;
/** Initial outward / downward pop (px) */
export const BURST_KICK_Y = 36;
/** Final upward float target (px) — long enough to cross mid-feed from ~75% */
export const BURST_FLOAT_Y = -280;
/**
 * Vertical spawn — lower half of the video card (70–80% band → 75%).
 * Particles float upward from here across the active feed.
 */
export const BURST_CENTER_Y_RATIO = 0.75;

/** @deprecated Prefer BURST_CENTER_Y_RATIO; kept for call-site compatibility */
export const BURST_CENTER_Y_BIAS = 0;

let burstSeq = 0;

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

/**
 * Lower-center anchor of measured container bounds (width/2, height * 0.75).
 *
 * @param {{ width?: number, height?: number, containerWidth?: number, containerHeight?: number } | null | undefined} container
 */
export function getContainerBurstCenter(container) {
  const containerWidth =
    Number(container?.containerWidth) || Number(container?.width) || 0;
  const containerHeight =
    Number(container?.containerHeight) || Number(container?.height) || 0;

  if (containerWidth > 0 && containerHeight > 0) {
    const centerX = containerWidth / 2;
    const centerY = containerHeight * BURST_CENTER_Y_RATIO;
    return {
      containerWidth,
      containerHeight,
      centerX,
      centerY,
      startX: centerX,
      startY: centerY,
    };
  }

  const { width, height } = Dimensions.get('window');
  const centerX = width / 2;
  const centerY = height * BURST_CENTER_Y_RATIO;
  return {
    containerWidth: width,
    containerHeight: height,
    centerX,
    centerY,
    startX: centerX,
    startY: centerY,
  };
}

/**
 * Build particles with offsets from the lower-center spawn (0,0 = spawn point).
 * Layer converts these to absolute left/top using measured card bounds.
 */
export function createEmojiBurstParticles(originX, originY, emojiKey, opts = {}) {
  const count = Math.max(4, Math.min(10, Number(opts.count) || BURST_PARTICLE_COUNT));
  const key = String(emojiKey || 'skull_orange_glow_v3').toLowerCase();
  const startX = Number.isFinite(Number(originX)) ? Number(originX) : 0;
  const startY = Number.isFinite(Number(originY)) ? Number(originY) : 0;
  const life = Math.max(
    BURST_DURATION_MS,
    Number(opts.duration) || BURST_DURATION_MS
  );

  const particles = [];
  for (let i = 0; i < count; i += 1) {
    burstSeq += 1;
    const targetX = randomBetween(-BURST_X_SPREAD, BURST_X_SPREAD);
    const kickY = BURST_KICK_Y + randomBetween(-8, 12);
    const floatY = BURST_FLOAT_Y + randomBetween(-40, 20);
    const delay = Math.floor(Math.random() * 80);
    const size = BURST_EMOJI_SIZE + Math.floor((Math.random() - 0.5) * 12);
    particles.push({
      id: `burst-${Date.now()}-${burstSeq}-${i}`,
      emojiKey: key,
      startX,
      startY,
      targetX,
      kickY,
      floatY,
      delay,
      duration: life,
      size,
    });
  }
  return particles;
}

/**
 * Spawn at lower-center origin offsets (0,0 → ~75% down / horizontal center).
 * @param {string} emojiKey
 * @param {{ width?: number, height?: number, containerWidth?: number, containerHeight?: number } | null} [_containerSize]
 */
export function createCenteredEmojiBurst(emojiKey, _containerSize, opts = {}) {
  return createEmojiBurstParticles(0, 0, emojiKey, opts);
}

/**
 * Spawn vault particles over both fighter midpoints as offsets from lower-center.
 */
export function createDualPaneEmojiBurst(
  emojiKey,
  hostPane,
  rivalPane,
  containerSize,
  opts = {}
) {
  const parent = getContainerBurstCenter(containerSize);
  const paneOpts = {
    ...opts,
    count: Math.max(3, Math.min(6, Number(opts.count) || 5)),
  };

  const particles = [];
  const panes = [hostPane, rivalPane].filter(
    (p) => p && Number(p.width) > 0 && Number(p.height) > 0
  );

  if (!panes.length) {
    return createCenteredEmojiBurst(emojiKey, containerSize, opts);
  }

  panes.forEach((pane) => {
    const ox = Number(pane.x) || 0;
    const oy = Number(pane.y) || 0;
    const startX = ox + Number(pane.width) / 2 - parent.centerX;
    const startY =
      oy + Number(pane.height) * BURST_CENTER_Y_RATIO - parent.centerY;
    particles.push(
      ...createEmojiBurstParticles(startX, startY, emojiKey, paneOpts)
    );
  });

  return particles;
}

export function appendBurstParticles(prev, nextParticles) {
  const merged = [...(prev || []), ...(nextParticles || [])];
  return merged.length > BURST_MAX_PARTICLES
    ? merged.slice(-BURST_MAX_PARTICLES)
    : merged;
}

const FloatingEmojiParticle = memo(function FloatingEmojiParticle({
  id,
  emojiKey,
  startX,
  startY,
  targetX,
  kickY,
  floatY,
  delay,
  duration,
  size,
  originX,
  originY,
  onDone,
}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progress.setValue(0);
    const wait = Math.max(0, delay || 0);
    const life = Math.max(BURST_DURATION_MS, duration || BURST_DURATION_MS);
    const cleanupMs = Math.max(BURST_CLEANUP_MS, wait + life + 200);

    const anim = Animated.sequence([
      Animated.delay(wait),
      Animated.timing(progress, {
        toValue: 1,
        duration: life,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    anim.start();
    const cleanupTimer = setTimeout(() => {
      onDone?.(id);
    }, cleanupMs);

    return () => {
      anim.stop();
      clearTimeout(cleanupTimer);
    };
  }, [progress, id, onDone, delay, duration]);

  const opacity = progress.interpolate({
    inputRange: [0, 0.06, 0.75, 1],
    outputRange: [0, 1, 1, 0],
    extrapolate: 'clamp',
  });
  const scale = progress.interpolate({
    inputRange: [0, 0.2, 1],
    outputRange: [0.4, 1.15, 1.05],
    extrapolate: 'clamp',
  });
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, targetX || 0],
    extrapolate: 'clamp',
  });
  // Kick slightly down, then float upward across the video center
  const translateY = progress.interpolate({
    inputRange: [0, 0.18, 1],
    outputRange: [
      0,
      Math.abs(kickY ?? BURST_KICK_Y),
      floatY ?? BURST_FLOAT_Y,
    ],
    extrapolate: 'clamp',
  });

  const dim = typeof size === 'number' && size > 0 ? size : BURST_EMOJI_SIZE;
  const ox = Number.isFinite(Number(originX)) ? Number(originX) : 0;
  const oy = Number.isFinite(Number(originY)) ? Number(originY) : 0;
  const sx = Number.isFinite(Number(startX)) ? Number(startX) : 0;
  const sy = Number.isFinite(Number(startY)) ? Number(startY) : 0;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.particle,
        {
          // Absolute on full video overlay — spawn near lower half, float up
          left: ox + sx - dim / 2,
          top: oy + sy - dim / 2,
          width: dim,
          height: dim,
          opacity,
          transform: [{ translateX }, { translateY }, { scale }],
        },
      ]}
    >
      <BawaalEmoji name={emojiKey || 'skull_orange_glow_v3'} size={dim} />
    </Animated.View>
  );
});

/**
 * Full-bleed overlay over the video card — particles spawn in the lower half.
 */
export const FloatingEmojiBurstLayer = memo(function FloatingEmojiBurstLayer({
  particles,
  onParticleDone,
  onLayout,
  style,
}) {
  const [bounds, setBounds] = useState(() => {
    const { width, height } = Dimensions.get('window');
    return { width, height };
  });

  const handleLayout = useCallback(
    (event) => {
      const { width, height } = event?.nativeEvent?.layout || {};
      if (width > 0 && height > 0) {
        setBounds((prev) =>
          prev.width === width && prev.height === height
            ? prev
            : { width, height }
        );
      }
      onLayout?.(event);
    },
    [onLayout]
  );

  const originX = bounds.width / 2;
  const originY = bounds.height * BURST_CENTER_Y_RATIO;

  return (
    <View
      pointerEvents="none"
      collapsable={false}
      onLayout={handleLayout}
      style={[styles.layer, style]}
    >
      {(particles || []).map((p) => (
        <FloatingEmojiParticle
          key={p.id}
          id={p.id}
          emojiKey={p.emojiKey}
          startX={p.startX}
          startY={p.startY}
          targetX={p.targetX}
          kickY={p.kickY}
          floatY={p.floatY}
          delay={p.delay}
          duration={p.duration}
          size={p.size}
          originX={originX}
          originY={originY}
          onDone={onParticleDone}
        />
      ))}
    </View>
  );
});

export default FloatingEmojiBurstLayer;

const styles = StyleSheet.create({
  /** Spans the entire video / arena card — not a header strip. */
  layer: {
    ...StyleSheet.absoluteFillObject,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    elevation: 9999,
    pointerEvents: 'none',
    overflow: 'hidden',
  },
  particle: {
    position: 'absolute',
  },
});
