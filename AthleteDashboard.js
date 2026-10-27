import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert } from 'react-native';
import NativeMediaSurface from './src/components/NativeMediaSurface';

export default function AthleteDashboard({ route, navigation }) {
  const user = route?.params?.user || { name: 'Athlete', specializedSport: 'Boxing' };
  
  const [title, setTitle] = useState('');
  const [videoUrl, setVideoUrl] = useState('');

  const handleUploadPost = async () => {
    if (!title || !videoUrl) {
      Alert.alert('Error', 'Please provide a title and video link');
      return;
    }

    try {
      const response = await fetch('https://bawaal-app.onrender.com/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          athleteName: user.name,
          title: title,
          sport: user.specializedSport || 'Boxing',
          videoUrl: videoUrl
        })
      });

      const data = await response.json();

      if (data.success) {
        Alert.alert('Success', 'Highlight posted successfully!');
        setTitle('');
        setVideoUrl('');
      } else {
        Alert.alert('Error', data.error || 'Failed to upload');
      }
    } catch (error) {
      console.error('Upload Error:', error);
      Alert.alert('Error', 'Network error. Please try again.');
    }
  };

  return (
    <NativeMediaSurface.Gate feature="video" screenName="AthleteDashboard">
      <View style={styles.container}>
        <View style={styles.previewCard}>
          <NativeMediaSurface
            mode="feed"
            sport={user.specializedSport || 'COMBAT'}
            label="HIGHLIGHT PREVIEW"
            handle={`@${String(user.name || 'athlete').replace(/\s+/g, '_').toUpperCase()}`}
            uri={videoUrl || undefined}
            forcePlaceholder={!videoUrl}
            style={styles.previewFill}
            seed={3}
          />
        </View>

        <Text style={styles.title}>Athlete Dashboard</Text>
        <Text style={styles.subText}>Welcome, {user.name} ({user.specializedSport})</Text>

        <Text style={styles.inputLabel}>HIGHLIGHT TITLE</Text>
        <TextInput
          style={styles.textInput}
          placeholder="e.g., Heavybag Training Session #4"
          placeholderTextColor="#666"
          value={title}
          onChangeText={setTitle}
        />

        <Text style={styles.inputLabel}>VIDEO URL / STREAM LINK</Text>
        <TextInput
          style={styles.textInput}
          placeholder="Paste video link here"
          placeholderTextColor="#666"
          value={videoUrl}
          onChangeText={setVideoUrl}
          autoCapitalize="none"
        />

        <TouchableOpacity style={styles.submitBtn} onPress={handleUploadPost}>
          <Text style={styles.submitBtnText}>Publish Highlight</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.feedBtn}
          onPress={() => navigation?.navigate?.('Arena', { user })}
        >
          <Text style={styles.feedBtnText}>View Public Feed</Text>
        </TouchableOpacity>
      </View>
    </NativeMediaSurface.Gate>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000', padding: 24, justifyContent: 'center' },
  previewCard: {
    height: 180,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 20,
    backgroundColor: '#121212',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(232,236,233,0.28)',
  },
  previewFill: { width: '100%', height: '100%' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
  subText: { color: '#FF5722', fontSize: 13, marginBottom: 24, fontWeight: '600' },
  inputLabel: { color: '#A0A0A0', fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 8, marginTop: 14 },
  textInput: { backgroundColor: '#121212', borderWidth: 1, borderColor: 'rgba(232,236,233,0.28)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: '#E8ECE9', fontSize: 14 },
  submitBtn: { backgroundColor: '#FF5722', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 24 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  feedBtn: { backgroundColor: '#121212', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 12, borderWidth: 1, borderColor: 'rgba(232,236,233,0.28)' },
  feedBtnText: { color: '#A0A0A0', fontSize: 14, fontWeight: 'bold' },
});