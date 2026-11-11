/**
 * BAWAAL Landing / Onboarding — registration surface (explicit layout unlock).
 * Field order + dark cards + sticky Continue CTA; OTP / profiles contract unchanged.
 * Sport categories still import locked `BAWAAL_SPORTS`.
 * See `.cursor/rules/bawaal-onboarding-locked.mdc`.
 */
import React, { useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Modal,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Pressable,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { resolveLocationFlag } from './src/utils/locationFlag';
import { flagFromIso } from './src/data/worldCountries';
import BawaalPromptModal from './src/components/BawaalPromptModal';
import OTPInput, { OTP_LENGTH, emptyOtpDigits } from './OTPInput';
import {
  DEV_OTP,
  isDevOtpPhone,
  sendPhoneOtp,
  verifyPhoneOtp,
} from './src/services/authOtp';
import { upsertRegisteredProfile } from './src/services/profilesService';
import { BAWAAL_SPORTS } from './src/constants/sports';

const ROLES = [
  { key: 'fan', label: 'Fan' },
  { key: 'athlete', label: 'Athlete' },
  { key: 'scout', label: 'Scout' },
];

/** Locked BAWAAL sport taxonomy — single source, no local rename/reorder. */
const SPORT_INTERESTS = BAWAAL_SPORTS;

const GENDER_OPTIONS = [
  { key: 'male', label: 'Male' },
  { key: 'female', label: 'Female' },
  { key: 'other', label: 'Other' },
];

const BG = '#000000';
const WHITE = '#FFFFFF';
const OFF_WHITE = '#E8ECE9';
const PLACEHOLDER = '#9CA3AF';
const MUTED = '#8A8A8A';
const CARD = '#1E1E22';
const ORANGE = '#FF6600';

function InputCard({
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
  style,
  inputStyle,
}) {
  const hasTrailing = !!trailing;
  return (
    <View
      style={[
        styles.inputCard,
        hasTrailing && styles.inputCardWithTrailing,
        focused && styles.inputCardFocused,
        style,
      ]}
    >
      {leading ? (
        <View style={styles.inputLeading} pointerEvents="none">
          {leading}
        </View>
      ) : null}
      <TextInput
        style={[
          styles.input,
          hasTrailing && styles.inputWithTrailingPad,
          Platform.OS === 'web' && styles.inputWeb,
          inputStyle,
        ]}
        placeholder={placeholder}
        placeholderTextColor={PLACEHOLDER}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        onFocus={onFocus}
        onBlur={onBlur}
        underlineColorAndroid="transparent"
        selectionColor={ORANGE}
      />
      {hasTrailing ? (
        <View style={styles.inputTrailing} pointerEvents="none">
          {trailing}
        </View>
      ) : null}
    </View>
  );
}

/**
 * Country flag chip for the location field.
 * Prefer ISO → PNG (Windows/web often render 🇮🇳 as plain "IN" letters).
 * Fall back to emoji Text when no ISO is available.
 */
function LocationFlagBadge({ flag, country, iso }) {
  const isoCode = String(iso || '')
    .trim()
    .toUpperCase();
  const emoji =
    (flag && flag !== '🌐' ? flag : '') ||
    (isoCode.length === 2 ? flagFromIso(isoCode) : '');
  if (!emoji && isoCode.length !== 2) return null;

  const label = country ? `Country flag ${country}` : 'Country flag';

  // Image flags avoid regional-indicator letter fallback ("IN") on Windows web.
  // Fixed 32×24 slot keeps every country flag the same visual footprint.
  if (isoCode.length === 2) {
    return (
      <View style={styles.flagBadge} accessibilityLabel={label}>
        <Image
          source={{
            uri: `https://flagcdn.com/w80/${isoCode.toLowerCase()}.png`,
          }}
          style={styles.flagImage}
          resizeMode="contain"
          accessibilityLabel={label}
        />
      </View>
    );
  }

  return (
    <View style={styles.flagBadge} accessibilityLabel={label}>
      <Text style={styles.flagEmoji} allowFontScaling={false}>
        {emoji}
      </Text>
    </View>
  );
}

function SelectCard({ valueLabel, placeholder, onPress, style }) {
  const empty = !valueLabel;
  return (
    <TouchableOpacity
      style={[styles.inputCard, styles.selectCard, style]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
    >
      <Text
        style={[styles.selectValue, empty && styles.selectPlaceholder]}
        numberOfLines={1}
      >
        {empty ? placeholder : valueLabel}
      </Text>
      <Text style={styles.chevron}>▼</Text>
    </TouchableOpacity>
  );
}

function OptionPickerModal({ visible, title, options, selectedKey, onSelect, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.pickerOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.pickerSheet}>
          <Text style={styles.pickerTitle}>{title}</Text>
          <ScrollView
            style={styles.pickerList}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {options.map((opt) => {
              const key = typeof opt === 'string' ? opt : opt.key;
              const label = typeof opt === 'string' ? opt : opt.label;
              const active = selectedKey === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.pickerRow, active && styles.pickerRowActive]}
                  onPress={() => {
                    onSelect(key);
                    onClose();
                  }}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[styles.pickerRowText, active && styles.pickerRowTextActive]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <TouchableOpacity style={styles.pickerCancel} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.pickerCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function RoleSelection({ onCompleteRegistration }) {
  const insets = useSafeAreaInsets();
  const [termsModalVisible, setTermsModalVisible] = useState(false);
  const [otpModalVisible, setOtpModalVisible] = useState(false);
  const [notice, setNotice] = useState(null);
  const [picker, setPicker] = useState(null); // 'gender' | 'category' | 'role'

  const [handle, setHandle] = useState('');
  const [realName, setRealName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [gender, setGender] = useState(null);
  const [age, setAge] = useState('');
  const [role, setRole] = useState(null);
  const [sportInterest, setSportInterest] = useState(null);
  const [focusedField, setFocusedField] = useState(null);

  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const showNotice = (title, message) => setNotice({ title, message });

  const [otpDigits, setOtpDigits] = useState(emptyOtpDigits);
  const [otpBusy, setOtpBusy] = useState(false);

  const locationMeta = useMemo(
    () => resolveLocationFlag(location),
    [location]
  );
  const locationFlag = locationMeta.flag || '';

  const genderLabel =
    GENDER_OPTIONS.find((g) => g.key === gender)?.label || null;
  const roleLabel = ROLES.find((r) => r.key === role)?.label || null;
  const categoryLabel = sportInterest || null;

  const handleTermsScroll = ({ nativeEvent }) => {
    const isCloseToBottom =
      nativeEvent.layoutMeasurement.height + nativeEvent.contentOffset.y >=
      nativeEvent.contentSize.height - 20;
    if (isCloseToBottom && !hasScrolledToBottom) {
      setHasScrolledToBottom(true);
    }
  };

  const buildRegistrationPayload = () => {
    const resolved = resolveLocationFlag(location);
    const ageNum = Number(String(age).trim());
    return {
      handle: handle.trim(),
      displayName: handle.trim(),
      name: realName.trim(),
      realName: realName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      gender,
      age: Number.isFinite(ageNum) && ageNum > 0 ? ageNum : null,
      role,
      sport: sportInterest,
      sportInterest,
      location: location.trim(),
      flag: resolved.flag || '🌐',
      country: resolved.country || null,
      countryFlag: resolved.flag || '🌐',
      label: resolved.country || location.trim(),
    };
  };

  const handleSendOtpTrigger = async () => {
    if (!handle.trim() || !realName.trim() || !phone.trim() || !email.trim() || !location.trim()) {
      showNotice('Missing Fields', 'Please complete all required fields before continuing.');
      return;
    }
    if (!gender) {
      showNotice('Gender', 'Select Male, Female, or Other to continue.');
      return;
    }
    const ageNum = Number(String(age).trim());
    if (!String(age).trim() || !Number.isFinite(ageNum) || ageNum < 13 || ageNum > 120) {
      showNotice('Age', 'Enter a valid age (13+) to continue.');
      return;
    }
    if (!role) {
      showNotice('Select a Role', 'Choose Fan, Athlete, or Scout to enter the arena.');
      return;
    }
    if (!sportInterest) {
      showNotice('Category', 'Pick a sport category for your feed.');
      return;
    }
    if (!agreedToTerms) {
      showNotice(
        'Terms Required',
        'Please review and accept the Terms and Conditions.'
      );
      return;
    }

    setOtpBusy(true);
    try {
      const sent = await sendPhoneOtp(phone);
      if (!sent.ok && sent.mode === 'supabase') {
        showNotice(
          'OTP Send Failed',
          sent.error?.message || 'Could not send OTP. Check phone format and try again.'
        );
        return;
      }
      setOtpDigits(emptyOtpDigits());
      setOtpModalVisible(true);
    } finally {
      setOtpBusy(false);
    }
  };

  /** Manual verify only — never call from OTPInput digit handlers. */
  const handleEnterArena = async () => {
    if (otpBusy) return;
    const fullOtp = otpDigits.join('');
    if (fullOtp.length < OTP_LENGTH) {
      showNotice(
        'Invalid OTP',
        `Please enter the complete ${OTP_LENGTH}-digit verification code.`
      );
      return;
    }

    setOtpBusy(true);
    try {
      const result = await verifyPhoneOtp({ phone, token: fullOtp });
      if (!result.ok) {
        showNotice(
          'Verification Failed',
          result.error?.message || 'Invalid OTP. Please try again.'
        );
        return;
      }

      const userData = {
        ...buildRegistrationPayload(),
        authMode: result.mode,
        authPhone: result.phone,
        sport_interests: [sportInterest].filter(Boolean),
      };

      const authUser = result.user || result.session?.user || null;
      const synced = await upsertRegisteredProfile(userData, authUser);
      userData.profileId = synced.id || null;
      userData.profileSynced = Boolean(synced.ok);
      if (!synced.ok && synced.error) {
        console.warn(
          '[AthleteRegistration] profiles upsert:',
          synced.error?.message || synced.error
        );
      }

      setOtpModalVisible(false);
      if (onCompleteRegistration) {
        await onCompleteRegistration(userData);
      }
    } catch (err) {
      showNotice('Verification Failed', err?.message || 'Could not verify OTP.');
    } finally {
      setOtpBusy(false);
    }
  };

  const onTermsRowPress = () => {
    if (agreedToTerms) {
      setAgreedToTerms(false);
      return;
    }
    setTermsModalVisible(true);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: 24 + Math.max(insets.bottom, 8) },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces
        >
          <View style={styles.formShell}>
            <View style={styles.brandHeader}>
              <Image
                source={require('./assets/BAWAAL_white_full.png')}
                style={styles.logoImage}
                resizeMode="contain"
                accessibilityLabel="BAWAAL"
              />
              <Text style={styles.title}>Create Your Account</Text>
              <Text style={styles.subtitle}>
                Join BAWAAL to follow sports. It only takes a minute.
              </Text>
            </View>

            <View style={styles.form}>
              <InputCard
                value={handle}
                onChangeText={setHandle}
                placeholder="Enter your user name"
                autoCapitalize="words"
                focused={focusedField === 'handle'}
                onFocus={() => setFocusedField('handle')}
                onBlur={() => setFocusedField(null)}
                style={styles.fieldGap}
              />

              <InputCard
                value={realName}
                onChangeText={setRealName}
                placeholder="Enter your real name"
                autoCapitalize="words"
                focused={focusedField === 'realName'}
                onFocus={() => setFocusedField('realName')}
                onBlur={() => setFocusedField(null)}
                style={styles.fieldGap}
              />

              <View style={styles.twoColRow}>
                <InputCard
                  value={age}
                  onChangeText={(text) =>
                    setAge(String(text || '').replace(/[^\d]/g, '').slice(0, 3))
                  }
                  placeholder="Enter your age"
                  keyboardType="number-pad"
                  focused={focusedField === 'age'}
                  onFocus={() => setFocusedField('age')}
                  onBlur={() => setFocusedField(null)}
                  style={[styles.colHalf, styles.fieldGap]}
                />
                <SelectCard
                  valueLabel={genderLabel}
                  placeholder="Select your gender"
                  onPress={() => setPicker('gender')}
                  style={[styles.colHalf, styles.fieldGap]}
                />
              </View>

              <InputCard
                value={email}
                onChangeText={setEmail}
                placeholder="Enter your email"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                focused={focusedField === 'email'}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
                style={styles.fieldGap}
              />

              <InputCard
                value={phone}
                onChangeText={setPhone}
                placeholder="+1 (555) 000-0000"
                keyboardType="phone-pad"
                focused={focusedField === 'phone'}
                onFocus={() => setFocusedField('phone')}
                onBlur={() => setFocusedField(null)}
                style={styles.fieldGap}
              />

              <InputCard
                value={location}
                onChangeText={setLocation}
                placeholder="City, Country"
                autoCapitalize="words"
                focused={focusedField === 'location'}
                onFocus={() => setFocusedField('location')}
                onBlur={() => setFocusedField(null)}
                trailing={
                  locationMeta.iso ||
                  (locationFlag && locationFlag !== '🌐') ? (
                    <LocationFlagBadge
                      flag={locationFlag}
                      country={locationMeta.country}
                      iso={locationMeta.iso}
                    />
                  ) : null
                }
                style={styles.fieldGap}
              />
              {locationMeta.country ? (
                <Text style={styles.locationHelper}>
                  {locationMeta.country}
                  {' · regional matchmaking'}
                </Text>
              ) : null}

              <View style={styles.twoColRow}>
                <SelectCard
                  valueLabel={categoryLabel}
                  placeholder="Select category"
                  onPress={() => setPicker('category')}
                  style={[styles.colHalf, styles.fieldGap]}
                />
                <SelectCard
                  valueLabel={roleLabel}
                  placeholder="Select your role"
                  onPress={() => setPicker('role')}
                  style={[styles.colHalf, styles.fieldGap]}
                />
              </View>
            </View>
          </View>
        </ScrollView>

        <View
          style={[
            styles.stickyFooter,
            { paddingBottom: Math.max(insets.bottom, 12) },
          ]}
        >
          <TouchableOpacity
            style={styles.termsRow}
            onPress={onTermsRowPress}
            activeOpacity={0.85}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: agreedToTerms }}
          >
            <View style={[styles.checkbox, agreedToTerms && styles.checkboxChecked]}>
              {agreedToTerms ? <Text style={styles.checkmark}>✓</Text> : null}
            </View>
            <Text style={styles.termsText}>
              I agree to{' '}
              <Text
                style={styles.termsLink}
                onPress={() => setTermsModalVisible(true)}
              >
                Terms and Conditions
              </Text>
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.continueBtn,
              (!agreedToTerms || otpBusy) && styles.continueBtnDisabled,
            ]}
            onPress={handleSendOtpTrigger}
            activeOpacity={0.88}
            disabled={otpBusy}
            accessibilityRole="button"
            accessibilityLabel="Continue"
          >
            <Text style={styles.continueBtnText}>
              {otpBusy && !otpModalVisible ? 'Sending…' : 'Continue'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <OptionPickerModal
        visible={picker === 'gender'}
        title="Select your gender"
        options={GENDER_OPTIONS}
        selectedKey={gender}
        onSelect={setGender}
        onClose={() => setPicker(null)}
      />
      <OptionPickerModal
        visible={picker === 'category'}
        title="Select category"
        options={SPORT_INTERESTS}
        selectedKey={sportInterest}
        onSelect={setSportInterest}
        onClose={() => setPicker(null)}
      />
      <OptionPickerModal
        visible={picker === 'role'}
        title="Select your role"
        options={ROLES}
        selectedKey={role}
        onSelect={setRole}
        onClose={() => setPicker(null)}
      />

      <Modal visible={termsModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.termsModal]}>
            <Text style={styles.modalTitle}>Terms of Service & Legal Rules</Text>
            <ScrollView
              style={styles.termsScrollView}
              onScroll={handleTermsScroll}
              scrollEventThrottle={16}
              showsVerticalScrollIndicator={Platform.OS !== 'web'}
              {...(Platform.OS === 'web'
                ? { className: 'bawaal-terms-scroll' }
                : null)}
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

      <Modal visible={otpModalVisible} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <KeyboardAvoidingView
            style={[
              styles.modalOverlay,
              { paddingBottom: Math.max(48, insets.bottom + 40) },
            ]}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View
              style={[
                styles.otpModalContent,
                { paddingBottom: Math.max(48, insets.bottom + 36) },
              ]}
            >
              <View style={styles.otpWatermarkClip} pointerEvents="none">
                <Image
                  source={require('./assets/BAWAAL_B_solo.png')}
                  style={styles.otpWatermark}
                  resizeMode="contain"
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                />
              </View>
              <Image
                source={require('./assets/BAWAAL_white_full.png')}
                style={styles.otpLogo}
                resizeMode="contain"
              />
              <Text style={styles.otpTitle}>VERIFY MOBILE NUMBER</Text>
              <Text style={styles.otpSubtitle}>
                {isDevOtpPhone(phone)
                  ? `Dev login — enter ${DEV_OTP} then tap SUBMIT / VERIFY`
                  : `Enter the ${OTP_LENGTH}-digit code sent to ${phone || 'your phone'}`}
              </Text>

              <View style={styles.otpInputContainer}>
                <OTPInput
                  digits={otpDigits}
                  onChangeDigits={setOtpDigits}
                  editable={!otpBusy}
                />
              </View>

              <TouchableOpacity
                style={[styles.otpCtaBtn, otpBusy && styles.continueBtnDisabled]}
                onPress={handleEnterArena}
                activeOpacity={0.85}
                disabled={otpBusy}
                accessibilityRole="button"
                accessibilityLabel="Submit verify OTP"
              >
                <Text style={styles.otpCtaBtnText}>
                  {otpBusy ? 'VERIFYING…' : 'SUBMIT / VERIFY'}
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
        onCancel={() => setNotice(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  scroll: {
    flex: 1,
    backgroundColor: BG,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    alignItems: 'center',
  },
  formShell: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  brandHeader: {
    alignItems: 'center',
    marginBottom: 22,
    width: '100%',
  },
  logoImage: {
    width: 260,
    maxWidth: '100%',
    height: 110,
    marginBottom: 16,
  },
  title: {
    color: WHITE,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  subtitle: {
    marginTop: 8,
    color: PLACEHOLDER,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  form: {
    width: '100%',
  },
  fieldGap: {
    marginBottom: 12,
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  colHalf: {
    flex: 1,
    minWidth: 0,
  },
  inputCard: {
    height: 50,
    backgroundColor: CARD,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingLeft: 14,
    paddingRight: 14,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  inputCardWithTrailing: {
    justifyContent: 'space-between',
    paddingRight: 4,
  },
  inputCardFocused: {
    borderColor: ORANGE,
    borderWidth: 1.5,
  },
  selectCard: {
    justifyContent: 'space-between',
  },
  input: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    color: WHITE,
    fontSize: 15,
    fontWeight: '600',
    paddingVertical: 0,
    paddingLeft: 4,
    paddingRight: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  /** Keep typed location text clear of the flag chip on the right. */
  inputWithTrailingPad: {
    flex: 1,
    paddingLeft: 4,
    paddingRight: 12,
    marginRight: 0,
  },
  inputWeb: {
    outlineStyle: 'none',
    outlineWidth: 0,
    outlineColor: 'transparent',
    boxShadow: 'none',
  },
  inputLeading: {
    marginRight: 10,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputTrailing: {
    marginLeft: 8,
    marginRight: 8,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    minWidth: 32,
  },
  selectValue: {
    flex: 1,
    color: WHITE,
    fontSize: 14,
    fontWeight: '600',
    paddingRight: 8,
  },
  selectPlaceholder: {
    color: PLACEHOLDER,
    fontWeight: '500',
  },
  chevron: {
    color: PLACEHOLDER,
    fontSize: 10,
    fontWeight: '700',
  },
  flagBadge: {
    width: 32,
    height: 24,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  flagImage: {
    width: 32,
    height: 24,
  },
  flagEmoji: {
    fontSize: 22,
    lineHeight: 24,
    width: 32,
    height: 24,
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
    ...(Platform.OS === 'web'
      ? {
          fontFamily:
            '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif',
        }
      : null),
  },
  locationHelper: {
    marginTop: -4,
    marginBottom: 12,
    color: PLACEHOLDER,
    fontSize: 12,
    lineHeight: 16,
    paddingHorizontal: 4,
  },
  stickyFooter: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    backgroundColor: BG,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  checkboxChecked: {
    backgroundColor: ORANGE,
    borderColor: ORANGE,
  },
  checkmark: {
    color: BG,
    fontWeight: '900',
    fontSize: 12,
  },
  termsText: {
    color: OFF_WHITE,
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  termsLink: {
    color: ORANGE,
    fontWeight: '700',
  },
  continueBtn: {
    width: '100%',
    height: 52,
    borderRadius: 16,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueBtnDisabled: {
    opacity: 0.45,
  },
  continueBtnText: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: CARD,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: 1,
    borderColor: 'rgba(255,102,0,0.35)',
    paddingTop: 16,
    paddingBottom: 20,
    maxHeight: '55%',
  },
  pickerTitle: {
    color: WHITE,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
  },
  pickerList: {
    paddingHorizontal: 12,
  },
  pickerRow: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 4,
  },
  pickerRowActive: {
    backgroundColor: 'rgba(255, 102, 0, 0.16)',
  },
  pickerRowText: {
    color: OFF_WHITE,
    fontSize: 15,
    fontWeight: '600',
  },
  pickerRowTextActive: {
    color: ORANGE,
    fontWeight: '800',
  },
  pickerCancel: {
    marginTop: 8,
    marginHorizontal: 12,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  pickerCancelText: {
    color: WHITE,
    fontWeight: '700',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: BG,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
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
    backgroundColor: BG,
  },
  legalHeading: {
    color: WHITE,
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
    backgroundColor: ORANGE,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  acceptTermsBtnDisabled: {
    opacity: 0.45,
  },
  acceptTermsBtnText: {
    color: WHITE,
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 1.2,
  },
  acceptTermsBtnTextDisabled: {
    color: WHITE,
  },
  otpModalContent: {
    backgroundColor: BG,
    borderRadius: 0,
    borderWidth: 0,
    padding: 28,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  otpWatermarkClip: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  otpWatermark: {
    width: 160,
    height: 160,
    opacity: 0.06,
  },
  otpLogo: {
    width: 180,
    height: 56,
    marginBottom: 18,
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
    marginBottom: 28,
    alignItems: 'center',
  },
  otpCtaBtn: {
    width: '100%',
    height: 52,
    borderRadius: 16,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpCtaBtnText: {
    color: WHITE,
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 1.4,
  },
});
