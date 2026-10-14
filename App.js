import React, { useState } from 'react';
import RoleSelection from './RoleSelection';
import AthleteRegistration from './AthleteRegistration';
import MedicalCardModal from './MedicalCardModal';
import AthleteDashboard from './AthleteDashboard';
import FanRegistration from './FanRegistration';
import ScoutRegistration from './ScoutRegistration';

// 📡 Backend API Helper Function
const registerUserOnBackend = async (userData) => {
  try {
    // Note: If testing on a physical phone via Expo Go, replace 'localhost' 
    // with your computer's local IP address (e.g. 'http://192.168.x.x:5000/api/register')
    const response = await fetch('http://localhost:5000/api/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });

    const data = await response.json();
    console.log('✅ Registered on Backend:', data);
  } catch (error) {
    console.log('⚠️ Local API connection note:', error.message);
  }
};

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('role_selection');
  const [athleteData, setAthleteData] = useState({});

  // 1. Athlete Registration flow
  const handleAthleteSubmit = (formData) => {
    setAthleteData(formData);
    setCurrentScreen('medical_modal');
  };

  // 2. Medical Modal complete -> Go to Athlete Dashboard & send to Backend
  const handleMedicalSubmit = (medicalData) => {
    const fullProfile = {
      role: 'athlete',
      ...athleteData,
      medicalInfo: medicalData,
    };
    registerUserOnBackend(fullProfile);
    setCurrentScreen('athlete_dashboard');
  };

  // 3. Fan Registration submit -> send to Backend
  const handleFanSubmit = (fanData) => {
    registerUserOnBackend({ role: 'fan', ...fanData });
    alert('Welcome to the BAWAAL Arena Feed!');
  };

  // 4. Scout Registration submit -> send to Backend
  const handleScoutSubmit = (scoutData) => {
    registerUserOnBackend({ role: 'scout', ...scoutData });
    alert('Scout Command Dashboard Initialized!');
  };

  return (
    <>
      {currentScreen === 'role_selection' && (
        <RoleSelection
          onSelectRole={(role) => {
            if (role === 'athlete') setCurrentScreen('athlete_reg');
            if (role === 'fan') setCurrentScreen('fan_reg');
            if (role === 'scout') setCurrentScreen('scout_reg');
          }}
        />
      )}

      {currentScreen === 'athlete_reg' && (
        <AthleteRegistration
          onBack={() => setCurrentScreen('role_selection')}
          onSubmit={handleAthleteSubmit}
        />
      )}

      {currentScreen === 'medical_modal' && (
        <MedicalCardModal
          visible={true}
          onSubmit={handleMedicalSubmit}
        />
      )}

      {currentScreen === 'athlete_dashboard' && (
        <AthleteDashboard
          onExit={() => setCurrentScreen('role_selection')}
        />
      )}

      {currentScreen === 'fan_reg' && (
        <FanRegistration
          onBack={() => setCurrentScreen('role_selection')}
          onSubmit={handleFanSubmit}
        />
      )}

      {currentScreen === 'scout_reg' && (
        <ScoutRegistration
          onBack={() => setCurrentScreen('role_selection')}
          onSubmit={handleScoutSubmit}
        />
      )}
    </>
  );
}