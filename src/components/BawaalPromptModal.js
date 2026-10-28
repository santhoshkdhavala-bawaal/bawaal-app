/**
 * BAWAAL stealth-black branded prompt / notice modal.
 * Pure black surface, crisp white border, bold "B" watermark header.
 */
import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

const BG = '#000000';
const WHITE = '#FFFFFF';
const MUTED = 'rgba(255,255,255,0.55)';
const LINE = 'rgba(255,255,255,0.85)';
const ACCENT = '#4ADE80';

/**
 * @param {object} props
 * @param {boolean} props.visible
 * @param {string} props.title
 * @param {string} [props.message]
 * @param {'prompt'|'notice'} [props.mode]
 * @param {string} [props.defaultValue]
 * @param {string} [props.placeholder]
 * @param {string} [props.confirmLabel]
 * @param {string} [props.cancelLabel]
 * @param {boolean} [props.multiline]
 * @param {(value: string) => void} [props.onConfirm]
 * @param {() => void} props.onCancel
 * @param {boolean} [props.busy]
 */
export default function BawaalPromptModal({
  visible,
  title,
  message = '',
  mode = 'prompt',
  defaultValue = '',
  placeholder = '',
  confirmLabel = 'CONFIRM',
  cancelLabel = 'CANCEL',
  multiline = false,
  onConfirm,
  onCancel,
  busy = false,
}) {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    if (visible) setValue(defaultValue || '');
  }, [visible, defaultValue]);

  const submit = () => {
    if (busy) return;
    onConfirm?.(String(value || '').trim());
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={busy ? undefined : onCancel} />
        <View style={styles.card} accessibilityViewIsModal>
          <Text style={styles.watermark} pointerEvents="none">
            B
          </Text>

          <Text style={styles.brandMark}>BAWAAL</Text>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}

          {mode === 'prompt' ? (
            <TextInput
              style={[styles.input, multiline && styles.inputMulti]}
              value={value}
              onChangeText={setValue}
              placeholder={placeholder}
              placeholderTextColor={MUTED}
              selectionColor={WHITE}
              autoFocus
              multiline={multiline}
              textAlignVertical={multiline ? 'top' : 'center'}
              editable={!busy}
              returnKeyType={multiline ? 'default' : 'done'}
              onSubmitEditing={multiline ? undefined : submit}
            />
          ) : null}

          <View style={styles.actions}>
            {mode === 'prompt' ? (
              <TouchableOpacity
                style={styles.btnGhost}
                onPress={onCancel}
                activeOpacity={0.75}
                disabled={busy}
              >
                <Text style={styles.btnGhostText}>{cancelLabel}</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={styles.btnSolid}
              onPress={mode === 'notice' ? onCancel : submit}
              activeOpacity={0.75}
              disabled={busy}
            >
              <Text style={styles.btnSolidText}>
                {mode === 'notice' ? 'OK' : confirmLabel}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.82)',
  },
  card: {
    backgroundColor: BG,
    borderWidth: 1.5,
    borderColor: LINE,
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 20,
    overflow: 'hidden',
  },
  watermark: {
    position: 'absolute',
    top: -18,
    right: 8,
    fontSize: 140,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.06)',
    letterSpacing: -4,
  },
  brandMark: {
    color: WHITE,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 3.2,
    marginBottom: 14,
  },
  title: {
    color: WHITE,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  message: {
    color: MUTED,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
    marginBottom: 16,
  },
  input: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
    color: WHITE,
    fontSize: 15,
    fontWeight: '600',
    paddingVertical: 12,
    marginBottom: 22,
  },
  inputMulti: {
    minHeight: 88,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  btnGhost: {
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginRight: 18,
  },
  btnGhostText: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  btnSolid: {
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  btnSolidText: {
    color: ACCENT,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.6,
  },
});
