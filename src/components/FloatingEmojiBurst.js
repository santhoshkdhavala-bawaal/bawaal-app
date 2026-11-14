/**
 * Floating vault emoji burst — proprietary BawaalEmoji particles only.
 *
 * Viewport overlay (absolute fill, zIndex 9999) centers via Dimensions.get('window'):
 *   centerX = width / 2, centerY = height / 2
 * Particles spawn at that point and explode in a true 360° radial burst, then fade.
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

let burstSeq = 0;

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

/** Exact screen midpoint from window dimensions (web-safe). */
export function getWindowBurstCenter() {
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;
  return {
    screenWidth,
    screenHeight,
    centerX: screenWidth / 2,
    centerY: screenHeight / 2,
  };
}

/**
 * Build particles at window centerX/centerY with full 360° outward deltas.
 */
export function createEmojiBurstParticles(_originX, _originY, emojiKey, opts = {}) {
  const count = Math.max(4, Math.min(10, Number(opts.count) || BURST_PARTICLE_COUNT));
  const key = String(emojiKey || 'skull_orange_glow_v3').toLowerCase();
  const { centerX, centerY } = getWindowBurstCenter();

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
      centerX,
      centerY,
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
 * Spawn a window-centered 360° radial burst.
 * @param {string} emojiKey
 */
export function createCenteredEmojiBurst(emojiKey, _containerLayout, opts = {}) {
  const { centerX, centerY } = getWindowBurstCenter();
  return createEmojiBurstParticles(centerX, centerY, emojiKey, opts);
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
  centerX,
  centerY,
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
  const { centerX: fallbackX, centerY: fallbackY } = getWindowBurstCenter();
  const cx = Number.isFinite(Number(centerX)) ? Number(centerX) : fallbackX;
  const cy = Number.isFinite(Number(centerY)) ? Number(centerY) : fallbackY;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.particle,
        {
          left: cx - dim / 2,
          top: cy - dim / 2,
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
 * Absolute viewport overlay — particles erupt from window center.
 */
export const FloatingEmojiBurstLayer = memo(function FloatingEmojiBurstLayer({
  particles,
  onParticleDone,
  style,
}) {
  return (
    <View pointerEvents="none" collapsable={false} style={[styles.layer, style]}>
      {(particles || []).map((p) => (
        <FloatingEmojiParticle
          key={p.id}
          id={p.id}
          emojiKey={p.emojiKey}
          centerX={p.centerX}
          centerY={p.centerY}
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
  },
  particle: {
    position: 'absolute',
  },
});
