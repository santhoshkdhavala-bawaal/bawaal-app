import React, { useEffect, useState } from 'react';
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
} from 'react-native';
import { uploadVideoToSupabase } from '../services/videoUpload';
import { BAWAAL_SPORTS_WITHOUT_ALL } from '../src/constants/sports';

const CATEGORIES = BAWAAL_SPORTS_WITHOUT_ALL;

const PRESETS = [
  '🔥 100 Pushups Challenge',
  '⚽ Best Turf Goal',
  '🥊 Heavy Bag Combo',
  '🏏 Longest Six Challenge',
  '💪 Max Bench Press',
];

export default function VideoPublishModal({ visible, videoUri, userId, onClose, onSuccess }) {
  const [selectedCategory, setSelectedCategory] = useState(
    CATEGORIES.includes('COMBAT') ? 'COMBAT' : CATEGORIES[0]
  );
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!visible) {
      setCaption('');
      setUploading(false);
      setSelectedCategory(CATEGORIES.includes('COMBAT') ? 'COMBAT' : CATEGORIES[0]);
    }
  }, [visible]);

  const handleUpload = async () => {
    if (!videoUri) return;

    setUploading(true);
    const result = await uploadVideoToSupabase(videoUri, userId, selectedCategory, caption);
    setUploading(false);

    if (result.success) {
      Alert.alert('Success!', 'Your video challenge is live on BAWAAL!');
      const payload = {
        ...(result.data || {}),
        url: result.url || result.data?.video_url,
        video_url: result.url || result.data?.video_url,
        category: selectedCategory,
        caption: caption || '',
      };
      if (onSuccess) onSuccess(payload);
      if (onClose) onClose();
    } else {
      Alert.alert('Upload Failed', result.error || 'Something went wrong.');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        <Text style={styles.headerTitle}>TAG YOUR CHALLENGE</Text>

        {/* Quick Presets */}
        <Text style={styles.sectionLabel}>QUICK CHALLENGE PRESETS</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetContainer}>
          {PRESETS.map((preset) => (
            <TouchableOpacity
              key={preset}
              style={styles.presetChip}
              onPress={() => setCaption(preset)}
            >
              <Text style={styles.presetText}>{preset}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryContainer}>
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
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={uploading}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.publishBtn} onPress={handleUpload} disabled={uploading}>
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
  container: { flex: 1, backgroundColor: '#0B0E14', padding: 20, justifyContent: 'center' },
  headerTitle: { color: '#FFF', fontSize: 24, fontWeight: '900', textAlign: 'center', marginBottom: 24, letterSpacing: 1 },
  sectionLabel: { color: '#888', fontSize: 12, fontWeight: '700', marginTop: 16, marginBottom: 8, letterSpacing: 1 },
  presetContainer: { maxHeight: 44, marginBottom: 12 },
  presetChip: { backgroundColor: '#1E2530', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, marginRight: 8 },
  presetText: { color: '#FF5722', fontWeight: '600', fontSize: 13 },
  input: { backgroundColor: '#141A23', color: '#FFF', padding: 14, borderRadius: 10, fontSize: 15, height: 80, textAlignVertical: 'top' },
  categoryContainer: { maxHeight: 48, marginBottom: 30 },
  categoryChip: { backgroundColor: '#141A23', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8, marginRight: 8, borderWidth: 1, borderColor: '#222' },
  categoryChipSelected: { backgroundColor: '#FF5722', borderColor: '#FF5722' },
  categoryText: { color: '#AAA', fontWeight: '700', fontSize: 13 },
  categoryTextSelected: { color: '#FFF' },
  actions: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  cancelBtn: { flex: 1, padding: 16, borderRadius: 10, backgroundColor: '#1E2530', alignItems: 'center' },
  cancelText: { color: '#888', fontWeight: '700' },
  publishBtn: { flex: 2, padding: 16, borderRadius: 10, backgroundColor: '#FF5722', alignItems: 'center' },
  publishText: { color: '#FFF', fontWeight: '900', letterSpacing: 1 },
});