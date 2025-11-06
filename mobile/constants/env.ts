import NetworkDiscoveryService from '../services/network-discovery.service';
import NetInfo from '@react-native-community/netinfo';

// 🔧 AUTO-DISCOVERY: IP dinamico invece di hardcoded
let BACKEND_URL_CACHE: string | null = null;
let LAST_DISCOVERY_TIME = 0;
const CACHE_DURATION = 2 * 60 * 1000; // 2 minuti (più breve per rilevare cambi rete)

// Backend URL per PRODUZIONE (quando l'app è deployata)
const PRODUCTION_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://your-backend.com';

/**
 * Determina se siamo in modalità sviluppo o produzione
 */
const isDevelopment = (): boolean => {
  // Se c'è un URL di produzione valido (https), usa quello
  if (PRODUCTION_BACKEND_URL.startsWith('https://')) {
    return false;
  }
  // Se c'è un backend URL che non è localhost, consideralo sviluppo con IP/mDNS fisso
  if (PRODUCTION_BACKEND_URL && 
      PRODUCTION_BACKEND_URL.startsWith('http://') && 
      !PRODUCTION_BACKEND_URL.includes('localhost')) {
    return true; // Sviluppo con IP/mDNS fisso
  }
  // Altrimenti siamo in sviluppo
  return true;
};

/**
 * Ottiene l'URL del backend con auto-discovery dell'IP
 */
export const getBackendURL = async (): Promise<string> => {
  // 🚀 PRODUZIONE: Usa sempre l'URL di produzione (HTTPS)
  if (!isDevelopment()) {
    console.log('🌍 PRODUCTION MODE - Using production backend:', PRODUCTION_BACKEND_URL);
    return PRODUCTION_BACKEND_URL;
  }

  // 🛠️ SVILUPPO: Controlla prima se c'è un URL fisso in .env
  if (PRODUCTION_BACKEND_URL && 
      PRODUCTION_BACKEND_URL.startsWith('http://') && 
      !PRODUCTION_BACKEND_URL.includes('localhost') &&
      !PRODUCTION_BACKEND_URL.includes('discovering')) {
    
    console.log('🛠️ DEVELOPMENT MODE - Using fixed backend URL from .env:', PRODUCTION_BACKEND_URL);
    
    // Verifica che sia raggiungibile
    const networkService = NetworkDiscoveryService.getInstance();
    const isWorking = await networkService.testBackendConnection(PRODUCTION_BACKEND_URL);
    
    if (isWorking) {
      console.log('✅ Backend from .env is reachable:', PRODUCTION_BACKEND_URL);
      BACKEND_URL_CACHE = PRODUCTION_BACKEND_URL;
      LAST_DISCOVERY_TIME = Date.now();
      return PRODUCTION_BACKEND_URL;
    } else {
      console.log('⚠️ Backend from .env not reachable, disabling auto-discovery to avoid loops');
      // Non fare auto-discovery per evitare loop/log flooding: usa comunque l'URL .env
      BACKEND_URL_CACHE = PRODUCTION_BACKEND_URL;
      LAST_DISCOVERY_TIME = Date.now();
      return PRODUCTION_BACKEND_URL;
    }
  }
  // Auto-discovery disabilitato per evitare loop; restituiamo placeholder .env
  return PRODUCTION_BACKEND_URL;
};

/**
 * URL del backend sincrono (per compatibilità con codice esistente)
 * ATTENZIONE: In sviluppo, usa sempre getBackendURL() async
 */
export let BACKEND_URL = isDevelopment() 
  ? 'http://discovering...' // Placeholder per sviluppo
  : PRODUCTION_BACKEND_URL;

/**
 * Inizializza il backend URL al caricamento dell'app
 */
export const initializeBackendURL = async (): Promise<void> => {
  try {
    const url = await getBackendURL();
    BACKEND_URL = url;
    console.log('✅ Backend URL initialized:', BACKEND_URL);
  } catch (error) {
    console.error('❌ Failed to initialize backend URL:', error);
  }
};

/**
 * Invalida la cache dell'URL del backend
 */
export const invalidateBackendURLCache = (): void => {
  BACKEND_URL_CACHE = null;
  LAST_DISCOVERY_TIME = 0;
  console.log('🔄 Backend URL cache invalidated');
};

/**
 * Monitora i cambi di rete e invalida la cache
 */
NetInfo.addEventListener(state => {
  if (state.isConnected && isDevelopment()) {
    console.log('🔄 Network changed, invalidating backend URL cache...');
    invalidateBackendURLCache();
    
    // Riprova a scoprire il backend dopo un cambio di rete
    setTimeout(() => {
      initializeBackendURL().catch(err => {
        console.error('Failed to rediscover backend after network change:', err);
      });
    }, 2000);
  }
});

// Inizializza al caricamento
if (isDevelopment()) {
  console.log('🛠️ DEVELOPMENT MODE - Backend will be auto-discovered');
  initializeBackendURL();
} else {
  console.log('🚀 PRODUCTION MODE - Using:', PRODUCTION_BACKEND_URL);
}
