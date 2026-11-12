/**
 * Lightweight notifications command sheet from the Arena V2 header bell.
 */
import React, { memo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const WHITE = '#FFFFFF';
const BG = '#0A0A0A';
const SURFACE = '#121212';
const MUTED = '#A9A9A9';
const ACCENT = '#FF5A00';

const SEED_NOTICES = [
  {
    id: 'n1',
    title: 'Battle response landed',
    body: '@Neha_Lift answered your open callout.',
    time: '2m',
  },
  {
    id: 'n2',
    title: 'GAME ON pulse',
    body: 'IND vs AUS T20 is heating up — check live scores.',
    time: '14m',
  },
  {
    id: 'n3',
    title: 'Squad brief pinned',
    body: 'Your Locker hub dropped a new training brief.',
    time: '1h',
  },
];

function NotificationsDrawer({ visible, onClose }) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={!!visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View
          style={[
            styles.drawer,
            { paddingBottom: Math.max(insets.bottom, 16) },
          ]}
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>NOTIFICATIONS</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Text style={styles.close}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          >
            {SEED_NOTICES.map((n) => (
              <View key={n.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.cardTitle}>{n.title}</Text>
                  <Text style={styles.cardTime}>{n.time}</Text>
                </View>
                <Text style={styles.cardBody}>{n.body}</Text>
              </View>
            ))}
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
    maxHeight: '70%',
    backgroundColor: BG,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255, 90, 0, 0.28)',
    paddingTop: 10,
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.22)',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  title: {
    color: WHITE,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.6,
  },
  close: {
    color: MUTED,
    fontSize: 16,
    fontWeight: '800',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 10,
  },
  card: {
    backgroundColor: SURFACE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: 12,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  cardTitle: {
    color: WHITE,
    fontSize: 13,
    fontWeight: '800',
    flex: 1,
  },
  cardTime: {
    color: ACCENT,
    fontSize: 11,
    fontWeight: '800',
  },
  cardBody: {
    color: MUTED,
    fontSize: 12,
    lineHeight: 17,
  },
});

export default memo(NotificationsDrawer);
