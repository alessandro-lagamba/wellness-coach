import { getBackendURL } from '../constants/env';
import { RetryService } from './retry.service';

/**
 * AvatarService
 *
 * Gestisce il flusso di generazione dell'avatar a partire da una foto
 * chiamando il backend che si occupa della trasformazione e del salvataggio.
 * ✅ Include: timeout, retry logic, gestione errori robusta
 */
export class AvatarService {
  private static readonly REQUEST_TIMEOUT = 120000; // 2 minuti (generazione avatar può richiedere tempo)
  private static readonly MAX_RETRIES = 2; // 2 retry attempts (totale 3 tentativi)

  static async generateFromPhoto(
    localPhotoUri: string,
    options: { userId?: string; mimeType?: string } = {}
  ): Promise<{ avatarUri: string; storagePath?: string }> {
    const backendURL = await getBackendURL();
    console.log('📸 AvatarService: Generating avatar from photo:', localPhotoUri);
    console.log('📸 AvatarService: Backend URL:', backendURL);
    console.log('📸 AvatarService: User ID:', options.userId);

    const formData = new FormData();

    formData.append('photo', {
      uri: localPhotoUri,
      name: `avatar_${Date.now()}.jpg`,
      type: options.mimeType || 'image/jpeg',
    } as any);

    if (options.userId) {
      formData.append('userId', options.userId);
    }

    const endpoint = `${backendURL}/api/avatar/generate`;
    console.log('📸 AvatarService: Calling endpoint:', endpoint);

    // Usa retry logic per gestire errori transienti (rete, timeout, 5xx)
    return RetryService.withRetry(
      async () => {
        // Crea AbortController per timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, this.REQUEST_TIMEOUT);

        try {
          // In React Native, non impostare Content-Type manualmente quando usi FormData
          // Il sistema lo imposta automaticamente con il boundary corretto
          const response = await fetch(endpoint, {
            method: 'POST',
            body: formData,
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          console.log('📸 AvatarService: Response status:', response.status);

          if (!response.ok) {
            let errorText = '';
            try {
              errorText = await response.text();
            } catch (e) {
              errorText = `HTTP ${response.status} ${response.statusText}`;
            }
            
            console.error('❌ AvatarService: Error response:', errorText);
            
            // Errori non retryable (4xx client errors)
            if (response.status >= 400 && response.status < 500) {
              throw new Error(`Avatar generation failed: ${response.status} ${errorText}`);
            }
            
            // Errori retryable (5xx server errors, network errors)
            throw new Error(`Server error: ${response.status} ${errorText}`);
          }

          const payload = await response.json();
          console.log('📸 AvatarService: Response received');

          if (!payload?.success || !payload?.data?.avatarUrl) {
            throw new Error('Avatar generation response is invalid');
          }

          return {
            avatarUri: payload.data.avatarUrl,
            storagePath: payload.data.storagePath,
          };
        } catch (error: any) {
          clearTimeout(timeoutId);
          
          // Gestione specifica per timeout
          if (error.name === 'AbortError' || error.message?.includes('timeout')) {
            throw new Error('Avatar generation timeout: il server ha impiegato troppo tempo');
          }
          
          // Rilancia l'errore per il retry logic
          throw error;
        }
      },
      'avatar_generation',
      {
        maxAttempts: this.MAX_RETRIES,
        delay: 2000, // 2 secondi tra i retry
        backoff: 'exponential',
        shouldRetry: (error: Error) => {
          // Ritenta solo su errori di rete, timeout, o 5xx
          const errorMessage = error.message.toLowerCase();
          return (
            errorMessage.includes('timeout') ||
            errorMessage.includes('network') ||
            errorMessage.includes('server error') ||
            errorMessage.includes('failed to fetch') ||
            errorMessage.includes('aborted')
          );
        },
      }
    );
  }
}

