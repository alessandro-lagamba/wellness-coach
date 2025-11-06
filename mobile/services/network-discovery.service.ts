import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

export interface NetworkInfo {
  ip: string;
  isConnected: boolean;
  type: string;
}

export class NetworkDiscoveryService {
  private static instance: NetworkDiscoveryService;
  private cachedIP: string | null = null;
  private lastDiscoveryTime: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minuti

  public static getInstance(): NetworkDiscoveryService {
    if (!NetworkDiscoveryService.instance) {
      NetworkDiscoveryService.instance = new NetworkDiscoveryService();
    }
    return NetworkDiscoveryService.instance;
  }

  /**
   * Ottiene l'IP locale del dispositivo
   */
  async getLocalIP(): Promise<string | null> {
    try {
      // Controlla se abbiamo un IP cached e valido
      if (this.cachedIP && (Date.now() - this.lastDiscoveryTime) < this.CACHE_DURATION) {
        console.log('🌐 Using cached IP:', this.cachedIP);
        return this.cachedIP;
      }

      console.log('🌐 Discovering local IP...');
      
      if (Platform.OS === 'web') {
        // Su web, usa localhost
        this.cachedIP = 'localhost';
        this.lastDiscoveryTime = Date.now();
        return this.cachedIP;
      }

      // Su mobile, prova diversi metodi
      const ip = await this.discoverMobileIP();
      
      if (ip) {
        this.cachedIP = ip;
        this.lastDiscoveryTime = Date.now();
        console.log('✅ Local IP discovered:', ip);
        return ip;
      }

      console.log('⚠️ Could not discover local IP, using fallback');
      return this.getFallbackIP();
      
    } catch (error) {
      console.error('Error discovering local IP:', error);
      return this.getFallbackIP();
    }
  }

  /**
   * Scopre l'IP su dispositivi mobile
   */
  private async discoverMobileIP(): Promise<string | null> {
    try {
      // Metodo 1: Usa NetInfo per ottenere l'IP
      const netInfo = await NetInfo.fetch();
      
      if (netInfo.details && 'ipAddress' in netInfo.details) {
        const ip = netInfo.details.ipAddress as string;
        if (ip && this.isValidIP(ip)) {
          console.log('🌐 IP found via NetInfo:', ip);
          return ip;
        }
      }

      // Metodo 2: Prova a fare una richiesta HTTP per scoprire l'IP
      const discoveredIP = await this.discoverViaHTTP();
      if (discoveredIP) {
        console.log('🌐 IP discovered via HTTP:', discoveredIP);
        return discoveredIP;
      }

      return null;
    } catch (error) {
      console.error('Error in discoverMobileIP:', error);
      return null;
    }
  }

  /**
   * Scopre l'IP facendo una richiesta HTTP a un servizio esterno
   */
  private async discoverViaHTTP(): Promise<string | null> {
    try {
      // Prova diversi servizi per ottenere l'IP pubblico
      const services = [
        'https://api.ipify.org',
        'https://ipapi.co/ip',
        'https://api.my-ip.io/ip'
      ];

      for (const service of services) {
        try {
          const response = await fetch(service, { timeout: 3000 });
          if (response.ok) {
            const ip = (await response.text()).trim();
            if (this.isValidIP(ip)) {
              return ip;
            }
          }
        } catch (error) {
          console.log(`Service ${service} failed:`, error);
          continue;
        }
      }

      return null;
    } catch (error) {
      console.error('Error in discoverViaHTTP:', error);
      return null;
    }
  }

  /**
   * Valida se un IP è valido
   */
  private isValidIP(ip: string): boolean {
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipRegex.test(ip);
  }

  /**
   * IP di fallback quando non riesce a scoprire l'IP
   */
  private getFallbackIP(): string {
    // IP comuni per reti locali
    const commonIPs = [
      '10.163.94.238',  // Il tuo IP attuale
      '192.168.1.1',   // Router comune
      '192.168.0.1',   // Router comune
      '10.0.0.1',      // Router comune
      'localhost'       // Ultimo fallback
    ];

    // Per ora restituisce il tuo IP attuale
    return commonIPs[0];
  }

  /**
   * Genera l'URL completo del backend
   */
  async getBackendURL(port: number = 3000): Promise<string> {
    const ip = await this.getLocalIP();
    const url = `http://${ip}:${port}`;
    console.log('🌐 Generated backend URL:', url);
    return url;
  }

  /**
   * Testa la connettività con il backend
   */
  async testBackendConnection(backendURL: string): Promise<boolean> {
    try {
      // Timeout di 3 secondi per reti più lente
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 secondi
      
      const response = await fetch(`${backendURL}/api/health`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        },
      });
      
      clearTimeout(timeoutId);
      
      const isConnected = response.ok;
      if (!isConnected) {
        console.log('❌ Backend responded but not healthy:', backendURL);
      }
      return isConnected;
    } catch (error: any) {
      // Non loggare ogni errore per non intasare i logs
      if (error.name !== 'AbortError') {
        // console.log('❌ Backend test failed:', backendURL, error.message);
      }
      return false;
    }
  }

  /**
   * Scansiona la rete locale per trovare il backend
   * Prova gli IP più comuni della sottorete corrente
   */
  private async scanLocalNetwork(port: number): Promise<string[]> {
    const localIP = await this.getLocalIP();
    if (!localIP || localIP === 'localhost') {
      return [];
    }

    // Estrai la subnet (es: da 192.168.1.15 prendi 192.168.1)
    const parts = localIP.split('.');
    if (parts.length !== 4) {
      return [];
    }

    const subnet = `${parts[0]}.${parts[1]}.${parts[2]}`;
    console.log('📡 Scanning subnet:', subnet);

    // IP comuni da provare (router, gateway, range comune)
    const commonHosts = [
      1,    // Gateway/Router
      100,  // Range comune per server
      101, 102, 103, 104, 105,
      200, 201, 202, 203, 204,
      10, 11, 12, // Range basso
      254, 253, 252 // Range alto
    ];

    const ipsToScan = commonHosts.map(host => `${subnet}.${host}`);
    
    // Aggiungi anche l'IP del dispositivo stesso
    ipsToScan.push(localIP);

    return ipsToScan;
  }

  /**
   * Trova il backend funzionante provando diversi IP
   * ⚠️ DISABILITATO IN PRODUZIONE: Se l'URL è HTTPS, non cercare localmente
   */
  async findWorkingBackend(port: number = 3000): Promise<string | null> {
    console.log('🔍 Searching for working backend...');
    
    // 1️⃣ Prima prova il nome mDNS del Mac (da .env)
    const envBackendURL = process.env.EXPO_PUBLIC_BACKEND_URL;
    if (envBackendURL && envBackendURL !== '' && !envBackendURL.includes('discovering')) {
      console.log('🎯 Trying backend URL from .env first:', envBackendURL);
      
      // 🚀 Se l'URL è HTTPS (produzione), usa sempre quello e non cercare localmente
      if (envBackendURL.startsWith('https://')) {
        console.log('  ✅ Production URL detected, using Railway backend:', envBackendURL);
        const isWorking = await this.testBackendConnection(envBackendURL);
        return isWorking ? envBackendURL : null;
      }
      
      // 🛠️ Se è HTTP (sviluppo), testa la connessione
      const isWorking = await this.testBackendConnection(envBackendURL);
      if (isWorking) {
        console.log('  ✅ Found working backend from .env:', envBackendURL);
        return envBackendURL;
      } else {
        console.log('  ⚠️ Backend from .env not reachable, trying alternatives...');
      }
    }
    
    // 2️⃣ Prova gli IP più probabili nella subnet corrente
    const localIP = await this.getLocalIP();
    let priorityIPs: string[] = [];
    
    if (localIP && localIP !== 'localhost') {
      // Estrai subnet (es: da 192.168.1.54 prendi 192.168.1)
      const parts = localIP.split('.');
      if (parts.length === 4) {
        const subnet = `${parts[0]}.${parts[1]}.${parts[2]}`;
        console.log('📡 Detected subnet:', subnet);
        
        // Prova IP comuni nella stessa subnet
        // PRIORITÀ ASSOLUTA: Gateway e IP vicini al dispositivo corrente
        const currentLastOctet = parseInt(parts[3]);
        
        priorityIPs = [
          `${subnet}.1`,    // Router/Gateway (PRIMA PRIORITÀ!)
          `${subnet}.${currentLastOctet}`,  // IP del dispositivo stesso
          `${subnet}.${currentLastOctet - 1}`, // IP adiacente sotto
          `${subnet}.${currentLastOctet + 1}`, // IP adiacente sopra
          `${subnet}.100`,  // IP comune per Mac/server
          `${subnet}.56`,   // IP fisso del Mac su altre reti
          `${subnet}.254`,  // Range alto
          `${subnet}.50`,
          `${subnet}.51`,
          `${subnet}.52`,
          `${subnet}.53`,
          `${subnet}.54`,
          `${subnet}.55`,
          `${subnet}.57`,
          `${subnet}.58`,
          `${subnet}.59`,
          `${subnet}.60`,
        ];
      }
    }
    
    // Aggiungi fallback per subnet comuni
    priorityIPs.push(
      '192.168.1.100',
      '192.168.1.56',   // IP attuale del Mac
      '192.168.0.100',
      '10.0.0.100',
    );

    // Rimuovi duplicati
    priorityIPs = [...new Set(priorityIPs)];

    console.log('🎯 Trying priority IPs:', priorityIPs.length, 'addresses');
    for (const ip of priorityIPs) {
      const backendURL = `http://${ip}:${port}`;
      console.log(`  🔍 Testing: ${backendURL}`);
      
      const isWorking = await this.testBackendConnection(backendURL);
      if (isWorking) {
        console.log(`  ✅ Found working backend: ${backendURL}`);
        return backendURL;
      }
    }

    // 2️⃣ Se non trovato, scansiona la subnet locale
    console.log('📡 Scanning local network...');
    const localNetworkIPs = await this.scanLocalNetwork(port);
    
    // Prova in parallelo (max 5 alla volta per non sovraccaricare)
    const batchSize = 5;
    for (let i = 0; i < localNetworkIPs.length; i += batchSize) {
      const batch = localNetworkIPs.slice(i, i + batchSize);
      const promises = batch.map(async (ip) => {
        const backendURL = `http://${ip}:${port}`;
        const isWorking = await this.testBackendConnection(backendURL);
        return isWorking ? backendURL : null;
      });

      const results = await Promise.all(promises);
      const workingBackend = results.find(url => url !== null);
      
      if (workingBackend) {
        console.log(`✅ Found working backend in batch: ${workingBackend}`);
        return workingBackend;
      }
    }

    console.log('❌ No working backend found on local network');
    return null;
  }

  /**
   * Invalida la cache dell'IP
   */
  invalidateCache(): void {
    this.cachedIP = null;
    this.lastDiscoveryTime = 0;
    console.log('🔄 IP cache invalidated');
  }
}

export default NetworkDiscoveryService;
