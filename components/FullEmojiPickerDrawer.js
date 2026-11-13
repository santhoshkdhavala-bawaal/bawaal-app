/**
 * Full BAWAAL skeleton vault — scrollable grid of every mapped skel_* emoji.
 */
import React, { memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BawaalEmoji, BAWAAL_EMOJI_KEYS } from './BawaalEmoji';

const BAWAAL_ORANGE = '#FF5500';

/** All unique skeleton asset keys from the centralized map. */
export const ALL_SKELETON_KEYS = BAWAAL_EMOJI_KEYS;

export const FullEmojiPickerDrawer = memo(function FullEmojiPickerDrawer({
  visible,
  onClose,
  onSelectEmoji,
}) {
  const insets = useSafeAreaInsets();
  const count = ALL_SKELETON_KEYS.length;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View
          style={[
            styles.drawerContainer,
            { paddingBottom: Math.max(insets.bottom, 16) },
          ]}
        >
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>
              BAWAAL SKELETON VAULT ({count})
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityRole="button">
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.gridContainer}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {ALL_SKELETON_KEYS.map((key) => (
              <TouchableOpacity
                key={key}
                style={styles.emojiTile}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={`Select ${key}`}
                onPress={() => {
                  try {
                    onSelectEmoji?.(key);
                  } catch (_) {
                    /* ignore */
                  }
                  onClose?.();
                }}
              >
                <BawaalEmoji name={key} size={36} style={styles.tileEmoji} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
});

export default FullEmojiPickerDrawer;

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  drawerContainer: {
    height: '50%',
    backgroundColor: '#121212',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderTopColor: BAWAAL_ORANGE,
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    color: BAWAAL_ORANGE,
    fontWeight: 'bold',
    fontSize: 14,
    letterSpacing: 1,
  },
  closeText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    gap: 12,
    paddingBottom: 20,
  },
  emojiTile: {
    width: 50,
    height: 50,
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  tileEmoji: {
    marginHorizontal: 0,
  },
});
