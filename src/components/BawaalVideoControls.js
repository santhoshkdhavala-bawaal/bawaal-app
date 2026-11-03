/**
 * Preview-only athletic video controls (recorder / publish review).
 * Never mount on Arena feed — center play/pause + bottom speed scroller only.
 */
import React, { memo } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const WHITE = '#FFFFFF';
const ORANGE = '#FF4500';
const MUTED = 'rgba(255,255,255,0.55)';

/** Athletic breakdown rates for pre-publish review. */
export const PREVIEW_SPEED_RATES = [1, 0.75, 0.5];

function formatRateLabel(rate) {
  const n = Number(rate);
  if (!Number.isFinite(n)) return '1×';
  if (Math.abs(n - 1) < 0.001) return '1×';
  if (Math.abs(n - 0.75) < 0.001) return '0.75×';
  if (Math.abs(n - 0.5) < 0.001) return '0.5×';
  return `${n}×`;
}

/**
 * @param {object} props
 * @param {boolean} props.isPlaying
 * @param {number} [props.playbackRate]
 * @param {() => void} props.onTogglePlay
 * @param {(rate: number) => void} props.onSelectRate
 * @param {number[]} [props.rates]
 */
function BawaalVideoControls({
  isPlaying = true,
  playbackRate = 1,
  onTogglePlay,
  onSelectRate,
  rates = PREVIEW_SPEED_RATES,
}) {
  const activeRate = Number(playbackRate) || 1;

  return (
    <View style={styles.root} pointerEvents="box-none">
      {/* Soft vignette so the center control pops on bright clips */}
      <View style={styles.vignette} pointerEvents="none" />

      <TouchableOpacity
        style={styles.centerHit}
        onPress={onTogglePlay}
        activeOpacity={0.88}
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? 'Pause preview' : 'Play preview'}
      >
        <View style={styles.playCircle}>
          <View style={styles.playRing} />
          <Text style={styles.playIcon}>{isPlaying ? '❚❚' : '▶'}</Text>
        </View>
      </TouchableOpacity>

      <View style={styles.speedDock} pointerEvents="box-none">
        <Text style={styles.speedHint}>SPEED · SLOW-MO</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.speedRow}
          keyboardShouldPersistTaps="handled"
        >
          {(rates || PREVIEW_SPEED_RATES).map((rate) => {
            const active = Math.abs(activeRate - rate) < 0.001;
            const isSlow = rate < 1;
            return (
              <TouchableOpacity
                key={`rate-${rate}`}
                style={[
                  styles.speedChip,
                  active && styles.speedChipActive,
                  active && isSlow && styles.speedChipSlow,
                ]}
                onPress={() => onSelectRate?.(rate)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${formatRateLabel(rate)} playback`}
              >
                <Text
                  style={[
                    styles.speedText,
                    active && styles.speedTextActive,
                  ]}
                >
                  {formatRateLabel(rate)}
                </Text>
                {isSlow ? (
                  <Text
                    style={[
                      styles.speedSub,
                      active && styles.speedSubActive,
                    ]}
                  >
                    SLOW
                  </Text>
                ) : (
                  <Text
                    style={[
                      styles.speedSub,
                      active && styles.speedSubActive,
                    ]}
                  >
                    NORMAL
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 8,
  },
  vignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  centerHit: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 36,
  },
  playCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  playRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: 'rgba(255,69,0,0.35)',
  },
  playIcon: {
    color: WHITE,
    fontSize: 22,
    fontWeight: '900',
    marginLeft: 2,
  },
  speedDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 10,
    paddingHorizontal: 12,
  },
  speedHint: {
    color: MUTED,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: 8,
    marginLeft: 4,
  },
  speedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 8,
  },
  speedChip: {
    minWidth: 78,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
  },
  speedChipActive: {
    borderColor: WHITE,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  speedChipSlow: {
    borderColor: ORANGE,
    backgroundColor: 'rgba(255,69,0,0.22)',
  },
  speedText: {
    color: MUTED,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  speedTextActive: {
    color: WHITE,
  },
  speedSub: {
    marginTop: 2,
    color: MUTED,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1,
  },
  speedSubActive: {
    color: WHITE,
  },
});

export default memo(BawaalVideoControls);
