/**
 * Locked 4-box OTP input — no 6-digit fallback, no auto-submit.
 * Parent must fire verification via an explicit SUBMIT / VERIFY control.
 */
import React, { useRef } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

/** Fixed OTP length — do not change or make dynamic. */
export const OTP_LENGTH = 4;

const BOX_BG = '#0A192F';
const BOX_BORDER = '#3B82F6';
const WHITE = '#FFFFFF';

export function emptyOtpDigits() {
  return Array.from({ length: OTP_LENGTH }, () => '');
}

/**
 * @param {{
 *   digits?: string[],
 *   onChangeDigits?: (next: string[]) => void,
 *   editable?: boolean,
 * }} props
 */
export default function OTPInput({
  digits,
  onChangeDigits,
  editable = true,
}) {
  const inputs = useRef([]);
  const values =
    Array.isArray(digits) && digits.length === OTP_LENGTH
      ? digits
      : emptyOtpDigits();

  const commit = (next) => {
    onChangeDigits?.(next.slice(0, OTP_LENGTH));
  };

  const handleChange = (raw, index) => {
    if (!editable) return;
    // Keep a single numeric digit only (paste of longer strings takes first digit)
    const cleaned = String(raw || '').replace(/\D/g, '');
    const digit = cleaned.slice(-1);
    const next = [...values];
    next[index] = digit;
    commit(next);
    // Advance focus only — never auto-verify
    if (digit && index < OTP_LENGTH - 1) {
      inputs.current[index + 1]?.focus?.();
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key !== 'Backspace') return;
    if (values[index]) return;
    if (index > 0) {
      inputs.current[index - 1]?.focus?.();
    }
  };

  return (
    <View style={styles.row}>
      {Array.from({ length: OTP_LENGTH }, (_, idx) => (
        <TextInput
          key={`otp-${idx}`}
          ref={(ref) => {
            inputs.current[idx] = ref;
          }}
          style={[styles.box, values[idx] ? styles.boxFilled : null]}
          keyboardType="number-pad"
          maxLength={1}
          value={values[idx]}
          onChangeText={(val) => handleChange(val, idx)}
          onKeyPress={(e) => handleKeyPress(e, idx)}
          selectionColor={WHITE}
          editable={editable}
          textAlign="center"
          importantForAutofill="no"
          autoComplete="off"
          textContentType="oneTimeCode"
          accessibilityLabel={`OTP digit ${idx + 1} of ${OTP_LENGTH}`}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  box: {
    width: 52,
    height: 56,
    backgroundColor: BOX_BG,
    borderWidth: 1.5,
    borderColor: BOX_BORDER,
    borderRadius: 10,
    color: WHITE,
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    paddingVertical: 0,
  },
  boxFilled: {
    borderColor: BOX_BORDER,
    backgroundColor: BOX_BG,
  },
});
