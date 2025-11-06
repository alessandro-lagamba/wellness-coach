import { Platform, Alert, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppleHealthKit, { HealthValue, HealthKitPermissions } from 'react-native-health';

// Import Health Connect statico e semplice
let HealthConnect: any = null;
if (Platform.OS === 'android') {
  try {
    HealthConnect = require('react-native-health-connect');
    // Se esporta tramite default, usalo
    if (HealthConnect && HealthConnect.default) {
      HealthConnect = HealthConnect.default;
    }
  } catch (error) {
    console.warn('Health Connect library not available:', error);
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
    {
      id: 'mindfulness',
      name: 'Mindfulness',
      description: 'Monitora sessioni di meditazione e rilassamento',
      category: 'mindfulness',
      required: false,
      granted: false,
      icon: '🧘',
    },
  ];

  /** True se tutti i permessi required sono concessi */
  static async hasAllRequiredPermissions(): Promise<boolean> {
    const granted = await this.getGrantedPermissions();
    const requiredIds = this.HEALTH_PERMISSIONS.filter(p => p.required).map(p => p.id);
    return requiredIds.every(id => granted.includes(id));
  }

  /**
   * Verifica la disponibilità di HealthKit/Health Connect
   */
  static async checkHealthAvailability(): Promise<{
    isHealthKitAvailable: boolean;
    isGoogleFitAvailable: boolean;
  }> {
    try {
      if (Platform.OS === 'ios') {
        return new Promise((resolve) => {
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
        return false;
      }
      
      // Usa getSdkStatus() invece di isAvailable() che non esiste
      const status = await HealthConnect.getSdkStatus();
      
      // Verifica se SDK_AVAILABLE è disponibile come costante
      // Altrimenti verifica che lo status sia un valore positivo
      if (HealthConnect.SdkAvailabilityStatus) {
        return status === HealthConnect.SdkAvailabilityStatus.SDK_AVAILABLE;
      }
      
      // Fallback: se getSdkStatus restituisce un numero, SDK_AVAILABLE è tipicamente 1 o 2
      // Status 1 = SDK_AVAILABLE, Status 2 = SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED, etc.
      return status === 1 || status === 'SDK_AVAILABLE' || status === true;
    } catch (error) {
      console.warn('⚠️ Error checking Health Connect availability:', error);
      // Fallback ottimistico: prova comunque a inizializzare
      try {
        if (HealthConnect && HealthConnect.initialize && typeof HealthConnect.initialize === 'function') {
          await HealthConnect.initialize();
          return true;
        }
      } catch (initError) {
        // Se l'inizializzazione fallisce, Health Connect non è disponibile
        return false;
      }
      return false;
    }
  }

  /**
   * Richiede i permessi di Health Connect su Android - VERSIONE CORRETTA
   */
  private static async requestHealthConnectPermissions(
    permissionIds: string[]
  ): Promise<{ success: boolean; granted: string[]; denied: string[] }> {
    try {
      // Debug: verifica che HealthConnect sia caricato
      console.log('🔍 HealthConnect check:', {
        PlatformOS: Platform.OS,
        hasHC,
        HealthConnect: !!HealthConnect,
        HealthConnectKeys: HealthConnect ? Object.keys(HealthConnect).slice(0, 10) : [],
      });
      
      if (Platform.OS !== 'android' || !hasHC || !HealthConnect) {
        console.error('❌ HealthConnect not available:', {
          PlatformOS: Platform.OS,
          hasHC,
          HealthConnect: !!HealthConnect,
        });
        
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
          denied: permissionIds,
        };
      }

      // 1) Verifica disponibilità con isAvailable()
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
          denied: permissionIds,
        };
      }

      // 2) Inizializza Health Connect (CRITICO)
      if (HealthConnect.initialize && typeof HealthConnect.initialize === 'function') {
        try {
          console.log('🔧 Initializing Health Connect...');
          await HealthConnect.initialize();
          console.log('✅ Health Connect initialized');
        } catch (initError) {
          console.warn('⚠️ Health Connect initialization failed:', initError);
        }
      }

      // RIMOSSO: la revoca forzata causava richieste multiple e UX pessima

      // 4) Converte gli ID permessi nei tipi Health Connect
      const toRecordType = (id: string) => this.getHealthConnectPermissionType(id);
      const permissions = permissionIds.map(id => ({
        recordType: toRecordType(id),
        accessType: 'read' as const,
      }));

      console.log('📋 Requesting permissions:', permissions);

      // 5) APPROCCIO CRITICO: Forza la registrazione dell'app PRIMA di requestPermission
      // Health Connect registra l'app SOLO quando viene fatto un tentativo di lettura
      console.log('🔍 STEP 1: Forcing app registration with test read...');
      let appRegistered = false;
      try {
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const timeRangeFilter = {
          operator: 'BETWEEN' as const,
          startTime: yesterday.toISOString(),
          endTime: now.toISOString(),
        };
        
        if (HealthConnect.readRecords && typeof HealthConnect.readRecords === 'function') {
          try {
            // Tenta di leggere Steps - questo DOVREBBE registrare l'app
            await HealthConnect.readRecords('Steps', { timeRangeFilter });
            console.log('✅ Test read succeeded - permissions might already be granted!');
            appRegistered = true;
          } catch (readError: any) {
            // SecurityException è ATTESO e NECESSARIO - questo registra l'app
            const errorMessage = readError?.message || '';
            const errorString = JSON.stringify(readError);
            
            if (errorMessage.includes('SecurityException') || 
                errorMessage.includes('permission') ||
                errorMessage.includes('not granted') ||
                errorString.includes('SecurityException') ||
                errorString.includes('permission')) {
              console.log('✅ SecurityException caught - app registration triggered!');
              console.log('✅ Error details:', errorMessage);
              appRegistered = true;
            } else {
              console.warn('⚠️ Unexpected read error (app might not be registered):', readError);
            }
          }
        }
      } catch (testReadError) {
        console.warn('⚠️ Test read failed:', testReadError);
      }

      // 6) Se l'app è registrata, aspetta e poi PROVA ad aprire Health Connect PRIMA di requestPermission
      // Questo potrebbe essere necessario per alcuni dispositivi/versioni di Health Connect
      if (appRegistered) {
        console.log('⏳ Waiting for Health Connect to process registration...');
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // PROVA: Apri Health Connect alle impostazioni dell'app PRIMA di chiamare requestPermission
        // Alcuni dispositivi richiedono che Health Connect sia "sveglio" per mostrare il dialog
        console.log('🔧 Attempting to open Health Connect to app settings before requesting permissions...');
        try {
          // Apri Health Connect alle impostazioni dell'app (non bloccante)
          if (HealthConnect.openHealthConnectSettings && typeof HealthConnect.openHealthConnectSettings === 'function') {
            HealthConnect.openHealthConnectSettings().catch(() => {
              // Ignora errori, è solo un tentativo
            });
          }
          // Aspetta un po' per dare tempo a Health Connect di aprirsi
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (openError) {
          console.warn('⚠️ Could not pre-open Health Connect:', openError);
        }
      }

      // 7) ORA chiedi i permessi - l'app DOVREBBE essere registrata
      let result: any = [];
      let dialogShown = false;
      
      if (!HealthConnect.requestPermission || typeof HealthConnect.requestPermission !== 'function') {
        Alert.alert('Errore', 'requestPermission non disponibile');
        return { success: false, granted: [], denied: permissionIds };
      }

      // 8) CHIAMATA CRITICA: requestPermission
      // Se restituisce array vuoto, significa che Health Connect NON mostra il dialog
      // Questo è un problema noto con alcune versioni di Health Connect o dispositivi
      try {
        console.log('📋 STEP 2: Calling requestPermission (app should be registered now)...');
        console.log('📋 Permissions being requested:', JSON.stringify(permissions, null, 2));
        
        result = await HealthConnect.requestPermission(permissions);
        
        console.log('📋 Request result:', JSON.stringify(result, null, 2));
        console.log('📋 Is array?', Array.isArray(result));
        console.log('📋 Length:', Array.isArray(result) ? result.length : 'N/A');
        
        if (Array.isArray(result) && result.length > 0) {
          dialogShown = true;
          console.log('✅ Dialog shown! Permissions granted:', result);
        } else if (Array.isArray(result) && result.length === 0) {
          console.log('❌ CRITICAL: Empty array returned - dialog NOT shown');
          console.log('❌ This is a known issue with Health Connect on some devices/versions');
          console.log('❌ The dialog will NOT appear automatically');
          console.log('❌ User must manually grant permissions in Health Connect settings');
          
          // Il dialog NON apparirà automaticamente - dobbiamo aprire Health Connect manualmente
          // Questo è un limite di Health Connect su alcuni dispositivi/versioni
        } else {
          console.error('❌ Unexpected result type:', typeof result, result);
        }
      } catch (requestError: any) {
        console.error('❌ Error requesting permissions:');
        console.error('❌ Error message:', requestError?.message);
        console.error('❌ Full error:', JSON.stringify(requestError, Object.getOwnPropertyNames(requestError), 2));
      }

      // 7) Se ancora il dialog non è stato mostrato, apri Health Connect
      // Ora l'app DOVREBBE essere registrata dopo il test read
      if (!dialogShown) {
        console.log('📋 Dialog still not shown. Opening Health Connect - app should appear in list now.');
        
        Alert.alert(
          'Apri Health Connect',
          'L\'app è stata registrata in Health Connect.\n\n' +
          'Ora:\n\n' +
          '1. Cerca "Wellness Coach" nella lista delle app\n' +
          '2. Se non lo trovi, scrolla verso il basso o cerca nella sezione "Accesso non consentito"\n' +
          '3. Tocca su "Wellness Coach"\n' +
          '4. Attiva "Consenti tutto" OPPURE abilita manualmente:\n' +
          '   • Passi (Steps)\n' +
          '   • Frequenza cardiaca (Heart Rate)\n' +
          '   • Sonno (Sleep Session)\n\n' +
          'Poi torna nell\'app e clicca "Ricarica permessi" - i permessi saranno attivi automaticamente!',
          [
            {
              text: 'Apri Health Connect',
              onPress: async () => {
                await this.openHealthSettings();
              },
            },
            { text: 'OK', style: 'cancel' },
          ]
        );
        
        // Apri Health Connect automaticamente
        setTimeout(async () => {
          await this.openHealthSettings();
        }, 500);
        
        return {
          success: false,
          granted: [],
          denied: permissionIds,
        };
      }

      // 8) Se il dialog è stato mostrato, verifica i permessi concessi
      // Continua con il codice esistente per verificare i permessi

      // 8) Verifica i permessi concessi DOPO la richiesta (importante: alcune versioni non ritornano tutto in requestPermission)
      let grantedNow: string[] = [];
      if (HealthConnect.getGrantedPermissions && typeof HealthConnect.getGrantedPermissions === 'function') {
        try {
          const recheck = await HealthConnect.getGrantedPermissions();
          if (Array.isArray(recheck)) {
            grantedNow = recheck
              .map((g: any) => typeof g === 'string' ? g : g.recordType)
              .filter(Boolean);
            console.log('📋 Granted permissions after request:', grantedNow);
          }
        } catch (error) {
          console.warn('⚠️ Could not recheck granted permissions:', error);
        }
      }

      // 9) Unisci e filtra sui permessi richiesti
      const grantedSet = new Set(grantedNow);
      const requestedTypes = new Set(permissions.map(p => p.recordType));
      const finalGrantedTypes = Array.from(grantedSet).filter(t => requestedTypes.has(t));

      // 10) Converti back ai nostri ID
      const grantedIds = permissionIds.filter(id => finalGrantedTypes.includes(toRecordType(id)));
      const deniedIds = permissionIds.filter(id => !grantedIds.includes(id));

      // 11) Salva i permessi concessi
      if (grantedIds.length > 0) {
        await this.saveGrantedPermissions(grantedIds);
        console.log('✅ Permessi concessi:', grantedIds.join(', '));
        
        // 11) Fai una lettura di test DOPO aver ottenuto i permessi (per far apparire l'app in Health Connect)
        await this.performTestRead(grantedIds);
      } else {
        console.log('⚠️ Nessun permesso concesso');
      }

      return {
        success: grantedIds.length > 0,
        granted: grantedIds,
        denied: deniedIds,
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
      const permissions: any = {};
      
      // Mappa i permessi richiesti
      permissionIds.forEach(id => {
        const permissionType = this.getHealthKitPermissionType(id);
        if (permissionType) {
          permissions[permissionType] = {
            read: [permissionType],
            write: [],
          };
        }
      });

      return new Promise((resolve) => {
        AppleHealthKit.initHealthKit(permissions, (error: string) => {
          if (error) {
            console.error('Error requesting HealthKit permissions:', error);
            resolve({
              success: false,
              granted: [],
              denied: permissionIds,
            });
          } else {
            // Salva i permessi concessi
            this.saveGrantedPermissions(permissionIds);
            resolve({
              success: true,
              granted: permissionIds,
              denied: [],
            });
          }
        });
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
      'hrv': 'HeartRateVariabilityRmssd', // CORRETTO: deve essere HeartRateVariabilityRmssd, non HeartRateVariability
      'blood_pressure': 'BloodPressure',
      'weight': 'Weight',
      'body_fat': 'BodyFat',
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
            
            if (Array.isArray(healthConnectGranted) && healthConnectGranted.length > 0) {
              const grantedIds: string[] = [];
              
              healthConnectGranted.forEach((item: any) => {
                const recordType = typeof item === 'string' 
                  ? item 
                  : (item.recordType || item.type || '');
                
                const idMapping: { [key: string]: string } = {
                  'Steps': 'steps',
                  'HeartRate': 'heart_rate',
                  'SleepSession': 'sleep',
                  'HeartRateVariabilityRmssd': 'hrv', // CORRETTO: deve corrispondere al tipo richiesto
                  'HeartRateVariability': 'hrv', // Manteniamo anche il vecchio nome per retrocompatibilità
                  'BloodPressure': 'blood_pressure',
                  'Weight': 'weight',
                  'BodyFat': 'body_fat',
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
    if (Platform.OS !== 'android' || !hasHC || !HealthConnect) {
      console.warn('⚠️ Cannot open Health Connect settings: not available');
      return;
    }

    console.log('🔧 Opening Health Connect settings...');

    try {
      // Prova prima il metodo nativo se disponibile
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
