/**
 * Floating vault emoji burst — proprietary BawaalEmoji particles only.
 *
 * Spawn origin is the video player container from onLayout:
 *   startX = containerWidth / 2
 *   startY = containerHeight * BURST_ORIGIN_Y_RATIO (lower-middle combat zone)
 * Never uses Dimensions.get('window').height (excludes browser/app chrome).
 * Radial spread then drifts up and fades ~2s.
 */
import React, { memo, useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { BawaalEmoji } from '../../components/BawaalEmoji';

export const BURST_DURATION_MS = 2000;
export const BURST_PARTICLE_COUNT = 7;
export const BURST_MAX_PARTICLES = 42;
export const BURST_EMOJI_SIZE = 48;
/** Random initial offset from center: Math.random() * 100 - 50 → [-50, 50] */
export const BURST_CENTER_JITTER = 50;
/**
 * Vertical spawn ratio — lower-middle of the video frame (combat sweet spot).
 * 0.65 ≈ 65% down from the top of the video container.
 */
export const BURST_ORIGIN_Y_RATIO = 0.65;
/**
 * Fallback size when container height is not yet measured
 * (startY ≈ fallbackHeight * 0.65 ≈ 260).
 */
export const BURST_FALLBACK_HEIGHT = 400;
export const BURST_FALLBACK_WIDTH = 390;
export const BURST_FALLBACK_CENTER_Y = BURST_FALLBACK_HEIGHT * BURST_ORIGIN_Y_RATIO;
export const BURST_FALLBACK_CENTER_X = BURST_FALLBACK_WIDTH / 2;

let burstSeq = 0;

function randomCenterOffset() {
  return Math.random() * 100 - 50;
}

/**
 * Burst origin over the video player (local coords).
 * Horizontal: dead center. Vertical: lower-middle (~65% of container height).
 * Prefer onLayout width/height — never window height (includes headers).
 *
 * @param {{ width?: number, height?: number } | null | undefined} container
 * @returns {{ startX: number, startY: number, width: number, height: number }}
 */
export function getVideoContainerCenter(container) {
  const width = Number(container?.width);
  const height = Number(container?.height);
  const w = Number.isFinite(width) && width > 0 ? width : BURST_FALLBACK_WIDTH;
  const h = Number.isFinite(height) && height > 0 ? height : BURST_FALLBACK_HEIGHT;
  return {
    width: w,
    height: h,
    startX: w / 2,
    startY: h * BURST_ORIGIN_Y_RATIO,
  };
}

/** @deprecated use getVideoContainerCenter */
export function getCanvasCenterOrigin(container) {
  return getVideoContainerCenter(container);
}

/** @deprecated window height must not drive vertical center */
export function getWindowCenterOrigin() {
  return getVideoContainerCenter(null);
}

/**
 * Build particles at video-container local (startX, startY) with radial spread.
 */
export function createEmojiBurstParticles(originX, originY, emojiKey, opts = {}) {
  const count = Math.max(4, Math.min(10, Number(opts.count) || BURST_PARTICLE_COUNT));
  const key = String(emojiKey || 'skull_orange_glow_v3').toLowerCase();
  const center = getVideoContainerCenter({
    width: opts.width,
    height: opts.height,
  });
  const startX = Number.isFinite(Number(originX)) ? Number(originX) : center.startX;
  const startY = Number.isFinite(Number(originY)) ? Number(originY) : center.startY;

  const particles = [];
  for (let i = 0; i < count; i += 1) {
    burstSeq += 1;
    const offsetX = randomCenterOffset();
    const offsetY = randomCenterOffset();
    const baseAngle = (i / count) * Math.PI * 2;
    const angle = baseAngle + (Math.random() - 0.5) * 0.5;
    const outward = 80 + Math.random() * 120;
    const radialX = Math.cos(angle) * outward;
    const radialY = Math.sin(angle) * outward;
    const driftX = radialX;
    const rise = Math.max(90, -radialY + 100 + Math.random() * 80);
    const delay = Math.floor(Math.random() * 80);
    const size = BURST_EMOJI_SIZE + Math.floor((Math.random() - 0.5) * 12);
    particles.push({
      id: `burst-${Date.now()}-${burstSeq}-${i}`,
      emojiKey: key,
      x: startX + offsetX,
      y: startY + offsetY,
      driftX,
      rise,
      delay,
      duration: BURST_DURATION_MS,
      size,
    });
  }
  return particles;
}

/**
 * Spawn at video lower-middle: width/2, height * 0.65 (from onLayout).
 * @param {string} emojiKey
 * @param {{ width?: number, height?: number } | null} containerLayout
 */
export function createCenteredEmojiBurst(emojiKey, containerLayout, opts = {}) {
  const { startX, startY, width, height } = getVideoContainerCenter(containerLayout);
  return createEmojiBurstParticles(startX, startY, emojiKey, {
    ...opts,
    width,
    height,
  });
}

/** Cap particle list length (keeps feed overlays light). */
export function appendBurstParticles(prev, nextParticles) {
  const merged = [...(prev || []), ...(nextParticles || [])];
  return merged.length > BURST_MAX_PARTICLES
    ? merged.slice(-BURST_MAX_PARTICLES)
    : merged;
}

const FloatingEmojiParticle = memo(function FloatingEmojiParticle({
  id,
  emojiKey,
  x,
  y,
  driftX,
  rise,
  delay,
  duration,
  size,
  onDone,
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progress.setValue(0);
    fade.setValue(0);
    const wait = Math.max(0, delay || 0);
    const life = Math.max(BURST_DURATION_MS, duration || BURST_DURATION_MS);

    const motion = Animated.sequence([
      Animated.delay(wait),
      Animated.spring(progress, {
        toValue: 1,
        friction: 5.5,
        tension: 38,
        useNativeDriver: true,
      }),
    ]);

    const opacityAnim = Animated.sequence([
      Animated.delay(wait),
      Animated.timing(fade, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(fade, {
        toValue: 0,
        duration: Math.max(400, life - 180),
        useNativeDriver: true,
      }),
    ]);

    const anim = Animated.parallel([motion, opacityAnim]);
    anim.start(({ finished }) => {
      if (finished) onDone?.(id);
    });
    return () => {
      anim.stop();
    };
  }, [progress, fade, id, onDone, delay, duration]);

  const scale = progress.interpolate({
    inputRange: [0, 0.35, 1],
    outputRange: [0.35, 1.2, 1.08],
  });
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -(rise || 160)],
  });
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, driftX || 0],
  });

  const dim = typeof size === 'number' && size > 0 ? size : BURST_EMOJI_SIZE;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.particle,
        {
          left: x - dim / 2,
          top: y - dim / 2,
          opacity: fade,
          transform: [{ translateX }, { translateY }, { scale }],
        },
      ]}
    >
      <BawaalEmoji name={emojiKey || 'skull_orange_glow_v3'} size={dim} />
    </Animated.View>
  );
});

/**
 * Absolute-fill overlay over the video player.
 * onLayout reports the true video-card size for dead-center spawn.
 */
export const FloatingEmojiBurstLayer = memo(function FloatingEmojiBurstLayer({
  particles,
  onParticleDone,
  onLayout,
  style,
}) {
  return (
    <View
      pointerEvents="none"
      collapsable={false}
      onLayout={onLayout}
      style={[styles.layer, style]}
    >
      {(particles || []).map((p) => (
        <FloatingEmojiParticle
          key={p.id}
          id={p.id}
          emojiKey={p.emojiKey}
          x={p.x}
          y={p.y}
          driftX={p.driftX}
          rise={p.rise}
          delay={p.delay}
          duration={p.duration}
          size={p.size}
          onDone={onParticleDone}
        />
      ))}
    </View>
  );
});

export default FloatingEmojiBurstLayer;

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
    overflow: 'hidden',
  },
  particle: {
    position: 'absolute',
  },
});
