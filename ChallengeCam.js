import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  SafeAreaView,
  StatusBar,
  Dimensions,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';

const { width } = Dimensions.get('window');

export default function ChallengeCam({
  route,
  navigation,
  targetUser,
  onClose,
  onVideoCaptured,
}) {
  const cameraRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [isRecording, setIsRecording] = useState(false);
  const [timerCount, setTimerCount] = useState(0);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [facing, setFacing] = useState('back');
  const [cameraReady, setCameraReady] = useState(false);
  const [recordedUri, setRecordedUri] = useState(null);
  const [mountError, setMountError] = useState(null);

  const challengeTarget = route?.params?.target || '140 KG x 3 Reps';
  const opponentHandle =
    targetUser ||
    route?.params?.handle ||
    '@Yuki_Lift';
  const displayHandle = opponentHandle.startsWith('@')
    ? opponentHandle
    : `@${opponentHandle}`;

  useEffect(() => {
    let interval = null;
    if (isRecording) {
      interval = setInterval(() => {
        setTimerCount((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(interval);
      setTimerCount(0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const handleClose = () => {
    if (onClose) {
      onClose();
      return;
    }
    if (navigation?.goBack) {
      navigation.goBack();
    }
  };

  const handleRecordPress = async () => {
    if (!cameraRef.current || !cameraReady) {
      return;
    }

    if (isRecording) {
      cameraRef.current.stopRecording();
      return;
    }

    try {
      setIsRecording(true);
      const video = await cameraRef.current.recordAsync({
        maxDuration: 60,
      });
      setIsRecording(false);

      if (video?.uri) {
        setRecordedUri(video.uri);
        setShowSuccessModal(true);
      }
    } catch (error) {
      setIsRecording(false);
      console.warn('Recording failed:', error?.message || error);
    }
  };

  const handleModalCloseAndNavigate = () => {
    setShowSuccessModal(false);
    if (onVideoCaptured && recordedUri) {
      onVideoCaptured(recordedUri);
      return;
    }
    if (onClose) {
      onClose();
      return;
    }
    if (navigation?.navigate) {
      navigation.navigate('Arena');
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const permissionsLoading = !permission || !micPermission;
  const permissionsGranted = permission?.granted && micPermission?.granted;

  const requestAllPermissions = async () => {
    if (!permission?.granted) {
      await requestPermission();
    }
    if (!micPermission?.granted) {
      await requestMicPermission();
    }
  };

  if (permissionsLoading) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <ActivityIndicator color="#ff8c00" size="large" />
        <Text style={styles.permissionHint}>Checking camera permissions…</Text>
      </SafeAreaView>
    );
  }

  if (!permissionsGranted) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <StatusBar barStyle="light-content" backgroundColor="#070a12" />
        <Text style={styles.permissionTitle}>Camera access required</Text>
        <Text style={styles.permissionHint}>
          BAWAAL needs camera and microphone access to record your battle response.
        </Text>
        <TouchableOpacity style={styles.permissionBtn} onPress={requestAllPermissions}>
          <Text style={styles.permissionBtnText}>GRANT PERMISSIONS</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={handleClose}>
          <Text style={styles.headerBtnText}>CANCEL</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#070a12" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={handleClose}>
          <Text style={styles.headerBtnText}>✕ CANCEL</Text>
        </TouchableOpacity>
        <Text style={styles.brandTitle}>BAWAAL</Text>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
          disabled={isRecording}
        >
          <Text style={styles.headerBtnText}>🔄 {facing.toUpperCase()}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.splitContainer}>
        <View style={styles.cardHalf}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.pillDark}>
              <Text style={styles.pillDarkText}>ORIGINAL POST</Text>
            </View>
            <View style={styles.pillOrange}>
              <Text style={styles.pillOrangeText}>{displayHandle}</Text>
            </View>
          </View>

          <View style={styles.mediaPlaceholder}>
            <Text style={styles.placeholderText}>▶ [ Original Reel Playing ]</Text>
          </View>

          <View style={styles.targetBadge}>
            <Text style={styles.targetBadgeText}>TARGET: 🏋️ {challengeTarget}</Text>
          </View>
        </View>

        <View style={styles.vsBadgeContainer}>
          <View style={styles.vsBadge}>
            <Text style={styles.vsBadgeText}>VS</Text>
          </View>
        </View>

        <View style={styles.cardHalf}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.pillDark}>
              <Text style={styles.pillDarkText}>YOUR RESPONSE</Text>
            </View>
            <View style={[styles.pillDark, isRecording && styles.pillRecording]}>
              <Text style={styles.pillDarkText}>
                {isRecording ? `🔴 ${formatTime(timerCount)}` : 'READY'}
              </Text>
            </View>
          </View>

          {/* Native CameraView — requires a development build on Android */}
          <View style={[styles.cameraViewport, isRecording && styles.viewportRecording]}>
            <CameraView
              ref={cameraRef}
              style={styles.camera}
              facing={facing}
              mode="video"
              mute={false}
              mirror={facing === 'front'}
              onCameraReady={() => {
                setCameraReady(true);
                setMountError(null);
              }}
              onMountError={(event) => {
                setMountError(event?.message || 'Camera failed to start');
                setCameraReady(false);
              }}
            />

            <View style={styles.viewFinderGrid} pointerEvents="none">
              <View style={[styles.cornerTL, isRecording && styles.cornerActive]} />
              <View style={[styles.cornerTR, isRecording && styles.cornerActive]} />
              <View style={[styles.cornerBL, isRecording && styles.cornerActive]} />
              <View style={[styles.cornerBR, isRecording && styles.cornerActive]} />
            </View>

            {!cameraReady && !mountError && (
              <View style={styles.cameraOverlayCenter} pointerEvents="none">
                <ActivityIndicator color="#ff8c00" />
                <Text style={styles.cameraLiveText}>STARTING LENS…</Text>
              </View>
            )}

            {mountError && (
              <View style={styles.cameraOverlayCenter}>
                <Text style={styles.cameraLiveText}>CAMERA ERROR</Text>
                <Text style={styles.cameraSubText}>{mountError}</Text>
                {Platform.OS === 'android' && (
                  <Text style={styles.cameraSubText}>
                    Use a development build (`npx expo run:android`), not Expo Go.
                  </Text>
                )}
              </View>
            )}
          </View>
        </View>
      </View>

      <View style={styles.bottomControlsArea}>
        <TouchableOpacity
          style={[styles.recordOuterRing, !cameraReady && styles.recordDisabled]}
          onPress={handleRecordPress}
          disabled={!cameraReady}
        >
          <View style={[styles.recordInnerBtn, isRecording && styles.recordingSquare]} />
        </TouchableOpacity>
        <Text style={styles.recordHintText}>
          {isRecording ? 'Tap to Stop & Preview' : 'Tap Orange Button to Record'}
        </Text>
      </View>

      <Modal
        visible={showSuccessModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderBadge}>
              <Text style={styles.modalHeaderBadgeText}>BAWAAL ARENA ⚡</Text>
            </View>
            <Text style={styles.modalTitle}>Challenge Recorded! 🔥</Text>
            <Text style={styles.modalSub}>
              Your side-by-side battle response is locked and ready for the arena.
            </Text>
            <TouchableOpacity
              style={styles.modalActionBtn}
              onPress={handleModalCloseAndNavigate}
            >
              <Text style={styles.modalActionBtnText}>UPLOAD TO ARENA ⚡</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070a12',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  permissionTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 8,
    textAlign: 'center',
  },
  permissionHint: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 20,
    lineHeight: 20,
  },
  permissionBtn: {
    backgroundColor: '#ff8c00',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 12,
  },
  permissionBtnText: {
    color: '#070a12',
    fontSize: 15,
    fontWeight: '900',
  },
  secondaryBtn: {
    backgroundColor: '#111827',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1f293d',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerBtn: {
    backgroundColor: '#111827',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1f293d',
  },
  headerBtnText: {
    color: '#94a3b8',
    fontWeight: '700',
    fontSize: 12,
  },
  brandTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  splitContainer: {
    flex: 1,
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },
  cardHalf: {
    flex: 0.48,
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
    position: 'relative',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  pillDark: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  pillRecording: {
    backgroundColor: '#ef4444',
  },
  pillDarkText: {
    color: '#e2e8f0',
    fontSize: 11,
    fontWeight: '700',
  },
  pillOrange: {
    backgroundColor: '#ff8c00',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  pillOrangeText: {
    color: '#070a12',
    fontSize: 11,
    fontWeight: '800',
  },
  mediaPlaceholder: {
    flex: 1,
    backgroundColor: '#070a12',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraViewport: {
    flex: 1,
    backgroundColor: '#000000',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#334155',
    position: 'relative',
    // Avoid overflow:'hidden' clipping Android SurfaceView; clip via borderRadius only.
  },
  camera: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
  },
  viewportRecording: {
    borderColor: '#ef4444',
    borderWidth: 2,
  },
  viewFinderGrid: {
    ...StyleSheet.absoluteFillObject,
    margin: 12,
  },
  cornerTL: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 16,
    height: 16,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderColor: '#64748b',
  },
  cornerTR: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 16,
    height: 16,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderColor: '#64748b',
  },
  cornerBL: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 16,
    height: 16,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderColor: '#64748b',
  },
  cornerBR: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 16,
    height: 16,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderColor: '#64748b',
  },
  cornerActive: {
    borderColor: '#ef4444',
  },
  cameraOverlayCenter: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(7, 10, 18, 0.45)',
    paddingHorizontal: 16,
  },
  cameraLiveText: {
    color: '#ff8c00',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
    marginTop: 8,
    marginBottom: 2,
    textAlign: 'center',
  },
  cameraSubText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
  },
  placeholderText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
  },
  targetBadge: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    backgroundColor: '#ff8c00',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  targetBadgeText: {
    color: '#070a12',
    fontSize: 13,
    fontWeight: '900',
  },
  vsBadgeContainer: {
    alignItems: 'center',
    zIndex: 10,
    marginVertical: -14,
  },
  vsBadge: {
    backgroundColor: '#ff8c00',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#070a12',
  },
  vsBadgeText: {
    color: '#070a12',
    fontWeight: '900',
    fontSize: 13,
  },
  bottomControlsArea: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    alignItems: 'center',
  },
  recordOuterRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: '#ff8c00',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  recordDisabled: {
    opacity: 0.4,
  },
  recordInnerBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ff8c00',
  },
  recordingSquare: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: '#ef4444',
  },
  recordHintText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: width - 48,
    backgroundColor: '#0f172a',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#ff8c00',
  },
  modalHeaderBadge: {
    backgroundColor: 'rgba(255, 140, 0, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ff8c00',
  },
  modalHeaderBadgeText: {
    color: '#ff8c00',
    fontSize: 12,
    fontWeight: '800',
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSub: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  modalActionBtn: {
    width: '100%',
    backgroundColor: '#ff8c00',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalActionBtnText: {
    color: '#070a12',
    fontSize: 15,
    fontWeight: '900',
  },
});
