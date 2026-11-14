/**
 * Floating vault emoji burst — proprietary BawaalEmoji particles only.
 * Spawns multiple copies near an origin; drift upward, scale up, fade out ~1.6–2s.
 */
import React, { memo, useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { BawaalEmoji } from '../../components/BawaalEmoji';

export const BURST_DURATION_MS = 1800;
export const BURST_PARTICLE_COUNT = 6;
export const BURST_MAX_PARTICLES = 42;
export const BURST_EMOJI_SIZE = 44;

let burstSeq = 0;

/**
 * Build particle descriptors for one vault pick near (originX, originY).
 * @returns {{ id: string, emojiKey: string, x: number, y: number, driftX: number, rise: number, delay: number, duration: number, size: number }[]}
 */
export function createEmojiBurstParticles(originX, originY, emojiKey, opts = {}) {
  const count = Math.max(3, Math.min(10, Number(opts.count) || BURST_PARTICLE_COUNT));
  const key = String(emojiKey || 'skull_orange_glow_v3').toLowerCase();
  const ox = Number(originX);
  const oy = Number(originY);
  if (!Number.isFinite(ox) || !Number.isFinite(oy)) return [];

  const particles = [];
  for (let i = 0; i < count; i += 1) {
    burstSeq += 1;
    const driftX = (Math.random() - 0.5) * 90;
    const rise = 120 + Math.random() * 70;
    const delay = Math.floor(Math.random() * 120);
    const duration = BURST_DURATION_MS + Math.floor(Math.random() * 250);
    const size = BURST_EMOJI_SIZE + Math.floor((Math.random() - 0.5) * 10);
    particles.push({
      id: `burst-${Date.now()}-${burstSeq}-${i}`,
      emojiKey: key,
      x: ox + (Math.random() - 0.5) * 18,
      y: oy + (Math.random() - 0.5) * 12,
      driftX,
      rise,
      delay,
      duration,
      size,
    });
  }
  return particles;
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

  useEffect(() => {
    progress.setValue(0);
    const anim = Animated.sequence([
      Animated.delay(Math.max(0, delay || 0)),
      Animated.timing(progress, {
        toValue: 1,
        duration: Math.max(1200, duration || BURST_DURATION_MS),
        useNativeDriver: true,
      }),
    ]);
    anim.start(({ finished }) => {
      if (finished) onDone?.(id);
    });
    return () => {
      anim.stop();
    };
  }, [progress, id, onDone, delay, duration]);

  const scale = progress.interpolate({
    inputRange: [0, 0.25, 1],
    outputRange: [0.4, 1.15, 1.05],
  });
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -(rise || 140)],
  });
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, driftX || 0],
  });
  const opacity = progress.interpolate({
    inputRange: [0, 0.15, 0.65, 1],
    outputRange: [0, 1, 1, 0],
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
