import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Image,
} from 'react-native';

const dictionary = {
  English: {
    back: '← BACK TO REGISTRATION',
    // FIX 1: Removed Stethoscope from title
    title: 'Athlete Medical Card',
    subtitle: 'Verify health clearance & emergency details for arena access.',
    heightLabel: 'HEIGHT (CM / FT) *',
    heightPlaceholder: 'e.g. 180 cm / 5\'11"',
    weightLabel: 'WEIGHT (KG / LBS) *',
    weightPlaceholder: 'e.g. 75 kg / 165 lbs',
    bloodLabel: 'BLOOD GROUP *',
    bloodPlaceholder: 'e.g. O+, A+, B-',
    allergiesLabel: 'MEDICAL CONDITIONS / ALLERGIES',
    allergiesPlaceholder: 'e.g. None / Asthma / Dust Allergy',
    emergencyNameLabel: 'EMERGENCY CONTACT NAME *',
    emergencyNamePlaceholder: 'e.g. Sarah Vance (Parent / Guardian)',
    emergencyPhoneLabel: 'EMERGENCY PHONE NUMBER *',
    emergencyPhonePlaceholder: 'e.g. +91 98765 43210',
    waiverText: 'I certify that I am physically fit to train and record athletic/combat drills.',
    // FIX 2: Removed Fire from button
    submitBtn: 'CLAIM YOUR ARENA',
  },
  // French / Spanish dictionaries would also need the text updated in a full implementation.
};

export default function MedicalCardModal({ visible, selectedLang = 'English', onClose, onSubmit }) {
  const t = dictionary[selectedLang] || dictionary.English;

  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [allergies, setAllergies] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [waiverAccepted, setWaiverAccepted] = useState(false);

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <SafeAreaView style={styles.outerGlowWrapper}>
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          
          {/* Top Header Row with Back Button */}
          <View style={styles.headerRow}>
            <TouchableOpacity style={styles.backBtn} onPress={onClose}>
              <Text style={styles.backBtnText}>{t.back}</Text>
            </TouchableOpacity>

            <Image 
              source={require('./assets/gold b solo.png')} 
              style={styles.headerLogo} 
              resizeMode="contain" 
            />
          </View>

          {/* Title Section (No Stethoscope) */}
          <View style={styles.titleSection}>
            <Text style={styles.title}>{t.title}</Text>
            <Text style={styles.subtitle}>{t.subtitle}</Text>
          </View>

          {/* Height & Weight Row */}
          <View style={styles.row}>
            <View style={[styles.formGroup, { width: '48%' }]}>
              <Text style={styles.label}>{t.heightLabel}</Text>
              <TextInput
                style={styles.input}
                placeholder={t.heightPlaceholder}
                placeholderTextColor="#64748b"
                value={height}
                onChangeText={setHeight}
              />
            </View>

            <View style={[styles.formGroup, { width: '48%' }]}>
              <Text style={styles.label}>{t.weightLabel}</Text>
              <TextInput
                style={styles.input}
                placeholder={t.weightPlaceholder}
                placeholderTextColor="#64748b"
                value={weight}
                onChangeText={setWeight}
              />
            </View>
          </View>

          {/* Blood Group */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>{t.bloodLabel}</Text>
            <TextInput
              style={styles.input}
              placeholder={t.bloodPlaceholder}
              placeholderTextColor="#64748b"
              value={bloodGroup}
              onChangeText={setBloodGroup}
            />
          </View>

          {/* Medical Conditions / Allergies */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>{t.allergiesLabel}</Text>
            <TextInput
              style={styles.input}
              placeholder={t.allergiesPlaceholder}
              placeholderTextColor="#64748b"
              value={allergies}
              onChangeText={setAllergies}
            />
          </View>

          {/* Emergency Contact Name */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>{t.emergencyNameLabel}</Text>
            <TextInput
              style={styles.input}
              placeholder={t.emergencyNamePlaceholder}
              placeholderTextColor="#64748b"
              value={emergencyName}
              onChangeText={setEmergencyName}
            />
          </View>

          {/* Emergency Contact Phone */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>{t.emergencyPhoneLabel}</Text>
            <TextInput
              style={styles.input}
              placeholder={t.emergencyPhonePlaceholder}
              placeholderTextColor="#64748b"
              keyboardType="phone-pad"
              value={emergencyPhone}
              onChangeText={setEmergencyPhone}
            />
          </View>

          {/* Medical & Physical Waiver Checkbox */}
          <TouchableOpacity 
            style={styles.waiverRow} 
            onPress={() => setWaiverAccepted(!waiverAccepted)}
            activeOpacity={0.8}
          >
            <View style={[styles.checkbox, waiverAccepted && styles.checkboxSelected]}>
              {waiverAccepted && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.waiverText}>{t.waiverText}</Text>
          </TouchableOpacity>

          {/* Claim Arena Submit Button (No Fire) */}
          <TouchableOpacity 
            style={[styles.submitBtn, !waiverAccepted && styles.submitBtnDisabled]} 
            onPress={onSubmit} 
            disabled={!waiverAccepted}
            activeOpacity={0.85}
          >
            <Text style={styles.submitBtnText}>{t.submitBtn}</Text>
          </TouchableOpacity>

        </ScrollView>
      </SafeAreaView>
    </Modal>
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
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  backBtnText: {
    color: '#38bdf8',
    fontWeight: 'bold',
    fontSize: 11,
  },
  headerLogo: {
    width: 45,
    height: 45,
  },
  titleSection: {
    marginBottom: 24,
  },
  title: {
    color: '#f8fafc',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 4,
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
  waiverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 15,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#f59e0b',
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkboxSelected: {
    backgroundColor: '#f59e0b',
  },
  checkmark: {
    color: '#0f172a',
    fontWeight: 'bold',
    fontSize: 14,
  },
  waiverText: {
    color: '#cbd5e1',
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
  submitBtn: {
    backgroundColor: '#f59e0b',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#f59e0b',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 6,
  },
  submitBtnDisabled: {
    backgroundColor: '#475569',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitBtnText: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});