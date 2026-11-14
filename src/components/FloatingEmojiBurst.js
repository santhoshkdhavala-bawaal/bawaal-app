/**
 * Floating vault emoji burst — proprietary BawaalEmoji particles only.
 *
 * Origin from video-container onLayout:
 *   startX = width / 2
 *   startY = height / 2
 * Overlay absolute-fills those exact card bounds; particles erupt with dx/dy
 * from that measured visual center, then float up and fade ~2s.
 */
import React, { memo, useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { BawaalEmoji } from '../../components/BawaalEmoji';

export const BURST_DURATION_MS = 2000;
export const BURST_PARTICLE_COUNT = 7;
export const BURST_MAX_PARTICLES = 42;
export const BURST_EMOJI_SIZE = 48;
export const BURST_CENTER_JITTER = 24;
export const BURST_UPWARD_BIAS = 110;

/** Fallback when onLayout has not fired yet */
export const BURST_FALLBACK_WIDTH = 390;
export const BURST_FALLBACK_HEIGHT = 700;

let burstSeq = 0;

function randomJitter() {
  return Math.random() * (BURST_CENTER_JITTER * 2) - BURST_CENTER_JITTER;
}

/**
 * Exact middle of the measured video player container.
 * startX = width / 2, startY = height / 2
 *
 * @param {{ width?: number, height?: number } | null | undefined} container
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
    startY: h / 2,
  };
}

export function getCanvasCenterOrigin(container) {
  return getVideoContainerCenter(container);
}

export function getWindowCenterOrigin() {
  return getVideoContainerCenter(null);
}

/**
 * Build particles at measured center (startX, startY) with outward dx / dy.
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
    const baseAngle = (i / count) * Math.PI * 2;
    const angle = baseAngle + (Math.random() - 0.5) * 0.55;
    const outward = 70 + Math.random() * 130;
    const dx = Math.cos(angle) * outward + randomJitter() * 0.4;
    const dy =
      Math.sin(angle) * outward * 0.85 -
      BURST_UPWARD_BIAS -
      Math.random() * 60;
    const delay = Math.floor(Math.random() * 80);
    const size = BURST_EMOJI_SIZE + Math.floor((Math.random() - 0.5) * 12);
    particles.push({
      id: `burst-${Date.now()}-${burstSeq}-${i}`,
      emojiKey: key,
      startX,
      startY,
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
 * Spawn at onLayout center: width/2, height/2 of the video container.
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
          left: startX - dim / 2,
          top: startY - dim / 2,
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
 * Absolute overlay matching the video player card bounds.
 * onLayout captures runtime width/height for dead-center spawn.
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
          dx={p.dx}
          dy={p.dy}
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
