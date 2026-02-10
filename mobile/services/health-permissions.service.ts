import { Platform, Alert, Linking, NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 🔥 CRITICAL FIX: In Release builds with Hermes, react-native-health's Object.assign
// doesn't copy non-enumerable native methods. We MUST use NativeModules directly.
let AppleHealthKit: any = null;
let HealthKitConstants: any = null; // 🆕 Separate reference for Constants only
let HealthConnect: any = null;

// 🔥 SINGLE SOURCE OF TRUTH: Helper function to resolve the native module
const getHealthKitNativeModule = (): any => {
  return (
    NativeModules?.RNAppleHealthKit ||
    NativeModules?.AppleHealthKit ||
    NativeModules?.RNHealthKit ||
    NativeModules?.AppleHealthKitModule ||
    null
  );
};

if (Platform.OS === 'ios') {
  try {
    // 🔥 FIX: Use NativeModules DIRECTLY for method calls (bypasses Object.assign issue)
    AppleHealthKit = getHealthKitNativeModule();

    // 🆕 Use the react-native-health wrapper ONLY for Constants (permissions enum)
    try {
      const HealthKitWrapper = require('react-native-health');
      const wrapper = HealthKitWrapper.default || HealthKitWrapper;
      HealthKitConstants = wrapper?.Constants ?? {};
      console.log('[HealthPermissions] ✅ Constants loaded from wrapper');
    } catch (constErr) {
      console.warn('[HealthPermissions] ⚠️ Could not load Constants from wrapper:', constErr);
      HealthKitConstants = {}; // Fallback to empty
    }

    if (AppleHealthKit && typeof AppleHealthKit.initHealthKit === 'function') {
      console.log('[HealthPermissions] ✅ AppleHealthKit native module loaded with methods');
    } else {
      console.warn('[HealthPermissions] ⚠️ AppleHealthKit native module missing or incomplete');
      console.log('[HealthPermissions] 🔍 Available NativeModules:', Object.keys(NativeModules || {}).filter(k => k.toLowerCase().includes('health')));
    }
  } catch (error) {
    console.error('[HealthPermissions] ❌ Failed to load HealthKit:', error);
  }
} else if (Platform.OS === 'android') {
  try {
    const HealthConnectModule = require('react-native-health-connect');
    HealthConnect = HealthConnectModule.default || HealthConnectModule;
  } catch (error) {
    console.error('[HealthPermissions] ❌ Failed to load react-native-health-connect:', error);
  }
}

// Verifica disponibilità semplice
const hasHC = Platform.OS === 'android' && !!HealthConnect;




export interface HealthPermission {
  id: string;
  name: string;
  description: string;
  category: 'activity' | 'vitals' | 'sleep' | 'nutrition' | 'mindfulness';
  required: boolean;
  granted: boolean;
  icon: string;
}

export interface HealthPermissionsState {
  isHealthKitAvailable: boolean;
  isGoogleFitAvailable: boolean;
  permissions: HealthPermission[];
  setupCompleted: boolean;
}

export class HealthPermissionsService {
  private static readonly STORAGE_KEYS = {
    PERMISSIONS_GRANTED: 'health_permissions_granted',
    SETUP_COMPLETED: 'health_permissions_setup_completed',
    LAST_SYNC: 'health_last_sync',
  };
  private static readonly HEALTH_CONNECT_PROVIDER_PACKAGE = 'com.google.android.apps.healthdata';
  private static healthConnectPermissionRequestInFlight: Promise<{ success: boolean; granted: string[]; denied: string[] }> | null = null;

  private static readonly HEALTH_PERMISSIONS: HealthPermission[] = [
    {
      id: 'steps',
      name: 'Passi',
      description: 'Monitora i tuoi passi giornalieri e l\'attività fisica',
      category: 'activity',
      required: true,
      granted: false,
      icon: '👟',
    },
    {
      id: 'heart_rate',
      name: 'Frequenza Cardiaca',
      description: 'Traccia la frequenza cardiaca e l\'HRV per il benessere',
      category: 'vitals',
      required: true,
      granted: false,
      icon: '❤️',
    },
    {
      id: 'hrv',
      name: 'Variabilità Frequenza Cardiaca (HRV)',
      description: 'Monitora i livelli di stress e recupero (essenziale per insight avanzati)',
      category: 'vitals',
      required: true,
      granted: false,
      icon: '💓',
    },
    {
      id: 'sleep',
      name: 'Sonno',
      description: 'Analizza la qualità e la durata del sonno',
      category: 'sleep',
      required: true,
      granted: false,
      icon: '😴',
    },
    {
      id: 'blood_pressure',
      name: 'Pressione Sanguigna',
      description: 'Monitora la pressione sanguigna se disponibile',
      category: 'vitals',
      required: false,
      granted: false,
      icon: '🩸',
    },
    {
      id: 'weight',
      name: 'Peso',
      description: 'Traccia il peso corporeo e le variazioni',
      category: 'vitals',
      required: false,
      granted: false,
      icon: '⚖️',
    },
    // Mindfulness, Hydration, Menstruation rimosse su richiesta: gestite internamente all'app
  ];

  /**
   * Verifica la disponibilità di HealthKit/Health Connect
   */
  static async checkHealthAvailability(): Promise<{
    isHealthKitAvailable: boolean;
    isGoogleFitAvailable: boolean;
  }> {
    try {
      if (Platform.OS === 'ios') {
        // 🔥 FIX: Verifica che la funzione isAvailable esista prima di chiamarla
        if (typeof AppleHealthKit?.isAvailable !== 'function') {
          console.warn('[HealthPermissions] AppleHealthKit.isAvailable is not available - HealthKit may not be properly linked');
          return {
            isHealthKitAvailable: false,
            isGoogleFitAvailable: false,
          };
        }

        return new Promise((resolve) => {
          try {
            AppleHealthKit.isAvailable((error: Object, results: boolean) => {
              if (error) {
                console.error('Error checking HealthKit availability:', error);
                resolve({
                  isHealthKitAvailable: false,
                  isGoogleFitAvailable: false,
                });
              } else {
                resolve({
                  isHealthKitAvailable: results,
                  isGoogleFitAvailable: false,
                });
              }
            });
          } catch (callbackError) {
            console.error('Error calling AppleHealthKit.isAvailable:', callbackError);
            resolve({
              isHealthKitAvailable: false,
              isGoogleFitAvailable: false,
            });
          }
        });
      } else {
        // Per Android, verifica Health Connect
        const isGoogleFitAvailable = await this.checkHealthConnectAvailability();
        return {
          isHealthKitAvailable: false,
          isGoogleFitAvailable,
        };
      }
    } catch (error) {
      console.error('Error checking health availability:', error);
      return {
        isHealthKitAvailable: false,
        isGoogleFitAvailable: false,
      };
    }
  }

  /**
   * Verifica la disponibilità di Health Connect su Android (DEPRECATO - usa quella alla riga 295)
   */
  private static async checkHealthConnectAvailabilityOld(): Promise<boolean> {
    // Questa funzione è stata sostituita da quella corretta che usa isAvailable()
    return false;
  }

  /**
   * Verifica se Health Connect è disponibile usando getSdkStatus()
   */
  private static async checkHealthConnectAvailability(): Promise<boolean> {
    if (Platform.OS !== 'android' || !hasHC) return false;

    try {
      if (!HealthConnect || typeof HealthConnect.getSdkStatus !== 'function') {
        console.warn('🔍 [HealthConnect] getSdkStatus is not available');
        return false;
      }

      // Usa getSdkStatus() invece di isAvailable() che non esiste
      const status = await HealthConnect.getSdkStatus();

      // Verifica se SDK_AVAILABLE è disponibile come costante
      if (HealthConnect.SdkAvailabilityStatus) {
        return status === HealthConnect.SdkAvailabilityStatus.SDK_AVAILABLE;
      }

      // Fallback: se getSdkStatus restituisce un numero, SDK_AVAILABLE è tipicamente 1 o 2 (Android 14+)
      // Status 1 = SDK_AVAILABLE, Status 2 = SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED, etc.
      // Su versioni precedenti o particolari, potrebbe essere una stringa
      const isAvailable = (status === 1 || status === 'SDK_AVAILABLE' || status === true);
      console.log('🔍 [HealthConnect] Availability check result (fallback):', isAvailable);
      return isAvailable;
    } catch (error) {
      console.warn('⚠️ [HealthConnect] Error checking availability:', error);
      // Fallback ottimistico: prova comunque a inizializzare
      try {
        if (HealthConnect && HealthConnect.initialize && typeof HealthConnect.initialize === 'function') {
          console.log('🔍 [HealthConnect] Attempting fallback initialization...');
          await HealthConnect.initialize();
          return true;
        }
      } catch (initError) {
        console.error('❌ [HealthConnect] Fallback initialization failed:', initError);
        return false;
      }
      return false;
    }
  }

  private static async getGrantedHealthConnectRecordTypes(): Promise<string[]> {
    if (Platform.OS !== 'android' || !hasHC || !HealthConnect) return [];
    if (!HealthConnect.getGrantedPermissions || typeof HealthConnect.getGrantedPermissions !== 'function') return [];

    try {
      const healthConnectGranted = await HealthConnect.getGrantedPermissions();
      if (!Array.isArray(healthConnectGranted)) return [];

      const granted = healthConnectGranted
        .map((item: any) => {
          if (typeof item === 'string') return item;
          return item?.recordType || item?.type || '';
        })
        .filter(Boolean);

      return Array.from(new Set(granted));
    } catch (error) {
      console.warn('⚠️ Could not get granted permissions from Health Connect:', error);
      return [];
    }
  }

  /**
   * Richiede i permessi di Health Connect su Android - VERSIONE CORRETTA
   */
  private static async requestHealthConnectPermissions(
    permissionIds: string[]
  ): Promise<{ success: boolean; granted: string[]; denied: string[] }> {
    if (this.healthConnectPermissionRequestInFlight) {
      console.log('ℹ️ Health Connect permission request already in progress, joining existing request');
      return this.healthConnectPermissionRequestInFlight;
    }

    const requestTask = (async (): Promise<{ success: boolean; granted: string[]; denied: string[] }> => {
      try {
        const requestedIds = Array.from(new Set(permissionIds));
        const toRecordType = (id: string) => this.getHealthConnectPermissionType(id);

        console.log('🔍 HealthConnect check:', {
          PlatformOS: Platform.OS,
          hasHC,
          HealthConnect: !!HealthConnect,
          HealthConnectKeys: HealthConnect ? Object.keys(HealthConnect).slice(0, 10) : [],
        });

        if (Platform.OS !== 'android' || !hasHC || !HealthConnect) {
          Alert.alert(
            'Health Connect non disponibile',
            'Health Connect non è disponibile su questo dispositivo.\n\n' +
            'Assicurati di:\n' +
            '1. Aver ricompilato l\'app dopo l\'installazione del plugin\n' +
            '2. Health Connect sia installato sul dispositivo\n' +
            '3. Il modulo nativo sia stato linkato correttamente'
          );
          return {
            success: false,
            granted: [],
            denied: requestedIds,
          };
        }

        const isAvailable = await this.checkHealthConnectAvailability();
        if (!isAvailable) {
          Alert.alert(
            'Health Connect non disponibile',
            'Health Connect non è disponibile sul tuo dispositivo.\n\n' +
            'Possibili soluzioni:\n' +
            '1. Verifica che Health Connect sia installato (Play Store)\n' +
            '2. Assicurati di avere uno schermo di blocco configurato (PIN/Pattern/Password)\n' +
            '3. Riavvia il dispositivo\n' +
            '4. Verifica che il dispositivo supporti Health Connect (Android 9+)'
          );
          return {
            success: false,
            granted: [],
            denied: requestedIds,
          };
        }

        if (HealthConnect.initialize && typeof HealthConnect.initialize === 'function') {
          try {
            await HealthConnect.initialize();
          } catch (initError) {
            console.warn('⚠️ Health Connect initialization failed:', initError);
          }
        }

        const permissions = requestedIds.map(id => ({
          recordType: toRecordType(id),
          accessType: 'read' as const,
        }));

        const requestedTypes = new Set(permissions.map((p: any) => p.recordType).filter(Boolean));
        if (requestedTypes.size === 0) {
          console.warn('⚠️ No valid Health Connect record types requested');
          return {
            success: false,
            granted: [],
            denied: requestedIds,
          };
        }

        const grantedBefore = new Set(await this.getGrantedHealthConnectRecordTypes());
        const alreadyGrantedIds = requestedIds.filter(id => grantedBefore.has(toRecordType(id)));

        if (alreadyGrantedIds.length === requestedIds.length) {
          await this.saveGrantedPermissions(alreadyGrantedIds);
          await this.markSetupCompleted();
          return {
            success: true,
            granted: alreadyGrantedIds,
            denied: [],
          };
        }

        if (!HealthConnect.requestPermission || typeof HealthConnect.requestPermission !== 'function') {
          Alert.alert('Errore', 'requestPermission non disponibile');
          return {
            success: false,
            granted: alreadyGrantedIds,
            denied: requestedIds.filter(id => !alreadyGrantedIds.includes(id)),
          };
        }

        console.log('📋 Requesting permissions:', permissions.map((p: any) => p.recordType));
        let requestError: any = null;

        try {
          const requestResult = await HealthConnect.requestPermission(permissions);
          const resultLength = Array.isArray(requestResult) ? requestResult.length : 'N/A';
          console.log('📋 requestPermission result length:', resultLength);
          if (Array.isArray(requestResult) && requestResult.length === 0) {
            console.log('⚠️ requestPermission returned empty array, rechecking granted permissions');
          }
        } catch (error: any) {
          requestError = error;
          console.error('❌ Error requesting Health Connect permissions:', error?.message || error);
        }

        await new Promise(resolve => setTimeout(resolve, 300));

        const grantedAfter = new Set(await this.getGrantedHealthConnectRecordTypes());
        const grantedIds = requestedIds.filter(id => grantedAfter.has(toRecordType(id)));
        const deniedIds = requestedIds.filter(id => !grantedIds.includes(id));

        if (grantedIds.length > 0) {
          await this.saveGrantedPermissions(grantedIds);
          await this.markSetupCompleted();
          await this.performTestRead(grantedIds);

          if (deniedIds.length > 0) {
            console.log('⚠️ Some Health Connect permissions are still denied:', deniedIds);
          }

          return {
            success: true,
            granted: grantedIds,
            denied: deniedIds,
          };
        }

        const details = requestError?.message ? `\n\nDettaglio tecnico: ${requestError.message}` : '';
        Alert.alert(
          'Permessi non concessi',
          'Health Connect non ha ancora concesso i permessi richiesti.\n\n' +
          'Apri Health Connect e abilita i permessi per questa app (Passi, Frequenza cardiaca, HRV, Sonno), poi torna qui e riprova.' +
          details,
          [
            {
              text: 'Apri Health Connect',
              onPress: async () => {
                await this.openHealthSettings();
              },
            },
            { text: 'Annulla', style: 'cancel' },
          ]
        );

        return {
          success: false,
          granted: [],
          denied: requestedIds,
        };
      } catch (error) {
        console.error('Error requesting Health Connect permissions:', error);
        Alert.alert(
          'Errore',
          'Si è verificato un errore durante la richiesta dei permessi: ' + (error instanceof Error ? error.message : 'Unknown error')
        );

        return {
          success: false,
          granted: [],
          denied: permissionIds,
        };
      }
    })();

    this.healthConnectPermissionRequestInFlight = requestTask;

    try {
      return await requestTask;
    } finally {
      this.healthConnectPermissionRequestInFlight = null;
    }
  }


  /**
   * Ottiene lo stato attuale dei permessi di salute
   */
  static async getHealthPermissionsState(): Promise<HealthPermissionsState> {
    try {
      const [availability, grantedPermissions, setupCompleted] = await Promise.all([
        this.checkHealthAvailability(),
        this.getGrantedPermissions(),
        this.isSetupCompleted(),
      ]);

      const permissions = this.HEALTH_PERMISSIONS.map(permission => ({
        ...permission,
        granted: grantedPermissions.includes(permission.id),
      }));

      return {
        isHealthKitAvailable: availability.isHealthKitAvailable,
        isGoogleFitAvailable: availability.isGoogleFitAvailable,
        permissions,
        setupCompleted,
      };
    } catch (error) {
      console.error('Error getting health permissions state:', error);
      return {
        isHealthKitAvailable: false,
        isGoogleFitAvailable: false,
        permissions: this.HEALTH_PERMISSIONS,
        setupCompleted: false,
      };
    }
  }

  /**
   * Richiede i permessi di salute
   */
  static async requestHealthPermissions(
    permissionIds: string[]
  ): Promise<{ success: boolean; granted: string[]; denied: string[] }> {
    try {
      if (Platform.OS === 'ios') {
        return await this.requestHealthKitPermissions(permissionIds);
      } else {
        return await this.requestHealthConnectPermissions(permissionIds);
      }
    } catch (error) {
      console.error('Error requesting health permissions:', error);
      return {
        success: false,
        granted: [],
        denied: permissionIds,
      };
    }
  }

  /**
   * Richiede i permessi di HealthKit su iOS
   */
  private static async requestHealthKitPermissions(
    permissionIds: string[]
  ): Promise<{ success: boolean; granted: string[]; denied: string[] }> {
    try {
      // 🔥 FIX: Verifica che AppleHealthKit e initHealthKit siano disponibili
      if (!AppleHealthKit || typeof AppleHealthKit.initHealthKit !== 'function') {
        console.warn('[HealthPermissions] AppleHealthKit.initHealthKit is not available - HealthKit may not be properly linked');
        // 🔥 FIX: NON salvare i permessi se HealthKit non è disponibile
        // Questo è il comportamento corretto per iOS Simulator o se la libreria non è linkata
        return {
          success: false,
          granted: [],
          denied: permissionIds,
        };
      }

      // 🔥 FIX: Formato corretto per initHealthKit
      // Deve essere { permissions: { read: [...], write: [...] } }
      const readPermissions: any[] = [];
      const writePermissions: any[] = [];

      // Mappa i permessi richiesti
      permissionIds.forEach(id => {
        const permissionType = this.getHealthKitPermissionType(id);
        if (permissionType) {
          readPermissions.push(permissionType as any);
          // Aggiungi anche write per alcuni tipi se necessario
        }
      });

      const permissions: any = {
        permissions: {
          read: readPermissions,
          write: writePermissions,
        },
      };

      console.log('[HealthKit] Requesting permissions with:', JSON.stringify(permissions));

      return new Promise((resolve) => {
        try {
          AppleHealthKit.initHealthKit(permissions, async (error: string) => {
            if (error) {
              console.error('Error requesting HealthKit permissions:', error);
              resolve({
                success: false,
                granted: [],
                denied: permissionIds,
              });
              return;
            }

            console.log('[HealthKit] initHealthKit completed. iOS does not tell which permissions were granted.');

            // ✅ UX FIX: salva comunque i permessi richiesti come "abilitati"
            // (lo user potrà ancora negare qualcosa, ma almeno la UI non resta bloccata su "waiting-permission")
            await this.saveGrantedPermissions(permissionIds);

            // opzionale ma utile: marca setup completato
            await this.markSetupCompleted();

            resolve({
              success: true,
              granted: permissionIds,  // <- ora hasAnyHealthPermission diventa true
              denied: [],
            });
          });
        } catch (initError) {
          console.warn('[HealthPermissions] initHealthKit call failed:', initError);
          // 🔥 FIX: NON salvare i permessi se la chiamata fallisce
          resolve({
            success: false,
            granted: [],
            denied: permissionIds,
          });
        }
      });
    } catch (error) {
      console.error('Error requesting HealthKit permissions:', error);
      return {
        success: false,
        granted: [],
        denied: permissionIds,
      };
    }
  }


  /**
   * Esegue una lettura di test per registrare l'app in Health Connect
   * Questo è necessario perché Health Connect mostra le app solo dopo che hanno letto almeno un record
   */
  private static async performTestRead(grantedPermissionIds: string[]): Promise<void> {
    if (Platform.OS !== 'android' || !hasHC || !HealthConnect || grantedPermissionIds.length === 0) {
      return;
    }

    try {
      if (!HealthConnect.readRecords || typeof HealthConnect.readRecords !== 'function') {
        console.warn('⚠️ HealthConnect.readRecords is not available');
        return;
      }

      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const timeRangeFilter = {
        operator: 'BETWEEN' as const,
        startTime: yesterday.toISOString(),
        endTime: now.toISOString(),
      };

      let readCount = 0;

      // Leggi almeno un tipo di dato per ogni permesso concesso
      for (const permissionId of grantedPermissionIds) {
        const recordType = this.getHealthConnectPermissionType(permissionId);

        try {
          console.log(`📖 Performing test read for ${recordType}...`);
          const testRead = await HealthConnect.readRecords(recordType, { timeRangeFilter });

          if (testRead !== undefined) {
            readCount++;
            console.log(`✅ Test read successful for ${recordType}`);
          }
        } catch (readError) {
          // Non bloccare se la lettura fallisce
          console.warn(`⚠️ Test read for ${recordType} failed (this is OK):`, readError);
        }
      }

      if (readCount > 0) {
        console.log(`✅ Performed ${readCount} test read(s) - app should now appear in Health Connect`);
      }
    } catch (error) {
      console.warn('⚠️ Could not perform test reads:', error);
    }
  }

  /**
   * Converte l'ID del permesso nel tipo HealthKit (iOS)
   */
  private static getHealthKitPermissionType(permissionId: string): any {
    const permissionMap: { [key: string]: any } = {
      'steps': 'StepCount',
      'heart_rate': 'HeartRate',
      'sleep': 'SleepAnalysis',
      'hrv': 'HeartRateVariability', // HealthKit usa HeartRateVariability (non Rmssd)
      'blood_pressure': 'BloodPressure',
      'weight': 'Weight',
      'body_fat': 'BodyFatPercentage',
      'hydration': 'Water',
      'mindfulness': 'MindfulSession',
      'menstruation': 'MenstruationPeriod', // 🆕
    };
    return permissionMap[permissionId] || permissionId;
  }

  /**
   * Converte l'ID del permesso nel tipo Health Connect
   */
  private static getHealthConnectPermissionType(permissionId: string): string {
    const permissionMap: { [key: string]: string } = {
      'steps': 'Steps',
      'heart_rate': 'HeartRate',
      'sleep': 'SleepSession',
      'hrv': 'HeartRateVariabilityRmssd',
      'blood_pressure': 'BloodPressure',
      'weight': 'Weight',
      'body_fat': 'BodyFat',
      'menstruation': 'MenstruationPeriod',
    };
    return permissionMap[permissionId] || permissionId;
  }

  /**
   * Salva i permessi concessi in AsyncStorage
   */
  private static async saveGrantedPermissions(granted: string[]): Promise<void> {
    try {
      await AsyncStorage.setItem(
        this.STORAGE_KEYS.PERMISSIONS_GRANTED,
        JSON.stringify(granted)
      );
      console.log('✅ Saved granted permissions:', granted);
    } catch (error) {
      console.error('Error saving granted permissions:', error);
    }
  }

  /**
   * Ottiene i permessi concessi
   */
  static async getGrantedPermissions(): Promise<string[]> {
    try {
      // 🔥 FIX: Per iOS, verifica che HealthKit sia disponibile prima di restituire permessi
      if (Platform.OS === 'ios') {
        if (!AppleHealthKit || typeof AppleHealthKit.isAvailable !== 'function') {
          // HealthKit non disponibile - cancella eventuali permessi salvati incorrettamente
          await AsyncStorage.removeItem(this.STORAGE_KEYS.PERMISSIONS_GRANTED);
          return [];
        }

        // Verifica disponibilità HealthKit
        const isAvailable = await new Promise<boolean>((resolve) => {
          try {
            AppleHealthKit.isAvailable((error: any, results: boolean) => {
              resolve(!error && results === true);
            });
          } catch {
            resolve(false);
          }
        });

        if (!isAvailable) {
          // HealthKit non disponibile - cancella eventuali permessi salvati incorrettamente
          await AsyncStorage.removeItem(this.STORAGE_KEYS.PERMISSIONS_GRANTED);
          return [];
        }

        // HealthKit disponibile - leggi da AsyncStorage
        const permissions = await AsyncStorage.getItem(this.STORAGE_KEYS.PERMISSIONS_GRANTED);
        return permissions ? JSON.parse(permissions) : [];
      }

      if (Platform.OS === 'android' && hasHC && HealthConnect) {
        try {
          if (HealthConnect.initialize && typeof HealthConnect.initialize === 'function') {
            try {
              await HealthConnect.initialize();
            } catch (initError) {
              // Già inizializzato o errore - continua comunque
            }
          }

          if (HealthConnect.getGrantedPermissions && typeof HealthConnect.getGrantedPermissions === 'function') {
            const healthConnectGranted = await HealthConnect.getGrantedPermissions();
            // Log only record types for brevity
            if (__DEV__) console.log('📝 Health Connect permissions:', healthConnectGranted.map((p: any) => p.recordType || p));

            if (Array.isArray(healthConnectGranted) && healthConnectGranted.length > 0) {
              const grantedIds: string[] = [];

              healthConnectGranted.forEach((item: any) => {
                const recordType = typeof item === 'string'
                  ? item
                  : (item.recordType || item.type || '');

                const idMapping: { [key: string]: string } = {
                  'Steps': 'steps',
                  'StepsRecord': 'steps',
                  'HeartRate': 'heart_rate',
                  'HeartRateRecord': 'heart_rate',
                  'SleepSession': 'sleep',
                  'SleepSessionRecord': 'sleep',
                  'HeartRateVariabilityRmssd': 'hrv',
                  'HeartRateVariabilityRmssdRecord': 'hrv',
                  'HeartRateVariability': 'hrv',
                  'HeartRateVariabilityRecord': 'hrv',
                  'BloodPressure': 'blood_pressure',
                  'BloodPressureRecord': 'blood_pressure',
                  'Weight': 'weight',
                  'WeightRecord': 'weight',
                  'BodyFat': 'body_fat',
                  'BodyFatRecord': 'body_fat',
                  'MenstruationPeriod': 'menstruation',
                  'MenstruationPeriodRecord': 'menstruation',
                };

                const permissionId = idMapping[recordType] || recordType.toLowerCase();
                if (permissionId && !grantedIds.includes(permissionId)) {
                  grantedIds.push(permissionId);
                }
              });

              await AsyncStorage.setItem(
                this.STORAGE_KEYS.PERMISSIONS_GRANTED,
                JSON.stringify(grantedIds)
              );

              return grantedIds;
            } else {
              // Array vuoto - cancella AsyncStorage
              await AsyncStorage.removeItem(this.STORAGE_KEYS.PERMISSIONS_GRANTED);
              return [];
            }
          }
        } catch (healthConnectError) {
          console.warn('⚠️ Could not check Health Connect permissions:', healthConnectError);
        }
      }

      // Fallback: leggi da AsyncStorage
      const permissions = await AsyncStorage.getItem(this.STORAGE_KEYS.PERMISSIONS_GRANTED);
      return permissions ? JSON.parse(permissions) : [];
    } catch (error) {
      console.error('Error getting granted permissions:', error);
      return [];
    }
  }

  /**
   * Marca il setup dei permessi come completato
   */
  static async markSetupCompleted(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.STORAGE_KEYS.SETUP_COMPLETED, 'true');
      await AsyncStorage.setItem(this.STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
    } catch (error) {
      console.error('Error marking setup as completed:', error);
    }
  }

  /**
   * Verifica se il setup è completato
   */
  static async isSetupCompleted(): Promise<boolean> {
    try {
      const completed = await AsyncStorage.getItem(this.STORAGE_KEYS.SETUP_COMPLETED);
      return completed === 'true';
    } catch (error) {
      return false;
    }
  }

  /**
   * Apre le impostazioni di Health Connect
   * IMPORTANTE: Cerca di aprire direttamente la pagina delle app o la pagina principale
   */
  static async openHealthSettings(): Promise<void> {
    // 🔥 iOS: Apri l'app Salute di Apple
    if (Platform.OS === 'ios') {
      try {
        // Prima prova ad aprire direttamente l'app Salute
        const canOpen = await Linking.canOpenURL('x-apple-health://');
        if (canOpen) {
          await Linking.openURL('x-apple-health://');
        } else {
          // Fallback alle impostazioni generiche dell'app
          await Linking.openSettings();
        }
      } catch (error) {
        console.warn('⚠️ Error opening Apple Health:', error);
        // Fallback alle impostazioni generiche
        try {
          await Linking.openSettings();
        } catch {
          // Ignore
        }
      }
      return;
    }

    // Android: gestisce Health Connect
    if (!hasHC || !HealthConnect) {
      console.warn('⚠️ Cannot open Health Connect settings: not available');
      return;
    }

    console.log('🔧 Opening Health Connect settings...');

    try {
      // 1) Prima prova la schermata di gestione dati (più mirata ai permessi dell'app)
      if (HealthConnect.openHealthConnectDataManagement && typeof HealthConnect.openHealthConnectDataManagement === 'function') {
        try {
          console.log('✅ Using HealthConnect.openHealthConnectDataManagement(provider)');
          await HealthConnect.openHealthConnectDataManagement(this.HEALTH_CONNECT_PROVIDER_PACKAGE);
          return;
        } catch (e) {
          console.warn('⚠️ openHealthConnectDataManagement(provider) failed:', e);
        }

        try {
          console.log('✅ Using HealthConnect.openHealthConnectDataManagement()');
          await HealthConnect.openHealthConnectDataManagement();
          return;
        } catch (e) {
          console.warn('⚠️ openHealthConnectDataManagement() failed:', e);
        }
      }

      // 2) Fallback: impostazioni Health Connect generiche
      if (HealthConnect.openHealthConnectSettings && typeof HealthConnect.openHealthConnectSettings === 'function') {
        try {
          console.log('✅ Using HealthConnect.openHealthConnectSettings()');
          await HealthConnect.openHealthConnectSettings();
          return;
        } catch (e) {
          console.warn('⚠️ openHealthConnectSettings failed:', e);
        }
      }

      const packageName = 'com.wellnesscoach.app';

      // Ordine di priorità: prima la pagina delle app, poi quella generica
      const intents = [
        // 1. Prova ad aprire direttamente la pagina dell'app (anche se non registrata)
        `intent://com.google.android.apps.healthconnect/settings/apps/${packageName}#Intent;scheme=android-app;action=android.intent.action.VIEW;end`,
        // 2. Prova con healthconnect:// schema
        `healthconnect://settings/apps/${packageName}`,
        // 3. Prova la pagina generica delle app
        'healthconnect://settings/apps',
        // 4. Prova con intent generico
        'intent://com.google.android.apps.healthconnect#Intent;scheme=android-app;end',
        // 5. Prova ad aprire Health Connect direttamente
        'intent://com.google.android.apps.healthconnect/settings#Intent;scheme=android-app;action=android.intent.action.VIEW;end',
      ];

      console.log('🔧 Trying to open Health Connect with intents...');

      for (let i = 0; i < intents.length; i++) {
        const intent = intents[i];
        try {
          console.log(`🔧 Trying intent ${i + 1}/${intents.length}: ${intent.substring(0, 80)}...`);
          const canOpen = await Linking.canOpenURL(intent);
          if (canOpen) {
            console.log(`✅ Intent ${i + 1} can be opened, opening...`);
            await Linking.openURL(intent);
            return;
          } else {
            console.log(`⚠️ Intent ${i + 1} cannot be opened`);
          }
        } catch (e) {
          console.warn(`⚠️ Intent ${i + 1} failed:`, e);
          continue;
        }
      }

      // Fallback: apri le impostazioni generiche
      console.log('⚠️ All intents failed, opening generic settings...');
      await Linking.openSettings();
    } catch (error) {
      console.error('❌ Error opening Health Connect settings:', error);
      try {
        await Linking.openSettings();
      } catch {
        // Ignore
      }
    }
  }

  /**
   * Resetta tutti i permessi
   */
  static async resetPermissions(): Promise<void> {
    try {
      await Promise.all([
        AsyncStorage.removeItem(this.STORAGE_KEYS.PERMISSIONS_GRANTED),
        AsyncStorage.removeItem(this.STORAGE_KEYS.SETUP_COMPLETED),
        AsyncStorage.removeItem(this.STORAGE_KEYS.LAST_SYNC),
      ]);
      console.log('🔄 Health permissions reset');
    } catch (error) {
      console.error('Error resetting permissions:', error);
    }
  }
}
