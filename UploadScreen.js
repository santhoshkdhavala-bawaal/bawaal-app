import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  StatusBar,
  Image,
  Alert,
  ActivityIndicator,
  TextInput,
  ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function UploadScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const [videoUri, setVideoUri] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [maxDuration, setMaxDuration] = useState(30);

  // CHALLENGE FORM STATES
  const [caption, setCaption] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('GYM');
  const [metricTag, setMetricTag] = useState('100 Reps / 30s');

  // LAUNCH NATIVE CAMERA WITH COMPATIBILITY FALLBACKS
  const recordVideo = async () => {
    try {
      const cameraPerm = await ImagePicker.requestCameraPermissionsAsync();
      const micPerm = await ImagePicker.requestMicrophonePermissionsAsync();

      if (cameraPerm.status !== 'granted' || micPerm.status !== 'granted') {
        Alert.alert(
          'Permissions Required',
          'Please grant Camera and Microphone access in device settings.'
        );
        return;
      }

      // Legacy & modern SDK compatible mediaType definition
      const mediaTypesSetting = ImagePicker.MediaTypeOptions
        ? ImagePicker.MediaTypeOptions.Videos
        : ['videos'];

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: mediaTypesSetting,
        videoMaxDuration: maxDuration,
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets[0]?.uri) {
        setVideoUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Camera Launch Error:', error);
      Alert.alert('Camera Error', error.message || 'Could not open phone camera.');
    }
  };

  // PICK FROM GALLERY
  const pickVideoFromGallery = async () => {
    try {
      const mediaTypesSetting = ImagePicker.MediaTypeOptions
        ? ImagePicker.MediaTypeOptions.Videos
        : ['videos'];

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: mediaTypesSetting,
        allowsEditing: true,
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets[0]?.uri) {
        setVideoUri(result.assets[0].uri);
      }
    } catch (err) {
      console.error('Gallery Error:', err);
    }
  };

  // SUBMIT CHALLENGE TO ARENA FEED
  const handleUpload = async () => {
    if (!videoUri) return;
    setIsUploading(true);

    try {
      const newChallengePost = {
        id: `post-${Date.now()}`,
        userName: 'Santhosh Dhavala',
        userLocation: 'Virar, Mumbai',
        isAiVerified: true,
        videoUri: videoUri,
        metric: metricTag || '30s Challenge',
        caption: caption || '100 pushups in 30 secs challenge anyone? 🔥 #BawaalChallenge',
        fireCount: '1',
        banterCount: '0',
        category: selectedCategory,
      };

      await new Promise((resolve) => setTimeout(resolve, 1000));

      Alert.alert('Challenge Created! 🔥', 'Your challenge has been posted to the Arena feed!', [
        {
          text: 'OK',
          onPress: () => {
            setVideoUri(null);
            setCaption('');
            navigation.navigate('Arena', { newPost: newChallengePost });
          },
        },
      ]);
    } catch (error) {
      Alert.alert('Upload Failed', error.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 24) }]}>
      <StatusBar barStyle="light-content" backgroundColor="#05070A" />

      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <Image
            source={require('./assets/BAWAAL_text.png')}
            style={styles.wordmarkLogo}
          />
          <Text style={styles.headerAccent}>
            {videoUri ? 'CREATE CHALLENGE' : 'RECORD'}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => navigation?.navigate?.('Arena')}
        >
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* VIEWPORT AREA */}
      <View style={styles.previewBox}>
        {videoUri ? (
          <ScrollView contentContainerStyle={styles.challengeFormBox}>
            <Text style={styles.formTitle}>⚡ CHALLENGE DETAILS</Text>

            <Text style={styles.inputLabel}>CHALLENGE CAPTION</Text>
            <TextInput
              style={styles.captionInput}
              placeholder="e.g. 100 pushups in 30 secs challenge anyone? 🔥"
              placeholderTextColor="#A8AFB8"
              value={caption}
              onChangeText={setCaption}
              multiline
            />

            <Text style={styles.inputLabel}>CATEGORY</Text>
            <View style={styles.categoryRow}>
              {['GYM', 'CRICKET', 'FOOTBALL', 'BOXING'].map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.catChip,
                    selectedCategory === cat && styles.catChipActive,
                  ]}
                  onPress={() => setSelectedCategory(cat)}
                >
                  <Text
                    style={[
                      styles.catChipText,
                      selectedCategory === cat && styles.catChipTextActive,
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>TARGET METRIC / SCORE</Text>
            <TextInput
              style={styles.metricInput}
              placeholder="e.g. 100 Reps / 30s"
              placeholderTextColor="#A8AFB8"
              value={metricTag}
              onChangeText={setMetricTag}
            />

            <TouchableOpacity
              style={styles.retakeBtn}
              onPress={() => setVideoUri(null)}
            >
              <Text style={styles.retakeBtnText}>🔄 Retake Video Clip</Text>
            </TouchableOpacity>
          </ScrollView>
        ) : (
          <View style={styles.placeholderBox}>
            <Text style={styles.placeholderIcon}>📹</Text>
            <Text style={styles.placeholderTitle}>Ready to Record</Text>
            <Text style={styles.placeholderSub}>
              Select your challenge duration below (30s Sprint or 60s Battle), then tap the red shutter button to launch recording.
            </Text>
          </View>
        )}
      </View>

      {/* FOOTER ACTIONS */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        {videoUri ? (
          <TouchableOpacity
            style={styles.uploadBtn}
            onPress={handleUpload}
            disabled={isUploading}
          >
            {isUploading ? (
              <ActivityIndicator color="#05070A" />
            ) : (
              <Text style={styles.uploadBtnText}>⚡ THROW CHALLENGE TO ARENA ⚡</Text>
            )}
          </TouchableOpacity>
        ) : (
          <View>
            {/* DURATION SWITCHER */}
            <View style={styles.durationSelector}>
              <TouchableOpacity
                style={[
                  styles.durationPill,
                  maxDuration === 30 && styles.durationPillActive,
                ]}
                onPress={() => setMaxDuration(30)}
              >
                <Text
                  style={[
                    styles.durationText,
                    maxDuration === 30 && styles.durationTextActive,
                  ]}
                >
                  ⚡ 30s SPRINT
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.durationPill,
                  maxDuration === 60 && styles.durationPillActive,
                ]}
                onPress={() => setMaxDuration(60)}
              >
                <Text
                  style={[
                    styles.durationText,
                    maxDuration === 60 && styles.durationTextActive,
                  ]}
                >
                  🔥 60s BATTLE
                </Text>
              </TouchableOpacity>
            </View>

            {/* CONTROL BUTTONS */}
            <View style={styles.controlsRow}>
              <TouchableOpacity
                style={styles.galleryBtn}
                onPress={pickVideoFromGallery}
              >
                <Text style={styles.galleryIcon}>🖼️</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.shutterBtn}
                onPress={recordVideo}
              >
                <View style={styles.shutterInner} />
              </TouchableOpacity>

              <View style={{ width: 44 }} />
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#05070A',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#232630',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  wordmarkLogo: {
    width: 95,
    height: 20,
    resizeMode: 'contain',
  },
  headerAccent: {
    color: '#E5E4E2',
    fontSize: 16,
    fontWeight: 'bold',
  },
  closeBtn: {
    padding: 6,
  },
  closeBtnText: {
    color: '#A8AFB8',
    fontSize: 18,
  },
  previewBox: {
    flex: 1,
    margin: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1C1F26',
    borderWidth: 1,
    borderColor: '#232630',
  },
  placeholderBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  placeholderIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  placeholderTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  placeholderSub: {
    color: '#A8AFB8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  challengeFormBox: {
    padding: 16,
    gap: 12,
  },
  formTitle: {
    color: '#E5E4E2',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  inputLabel: {
    color: '#A8AFB8',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  captionInput: {
    backgroundColor: '#05070A',
    borderRadius: 8,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 13,
    minHeight: 70,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#232630',
  },
  categoryRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  catChip: {
    backgroundColor: '#05070A',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#232630',
  },
  catChipActive: {
    backgroundColor: '#E5E4E2',
    borderColor: '#E5E4E2',
  },
  catChipText: {
    color: '#A8AFB8',
    fontSize: 11,
    fontWeight: 'bold',
  },
  catChipTextActive: {
    color: '#05070A',
  },
  metricInput: {
    backgroundColor: '#05070A',
    borderRadius: 8,
    padding: 12,
    color: '#E5E4E2',
    fontSize: 13,
    fontWeight: 'bold',
    borderWidth: 1,
    borderColor: '#232630',
  },
  retakeBtn: {
    backgroundColor: '#232630',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#232630',
    marginTop: 8,
  },
  retakeBtnText: {
    color: '#A8AFB8',
    fontSize: 12,
    fontWeight: 'bold',
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  durationSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 16,
  },
  durationPill: {
    backgroundColor: '#1C1F26',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#232630',
  },
  durationPillActive: {
    backgroundColor: '#E5E4E2',
    borderColor: '#E5E4E2',
  },
  durationText: {
    color: '#A8AFB8',
    fontSize: 12,
    fontWeight: 'bold',
  },
  durationTextActive: {
    color: '#05070A',
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  galleryBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1C1F26',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#232630',
  },
  galleryIcon: {
    fontSize: 18,
  },
  shutterBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#E5E4E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E5E4E2',
  },
  uploadBtn: {
    backgroundColor: '#E5E4E2',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  uploadBtnText: {
    color: '#05070A',
    fontSize: 14,
    fontWeight: 'bold',
  },
});