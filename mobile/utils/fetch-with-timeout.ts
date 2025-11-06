/**
 * Fetch con timeout e retry logic
 */

export interface FetchOptions extends RequestInit {
  timeout?: number; // Timeout in millisecondi (default: 30s)
  retries?: number; // Numero di retry (default: 0)
  retryDelay?: number; // Delay tra retry in ms (default: 1000)
}

export async function fetchWithTimeout(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  const {
    timeout = 30000, // 30 secondi default
    retries = 0,
    retryDelay = 1000,
    ...fetchOptions
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Crea AbortController per timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      // Fetch con timeout
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error: any) {
      lastError = error;

      // Se è l'ultimo tentativo, rilancia l'errore
      if (attempt === retries) {
        break;
      }

      // Se è abort (timeout), aspetta prima di riprovare
      if (error.name === 'AbortError') {
        console.warn(`⏱️ Request timeout (attempt ${attempt + 1}/${retries + 1}), retrying...`);
      } else {
        console.warn(`⚠️ Request failed (attempt ${attempt + 1}/${retries + 1}):`, error.message);
      }

      // Attendi prima del prossimo tentativo
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
      }
    }
  }

  // Se arriviamo qui, tutti i tentativi sono falliti
  throw lastError || new Error('Request failed after all retries');
}

/**
 * Wrapper per fetch con timeout e gestione errori
 */
export async function safeFetch(
  url: string,
  options: FetchOptions = {}
): Promise<{ success: boolean; data?: any; error?: string; response?: Response }> {
  try {
    const response = await fetchWithTimeout(url, options);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        error: `HTTP ${response.status}: ${response.statusText}`,
      }));

      return {
        success: false,
        error: errorData.error || `HTTP ${response.status}: ${response.statusText}`,
        response,
      };
    }

    const data = await response.json().catch(() => null);

    return {
      success: true,
      data,
      response,
    };
  } catch (error: any) {
    // Gestione errori specifici
    if (error.name === 'AbortError') {
      return {
        success: false,
        error: 'Request timeout - backend non risponde',
      };
    }

    if (error.message?.includes('Network request failed')) {
      return {
        success: false,
        error: 'Network error - verifica connessione internet',
      };
    }

    return {
      success: false,
      error: error.message || 'Unknown error occurred',
    };
  }
}

