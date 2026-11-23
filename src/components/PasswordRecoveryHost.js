/**
 * Global Set New Password surface when Supabase fires PASSWORD_RECOVERY
 * (email reset deep link / web redirect). Mount once under AppBoot.
 */
import React, { useEffect, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  MIN_PASSWORD_LENGTH,
  isValidPassword,
  updatePassword,
} from '../services/authPassword';
import { isSupabaseConfigured, supabase } from '../services/supabase';
import BawaalPromptModal from './BawaalPromptModal';

const BG = '#000000';
const WHITE = '#FFFFFF';
const CARD = '#1E1E22';
const ORANGE = '#FF6600';
const PLACEHOLDER = '#9CA3AF';
const MUTED = '#8A8A8A';
const LOGO_FULL = require('../../assets/BAWAAL_white_full.png');

export default function PasswordRecoveryHost() {
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState(false);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    if (!isSupabaseConfigured()) return undefined;
    let alive = true;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (!alive) return;
      if (event === 'PASSWORD_RECOVERY') {
        setPassword('');
        setShowPassword(false);
        setVisible(true);
      }
    });
    return () => {
      alive = false;
      try {
        subscription?.unsubscribe?.();
      } catch (_) {
        /* soft */
      }
    };
  }, []);

  const handleUpdate = async () => {
    if (busy) return;
    if (!isValidPassword(password)) {
      setNotice({
        title: 'New Password',
        message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      });
      return;
    }
    setBusy(true);
    try {
      const result = await updatePassword(password);
      if (!result.ok) {
        setNotice({
          title: 'Update Failed',
          message:
            result.error?.message || 'Could not update password. Try again.',
        });
        return;
      }
      setVisible(false);
      setPassword('');
      setNotice({
        title: 'Password Updated',
        message:
          'Your password has been updated. You can sign in with the new password.',
      });
    } catch (err) {
      setNotice({
        title: 'Update Failed',
        message: err?.message || 'Could not update password.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Modal visible={visible} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <KeyboardAvoidingView
            style={[
              styles.overlay,
              { paddingBottom: Math.max(48, insets.bottom + 40) },
            ]}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View
              style={[
                styles.card,
                { paddingBottom: Math.max(48, insets.bottom + 36) },
              ]}
            >
              <Image
                source={LOGO_FULL}
                style={styles.logo}
                resizeMode="contain"
                accessibilityLabel="BAWAAL"
              />
              <Text style={styles.title}>SET NEW PASSWORD</Text>
              <Text style={styles.subtitle}>
                Choose a new password (at least {MIN_PASSWORD_LENGTH}{' '}
                characters).
              </Text>

              <View
                style={[styles.inputCard, focused && styles.inputCardFocused]}
              >
                <TextInput
                  style={[
                    styles.input,
                    Platform.OS === 'web' && styles.inputWeb,
                  ]}
                  placeholder="New password"
                  placeholderTextColor={PLACEHOLDER}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="newPassword"
                  autoComplete="password-new"
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  underlineColorAndroid="transparent"
                  selectionColor={ORANGE}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword((v) => !v)}
                  activeOpacity={0.75}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityRole="button"
                >
                  <Text style={styles.showHide}>
                    {showPassword ? 'HIDE' : 'SHOW'}
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.cta, busy && styles.ctaDisabled]}
                onPress={handleUpdate}
                activeOpacity={0.85}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Update password"
              >
                <Text style={styles.ctaText}>
                  {busy ? 'UPDATING…' : 'UPDATE PASSWORD'}
                </Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      </Modal>

      <BawaalPromptModal
        visible={Boolean(notice)}
        mode="notice"
        title={notice?.title || 'BAWAAL'}
        message={notice?.message || ''}
        hideWatermark
        onCancel={() => setNotice(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: BG,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: BG,
    padding: 28,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 180,
    height: 56,
    marginBottom: 16,
  },
  title: {
    color: WHITE,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: 6,
  },
  subtitle: {
    color: MUTED,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 24,
  },
  inputCard: {
    width: '100%',
    height: 50,
    backgroundColor: CARD,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingLeft: 14,
    paddingRight: 10,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  inputCardFocused: {
    borderColor: ORANGE,
  },
  input: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    color: WHITE,
    fontSize: 15,
    fontWeight: '600',
    paddingVertical: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  inputWeb: {
    outlineStyle: 'none',
    outlineWidth: 0,
    outlineColor: 'transparent',
    boxShadow: 'none',
  },
  showHide: {
    color: ORANGE,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  cta: {
    width: '100%',
    height: 52,
    borderRadius: 999,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDisabled: {
    opacity: 0.45,
  },
  ctaText: {
    color: WHITE,
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 1.4,
  },
});
