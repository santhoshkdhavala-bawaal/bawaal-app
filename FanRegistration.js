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

export default function FanRegistration({ onBack, onSubmit }) {
  const [fullName, setFullName] = useState('');
  const [favoriteSport, setFavoriteSport] = useState('');
  const [handle, setHandle] = useState('');

  const handleComplete = () => {
    if (!fullName) {
      alert('Please enter your full name or fan handle!');
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
            <Text style={styles.roleTagText}>ARENA SUPPORTER ACCESS</Text>
          </View>
          <Text style={styles.titleText}>Join the BAWAAL Tribe</Text>
          <Text style={styles.subText}>
            Hype local fighters, discover raw talent, and follow high-stakes combat sports live.
          </Text>
        </View>

        {/* Form Inputs */}
        <View style={styles.formSection}>
          <Text style={styles.inputLabel}>FULL NAME / ALIAS</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g. Vikram 'The Fanatic' Roy"
            placeholderTextColor="#475569"
            value={fullName}
            onChangeText={setFullName}
          />

          <Text style={styles.inputLabel}>FAN HANDLE / USERNAME</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g. @fight_fanatic_mumbai"
            placeholderTextColor="#475569"
            value={handle}
            onChangeText={setHandle}
          />

          <Text style={styles.inputLabel}>FAVORITE SPORTS & DISCIPLINES</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g. Boxing, MMA, Wrestling, Parkour"
            placeholderTextColor="#475569"
            value={favoriteSport}
            onChangeText={setFavoriteSport}
          />
        </View>

        {/* Submit Action Button */}
        <TouchableOpacity style={styles.submitBtn} onPress={handleComplete} activeOpacity={0.85}>
          <Text style={styles.submitBtnText}>ENTER THE ARENA FEED →</Text>
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
    borderColor: '#38bdf8',
    borderRadius: 16,
    padding: 20,
    marginBottom: 25,
  },
  roleTag: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#38bdf8',
    marginBottom: 10,
  },
  roleTagText: {
    color: '#38bdf8',
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
    color: '#38bdf8',
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
    backgroundColor: '#38bdf8',
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