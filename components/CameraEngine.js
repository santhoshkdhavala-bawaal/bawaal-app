import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { Camera, CameraType } from 'expo-camera';
import { Video } from 'expo-av';
import VideoPublishModal from './VideoPublishModal';
import {
  settleStopRecording,
  STOP_RECORDING_SETTLE_MS,
  resolveSafeRecordingFallbackUri,
} from '../src/utils/safeRecordingFallback';

export default function CameraEngine({
  onVideoRecorded,
  onPublishSuccess,
  onPublishCancel,
  userId,
  /** When false / when parent passes onVideoRecorded, parent owns VideoPublishModal. */
  embedPublishModal,
}) {
  const [type, setType] = useState(CameraType.back);
  const [hasPermission, setHasPermission] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  /** Frozen clip URI — never cleared on stop; only on Success / explicit Retake / leave Cancel. */
  const [capturedVideoUri, setCapturedVideoUri] = useState(null);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const shouldEmbedPublish =
    embedPublishModal === true || (embedPublishModal !== false && !onVideoRecorded);
  const cameraRef = useRef(null);
  const timerRef = useRef(null);
  const recordAsyncWaitRef = useRef(null);
  const stoppingRef = useRef(false);
  const handoffDoneRef = useRef(false);

  /** Live lens must stay down while a clip is frozen or publish is open. */
  const freezeLiveCamera =
    !!capturedVideoUri || showPublishModal || isPublishing || isPreviewing;

  useEffect(() => {
    (async () => {
      const cameraStatus = await Camera.requestCameraPermissionsAsync();
      const audioStatus = await Camera.requestMicrophonePermissionsAsync();
      setHasPermission(
        cameraStatus.status === 'granted' && audioStatus.status === 'granted'
      );
    })();
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const clearCapturedClip = useCallback(() => {
    setCapturedVideoUri(null);
    setShowPublishModal(false);
    setIsPreviewing(false);
    setIsPublishing(false);
    handoffDoneRef.current = false;
  }, []);

  const commitRecordedUri = useCallback(
    (recordedUri) => {
      const uri = recordedUri || resolveSafeRecordingFallbackUri();
      handoffDoneRef.current = true;
      stoppingRef.current = false;
      recordAsyncWaitRef.current = null;
      clearTimer();
      setIsRecording(false);
      setIsSaving(false);
      // Freeze — do NOT null the URI on stop
      setCapturedVideoUri(uri);
      setIsPreviewing(true);
      setIsPublishing(true);
      setShowPublishModal(true);
      // Parent may own the modal UI; still notify with persistent URI
      if (typeof onVideoRecorded === 'function') {
        onVideoRecorded(uri);
      }
    },
    [clearTimer, onVideoRecorded]
  );

  const startRecording = useCallback(async () => {
    if (
      !cameraRef.current ||
      isRecording ||
      isSaving ||
      freezeLiveCamera ||
      stoppingRef.current
    ) {
      return;
    }

    try {
      handoffDoneRef.current = false;
      stoppingRef.current = false;
      setIsRecording(true);
      setIsSaving(false);
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

      const recordPromise = cameraRef.current.recordAsync({
        maxDuration: 60,
        quality: Camera.Constants?.VideoQuality?.['720p'],
      });
      recordAsyncWaitRef.current = Promise.resolve(recordPromise).catch((err) => {
        console.warn('[CameraEngine] recordAsync late reject:', err?.message || err);
        return null;
      });

      const data = await recordPromise;
      if (handoffDoneRef.current) {
        setIsSaving(false);
        setIsRecording(false);
        return;
      }

      clearTimer();
      setIsRecording(false);

      const recordedUri =
        typeof data?.uri === 'string' && data.uri.trim()
          ? data.uri
          : resolveSafeRecordingFallbackUri();
      commitRecordedUri(recordedUri);
    } catch (error) {
      console.error('Recording error:', error);
      clearTimer();
      setIsRecording(false);
      if (!handoffDoneRef.current) {
        setIsSaving(false);
        commitRecordedUri(resolveSafeRecordingFallbackUri());
      } else {
        setIsSaving(false);
      }
    } finally {
      recordAsyncWaitRef.current = null;
    }
  }, [isRecording, isSaving, freezeLiveCamera, clearTimer, commitRecordedUri]);

  const stopRecording = useCallback(async () => {
    if ((!isRecording && !recordAsyncWaitRef.current) || stoppingRef.current) {
      return;
    }
    stoppingRef.current = true;
    setIsSaving(true);
    setIsRecording(false);
    clearTimer();

    const savingWatchdog = setTimeout(() => {
      setIsSaving(false);
    }, STOP_RECORDING_SETTLE_MS);

    try {
      const settled = await settleStopRecording({
        timeoutMs: STOP_RECORDING_SETTLE_MS,
        recordPromise: recordAsyncWaitRef.current,
        stopRecording: () => cameraRef.current?.stopRecording?.(),
      });

      if (handoffDoneRef.current) {
        setIsSaving(false);
        return;
      }

      const recordedUri = settled.uri || resolveSafeRecordingFallbackUri();
      setIsSaving(false);
      commitRecordedUri(recordedUri);
    } catch (error) {
      console.error('[CameraEngine] stopRecording error:', error);
      if (!handoffDoneRef.current) {
        setIsSaving(false);
        commitRecordedUri(resolveSafeRecordingFallbackUri());
      } else {
        setIsSaving(false);
      }
    } finally {
      clearTimeout(savingWatchdog);
      setIsSaving(false);
      stoppingRef.current = false;
    }
  }, [isRecording, clearTimer, commitRecordedUri]);

  const handleEmbedPublishClose = useCallback(() => {
    // Cancel — clear only after explicit dismiss; notify parent (may navigate)
    const uri = capturedVideoUri;
    clearCapturedClip();
    if (typeof onPublishCancel === 'function') onPublishCancel(uri);
  }, [onPublishCancel, capturedVideoUri, clearCapturedClip]);

  const handleEmbedPublishSuccess = useCallback(
    (data) => {
      const uri = capturedVideoUri;
      clearCapturedClip();
      if (typeof onPublishSuccess === 'function') onPublishSuccess(data, uri);
    },
    [onPublishSuccess, capturedVideoUri, clearCapturedClip]
  );

  if (hasPermission === null) return <View style={styles.container} />;
  if (hasPermission === false) {
    return <Text style={styles.text}>No access to camera/mic</Text>;
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Frozen recorded clip — stays mounted under VideoPublishModal */}
      {capturedVideoUri ? (
        <View style={styles.previewContainer} pointerEvents="box-none">
          <Video
            source={{ uri: capturedVideoUri }}
            style={styles.preview}
            useNativeControls={!showPublishModal}
            resizeMode="cover"
            isLooping
            shouldPlay={!showPublishModal}
            isMuted={!!showPublishModal}
          />
          {!showPublishModal ? (
            <>
              <TouchableOpacity
                style={styles.retakeBtn}
                onPress={clearCapturedClip}
              >
                <Text style={styles.btnText}>Retake Video</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.publishBtn}
                onPress={() => {
                  setIsPublishing(true);
                  setShowPublishModal(true);
                }}
              >
                <Text style={styles.btnText}>Publish</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </View>
      ) : (
        /* Live lens only when no frozen clip — prevents auto re-init under publish */
        <Camera style={styles.camera} type={type} ref={cameraRef}>
          <View style={styles.overlay}>
            <View style={styles.header}>
              <Text style={styles.timerText}>
                {isRecording
                  ? `00:${recordingTime < 10 ? '0' : ''}${recordingTime}`
                  : 'REC'}
              </Text>
            </View>

            <View style={styles.controls}>
              <TouchableOpacity
                style={styles.flipBtn}
                onPress={() => {
                  setType(
                    type === CameraType.back ? CameraType.front : CameraType.back
                  );
                }}
                disabled={isRecording || isSaving}
              >
                <Text style={styles.btnText}>Flip</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.recordBtn, isRecording && styles.recordingBtnActive]}
                onPress={() => {
                  if (isSaving) return;
                  if (isRecording) void stopRecording();
                  else void startRecording();
                }}
                disabled={isSaving}
              >
                <View
                  style={[
                    styles.innerRecordBtn,
                    isRecording && styles.innerRecordingActive,
                  ]}
                />
              </TouchableOpacity>
            </View>
          </View>

          {isSaving ? (
            <View style={styles.savingOverlay} pointerEvents="auto">
              <ActivityIndicator color="#FF5722" size="large" />
              <Text style={styles.savingText}>Saving clip…</Text>
            </View>
          ) : null}
        </Camera>
      )}

      {shouldEmbedPublish ? (
        <VideoPublishModal
          visible={showPublishModal && !!capturedVideoUri}
          videoUri={capturedVideoUri}
          userId={userId}
          onClose={handleEmbedPublishClose}
          onSuccess={handleEmbedPublishSuccess}
        />
      ) : (
        /* Parent-owned modal still needs local freeze flags while URI is held */
        null
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  overlay: { flex: 1, justifyContent: 'space-between', padding: 20 },
  header: { alignItems: 'center', marginTop: 20 },
  timerText: { color: '#FF5722', fontSize: 20, fontWeight: 'bold' },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 30,
  },
  flipBtn: {
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 8,
  },
  btnText: { color: '#FFF', fontWeight: '600' },
  recordBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#FF5722',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingBtnActive: { borderColor: '#FF0000' },
  innerRecordBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FF5722',
  },
  innerRecordingActive: {
    width: 30,
    height: 30,
    borderRadius: 4,
    backgroundColor: '#FF0000',
  },
  previewContainer: { flex: 1, justifyContent: 'center', backgroundColor: '#000' },
  preview: { flex: 1 },
  retakeBtn: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    backgroundColor: '#FF5722',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  publishBtn: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    backgroundColor: '#1B5E20',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  savingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 40,
  },
  savingText: {
    marginTop: 12,
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  text: { color: '#FFF', textAlign: 'center', marginTop: 40 },
});
