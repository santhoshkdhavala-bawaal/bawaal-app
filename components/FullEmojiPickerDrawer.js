/**
 * Full BAWAAL skeleton vault — scrollable grid of every mapped skel_* + skull_* emoji.
 * Grid order: keys starting with `skull` first, then `skel` / skeleton assets.
 */
import React, { memo, useMemo } from 'react';
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
import { BawaalEmoji, SKELETON_EMOJIS } from './BawaalEmoji';
import {
  ALL_SKELETON_KEYS as CONST_VAULT_KEYS,
  SKULL_EMOJI_KEYS,
  sortVaultEmojiKeys,
} from '../src/constants/bawaalEmojiAssets';

const BAWAAL_ORANGE = '#FF5500';

/**
 * Grid population list — merges constants + SKELETON_EMOJIS and force-includes
 * all `skull_*` keys, then sorts `skull…` → `skel…` for the Vault rows.
 */
function buildVaultKeys() {
  const merged = new Set([
    'love',
    ...SKULL_EMOJI_KEYS,
    ...CONST_VAULT_KEYS,
    ...Object.keys(SKELETON_EMOJIS || {}),
  ]);
  return sortVaultEmojiKeys(Array.from(merged));
}

export const ALL_SKELETON_KEYS = buildVaultKeys();

export const FullEmojiPickerDrawer = memo(function FullEmojiPickerDrawer({
  visible,
  onClose,
  onSelectEmoji,
}) {
  const insets = useSafeAreaInsets();
  const vaultKeys = useMemo(() => buildVaultKeys(), []);
  const count = vaultKeys.length;

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
            {vaultKeys.map((key) => (
              <TouchableOpacity
                key={key}
                style={[styles.emojiTile, key === 'love' && styles.loveTile]}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={key === 'love' ? 'Select love skeleton' : `Select ${key}`}
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
  loveTile: {
    borderColor: BAWAAL_ORANGE,
  },
  tileEmoji: {
    marginHorizontal: 0,
  },
});
