import React, { useMemo, useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { resolveLocationFlag } from './src/utils/locationFlag';

const ROLES = [
  { key: 'fan', label: 'Fan' },
  { key: 'athlete', label: 'Athlete' },
  { key: 'scout', label: 'Scout' },
];

/** Exact platform sport categories. */
const SPORT_INTERESTS = [
  'Cricket',
  'Football',
  'Gym',
  'Kabaddi',
  'Combat',
  'THROTTLE',
  'WAVE & BLADE',
  'COURT KINGS',
  'SKY & SUMMIT',
];

const BG = '#000000';
const WHITE = '#FFFFFF';
const OFF_WHITE = '#E8ECE9';
const MUTED = '#8A8A8A';
const LINE = 'rgba(255, 255, 255, 0.18)';
const LINE_FOCUS = 'rgba(255, 255, 255, 0.72)';

function PillRow({ options, selected, onSelect }) {
  return (
    <View style={styles.pillWrap}>
      {options.map((opt) => {
        const key = typeof opt === 'string' ? opt : opt.key;
        const label = typeof opt === 'string' ? opt : opt.label;
        const active = selected === key;
        return (
          <TouchableOpacity
            key={key}
            style={[styles.pill, active && styles.pillActive]}
            onPress={() => onSelect(key)}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.pillText, active && styles.pillTextActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function UnderlineField({
  label,
  value,
  onChangeText,
  placeholder,
  focused,
  onFocus,
  onBlur,
  keyboardType,
  autoCapitalize,
  autoCorrect,
  leading,
  trailing,
}) {
  return (
    <View style={styles.formGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.fieldRow, focused && styles.fieldRowFocused]}>
        {leading ? <View style={styles.fieldLeading}>{leading}</View> : null}
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={MUTED}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          onFocus={onFocus}
          onBlur={onBlur}
        />
        {trailing ? <View style={styles.fieldTrailing}>{trailing}</View> : null}
      </View>
    </View>
  );
}

export default function RoleSelection({ onCompleteRegistration }) {
  const [termsModalVisible, setTermsModalVisible] = useState(false);
  const [otpModalVisible, setOtpModalVisible] = useState(false);

  const [handle, setHandle] = useState('');
  const [realName, setRealName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [role, setRole] = useState('fan');
  const [sportInterest, setSportInterest] = useState(SPORT_INTERESTS[0]);
  const [focusedField, setFocusedField] = useState(null);

  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const otpInputs = useRef([]);

  const locationMeta = useMemo(
    () => resolveLocationFlag(location),
    [location]
  );
  const locationFlag = locationMeta.flag || '';

  const handleTermsScroll = ({ nativeEvent }) => {
    const isCloseToBottom =
      nativeEvent.layoutMeasurement.height + nativeEvent.contentOffset.y >=
      nativeEvent.contentSize.height - 20;
    if (isCloseToBottom && !hasScrolledToBottom) {
      setHasScrolledToBottom(true);
    }
  };

  const handleSendOtpTrigger = () => {
    if (!handle.trim() || !realName.trim() || !phone.trim() || !email.trim() || !location.trim()) {
      Alert.alert('Missing Fields', 'Please complete all required fields before continuing.');
      return;
    }
    if (!role) {
      Alert.alert('Select a Role', 'Choose Fan, Athlete, or Scout to enter the arena.');
      return;
    }
    if (!sportInterest) {
      Alert.alert('Sport Interest', 'Pick a sport interest for your feed.');
      return;
    }
    if (!agreedToTerms) {
      Alert.alert('Terms Required', 'Please review and accept the Terms of Service & Privacy Policy.');
      return;
    }
    setOtpModalVisible(true);
  };

  const handleOtpChange = (value, index) => {
    const newOtp = [...otpDigits];
    newOtp[index] = value;
    setOtpDigits(newOtp);
    if (value && index < 5) {
      otpInputs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputs.current[index - 1]?.focus();
    }
  };

  const handleEnterArena = () => {
    const fullOtp = otpDigits.join('');
    if (fullOtp.length < 6) {
      Alert.alert('Invalid OTP', 'Please enter the complete 6-digit verification code.');
      return;
    }

    const resolved = resolveLocationFlag(location);
    const userData = {
      handle: handle.trim(),
      displayName: handle.trim(),
      name: realName.trim(),
      realName: realName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      role,
      sport: sportInterest,
      sportInterest,
      location: location.trim(),
      flag: resolved.flag || '🌐',
      country: resolved.country || null,
      countryFlag: resolved.flag || '🌐',
      label: resolved.country || location.trim(),
    };

    setOtpModalVisible(false);

    if (onCompleteRegistration) {
      onCompleteRegistration(userData);
    }
  };

  const flagBadge =
    locationFlag && locationFlag !== '🌐' ? (
      <Text style={styles.flagEmoji} accessibilityLabel="Location country flag">
        {locationFlag}
      </Text>
    ) : null;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces
        >
          <View style={styles.brandHeader}>
            <Image
              source={require('./assets/BAWAAL_white_full.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
            <Text style={styles.brandSubheader}>
              The World's Premier Digital Arena for Every Sport, Every Adventure
            </Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.cardTitle}>ENTER THE ARENA</Text>
            <Text style={styles.cardHint}>Claim your identity. Join the digital arena.</Text>

            <UnderlineField
              label="DISPLAY NAME / HANDLE"
              value={handle}
              onChangeText={setHandle}
              placeholder="e.g. King of the Ring"
              autoCapitalize="words"
              focused={focusedField === 'handle'}
              onFocus={() => setFocusedField('handle')}
              onBlur={() => setFocusedField(null)}
              trailing={flagBadge}
            />

            <UnderlineField
              label="REAL NAME"
              value={realName}
              onChangeText={setRealName}
              placeholder="Legal name"
              autoCapitalize="words"
              focused={focusedField === 'realName'}
              onFocus={() => setFocusedField('realName')}
              onBlur={() => setFocusedField(null)}
            />

            <UnderlineField
              label="EMAIL ADDRESS"
              value={email}
              onChangeText={setEmail}
              placeholder="name@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              focused={focusedField === 'email'}
              onFocus={() => setFocusedField('email')}
              onBlur={() => setFocusedField(null)}
            />

            <UnderlineField
              label="MOBILE NUMBER"
              value={phone}
              onChangeText={setPhone}
              placeholder="+91 · OTP verification"
              keyboardType="phone-pad"
              focused={focusedField === 'phone'}
              onFocus={() => setFocusedField('phone')}
              onBlur={() => setFocusedField(null)}
            />

            <UnderlineField
              label="LOCATION"
              value={location}
              onChangeText={setLocation}
              placeholder="e.g. Mumbai, India / New York, USA"
              autoCapitalize="words"
              focused={focusedField === 'location'}
              onFocus={() => setFocusedField('location')}
              onBlur={() => setFocusedField(null)}
              trailing={
                locationFlag ? (
                  <Text style={styles.flagEmoji}>{locationFlag}</Text>
                ) : null
              }
            />
            <Text style={styles.helperText}>
              Used for regional matchmaking and scouting.
              {locationMeta.country ? ` · ${locationMeta.country}` : ''}
            </Text>

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>ROLE</Text>
              <PillRow options={ROLES} selected={role} onSelect={setRole} />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>SPORT INTEREST</Text>
              <PillRow
                options={SPORT_INTERESTS}
                selected={sportInterest}
                onSelect={setSportInterest}
              />
            </View>

            <TouchableOpacity
              style={styles.termsContainer}
              onPress={() => setTermsModalVisible(true)}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, agreedToTerms && styles.checkboxChecked]}>
                {agreedToTerms ? <Text style={styles.checkmark}>✓</Text> : null}
              </View>
              <Text style={styles.termsText}>
                I agree to the{' '}
                <Text style={styles.termsLink}>Terms of Service & Privacy Policy</Text>
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.ctaBtn, !agreedToTerms && styles.ctaBtnDisabled]}
              onPress={handleSendOtpTrigger}
              activeOpacity={0.85}
            >
              <Text style={[styles.ctaBtnText, !agreedToTerms && styles.ctaBtnTextDisabled]}>
                SEND OTP
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Terms Modal */}
      <Modal visible={termsModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.termsModal]}>
            <Text style={styles.modalTitle}>Terms of Service & Legal Rules</Text>
            <ScrollView
              style={styles.termsScrollView}
              onScroll={handleTermsScroll}
              scrollEventThrottle={16}
              showsVerticalScrollIndicator
            >
              <Text style={styles.legalHeading}>1. Age Eligibility & Parental Consent (13+)</Text>
              <Text style={styles.legalBody}>
                BAWAAL is strictly intended for users who are 13 years of age or older. Users between the ages of 13 and 17 explicitly represent and warrant that they have obtained full parental or legal guardian consent to register, participate, upload content, and enter the arena. Accounts belonging to children under 13 will be terminated immediately upon discovery.
              </Text>

              <Text style={styles.legalHeading}>2. Platform Mandate & Industry Disciplines</Text>
              <Text style={styles.legalBody}>
                BAWAAL is strictly dedicated to sports, athletic training, outdoor adventure activities, motorsports, Esports, and verified sports industry professionals (including commentators, coaches, scouts, and event managers). Any non-sports, spam, or off-topic content will be removed immediately without prior notice.
              </Text>

              <Text style={styles.legalHeading}>3. Intellectual Property & Brand Protection</Text>
              <Text style={styles.legalBody}>
                The BAWAAL name, logo, visual identity, software, and brand assets are the exclusive intellectual property of the platform. Users are strictly prohibited from using, copying, modifying, reproducing, or distributing the BAWAAL name or logo for commercial or personal purposes without explicit prior written authorization.
              </Text>

              <Text style={styles.legalHeading}>4. Liability Waiver & Physical Safety</Text>
              <Text style={styles.legalBody}>
                All sports, stunts, motorcycling, racing, climbing, and outdoor adventure activities are undertaken entirely at the user's own risk. BAWAAL assumes zero responsibility or liability for personal injury, property damage, legal infractions, or fatalities occurring during or as a result of recorded activities.
              </Text>

              <Text style={styles.legalHeading}>5. User Conduct & Legal Responsibility</Text>
              <Text style={styles.legalBody}>
                Users maintain 100% personal and legal liability for all content uploaded, comments posted, or actions performed on BAWAAL. Hate speech, harassment, dangerous illegal acts, defamation, and copyright violations will result in an immediate permanent ban and reporting to regulatory authorities.
              </Text>

              <Text style={styles.legalHeading}>6. Full Indemnification</Text>
              <Text style={styles.legalBody}>
                You agree to fully indemnify and hold harmless BAWAAL, its parent company, directors, and officers from any legal claims, liabilities, or expenses arising from your use of the platform.
              </Text>

              <Text style={styles.legalHeading}>7. Medical & Psychiatric Disclaimer</Text>
              <Text style={styles.legalBody}>
                Any medical advice, recovery tips, rehabilitation guidance, nutritional recommendations, mental-health support, or clinical insights shared by doctors, physiotherapists, sports psychiatrists, trainers, or other practitioners on BAWAAL are provided solely in those individuals' independent professional capacity. Such content does not constitute a doctor–patient relationship with BAWAAL. BAWAAL assumes no medical, clinical, psychiatric, pharmaceutical, or therapeutic liability whatsoever for outcomes arising from reliance on any practitioner content or advice on the platform. Always seek qualified in-person medical care for injuries, illness, or mental-health concerns.
              </Text>

              <Text style={styles.legalHeading}>8. General Platform Disclaimer</Text>
              <Text style={styles.legalBody}>
                BAWAAL is strictly a digital sports arena and community platform. BAWAAL is not responsible in any way for personal training injuries, physical outcomes, competition results, equipment failure, venue conditions, or individual user actions—online or offline. Participation in any sport, workout, challenge, battle, adventure, or physical activity inspired by or coordinated through BAWAAL is entirely at the user's own risk.
              </Text>
            </ScrollView>

            <View style={styles.termsFooter}>
              <TouchableOpacity
                disabled={!hasScrolledToBottom}
                style={[
                  styles.acceptTermsBtn,
                  !hasScrolledToBottom && styles.acceptTermsBtnDisabled,
                ]}
                onPress={() => {
                  setAgreedToTerms(true);
                  setTermsModalVisible(false);
                }}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.acceptTermsBtnText,
                    !hasScrolledToBottom && styles.acceptTermsBtnTextDisabled,
                  ]}
                >
                  {hasScrolledToBottom
                    ? 'I HAVE READ & AGREE'
                    : 'SCROLL TO BOTTOM TO ACCEPT'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* OTP Modal */}
      <Modal visible={otpModalVisible} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <View style={styles.otpModalContent}>
              <Image
                source={require('./assets/BAWAAL_white_icon.png')}
                style={styles.otpLogo}
                resizeMode="contain"
              />
              <Text style={styles.otpTitle}>VERIFY MOBILE NUMBER</Text>
              <Text style={styles.otpSubtitle}>
                Enter the 6-digit code sent to {phone || 'your phone'}
              </Text>

              <View style={styles.otpInputContainer}>
                {otpDigits.map((digit, idx) => (
                  <TextInput
                    key={idx}
                    ref={(ref) => {
                      otpInputs.current[idx] = ref;
                    }}
                    style={styles.otpBox}
                    keyboardType="numeric"
                    maxLength={1}
                    value={digit}
                    onChangeText={(val) => handleOtpChange(val, idx)}
                    onKeyPress={(e) => handleOtpKeyPress(e, idx)}
                  />
                ))}
              </View>

              <TouchableOpacity
                style={styles.ctaBtn}
                onPress={handleEnterArena}
                activeOpacity={0.85}
              >
                <Text style={styles.ctaBtnText}>ENTER ARENA</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 56,
  },
  brandHeader: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoImage: {
    width: 260,
    height: 88,
    marginBottom: 14,
  },
  brandSubheader: {
    fontSize: 13,
    color: OFF_WHITE,
    textAlign: 'center',
    fontWeight: '400',
    lineHeight: 19,
    paddingHorizontal: 12,
    opacity: 0.85,
  },
  form: {
    width: '100%',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: WHITE,
    letterSpacing: 2.4,
    textAlign: 'center',
  },
  cardHint: {
    fontSize: 12,
    color: MUTED,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 28,
  },
  formGroup: {
    marginBottom: 20,
  },
  fieldLabel: {
    color: MUTED,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.6,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
    paddingBottom: 10,
  },
  fieldRowFocused: {
    borderBottomColor: WHITE,
  },
  fieldLeading: {
    marginRight: 8,
  },
  fieldTrailing: {
    marginLeft: 8,
  },
  input: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingVertical: 4,
    paddingHorizontal: 0,
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  flagEmoji: {
    fontSize: 20,
    lineHeight: 24,
  },
  helperText: {
    marginTop: -10,
    marginBottom: 18,
    fontSize: 11,
    color: MUTED,
    lineHeight: 15,
  },
  pillWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 2,
    marginRight: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'transparent',
  },
  pillActive: {
    borderBottomColor: WHITE,
  },
  pillText: {
    color: MUTED,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  pillTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 22,
    gap: 12,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE_FOCUS,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  checkboxChecked: {
    backgroundColor: WHITE,
    borderColor: WHITE,
  },
  checkmark: {
    color: BG,
    fontWeight: '900',
    fontSize: 11,
  },
  termsText: {
    color: OFF_WHITE,
    fontSize: 12,
    flex: 1,
    lineHeight: 17,
  },
  termsLink: {
    color: WHITE,
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
  ctaBtn: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaBtnDisabled: {
    backgroundColor: 'transparent',
    opacity: 0.45,
  },
  ctaBtnText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 2.2,
  },
  ctaBtnTextDisabled: {
    color: MUTED,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: BG,
    borderRadius: 0,
    padding: 22,
    width: '88%',
    maxHeight: '80%',
  },
  termsModal: {
    height: '80%',
  },
  modalTitle: {
    color: WHITE,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 16,
    textAlign: 'center',
  },
  termsScrollView: {
    marginBottom: 12,
  },
  legalHeading: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 14,
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  legalBody: {
    color: OFF_WHITE,
    fontSize: 12,
    lineHeight: 19,
    fontWeight: '500',
  },
  termsFooter: {
    marginTop: 8,
  },
  acceptTermsBtn: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    paddingVertical: 14,
    alignItems: 'center',
  },
  acceptTermsBtnDisabled: {
    backgroundColor: 'transparent',
    opacity: 0.45,
  },
  acceptTermsBtnText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 1.4,
  },
  acceptTermsBtnTextDisabled: {
    color: MUTED,
  },
  otpModalContent: {
    backgroundColor: BG,
    borderRadius: 0,
    padding: 28,
    width: '88%',
    alignItems: 'center',
  },
  otpLogo: {
    width: 72,
    height: 72,
    marginBottom: 16,
  },
  otpTitle: {
    color: WHITE,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: 6,
  },
  otpSubtitle: {
    color: MUTED,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 24,
  },
  otpInputContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 28,
  },
  otpBox: {
    width: 40,
    height: 48,
    backgroundColor: 'transparent',
    borderRadius: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE_FOCUS,
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
});
