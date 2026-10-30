/**
 * GAME ON hub — live scores + horizontal sport filter pills only (stealth-black).
 * Open Callouts live on the BATTLES tab. No redundant lower sports grid.
 */
import React, { memo } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BackLink from './BackLink';
import ScoresSportsPanel from './ScoresSportsPanel';

const WHITE = '#FFFFFF';
const DARK_BG = '#000000';
const MUTED = '#A0A0A0';

function GameOnHub({ visible, onClose }) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={!!visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.root,
          {
            paddingTop: Math.max(insets.top, 12),
            paddingBottom: Math.max(insets.bottom, 16),
          },
        ]}
      >
        <View style={styles.header}>
          <BackLink label="Arena" onPress={onClose} />
          <Text style={styles.title}>GAME ON</Text>
          <View style={styles.headerSpacer} />
        </View>
        <Text style={styles.subtitle}>LIVE SCORES · MATCH UPDATES</Text>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.section}>
            <ScoresSportsPanel />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: DARK_BG,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    minHeight: 36,
  },
  headerSpacer: {
    width: 88,
  },
  title: {
    color: WHITE,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.6,
  },
  subtitle: {
    color: MUTED,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    paddingHorizontal: 16,
    marginTop: 4,
    marginBottom: 8,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 48,
  },
  section: {
    marginTop: 4,
  },
});

export default memo(GameOnHub);
