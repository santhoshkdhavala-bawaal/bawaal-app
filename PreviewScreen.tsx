/**
 * ChallengeCam post-record Preview — LOCKED.
 * Speed / slow-mo controls live here only (never on the live viewfinder).
 */
import React, { useCallback, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ResizeMode, Video } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BackLink from './src/components/BackLink';
import { sanitizePlayableFeedUri } from './src/services/uploadService';
import { safeUnloadExpoAvVideo } from './src/utils/safeUnloadVideo';

const BG = '#000000';
const WHITE = '#FFFFFF';
const MUTED = '#A0A0A0';
const ACCENT = '#3B82F6';
const CONTINUE = '#FACC15';
const REC_RED = '#FF0033';

export const PREVIEW_SPEED_OPTIONS = [
  { rate: 0.5, label: '0.5× SLOW-MO' },
  { rate: 1, label: '1× NORMAL' },
  { rate: 2, label: '2× FAST' },
] as const;

export type PreviewSpeedRate = (typeof PREVIEW_SPEED_OPTIONS)[number]['rate'];

type PreviewScreenProps = {
  uri: string;
  speedRate?: number;
  onSpeedChange?: (rate: number) => void;
  onRetake: () => void;
  /** Continue must receive the recorded URI so Arena posts keep a playable videoUri. */
  onContinue: (payload?: { videoUri: string; uri: string; localVideoUri: string }) => void;
  busy?: boolean;
  uploadPct?: number;
  error?: string | null;
  title?: string;
};

export default function PreviewScreen({
  uri,
  speedRate = 1,
  onSpeedChange,
  onRetake,
  onContinue,
  busy = false,
  uploadPct = 0,
  error = null,
  title = 'PREVIEW',
}: PreviewScreenProps) {
  const insets = useSafeAreaInsets();
  const videoRef = useRef<Video | null>(null);
  const topPad = Math.max(insets.top, 12);
  const bottomPad = Math.max(insets.bottom, 16) + 12;

  const applyRate = useCallback(async (rate: number) => {
    try {
      await videoRef.current?.setRateAsync?.(rate, true);
    } catch (err) {
      console.warn('[PreviewScreen] setRate failed:', (err as Error)?.message || err);
    }
  }, []);

  useEffect(() => {
    void applyRate(speedRate);
  }, [applyRate, speedRate, uri]);

  // Pause → stop → unload on unmount / URI change (camera → feed hand-off)
  useEffect(() => {
    const node = videoRef.current;
    return () => {
      void safeUnloadExpoAvVideo(node);
    };
  }, [uri]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />
      <Video
        ref={videoRef}
        style={StyleSheet.absoluteFill}
        source={{ uri }}
        resizeMode={ResizeMode.COVER}
        shouldPlay
        isLooping
        rate={speedRate}
        shouldCorrectPitch
        useNativeControls={false}
        onLoad={() => {
          void applyRate(speedRate);
        }}
        onError={(e) => {
          console.warn('[PreviewScreen] preview error', e);
        }}
      />

      <View style={[styles.topBar, { paddingTop: topPad }]} pointerEvents="box-none">
        <BackLink label="Back" onPress={busy ? () => {} : onRetake} />
        <View style={styles.topCenter}>
          <Text style={styles.topTitle}>{title}</Text>
          <Text style={styles.topSub}>Adjust speed · then continue</Text>
        </View>
        <View style={styles.topSpacer} />
      </View>

      <View style={[styles.footer, { paddingBottom: bottomPad }]}>
        <Text style={styles.speedHeading}>PLAYBACK SPEED</Text>
        <View style={styles.speedRow}>
          {PREVIEW_SPEED_OPTIONS.map((opt) => {
            const active = Math.abs(speedRate - opt.rate) < 0.001;
            return (
              <TouchableOpacity
                key={`speed-${opt.rate}`}
                style={[styles.speedChip, active && styles.speedChipActive]}
                onPress={() => onSpeedChange?.(opt.rate)}
                disabled={busy}
                activeOpacity={0.85}
              >
                <Text
                  style={[styles.speedChipText, active && styles.speedChipTextActive]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {busy ? (
          <Text style={styles.uploadHint}>
            {uploadPct > 0
              ? `UPLOADING TO CLOUD · ${Math.round(uploadPct)}%`
              : 'PREPARING UPLOAD…'}
          </Text>
        ) : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.retakeBtn}
            onPress={onRetake}
            disabled={busy}
            activeOpacity={0.85}
          >
            <Text style={styles.retakeBtnText}>RE-TAKE</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.continueBtn}
            onPress={() => {
              const safeUri = sanitizePlayableFeedUri(uri);
              if (!safeUri) {
                console.warn('[PreviewScreen] Continue blocked — invalid video URI');
                return;
              }
              onContinue({
                videoUri: safeUri,
                uri: safeUri,
                localVideoUri: safeUri,
              });
            }}
            disabled={busy}
            activeOpacity={0.85}
          >
            {busy ? (
              <ActivityIndicator color={BG} />
            ) : (
              <Text style={styles.continueBtnText}>CONTINUE</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 10,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  topCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  topTitle: {
    color: WHITE,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  topSub: {
    color: MUTED,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  topSpacer: {
    minWidth: 72,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 14,
    backgroundColor: 'rgba(0,0,0,0.78)',
  },
  speedHeading: {
    color: MUTED,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 10,
    textAlign: 'center',
  },
  speedRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 14,
  },
  speedChip: {
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.28)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  speedChipActive: {
    borderColor: CONTINUE,
    backgroundColor: 'rgba(250,204,21,0.16)',
  },
  speedChipText: {
    color: MUTED,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  speedChipTextActive: {
    color: CONTINUE,
  },
  uploadHint: {
    color: CONTINUE,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textAlign: 'center',
    marginBottom: 10,
  },
  errorText: {
    color: REC_RED,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  retakeBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: ACCENT,
    backgroundColor: 'rgba(59,130,246,0.14)',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  retakeBtnText: {
    color: ACCENT,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  continueBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: CONTINUE,
    backgroundColor: CONTINUE,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  continueBtnText: {
    color: BG,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
});
