/**
 * UniversalCamera — single CameraView creation engine for SPARKS / JOSH / BATTLE modes.
 * Expo SDK 58: CameraView + useCameraPermissions + useMicrophonePermissions.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
  type CameraType,
} from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CreationPostSheet from './PostCreationSheet';
import type {
  CreationMode,
  PostCreationPayload,
} from './PostCreationSheet';

export type { CreationMode, PostCreationPayload };

type NavLike = {
  goBack?: () => void;
  canGoBack?: () => boolean;
  navigate?: (name: string, params?: Record<string, unknown>) => void;
};

export type UniversalCameraProps = {
  navigation?: NavLike;
  route?: { params?: { initialMode?: CreationMode } & Record<string, unknown> };
  /** Optional initial mode (defaults to SPARKS). */
  initialMode?: CreationMode;
  onPublished?: (payload: PostCreationPayload) => void;
};

type ModeMeta = {
  id: CreationMode;
  label: string;
  shortLabel: string;
};

const MODE_STRIP: ModeMeta[] = [
  { id: 'SPARKS', label: '⚡ SPARKS', shortLabel: 'SPARKS' },
  { id: 'JOSH', label: '🔥 JOSH', shortLabel: 'JOSH' },
  { id: 'BATTLE_REWIND', label: '🥊 BATTLE REWIND', shortLabel: 'REWIND' },
  { id: 'BATTLE_BAWAAL', label: '⚔️ BATTLE BAWAAL', shortLabel: 'BAWAAL' },
];

function maxDurationFor(
  mode: CreationMode,
  joshUnlocked3m: boolean
): number {
  switch (mode) {
    case 'SPARKS':
      return 30;
    case 'JOSH':
      return joshUnlocked3m ? 180 : 60;
    case 'BATTLE_REWIND':
      return 60;
    case 'BATTLE_BAWAAL':
      return 0;
    default:
      return 30;
  }
}

export default function UniversalCamera({
  navigation,
  route,
  initialMode,
  onPublished,
}: UniversalCameraProps) {
  const insets = useSafeAreaInsets();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();

  const bootMode: CreationMode =
    initialMode ||
    (route?.params?.initialMode as CreationMode | undefined) ||
    'SPARKS';

  const [mode, setMode] = useState<CreationMode>(bootMode);
  const [isRecording, setIsRecording] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [joshUnlocked3m, setJoshUnlocked3m] = useState(false);
  const [facing, setFacing] = useState<CameraType>('back');
  const [recordedVideoUri, setRecordedVideoUri] = useState<string | null>(null);
  const [showPostSheet, setShowPostSheet] = useState(false);

  const cameraRef = useRef<CameraView>(null);
  const recordingLockRef = useRef(false);

  const maxDuration = useMemo(
    () => maxDurationFor(mode, joshUnlocked3m),
    [mode, joshUnlocked3m]
  );

  useEffect(() => {
    if (cameraPermission && !cameraPermission.granted) {
      void requestCameraPermission();
    }
    if (micPermission && !micPermission.granted) {
      void requestMicPermission();
    }
  }, [
    cameraPermission,
    micPermission,
    requestCameraPermission,
    requestMicPermission,
  ]);

  const handleClose = useCallback(() => {
    if (isRecording) {
      try {
        cameraRef.current?.stopRecording();
      } catch {
        /* ignore */
      }
    }
    if (navigation?.canGoBack?.()) navigation.goBack?.();
    else navigation?.navigate?.('Main', { tab: 'Arena' });
  }, [isRecording, navigation]);

  const handleModeChange = useCallback(
    (next: CreationMode) => {
      if (isRecording || recordingLockRef.current) return;
      setMode(next);
    },
    [isRecording]
  );

  const handleToggle3mExtension = useCallback(() => {
    if (isRecording) return;

    if (joshUnlocked3m) {
      setJoshUnlocked3m(false);
      return;
    }

    Alert.alert(
      '🔥 Unlock 3-Minute Josh Reel',
      'Extend your reel limit to 180 seconds for 10 BAWAAL Coins.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unlock (10 Coins)',
          onPress: () => setJoshUnlocked3m(true),
        },
      ]
    );
  }, [isRecording, joshUnlocked3m]);

  const navigateToLiveArena = useCallback(() => {
    navigation?.navigate?.('ChallengerArena', {
      mode: 'athlete',
      role: 'host',
    });
  }, [navigation]);

  const startRecording = useCallback(async () => {
    if (mode === 'BATTLE_BAWAAL') {
      navigateToLiveArena();
      return;
    }

    if (
      !cameraRef.current ||
      !isCameraReady ||
      isRecording ||
      recordingLockRef.current
    ) {
      return;
    }

    recordingLockRef.current = true;
    setIsRecording(true);

    try {
      const video = await cameraRef.current.recordAsync({
        maxDuration,
      });

      const uri = video?.uri ?? null;
      if (uri) {
        setRecordedVideoUri(uri);
        setShowPostSheet(true);
      }
    } catch (e) {
      console.error('[UniversalCamera] Recording error:', e);
      Alert.alert('Recording failed', 'Could not save this clip. Try again.');
    } finally {
      setIsRecording(false);
      recordingLockRef.current = false;
    }
  }, [mode, isCameraReady, isRecording, maxDuration, navigateToLiveArena]);

  const stopRecording = useCallback(() => {
    if (!isRecording) return;
    try {
      cameraRef.current?.stopRecording();
    } catch (e) {
      console.warn('[UniversalCamera] stopRecording:', e);
    }
  }, [isRecording]);

  const handleShutter = useCallback(() => {
    if (mode === 'BATTLE_BAWAAL') {
      navigateToLiveArena();
      return;
    }
    if (isRecording) stopRecording();
    else void startRecording();
  }, [mode, isRecording, navigateToLiveArena, stopRecording, startRecording]);

  const flipCamera = useCallback(() => {
    if (isRecording) return;
    setFacing((prev) => (prev === 'back' ? 'front' : 'back'));
  }, [isRecording]);

  const permissionsPending =
    cameraPermission == null || micPermission == null;
  const permissionsGranted =
    Boolean(cameraPermission?.granted) && Boolean(micPermission?.granted);

  if (permissionsPending) {
    return (
      <View style={styles.permissionContainer}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator color="#FF5722" size="large" />
        <Text style={styles.permissionText}>Preparing camera…</Text>
      </View>
    );
  }

  if (!permissionsGranted) {
    return (
      <View style={styles.permissionContainer}>
        <StatusBar barStyle="light-content" />
        <Text style={styles.permissionText}>
          Camera and Microphone access needed for BAWAAL creation.
        </Text>
        <TouchableOpacity
          style={styles.permissionBtn}
          onPress={() => {
            void requestCameraPermission();
            void requestMicPermission();
          }}
          activeOpacity={0.9}
        >
          <Text style={styles.btnText}>Grant Permissions</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        mode="video"
        mute={false}
        onCameraReady={() => setIsCameraReady(true)}
        onMountError={(err) => {
          console.warn('[UniversalCamera] mount error:', err?.message);
          Alert.alert('Camera Error', err?.message || 'Could not start camera.');
        }}
      />

      {/* Full overlay — absolute fill so chrome stays above the native preview */}
      <View
        pointerEvents="box-none"
        style={[styles.absoluteFill, styles.overlayRoot]}
      >
        {/* Header */}
        <View
          style={[
            styles.topBar,
            { paddingTop: Math.max(insets.top, 12) },
          ]}
        >
          <TouchableOpacity
            onPress={handleClose}
            style={styles.iconBtn}
            accessibilityLabel="Close camera"
            activeOpacity={0.85}
          >
            <Text style={styles.iconText}>✕</Text>
          </TouchableOpacity>

          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>
              {mode === 'BATTLE_BAWAAL'
                ? '🔴 BATTLE BAWAAL'
                : isRecording
                  ? '● REC'
                  : `⏱️ MAX ${maxDuration}s`}
            </Text>
          </View>

          <TouchableOpacity
            onPress={flipCamera}
            style={styles.iconBtn}
            accessibilityLabel="Flip camera"
            activeOpacity={0.85}
            disabled={isRecording}
          >
            <Text style={styles.iconText}>🔄</Text>
          </TouchableOpacity>
        </View>

        {/* JOSH 3-minute unlock */}
        {mode === 'JOSH' && !isRecording && (
          <TouchableOpacity
            style={styles.paidToggleBtn}
            onPress={handleToggle3mExtension}
            activeOpacity={0.9}
          >
            <Text style={styles.paidToggleText}>
              {joshUnlocked3m
                ? '⚡ 3 MIN UNLOCKED (180s)'
                : '🔒 UNLOCK 3 MIN (10 Coins)'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Shutter + mode strip (strip sits below shutter) */}
        <View
          style={[
            styles.bottomControls,
            { paddingBottom: Math.max(insets.bottom, 16) },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.shutterOuter,
              isRecording && styles.shutterRecording,
              mode === 'BATTLE_BAWAAL' && styles.shutterLive,
            ]}
            onPress={handleShutter}
            activeOpacity={0.85}
            accessibilityLabel={
              mode === 'BATTLE_BAWAAL'
                ? 'Go live to Battle Bawaal arena'
                : isRecording
                  ? 'Stop recording'
                  : 'Start recording'
            }
          >
            <View
              style={[
                styles.shutterInner,
                isRecording && styles.shutterSquare,
                mode === 'BATTLE_BAWAAL' && styles.shutterInnerLive,
              ]}
            />
          </TouchableOpacity>

          <View style={styles.modeStrip}>
            {MODE_STRIP.map((item) => {
              const active = mode === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.modeChip}
                  onPress={() => handleModeChange(item.id)}
                  disabled={isRecording}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.modeText,
                      active && styles.activeModeText,
                      isRecording && !active && styles.modeTextDim,
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>

      <Modal
        visible={showPostSheet}
        animationType="slide"
        transparent
        onRequestClose={() => setShowPostSheet(false)}
      >
        <CreationPostSheet
          mode={mode}
          videoUri={recordedVideoUri}
          onClose={() => setShowPostSheet(false)}
          onSuccess={(payload) => {
            setShowPostSheet(false);
            if (payload) onPublished?.(payload);
            if (navigation?.canGoBack?.()) navigation.goBack?.();
            else navigation?.navigate?.('Main', { tab: 'Arena' });
          }}
        />
      </Modal>
    </View>
  );
}

/** Mirrors StyleSheet.absoluteFillObject (typed as absoluteFill on this RN version). */
const ABSOLUTE_FILL = {
  position: 'absolute' as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  absoluteFill: {
    ...ABSOLUTE_FILL,
  },
  camera: {
    ...ABSOLUTE_FILL,
  },
  overlayRoot: {
    justifyContent: 'space-between',
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: '#0A0E1A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 16,
  },
  permissionText: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  permissionBtn: {
    backgroundColor: '#FF5722',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 10,
  },
  btnText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(10, 14, 26, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  iconText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  durationBadge: {
    backgroundColor: 'rgba(10, 14, 26, 0.78)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 87, 34, 0.45)',
  },
  durationText: {
    color: '#FF5722',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.4,
  },
  paidToggleBtn: {
    alignSelf: 'center',
    backgroundColor: '#FF5722',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    marginTop: 10,
  },
  paidToggleText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  bottomControls: {
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  shutterOuter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  shutterRecording: {
    borderColor: '#FF5722',
  },
  shutterLive: {
    borderColor: '#00BCD4',
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FF5722',
  },
  shutterSquare: {
    width: 30,
    height: 30,
    borderRadius: 6,
    backgroundColor: '#FF5722',
  },
  shutterInnerLive: {
    backgroundColor: '#00BCD4',
    borderRadius: 30,
  },
  modeStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 6,
    gap: 4,
  },
  modeChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
  },
  modeText: {
    color: '#8A99AD',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  activeModeText: {
    color: '#00BCD4',
    borderBottomWidth: 2,
    borderBottomColor: '#00BCD4',
    paddingBottom: 3,
  },
  modeTextDim: {
    opacity: 0.45,
  },
});
