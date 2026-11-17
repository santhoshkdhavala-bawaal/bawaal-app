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
    maxHeight: '58%',
    minHeight: '42%',
    backgroundColor: '#0A0A0A',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: 1.5,
    borderTopColor: BAWAAL_ORANGE,
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  headerTitle: {
    color: BAWAAL_ORANGE,
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 1.2,
  },
  closeText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: 10,
    paddingBottom: 28,
    paddingTop: 4,
  },
  emojiTile: {
    width: 52,
    height: 52,
    backgroundColor: '#141414',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#222222',
  },
  loveTile: {
    borderColor: BAWAAL_ORANGE,
  },
  tileEmoji: {
    marginHorizontal: 0,
  },
});
