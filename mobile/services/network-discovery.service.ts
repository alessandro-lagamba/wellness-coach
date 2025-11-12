/**
 * NetworkDiscoveryService - Semplificato per Railway
 * 
 * ⚠️ NOTA: Con Railway, non serve più auto-discovery della rete locale.
 * Manteniamo solo testBackendConnection() per verificare la connettività del backend.
 * 
 * Tutto il codice di auto-discovery (getLocalIP, scanLocalNetwork, findWorkingBackend)
 * è stato rimosso perché non serve più con Railway (HTTPS fisso).
 */
export class NetworkDiscoveryService {
  private static instance: NetworkDiscoveryService;

  public static getInstance(): NetworkDiscoveryService {
    if (!NetworkDiscoveryService.instance) {
      NetworkDiscoveryService.instance = new NetworkDiscoveryService();
    }
    return NetworkDiscoveryService.instance;
  }

  /**
   * Testa la connettività con il backend
   * Utile per verificare se il backend Railway è raggiungibile
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
}

export default NetworkDiscoveryService;
