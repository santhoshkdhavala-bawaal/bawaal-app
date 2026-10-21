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

export default function RoleSelection({ onCompleteRegistration }) {
  const [country, setCountry] = useState(COUNTRIES[0]);
  const [language, setLanguage] = useState(LANGUAGES[0]);

  // Modal Controls
  const [countryModalVisible, setCountryModalVisible] = useState(false);
  const [langModalVisible, setLangModalVisible] = useState(false);
  const [termsModalVisible, setTermsModalVisible] = useState(false);
  const [otpModalVisible, setOtpModalVisible] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('Male');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [location, setLocation] = useState('');
  const [sport, setSport] = useState('');

  // Legal Terms State
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // OTP State & Input References
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const otpInputs = useRef([]);

  // Handle Terms Scroll
  const handleTermsScroll = ({ nativeEvent }) => {
    const isCloseToBottom =
      nativeEvent.layoutMeasurement.height + nativeEvent.contentOffset.y >=
      nativeEvent.contentSize.height - 20;
    if (isCloseToBottom && !hasScrolledToBottom) {
      setHasScrolledToBottom(true);
    }
  };

  // Trigger Send OTP Modal
  const handleSendOtpTrigger = () => {
    if (!name || !age || !phone || !email || !location || !sport) {
      Alert.alert('Missing Fields', 'Please fill in all registration details before proceeding.');
      return;
    }

    const parsedAge = parseInt(age, 10);
    if (isNaN(parsedAge) || parsedAge < 13) {
      Alert.alert('Age Restriction', 'BAWAAL is strictly for users aged 13 and above.');
      return;
    }

    if (!agreedToTerms) {
      Alert.alert('Terms Required', 'Please review and accept the Terms of Service & Privacy Policy.');
      return;
    }
    setOtpModalVisible(true);
  };

  // Handle OTP Input with Auto-Advancing Focus
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

  // Final Arena Verification
  const handleEnterArena = () => {
    const fullOtp = otpDigits.join('');
    if (fullOtp.length < 6) {
      Alert.alert('Invalid OTP', 'Please enter the complete 6-digit verification code.');
      return;
    }

    const userData = {
      name,
      age,
      gender,
      phone,
      email,
      location,
      sport,
      country: country.name,
      language: language.name,
    };

    setOtpModalVisible(false);

    if (onCompleteRegistration) {
      onCompleteRegistration(userData);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={true}
        >
          {/* Brand Header */}
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

          {/* Country & Language Selection */}
          <View style={styles.dropdownRow}>
            <View style={styles.dropdownBox}>
              <Text style={styles.dropdownLabel}>COUNTRY 🌐</Text>
              <TouchableOpacity
                style={styles.dropdownButton}
                onPress={() => setCountryModalVisible(true)}
              >
                <Text style={styles.dropdownText}>
                  {country.flag}  {country.name} ▼
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.dropdownBox}>
              <Text style={styles.dropdownLabel}>LANGUAGE 💬</Text>
              <TouchableOpacity
                style={styles.dropdownButton}
                onPress={() => setLangModalVisible(true)}
              >
                <Text style={styles.dropdownText}>{language.name} ▼</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Landing Page Registration Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>ENTER THE ARENA</Text>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>FULL NAME</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Alex Rider"
                placeholderTextColor="#5A7268"
                value={name}
                onChangeText={setName}
              />
            </View>

            <View style={styles.rowGroup}>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>AGE</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Age (13+)"
                  placeholderTextColor="#5A7268"
                  keyboardType="numeric"
                  value={age}
                  onChangeText={setAge}
                />
              </View>

              <View style={[styles.formGroup, { flex: 2 }]}>
                <Text style={styles.fieldLabel}>GENDER</Text>
                <View style={styles.genderRow}>
                  {['Male', 'Female', 'Other'].map((g) => (
                    <TouchableOpacity
                      key={g}
                      style={[
                        styles.genderBtn,
                        gender === g && styles.genderBtnActive,
                      ]}
                      onPress={() => setGender(g)}
                    >
                      <Text
                        style={[
                          styles.genderText,
                          gender === g && styles.genderTextActive,
                        ]}
                      >
                        {g}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>MOBILE NUMBER</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter mobile number"
                placeholderTextColor="#5A7268"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>EMAIL ADDRESS</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. alex@bawaal.com"
                placeholderTextColor="#5A7268"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>LOCATION (CITY / STATE)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Mumbai, India"
                placeholderTextColor="#5A7268"
                value={location}
                onChangeText={setLocation}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>SPORT / ROLE / ACTIVITY</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Athlete, Esports, Commentator, Manager, Climbing"
                placeholderTextColor="#5A7268"
                value={sport}
                onChangeText={setSport}
              />
            </View>

            {/* Legal Agreement Checkbox */}
            <TouchableOpacity
              style={styles.termsContainer}
              onPress={() => setTermsModalVisible(true)}
            >
              <View style={[styles.checkbox, agreedToTerms && styles.checkboxChecked]}>
                {agreedToTerms && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.termsText}>
                I agree to the{' '}
                <Text style={styles.termsLink}>
                  Terms of Service & Privacy Policy
                </Text>
              </Text>
            </TouchableOpacity>

            {/* Bottom Action Button */}
            <TouchableOpacity
              style={[
                styles.sendOtpBtn,
                !agreedToTerms && styles.sendOtpBtnDisabled,
              ]}
              onPress={handleSendOtpTrigger}
            >
              <Text style={styles.sendOtpBtnText}>SEND OTP →</Text>
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

      {/* Terms & Conditions Scroll Modal */}
      <Modal visible={termsModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: '80%' }]}>
            <Text style={styles.modalTitle}>Terms of Service & Legal Rules</Text>
            <ScrollView
              style={styles.termsScrollView}
              onScroll={handleTermsScroll}
              scrollEventThrottle={16}
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
              >
                <Text style={styles.acceptTermsBtnText}>
                  {hasScrolledToBottom
                    ? 'I HAVE READ & AGREE'
                    : 'SCROLL TO BOTTOM TO ACCEPT'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 6-Digit OTP Verification Modal */}
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
                    ref={(ref) => (otpInputs.current[idx] = ref)}
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
                style={styles.enterArenaModalBtn}
                onPress={handleEnterArena}
              >
                <Text style={styles.enterArenaModalBtnText}>ENTER ARENA →</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
}

const LANDING_BG = '#08120F';
const GOLD = '#FFD700';
const CRIMSON = '#FF2A5F';
const CARD_BG = '#0C1814';
const INPUT_BG = '#10201A';
const MUTED = '#8BA89A';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LANDING_BG,
  },
  scrollContent: {
    padding: 18,
    paddingBottom: 80,
  },
  brandHeader: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 16,
  },
  logoImage: {
    width: 260,
    height: 165,
    marginBottom: 10,
  },
  brandSubheader: {
    fontSize: 14,
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: '600',
    lineHeight: 20,
    paddingHorizontal: 10,
  },
  dropdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 12,
  },
  dropdownBox: {
    flex: 1,
  },
  dropdownLabel: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
  },
  dropdownButton: {
    backgroundColor: INPUT_BG,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#1E3A30',
  },
  dropdownText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  card: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: GOLD,
    backgroundColor: CARD_BG,
  },
  cardHeader: {
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: GOLD,
    letterSpacing: 1,
    textAlign: 'center',
  },
  formGroup: {
    marginBottom: 14,
  },
  rowGroup: {
    flexDirection: 'row',
    gap: 10,
  },
  fieldLabel: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
  },
  input: {
    backgroundColor: INPUT_BG,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#1E3A30',
    color: '#FFFFFF',
    fontSize: 14,
  },
  genderRow: {
    flexDirection: 'row',
    gap: 8,
  },
  genderBtn: {
    flex: 1,
    backgroundColor: INPUT_BG,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E3A30',
  },
  genderBtnActive: {
    backgroundColor: CRIMSON,
    borderColor: GOLD,
  },
  genderText: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '700',
  },
  genderTextActive: {
    color: '#FFFFFF',
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: INPUT_BG,
  },
  checkboxChecked: {
    backgroundColor: GOLD,
  },
  checkmark: {
    color: LANDING_BG,
    fontWeight: 'bold',
    fontSize: 12,
  },
  termsText: {
    color: '#C8D9D0',
    fontSize: 12,
    flex: 1,
  },
  termsLink: {
    color: GOLD,
    textDecorationLine: 'underline',
  },
  sendOtpBtn: {
    backgroundColor: CRIMSON,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
    borderWidth: 1,
    borderColor: GOLD,
  },
  sendOtpBtnDisabled: {
    backgroundColor: '#2A3A34',
    opacity: 0.6,
    borderColor: '#3A4A44',
  },
  sendOtpBtnText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(8, 18, 15, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 20,
    width: '88%',
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: GOLD,
  },
  modalTitle: {
    color: GOLD,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 14,
    textAlign: 'center',
  },
  modalItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1E3A30',
  },
  modalItemText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  termsScrollView: {
    marginBottom: 12,
  },
  legalHeading: {
    color: GOLD,
    fontSize: 13,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 4,
  },
  legalBody: {
    color: '#C8D9D0',
    fontSize: 12,
    lineHeight: 18,
  },
  termsFooter: {
    marginTop: 8,
  },
  acceptTermsBtn: {
    backgroundColor: CRIMSON,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: GOLD,
  },
  acceptTermsBtnDisabled: {
    backgroundColor: '#2A3A34',
    borderColor: '#3A4A44',
  },
  acceptTermsBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  otpModalContent: {
    backgroundColor: LANDING_BG,
    borderRadius: 20,
    padding: 24,
    width: '88%',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: GOLD,
  },
  otpLogo: {
    width: 140,
    height: 70,
    marginBottom: 10,
  },
  otpTitle: {
    color: GOLD,
    fontSize: 16,
    fontWeight: '900',
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
    backgroundColor: INPUT_BG,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: GOLD,
    color: GOLD,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  enterArenaModalBtn: {
    backgroundColor: CRIMSON,
    borderRadius: 10,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: GOLD,
  },
  enterArenaModalBtnText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 15,
  },
});