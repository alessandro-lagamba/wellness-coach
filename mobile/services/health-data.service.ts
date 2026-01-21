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
    AppleHealthKit = require('react-native-health').default;
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
  };

  private constructor() {
    this.config = {
      enableHealthKit: Platform.OS === 'ios',
      enableHealthConnect: Platform.OS === 'android',
      syncInterval: 15, // 15 minutes
      maxRetries: 3,
      // Su Android con Health Connect disponibile non usare mock
      fallbackToMock: Platform.OS === 'ios',
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

        // Map HealthKit permissions to our interface
        this.permissions = {
          steps: results.steps === 'granted',
          heartRate: results.heartRate === 'granted',
          sleep: results.sleepAnalysis === 'granted',
          hrv: results.heartRateVariability === 'granted',
          bloodPressure: results.bloodPressure === 'granted',
          weight: results.bodyMass === 'granted',
          bodyFat: results.bodyFatPercentage === 'granted',
          hydration: false, // Not directly available in HealthKit
          mindfulness: results.mindfulSession === 'granted',
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

      const permissionIds = ['steps', 'heart_rate', 'sleep', 'hrv', 'blood_pressure', 'weight', 'body_fat'];

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
      if (Platform.OS === 'ios' && AppleHealthKit && this.permissions.steps) {
        const result = await this.syncHealthKitData();
        if (result.success && result.data) {
          healthData = result.data;
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
      } else if (this.config.fallbackToMock && !shouldUseRealData) {
        healthData = this.generateMockHealthData();
        isMock = true;
      } else {
        console.timeEnd('HealthConnect_Fetch');
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
    return new Promise((resolve) => {
      const today = new Date();
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

      const options = {
        startDate: yesterday.toISOString(),
        endDate: today.toISOString(),
      };

      // Get steps
      AppleHealthKit.getStepCount(options, (error: any, results: any) => {
        if (error) {
          console.error('❌ HealthKit steps error:', error);
          resolve({
            success: false,
            error: 'Failed to get steps data',
          });
          return;
        }

        const healthData: HealthData = {
          steps: results.value || 0,
          distance: 0, // Will be calculated
          calories: 0, // Will be fetched separately
          activeMinutes: 0, // Will be fetched separately
          heartRate: 0, // Will be fetched separately
          restingHeartRate: 0, // Will be fetched separately
          hrv: 0, // Will be fetched separately
          sleepHours: 0, // Will be fetched separately
          sleepQuality: 0, // Will be calculated
          deepSleepMinutes: 0, // Will be fetched separately
          remSleepMinutes: 0, // Will be fetched separately
          lightSleepMinutes: 0, // Will be fetched separately
          hydration: 0, // Not available in HealthKit
          mindfulnessMinutes: 0, // Will be fetched separately
        };

        // Calculate distance from steps (approximate)
        healthData.distance = healthData.steps * 0.0008; // meters

        resolve({
          success: true,
          data: healthData,
          lastSyncDate: new Date(),
        });
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
      const now = new Date();
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      // Per il sonno useremo una finestra più ampia più sotto
      const timeRangeFilter = {
        operator: 'BETWEEN' as const,
        startTime: startOfDay.toISOString(),
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

          // Fallback: se 0, prova con finestra 24h
          if (stepsTotal === 0 && HealthConnect.aggregateRecord) {
            try {
              const end = new Date();
              const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
              const range24h = {
                operator: 'BETWEEN' as const,
                startTime: start.toISOString(),
                endTime: end.toISOString(),
              };
              const result24h = await HealthConnect.aggregateRecord({
                recordType: 'Steps',
                timeRangeFilter: range24h,
              });
              stepsTotal = Math.round(extractAggregateSteps(result24h));
            } catch (fallbackError) {
              console.error('❌ Steps 24h fallback failed:', fallbackError);
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

          // Fallback: se 0 record o bpm nullo, estendi finestra a 24h
          if ((healthData.heartRate || 0) === 0) {
            const end = new Date();
            const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
            const range24h = {
              operator: 'BETWEEN' as const,
              startTime: start.toISOString(),
              endTime: end.toISOString(),
            };
            try {
              const hr24 = await readAllRecords('HeartRate', { timeRangeFilter: range24h });
              if (hr24.length > 0) {
                const sorted24 = hr24
                  .slice()
                  .sort((a, b) => getRecordTimestamp(a) - getRecordTimestamp(b));
                const latest = sorted24[sorted24.length - 1];
                const bpm = extractBpm(latest);
                if (bpm > 0) {
                  healthData.heartRate = bpm;
                }
              }
            } catch (fallbackError) {
              console.error('❌ Error reading HeartRate fallback:', fallbackError);
            }
          }
        } catch (error) {
          console.error('❌ Error reading HeartRate:', error);
        }
      }

      // Leggi HRV se il permesso è stato concesso
      console.log('[DEBUG] HRV Permission Check:', this.permissions.hrv);
      if (this.permissions.hrv && HealthConnect.readRecords) {
        try {
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
            for (const candidate of candidates) {
              if (typeof candidate === 'number' && candidate > 0) {
                return candidate;
              }
            }
            if (Array.isArray(record.samples) && record.samples.length > 0) {
              const lastSample = record.samples[record.samples.length - 1];
              if (typeof lastSample?.value === 'number' && lastSample.value > 0) {
                return lastSample.value;
              }
            }
            return 0;
          };

          const hrvRecordTypes = ['HeartRateVariabilityRmssd'];

          const collectHrvDataset = async (options: any) => {
            for (const type of hrvRecordTypes) {
              const records = await readAllRecords(type, options);
              console.log('[DEBUG] HRV Records found for type', type, ':', records.length);
              if (records.length === 0) continue;

              const dataset = records
                .map(record => ({
                  timestamp: getRecordTimestamp(record),
                  value: extractHrvValue(record),
                }))
                .filter(item => item.timestamp && item.value > 0)
                .sort((a, b) => a.timestamp - b.timestamp);

              if (dataset.length > 0) {
                return { type, dataset };
              }
            }
            return null;
          };

          let hrvResult = await collectHrvDataset({ timeRangeFilter });

          if (!hrvResult) {
            const end = new Date();
            const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
            const range24h = {
              operator: 'BETWEEN' as const,
              startTime: start.toISOString(),
              endTime: end.toISOString(),
            };
            hrvResult = await collectHrvDataset({ timeRangeFilter: range24h });
          }

          if (hrvResult) {
            const values = hrvResult.dataset.map(item => item.value);
            const latestHrv = values[values.length - 1] || 0;
            const avgHrv = values.reduce((sum, value) => sum + value, 0) / values.length;

            const latestRounded = latestHrv > 0 ? Math.round(latestHrv * 10) / 10 : 0;
            const averageRounded = avgHrv > 0 ? Math.round(avgHrv * 10) / 10 : 0;

            if (latestRounded > 0) {
              healthData.hrv = latestRounded;
            } else if (averageRounded > 0) {
              healthData.hrv = averageRounded;
            }
          }
        } catch (error) {
          console.error('❌ Error reading HRV:', error);
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
   * Generate mock health data for testing
   */
  private generateMockHealthData(): HealthData {
    const baseSteps = 7500 + Math.random() * 5000;
    const baseSleep = 7 + Math.random() * 2;

    return {
      steps: Math.round(baseSteps),
      distance: Math.round(baseSteps * 0.0008 * 100) / 100,
      calories: Math.round(baseSteps * 0.04),
      activeMinutes: Math.round(30 + Math.random() * 60),
      heartRate: Math.round(65 + Math.random() * 20),
      restingHeartRate: Math.round(55 + Math.random() * 15),
      hrv: Math.round(25 + Math.random() * 20),
      sleepHours: Math.round(baseSleep * 10) / 10,
      sleepQuality: Math.round(70 + Math.random() * 25),
      deepSleepMinutes: Math.round(90 + Math.random() * 60),
      remSleepMinutes: Math.round(60 + Math.random() * 40),
      lightSleepMinutes: Math.round(180 + Math.random() * 120),
      hydration: Math.round(1500 + Math.random() * 1000),
      mindfulnessMinutes: Math.round(5 + Math.random() * 25),
    };
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
