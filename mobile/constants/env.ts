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
      console.log('⚠️ Backend from .env not reachable, will try auto-discovery...');
    }
  }

  // 🔍 AUTO-DISCOVERY: Prova a trovare il backend sulla rete
  console.log('🛠️ DEVELOPMENT MODE - Auto-discovering backend...');

  // Controlla se abbiamo un URL cached e valido
  if (BACKEND_URL_CACHE && (Date.now() - LAST_DISCOVERY_TIME) < CACHE_DURATION) {
    console.log('🌐 Using cached backend URL:', BACKEND_URL_CACHE);
    
    // Verifica comunque che sia ancora raggiungibile
    const networkService = NetworkDiscoveryService.getInstance();
    const isStillWorking = await networkService.testBackendConnection(BACKEND_URL_CACHE);
    
    if (isStillWorking) {
      return BACKEND_URL_CACHE;
    } else {
      console.log('⚠️ Cached backend URL no longer working, rediscovering...');
      BACKEND_URL_CACHE = null;
    }
  }

  try {
    const networkService = NetworkDiscoveryService.getInstance();
    
    // 🔍 Prova a trovare un backend funzionante
    const workingBackend = await networkService.findWorkingBackend(3000);
    
    if (workingBackend) {
      console.log('✅ Found working backend:', workingBackend);
      BACKEND_URL_CACHE = workingBackend;
      LAST_DISCOVERY_TIME = Date.now();
      return workingBackend;
    }

    // ❌ Nessun backend trovato
    throw new Error('No working backend found on the network');

  } catch (error) {
    console.error('❌ Backend discovery failed:', error);
    
    // Fallback: mostra un errore chiaro all'utente
    throw new Error(
      'Impossibile connettersi al backend.\n\n' +
      '📱 SVILUPPO: Assicurati che:\n' +
      '1. Il backend sia avviato (npm run dev)\n' +
      '2. Il Mac e il telefono siano sulla STESSA RETE WiFi\n' +
      '3. Il firewall non blocchi la porta 3000\n\n' +
      '🚀 PRODUZIONE: Configura EXPO_PUBLIC_BACKEND_URL'
    );
  }
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
