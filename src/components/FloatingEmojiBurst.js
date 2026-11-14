/**
 * Floating vault emoji burst — proprietary BawaalEmoji particles only.
 *
 * Flex-centered overlay on the video card:
 *   absolute fill + justifyContent/alignItems center
 * Particles start at dead center (translateX: 0, translateY: 0) and spring
 * outward via interpolated targetX / targetY (~2s fade).
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

let burstSeq = 0;

function randomJitter() {
  return Math.random() * (BURST_CENTER_JITTER * 2) - BURST_CENTER_JITTER;
}

/**
 * Build particles that erupt from flex dead-center (0, 0).
 * targetX spreads left/right; targetY drifts upward.
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
    // Left/right spread from center
    const targetX = Math.cos(angle) * outward + randomJitter() * 0.4;
    // Outward + upward drift
    const targetY =
      Math.sin(angle) * outward * 0.85 -
      BURST_UPWARD_BIAS -
      Math.random() * 60;
    const delay = Math.floor(Math.random() * 80);
    const size = BURST_EMOJI_SIZE + Math.floor((Math.random() - 0.5) * 12);
    particles.push({
      id: `burst-${Date.now()}-${burstSeq}-${i}`,
      emojiKey: key,
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
 * Spawn a flex-centered burst (origin is layout midpoint via flex, not coords).
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
  });
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, targetX || 0],
  });
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, targetY || 0],
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
 * Absolute flex-centered overlay spanning the video card.
 * Particles sit at the layout midpoint and erupt via translate.
 */
export const FloatingEmojiBurstLayer = memo(function FloatingEmojiBurstLayer({
  particles,
  onParticleDone,
  style,
}) {
  return (
    <View pointerEvents="none" collapsable={false} style={[styles.layer, style]}>
      {/* 0×0 flex origin pinned at visual center of the card */}
      <View style={styles.origin} pointerEvents="none" collapsable={false}>
        {(particles || []).map((p) => (
          <FloatingEmojiParticle
            key={p.id}
            id={p.id}
            emojiKey={p.emojiKey}
            targetX={p.targetX}
            targetY={p.targetY}
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
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
    zIndex: 50,
    overflow: 'hidden',
  },
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
