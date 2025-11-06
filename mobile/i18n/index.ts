/**
 * i18n Configuration
 * Setup per supporto multilingua ITA/ENG
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

import en from './locales/en.json';
import it from './locales/it.json';

const LANGUAGE_STORAGE_KEY = '@wellness:language';

// 🆕 Helper per caricare lingua salvata o usare quella del dispositivo
async function getSavedLanguage(): Promise<string> {
  try {
    const saved = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved && (saved === 'en' || saved === 'it')) {
      return saved;
    }
    // Usa la lingua del dispositivo se disponibile, altrimenti ITA come default
    const deviceLocale = Localization.getLocales()[0];
    const deviceLang = deviceLocale?.languageCode || 'it';
    return deviceLang === 'en' ? 'en' : 'it';
  } catch (e) {
    console.error('[i18n] Error loading saved language:', e);
    return 'it'; // Default ITA
  }
}

// 🆕 Helper per salvare lingua
export async function saveLanguage(lang: 'en' | 'it'): Promise<void> {
  try {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    await i18n.changeLanguage(lang);
  } catch (e) {
    console.error('[i18n] Error saving language:', e);
  }
}

// Inizializza i18n
const initI18n = async () => {
  const savedLang = await getSavedLanguage();
  
  i18n
    .use(initReactI18next)
    .init({
      compatibilityJSON: 'v3', // Per React Native
      resources: {
        en: { translation: en },
        it: { translation: it },
      },
      lng: savedLang,
      fallbackLng: 'it', // Default ITA
      interpolation: {
        escapeValue: false, // React già fa escape
      },
      react: {
        useSuspense: false, // Disabilita suspense per React Native
      },
    });
  
  console.log(`[i18n] ✅ Initialized with language: ${savedLang}`);
};

// 🆕 Inizializza immediatamente (non await per non bloccare l'app)
initI18n().catch((e) => {
  console.error('[i18n] ❌ Failed to initialize:', e);
  // Fallback: inizializza con ITA
  i18n.use(initReactI18next).init({
    compatibilityJSON: 'v3',
    resources: { en: { translation: en }, it: { translation: it } },
    lng: 'it',
    fallbackLng: 'it',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
});

export default i18n;

