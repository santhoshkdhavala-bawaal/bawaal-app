/**
 * Floating vault emoji burst — proprietary BawaalEmoji particles only.
 * Spawns at canvas center (width/2, height/2); disperses outward + floats up
 * with spring physics, scales up, and fades out over ~2s.
 */
import React, { memo, useEffect, useRef } from 'react';
import { Animated, Dimensions, StyleSheet, View } from 'react-native';
import { BawaalEmoji } from '../../components/BawaalEmoji';

export const BURST_DURATION_MS = 2000;
export const BURST_PARTICLE_COUNT = 7;
export const BURST_MAX_PARTICLES = 42;
export const BURST_EMOJI_SIZE = 48;

let burstSeq = 0;

/**
 * Resolve spawn origin to the exact center of the video / screen canvas.
 * @param {{ width?: number, height?: number } | null | undefined} canvas
 * @returns {{ startX: number, startY: number, width: number, height: number }}
 */
export function getCanvasCenterOrigin(canvas) {
  const win = Dimensions.get('window');
  const width =
    Number(canvas?.width) > 0 ? Number(canvas.width) : win.width || 390;
  const height =
    Number(canvas?.height) > 0 ? Number(canvas.height) : win.height || 844;
  return {
    width,
    height,
    startX: width / 2,
    startY: height / 2,
  };
}

/**
 * Build particle descriptors for one vault pick.
 * Origin defaults to canvas center — not the sidebar vault button.
 * @returns {{ id: string, emojiKey: string, x: number, y: number, driftX: number, rise: number, delay: number, duration: number, size: number }[]}
 */
export function createEmojiBurstParticles(originX, originY, emojiKey, opts = {}) {
  const count = Math.max(4, Math.min(10, Number(opts.count) || BURST_PARTICLE_COUNT));
  const key = String(emojiKey || 'skull_orange_glow_v3').toLowerCase();

  // Prefer explicit center; fall back to window center if callers pass NaN / omit
  const center = getCanvasCenterOrigin({
    width: opts.width,
    height: opts.height,
  });
  const ox = Number.isFinite(Number(originX)) ? Number(originX) : center.startX;
  const oy = Number.isFinite(Number(originY)) ? Number(originY) : center.startY;

  const particles = [];
  for (let i = 0; i < count; i += 1) {
    burstSeq += 1;
    // Even radial spread + jitter — disperse across the middle of the feed
    const baseAngle = (i / count) * Math.PI * 2;
    const angle = baseAngle + (Math.random() - 0.5) * 0.55;
    const outward = 70 + Math.random() * 110;
    const driftX = Math.cos(angle) * outward;
    // Always float upward; add a bit more rise when the radial vector points up
    const rise =
      130 +
      Math.random() * 90 +
      Math.max(0, -Math.sin(angle)) * (outward * 0.45);
    const delay = Math.floor(Math.random() * 90);
    const size = BURST_EMOJI_SIZE + Math.floor((Math.random() - 0.5) * 12);
    particles.push({
      id: `burst-${Date.now()}-${burstSeq}-${i}`,
      emojiKey: key,
      x: ox,
      y: oy,
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
 * Spawn a burst at the exact center of the given canvas (or window).
 */
export function createCenteredEmojiBurst(emojiKey, canvas, opts = {}) {
  const { startX, startY, width, height } = getCanvasCenterOrigin(canvas);
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
 * Absolute-fill overlay hosting active burst particles.
 */
export const FloatingEmojiBurstLayer = memo(function FloatingEmojiBurstLayer({
  particles,
  onParticleDone,
}) {
  if (!particles || particles.length === 0) return null;
  return (
    <View style={styles.layer} pointerEvents="none">
      {particles.map((p) => (
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
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
  },
  particle: {
    position: 'absolute',
  },
});
