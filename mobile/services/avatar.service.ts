import { getBackendURL } from '../constants/env';

/**
 * AvatarService
 *
 * Gestisce il flusso di generazione dell'avatar a partire da una foto
 * chiamando il backend che si occupa della trasformazione e del salvataggio.
 */
export class AvatarService {
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

    try {
      // In React Native, non impostare Content-Type manualmente quando usi FormData
      // Il sistema lo imposta automaticamente con il boundary corretto
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      console.log('📸 AvatarService: Response status:', response.status);
      console.log('📸 AvatarService: Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ AvatarService: Error response:', errorText);
        throw new Error(`Avatar generation failed: ${response.status} ${errorText}`);
      }

      const payload = await response.json();
      console.log('📸 AvatarService: Response payload:', payload);

      if (!payload?.success || !payload?.data?.avatarUrl) {
        throw new Error('Avatar generation response is invalid');
      }

      return {
        avatarUri: payload.data.avatarUrl,
        storagePath: payload.data.storagePath,
      };
    } catch (error) {
      console.error('❌ AvatarService: Error:', error);
      throw error;
    }
  }
}

