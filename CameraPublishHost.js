/**
 * Camera stack host for SPARKS / ChallengeCam routes.
 * VideoPublishModal lives inside UniversalCamera (opens on successful capture).
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
