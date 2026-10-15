import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert } from 'react-native';

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
    <View style={styles.container}>
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
        onPress={() => navigation.navigate('VideoFeed', { user })}
      >
        <Text style={styles.feedBtnText}>View Public Feed</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0f19', padding: 24, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
  subText: { color: '#38bdf8', fontSize: 13, marginBottom: 24, fontWeight: '600' },
  inputLabel: { color: '#38bdf8', fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 8, marginTop: 14 },
  textInput: { backgroundColor: '#111827', borderWidth: 1, borderColor: '#1f2937', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: '#f8fafc', fontSize: 14 },
  submitBtn: { backgroundColor: '#3b82f6', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 24 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  feedBtn: { backgroundColor: '#1f2937', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 12, borderWidth: 1, borderColor: '#374151' },
  feedBtnText: { color: '#94a3b8', fontSize: 14, fontWeight: 'bold' },
});