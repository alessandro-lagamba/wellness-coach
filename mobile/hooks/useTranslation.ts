/**
 * Custom hook per traduzioni i18n
 * Wrapper semplificato attorno a useTranslation di react-i18next
 */

import { useTranslation as useI18nTranslation } from 'react-i18next';

export function useTranslation() {
  const { t: tOriginal, i18n } = useI18nTranslation();

  // 🆕 Wrapper per garantire flessibilità (stringhe o oggetti)
  const t = (key: string, options?: any): any => {
    const result = tOriginal(key, options);
    // Se non è nulla, restituisce il risultato (stringa o oggetto)
    // Altrimenti fa il fallback alla chiave
    return result !== undefined && result !== null ? result : key;
  };

  return {
    t,
    language: i18n.language as 'it' | 'en',
    changeLanguage: async (lang: 'it' | 'en') => {
      await i18n.changeLanguage(lang);
    },
  };
}
