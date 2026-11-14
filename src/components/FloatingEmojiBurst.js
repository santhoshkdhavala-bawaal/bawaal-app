/**
 * Floating vault emoji burst — proprietary BawaalEmoji particles only.
 *
 * Spawn origin is the **window center** via Dimensions.get('window'):
 *   startX = width / 2
 *   startY = height / 2
 * Converted into the absolute-fill overlay's local space so particles are not
 * stuck at container top (0). Radial spread then drifts up and fades ~2s.
 */
import React, {
  forwardRef,
  memo,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import { Animated, Dimensions, StyleSheet, View } from 'react-native';
import { BawaalEmoji } from '../../components/BawaalEmoji';

export const BURST_DURATION_MS = 2000;
export const BURST_PARTICLE_COUNT = 7;
export const BURST_MAX_PARTICLES = 42;
export const BURST_EMOJI_SIZE = 48;
/** Random initial offset from center: Math.random() * 100 - 50 → [-50, 50] */
export const BURST_CENTER_JITTER = 50;

let burstSeq = 0;

function randomCenterOffset() {
  return Math.random() * 100 - 50;
}

/**
 * Explicit window-center origin — never defaults to top/left (0, 0).
 * startX = Dimensions.get('window').width / 2
 * startY = Dimensions.get('window').height / 2
 */
export function getWindowCenterOrigin() {
  const { width, height } = Dimensions.get('window');
  const w = width > 0 ? width : 390;
  const h = height > 0 ? height : 844;
  return {
    width: w,
    height: h,
    startX: w / 2,
    startY: h / 2,
  };
}

/** @deprecated alias — always window center now */
export function getCanvasCenterOrigin() {
  return getWindowCenterOrigin();
}

/**
 * Convert window-center coords into the burst overlay's local space.
 * layerWindowX/Y = overlay's top-left in window coords (from measureInWindow).
 */
export function windowCenterToLocal(layerWindowX = 0, layerWindowY = 0) {
  const { startX, startY, width, height } = getWindowCenterOrigin();
  const lx = Number(layerWindowX);
  const ly = Number(layerWindowY);
  return {
    width,
    height,
    startX: startX - (Number.isFinite(lx) ? lx : 0),
    startY: startY - (Number.isFinite(ly) ? ly : 0),
  };
}

/**
 * Build particles at local (startX, startY) with radial outward spread.
 */
export function createEmojiBurstParticles(originX, originY, emojiKey, opts = {}) {
  const count = Math.max(4, Math.min(10, Number(opts.count) || BURST_PARTICLE_COUNT));
  const key = String(emojiKey || 'skull_orange_glow_v3').toLowerCase();
  const win = getWindowCenterOrigin();
  const startX = Number.isFinite(Number(originX)) ? Number(originX) : win.startX;
  const startY = Number.isFinite(Number(originY)) ? Number(originY) : win.startY;

  const particles = [];
  for (let i = 0; i < count; i += 1) {
    burstSeq += 1;
    const offsetX = randomCenterOffset();
    const offsetY = randomCenterOffset();
    // Radial spread from center in all directions
    const baseAngle = (i / count) * Math.PI * 2;
    const angle = baseAngle + (Math.random() - 0.5) * 0.5;
    const outward = 80 + Math.random() * 120;
    const radialX = Math.cos(angle) * outward;
    const radialY = Math.sin(angle) * outward;
    // Drift = radial burst + upward float (negative Y)
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
 * Spawn using Dimensions.get('window') center, mapped into overlay local space.
 * @param {string} emojiKey
 * @param {{ x?: number, y?: number } | null} layerWindowOrigin measureInWindow of overlay
 */
export function createCenteredEmojiBurst(emojiKey, layerWindowOrigin, opts = {}) {
  const local = windowCenterToLocal(
    layerWindowOrigin?.x,
    layerWindowOrigin?.y
  );
  return createEmojiBurstParticles(local.startX, local.startY, emojiKey, {
    ...opts,
    width: local.width,
    height: local.height,
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
 * Full-window-style absolute overlay over the video player.
 * ref.measureInWindow() used so spawn maps window center → local coords.
 */
export const FloatingEmojiBurstLayer = memo(
  forwardRef(function FloatingEmojiBurstLayer(
    { particles, onParticleDone, style },
    ref
  ) {
    const layerRef = useRef(null);

    useImperativeHandle(ref, () => ({
      /**
       * Measure overlay top-left in window space for window-center → local mapping.
       * @returns {Promise<{ x: number, y: number, width: number, height: number }>}
       */
      measureWindowOrigin() {
        return new Promise((resolve) => {
          const node = layerRef.current;
          if (!node?.measureInWindow) {
            resolve({ x: 0, y: 0, width: 0, height: 0 });
            return;
          }
          node.measureInWindow((x, y, width, height) => {
            resolve({
              x: Number(x) || 0,
              y: Number(y) || 0,
              width: Number(width) || 0,
              height: Number(height) || 0,
            });
          });
        });
      },
    }));

    return (
      <View
        ref={layerRef}
        pointerEvents="none"
        collapsable={false}
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
  })
);

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
