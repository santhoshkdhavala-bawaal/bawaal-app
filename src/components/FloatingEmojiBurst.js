/**
 * Floating vault emoji burst — proprietary BawaalEmoji particles only.
 *
 * Origin: absolute center over the video/arena container (top 40% · left 50%).
 * Particles spawn at that point and radiate outward (X spread + kick/float Y).
 */
import React, { memo, useEffect, useRef } from 'react';
import { Animated, Dimensions, StyleSheet, View } from 'react-native';
import { BawaalEmoji } from '../../components/BawaalEmoji';

export const BURST_DURATION_MS = 2000;
export const BURST_PARTICLE_COUNT = 7;
export const BURST_MAX_PARTICLES = 42;
export const BURST_EMOJI_SIZE = 48;

/** Horizontal radial spread (px) */
export const BURST_X_SPREAD = 150;
/** Initial outward / downward pop (px) */
export const BURST_KICK_Y = 40;
/** Final upward float target (px) */
export const BURST_FLOAT_Y = -180;
/**
 * Vertical anchor over the video action zone (matches origin `top: '40%'`).
 */
export const BURST_CENTER_Y_RATIO = 0.4;

/** @deprecated Prefer BURST_CENTER_Y_RATIO; kept for call-site compatibility */
export const BURST_CENTER_Y_BIAS = 0;

let burstSeq = 0;

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

/**
 * Burst anchor of measured container bounds (width/2, height * 0.4).
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
 * Build particles at origin-relative startX/startY (0,0 = overlay center).
 * targetX: random horizontal spread · kickY → floatY vertical arc
 */
export function createEmojiBurstParticles(originX, originY, emojiKey, opts = {}) {
  const count = Math.max(4, Math.min(10, Number(opts.count) || BURST_PARTICLE_COUNT));
  const key = String(emojiKey || 'skull_orange_glow_v3').toLowerCase();
  const startX = Number.isFinite(Number(originX)) ? Number(originX) : 0;
  const startY = Number.isFinite(Number(originY)) ? Number(originY) : 0;

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
      startX,
      startY,
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
 * Spawn at video-centered origin (origin-relative 0,0 → top 40% / left 50%).
 * @param {string} emojiKey
 * @param {{ width?: number, height?: number, containerWidth?: number, containerHeight?: number } | null} [_containerSize]
 */
export function createCenteredEmojiBurst(emojiKey, _containerSize, opts = {}) {
  return createEmojiBurstParticles(0, 0, emojiKey, opts);
}

/**
 * Spawn vault particles over both fighter midpoints as offsets from overlay center.
 *
 * @param {string} emojiKey
 * @param {{ x?: number, y?: number, width?: number, height?: number } | null} hostPane
 * @param {{ x?: number, y?: number, width?: number, height?: number } | null} rivalPane
 * @param {{ width?: number, height?: number } | null} containerSize
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
    // Offsets from overlay center so particles still parent under the 50%/50% origin
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
  const sx = Number.isFinite(Number(startX)) ? Number(startX) : 0;
  const sy = Number.isFinite(Number(startY)) ? Number(startY) : 0;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.particle,
        {
          // Origin-relative: (0,0) is overlay center; offset by half emoji size
          left: sx - dim / 2,
          top: sy - dim / 2,
          marginLeft: 0,
          marginTop: 0,
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
 * Full-bleed overlay with an absolute center origin — particles spawn there.
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
      <View style={styles.origin} pointerEvents="none">
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
    zIndex: 9999,
    pointerEvents: 'none',
    overflow: 'hidden',
  },
  /**
   * Spawn hub centered over the video feed.
   * 0×0 point at top/left 40%/50% — equivalent to CSS translate(-50%, -50%)
   * on a zero-size node (RN % transforms are unreliable cross-platform).
   */
  origin: {
    position: 'absolute',
    top: '40%',
    left: '50%',
    width: 0,
    height: 0,
    marginLeft: 0,
    marginTop: 0,
    overflow: 'visible',
  },
  particle: {
    position: 'absolute',
  },
});
