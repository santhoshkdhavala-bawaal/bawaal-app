/**
 * Trash control — deletes a linked Camera Roll / gallery asset after confirm.
 */
import React, { memo, useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { confirmAndDeleteGalleryAsset } from '../services/galleryMediaService';

type GalleryDeleteButtonProps = {
  assetId: string;
  onDeleted?: (id: string) => void;
  style?: StyleProp<ViewStyle>;
  label?: string;
  compact?: boolean;
};

function GalleryDeleteButton({
  assetId,
  onDeleted,
  style,
  label = 'Delete from gallery',
  compact = false,
}: GalleryDeleteButtonProps) {
  const [busy, setBusy] = useState(false);
  const disabled = busy || !assetId;

  const onPress = useCallback(async () => {
    if (!assetId || busy) return;
    setBusy(true);
    try {
      const deleted = await confirmAndDeleteGalleryAsset(assetId);
      if (deleted) {
        onDeleted?.(assetId);
      }
    } finally {
      setBusy(false);
    }
  }, [assetId, busy, onDeleted]);

  return (
    <Pressable
      onPress={() => {
        void onPress();
      }}
      disabled={disabled}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        compact ? styles.compactBtn : styles.btn,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color="#FF8A80" size="small" />
      ) : (
        <View style={styles.row}>
          <Text style={styles.icon}>🗑️</Text>
          {!compact ? <Text style={styles.text}>{label}</Text> : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,138,128,0.55)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactBtn: {
    backgroundColor: 'transparent',
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  icon: {
    fontSize: 16,
  },
  text: {
    color: '#FF8A80',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  disabled: {
    opacity: 0.35,
  },
  pressed: {
    opacity: 0.75,
  },
});

export default memo(GalleryDeleteButton);
