import { Alert, Platform } from 'react-native';
import { showBawaalAlert } from '../components/BawaalAlert';

/**
 * Cross-platform one-line text prompt.
 * iOS: Alert.prompt. Android: branded BAWAAL confirm with default value.
 */
export function textPrompt({
  title,
  message = '',
  defaultValue = '',
  confirmLabel = 'OK',
  onSubmit,
} = {}) {
  const finish = (raw) => {
    const value = String(raw ?? '').trim();
    onSubmit?.(value || String(defaultValue || '').trim());
  };

  if (Platform.OS === 'ios' && typeof Alert.prompt === 'function') {
    Alert.prompt(
      title,
      message,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: confirmLabel, onPress: finish },
      ],
      'plain-text',
      defaultValue || ''
    );
    return;
  }

  // Android has no Alert.prompt — branded confirm with the provided default.
  showBawaalAlert(
    title,
    [message, defaultValue ? `Will post: “${defaultValue}”` : null]
      .filter(Boolean)
      .join('\n\n'),
    [
      { text: 'Cancel', style: 'cancel' },
      { text: confirmLabel, onPress: () => finish(defaultValue) },
    ]
  );
}
