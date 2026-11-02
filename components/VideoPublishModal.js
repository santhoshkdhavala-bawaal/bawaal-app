import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { uploadVideoToSupabase } from '../services/videoUpload';
import { BAWAAL_SPORTS_WITHOUT_ALL } from '../src/constants/sports';
import { sanitizePlayableFeedUri } from '../src/services/uploadService';

const CATEGORIES = BAWAAL_SPORTS_WITHOUT_ALL;
const BAWAAL_LOGO = require('../assets/BAWAAL_white_full.png');

function isRealVideoComponent(VideoComp) {
  if (!VideoComp) return false;
  const name = String(VideoComp.displayName || VideoComp.name || '');
  return !/stub|mock/i.test(name);
}

function loadRealExpoAv() {
  try {
    // eslint-disable-next-line global-require
    const { loadExpoAv } = require('../src/native/safeNative');
    const mod = typeof loadExpoAv === 'function' ? loadExpoAv() : null;
    if (mod?.Video && isRealVideoComponent(mod.Video)) {
      return mod;
    }
  } catch {
    /* fall through */
  }
  try {
    // eslint-disable-next-line global-require
    const mod = require('expo-av');
    if (mod?.Video && isRealVideoComponent(mod.Video)) {
      return { Video: mod.Video, ResizeMode: mod.ResizeMode };
    }
  } catch {
    /* Expo Go Metro stub / missing native */
  }
  return null;
}

const RealAv = loadRealExpoAv();
const AvVideo = RealAv?.Video || null;
const AvResizeMode = RealAv?.ResizeMode || null;

/** Normalize camera capture URI (file:// / content:// / https). */
function normalizePreviewUri(raw) {
  if (raw == null) return null;
  const cleaned = sanitizePlayableFeedUri(raw) || String(raw).trim();
  if (!cleaned || cleaned === 'null' || cleaned === 'undefined') return null;
  return cleaned;
}

function PreviewControlsOverlay({
  isPlaying,
  playbackRate,
  onTogglePlay,
  onToggleSlowMo,
}) {
  return (
    <View style={styles.controlsLayer} pointerEvents="box-none">
      <TouchableOpacity
        style={styles.playPauseHit}
        onPress={onTogglePlay}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? 'Pause preview' : 'Play preview'}
      >
        <View style={styles.playPauseBadge}>
          <Text style={styles.playPauseIcon}>{isPlaying ? '❚❚' : '▶'}</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.slowMoBtn,
          playbackRate < 1 ? styles.slowMoBtnActive : null,
        ]}
        onPress={onToggleSlowMo}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={
          playbackRate < 1 ? 'Disable slow motion' : 'Enable slow motion'
        }
      >
        <Text
          style={[
            styles.slowMoText,
            playbackRate < 1 ? styles.slowMoTextActive : null,
          ]}
        >
          {playbackRate < 1 ? '0.5× SLOW' : '1× SPEED'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function ExpoAvPreview({
  uri,
  visible,
  isPlaying,
  playbackRate,
  onTogglePlay,
  onToggleSlowMo,
  onReady,
  onError,
  videoRef,
}) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
  }, [uri]);

  // Keep native player in sync for play/pause + rate
  useEffect(() => {
    const node = videoRef?.current;
    if (!node) return undefined;
    let cancelled = false;
    (async () => {
      try {
        if (!visible) {
          await node.pauseAsync?.();
          return;
        }
        await node.setRateAsync?.(playbackRate, true);
        if (isPlaying) await node.playAsync?.();
        else await node.pauseAsync?.();
      } catch (err) {
        if (!cancelled) {
          console.warn(
            '[VideoPublishModal] av sync failed:',
            err?.message || err
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isPlaying, playbackRate, uri, videoRef, visible]);

  return (
    <View style={styles.previewShell}>
      <AvVideo
        ref={videoRef}
        key={uri}
        source={{ uri }}
        style={styles.previewVideo}
        shouldPlay={!!visible && !!isPlaying}
        rate={playbackRate}
        isLooping
        isMuted={false}
        resizeMode={AvResizeMode?.COVER || 'cover'}
        useNativeControls={false}
        onLoadStart={() => {
          try {
            setLoading(true);
          } catch (_) {
            /* ignore */
          }
        }}
        onLoad={() => {
          try {
            setLoading(false);
            onReady?.();
          } catch (_) {
            /* ignore */
          }
        }}
        onReadyForDisplay={() => {
          try {
            setLoading(false);
            onReady?.();
          } catch (_) {
            /* ignore */
          }
        }}
        onError={(e) => {
          try {
            console.warn('[VideoPublishModal] preview error:', e?.error || e);
            setLoading(false);
            onError?.(e);
          } catch (_) {
            /* never crash preview render */
          }
        }}
      />
      {loading ? (
        <View style={styles.previewLoading} pointerEvents="none">
          <ActivityIndicator color="#FFFFFF" />
        </View>
      ) : null}
      <PreviewControlsOverlay
        isPlaying={isPlaying}
        playbackRate={playbackRate}
        onTogglePlay={onTogglePlay}
        onToggleSlowMo={onToggleSlowMo}
      />
    </View>
  );
}

function ExpoVideoPreview({
  uri,
  visible,
  isPlaying,
  playbackRate,
  onTogglePlay,
  onToggleSlowMo,
  onReady,
  onError,
}) {
  const [loading, setLoading] = useState(true);
  const player = useVideoPlayer(uri ? { uri } : null, (p) => {
    try {
      p.loop = true;
      p.muted = false;
      p.playbackRate = playbackRate;
      if (visible && isPlaying) p.play();
      else p.pause();
    } catch {
      /* ignore */
    }
  });

  useEffect(() => {
    setLoading(true);
    if (!player || !uri) return undefined;
    let cancelled = false;
    const t = setTimeout(() => {
      if (cancelled) return;
      try {
        player.loop = true;
        player.muted = false;
        player.playbackRate = playbackRate;
        if (visible && isPlaying) player.play();
        else player.pause();
        setLoading(false);
        onReady?.();
      } catch (err) {
        setLoading(false);
        onError?.(err);
      }
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [isPlaying, onError, onReady, playbackRate, player, uri, visible]);

  return (
    <View style={styles.previewShell}>
      <VideoView
        style={styles.previewVideo}
        player={player}
        contentFit="cover"
        nativeControls={false}
      />
      {loading ? (
        <View style={styles.previewLoading} pointerEvents="none">
          <ActivityIndicator color="#FFFFFF" />
        </View>
      ) : null}
      <PreviewControlsOverlay
        isPlaying={isPlaying}
        playbackRate={playbackRate}
        onTogglePlay={onTogglePlay}
        onToggleSlowMo={onToggleSlowMo}
      />
    </View>
  );
}

function PublishClipPreview({
  videoUri,
  visible,
  isPlaying,
  playbackRate,
  onTogglePlay,
  onToggleSlowMo,
  videoRef,
}) {
  const uri = useMemo(() => normalizePreviewUri(videoUri), [videoUri]);
  if (!uri) {
    return (
      <View style={[styles.previewShell, styles.previewEmpty]}>
        <Text style={styles.previewEmptyText}>No clip to preview</Text>
      </View>
    );
  }

  // Prefer real expo-av; never mount the Metro stub ("Dev client required…")
  if (AvVideo) {
    return (
      <ExpoAvPreview
        uri={uri}
        visible={visible}
        isPlaying={isPlaying}
        playbackRate={playbackRate}
        onTogglePlay={onTogglePlay}
        onToggleSlowMo={onToggleSlowMo}
        videoRef={videoRef}
      />
    );
  }

  // expo-video plays local file:// + https when expo-av is stubbed
  return (
    <ExpoVideoPreview
      uri={uri}
      visible={visible}
      isPlaying={isPlaying}
      playbackRate={playbackRate}
      onTogglePlay={onTogglePlay}
      onToggleSlowMo={onToggleSlowMo}
    />
  );
}

export default function VideoPublishModal({
  visible,
  videoUri,
  userId,
  onClose,
  onSuccess,
}) {
  const [selectedCategory, setSelectedCategory] = useState(
    CATEGORIES.includes('COMBAT') ? 'COMBAT' : CATEGORIES[0]
  );
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const videoRef = useRef(null);

  useEffect(() => {
    if (!visible) {
      setCaption('');
      setUploading(false);
      setIsPlaying(true);
      setPlaybackRate(1.0);
      setSelectedCategory(
        CATEGORIES.includes('COMBAT') ? 'COMBAT' : CATEGORIES[0]
      );
    } else {
      setIsPlaying(true);
      setPlaybackRate(1.0);
    }
  }, [visible]);

  const togglePlayPause = async () => {
    const node = videoRef.current;
    try {
      if (node) {
        if (isPlaying) await node.pauseAsync?.();
        else await node.playAsync?.();
      }
    } catch (err) {
      console.warn(
        '[VideoPublishModal] togglePlayPause failed:',
        err?.message || err
      );
    }
    setIsPlaying((p) => !p);
  };

  const toggleSlowMo = async () => {
    const newRate = playbackRate === 1.0 ? 0.5 : 1.0;
    const node = videoRef.current;
    try {
      if (node?.setRateAsync) {
        await node.setRateAsync(newRate, true);
      }
    } catch (err) {
      console.warn(
        '[VideoPublishModal] toggleSlowMo failed:',
        err?.message || err
      );
    }
    setPlaybackRate(newRate);
  };

  const finishSuccess = (payload) => {
    // Pause preview before parent tears down the camera route
    setIsPlaying(false);
    if (onSuccess) onSuccess(payload);
    else if (onClose) onClose();
  };

  const handleUpload = async () => {
    const playable = normalizePreviewUri(videoUri);
    if (!playable) return;

    setUploading(true);
    setIsPlaying(false);
    const result = await uploadVideoToSupabase(
      playable,
      userId,
      selectedCategory,
      caption
    );
    setUploading(false);

    if (result.success) {
      const payload = {
        ...(result.data || {}),
        url: result.url || result.data?.video_url,
        video_url: result.url || result.data?.video_url,
        category: selectedCategory,
        caption: caption || '',
      };
      // Wait for OK so parent can close modal + navigate without orphan layers
      Alert.alert('Success!', 'Your video challenge is live on BAWAAL!', [
        {
          text: 'OK',
          onPress: () => finishSuccess(payload),
        },
      ]);
    } else {
      setIsPlaying(true);
      Alert.alert('Upload Failed', result.error || 'Something went wrong.');
    }
  };

  const handleCancel = () => {
    setIsPlaying(false);
    if (onClose) onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={handleCancel}
    >
      <View style={styles.container}>
        <View style={styles.brandRow}>
          <Image
            source={BAWAAL_LOGO}
            style={styles.brandLogo}
            resizeMode="contain"
            accessibilityLabel="BAWAAL"
          />
        </View>
        <Text style={styles.headerTitle}>TAG YOUR CHALLENGE</Text>

        <PublishClipPreview
          videoUri={videoUri}
          visible={visible}
          isPlaying={isPlaying}
          playbackRate={playbackRate}
          onTogglePlay={togglePlayPause}
          onToggleSlowMo={toggleSlowMo}
          videoRef={videoRef}
        />

        {/* Caption Input */}
        <Text style={styles.sectionLabel}>CAPTION / DESCRIPTION</Text>
        <TextInput
          style={styles.input}
          placeholder="Add a challenge description..."
          placeholderTextColor="#666"
          value={caption}
          onChangeText={setCaption}
          multiline
        />

        {/* Category Picker */}
        <Text style={styles.sectionLabel}>SELECT SPORTS CATEGORY</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryContainer}
        >
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.categoryChip,
                selectedCategory === cat && styles.categoryChipSelected,
              ]}
              onPress={() => setSelectedCategory(cat)}
            >
              <Text
                style={[
                  styles.categoryText,
                  selectedCategory === cat && styles.categoryTextSelected,
                ]}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={handleCancel}
            disabled={uploading}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.publishBtn}
            onPress={handleUpload}
            disabled={uploading || !normalizePreviewUri(videoUri)}
          >
            {uploading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.publishText}>PUBLISH TO BAWAAL</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0E14',
    padding: 20,
    justifyContent: 'center',
  },
  brandRow: {
    alignItems: 'center',
    marginBottom: 10,
  },
  brandLogo: {
    width: 160,
    height: 36,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 18,
    letterSpacing: 1,
  },
  previewShell: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#222',
    position: 'relative',
  },
  previewVideo: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: '#000',
  },
  previewLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  controlsLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  playPauseHit: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playPauseBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playPauseIcon: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    marginLeft: 2,
  },
  slowMoBtn: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  slowMoBtnActive: {
    borderColor: '#FF5722',
    backgroundColor: 'rgba(255,87,34,0.25)',
  },
  slowMoText: {
    color: '#DDD',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  slowMoTextActive: {
    color: '#FF5722',
  },
  previewEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewEmptyText: {
    color: '#888',
    fontSize: 13,
    fontWeight: '700',
  },
  sectionLabel: {
    color: '#888',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
    letterSpacing: 1,
  },
  input: {
    backgroundColor: '#141A23',
    color: '#FFF',
    padding: 14,
    borderRadius: 10,
    fontSize: 15,
    height: 80,
    textAlignVertical: 'top',
  },
  categoryContainer: { maxHeight: 48, marginBottom: 30 },
  categoryChip: {
    backgroundColor: '#141A23',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#222',
  },
  categoryChipSelected: { backgroundColor: '#FF5722', borderColor: '#FF5722' },
  categoryText: { color: '#AAA', fontWeight: '700', fontSize: 13 },
  categoryTextSelected: { color: '#FFF' },
  actions: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  cancelBtn: {
    flex: 1,
    padding: 16,
    borderRadius: 10,
    backgroundColor: '#1E2530',
    alignItems: 'center',
  },
  cancelText: { color: '#888', fontWeight: '700' },
  publishBtn: {
    flex: 2,
    padding: 16,
    borderRadius: 10,
    backgroundColor: '#FF5722',
    alignItems: 'center',
  },
  publishText: { color: '#FFF', fontWeight: '900', letterSpacing: 1 },
});
