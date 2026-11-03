/**
 * Camera stack host for SPARKS / ChallengeCam routes (ChallengePublishHost).
 * Pre-publish review controls (play / pause / speed) live ONLY in VideoPublishModal
 * — never on ArenaFeed.
 *
 * Upload contract (VideoPublishModal → UniversalCamera):
 *   setUploading(true) → await uploadVideoToSupabase(uri)
 *   → addNewPostToArenaFeed({ video_url: publicUrl }) only on HTTPS success
 *   → showBawaalAlert UPLOAD FAILED on catch
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import UniversalCamera from './UniversalCamera';

export default function CameraPublishHost({ navigation, route }) {
  return (
    <View style={styles.root}>
      <UniversalCamera navigation={navigation} route={route} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
});
