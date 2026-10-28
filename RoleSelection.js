import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Modal,
  FlatList,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const COUNTRIES = [
  { name: 'India', flag: '🇮🇳' },
  { name: 'UK', flag: '🇬🇧' },
  { name: 'USA', flag: '🇺🇸' },
  { name: 'Germany', flag: '🇩🇪' },
  { name: 'France', flag: '🇫🇷' },
  { name: 'Italy', flag: '🇮🇹' },
  { name: 'Spain', flag: '🇪🇸' },
  { name: 'Australia', flag: '🇦🇺' },
  { name: 'New Zealand', flag: '🇳🇿' },
  { name: 'Thailand', flag: '🇹🇭' },
  { name: 'Japan', flag: '🇯🇵' },
  { name: 'Philippines', flag: '🇵🇭' },
];

const LANGUAGES = [
  { name: 'English', code: 'en' },
  { name: 'हिंदी', code: 'hi' },
  { name: 'Español', code: 'es' },
  { name: 'Français', code: 'fr' },
  { name: 'Deutsch', code: 'de' },
  { name: 'Italiano', code: 'it' },
  { name: '日本語', code: 'ja' },
  { name: 'Tagalog', code: 'tl' },
  { name: 'ไทย', code: 'th' },
];

const ROLES = [
  { key: 'fan', label: 'Fan' },
  { key: 'athlete', label: 'Athlete' },
  { key: 'scout', label: 'Scout' },
];

const SPORT_INTERESTS = [
  'All Sports',
  'Cricket',
  'Football',
  'MMA',
  'Boxing',
  'Basketball',
  'Kabaddi',
  'Motorsport',
  'Tennis',
  'Athletics',
];

const BG = '#000000';
const SURFACE = '#0A0A0A';
const WHITE = '#FFFFFF';
const OFF_WHITE = '#E8ECE9';
const MUTED = '#A0A0A0';
const BORDER = '#FFFFFF';
const BORDER_DIM = 'rgba(232, 236, 233, 0.35)';

function PillRow({ options, selected, onSelect, multi = false }) {
  return (
    <View style={styles.pillWrap}>
      {options.map((opt) => {
        const key = typeof opt === 'string' ? opt : opt.key;
        const label = typeof opt === 'string' ? opt : opt.label;
        const active = multi
          ? Array.isArray(selected) && selected.includes(key)
          : selected === key;
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

export default function RoleSelection({ onCompleteRegistration }) {
  const [country, setCountry] = useState(COUNTRIES[0]);
  const [language, setLanguage] = useState(LANGUAGES[0]);

  const [countryModalVisible, setCountryModalVisible] = useState(false);
  const [langModalVisible, setLangModalVisible] = useState(false);
  const [termsModalVisible, setTermsModalVisible] = useState(false);
  const [otpModalVisible, setOtpModalVisible] = useState(false);

  const [handle, setHandle] = useState('');
  const [realName, setRealName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('fan');
  const [sportInterest, setSportInterest] = useState('All Sports');
  const [location, setLocation] = useState('');
  const [focusedField, setFocusedField] = useState(null);

  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const otpInputs = useRef([]);

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
      country: country.name,
      language: language.name,
    };

    setOtpModalVisible(false);

    if (onCompleteRegistration) {
      onCompleteRegistration(userData);
    }
  };

  const inputStyle = (key) => [
    styles.input,
    focusedField === key && styles.inputFocused,
  ];

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
              source={require('./assets/explosive_golden_bawaal_logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
            <Text style={styles.brandSubheader}>
              The World's Premier Digital Arena for Every Sport, Every Adventure
            </Text>
          </View>

          <View style={styles.dropdownRow}>
            <View style={styles.dropdownBox}>
              <Text style={styles.fieldLabel}>COUNTRY</Text>
              <TouchableOpacity
                style={styles.dropdownButton}
                onPress={() => setCountryModalVisible(true)}
                activeOpacity={0.75}
              >
                <Text style={styles.dropdownText}>
                  {country.flag}  {country.name}  ▾
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.dropdownBox}>
              <Text style={styles.fieldLabel}>LANGUAGE</Text>
              <TouchableOpacity
                style={styles.dropdownButton}
                onPress={() => setLangModalVisible(true)}
                activeOpacity={0.75}
              >
                <Text style={styles.dropdownText}>{language.name}  ▾</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>ENTER THE ARENA</Text>
            <Text style={styles.cardHint}>Claim your identity. Join the digital arena.</Text>

            {/* 1. Display Name / Handle */}
            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>DISPLAY NAME / HANDLE</Text>
              <TextInput
                style={inputStyle('handle')}
                placeholder="e.g. King of the Ring"
                placeholderTextColor={MUTED}
                value={handle}
                onChangeText={setHandle}
                autoCapitalize="words"
                onFocus={() => setFocusedField('handle')}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            {/* 2. Real Name & Email */}
            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>REAL NAME</Text>
              <TextInput
                style={inputStyle('realName')}
                placeholder="Legal name"
                placeholderTextColor={MUTED}
                value={realName}
                onChangeText={setRealName}
                autoCapitalize="words"
                onFocus={() => setFocusedField('realName')}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>EMAIL ADDRESS</Text>
              <TextInput
                style={inputStyle('email')}
                placeholder="name@example.com"
                placeholderTextColor={MUTED}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            {/* 3. Mobile Number */}
            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>MOBILE NUMBER</Text>
              <TextInput
                style={inputStyle('phone')}
                placeholder="+91 · OTP verification"
                placeholderTextColor={MUTED}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
                onFocus={() => setFocusedField('phone')}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            {/* 4. Role Selector */}
            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>ROLE</Text>
              <View style={styles.roleBox}>
                <PillRow options={ROLES} selected={role} onSelect={setRole} />
              </View>
            </View>

            {/* 5. Sport Interest */}
            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>SPORT INTEREST</Text>
              <PillRow
                options={SPORT_INTERESTS}
                selected={sportInterest}
                onSelect={setSportInterest}
              />
            </View>

            {/* 6. Location */}
            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>LOCATION</Text>
              <TextInput
                style={inputStyle('location')}
                placeholder="e.g. Mumbai, India / New York, USA"
                placeholderTextColor={MUTED}
                value={location}
                onChangeText={setLocation}
                onFocus={() => setFocusedField('location')}
                onBlur={() => setFocusedField(null)}
              />
              <Text style={styles.helperText}>
                Used for regional matchmaking and scouting.
              </Text>
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

      {/* Country Modal */}
      <Modal visible={countryModalVisible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setCountryModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Country</Text>
            <FlatList
              data={COUNTRIES}
              keyExtractor={(item) => item.name}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    setCountry(item);
                    setCountryModalVisible(false);
                  }}
                >
                  <Text style={styles.modalItemText}>
                    {item.flag}  {item.name}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Language Modal */}
      <Modal visible={langModalVisible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setLangModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Language</Text>
            <FlatList
              data={LANGUAGES}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    setLanguage(item);
                    setLangModalVisible(false);
                  }}
                >
                  <Text style={styles.modalItemText}>{item.name}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

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
                source={require('./assets/explosive_golden_bawaal_logo.png')}
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
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 48,
  },
  brandHeader: {
    alignItems: 'center',
    marginBottom: 18,
  },
  logoImage: {
    width: 240,
    height: 150,
    marginBottom: 8,
  },
  brandSubheader: {
    fontSize: 13,
    color: OFF_WHITE,
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 19,
    paddingHorizontal: 8,
    letterSpacing: 0.2,
  },
  dropdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 10,
  },
  dropdownBox: {
    flex: 1,
  },
  dropdownButton: {
    backgroundColor: SURFACE,
    borderRadius: 0,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: BORDER_DIM,
  },
  dropdownText: {
    color: WHITE,
    fontSize: 13,
    fontWeight: '600',
  },
  card: {
    borderRadius: 0,
    padding: 18,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: BG,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: WHITE,
    letterSpacing: 2,
    textAlign: 'center',
  },
  cardHint: {
    fontSize: 12,
    color: MUTED,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 20,
  },
  formGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    color: MUTED,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  input: {
    backgroundColor: SURFACE,
    borderRadius: 0,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: BORDER_DIM,
    color: WHITE,
    fontSize: 15,
  },
  inputFocused: {
    borderColor: WHITE,
  },
  helperText: {
    marginTop: 6,
    fontSize: 11,
    color: MUTED,
    lineHeight: 15,
  },
  roleBox: {
    borderWidth: 1,
    borderColor: BORDER_DIM,
    padding: 10,
    backgroundColor: SURFACE,
  },
  pillWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    borderWidth: 1,
    borderColor: BORDER_DIM,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: BG,
    minWidth: 72,
    alignItems: 'center',
  },
  pillActive: {
    backgroundColor: WHITE,
    borderColor: WHITE,
  },
  pillText: {
    color: OFF_WHITE,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  pillTextActive: {
    color: BG,
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 18,
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: WHITE,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BG,
  },
  checkboxChecked: {
    backgroundColor: WHITE,
  },
  checkmark: {
    color: BG,
    fontWeight: '900',
    fontSize: 12,
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
    fontWeight: '700',
  },
  ctaBtn: {
    backgroundColor: WHITE,
    borderRadius: 0,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: WHITE,
  },
  ctaBtnDisabled: {
    backgroundColor: BG,
    borderColor: BORDER_DIM,
  },
  ctaBtnText: {
    color: BG,
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 1.5,
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
    padding: 20,
    width: '88%',
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: WHITE,
  },
  termsModal: {
    height: '80%',
  },
  modalTitle: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 14,
    textAlign: 'center',
  },
  modalItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_DIM,
  },
  modalItemText: {
    color: WHITE,
    fontSize: 15,
  },
  termsScrollView: {
    marginBottom: 12,
  },
  legalHeading: {
    color: WHITE,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 12,
    marginBottom: 4,
  },
  legalBody: {
    color: MUTED,
    fontSize: 12,
    lineHeight: 18,
  },
  termsFooter: {
    marginTop: 8,
  },
  acceptTermsBtn: {
    backgroundColor: WHITE,
    borderRadius: 0,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: WHITE,
  },
  acceptTermsBtnDisabled: {
    backgroundColor: BG,
    borderColor: BORDER_DIM,
  },
  acceptTermsBtnText: {
    color: BG,
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 1,
  },
  acceptTermsBtnTextDisabled: {
    color: MUTED,
  },
  otpModalContent: {
    backgroundColor: BG,
    borderRadius: 0,
    padding: 24,
    width: '88%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: WHITE,
  },
  otpLogo: {
    width: 140,
    height: 70,
    marginBottom: 10,
  },
  otpTitle: {
    color: WHITE,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  otpSubtitle: {
    color: MUTED,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 20,
  },
  otpInputContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  otpBox: {
    width: 42,
    height: 48,
    backgroundColor: SURFACE,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: BORDER,
    color: WHITE,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
});
