/**
 * Global BAWAAL branded alert — replaces native Alert.alert.
 * Deep black card, B solo mark, bold header, orange/white athletic actions.
 *
 * Usage:
 *   showBawaalAlert({ title, message, onConfirm })
 *   showBawaalAlert(title, message, [{ text, onPress, style }])
 *   const { showAlert } = useBawaalAlert();
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BG = '#000000';
const WHITE = '#FFFFFF';
const MUTED = 'rgba(255,255,255,0.62)';
const BORDER = 'rgba(255,255,255,0.22)';
const ORANGE = '#FF5500';
const DANGER = '#FF3366';
const LOGO = require('../../assets/BAWAAL_B_solo.png');

const BawaalAlertContext = createContext(null);

/** Imperative host bound by BawaalAlertProvider (works from services / non-React). */
let alertHost = null;

function bindAlertHost(api) {
  alertHost = api;
}

/**
 * Normalize Alert.alert-style args or object config into a single payload.
 * @param {string|object} titleOrConfig
 * @param {string|Array} [messageOrButtons]
 * @param {Array} [buttonsMaybe]
 */
export function normalizeBawaalAlertArgs(
  titleOrConfig,
  messageOrButtons,
  buttonsMaybe
) {
  if (
    titleOrConfig &&
    typeof titleOrConfig === 'object' &&
    !Array.isArray(titleOrConfig)
  ) {
    const cfg = titleOrConfig;
    if (Array.isArray(cfg.buttons) && cfg.buttons.length) {
      return {
        title: String(cfg.title || 'BAWAAL'),
        message: String(cfg.message || ''),
        buttons: cfg.buttons,
      };
    }
    const buttons = [];
    if (cfg.cancelLabel || cfg.onCancel) {
      buttons.push({
        text: cfg.cancelLabel || 'CANCEL',
        style: 'cancel',
        onPress: cfg.onCancel,
      });
    }
    buttons.push({
      text: cfg.confirmLabel || 'OK',
      style: cfg.destructive ? 'destructive' : 'default',
      onPress: cfg.onConfirm,
    });
    return {
      title: String(cfg.title || 'BAWAAL'),
      message: String(cfg.message || ''),
      buttons,
    };
  }

  const title = String(titleOrConfig || 'BAWAAL');
  if (Array.isArray(messageOrButtons)) {
    return {
      title,
      message: '',
      buttons: messageOrButtons.length
        ? messageOrButtons
        : [{ text: 'OK' }],
    };
  }
  return {
    title,
    message: String(messageOrButtons || ''),
    buttons:
      Array.isArray(buttonsMaybe) && buttonsMaybe.length
        ? buttonsMaybe
        : [{ text: 'OK' }],
  };
}

/**
 * Drop-in replacement for Alert.alert / object helper.
 * Mount `<BawaalAlertProvider>` at app root first.
 */
export function showBawaalAlert(titleOrConfig, messageOrButtons, buttonsMaybe) {
  const payload = normalizeBawaalAlertArgs(
    titleOrConfig,
    messageOrButtons,
    buttonsMaybe
  );
  if (alertHost && typeof alertHost.show === 'function') {
    alertHost.show(payload);
    return;
  }
  console.warn(
    '[BawaalAlert] Provider not mounted — alert dropped:',
    payload.title
  );
}

export function useBawaalAlert() {
  const ctx = useContext(BawaalAlertContext);
  if (!ctx) {
    return {
      showAlert: showBawaalAlert,
      hideAlert: () => {},
    };
  }
  return ctx;
}

function BawaalAlertModal({ visible, title, message, buttons, onRequestClose }) {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 16) + 24;
  const actions = Array.isArray(buttons) && buttons.length
    ? buttons
    : [{ text: 'OK' }];

  const runPress = (btn) => {
    onRequestClose?.();
    // Defer so modal unmounts before navigation / follow-up UI
    setTimeout(() => {
      try {
        btn?.onPress?.();
      } catch (err) {
        console.warn('[BawaalAlert] button handler:', err?.message || err);
      }
    }, 40);
  };

  return (
    <Modal
      visible={!!visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onRequestClose}
    >
      <View style={styles.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onRequestClose} />
        <View style={[styles.card, { marginBottom: bottomPad }]}>
          <Image source={LOGO} style={styles.logo} resizeMode="contain" />
          <Text style={styles.title}>{title || 'BAWAAL'}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}

          <View style={styles.actions}>
            {actions.map((btn, i) => {
              const label = String(btn?.text || 'OK').toUpperCase();
              const styleKey = String(btn?.style || 'default');
              const isCancel = styleKey === 'cancel';
              const isDestructive = styleKey === 'destructive';
              const isPrimary = !isCancel && (i === actions.length - 1 || !isDestructive);

              return (
                <TouchableOpacity
                  key={`${label}-${i}`}
                  style={[
                    styles.btn,
                    isCancel && styles.btnCancel,
                    isDestructive && styles.btnDestructive,
                    isPrimary && !isDestructive && styles.btnPrimary,
                  ]}
                  activeOpacity={0.85}
                  onPress={() => runPress(btn)}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                >
                  <Text
                    style={[
                      styles.btnText,
                      isCancel && styles.btnTextCancel,
                      isDestructive && styles.btnTextDestructive,
                      isPrimary && !isDestructive && styles.btnTextPrimary,
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

/**
 * Mount once near app root so `showBawaalAlert` works everywhere.
 */
export function BawaalAlertProvider({ children }) {
  const [payload, setPayload] = useState(null);
  const queueRef = useRef([]);
  const showingRef = useRef(false);

  const hideAlert = useCallback(() => {
    setPayload(null);
    showingRef.current = false;
    const next = queueRef.current.shift();
    if (next) {
      requestAnimationFrame(() => {
        showingRef.current = true;
        setPayload(next);
      });
    }
  }, []);

  const showAlert = useCallback((titleOrConfig, messageOrButtons, buttonsMaybe) => {
    const next = normalizeBawaalAlertArgs(
      titleOrConfig,
      messageOrButtons,
      buttonsMaybe
    );
    if (showingRef.current || payload) {
      queueRef.current.push(next);
      return;
    }
    showingRef.current = true;
    setPayload(next);
  }, [payload]);

  useEffect(() => {
    bindAlertHost({
      show: (cfg) => {
        if (showingRef.current) {
          queueRef.current.push(cfg);
          return;
        }
        showingRef.current = true;
        setPayload(cfg);
      },
      hide: hideAlert,
    });
    return () => bindAlertHost(null);
  }, [hideAlert]);

  const value = useMemo(
    () => ({ showAlert, hideAlert }),
    [showAlert, hideAlert]
  );

  return (
    <BawaalAlertContext.Provider value={value}>
      {children}
      <BawaalAlertModal
        visible={!!payload}
        title={payload?.title}
        message={payload?.message}
        buttons={payload?.buttons}
        onRequestClose={hideAlert}
      />
    </BawaalAlertContext.Provider>
  );
}

/** Presentational export for one-off controlled usage. */
export default function BawaalAlert({
  visible,
  title,
  message = '',
  onConfirm,
  onCancel,
  confirmLabel = 'OK',
  cancelLabel,
  destructive = false,
  buttons,
}) {
  const resolved = normalizeBawaalAlertArgs({
    title,
    message,
    onConfirm,
    onCancel,
    confirmLabel,
    cancelLabel,
    destructive,
    buttons,
  });
  return (
    <BawaalAlertModal
      visible={visible}
      title={resolved.title}
      message={resolved.message}
      buttons={resolved.buttons}
      onRequestClose={onCancel || onConfirm}
    />
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    paddingTop: 28,
    paddingBottom: 20,
    paddingHorizontal: 22,
    alignItems: 'center',
  },
  logo: {
    width: 56,
    height: 56,
    marginBottom: 16,
  },
  title: {
    color: WHITE,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1.2,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  message: {
    color: MUTED,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 12,
  },
  actions: {
    width: '100%',
    marginTop: 22,
    gap: 10,
  },
  btn: {
    width: '100%',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {
    backgroundColor: ORANGE,
    borderColor: ORANGE,
  },
  btnCancel: {
    backgroundColor: 'transparent',
    borderColor: BORDER,
  },
  btnDestructive: {
    backgroundColor: 'transparent',
    borderColor: DANGER,
  },
  btnText: {
    color: WHITE,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  btnTextPrimary: {
    color: WHITE,
  },
  btnTextCancel: {
    color: MUTED,
  },
  btnTextDestructive: {
    color: DANGER,
  },
});
