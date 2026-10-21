import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert, ScrollView } from 'react-native';

export default function ScoutRegistration({ navigation }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedSport, setSelectedSport] = useState('Boxing');

  const sportsList = ['Boxing', 'Cricket', 'Football', 'Basketball', 'MMA', 'Badminton'];

  const handleRegister = async () => {
    if (!name || !email || !password || !selectedSport) {
      Alert.alert('Error', 'Please fill in all fields and select a specialized sport');
      return;
    }

    try {
      const response = await fetch('https://bawaal-app.onrender.com/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name,
          email: email,
          password: password,
          role: 'scout',
          specializedSport: selectedSport
        })
      });

      const data = await response.json();

      if (data.success) {
        Alert.alert('Success', `Scout profile created for ${selectedSport}!`);
        navigation.navigate('Arena', { user: data.user });
      } else {
        Alert.alert('Error', data.error || 'Registration failed');
      }
    } catch (error) {
      console.error('Registration Error:', error);
      Alert.alert('Error', 'Network error. Please try again.');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Scout Registration</Text>
      <Text style={styles.subText}>Register with your specialized sport to filter talent feeds automatically.</Text>

      <Text style={styles.inputLabel}>FULL NAME</Text>
      <TextInput
        style={styles.textInput}
        placeholder="Enter your name"
        placeholderTextColor="#666"
        value={name}
        onChangeText={setName}
      />

      <Text style={styles.inputLabel}>EMAIL</Text>
      <TextInput
        style={styles.textInput}
        placeholder="Enter your email"
        placeholderTextColor="#666"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
      />

      <Text style={styles.inputLabel}>PASSWORD</Text>
      <TextInput
        style={styles.textInput}
        placeholder="Enter your password"
        placeholderTextColor="#666"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <Text style={styles.inputLabel}>SPECIALIZED SPORT</Text>
      <View style={styles.sportContainer}>
        {sportsList.map((sport) => (
          <TouchableOpacity
            key={sport}
            style={[
              styles.sportChip,
              selectedSport === sport && styles.selectedSportChip
            ]}
            onPress={() => setSelectedSport(sport)}
          >
            <Text style={[
              styles.sportChipText,
              selectedSport === sport && styles.selectedSportChipText
            ]}>
              {sport}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.submitBtn} onPress={handleRegister}>
        <Text style={styles.submitBtnText}>Register as Scout</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#0b0f19',
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subText: {
    color: '#94a3b8',
    fontSize: 13,
    marginBottom: 24,
    lineHeight: 18,
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
  sportContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  sportChip: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1f2937',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  selectedSportChip: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  sportChipText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  selectedSportChipText: {
    color: '#fff',
  },
  submitBtn: {
    backgroundColor: '#3b82f6',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 28,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});