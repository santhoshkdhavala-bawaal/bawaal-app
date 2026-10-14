import React, { createContext, useState } from 'react';

export const languages = {
  en: 'English',
  hi: 'हिंदी (Hindi)',
  mr: 'मराठी (Marathi)',
  ta: 'தமிழ் (Tamil)',
  te: 'తెలుగు (Telugu)',
  pa: 'ਪੰਜਾਬੀ (Punjabi)',
  bn: 'বাংলা (Bengali)'
};

export const LanguageContext = createContext({
  currentLang: 'en',
  setLanguage: () => {},
  languages: languages
});

export const LanguageProvider = ({ children }) => {
  const [currentLang, setCurrentLang] = useState('en');

  const setLanguage = (lang) => {
    if (languages[lang]) {
      setCurrentLang(lang);
    }
  };

  return (
    <LanguageContext.Provider value={{ currentLang, setLanguage, languages }}>
      {children}
    </LanguageContext.Provider>
  );
};