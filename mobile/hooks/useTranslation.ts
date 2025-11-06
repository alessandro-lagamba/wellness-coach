/**
 * Custom hook per traduzioni i18n
 * Wrapper semplificato attorno a useTranslation di react-i18next
 */

import { useTranslation as useI18nTranslation } from 'react-i18next';

export function useTranslation() {
  const { t: tOriginal, i18n } = useI18nTranslation();
  
  // 🆕 Wrapper per garantire sempre stringa
  const t = (key: string, options?: any): string => {
    const result = tOriginal(key, options);
    // Se è un oggetto o altro, converte a stringa
    if (typeof result === 'string') {
      return result;
    }
    // Fallback alla chiave se la traduzione non è disponibile
    return String(result || key);
  };
  
  return {
    t,
    language: i18n.language as 'it' | 'en',
    changeLanguage: async (lang: 'it' | 'en') => {
      await i18n.changeLanguage(lang);
    },
  };
}

