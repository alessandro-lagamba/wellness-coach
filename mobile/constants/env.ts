// Backend URL per PRODUZIONE (Railway) o SVILUPPO (da .env)
const PRODUCTION_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://your-backend.com';

/**
 * Determina se siamo in modalità sviluppo o produzione
 */
const isDevelopment = (): boolean => {
  // Se c'è un URL di produzione valido (https), usa quello - SEMPRE produzione
  if (PRODUCTION_BACKEND_URL && PRODUCTION_BACKEND_URL.startsWith('https://')) {
    return false; // PRODUZIONE - usa sempre l'URL Railway
  }
  // Altrimenti siamo in sviluppo
  return true;
};

/**
 * Ottiene l'URL del backend
 * 🚀 PRODUZIONE: Ritorna direttamente l'URL Railway (HTTPS)
 * 🛠️ SVILUPPO: Ritorna l'URL da .env (HTTP locale)
 */
export const getBackendURL = async (): Promise<string> => {
  // 🚀 PRODUZIONE: Usa sempre l'URL Railway (HTTPS) - nessuna verifica necessaria
  if (!isDevelopment()) {
    return PRODUCTION_BACKEND_URL;
  }

  // 🛠️ SVILUPPO: Ritorna l'URL da .env (può essere localhost o IP locale)
      return PRODUCTION_BACKEND_URL;
};

/**
 * URL del backend sincrono (per compatibilità con codice esistente)
 * ⚠️ DEPRECATO: Usa sempre getBackendURL() async per ottenere l'URL corretto
 */
export const BACKEND_URL = PRODUCTION_BACKEND_URL;

/**
 * Invalida la cache dell'URL del backend (mantenuto per compatibilità)
 * ⚠️ DEPRECATO: Non serve più cache, l'URL è sempre da .env
 */
export const invalidateBackendURLCache = (): void => {
  // No-op: non serve più cache
};
