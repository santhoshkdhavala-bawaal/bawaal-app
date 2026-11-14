/**
 * Floating vault emoji burst — proprietary BawaalEmoji particles only.
 *
 * Origin from video-container onLayout:
 *   centerX = containerWidth / 2
 *   centerY = containerHeight / 2 + BURST_CENTER_Y_BIAS (+45)
 *   startX / startY anchored to that measured center
 * Overlay absolute-fills the card; particles explode 360° then fade.
 */
import React, { memo, useEffect, useRef } from 'react';
import { Animated, Dimensions, StyleSheet, View } from 'react-native';
import { BawaalEmoji } from '../../components/BawaalEmoji';

export const BURST_DURATION_MS = 2000;
export const BURST_PARTICLE_COUNT = 7;
export const BURST_MAX_PARTICLES = 42;
export const BURST_EMOJI_SIZE = 48;
export const BURST_RADIUS_MIN = 90;
export const BURST_RADIUS_MAX = 180;
/** Nudge burst ring slightly lower into the video mid-frame */
export const BURST_CENTER_Y_BIAS = 45;

let burstSeq = 0;

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

/**
 * True center from measured container bounds.
 * centerX = containerWidth / 2, centerY = containerHeight / 2
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
    const centerY = containerHeight / 2 + BURST_CENTER_Y_BIAS;
    return {
      containerWidth,
      containerHeight,
      centerX,
      centerY,
      startX: centerX,
      startY: centerY,
    };
  }

  // Soft fallback only until onLayout has measured the card
  const { width, height } = Dimensions.get('window');
  const centerX = width / 2;
  const centerY = height / 2 + BURST_CENTER_Y_BIAS;
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
 * Build particles at measured startX/startY with full 360° outward deltas.
 */
export function createEmojiBurstParticles(originX, originY, emojiKey, opts = {}) {
  const count = Math.max(4, Math.min(10, Number(opts.count) || BURST_PARTICLE_COUNT));
  const key = String(emojiKey || 'skull_orange_glow_v3').toLowerCase();
  const measured = getContainerBurstCenter({
    width: opts.containerWidth ?? opts.width,
    height: opts.containerHeight ?? opts.height,
  });
  const startX = Number.isFinite(Number(originX)) ? Number(originX) : measured.startX;
  const startY = Number.isFinite(Number(originY)) ? Number(originY) : measured.startY;

  const particles = [];
  for (let i = 0; i < count; i += 1) {
    burstSeq += 1;
    const baseAngle = (i / count) * Math.PI * 2;
    const angle = baseAngle + (Math.random() - 0.5) * 0.65;
    const radius = randomBetween(BURST_RADIUS_MIN, BURST_RADIUS_MAX);
    const targetX = Math.cos(angle) * radius;
    const targetY = Math.sin(angle) * radius;
    const delay = Math.floor(Math.random() * 80);
    const size = BURST_EMOJI_SIZE + Math.floor((Math.random() - 0.5) * 12);
    particles.push({
      id: `burst-${Date.now()}-${burstSeq}-${i}`,
      emojiKey: key,
      startX,
      startY,
      targetX,
      targetY,
      delay,
      duration: BURST_DURATION_MS,
      size,
    });
  }
  return particles;
}

/**
 * Spawn at onLayout center: containerWidth/2, containerHeight/2.
 * @param {string} emojiKey
 * @param {{ width?: number, height?: number, containerWidth?: number, containerHeight?: number } | null} containerSize
 */
export function createCenteredEmojiBurst(emojiKey, containerSize, opts = {}) {
  const { startX, startY, containerWidth, containerHeight } =
    getContainerBurstCenter(containerSize);
  return createEmojiBurstParticles(startX, startY, emojiKey, {
    ...opts,
    containerWidth,
    containerHeight,
  });
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
  targetY,
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
    extrapolate: 'clamp',
  });
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, targetX || 0],
    extrapolate: 'clamp',
  });
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, targetY || 0],
    extrapolate: 'clamp',
  });

  const dim = typeof size === 'number' && size > 0 ? size : BURST_EMOJI_SIZE;
  const sx = Number.isFinite(Number(startX)) ? Number(startX) : 0;
  const sy = Number.isFinite(Number(startY)) ? Number(startY) : 0;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.particle,
        {
          left: sx - dim / 2,
          top: sy - dim / 2,
          width: dim,
          height: dim,
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
 * Absolute overlay matching the measured video container bounds.
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
          startX={p.startX}
          startY={p.startY}
          targetX={p.targetX}
          targetY={p.targetY}
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
    zIndex: 9999,
    pointerEvents: 'none',
    overflow: 'hidden',
  },
  particle: {
    position: 'absolute',
  },
});
