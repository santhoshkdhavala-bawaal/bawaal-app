/**
 * GAME ON interactive command drawer — live scores + locked BAWAAL_SPORTS pills.
 * Open Callouts stay on the BATTLES tab.
 */
import React, { memo } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScoresSportsPanel from './ScoresSportsPanel';
import { BAWAAL_SPORTS } from '../constants/sports';

const WHITE = '#FFFFFF';
const BG = '#0A0A0A';
const SURFACE = '#121212';
const MUTED = '#A9A9A9';
const ACCENT = '#FF5A00';

function GameOnHub({ visible, onClose }) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={!!visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close GAME ON"
        />
        <View
          style={[
            styles.drawer,
            {
              paddingTop: Math.max(insets.top, 14),
              paddingBottom: Math.max(insets.bottom, 18),
            },
          ]}
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.kicker}>COMMAND DRAWER</Text>
              <Text style={styles.title}>▶ GAME ON</Text>
              <Text style={styles.subtitle}>LIVE SCORES · MATCH UPDATES</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={styles.closeBtn}
            >
              <Text style={styles.close}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.section}>
              <ScoresSportsPanel sports={BAWAAL_SPORTS} />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  drawer: {
    maxHeight: '92%',
    minHeight: '72%',
    backgroundColor: BG,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255, 90, 0, 0.35)',
    overflow: 'hidden',
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.22)',
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  headerCopy: {
    flex: 1,
    paddingRight: 12,
  },
  kicker: {
    color: ACCENT,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2.4,
    marginBottom: 4,
  },
  title: {
    color: WHITE,
    fontSize: 22,
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: 0.8,
  },
  subtitle: {
    color: MUTED,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: 4,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  close: {
    color: WHITE,
    fontSize: 14,
    fontWeight: '800',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 28,
  },
  section: {
    marginTop: 4,
  },
});

export default memo(GameOnHub);
