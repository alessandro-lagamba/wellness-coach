import { supabase } from '../lib/supabase';
// 🔥 FIX: Usa l'API legacy di expo-file-system per evitare errori di deprecazione
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { AuthService } from './auth.service';

const FOOD_IMAGES_BUCKET = 'food-images';

// 🔥 FIX: Dimensioni ottimizzate per le immagini del cibo (riduce drasticamente le dimensioni)
const MAX_IMAGE_WIDTH = 1200; // Larghezza massima in pixel
const MAX_IMAGE_HEIGHT = 1200; // Altezza massima in pixel
const COMPRESSION_QUALITY = 0.8; // Qualità JPEG (0-1, 0.8 = 80% - buon compromesso qualità/dimensione)

/**
 * Servizio per gestire il caricamento delle immagini delle analisi del cibo in Supabase Storage
 */
export class FoodImageStorageService {
  private static instance: FoodImageStorageService;

  static getInstance(): FoodImageStorageService {
    if (!FoodImageStorageService.instance) {
      FoodImageStorageService.instance = new FoodImageStorageService();
    }
    return FoodImageStorageService.instance;
  }

  /**
   * Verifica se il bucket esiste, altrimenti lo crea
   */
  private async ensureBucket(): Promise<void> {
    try {
      const { data: buckets, error: listError } = await supabase.storage.listBuckets();
      
      if (listError) {
        console.warn('[FoodImageStorage] Error listing buckets:', listError);
        // Non bloccare se non possiamo verificare, proviamo comunque l'upload
        return;
      }

      const bucketExists = buckets?.some(bucket => bucket.name === FOOD_IMAGES_BUCKET);
      
      if (!bucketExists) {
        // Il bucket non esiste, ma non possiamo crearlo dal client
        // Dobbiamo usare l'MCP o crearlo manualmente
        console.warn('[FoodImageStorage] Bucket does not exist. Please create it via MCP or manually.');
        // Per ora continuiamo, l'upload fallirà se il bucket non esiste
      }
    } catch (error) {
      console.warn('[FoodImageStorage] Error ensuring bucket:', error);
    }
  }

  /**
   * Ridimensiona e comprime un'immagine per ridurre drasticamente le dimensioni del file
   * 🔥 FIX: Riduce le dimensioni del file del 70-90% mantenendo una buona qualità visiva
   */
  private async resizeAndCompressImage(imageUri: string): Promise<{ uri: string; width: number; height: number }> {
    try {
      // Se è già un URL remoto (già ottimizzato da Supabase), non fare resize
      if (imageUri.startsWith('http://') || imageUri.startsWith('https://')) {
        // Per URL remoti già ottimizzati, non fare resize
        return { uri: imageUri, width: MAX_IMAGE_WIDTH, height: MAX_IMAGE_HEIGHT };
      }

      // Per URI locali o base64, ridimensiona e comprimi
      const manipResult = await ImageManipulator.manipulateAsync(
        imageUri,
        [
          {
            resize: {
              width: MAX_IMAGE_WIDTH,
              height: MAX_IMAGE_HEIGHT,
            },
          },
        ],
        {
          compress: COMPRESSION_QUALITY,
          format: ImageManipulator.SaveFormat.JPEG, // 🔥 Usa sempre JPEG per ridurre le dimensioni (PNG è più pesante)
        }
      );

      const originalSize = imageUri.startsWith('file://') 
        ? (await FileSystem.getInfoAsync(imageUri)).size || 0 
        : 0;
      const resizedSize = (await FileSystem.getInfoAsync(manipResult.uri)).size || 0;
      const reductionPercent = originalSize > 0 
        ? Math.round(((originalSize - resizedSize) / originalSize) * 100) 
        : 0;

      console.log('[FoodImageStorage] Image resized and compressed:', {
        original: imageUri.substring(0, 50) + '...',
        resized: manipResult.uri.substring(0, 50) + '...',
        dimensions: `${manipResult.width}x${manipResult.height}`,
        originalSize: originalSize > 0 ? `${(originalSize / 1024).toFixed(2)} KB` : 'unknown',
        resizedSize: `${(resizedSize / 1024).toFixed(2)} KB`,
        reduction: reductionPercent > 0 ? `${reductionPercent}%` : 'unknown',
      });

      return {
        uri: manipResult.uri,
        width: manipResult.width,
        height: manipResult.height,
      };
    } catch (error) {
      console.error('[FoodImageStorage] Error resizing image:', error);
      // Se il resize fallisce, usa l'immagine originale
      console.warn('[FoodImageStorage] Using original image as fallback');
      return { uri: imageUri, width: MAX_IMAGE_WIDTH, height: MAX_IMAGE_HEIGHT };
    }
  }

  /**
   * Converte un URI locale o base64 in ArrayBuffer per l'upload
   * 🔥 FIX: Ora ridimensiona e comprime l'immagine prima della conversione per ridurre le dimensioni
   */
  private async convertImageToArrayBuffer(imageUri: string): Promise<{ buffer: ArrayBuffer; mimeType: string }> {
    try {
      // 🔥 FIX: Ridimensiona e comprimi l'immagine prima di convertirla
      const resizedImage = await this.resizeAndCompressImage(imageUri);
      const processedUri = resizedImage.uri;

      // Se è già un data URL base64 (dopo il resize)
      if (processedUri.startsWith('data:image/')) {
        const [header, base64Data] = processedUri.split(',');
        const mimeType = header.match(/data:image\/([^;]+)/)?.[1] || 'jpeg';
        
        // Converti base64 in ArrayBuffer
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        return {
          buffer: bytes.buffer,
          mimeType: `image/${mimeType}`,
        };
      }

      // Se è un URI locale (file:// o content://) - dopo il resize sarà sempre file://
      if (processedUri.startsWith('file://') || processedUri.startsWith('content://')) {
        // Leggi come base64 e converti
        const base64 = await FileSystem.readAsStringAsync(processedUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        // Converti base64 in ArrayBuffer
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        // 🔥 Dopo il resize, usiamo sempre JPEG per ridurre le dimensioni
        const mimeType = 'image/jpeg';
        
        return {
          buffer: bytes.buffer,
          mimeType,
        };
      }

      // Se è un URL remoto, fetch e converti
      if (processedUri.startsWith('http://') || processedUri.startsWith('https://')) {
        const response = await fetch(processedUri);
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        const mimeType = blob.type || 'image/jpeg';
        
        return {
          buffer: arrayBuffer,
          mimeType,
        };
      }

      throw new Error(`Unsupported image URI format: ${processedUri}`);
    } catch (error) {
      console.error('[FoodImageStorage] Error converting image to ArrayBuffer:', error);
      throw new Error('Failed to process image for upload');
    }
  }

  /**
   * Carica un'immagine in Supabase Storage e restituisce l'URL pubblico
   */
  async uploadFoodImage(imageUri: string, analysisId?: string): Promise<string> {
    try {
      const currentUser = await AuthService.getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      // Verifica che il bucket esista
      await this.ensureBucket();

      // Converti l'immagine in ArrayBuffer
      const { buffer, mimeType } = await this.convertImageToArrayBuffer(imageUri);

      // Crea il path univoco per l'immagine
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 9);
      const fileExtension = mimeType === 'image/png' ? 'png' : 'jpg';
      const filePath = `${currentUser.id}/${analysisId || timestamp}-${randomId}.${fileExtension}`;

      // Carica l'immagine in Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(FOOD_IMAGES_BUCKET)
        .upload(filePath, buffer, {
          contentType: mimeType,
          cacheControl: '3600', // 1 ora
          upsert: false, // Non sovrascrivere se esiste già
        });

      if (uploadError) {
        console.error('[FoodImageStorage] Upload error:', uploadError);
        
        // 🔥 FIX: Messaggio di errore più chiaro se il bucket non esiste
        if (uploadError.message?.includes('Bucket not found') || uploadError.message?.includes('not found')) {
          throw new Error(
            'Il bucket "food-images" non esiste in Supabase Storage. ' +
            'Per favore, crealo manualmente tramite il dashboard di Supabase: ' +
            'Storage > New bucket > Nome: "food-images", Public: true'
          );
        }
        
        throw new Error(`Failed to upload image: ${uploadError.message}`);
      }

      // Ottieni l'URL pubblico
      const { data: publicUrlData } = supabase.storage
        .from(FOOD_IMAGES_BUCKET)
        .getPublicUrl(filePath);

      const publicUrl = publicUrlData?.publicUrl;

      if (!publicUrl) {
        throw new Error('Failed to generate public URL for uploaded image');
      }

      console.log('[FoodImageStorage] Image uploaded successfully:', publicUrl);
      return publicUrl;
    } catch (error) {
      console.error('[FoodImageStorage] Error uploading food image:', error);
      throw error;
    }
  }

  /**
   * Elimina un'immagine da Supabase Storage
   */
  async deleteFoodImage(imageUrl: string): Promise<void> {
    try {
      // Estrai il path dal URL pubblico
      const urlParts = imageUrl.split('/');
      const pathIndex = urlParts.findIndex(part => part === FOOD_IMAGES_BUCKET);
      if (pathIndex === -1) {
        throw new Error('Invalid image URL format');
      }
      
      const filePath = urlParts.slice(pathIndex + 1).join('/');

      const { error } = await supabase.storage
        .from(FOOD_IMAGES_BUCKET)
        .remove([filePath]);

      if (error) {
        console.error('[FoodImageStorage] Error deleting image:', error);
        throw error;
      }

      console.log('[FoodImageStorage] Image deleted successfully');
    } catch (error) {
      console.error('[FoodImageStorage] Error deleting food image:', error);
      throw error;
    }
  }
}

export const foodImageStorageService = FoodImageStorageService.getInstance();

