/**
 * BAWAAL stealth-black branded prompt / notice / squad-brief modal.
 * Fully opaque #000 scrim (no transparency bleed), B solo watermark,
 * centered card, actions cleared above the floating tab bar.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BG = '#000000';
const WHITE = '#FFFFFF';
const MUTED = 'rgba(255,255,255,0.55)';
const HAIRLINE = 'rgba(255,255,255,0.18)';
const ACCENT = '#4ADE80';
const CREATE_YELLOW = '#FACC15';
const BRIEF_PURPLE = '#A855F7';
const LOGO = require('../../assets/BAWAAL_B_solo.png');

function resolveConfirmColor(confirmLabel, confirmColor) {
  if (confirmColor) return confirmColor;
  const label = String(confirmLabel || '').toUpperCase();
  if (label.includes('POST')) return BRIEF_PURPLE;
  if (label.includes('CREATE')) return CREATE_YELLOW;
  return ACCENT;
}

export const SQUAD_BRIEF_SPORTS = [
  'Combat',
  'Football',
  'Cricket',
  'Gym',
  'Running',
  'Other',
];

/**
 * @param {object} props
 * @param {boolean} props.visible
 * @param {string} props.title
 * @param {string} [props.message]
 * @param {'prompt'|'notice'|'squadBrief'} [props.mode]
 * @param {string} [props.defaultValue]
 * @param {string} [props.placeholder]
 * @param {string} [props.confirmLabel]
 * @param {string} [props.cancelLabel]
 * @param {boolean} [props.multiline]
 * @param {(value: any) => void} [props.onConfirm]
 * @param {() => void} props.onCancel
 * @param {boolean} [props.busy]
 * @param {string} [props.confirmColor]
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
  confirmColor,
}) {
  const [value, setValue] = useState(defaultValue);
  const [briefTitle, setBriefTitle] = useState('');
  const [sportTag, setSportTag] = useState(SQUAD_BRIEF_SPORTS[0]);
  const [intel, setIntel] = useState('');
  const submittingRef = useRef(false);
  const scrollRef = useRef(null);
  const fieldYRef = useRef({});
  const insets = useSafeAreaInsets();
  // Floating tab bar (~70) + FAB + system inset — keep actions clear
  const bottomClearance = Math.max(insets.bottom, 12) + 108;
  const actionColor = resolveConfirmColor(confirmLabel, confirmColor);

  useEffect(() => {
    if (!visible) {
      submittingRef.current = false;
      return;
    }
    setValue(defaultValue || '');
    setBriefTitle(defaultValue || 'Matchday Lineup & Strategy');
    setSportTag(SQUAD_BRIEF_SPORTS[0]);
    setIntel('');
  }, [visible, defaultValue]);

  const scrollFieldIntoView = (key) => {
    requestAnimationFrame(() => {
      if (key === 'intel') {
        scrollRef.current?.scrollToEnd?.({ animated: true });
        return;
      }
      const y = fieldYRef.current[key];
      if (typeof y === 'number') {
        scrollRef.current?.scrollTo?.({
          y: Math.max(0, y - 24),
          animated: true,
        });
      }
    });
  };

  const dismissOutside = () => {
    Keyboard.dismiss();
    if (!busy) onCancel?.();
  };

  const runConfirm = (payload) => {
    if (busy || submittingRef.current) return;
    submittingRef.current = true;
    Keyboard.dismiss();
    requestAnimationFrame(() => {
      try {
        onConfirm?.(payload);
      } finally {
        setTimeout(() => {
          submittingRef.current = false;
        }, 400);
      }
    });
  };

  const submitPrompt = () => runConfirm(String(value || '').trim());

  const submitBrief = () =>
    runConfirm({
      title: String(briefTitle || '').trim(),
      sportTag: String(sportTag || 'Other').trim(),
      intel: String(intel || '').trim(),
    });

  const onPrimaryPress = () => {
    if (mode === 'notice') {
      Keyboard.dismiss();
      onCancel?.();
      return;
    }
    if (mode === 'squadBrief') {
      submitBrief();
      return;
    }
    submitPrompt();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      {/* Solid opaque scrim — blocks tab-bar dots / lines from bleeding through */}
      <View style={styles.scrim}>
        <KeyboardAvoidingView
          style={[
            styles.shell,
            {
              paddingTop: Math.max(insets.top, 20) + 12,
              paddingBottom: bottomClearance,
            },
          ]}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
          <Pressable style={styles.dismissZone} onPress={dismissOutside} />

          <View style={styles.card} accessibilityViewIsModal>
            <View style={styles.watermarkClip} pointerEvents="none">
              <Image
                source={LOGO}
                style={styles.watermark}
                resizeMode="contain"
                accessibilityElementsHidden
                importantForAccessibility="no"
              />
            </View>

            <ScrollView
              ref={scrollRef}
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              bounces={false}
              overScrollMode="never"
              showsVerticalScrollIndicator={false}
              showsHorizontalScrollIndicator={false}
              nestedScrollEnabled
            >
              <View style={styles.headerRow}>
                <Image source={LOGO} style={styles.headerLogo} resizeMode="contain" />
                <Text style={styles.brandMark}>BAWAAL</Text>
              </View>

              <Text style={styles.title}>{title}</Text>
              {message ? <Text style={styles.message}>{message}</Text> : null}

              {mode === 'prompt' ? (
                <View
                  onLayout={(e) => {
                    fieldYRef.current.prompt = e.nativeEvent.layout.y;
                  }}
                >
                  <TextInput
                    style={[styles.input, multiline && styles.inputMulti]}
                    value={value}
                    onChangeText={setValue}
                    placeholder={placeholder}
                    placeholderTextColor={MUTED}
                    selectionColor={WHITE}
                    autoFocus
                    multiline={multiline}
                    blurOnSubmit
                    underlineColorAndroid="transparent"
                    textAlignVertical={multiline ? 'top' : 'center'}
                    editable={!busy}
                    returnKeyType={multiline ? 'default' : 'done'}
                    onFocus={() => scrollFieldIntoView('prompt')}
                    onSubmitEditing={multiline ? undefined : submitPrompt}
                  />
                </View>
              ) : null}

              {mode === 'squadBrief' ? (
                <View>
                  <View
                    onLayout={(e) => {
                      fieldYRef.current.title = e.nativeEvent.layout.y;
                    }}
                  >
                    <Text style={styles.fieldLabel}>BRIEF TITLE</Text>
                    <TextInput
                      style={styles.input}
                      value={briefTitle}
                      onChangeText={setBriefTitle}
                      placeholder='e.g. "Friday Sparring Block"'
                      placeholderTextColor={MUTED}
                      selectionColor={WHITE}
                      autoFocus
                      blurOnSubmit
                      underlineColorAndroid="transparent"
                      editable={!busy}
                      returnKeyType="next"
                      onFocus={() => scrollFieldIntoView('title')}
                    />
                  </View>

                  <Text style={styles.fieldLabel}>SPORT TAG</Text>
                  <View style={styles.sportRow}>
                    {SQUAD_BRIEF_SPORTS.map((sport) => {
                      const on = sport === sportTag;
                      return (
                        <TouchableOpacity
                          key={sport}
                          style={[styles.sportPill, on && styles.sportPillOn]}
                          onPress={() => {
                            Keyboard.dismiss();
                            setSportTag(sport);
                          }}
                          activeOpacity={0.75}
                          disabled={busy}
                        >
                          <Text
                            style={[styles.sportPillText, on && styles.sportPillTextOn]}
                          >
                            {sport.toUpperCase()}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <View
                    onLayout={(e) => {
                      fieldYRef.current.intel = e.nativeEvent.layout.y;
                    }}
                  >
                    <Text style={styles.fieldLabel}>BRIEF INTEL</Text>
                    <TextInput
                      style={[styles.input, styles.inputMulti]}
                      value={intel}
                      onChangeText={setIntel}
                      placeholder="Venue, timing, rules, and tactics"
                      placeholderTextColor={MUTED}
                      selectionColor={WHITE}
                      multiline
                      blurOnSubmit={false}
                      underlineColorAndroid="transparent"
                      textAlignVertical="top"
                      editable={!busy}
                      onFocus={() => {
                        scrollFieldIntoView('intel');
                        setTimeout(() => scrollFieldIntoView('intel'), 120);
                        setTimeout(() => {
                          scrollRef.current?.scrollToEnd?.({ animated: true });
                        }, 220);
                      }}
                    />
                  </View>
                </View>
              ) : null}
            </ScrollView>

            {/* Footer pinned below scroll — always above tab bar via shell padding */}
            <View style={styles.footer}>
              {mode !== 'notice' ? (
                <Pressable
                  style={styles.btnGhost}
                  onPress={() => {
                    Keyboard.dismiss();
                    if (!busy) onCancel?.();
                  }}
                  disabled={busy}
                  hitSlop={10}
                >
                  <Text style={styles.btnGhostText}>{cancelLabel}</Text>
                </Pressable>
              ) : null}
              <Pressable
                style={styles.btnSolid}
                onPress={onPrimaryPress}
                disabled={busy}
                hitSlop={12}
              >
                <Text style={[styles.btnSolidText, { color: actionColor }]}>
                  {mode === 'notice' ? 'OK' : confirmLabel}
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: BG,
    // Kill any edge bleed / hairlines from underlying screens
    borderWidth: 0,
    margin: 0,
    padding: 0,
  },
  shell: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  dismissZone: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  card: {
    backgroundColor: BG,
    borderWidth: 0,
    borderColor: 'transparent',
    borderRadius: 0,
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 8,
    overflow: 'hidden',
    maxHeight: '100%',
    // Ensure no elevation shadows casting edge artifacts
    elevation: 0,
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
  },
  watermarkClip: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  watermark: {
    position: 'absolute',
    top: 8,
    right: 12,
    width: 140,
    height: 140,
    opacity: 0.06,
  },
  scroll: {
    flexGrow: 0,
    maxHeight: '100%',
  },
  scrollContent: {
    paddingBottom: 12,
    flexGrow: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  headerLogo: {
    width: 22,
    height: 22,
    marginRight: 10,
    tintColor: WHITE,
  },
  brandMark: {
    color: WHITE,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 3.2,
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
  fieldLabel: {
    color: MUTED,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  input: {
    borderWidth: 0,
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: HAIRLINE,
    color: WHITE,
    fontSize: 15,
    fontWeight: '600',
    paddingVertical: 12,
    paddingHorizontal: 0,
    marginBottom: 18,
    backgroundColor: 'transparent',
  },
  inputMulti: {
    minHeight: 96,
    borderWidth: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: HAIRLINE,
    paddingHorizontal: 0,
    paddingTop: 12,
  },
  sportRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  sportPill: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 0,
  },
  sportPillOn: {
    backgroundColor: 'rgba(168,85,247,0.18)',
  },
  sportPillText: {
    color: MUTED,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  sportPillTextOn: {
    color: BRIEF_PURPLE,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingTop: 14,
    paddingBottom: 18,
    borderWidth: 0,
    backgroundColor: BG,
  },
  btnGhost: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginRight: 18,
  },
  btnGhostText: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  btnSolid: {
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  btnSolidText: {
    color: ACCENT,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.6,
  },
});
