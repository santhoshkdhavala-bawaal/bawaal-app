/**
 * Global Set New Password surface when Supabase fires PASSWORD_RECOVERY
 * (email reset deep link / web redirect). Mount once under AppBoot.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
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
  const inputRef = useRef(null);
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

  useEffect(() => {
    if (!visible) return undefined;
    const t = setTimeout(() => {
      try {
        inputRef.current?.focus?.();
      } catch (_) {
        /* soft */
      }
    }, Platform.OS === 'web' ? 50 : 120);
    return () => clearTimeout(t);
  }, [visible]);

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

  const card = (
    <View
      style={[
        styles.card,
        { paddingBottom: Math.max(48, insets.bottom + 36) },
      ]}
      onStartShouldSetResponder={() => true}
    >
      <Image
        source={LOGO_FULL}
        style={styles.logo}
        resizeMode="contain"
        accessibilityLabel="BAWAAL"
      />
      <Text style={styles.title}>SET NEW PASSWORD</Text>
      <Text style={styles.subtitle}>
        Choose a new password (at least {MIN_PASSWORD_LENGTH} characters).
      </Text>

      <View style={[styles.inputCard, focused && styles.inputCardFocused]}>
        <TextInput
          ref={inputRef}
          style={[styles.input, Platform.OS === 'web' && styles.inputWeb]}
          placeholder="New password"
          placeholderTextColor={PLACEHOLDER}
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="newPassword"
          autoComplete="password-new"
          editable
          autoFocus
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          underlineColorAndroid="transparent"
          selectionColor={ORANGE}
        />
        <TouchableOpacity
          style={styles.showHideBtn}
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
  );

  return (
    <>
      <Modal visible={visible} transparent animationType="fade">
        {Platform.OS === 'web' ? (
          <View
            style={[
              styles.overlay,
              { paddingBottom: Math.max(48, insets.bottom + 40) },
            ]}
          >
            {card}
          </View>
        ) : (
          <View
            style={[
              styles.overlay,
              { paddingBottom: Math.max(48, insets.bottom + 40) },
            ]}
          >
            <Pressable
              style={StyleSheet.absoluteFillObject}
              onPress={Keyboard.dismiss}
              accessibilityRole="button"
              accessibilityLabel="Dismiss keyboard"
            />
            <KeyboardAvoidingView
              style={styles.flex}
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              pointerEvents="box-none"
            >
              {card}
            </KeyboardAvoidingView>
          </View>
        )}
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
  flex: { flex: 1 },
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
    paddingRight: 4,
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: 20,
    overflow: 'hidden',
  },
  inputCardFocused: {
    borderColor: ORANGE,
  },
  input: {
    flex: 1,
    alignSelf: 'stretch',
    minWidth: 0,
    width: '100%',
    height: '100%',
    minHeight: 48,
    color: WHITE,
    fontSize: 15,
    fontWeight: '600',
    paddingVertical: 0,
    margin: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  inputWeb: {
    outlineStyle: 'none',
    outlineWidth: 0,
    outlineColor: 'transparent',
    boxShadow: 'none',
    cursor: 'text',
    height: '100%',
    minHeight: 48,
  },
  showHideBtn: {
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    minWidth: 48,
    paddingHorizontal: 6,
  },
  showHide: {
    color: ORANGE,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
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
