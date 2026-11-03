/**
 * Cinematic athletic overlay for expo-video players.
 * Play / Pause / Stop / Slow-Mo + BAWAAL HD status tag + edge gradients.
 */
import React, { memo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const WHITE = '#FFFFFF';
const ORANGE = '#FF4500';
const BAR_BG = 'rgba(0,0,0,0.72)';
const EDGE = 'rgba(0,0,0,0.55)';

function BawaalVideoControls({
  isPlaying = true,
  isSlowMo = false,
  onTogglePlay,
  onStop,
  onToggleSlowMo,
  statusLabel = 'BAWAAL HD',
  showStatus = true,
  compact = false,
  /** Lift the bar above captions / engage chrome on feed cards. */
  bottomOffset = 14,
}) {
  return (
    <View style={styles.root} pointerEvents="box-none">
      {/* Cinematic edge frames — keep text/controls readable on any clip */}
      <View style={styles.edgeTop} pointerEvents="none" />
      <View style={styles.edgeBottom} pointerEvents="none" />
      <View style={styles.edgeLeft} pointerEvents="none" />
      <View style={styles.edgeRight} pointerEvents="none" />

      {showStatus ? (
        <View style={styles.statusTag} pointerEvents="none">
          <View style={styles.statusGlow} />
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>{statusLabel}</Text>
        </View>
      ) : null}

      <View
        style={[
          styles.bar,
          compact && styles.barCompact,
          { bottom: bottomOffset },
        ]}
      >
        <TouchableOpacity
          style={styles.btn}
          onPress={onTogglePlay}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
        >
          <Text style={styles.btnIcon}>{isPlaying ? '❚❚' : '▶'}</Text>
          <Text style={styles.btnLabel}>{isPlaying ? 'PAUSE' : 'PLAY'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.btn}
          onPress={onStop}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Stop and reset"
        >
          <Text style={styles.btnIcon}>■</Text>
          <Text style={styles.btnLabel}>STOP</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, styles.slowBtn, isSlowMo && styles.slowBtnActive]}
          onPress={onToggleSlowMo}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={isSlowMo ? 'Disable slow motion' : 'Enable slow motion'}
        >
          <Text style={[styles.btnLabel, isSlowMo && styles.slowLabelActive]}>
            {isSlowMo ? '0.5× SLOW' : '1× SPEED'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 8,
  },
  edgeTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 72,
    backgroundColor: EDGE,
  },
  edgeBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 110,
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  edgeLeft: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 10,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  edgeRight: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: 10,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  statusTag: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255,69,0,0.55)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    overflow: 'hidden',
  },
  statusGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,69,0,0.12)',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: ORANGE,
    shadowColor: ORANGE,
    shadowOpacity: 0.95,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  statusText: {
    color: WHITE,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  bar: {
    position: 'absolute',
    left: 12,
    right: 56,
    bottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: BAR_BG,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  barCompact: {
    right: 12,
    bottom: 10,
    paddingVertical: 6,
  },
  btn: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  btnIcon: {
    color: WHITE,
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 2,
  },
  btnLabel: {
    color: WHITE,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  slowBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  slowBtnActive: {
    backgroundColor: ORANGE,
    borderColor: ORANGE,
  },
  slowLabelActive: {
    color: WHITE,
  },
});

export default memo(BawaalVideoControls);
