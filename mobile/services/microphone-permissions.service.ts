import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { Platform, Alert, Linking, PermissionsAndroid } from 'react-native';

export interface PermissionStatus {
  status: string;
  granted: boolean;
}

export class MicrophonePermissionsService {
  private static instance: MicrophonePermissionsService;

  public static getInstance(): MicrophonePermissionsService {
    if (!MicrophonePermissionsService.instance) {
      MicrophonePermissionsService.instance = new MicrophonePermissionsService();
    }
    return MicrophonePermissionsService.instance;
  }

  /**
   * Check current microphone permissions
   */
  async checkPermissions(): Promise<PermissionStatus> {
    try {
      console.log('🎤 Checking microphone permissions...');
      
      if (Platform.OS === 'android') {
        // Use PermissionsAndroid for Android
        const granted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
        console.log('🎤 Permission status:', granted ? 'granted' : 'denied');
        
        return {
          status: granted ? 'granted' : 'denied',
          granted: granted
        };
      } else {
        // For iOS, we'll assume granted for now (expo-speech-recognition handles iOS permissions)
        console.log('🎤 iOS platform - assuming permissions granted');
        return {
          status: 'granted',
          granted: true
        };
      }
    } catch (error) {
      console.error('❌ Error checking microphone permissions:', error);
      return {
        status: 'error',
        granted: false
      };
    }
  }

  /**
   * Request microphone permissions
   */
  async requestPermissions(): Promise<PermissionStatus> {
    try {
      console.log('🎤 Requesting microphone permissions...');
      
      if (Platform.OS === 'android') {
        // Use PermissionsAndroid for Android
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Permesso Microfono',
            message: 'L\'app ha bisogno di accedere al microfono per la chat vocale.',
            buttonNeutral: 'Chiedimi più tardi',
            buttonNegative: 'Annulla',
            buttonPositive: 'OK',
          }
        );
        
        const isGranted = granted === PermissionsAndroid.RESULTS.GRANTED;
        console.log('🎤 Permission request result:', isGranted ? 'granted' : 'denied');
        
        return {
          status: isGranted ? 'granted' : 'denied',
          granted: isGranted
        };
      } else {
        // For iOS, we'll assume granted for now
        console.log('🎤 iOS platform - assuming permissions granted');
        return {
          status: 'granted',
          granted: true
        };
      }
    } catch (error) {
      console.error('❌ Error requesting microphone permissions:', error);
      return {
        status: 'error',
        granted: false
      };
    }
  }

  /**
   * Request speech recognition permissions (iOS only)
   */
  async requestSpeechRecognitionPermissions(): Promise<PermissionStatus> {
    if (Platform.OS !== 'ios') {
      console.log('ℹ️ Speech recognition permissions only needed on iOS');
      return { status: 'not_needed', granted: true };
    }

    try {
      console.log('🎤 Requesting speech recognition permissions (iOS)...');
      
      // For iOS, we'll assume granted for now (expo-speech-recognition handles iOS permissions)
      console.log('🎤 iOS platform - assuming speech recognition permissions granted');
      return {
        status: 'granted',
        granted: true
      };
    } catch (error) {
      console.error('❌ Error requesting speech recognition permissions:', error);
      return {
        status: 'error',
        granted: false
      };
    }
  }

  /**
   * Check if all required permissions are granted
   */
  async hasAllPermissions(): Promise<boolean> {
    try {
      const micPermission = await this.checkPermissions();
      
      if (!micPermission.granted) {
        console.log('❌ Microphone permission not granted');
        return false;
      }

      // On iOS, also check speech recognition permission
      if (Platform.OS === 'ios') {
        const speechPermission = await this.requestSpeechRecognitionPermissions();
        if (!speechPermission.granted) {
          console.log('❌ Speech recognition permission not granted on iOS');
          return false;
        }
      }

      console.log('✅ All microphone permissions granted');
      return true;
    } catch (error) {
      console.error('❌ Error checking all permissions:', error);
      return false;
    }
  }

  /**
   * Request all required permissions
   */
  async requestAllPermissions(): Promise<boolean> {
    try {
      console.log('🎤 Requesting all microphone permissions...');
      
      // Request microphone permission
      const micPermission = await this.requestPermissions();
      if (!micPermission.granted) {
        console.log('❌ Microphone permission denied');
        return false;
      }

      // On iOS, also request speech recognition permission
      if (Platform.OS === 'ios') {
        const speechPermission = await this.requestSpeechRecognitionPermissions();
        if (!speechPermission.granted) {
          console.log('❌ Speech recognition permission denied on iOS');
          return false;
        }
      }

      console.log('✅ All microphone permissions granted');
      return true;
    } catch (error) {
      console.error('❌ Error requesting all permissions:', error);
      return false;
    }
  }

  /**
   * Get user-friendly permission status message
   */
  getPermissionStatusMessage(status: string): string {
    switch (status) {
      case 'granted':
        return 'Microfono autorizzato ✅';
      case 'denied':
        return 'Microfono negato ❌';
      case 'undetermined':
        return 'Permesso microfono non richiesto ⚠️';
      case 'not_needed':
        return 'Permessi non necessari su questa piattaforma ℹ️';
      case 'error':
        return 'Errore nel controllo permessi ❌';
      default:
        return `Stato sconosciuto: ${status} ❓`;
    }
  }

  /**
   * Show alert to user when permissions are denied
   */
  showPermissionDeniedAlert(): void {
    Alert.alert(
      'Permessi Microfono Richiesti',
      'Per utilizzare la chat vocale, devi autorizzare l\'accesso al microfono. Vai nelle Impostazioni per abilitare i permessi.',
      [
        {
          text: 'Annulla',
          style: 'cancel',
        },
        {
          text: 'Apri Impostazioni',
          onPress: () => {
            Linking.openSettings();
          },
        },
      ]
    );
  }
}

export default MicrophonePermissionsService;
