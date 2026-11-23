/**
 * Confirmation sheet for permanent account deletion.
 * Requires typing DELETE before the destructive CTA enables.
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BG = '#000000';
const CARD = '#121212';
const WHITE = '#FFFFFF';
const MUTED = '#A0A0A0';
const DANGER = '#DC2626';
const DANGER_SOFT = '#F87171';
const CONFIRM_TOKEN = 'DELETE';

export default function DeleteAccountConfirmModal({
  visible,
  busy = false,
  onCancel,
  onConfirm,
}) {
  const insets = useSafeAreaInsets();
  const [typed, setTyped] = useState('');
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!visible) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset confirm field when sheet closes
      setTyped('');
      setFocused(false);
    }
  }, [visible]);

  const canConfirm =
    String(typed || '').trim().toUpperCase() === CONFIRM_TOKEN && !busy;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={busy ? undefined : onCancel}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={busy ? undefined : onCancel}
        />
        <View
          style={[
            styles.card,
            { marginBottom: Math.max(insets.bottom, 16) },
          ]}
        >
          <Text style={styles.title}>DELETE ACCOUNT</Text>
          <Text style={styles.body}>
            This permanently deletes your BAWAAL account and associated profile
            data. This cannot be undone.
          </Text>
          <Text style={styles.hint}>
            Type <Text style={styles.hintStrong}>{CONFIRM_TOKEN}</Text> to
            confirm.
          </Text>

          <TextInput
            style={[styles.input, focused && styles.inputFocused]}
            value={typed}
            onChangeText={setTyped}
            placeholder={CONFIRM_TOKEN}
            placeholderTextColor={MUTED}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!busy}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            underlineColorAndroid="transparent"
            selectionColor={DANGER}
            accessibilityLabel="Type DELETE to confirm account deletion"
          />

          <TouchableOpacity
            style={[styles.confirmBtn, !canConfirm && styles.confirmBtnDisabled]}
            onPress={onConfirm}
            disabled={!canConfirm}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Permanently delete account"
          >
            {busy ? (
              <ActivityIndicator color={WHITE} size="small" />
            ) : (
              <Text style={styles.confirmBtnText}>DELETE MY ACCOUNT</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={onCancel}
            disabled={busy}
            activeOpacity={0.8}
            accessibilityRole="button"
          >
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(220,38,38,0.45)',
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 16,
  },
  title: {
    color: DANGER_SOFT,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.4,
    marginBottom: 10,
  },
  body: {
    color: WHITE,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    marginBottom: 10,
  },
  hint: {
    color: MUTED,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  hintStrong: {
    color: DANGER_SOFT,
    fontWeight: '900',
  },
  input: {
    backgroundColor: CARD,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    color: WHITE,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1.2,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
    ...(Platform.OS === 'web'
      ? {
          outlineStyle: 'none',
          outlineWidth: 0,
        }
      : null),
  },
  inputFocused: {
    borderColor: DANGER,
  },
  confirmBtn: {
    backgroundColor: DANGER,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  confirmBtnDisabled: {
    opacity: 0.4,
  },
  confirmBtnText: {
    color: WHITE,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  cancelBtn: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 8,
  },
  cancelBtnText: {
    color: MUTED,
    fontSize: 13,
    fontWeight: '700',
  },
});
