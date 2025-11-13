/**
 * Language Service
 * Helper per ottenere la lingua corrente dell'utente
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const LANGUAGE_STORAGE_KEY = '@wellness:language';

/**
 * Ottiene la lingua corrente dell'utente
 * @returns 'it' | 'en' - Default: 'it'
 */
export async function getUserLanguage(): Promise<'it' | 'en'> {
  try {
    // Prova prima a leggere da AsyncStorage
    const savedLang = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (savedLang === 'en' || savedLang === 'it') {
      return savedLang;
    }

    // Fallback: prova a ottenere da i18n se disponibile
    try {
      const { default: i18n } = await import('i18next');
      const currentLang = i18n.language;
      if (currentLang === 'en' || currentLang === 'it') {
        return currentLang;
      }
    } catch (i18nError) {
      // Se i18n non è disponibile, continua con il fallback
    }

    // Fallback finale: usa la lingua del dispositivo
    try {
      const Localization = await import('expo-localization');
      const deviceLocale = Localization.getLocales()[0];
      const deviceLang = deviceLocale?.languageCode || 'it';
      return deviceLang === 'en' ? 'en' : 'it';
    } catch (localizationError) {
      // Se anche questo fallisce, usa default italiano
      return 'it';
    }
  } catch (error) {
    console.warn('⚠️ Could not determine user language, defaulting to Italian:', error);
    return 'it';
  }
}

/**
 * Ottiene l'istruzione per la lingua da aggiungere ai prompt AI
 * @param language - La lingua dell'utente
 * @returns Istruzione per l'AI sulla lingua da usare
 */
export function getLanguageInstruction(language: 'it' | 'en'): string {
  return language === 'it'
    ? 'IMPORTANT: Respond in Italian. All text in your response must be in Italian.'
    : 'IMPORTANT: Respond in English. All text in your response must be in English.';
}

