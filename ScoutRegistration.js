import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  SafeAreaView,
  Image,
} from 'react-native';

export default function ScoutRegistration({ onBack, onSubmit }) {
  const [organization, setOrganization] = useState('');
  const [scoutName, setScoutName] = useState('');
  const [scoutingDiscipline, setScoutingDiscipline] = useState('');

  const handleComplete = () => {
    if (!scoutName || !organization) {
      alert('Please enter your name and organization/academy details!');
      return;
    }
    onSubmit();
  };

  return (
    <SafeAreaView style={styles.outerWrapper}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backBtn} onPress={onBack}>
            <Text style={styles.backBtnText}>← BACK</Text>
          </TouchableOpacity>
          <Image 
            source={require('./assets/gold b solo.png')} 
            style={styles.headerLogo} 
            resizeMode="contain" 
          />
        </View>

        {/* Title Badge */}
        <View style={styles.titleCard}>
          <View style={styles.roleTag}>
            <Text style={styles.roleTagText}>VERIFIED TALENT SCOUT & ACADEMY</Text>
          </View>
          <Text style={styles.titleText}>Discover & Recruit Talent</Text>
          <Text style={styles.subText}>
            Access raw video telemetry, connect directly with verified athletes, and scout emerging champions.
          </Text>
        </View>

        {/* Form Inputs */}
        <View style={styles.formSection}>
          <Text style={styles.inputLabel}>FULL NAME / REPRESENTATIVE</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g. Coach Ramesh Kumar"
            placeholderTextColor="#475569"
            value={scoutName}
            onChangeText={setScoutName}
          />

          <Text style={styles.inputLabel}>ACADEMY / CLUB / PROMOTION NAME</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g. Global Fight League / Apex Academy"
            placeholderTextColor="#475569"
            value={organization}
            onChangeText={setOrganization}
          />

          <Text style={styles.inputLabel}>TARGET DISCIPLINES & SPORTS</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g. Pro Boxing, MMA, Muay Thai, Track & Field"
            placeholderTextColor="#475569"
            value={scoutingDiscipline}
            onChangeText={setScoutingDiscipline}
          />
        </View>

        {/* Submit Action Button */}
        <TouchableOpacity style={styles.submitBtn} onPress={handleComplete} activeOpacity={0.85}>
          <Text style={styles.submitBtnText}>LAUNCH SCOUT DASHBOARD →</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  outerWrapper: {
    flex: 1,
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
    marginBottom: 20,
  },
  backBtn: {
    backgroundColor: '#1e293b',
    paddingVertical: 8,
    paddingHorizontal: 14,
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
    width: 40,
    height: 40,
  },
  titleCard: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#f59e0b',
    borderRadius: 16,
    padding: 20,
    marginBottom: 25,
  },
  roleTag: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#f59e0b',
    marginBottom: 10,
  },
  roleTagText: {
    color: '#f59e0b',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  titleText: {
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: '900',
  },
  subText: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 6,
    lineHeight: 18,
  },
  formSection: {
    marginBottom: 20,
  },
  inputLabel: {
    color: '#f59e0b',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 14,
  },
  textInput: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1f2937',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#f8fafc',
    fontSize: 14,
  },
  submitBtn: {
    backgroundColor: '#f59e0b',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 15,
  },
  submitBtnText: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
  },
});