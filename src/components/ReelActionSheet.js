/**
 * Instagram-style reel action sheet
 * (DM / Banner Like / Follow / Share / Repost / Tag / Banter).
 */
import React, { memo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  TouchableOpacity,
  Platform,
  Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const WHITE = '#FFFFFF';
const BG = '#0A0A0A';
const SURFACE = '#121212';
const MUTED = '#A9A9A9';
const ACCENT = '#FF5A00';
const HAIRLINE = 'rgba(255,255,255,0.12)';

const ACTIONS = [
  { id: 'dm', label: 'DM' },
  { id: 'banner_like', label: 'Banner Like' },
  { id: 'follow', label: 'Follow' },
  { id: 'share', label: 'Share' },
  { id: 'repost', label: 'Repost' },
  { id: 'tag', label: 'Tag' },
  { id: 'banter', label: 'Banter' },
];

async function shareReel(reel) {
  const postId = reel?.id != null ? String(reel.id) : '';
  const handle = String(reel?.author || reel?.handle || 'athlete').replace(/^@/, '');
  try {
    await Share.share({
      title: 'BAWAAL Arena',
      message: postId
        ? `Check @${handle} on BAWAAL: https://bawaal.app/reel/${postId}`
        : `Check @${handle} on BAWAAL`,
    });
  } catch (err) {
    console.warn('[ReelActionSheet] share failed:', err?.message || err);
  }
}

function ReelActionSheet({ visible, reel, onClose, onAction }) {
  const insets = useSafeAreaInsets();

  const run = async (actionId) => {
    if (actionId === 'share') {
      await shareReel(reel);
    }
    try {
      onAction?.(actionId, reel);
    } catch (_) {
      /* ignore */
    }
    onClose?.();
  };

  return (
    <Modal
      visible={!!visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, 14) },
          ]}
        >
          <View style={styles.handle} />
          <Text style={styles.title}>ACTIONS</Text>
          {ACTIONS.map((action, index) => (
            <TouchableOpacity
              key={action.id}
              style={[
                styles.row,
                index === ACTIONS.length - 1 && styles.rowLast,
              ]}
              onPress={() => run(action.id)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={action.label}
            >
              <Text style={styles.rowText}>{action.label}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={onClose}
            activeOpacity={0.85}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
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
  sheet: {
    backgroundColor: BG,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255,90,0,0.28)',
    paddingTop: 10,
    paddingHorizontal: 14,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.4,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: -4 },
      },
      android: { elevation: 12 },
      default: {},
    }),
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.22)',
    marginBottom: 12,
  },
  title: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  row: {
    backgroundColor: SURFACE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: HAIRLINE,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  rowLast: {
    marginBottom: 12,
  },
  rowText: {
    color: WHITE,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,90,0,0.45)',
  },
  cancelText: {
    color: ACCENT,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
});

export default memo(ReelActionSheet);
export { ACTIONS as REEL_ACTIONS };
