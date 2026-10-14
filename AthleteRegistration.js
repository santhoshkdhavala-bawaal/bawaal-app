import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Image,
} from 'react-native';
import MedicalCardModal from './MedicalCardModal';

const dictionary = {
  English: {
    back: '← BACK',
    title: 'Athlete Registration',
    subtitle: 'Join the global sports talent network.',
    fullNameLabel: 'FULL NAME *',
    fullNamePlaceholder: 'e.g. Rohan Sharma / Marcus Vance',
    genderLabel: 'GENDER *',
    ageLabel: 'AGE *',
    agePlaceholder: '21',
    emailLabel: 'EMAIL ID *',
    emailPlaceholder: 'athlete@example.com',
    contactLabel: 'CONTACT NUMBER *',
    contactPlaceholder: 'e.g. +91 98765 43210 / +1 555 0192',
    locationLabel: 'LOCATION (CITY, COUNTRY) *',
    locationPlaceholder: 'e.g. Mumbai, India / Rome, Italy / Bangkok, Thailand',
    clubLabel: 'CURRENT CLUB / ACADEMY / FREE AGENT *',
    clubPlaceholder: 'e.g. Tiger Muay Thai / Mumbai Sports Club / Free Agent',
    sportLabel: 'PRIMARY SPORT / DISCIPLINE *',
    sportPlaceholder: 'Boxing, Cricket, Football, BJJ, Diving...',
    expLabel: 'EXPERIENCE / ACHIEVEMENTS',
    expPlaceholder: 'e.g. State Champion / Division 1 / Certified Diver',
    bioLabel: 'ATHLETE BIO / GOAL',
    bioPlaceholder: 'Share your athletic vision and goals with scouts...',
    nextBtn: 'PROCEED TO MEDICAL CARD 🩺',
    // Text for completion state
    completeTitle: 'Registration Finalized!',
    completeSubtitle: 'Welcome to the Arena, Champ.',
    sosBtn: 'SOS - URGENT SUPPORT',
  },
  // French / Spanish dictionaries would need the text updated in a full implementation.
};

export default function AthleteRegistration({ selectedLang = 'English', onBack, onNext }) {
  const t = dictionary[selectedLang] || dictionary.English;

  const [fullName, setFullName] = useState('');
  const [gender, setGender] = useState('Male');
  const [age, setAge] = useState('');
  const [email, setEmail] = useState('');
  const [contact, setContact] = useState('');
  const [location, setLocation] = useState('');
  const [club, setClub] = useState('');
  const [sport, setSport] = useState('');
  const [experience, setExperience] = useState('');
  const [bio, setBio] = useState('');

  // Medical Modal State Trigger
  const [showMedicalModal, setShowMedicalModal] = useState(false);

  // FIX 3: Tracking if the entire registration process is complete
  const [isRegistrationComplete, setIsRegistrationComplete] = useState(false);

  const genderOptions = ['Male', 'Female', 'Non-Binary', 'Other'];

  const handleClaimArena = () => {
    // This function runs when "CLAIM YOUR ARENA" is pressed in the modal.
    setShowMedicalModal(false);
    // 1. Mark the registration as complete.
    setIsRegistrationComplete(true);
    // 2. Call the parent onNext if it exists.
    if (onNext) onNext();
  };

  const handleSOS = () => {
    alert("SOS support request initiated! Connecting to support...");
    // Future implementation will connect to SOS Trigger logic.
  }

  // Define the Main Header Layout to reuse
  const HeaderRow = () => (
    <View style={styles.headerRow}>
      <TouchableOpacity style={styles.backBtn} onPress={onBack}>
        <Text style={styles.backBtnText}>{t.back}</Text>
      </TouchableOpacity>

      <Image 
        source={require('./assets/gold b solo.png')} 
        style={styles.headerLogo} 
        resizeMode="contain" 
      />
    </View>
  );

  // --- Render completion state ---
  if (isRegistrationComplete) {
    return (
      <SafeAreaView style={styles.outerGlowWrapper}>
        <ScrollView contentContainerStyle={styles.container}>
          <HeaderRow/>
          
          <View style={styles.completeTitleSection}>
            <Text style={styles.title}>{t.completeTitle}</Text>
            <Text style={styles.subtitle}>{t.completeSubtitle}</Text>
          </View>

          {/* FIX 3: SOS Button appears only when complete */}
          <TouchableOpacity style={styles.sosBtn} onPress={handleSOS} activeOpacity={0.85}>
            <Text style={styles.sosBtnText}>{t.sosBtn}</Text>
          </TouchableOpacity>

        </ScrollView>
      </SafeAreaView>
    );
  }

  // --- Render standard registration form ---
  return (
    <SafeAreaView style={styles.outerGlowWrapper}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        
        <HeaderRow/>

        {/* Title Section */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>{t.title}</Text>
          <Text style={styles.subtitle}>{t.subtitle}</Text>
        </View>

        {/* Form Fields */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>{t.fullNameLabel}</Text>
          <TextInput
            style={styles.input}
            placeholder={t.fullNamePlaceholder}
            placeholderTextColor="#64748b"
            value={fullName}
            onChangeText={setFullName}
          />
        </View>

        {/* Gender Selection */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>{t.genderLabel}</Text>
          <View style={styles.genderRow}>
            {genderOptions.map((option) => (
              <TouchableOpacity
                key={option}
                style={[
                  styles.genderBtn,
                  gender === option && styles.genderBtnSelected,
                ]}
                onPress={() => setGender(option)}
              >
                <Text
                  style={[
                    styles.genderText,
                    gender === option && styles.genderTextSelected,
                  ]}
                >
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Age & Email Row */}
        <View style={styles.row}>
          <View style={[styles.formGroup, { width: '30%' }]}>
            <Text style={styles.label}>{t.ageLabel}</Text>
            <TextInput
              style={styles.input}
              placeholder={t.agePlaceholder}
              placeholderTextColor="#64748b"
              keyboardType="numeric"
              value={age}
              onChangeText={setAge}
            />
          </View>

          <View style={[styles.formGroup, { width: '66%' }]}>
            <Text style={styles.label}>{t.emailLabel}</Text>
            <TextInput
              style={styles.input}
              placeholder={t.emailPlaceholder}
              placeholderTextColor="#64748b"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>
        </View>

        {/* Contact Number */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>{t.contactLabel}</Text>
          <TextInput
            style={styles.input}
            placeholder={t.contactPlaceholder}
            placeholderTextColor="#64748b"
            keyboardType="phone-pad"
            value={contact}
            onChangeText={setContact}
          />
        </View>

        {/* Location */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>{t.locationLabel}</Text>
          <TextInput
            style={styles.input}
            placeholder={t.locationPlaceholder}
            placeholderTextColor="#64748b"
            value={location}
            onChangeText={setLocation}
          />
        </View>

        {/* Current Club / Academy */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>{t.clubLabel}</Text>
          <TextInput
            style={styles.input}
            placeholder={t.clubPlaceholder}
            placeholderTextColor="#64748b"
            value={club}
            onChangeText={setClub}
          />
        </View>

        {/* Primary Sport / Discipline */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>{t.sportLabel}</Text>
          <TextInput
            style={styles.input}
            placeholder={t.sportPlaceholder}
            placeholderTextColor="#64748b"
            value={sport}
            onChangeText={setSport}
          />
        </View>

        {/* Experience / Achievements */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>{t.expLabel}</Text>
          <TextInput
            style={styles.input}
            placeholder={t.expPlaceholder}
            placeholderTextColor="#64748b"
            value={experience}
            onChangeText={setExperience}
          />
        </View>

        {/* Athlete Bio / Goal */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>{t.bioLabel}</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder={t.bioPlaceholder}
            placeholderTextColor="#64748b"
            multiline
            numberOfLines={4}
            value={bio}
            onChangeText={setBio}
          />
        </View>

        {/* Proceed Button - Triggers Medical Card Modal */}
        <TouchableOpacity 
          style={styles.submitBtn} 
          onPress={() => setShowMedicalModal(true)} 
          activeOpacity={0.85}
        >
          <Text style={styles.submitBtnText}>{t.nextBtn}</Text>
        </TouchableOpacity>

        {/* Medical Card Modal Component */}
        <MedicalCardModal
          visible={showMedicalModal}
          selectedLang={selectedLang}
          onClose={() => setShowMedicalModal(false)}
          // FIXED: Now calls handleClaimArena to set complete state
          onSubmit={handleClaimArena}
        />

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  outerGlowWrapper: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#f59e0b',
    backgroundColor: '#0a0f1d',
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 15,
    marginBottom: 20,
  },
  backBtn: {
    backgroundColor: '#1e293b',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  backBtnText: {
    color: '#38bdf8',
    fontWeight: 'bold',
    fontSize: 12,
  },
  headerLogo: {
    width: 45,
    height: 45,
  },
  titleSection: {
    marginBottom: 24,
  },
  completeTitleSection: {
    marginTop: 40,
    alignItems: 'center',
    marginBottom: 60,
  },
  title: {
    color: '#f8fafc',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
  formGroup: {
    marginBottom: 18,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    color: '#f8fafc',
    fontSize: 13,
  },
  textArea: {
    height: 90,
    textAlignVertical: 'top',
  },
  genderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  genderBtn: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginHorizontal: 3,
  },
  genderBtnSelected: {
    backgroundColor: '#f59e0b',
    borderColor: '#f59e0b',
  },
  genderText: {
    color: '#94a3b8',
    fontWeight: '700',
    fontSize: 12,
  },
  genderTextSelected: {
    color: '#0f172a',
  },
  submitBtn: {
    backgroundColor: '#f59e0b',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 15,
    shadowColor: '#f59e0b',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 6,
  },
  submitBtnText: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  // FIX 3: Styling for the SOS button
  sosBtn: {
    backgroundColor: '#ef4444',
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#ef4444',
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 8,
  },
  sosBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
  },
});