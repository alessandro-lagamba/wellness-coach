import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export interface BiometricAuthResult {
  success: boolean;
  error?: string;
  biometricType?: 'fingerprint' | 'facial' | 'iris' | 'voice';
}

export interface BiometricCapabilities {
  isAvailable: boolean;
  supportedTypes: LocalAuthentication.AuthenticationType[];
  hasHardware: boolean;
  isEnrolled: boolean;
}

export class BiometricAuthService {
  private static readonly STORAGE_KEYS = {
    BIOMETRIC_ENABLED: 'biometric_enabled',
    BIOMETRIC_CREDENTIALS: 'biometric_credentials',
    BIOMETRIC_SETUP_COMPLETED: 'biometric_setup_completed',
  };

  /**
   * Verifica le capacità biometriche del dispositivo
   */
  static async getCapabilities(): Promise<BiometricCapabilities> {
    try {
      const [hasHardware, isEnrolled, supportedTypes] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
        LocalAuthentication.supportedAuthenticationTypesAsync(),
      ]);

      return {
        isAvailable: hasHardware && isEnrolled,
        supportedTypes,
        hasHardware,
        isEnrolled,
      };
    } catch (error) {
      console.error('Error checking biometric capabilities:', error);
      return {
        isAvailable: false,
        supportedTypes: [],
        hasHardware: false,
        isEnrolled: false,
      };
    }
  }

  /**
   * Verifica se l'autenticazione biometrica è abilitata
   */
  static async isBiometricEnabled(): Promise<boolean> {
    try {
      const enabled = await SecureStore.getItemAsync(this.STORAGE_KEYS.BIOMETRIC_ENABLED);
      return enabled === 'true';
    } catch (error) {
      console.error('Error checking biometric status:', error);
      return false;
    }
  }

  /**
   * Abilita l'autenticazione biometrica
   */
  static async enableBiometric(): Promise<{ success: boolean; error?: string }> {
    try {
      const capabilities = await this.getCapabilities();
      
      if (!capabilities.isAvailable) {
        return {
          success: false,
          error: 'Autenticazione biometrica non disponibile su questo dispositivo',
        };
      }

      // Test dell'autenticazione biometrica
      const testResult = await this.authenticateWithBiometric('Test di configurazione');
      if (!testResult.success) {
        return {
          success: false,
          error: testResult.error || 'Test di autenticazione biometrica fallito',
        };
      }

      // Salva la preferenza
      await SecureStore.setItemAsync(this.STORAGE_KEYS.BIOMETRIC_ENABLED, 'true');
      await SecureStore.setItemAsync(this.STORAGE_KEYS.BIOMETRIC_SETUP_COMPLETED, 'true');
      
      console.log('✅ Biometric authentication enabled');
      return { success: true };
    } catch (error) {
      console.error('Error enabling biometric auth:', error);
      return {
        success: false,
        error: 'Errore durante l\'abilitazione dell\'autenticazione biometrica',
      };
    }
  }

  /**
   * Disabilita l'autenticazione biometrica
   */
  static async disableBiometric(): Promise<{ success: boolean; error?: string }> {
    try {
      await Promise.all([
        SecureStore.deleteItemAsync(this.STORAGE_KEYS.BIOMETRIC_ENABLED),
        SecureStore.deleteItemAsync(this.STORAGE_KEYS.BIOMETRIC_CREDENTIALS),
        SecureStore.deleteItemAsync(this.STORAGE_KEYS.BIOMETRIC_SETUP_COMPLETED),
      ]);
      
      console.log('✅ Biometric authentication disabled');
      return { success: true };
    } catch (error) {
      console.error('Error disabling biometric auth:', error);
      return {
        success: false,
        error: 'Errore durante la disabilitazione dell\'autenticazione biometrica',
      };
    }
  }

  /**
   * Autentica l'utente con biometria
   */
  static async authenticateWithBiometric(
    reason: string = 'Autenticazione richiesta'
  ): Promise<BiometricAuthResult> {
    try {
      const capabilities = await this.getCapabilities();
      
      if (!capabilities.isAvailable) {
        return {
          success: false,
          error: 'Autenticazione biometrica non disponibile',
        };
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: reason,
        cancelLabel: 'Annulla',
        fallbackLabel: 'Usa password',
        disableDeviceFallback: false,
      });

      if (result.success) {
        // Determina il tipo di biometria utilizzato
        let biometricType: 'fingerprint' | 'facial' | 'iris' | 'voice' | undefined;
        
        if (capabilities.supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
          biometricType = 'fingerprint';
        } else if (capabilities.supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
          biometricType = 'facial';
        } else if (capabilities.supportedTypes.includes(LocalAuthentication.AuthenticationType.IRIS)) {
          biometricType = 'iris';
        } else if (capabilities.supportedTypes.includes(LocalAuthentication.AuthenticationType.VOICE)) {
          biometricType = 'voice';
        }

        console.log('✅ Biometric authentication successful');
        return {
          success: true,
          biometricType,
        };
      } else {
        return {
          success: false,
          error: result.error || 'Autenticazione biometrica fallita',
        };
      }
    } catch (error) {
      console.error('Error during biometric authentication:', error);
      return {
        success: false,
        error: 'Errore durante l\'autenticazione biometrica',
      };
    }
  }

  /**
   * Salva le credenziali in modo sicuro per l'autenticazione biometrica
   */
  static async saveBiometricCredentials(
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const credentials = {
        email,
        password,
        timestamp: new Date().toISOString(),
      };

      await SecureStore.setItemAsync(
        this.STORAGE_KEYS.BIOMETRIC_CREDENTIALS,
        JSON.stringify(credentials)
      );

      console.log('✅ Biometric credentials saved securely');
      return { success: true };
    } catch (error) {
      console.error('Error saving biometric credentials:', error);
      return {
        success: false,
        error: 'Errore durante il salvataggio delle credenziali',
      };
    }
  }

  /**
   * Recupera le credenziali salvate
   */
  static async getBiometricCredentials(): Promise<{
    email?: string;
    password?: string;
    timestamp?: string;
  }> {
    try {
      const credentials = await SecureStore.getItemAsync(this.STORAGE_KEYS.BIOMETRIC_CREDENTIALS);
      if (credentials) {
        return JSON.parse(credentials);
      }
      return {};
    } catch (error) {
      console.error('Error retrieving biometric credentials:', error);
      return {};
    }
  }

  /**
   * Verifica se l'utente può utilizzare l'autenticazione biometrica
   */
  static async canUseBiometric(): Promise<boolean> {
    try {
      const [capabilities, isEnabled] = await Promise.all([
        this.getCapabilities(),
        this.isBiometricEnabled(),
      ]);

      return capabilities.isAvailable && isEnabled;
    } catch (error) {
      console.error('Error checking biometric usability:', error);
      return false;
    }
  }

  /**
   * Ottiene il tipo di biometria supportato dal dispositivo
   */
  static async getSupportedBiometricType(): Promise<string> {
    try {
      const capabilities = await this.getCapabilities();
      
      if (capabilities.supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        return Platform.OS === 'ios' ? 'Face ID' : 'Riconoscimento facciale';
      } else if (capabilities.supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        return Platform.OS === 'ios' ? 'Touch ID' : 'Impronta digitale';
      } else if (capabilities.supportedTypes.includes(LocalAuthentication.AuthenticationType.IRIS)) {
        return 'Riconoscimento iride';
      } else if (capabilities.supportedTypes.includes(LocalAuthentication.AuthenticationType.VOICE)) {
        return 'Riconoscimento vocale';
      }
      
      return 'Autenticazione biometrica';
    } catch (error) {
      console.error('Error getting biometric type:', error);
      return 'Autenticazione biometrica';
    }
  }

  /**
   * Ottiene le statistiche dell'utilizzo biometrico
   */
  static async getBiometricStats(): Promise<{
    isEnabled: boolean;
    isAvailable: boolean;
    supportedTypes: string[];
    lastUsed?: string;
  }> {
    try {
      const [capabilities, isEnabled, credentials] = await Promise.all([
        this.getCapabilities(),
        this.isBiometricEnabled(),
        this.getBiometricCredentials(),
      ]);

      return {
        isEnabled,
        isAvailable: capabilities.isAvailable,
        supportedTypes: capabilities.supportedTypes.map(type => {
          switch (type) {
            case LocalAuthentication.AuthenticationType.FINGERPRINT:
              return 'Fingerprint';
            case LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION:
              return 'Facial Recognition';
            case LocalAuthentication.AuthenticationType.IRIS:
              return 'Iris';
            case LocalAuthentication.AuthenticationType.VOICE:
              return 'Voice';
            default:
              return 'Unknown';
          }
        }),
        lastUsed: credentials.timestamp,
      };
    } catch (error) {
      console.error('Error getting biometric stats:', error);
      return {
        isEnabled: false,
        isAvailable: false,
        supportedTypes: [],
      };
    }
  }

  /**
   * Authenticate using biometrics
   */
  static async authenticate(): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Autenticazione richiesta',
        cancelLabel: 'Annulla',
        fallbackLabel: 'Usa password',
        disableDeviceFallback: false,
      });

      if (result.success) {
        console.log('✅ Biometric authentication successful');
        return { success: true };
      } else {
        console.log('❌ Biometric authentication failed:', result.error);
        return { success: false, error: result.error || 'Autenticazione fallita' };
      }
    } catch (error) {
      console.error('Error during biometric authentication:', error);
      return { success: false, error: 'Errore durante l\'autenticazione biometrica' };
    }
  }
}
