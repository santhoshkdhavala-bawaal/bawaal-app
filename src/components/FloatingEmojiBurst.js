/**
 * Floating vault emoji burst — proprietary BawaalEmoji particles only.
 *
 * Overlay absolute-fills a position:relative video card (explicit height / flex).
 * Particles anchor at top/left 50% (container midpoint) and explode radially:
 *   X → random ±150px; Y → brief +40 kick then float to −180 while fading.
 */
import React, { memo, useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { BawaalEmoji } from '../../components/BawaalEmoji';

export const BURST_DURATION_MS = 2000;
export const BURST_PARTICLE_COUNT = 7;
export const BURST_MAX_PARTICLES = 42;
export const BURST_EMOJI_SIZE = 48;

/** Radial combat-zone spread */
export const BURST_X_SPREAD = 150;
export const BURST_KICK_Y = 40;
export const BURST_FLOAT_Y = -180;

let burstSeq = 0;

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

/**
 * Build particles that erupt radially from container midpoint (50%/50%).
 * targetX: −150…+150 · kickY: ~+40 · floatY: ~−180
 */
export function createEmojiBurstParticles(_originX, _originY, emojiKey, opts = {}) {
  const count = Math.max(4, Math.min(10, Number(opts.count) || BURST_PARTICLE_COUNT));
  const key = String(emojiKey || 'skull_orange_glow_v3').toLowerCase();

  const particles = [];
  for (let i = 0; i < count; i += 1) {
    burstSeq += 1;
    const targetX = randomBetween(-BURST_X_SPREAD, BURST_X_SPREAD);
    const kickY = BURST_KICK_Y + randomBetween(-8, 12);
    const floatY = BURST_FLOAT_Y + randomBetween(-30, 20);
    const delay = Math.floor(Math.random() * 80);
    const size = BURST_EMOJI_SIZE + Math.floor((Math.random() - 0.5) * 12);
    particles.push({
      id: `burst-${Date.now()}-${burstSeq}-${i}`,
      emojiKey: key,
      targetX,
      kickY,
      floatY,
      delay,
      duration: BURST_DURATION_MS,
      size,
    });
  }
  return particles;
}

/**
 * Spawn a centered radial burst over the measured video card.
 * @param {string} emojiKey
 */
export function createCenteredEmojiBurst(emojiKey, _containerLayout, opts = {}) {
  return createEmojiBurstParticles(0, 0, emojiKey, opts);
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
  targetX,
  kickY,
  floatY,
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
    inputRange: [0, 0.22, 1],
    outputRange: [0, kickY ?? BURST_KICK_Y, floatY ?? BURST_FLOAT_Y],
    extrapolate: 'clamp',
  });

  const dim = typeof size === 'number' && size > 0 ? size : BURST_EMOJI_SIZE;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.particle,
        {
          width: dim,
          height: dim,
          // Anchor glyph center on the 50%/50% point
          marginLeft: -dim / 2,
          marginTop: -dim / 2,
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
 * Absolute overlay matching the video card bounds.
 * Requires a position:relative parent with measured height (web-safe).
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
          targetX={p.targetX}
          kickY={p.kickY}
          floatY={p.floatY}
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
    pointerEvents: 'none',
    overflow: 'hidden',
    zIndex: 50,
  },
  particle: {
    position: 'absolute',
    top: '50%',
    left: '50%',
  },
});
