import { Platform } from 'react-native';
import {
  HealthData,
  HealthPermissions,
  HealthDataSyncResult,
  HealthDataServiceConfig,
  HealthMetricType
} from '../types/health.types';
import { HealthDataSyncService } from './health-data-sync.service';
import { AuthService } from './auth.service';

// Import health libraries
let AppleHealthKit: any = null;
let HealthConnect: any = null;

try {
  if (Platform.OS === 'ios') {
    // 🔥 FIX: Non usare .default - il modulo patchato esporta direttamente via module.exports
    AppleHealthKit = require('react-native-health');
    console.log('[HealthKit] ✅ AppleHealthKit module loaded successfully');
  } else if (Platform.OS === 'android') {
    // CORRETTO: Import come in health-permissions.service.ts
    HealthConnect = require('react-native-health-connect');
    // Se esporta tramite default, usalo
    if (HealthConnect && HealthConnect.default) {
      HealthConnect = HealthConnect.default;
    }
  }
} catch (error) {
  // 🔥 FIX: Solo errori critici in console
  console.error('❌ Health libraries not available:', error);
}

export class HealthDataService {
  private static instance: HealthDataService;
  private config: HealthDataServiceConfig;
  private isSyncInProgress: boolean = false;
  private lastSyncAt: number | null = null;
  private lastHealthData: HealthData | null = null; // 🔥 Memorizza l'ultimo dato sincronizzato
  private lastHealthDataSource: 'healthkit' | 'health_connect' | 'manual' | 'mock' | null = null; // 🔥 Memorizza la source dell'ultimo dato
  private permissions: HealthPermissions = {
    steps: false,
    heartRate: false,
    sleep: false,
    hrv: false,
    bloodPressure: false,
    weight: false,
    bodyFat: false,
    hydration: false,
    mindfulness: false,
    menstruation: false, // 🆕
  };
  private needsHrvPermission: boolean = false; // 🔥 Flag to force HRV permission request

  private constructor() {
    this.config = {
      enableHealthKit: Platform.OS === 'ios',
      enableHealthConnect: Platform.OS === 'android',
      syncInterval: 15, // 15 minutes
      maxRetries: 3,
      // 🔥 FIX: DISABILITATO mock data - vogliamo solo dati reali da HealthKit/Health Connect
      fallbackToMock: false,
    };
  }

  public static getInstance(): HealthDataService {
    if (!HealthDataService.instance) {
      HealthDataService.instance = new HealthDataService();
    }
    return HealthDataService.instance;
  }

  /**
   * Initialize health data service
   */
  async initialize(): Promise<boolean> {
    try {
      // 🔥 FIX: Rimuoviamo console.log eccessivi - manteniamo solo errori critici

      // Carica i permessi concessi se disponibili
      await this.refreshPermissions();

      // 🔥 FIX: If HRV is missing but we have other permissions, auto-request HRV
      if (this.needsHrvPermission && Platform.OS === 'android') {
        console.log('🔥 [HRV FIX] Auto-requesting HRV permission...');
        try {
          const { HealthPermissionsService } = await import('./health-permissions.service');
          // Request ALL permissions (unified) to ensure everything is granted at once
          await this.requestPermissions();
          // Refresh permissions again after request
          await this.refreshPermissions();
          this.needsHrvPermission = false;
        } catch (err) {
          console.error('❌ [HRV FIX] Failed to auto-request HRV:', err);
        }
      }

      if (Platform.OS === 'ios' && this.config.enableHealthKit) {
        return await this.initializeHealthKit();
      } else if (Platform.OS === 'android' && this.config.enableHealthConnect) {
        return await this.initializeHealthConnect();
      }

      // 🔥 FIX: Rimuoviamo console.log eccessivi
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize health data service:', error);
      return false;
    }
  }

  /**
   * 🔥 NUOVO: Getter per l'ultimo dato salute sincronizzato
   * Usato per verificare se i permessi iOS funzionano realmente
   */
  getLastHealthData(): HealthData | null {
    return this.lastHealthData;
  }

  /**
   * 🔥 NUOVO: Forza il refresh dei permessi da HealthPermissionsService
   * Utile dopo aver concesso nuovi permessi
   */
  async refreshPermissions(): Promise<void> {
    try {
      if (Platform.OS === 'android') {
        const { HealthPermissionsService } = await import('./health-permissions.service');

        // 🔥 Aspetta un breve momento per assicurarci che Health Connect abbia processato i permessi
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 🔥 Forza il refresh leggendo direttamente da Health Connect
        const grantedPermissions = await HealthPermissionsService.getGrantedPermissions();

        // 🔥 PERF: Removed verbose logging
        // console.log('🔄 Refreshed permissions from Health Connect:', grantedPermissions);

        // Aggiorna i permessi locali basandosi su quelli concessi
        const newPermissions = {
          steps: grantedPermissions.includes('steps'),
          heartRate: grantedPermissions.includes('heart_rate'),
          sleep: grantedPermissions.includes('sleep'),
          hrv: grantedPermissions.includes('hrv'),
          bloodPressure: grantedPermissions.includes('blood_pressure'),
          weight: grantedPermissions.includes('weight'),
          bodyFat: grantedPermissions.includes('body_fat'),
          hydration: false, // Not directly available
          mindfulness: false, // Not directly available
          menstruation: grantedPermissions.includes('menstruation'), // 🆕
        };

        // 🔥 CRITICO: Verifica se c'è stato un cambiamento nei permessi
        const hadPermissions = Object.values(this.permissions).some(Boolean);
        const hasPermissions = Object.values(newPermissions).some(Boolean);

        if (!hadPermissions && hasPermissions) {
          // 🔥 PERF: Removed verbose logging
          // console.log('✅ NEW PERMISSIONS DETECTED! Clearing cached data to force fresh sync');
          // 🔥 Reset dati cached per forzare una nuova sincronizzazione
          this.lastHealthData = null;
          this.lastHealthDataSource = null;
          this.lastSyncAt = null;
        }

        this.permissions = newPermissions;
        // 🔥 PERF: Removed verbose logging
        // console.log('📋 Updated local permissions:', this.permissions);

        // 🔥 FIX: Check if we have SOME permissions but HRV is missing
        // This happens when user granted permissions BEFORE HRV was added
        const hasSomePermissions = newPermissions.steps || newPermissions.heartRate || newPermissions.sleep;
        const missingHrv = !newPermissions.hrv;

        if (hasSomePermissions && missingHrv) {
          console.log('⚠️ [HRV FIX] Detected missing HRV permission while other permissions exist');
          console.log('⚠️ [HRV FIX] Will request HRV permission on next requestPermissions call');
          // Store a flag to force HRV request
          this.needsHrvPermission = true;
        }
      } else if (Platform.OS === 'ios') {
        // 🔥 FIX: Per iOS, leggi i permessi da HealthPermissionsService
        const { HealthPermissionsService } = await import('./health-permissions.service');
        const grantedPermissions = await HealthPermissionsService.getGrantedPermissions();

        // 🔥 PERF: Removed verbose logging
        // console.log('🔄 Refreshed permissions from HealthKit:', grantedPermissions);

        const newPermissions = {
          steps: grantedPermissions.includes('steps'),
          heartRate: grantedPermissions.includes('heart_rate'),
          sleep: grantedPermissions.includes('sleep'),
          hrv: grantedPermissions.includes('hrv'),
          bloodPressure: grantedPermissions.includes('blood_pressure'),
          weight: grantedPermissions.includes('weight'),
          bodyFat: grantedPermissions.includes('body_fat'),
          hydration: false, // Not directly available
          mindfulness: false, // Not directly available
          menstruation: false, // TODO: Add iOS support
        };


        this.permissions = newPermissions;
        // 🔥 PERF: Removed verbose logging
        // console.log('📋 Updated local permissions (iOS):', this.permissions);
      }
    } catch (error) {
      console.error('❌ Could not refresh permissions:', error);
    }
  }

  /**
   * Initialize HealthKit for iOS
   */
  private async initializeHealthKit(): Promise<boolean> {
    if (!AppleHealthKit) {
      // 🔥 PERF: Removed verbose logging
      // console.log('⚠️ AppleHealthKit not available');
      return false;
    }

    try {
      // 🔥 FIX: Verifica che isAvailable sia una funzione prima di chiamarla
      if (typeof AppleHealthKit.isAvailable !== 'function') {
        // 🔥 PERF: Removed verbose logging
        // console.log('⚠️ AppleHealthKit.isAvailable is not a function');
        // Su simulatore potrebbe non essere disponibile - consideriamo comunque inizializzato
        // per permettere il testing dell'UI
        return true;
      }

      // Check if HealthKit is available using callback pattern
      const isAvailable = await new Promise<boolean>((resolve) => {
        try {
          AppleHealthKit.isAvailable((error: any, results: boolean) => {
            if (error) {
              console.error('Error checking HealthKit availability:', error);
              resolve(false);
            } else {
              resolve(results === true);
            }
          });
        } catch (e) {
          console.error('Exception calling isAvailable:', e);
          resolve(false);
        }
      });

      if (!isAvailable) {
        // 🔥 PERF: Removed verbose logging
        // console.log('⚠️ HealthKit not available on this device');
        return false;
      }

      return true;
    } catch (error) {
      console.error('❌ HealthKit initialization failed:', error);
      return false;
    }
  }

  /**
   * Initialize Health Connect for Android
   */
  private async initializeHealthConnect(): Promise<boolean> {
    if (!HealthConnect) {
      return false;
    }

    try {
      // CORRETTO: Usa getSdkStatus() invece di isAvailable() che non esiste
      if (!HealthConnect.getSdkStatus || typeof HealthConnect.getSdkStatus !== 'function') {
        return false;
      }

      // Verifica disponibilità con getSdkStatus()
      const status = await HealthConnect.getSdkStatus();

      // Verifica se SDK_AVAILABLE è disponibile come costante
      if (HealthConnect.SdkAvailabilityStatus) {
        const isAvailable = status === HealthConnect.SdkAvailabilityStatus.SDK_AVAILABLE;
        if (!isAvailable) {
          return false;
        }
      } else {
        // Fallback: se getSdkStatus restituisce un numero, SDK_AVAILABLE è tipicamente 1
        const isAvailable = status === 1 || status === 'SDK_AVAILABLE' || status === true;
        if (!isAvailable) {
          return false;
        }
      }

      // Inizializza Health Connect
      if (HealthConnect.initialize && typeof HealthConnect.initialize === 'function') {
        try {
          await HealthConnect.initialize();
        } catch (initError) {
          // 🔥 FIX: Solo errori critici in console
          console.error('❌ Health Connect initialization failed:', initError);
          // Continua comunque, a volte l'inizializzazione può fallire ma funziona ancora
        }
      }

      return true;
    } catch (error) {
      console.error('❌ Health Connect initialization failed:', error);
      return false;
    }
  }

  /**
   * Request health data permissions
   */
  async requestPermissions(): Promise<HealthPermissions> {
    try {
      // 🔥 FIX: Rimuoviamo console.log eccessivi

      if (Platform.OS === 'ios' && AppleHealthKit) {
        return await this.requestHealthKitPermissions();
      } else if (Platform.OS === 'android' && HealthConnect) {
        return await this.requestHealthConnectPermissions();
      }

      // Fallback to mock permissions
      this.permissions = {
        steps: true,
        heartRate: true,
        sleep: true,
        hrv: true,
        bloodPressure: false,
        weight: false,
        bodyFat: false,
        hydration: true,
        mindfulness: true,
        menstruation: true, // 🆕
      };

      // 🔥 FIX: Rimuoviamo console.log eccessivi
      return this.permissions;
    } catch (error) {
      console.error('❌ Failed to request health permissions:', error);
      return this.permissions;
    }
  }

  /**
   * Request HealthKit permissions
   */
  private async requestHealthKitPermissions(): Promise<HealthPermissions> {
    const permissions = {
      permissions: {
        read: [
          AppleHealthKit.Constants.Permissions.Steps,
          AppleHealthKit.Constants.Permissions.DistanceWalkingRunning,
          AppleHealthKit.Constants.Permissions.ActiveEnergyBurned,
          AppleHealthKit.Constants.Permissions.HeartRate,
          AppleHealthKit.Constants.Permissions.RestingHeartRate,
          AppleHealthKit.Constants.Permissions.HeartRateVariability,
          AppleHealthKit.Constants.Permissions.SleepAnalysis,
          AppleHealthKit.Constants.Permissions.BloodPressure,
          AppleHealthKit.Constants.Permissions.BodyMass,
          AppleHealthKit.Constants.Permissions.BodyFatPercentage,
        ],
        write: [
          AppleHealthKit.Constants.Permissions.Steps,
          AppleHealthKit.Constants.Permissions.ActiveEnergyBurned,
          AppleHealthKit.Constants.Permissions.MindfulSession,
        ],
      },
    };

    return new Promise((resolve) => {
      AppleHealthKit.initHealthKit(permissions, (error: any, results: any) => {
        if (error) {
          console.error('❌ HealthKit permission error:', error);
          resolve(this.permissions);
          return;
        }

        // 🔥 FIX: Rimuoviamo console.log eccessivi

        // 🔥 FIX: On iOS, we cannot distinguish between "denied" and "no data" for privacy reasons.
        // If initHealthKit didn't error, we assume the user has been prompted.
        // We optimistically set permissions to TRUE to avoid the "phantom permission" loop
        // where the app keeps asking for permissions because it sees 'false'.
        // If the user actually denied them, queries will just return 0, which is handled as 'empty' data.
        this.permissions = {
          steps: true,
          heartRate: true,
          sleep: true,
          hrv: true,
          bloodPressure: true,
          weight: true,
          bodyFat: true,
          hydration: false, // Not directly available in HealthKit
          mindfulness: true,
          menstruation: false, // TODO: Add iOS support
        };

        resolve(this.permissions);
      });
    });
  }

  /**
   * Request Health Connect permissions
   * 🔥 Now uses HealthPermissionsService for consistent permission handling
   */
  private async requestHealthConnectPermissions(): Promise<HealthPermissions> {
    try {
      const { HealthPermissionsService } = await import('./health-permissions.service');

      // 🔥 UNIFIED: All health permissions requested together
      // Uses internal IDs that get mapped to Health Connect types
      const permissionIds = [
        'steps',
        'heart_rate',
        'sleep',
        'hrv',  // Maps to HeartRateVariabilityRmssd
        'blood_pressure',
        'weight',
        'body_fat',
        'menstruation'  // Maps to MenstruationPeriod
      ];

      const result = await HealthPermissionsService.requestHealthPermissions(permissionIds);

      const granted = result.success
        ? await HealthPermissionsService.getGrantedPermissions()
        : [];

      // 🔥 FIX: Rimuoviamo console.log eccessivi

      // Map Health Connect permissions to our interface
      this.permissions = {
        steps: granted.includes('steps'),
        heartRate: granted.includes('heart_rate'),
        sleep: granted.includes('sleep'),
        hrv: granted.includes('hrv'),
        bloodPressure: granted.includes('blood_pressure'),
        weight: granted.includes('weight'),
        bodyFat: granted.includes('body_fat'),
        hydration: false, // Not directly available in Health Connect
        mindfulness: false, // Not directly available in Health Connect
        menstruation: granted.includes('menstruation'), // 🆕
      };

      return this.permissions;
    } catch (error) {
      console.error('❌ Health Connect permission error:', error);
      return this.permissions;
    }
  }

  /**
   * Sync health data from device
   */
  async syncHealthData(force: boolean = false): Promise<HealthDataSyncResult> {
    try {
      // Debounce/lock: evita sync concorrenti o troppo ravvicinate
      if (this.isSyncInProgress && !force) {
        return {
          success: true,
          data: this.lastHealthData || undefined as any,
          lastSyncDate: this.lastSyncAt ? new Date(this.lastSyncAt) : new Date()
        };
      }
      if (!force && this.lastSyncAt && Date.now() - this.lastSyncAt < 60_000) {
        return {
          success: true,
          data: this.lastHealthData || undefined as any,
          lastSyncDate: new Date(this.lastSyncAt)
        };
      }

      this.isSyncInProgress = true;
      console.time('HealthDataService_Sync_Total');

      // 🔥 CRITICO: Verifica se abbiamo permessi concessi PRIMA di sincronizzare
      const hasAnyPermission = Object.values(this.permissions).some(Boolean);
      const shouldUseRealData = hasAnyPermission &&
        ((Platform.OS === 'ios' && AppleHealthKit) ||
          (Platform.OS === 'android' && HealthConnect));

      let healthData: HealthData;
      let isMock = false;

      console.time('HealthConnect_Fetch');
      // 🔥 FIX: Su iOS, NON controllare this.permissions.steps perché non possiamo sapere lo stato reale
      // Proviamo sempre a leggere - se funziona abbiamo i permessi, se fallisce no
      if (Platform.OS === 'ios' && AppleHealthKit) {
        const result = await this.syncHealthKitData();
        if (result.success && result.data) {
          healthData = result.data;
          // Se abbiamo ottenuto dati, aggiorniamo i permessi locali
          if (result.data.steps > 0) this.permissions.steps = true;
          if (result.data.heartRate > 0) this.permissions.heartRate = true;
          if (result.data.hrv > 0) this.permissions.hrv = true;
          if (result.data.sleepHours > 0) this.permissions.sleep = true;
        } else {
          if (this.lastHealthData && this.lastHealthData.steps && this.lastHealthData.steps > 0) {
            healthData = this.lastHealthData;
          } else {
            throw new Error(result.error || 'HealthKit sync failed');
          }
        }
      } else if (Platform.OS === 'android' && HealthConnect &&
        (this.permissions.steps || this.permissions.heartRate || this.permissions.sleep)) {

        const result = await this.syncHealthConnectData();
        if (result.success && result.data) {
          healthData = result.data;
        } else {
          // 🔥 CRITICO: Se i permessi sono concessi ma la sync fallisce, usa l'ultimo dato reale
          if (this.lastHealthData && shouldUseRealData) {
            const hasRealData = (this.lastHealthData.steps && this.lastHealthData.steps > 0) ||
              (this.lastHealthData.heartRate && this.lastHealthData.heartRate > 0) ||
              (this.lastHealthData.sleepHours && this.lastHealthData.sleepHours > 0);

            if (hasRealData) {
              healthData = this.lastHealthData;
            } else {
              throw new Error(result.error || 'Health Connect sync failed');
            }
          } else {
            throw new Error(result.error || 'Health Connect sync failed');
          }
        }
      } else {
        console.timeEnd('HealthConnect_Fetch');

        // 🔥 NUOVO: Anche senza permessi, crea un record vuoto per oggi per tracciare lo streak (login)
        const currentUser = await AuthService.getCurrentUser();
        if (currentUser) {
          const emptyHealthData: HealthData = {
            steps: 0, distance: 0, calories: 0, activeMinutes: 0,
            heartRate: 0, restingHeartRate: 0, hrv: 0,
            sleepHours: 0, sleepQuality: 0, deepSleepMinutes: 0, remSleepMinutes: 0, lightSleepMinutes: 0,
            hydration: 0, mindfulnessMinutes: 0
          };
          const syncService = HealthDataSyncService.getInstance();
          await syncService.syncHealthData(currentUser.id, emptyHealthData);
          if (__DEV__) console.log('💓 Activity heartbeat synced to Supabase (no health permissions)');
        }

        console.timeEnd('HealthDataService_Sync_Total');
        // Nessuna sorgente disponibile
        return {
          success: true,
          data: this.lastHealthData || undefined as any,
          lastSyncDate: this.lastSyncAt ? new Date(this.lastSyncAt) : new Date(),
        };
      }
      console.timeEnd('HealthConnect_Fetch');

      // Sync to Supabase
      const currentUser = await AuthService.getCurrentUser();
      if (currentUser && !isMock) {
        console.time('Supabase_Health_Sync');
        const syncService = HealthDataSyncService.getInstance();
        const syncResult = await syncService.syncHealthData(currentUser.id, healthData);
        console.timeEnd('Supabase_Health_Sync');

        if (!syncResult.success) {
          console.error('❌ Failed to sync to Supabase:', syncResult.error);
        }
      }

      if (!isMock) {
        this.lastHealthData = healthData;
        this.lastHealthDataSource = 'health_connect';
      }

      const result: HealthDataSyncResult = {
        success: true,
        data: healthData,
        lastSyncDate: new Date(),
      };
      this.lastSyncAt = Date.now();
      console.timeEnd('HealthDataService_Sync_Total');
      return result;

    } catch (error) {
      console.error('❌ Health data sync failed:', error);
      console.timeEnd('HealthDataService_Sync_Total');

      const hasAnyPermission = Object.values(this.permissions).some(Boolean);
      if (hasAnyPermission && this.lastHealthData && this.lastHealthDataSource !== 'mock') {
        return {
          success: true,
          data: this.lastHealthData,
          lastSyncDate: this.lastSyncAt ? new Date(this.lastSyncAt) : new Date(),
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      this.isSyncInProgress = false;
    }
  }

  /**
   * Sync data from HealthKit
   */
  private async syncHealthKitData(): Promise<HealthDataSyncResult> {
    console.log('[HealthKit] 🔄 syncHealthKitData called...');

    // 🔥 FIX CRITICO: Bisogna inizializzare HealthKit con le permissions PRIMA di leggere i dati
    // react-native-health richiede una chiamata a initHealthKit prima di poter usare getStepCount
    // 🔥 FIX: Use Constants to avoid typo issues
    const PERMS = AppleHealthKit.Constants.Permissions;

    const permissions = {
      permissions: {
        // 🔥 FIX: Alcune versioni preferiscono 'Steps', altre 'StepCount'. Chiediamo entrambi.
        read: [PERMS.StepCount, PERMS.Steps, PERMS.HeartRate, PERMS.HeartRateVariability, PERMS.SleepAnalysis],
        write: [] as any[],
      },
    };

    return new Promise((resolve) => {
      // 1. Inizializza HealthKit
      AppleHealthKit.initHealthKit(permissions, async (initError: string) => {
        if (initError) {
          console.error('[HealthKit] ❌ initHealthKit failed:', initError);
          resolve({ success: false, error: 'HealthKit initialization failed: ' + initError });
          return;
        }

        console.log('[HealthKit] ✅ HealthKit initialized successfully');

        const today = new Date();
        const now = new Date(); // 🔥 FIX: Define 'now' explicitely for subsequent usage
        // 🔥 FIX: Usa la stessa logica "Fake Z" usata per il ciclo per garantire coeranza
        // Costruisci manualmente la stringa ISO per mezzanotte locale "come se fosse UTC"
        // per evitare che .toISOString() sposti la data al giorno prima (e.g. 23:00 del 29 Gen)
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const startOfTodayEncoded = `${year}-${month}-${day}T00:00:00.000Z`;

        const options = {
          startDate: startOfTodayEncoded,
          endDate: now.toISOString(),
          includeManuallyAdded: true,
        };

        try {
          // 2. Fetch dei vari dati

          // Steps
          const stepResults = await new Promise<any>((res) => {
            AppleHealthKit.getStepCount({ ...options, unit: 'count' }, (err, results) => res(results));
          });
          const steps = stepResults?.value || 0;

          // Heart Rate (Latest)
          const hrResults = await new Promise<any[]>((res) => {
            AppleHealthKit.getHeartRateSamples(options, (err, results) => res(results || []));
          });
          const heartRate = hrResults.length > 0 ? hrResults[0].value : 0;

          // HRV
          const hrvResults = await new Promise<any[]>((res) => {
            AppleHealthKit.getHeartRateVariabilitySamples(options, (err, results) => res(results || []));
          });
          const hrv = hrvResults.length > 0 ? hrvResults[0].value * 1000 : 0; // Convert to ms if needed

          // Sleep (samples from last 24h)
          const sleepStartDate = new Date(today.getTime() - 24 * 60 * 60 * 1000);
          const sleepResults = await new Promise<any[]>((res) => {
            AppleHealthKit.getSleepSamples({ startDate: sleepStartDate.toISOString(), endDate: today.toISOString() }, (err, results) => res(results || []));
          });

          let sleepMinutes = 0;
          // 🔥 FIX: Prioritize ASLEEP to avoid double counting (INBED + ASLEEP)
          const asleepSamples = sleepResults.filter(s => s.value === 'ASLEEP');
          const samplesToUse = asleepSamples.length > 0 ? asleepSamples : sleepResults.filter(s => s.value === 'INBED');

          samplesToUse.forEach(sample => {
            const start = new Date(sample.startDate).getTime();
            const end = new Date(sample.endDate).getTime();
            sleepMinutes += (end - start) / (1000 * 60);
          });

          const healthData: HealthData = {
            steps,
            distance: steps * 0.0008,
            calories: 0,
            activeMinutes: 0,
            heartRate,
            restingHeartRate: 0,
            hrv,
            sleepHours: sleepMinutes / 60,
            sleepQuality: 0,
            deepSleepMinutes: 0,
            remSleepMinutes: 0,
            lightSleepMinutes: 0,
            hydration: 0,
            mindfulnessMinutes: 0,
          };

          console.log('[HealthKit] ✅ Sync complete. Steps:', steps, 'HR:', heartRate, 'Sleep hours:', (sleepMinutes / 60).toFixed(1));

          resolve({
            success: true,
            data: healthData,
            lastSyncDate: new Date(),
          });
        } catch (fetchError) {
          console.error('[HealthKit] ❌ Error fetching data:', fetchError);
          resolve({ success: false, error: 'Error fetching HealthKit data' });
        }
      });
    });
  }

  /**
   * Sync data from Health Connect
   */
  private async syncHealthConnectData(): Promise<HealthDataSyncResult> {
    try {
      console.time('HealthConnect_Total');

      // Assicurati che Health Connect sia inizializzato
      if (HealthConnect.initialize && typeof HealthConnect.initialize === 'function') {
        try {
          await HealthConnect.initialize();
        } catch (initError) {
          // 🔥 FIX: Solo errori critici in console
          console.error('❌ Health Connect initialization failed:', initError);
        }
      }

      // Usa il giorno locale corrente per allineare a come Google Health traccia i passi
      // Usa il giorno locale corrente per allineare a come Google Health traccia i passi
      const now = new Date();
      // 🔥 FIX: Usa la logica "Fake Z" anche qui per consistenza
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const startOfDayEncoded = `${year}-${month}-${day}T00:00:00.000Z`;

      // 🔥 FIX: Definisci startOfDay come oggetto Date per i confronti numerici successivi (es. sleep)
      const startOfDay = new Date(startOfDayEncoded);

      // Per il sonno useremo una finestra più ampia più sotto
      const timeRangeFilter = {
        operator: 'BETWEEN' as const,
        startTime: startOfDayEncoded,
        endTime: now.toISOString(),
      };

      const healthData: HealthData = {
        steps: 0,
        distance: 0,
        calories: 0,
        activeMinutes: 0,
        heartRate: 0,
        restingHeartRate: 0,
        hrv: 0,
        sleepHours: 0,
        sleepQuality: 0,
        deepSleepMinutes: 0,
        remSleepMinutes: 0,
        lightSleepMinutes: 0,
        hydration: 0,
        mindfulnessMinutes: 0,
      };

      // Normalizza le risposte di readRecords che possono variare tra array e oggetti
      const normalizeRecords = (response: any): any[] => {
        if (!response) return [];
        if (Array.isArray(response)) return response;
        if (Array.isArray(response?.records)) return response.records;
        if (Array.isArray(response?.result?.records)) return response.result.records;
        if (Array.isArray(response?.data)) return response.data;
        if (Array.isArray(response?.results)) return response.results;
        if (response?.records && typeof response.records === 'object') {
          return Object.values(response.records).reduce<any[]>((acc, value) => {
            if (Array.isArray(value)) {
              return acc.concat(value);
            }
            if (value) {
              acc.push(value);
            }
            return acc;
          }, []);
        }
        return [];
      };

      // Legge tutte le pagine disponibili per un dato tipo di record
      const readAllRecords = async (recordType: string, options: any = {}): Promise<any[]> => {
        if (!HealthConnect.readRecords || typeof HealthConnect.readRecords !== 'function') {
          return [];
        }

        const allRecords: any[] = [];
        const seenTokens = new Set<string>();
        let pageToken: string | undefined;

        console.time(`HealthConnect_Read_${recordType}`);
        do {
          try {
            if (pageToken && seenTokens.has(pageToken)) {
              break;
            }
            if (pageToken) {
              seenTokens.add(pageToken);
            }

            const params = pageToken ? { ...options, pageToken } : options;
            const response = await HealthConnect.readRecords(recordType, params);
            if (!response) {
              break;
            }

            const chunk = normalizeRecords(response);
            if (chunk.length > 0) {
              allRecords.push(...chunk);
            }

            const nextToken = response?.pageToken || response?.nextPageToken;
            if (!nextToken || seenTokens.has(nextToken)) {
              pageToken = undefined;
            } else {
              pageToken = nextToken;
            }
          } catch (error) {
            // 🔥 FIX: Solo errori critici in console
            console.error(`❌ Error reading ${recordType} page:`, error);
            break;
          }
        } while (pageToken);
        console.timeEnd(`HealthConnect_Read_${recordType}`);

        return allRecords;
      };

      // Leggi Steps se il permesso è stato concesso
      // 🔥 FIX: Usa SOLO aggregateRecord per evitare duplicazione passi
      if (this.permissions.steps) {
        try {
          const extractAggregateSteps = (result: any): number => {
            if (!result) return 0;
            const candidates = [
              result.COUNT_TOTAL,
              result.COUNT,
              result.STEP_COUNT_TOTAL,
              result.STEPS_TOTAL,
              result.total,
              result.count,
            ];
            for (const maybe of candidates) {
              if (typeof maybe === 'number' && !Number.isNaN(maybe)) {
                return maybe;
              }
            }
            return 0;
          };

          let stepsTotal = 0;

          // 🔥 USA SOLO aggregateRecord - evita duplicazione
          if (HealthConnect.aggregateRecord && typeof HealthConnect.aggregateRecord === 'function') {
            try {
              const aggregateResult = await HealthConnect.aggregateRecord({
                recordType: 'Steps',
                timeRangeFilter,
              });
              stepsTotal = Math.round(extractAggregateSteps(aggregateResult));
            } catch (aggError) {
              console.error('❌ Steps aggregate failed:', aggError);
            }
          }

          healthData.steps = stepsTotal;
        } catch (error) {
          console.error('❌ Error reading Steps:', error);
        }
      }

      // Leggi HeartRate se il permesso è stato concesso
      if (this.permissions.heartRate && HealthConnect.readRecords) {
        try {
          const heartRateRecords = await readAllRecords('HeartRate', { timeRangeFilter });

          const getRecordTimestamp = (record: any): number => {
            const raw =
              record?.time ||
              record?.endTime ||
              record?.end ||
              record?.startTime ||
              record?.start ||
              record?.timestamp;
            if (!raw) {
              return 0;
            }
            const ms = new Date(raw).getTime();
            return Number.isNaN(ms) ? 0 : ms;
          };

          const extractBpm = (record: any): number => {
            if (!record) return 0;
            if (typeof record.beatsPerMinute === 'number') return record.beatsPerMinute;
            if (typeof record.bpm === 'number') return record.bpm;
            if (Array.isArray(record.samples) && record.samples.length > 0) {
              const sample = record.samples[record.samples.length - 1];
              if (typeof sample?.beatsPerMinute === 'number') return sample.beatsPerMinute;
              if (typeof sample?.bpm === 'number') return sample.bpm;
            }
            if (typeof record.value === 'number') return record.value;
            return 0;
          };

          if (heartRateRecords.length > 0) {
            const sortedRecords = heartRateRecords
              .slice()
              .sort((a, b) => getRecordTimestamp(a) - getRecordTimestamp(b));
            const latestRecord = sortedRecords[sortedRecords.length - 1];
            const latestBpm = extractBpm(latestRecord);

            if (latestBpm > 0) {
              healthData.heartRate = latestBpm;
            }
          }
        } catch (error) {
          console.error('❌ Error reading HeartRate:', error);
        }
      }

      // HRV - SOLO OGGI
      console.log('[DEBUG] HRV Permission Check:', this.permissions.hrv);

      if (this.permissions.hrv && HealthConnect.readRecords) {
        try {
          // 1) Helper: timestamp robusto
          const getRecordTimestamp = (record: any): number => {
            const raw =
              record?.time ||
              record?.endTime ||
              record?.end ||
              record?.startTime ||
              record?.start ||
              record?.timestamp;

            if (!raw) return 0;

            const ms = new Date(raw).getTime();
            return Number.isNaN(ms) ? 0 : ms;
          };

          // 2) Helper: estrazione valore HRV robusta (rmssd in ms)
          const extractHrvValue = (record: any): number => {
            if (!record) return 0;

            const candidates = [
              record.rmssd,
              record.rmssdMillis,
              record.rmssdMilliSeconds,
              record.value,
              record.heartRateVariability,
              record.heartRateVariabilityMillis,
              record.heartRateVariabilityMilliseconds,
            ];

            for (const c of candidates) {
              if (typeof c === 'number' && c > 0) return c;
            }

            // Se arrivano samples: prendo l’ultimo
            if (Array.isArray(record.samples) && record.samples.length > 0) {
              const lastSample = record.samples[record.samples.length - 1];
              if (typeof lastSample?.value === 'number' && lastSample.value > 0) {
                return lastSample.value;
              }
            }

            return 0;
          };

          const buildTodayRange = () => {
            const now = new Date();
            // Mezzanotte locale senza conversione forzata in UTC
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const startTime = `${year}-${month}-${day}T00:00:00.000Z`; // Z fittizia o offset locale
            const endTime = now.toISOString();
            return {
              operator: 'BETWEEN' as const,
              startTime: startTime,
              endTime: endTime,
            };
          };

          // 4) Filtro extra: garantisce che sia davvero "oggi" in locale
          const isTodayLocal = (ms: number) => {
            const d = new Date(ms);
            const now = new Date();
            return (
              d.getFullYear() === now.getFullYear() &&
              d.getMonth() === now.getMonth() &&
              d.getDate() === now.getDate()
            );
          };

          // 5) Tipi HRV da provare
          const hrvRecordTypes = ['HeartRateVariabilityRmssd'];

          // 6) Colleziona dataset per oggi
          const collectHrvDatasetToday = async () => {
            const timeRangeFilter = buildTodayRange();

            for (const type of hrvRecordTypes) {
              const records = await readAllRecords(type, { timeRangeFilter });

              console.log(
                '[DEBUG] HRV Records found for type',
                type,
                '(today only):',
                records.length
              );

              if (!records || records.length === 0) continue;

              const dataset = records
                .map((record: any) => {
                  const timestamp = getRecordTimestamp(record);
                  const value = extractHrvValue(record);
                  return { timestamp, value };
                })
                .filter(
                  item =>
                    item.timestamp > 0 &&
                    item.value > 0 &&
                    isTodayLocal(item.timestamp)
                )
                .sort((a, b) => a.timestamp - b.timestamp);

              if (dataset.length > 0) return { type, dataset };
            }

            return null;
          };

          // ✅ SOLO OGGI (senza fallback 24h)
          const hrvResult = await collectHrvDatasetToday();

          if (hrvResult) {
            const values = hrvResult.dataset.map(item => item.value);

            const latestHrv = values[values.length - 1] ?? 0;
            const avgHrv =
              values.reduce((sum, v) => sum + v, 0) / (values.length || 1);

            const latestRounded = latestHrv > 0 ? Math.round(latestHrv * 10) / 10 : 0;
            const averageRounded = avgHrv > 0 ? Math.round(avgHrv * 10) / 10 : 0;

            // Preferisco latest, altrimenti media
            if (latestRounded > 0) {
              healthData.hrv = latestRounded;
            } else if (averageRounded > 0) {
              healthData.hrv = averageRounded;
            }

            console.log('[DEBUG] HRV today:', {
              type: hrvResult.type,
              count: values.length,
              latest: latestRounded,
              average: averageRounded,
            });
          } else {
            console.log('[DEBUG] HRV today: no records found');
          }
        } catch (err) {
          console.log('[DEBUG] HRV read error:', err);
        }
      }

      // Leggi Ciclo Mestruale se il permesso è stato concesso
      if (this.permissions.menstruation && HealthConnect.readRecords) {
        try {
          // Cerca negli ultimi 45 giorni
          const cycleStart = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000);
          const cycleOptions = {
            timeRangeFilter: {
              operator: 'BETWEEN',
              startTime: cycleStart.toISOString(),
              endTime: now.toISOString(),
            },
          };

          const records = await readAllRecords('MenstruationPeriod', cycleOptions);

          if (records && records.length > 0) {
            // Ordina per data decrescente
            const sorted = records.sort((a: any, b: any) => {
              const dateA = new Date(a.startTime || a.time).getTime();
              const dateB = new Date(b.startTime || b.time).getTime();
              return dateB - dateA;
            });

            const latest = sorted[0];
            const periodDate = latest.startTime || latest.time;

            if (periodDate) {
              const { menstrualCycleService } = await import('./menstrual-cycle.service');
              await menstrualCycleService.setLastPeriodDate(periodDate);
              if (__DEV__) console.log('✅ Updated last period date from Health Connect:', periodDate);
            }
          }
        } catch (error) {
          console.error('❌ Error reading MenstruationPeriod:', error);
        }
      }

      // Leggi SleepSession se il permesso è stato concesso
      // 🔥 FIX: Semplificato - legge ore totali + bedtime/waketime
      if (this.permissions.sleep && HealthConnect.readRecords) {
        try {
          // Per il sonno, considera le ultime 36 ore per includere la notte scorsa
          const sleepEnd = new Date();
          const sleepStart = new Date(sleepEnd.getTime() - 36 * 60 * 60 * 1000);
          const sleepRange = { operator: 'BETWEEN' as const, startTime: sleepStart.toISOString(), endTime: sleepEnd.toISOString() };
          const sleepRecords = await readAllRecords('SleepSession', { timeRangeFilter: sleepRange });

          if (sleepRecords.length > 0) {
            let totalSleepMinutes = 0;
            let earliestBedtime: Date | null = null;
            let latestWaketime: Date | null = null;
            const seenSleepSessions = new Set<string>();
            const cutoff = now.getTime() - 24 * 60 * 60 * 1000;

            sleepRecords.forEach((record: any) => {
              const startDate = new Date(record.startTime || record.start);
              const endDate = new Date(record.endTime || record.end);
              const startMs = startDate.getTime();
              const endMs = endDate.getTime();

              if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
                return;
              }

              if (endMs < cutoff || endMs < startOfDay.getTime()) {
                return;
              }

              const sessionKey = `${startMs}-${endMs}`;
              if (seenSleepSessions.has(sessionKey)) {
                return;
              }
              seenSleepSessions.add(sessionKey);

              const durationMinutes = Math.max(0, (endMs - startMs) / (1000 * 60));
              if (durationMinutes > 0) {
                totalSleepMinutes += durationMinutes;

                // 🔥 NEW: Track earliest bedtime and latest waketime
                if (!earliestBedtime || startDate < earliestBedtime) {
                  earliestBedtime = startDate;
                }
                if (!latestWaketime || endDate > latestWaketime) {
                  latestWaketime = endDate;
                }
              }
            });

            if (totalSleepMinutes > 0) {
              healthData.sleepHours = Math.round((totalSleepMinutes / 60) * 10) / 10;

              // 🔥 Format bedtime and waketime as locale time strings
              if (earliestBedtime) {
                (healthData as any).bedtime = earliestBedtime.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
              }
              if (latestWaketime) {
                (healthData as any).waketime = latestWaketime.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
              }
            }
          }
        } catch (error) {
          console.error('❌ Error reading SleepSession:', error);
        }
      }

      // Calcola distance da steps se disponibili
      if (healthData.steps > 0) {
        healthData.distance = healthData.steps * 0.0008; // metri
        // Stima calorie basata sui passi (circa 0.04 calorie per passo)
        healthData.calories = Math.round(healthData.steps * 0.04);
      }

      console.timeEnd('HealthConnect_Total');

      return {
        success: true,
        data: healthData,
        lastSyncDate: new Date(),
      };
    } catch (error) {
      console.error('❌ Health Connect sync error:', error);
      console.timeEnd('HealthConnect_Total');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }



  /**
   * Load latest health data previously synced to Supabase
   */
  async getLatestSyncedHealthData(): Promise<{ data: HealthData | null; syncedAt?: Date }> {
    try {
      const currentUser = await AuthService.getCurrentUser();
      if (!currentUser) {
        return { data: null };
      }

      const syncService = HealthDataSyncService.getInstance();
      const record = await syncService.getLatestHealthData(currentUser.id);
      if (!record) {
        return { data: null };
      }

      // 🔥 FIX: Verifica che il record sia di OGGI. 
      // Se il record è vecchio (es. ieri), NON deve essere usato come fallback per oggi.
      // Esempio: record.date è "2024-01-30", oggi è "2024-01-31" -> scarta il record.
      const now = new Date();
      const today = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0')
      ].join('-');

      if (record.date !== today) {
        console.log('⚠️ [HealthDataService] Found stale record (date mismatch). Ignoring fallback.', { recordDate: record.date, today });
        return { data: null };
      }

      const mapped: HealthData = {
        steps: record.steps ?? 0,
        distance: record.distance ?? 0,
        calories: record.calories ?? 0,
        activeMinutes: record.active_minutes ?? 0,
        heartRate: record.heart_rate ?? 0,
        restingHeartRate: record.resting_heart_rate ?? 0,
        hrv: record.hrv ?? 0,
        sleepHours: record.sleep_hours ?? 0,
        sleepQuality: record.sleep_quality ?? 0,
        deepSleepMinutes: record.deep_sleep_minutes ?? 0,
        remSleepMinutes: record.rem_sleep_minutes ?? 0,
        lightSleepMinutes: record.light_sleep_minutes ?? 0,
        bloodPressure: record.blood_pressure_systolic && record.blood_pressure_diastolic
          ? {
            systolic: record.blood_pressure_systolic,
            diastolic: record.blood_pressure_diastolic,
          }
          : undefined,
        weight: record.weight ?? undefined,
        bodyFat: record.body_fat ?? undefined,
        hydration: record.hydration ?? 0,
        mindfulnessMinutes: record.mindfulness_minutes ?? 0,
      };

      const syncedAt =
        record.updated_at
          ? new Date(record.updated_at)
          : new Date(`${record.date}T00:00:00`);

      this.lastHealthData = mapped;
      this.lastSyncAt = syncedAt.getTime();

      return { data: mapped, syncedAt };
    } catch (error) {
      console.error('❌ Failed to load latest synced health data:', error);
      return { data: null };
    }
  }

  /**
   * Get current permissions status
   */
  getPermissions(): HealthPermissions {
    return { ...this.permissions };
  }

  /**
   * Check if a specific metric is available
   */
  isMetricAvailable(metric: HealthMetricType): boolean {
    switch (metric) {
      case 'steps':
      case 'distance':
      case 'calories':
      case 'activeMinutes':
        return this.permissions.steps;
      case 'heartRate':
      case 'restingHeartRate':
        return this.permissions.heartRate;
      case 'hrv':
        return this.permissions.hrv;
      case 'sleepHours':
      case 'sleepQuality':
      case 'deepSleepMinutes':
      case 'remSleepMinutes':
      case 'lightSleepMinutes':
        return this.permissions.sleep;
      case 'bloodPressure':
        return this.permissions.bloodPressure;
      case 'weight':
        return this.permissions.weight;
      case 'bodyFat':
        return this.permissions.bodyFat;
      case 'hydration':
        return this.permissions.hydration;
      case 'mindfulnessMinutes':
        return this.permissions.mindfulness;
      default:
        return false;
    }
  }

  /**
   * Update service configuration
   */
  updateConfig(config: Partial<HealthDataServiceConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get automatic sync interval in minutes
   */
  getSyncIntervalMinutes(): number {
    return this.config.syncInterval;
  }
}
