/**
 * Floating vault emoji burst — proprietary BawaalEmoji particles only.
 *
 * Overlay: absolute-fill over the video card, flex-centered (web-safe).
 * Particles spawn at (0, 0) relative to that dead-center origin, then erupt
 * with random dx/dy outward before floating up and fading ~2s.
 */
import React, { memo, useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { BawaalEmoji } from '../../components/BawaalEmoji';

export const BURST_DURATION_MS = 2000;
export const BURST_PARTICLE_COUNT = 7;
export const BURST_MAX_PARTICLES = 42;
export const BURST_EMOJI_SIZE = 48;
/** Small jitter around the centered origin before radial erupt */
export const BURST_CENTER_JITTER = 24;
/** Extra upward bias (negative Y) after radial erupt */
export const BURST_UPWARD_BIAS = 110;

/** Kept for callers / docs — spawn is always (0,0) in the centered origin. */
export const BURST_ORIGIN_Y_PX = 0;
export const BURST_ORIGIN_Y_RATIO = 0.5;
export const BURST_FALLBACK_HEIGHT = 700;
export const BURST_FALLBACK_WIDTH = 390;
export const BURST_FALLBACK_CENTER_Y = 0;
export const BURST_FALLBACK_CENTER_X = 0;

let burstSeq = 0;

function randomJitter() {
  return Math.random() * (BURST_CENTER_JITTER * 2) - BURST_CENTER_JITTER;
}

/**
 * Dead-center origin relative to the flex-centered burst layer.
 * startX / startY are always 0 — the parent centers on the video card.
 */
export function getVideoContainerCenter() {
  return {
    width: 0,
    height: 0,
    startX: 0,
    startY: 0,
  };
}

export function getCanvasCenterOrigin() {
  return getVideoContainerCenter();
}

export function getWindowCenterOrigin() {
  return getVideoContainerCenter();
}

/**
 * Build particles at (0, 0) with outward dx / dy velocities.
 */
export function createEmojiBurstParticles(_originX, _originY, emojiKey, opts = {}) {
  const count = Math.max(4, Math.min(10, Number(opts.count) || BURST_PARTICLE_COUNT));
  const key = String(emojiKey || 'skull_orange_glow_v3').toLowerCase();

  const particles = [];
  for (let i = 0; i < count; i += 1) {
    burstSeq += 1;
    const baseAngle = (i / count) * Math.PI * 2;
    const angle = baseAngle + (Math.random() - 0.5) * 0.55;
    const outward = 70 + Math.random() * 130;
    // Erupt in all directions from exact center (0,0)
    const dx = Math.cos(angle) * outward + randomJitter() * 0.4;
    // Radial Y + upward float (negative = up in RN / CSS)
    const dy =
      Math.sin(angle) * outward * 0.85 -
      BURST_UPWARD_BIAS -
      Math.random() * 60;
    const delay = Math.floor(Math.random() * 80);
    const size = BURST_EMOJI_SIZE + Math.floor((Math.random() - 0.5) * 12);
    particles.push({
      id: `burst-${Date.now()}-${burstSeq}-${i}`,
      emojiKey: key,
      startX: 0,
      startY: 0,
      dx,
      dy,
      delay,
      duration: BURST_DURATION_MS,
      size,
    });
  }
  return particles;
}

/**
 * Spawn a burst at the video-card dead center (0,0 in centered overlay).
 */
export function createCenteredEmojiBurst(emojiKey, _containerLayout, opts = {}) {
  return createEmojiBurstParticles(0, 0, emojiKey, opts);
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
  dx,
  dy,
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
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, dx || 0],
  });
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, dy || 0],
  });

  const dim = typeof size === 'number' && size > 0 ? size : BURST_EMOJI_SIZE;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.particle,
        {
          marginLeft: -dim / 2,
          marginTop: -dim / 2,
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
 * Absolute-fill overlay spanning the video card; flex-centers the burst origin.
 * Particles spawn at (0,0) in that centered origin and erupt with dx/dy.
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
      <View style={styles.origin} pointerEvents="none" collapsable={false}>
        {(particles || []).map((p) => (
          <FloatingEmojiParticle
            key={p.id}
            id={p.id}
            emojiKey={p.emojiKey}
            dx={p.dx}
            dy={p.dy}
            delay={p.delay}
            duration={p.duration}
            size={p.size}
            onDone={onParticleDone}
          />
        ))}
      </View>
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  /** Zero-size anchor at the exact center of the video card */
  origin: {
    width: 0,
    height: 0,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  particle: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
});
