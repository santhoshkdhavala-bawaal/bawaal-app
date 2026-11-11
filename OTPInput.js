/**
 * 4-box OTP input — no 6-digit fallback, no auto-submit.
 * One transparent TextInput overlays the visual boxes (web + mobile).
 * Parent must fire verification via an explicit SUBMIT / VERIFY control.
 * Box chrome: dark grey fill, orange focus border (explicit brand unlock).
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

/** Fixed OTP length — do not change or make dynamic. */
export const OTP_LENGTH = 4;

const BOX_BG = '#1E1E22';
const BOX_BORDER = '#333333';
const BOX_BORDER_ACTIVE = '#FF6600';
const WHITE = '#FFFFFF';
const ORANGE = '#FF6600';

export function emptyOtpDigits() {
  return Array.from({ length: OTP_LENGTH }, () => '');
}

function digitsToCode(digits) {
  if (!Array.isArray(digits) || digits.length !== OTP_LENGTH) return '';
  return digits.join('').replace(/\D/g, '').slice(0, OTP_LENGTH);
}

function codeToDigits(code) {
  const cleaned = String(code || '')
    .replace(/\D/g, '')
    .slice(0, OTP_LENGTH);
  const next = emptyOtpDigits();
  for (let i = 0; i < cleaned.length; i += 1) {
    next[i] = cleaned[i];
  }
  return next;
}

/**
 * @param {{
 *   digits?: string[],
 *   onChangeDigits?: (next: string[]) => void,
 *   editable?: boolean,
 *   autoFocus?: boolean,
 * }} props
 */
export default function OTPInput({
  digits,
  onChangeDigits,
  editable = true,
  autoFocus = true,
}) {
  const inputRef = useRef(null);
  const [focused, setFocused] = useState(false);
  const values =
    Array.isArray(digits) && digits.length === OTP_LENGTH
      ? digits
      : emptyOtpDigits();
  const code = digitsToCode(values);
  const activeIndex = focused
    ? Math.min(code.length, OTP_LENGTH - 1)
    : -1;

  useEffect(() => {
    if (!autoFocus || !editable) return undefined;
    const t = setTimeout(() => {
      inputRef.current?.focus?.();
    }, 50);
    return () => clearTimeout(t);
  }, [autoFocus, editable]);

  const focusInput = () => {
    if (!editable) return;
    inputRef.current?.focus?.();
  };

  const handleChange = (raw) => {
    if (!editable) return;
    // Never auto-verify — only sync digit boxes from the single field.
    onChangeDigits?.(codeToDigits(raw));
  };

  return (
    <Pressable
      style={styles.row}
      onPress={focusInput}
      accessibilityRole="none"
      accessible={false}
    >
      {Array.from({ length: OTP_LENGTH }, (_, idx) => (
        <View
          key={`otp-box-${idx}`}
          style={[
            styles.box,
            values[idx] ? styles.boxFilled : null,
            activeIndex === idx ? styles.boxActive : null,
          ]}
          pointerEvents="none"
        >
          <Text style={styles.digit}>{values[idx] || ''}</Text>
        </View>
      ))}

      <TextInput
        ref={inputRef}
        style={[styles.hiddenInput, Platform.OS === 'web' && styles.hiddenInputWeb]}
        value={code}
        onChangeText={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        maxLength={OTP_LENGTH}
        keyboardType="number-pad"
        inputMode="numeric"
        autoFocus={autoFocus}
        editable={editable}
        caretHidden
        autoCorrect={false}
        autoCapitalize="none"
        importantForAutofill="yes"
        autoComplete={Platform.OS === 'web' ? 'one-time-code' : 'sms-otp'}
        textContentType="oneTimeCode"
        selectionColor={ORANGE}
        underlineColorAndroid="transparent"
        accessibilityLabel={`OTP ${OTP_LENGTH}-digit code`}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    position: 'relative',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
  },
  box: {
    width: 52,
    height: 56,
    backgroundColor: BOX_BG,
    borderWidth: 1.5,
    borderColor: BOX_BORDER,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxFilled: {
    borderColor: BOX_BORDER,
    backgroundColor: BOX_BG,
  },
  boxActive: {
    borderColor: BOX_BORDER_ACTIVE,
  },
  digit: {
    color: WHITE,
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  hiddenInput: {
    ...StyleSheet.absoluteFillObject,
    color: 'transparent',
    backgroundColor: 'transparent',
    borderWidth: 0,
    fontSize: 22,
    opacity: 0.02,
    zIndex: 2,
    padding: 0,
    margin: 0,
  },
  hiddenInputWeb: {
    opacity: 1,
    caretColor: 'transparent',
    outlineStyle: 'none',
    outlineWidth: 0,
    outlineColor: 'transparent',
    boxShadow: 'none',
  },
});
