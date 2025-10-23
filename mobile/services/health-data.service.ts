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
    HealthConnect = require('react-native-health-connect').default;
  }
} catch (error) {
  console.warn('Health libraries not available:', error);
}

export class HealthDataService {
  private static instance: HealthDataService;
  private config: HealthDataServiceConfig;
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
      fallbackToMock: true,
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
      console.log('🏥 Initializing Health Data Service...');
      
      if (Platform.OS === 'ios' && this.config.enableHealthKit) {
        return await this.initializeHealthKit();
      } else if (Platform.OS === 'android' && this.config.enableHealthConnect) {
        return await this.initializeHealthConnect();
      }
      
      console.log('🏥 Health data service initialized (mock mode)');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize health data service:', error);
      return false;
    }
  }

  /**
   * Initialize HealthKit for iOS
   */
  private async initializeHealthKit(): Promise<boolean> {
    if (!AppleHealthKit) {
      console.warn('⚠️ AppleHealthKit not available');
      return false;
    }

    try {
      // Check if HealthKit is available
      const isAvailable = await AppleHealthKit.isAvailable();
      if (!isAvailable) {
        console.warn('⚠️ HealthKit not available on this device');
        return false;
      }

      console.log('✅ HealthKit is available');
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
      console.warn('⚠️ HealthConnect not available');
      return false;
    }

    try {
      // Check if Health Connect is available
      const isAvailable = await HealthConnect.isAvailable();
      if (!isAvailable) {
        console.warn('⚠️ Health Connect not available on this device');
        return false;
      }

      console.log('✅ Health Connect is available');
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
      console.log('🔐 Requesting health data permissions...');

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

      console.log('✅ Health permissions granted (mock mode)');
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

        console.log('✅ HealthKit permissions granted:', results);
        
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
   */
  private async requestHealthConnectPermissions(): Promise<HealthPermissions> {
    try {
      const permissions = [
        'steps',
        'distance',
        'activeCalories',
        'heartRate',
        'restingHeartRate',
        'heartRateVariability',
        'sleepSession',
        'bloodPressure',
        'weight',
        'bodyFat',
      ];

      const grantedPermissions = await HealthConnect.requestPermissions(permissions);
      
      console.log('✅ Health Connect permissions granted:', grantedPermissions);
      
      // Map Health Connect permissions to our interface
      this.permissions = {
        steps: grantedPermissions.includes('steps'),
        heartRate: grantedPermissions.includes('heartRate'),
        sleep: grantedPermissions.includes('sleepSession'),
        hrv: grantedPermissions.includes('heartRateVariability'),
        bloodPressure: grantedPermissions.includes('bloodPressure'),
        weight: grantedPermissions.includes('weight'),
        bodyFat: grantedPermissions.includes('bodyFat'),
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
  async syncHealthData(): Promise<HealthDataSyncResult> {
    try {
      console.log('🔄 Syncing health data...');

      let healthData: HealthData;
      let source: 'healthkit' | 'health_connect' | 'manual' | 'mock' = 'mock';

      if (Platform.OS === 'ios' && AppleHealthKit && this.permissions.steps) {
        const result = await this.syncHealthKitData();
        if (result.success && result.data) {
          healthData = result.data;
          source = 'healthkit';
        } else {
          throw new Error(result.error || 'HealthKit sync failed');
        }
      } else if (Platform.OS === 'android' && HealthConnect && this.permissions.steps) {
        const result = await this.syncHealthConnectData();
        if (result.success && result.data) {
          healthData = result.data;
          source = 'health_connect';
        } else {
          throw new Error(result.error || 'Health Connect sync failed');
        }
      } else if (this.config.fallbackToMock) {
        console.log('📊 Using mock health data');
        healthData = this.generateMockHealthData();
        source = 'mock';
      } else {
        throw new Error('No health data source available');
      }

      // Sync to Supabase
      const currentUser = await AuthService.getCurrentUser();
      if (currentUser) {
        const syncService = HealthDataSyncService.getInstance();
        const syncResult = await syncService.syncHealthData(currentUser.id, healthData, source);
        
        if (!syncResult.success) {
          console.warn('⚠️ Failed to sync to Supabase:', syncResult.error);
        } else {
          console.log('✅ Health data synced to Supabase:', syncResult);
        }
      }

      return {
        success: true,
        data: healthData,
        lastSyncDate: new Date(),
      };
    } catch (error) {
      console.error('❌ Health data sync failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
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
      const today = new Date();
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

      // Get steps
      const stepsData = await HealthConnect.getSteps(yesterday, today);
      
      const healthData: HealthData = {
        steps: stepsData?.total || 0,
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
        hydration: 0, // Not available in Health Connect
        mindfulnessMinutes: 0, // Not available in Health Connect
      };

      // Calculate distance from steps (approximate)
      healthData.distance = healthData.steps * 0.0008; // meters

      return {
        success: true,
        data: healthData,
        lastSyncDate: new Date(),
      };
    } catch (error) {
      console.error('❌ Health Connect sync error:', error);
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
}
