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

export default function CameraEngine({ onVideoRecorded, userId }) {
  const [type, setType] = useState(CameraType.back);
  const [hasPermission, setHasPermission] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [videoUri, setVideoUri] = useState(null);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const cameraRef = useRef(null);
  const timerRef = useRef(null);
  const recordAsyncWaitRef = useRef(null);
  const stoppingRef = useRef(false);
  const handoffDoneRef = useRef(false);

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

  const commitRecordedUri = useCallback(
    (recordedUri) => {
      const uri = recordedUri || resolveSafeRecordingFallbackUri();
      handoffDoneRef.current = true;
      stoppingRef.current = false;
      recordAsyncWaitRef.current = null;
      clearTimer();
      setIsRecording(false);
      setIsSaving(false);
      setVideoUri(uri);
      setShowPublishModal(true);
      if (onVideoRecorded) onVideoRecorded(uri);
    },
    [clearTimer, onVideoRecorded]
  );

  const startRecording = useCallback(async () => {
    if (!cameraRef.current || isRecording || isSaving || stoppingRef.current) {
      return;
    }

    try {
      handoffDoneRef.current = false;
      stoppingRef.current = false;
      setIsRecording(true);
      setIsSaving(false);
      setRecordingTime(0);
      setShowPublishModal(false);
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
  }, [isRecording, isSaving, clearTimer, commitRecordedUri]);

  const stopRecording = useCallback(async () => {
    if ((!isRecording && !recordAsyncWaitRef.current) || stoppingRef.current) {
      return;
    }
    stoppingRef.current = true;
    setIsSaving(true);
    setIsRecording(false);
    clearTimer();

    // Force-clear spinner if native stop hangs past the settle budget
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

      const recordedUri =
        settled.uri || resolveSafeRecordingFallbackUri();
      // Clear saving immediately once URI is captured, then open publish
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

  if (hasPermission === null) return <View style={styles.container} />;
  if (hasPermission === false) {
    return <Text style={styles.text}>No access to camera/mic</Text>;
  }

  return (
    <SafeAreaView style={styles.container}>
      {videoUri && !showPublishModal ? (
        <View style={styles.previewContainer}>
          <Video
            source={{ uri: videoUri }}
            style={styles.preview}
            useNativeControls
            resizeMode="cover"
            isLooping
            shouldPlay
          />
          <TouchableOpacity
            style={styles.retakeBtn}
            onPress={() => {
              setVideoUri(null);
              setShowPublishModal(false);
              handoffDoneRef.current = false;
            }}
          >
            <Text style={styles.btnText}>Retake Video</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.publishBtn}
            onPress={() => setShowPublishModal(true)}
          >
            <Text style={styles.btnText}>Publish</Text>
          </TouchableOpacity>
        </View>
      ) : !showPublishModal ? (
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
      ) : null}

      <VideoPublishModal
        visible={showPublishModal && !!videoUri}
        videoUri={videoUri}
        userId={userId}
        onClose={() => setShowPublishModal(false)}
        onSuccess={() => {
          setShowPublishModal(false);
          setVideoUri(null);
          handoffDoneRef.current = false;
        }}
      />
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
  previewContainer: { flex: 1, justifyContent: 'center' },
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
