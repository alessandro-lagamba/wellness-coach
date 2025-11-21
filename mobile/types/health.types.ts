// Health Data Types for HealthKit and Health Connect Integration

export interface HealthData {
  steps: number;
  distance: number; // in meters
  calories: number;
  activeMinutes: number;
  heartRate: number; // bpm
  restingHeartRate: number; // bpm
  hrv: number; // Heart Rate Variability in ms
  sleepHours: number;
  sleepQuality: number; // 0-100
  deepSleepMinutes: number;
  remSleepMinutes: number;
  lightSleepMinutes: number;
  bloodPressure?: {
    systolic: number;
    diastolic: number;
  };
  weight?: number; // kg
  bodyFat?: number; // percentage
  hydration?: number; // ml
  mindfulnessMinutes?: number;
}

export interface HealthDataPoint {
  value: number;
  unit: string;
  startDate: Date;
  endDate: Date;
  source?: string;
}

export interface HealthDataRange {
  startDate: Date;
  endDate: Date;
  data: HealthDataPoint[];
}

export interface HealthPermissions {
  steps: boolean;
  heartRate: boolean;
  sleep: boolean;
  hrv: boolean;
  bloodPressure: boolean;
  weight: boolean;
  bodyFat: boolean;
  hydration: boolean;
  mindfulness: boolean;
}

export interface HealthDataSyncResult {
  success: boolean;
  data?: HealthData;
  error?: string;
  lastSyncDate?: Date;
}

export type HealthDataStatus = 'loading' | 'waiting-permission' | 'empty' | 'ready' | 'error';

export interface HealthDataServiceConfig {
  enableHealthKit: boolean;
  enableHealthConnect: boolean;
  syncInterval: number; // minutes
  maxRetries: number;
  fallbackToMock: boolean;
}

export type HealthMetricType = 
  | 'steps'
  | 'distance'
  | 'calories'
  | 'activeMinutes'
  | 'heartRate'
  | 'restingHeartRate'
  | 'hrv'
  | 'sleepHours'
  | 'sleepQuality'
  | 'deepSleepMinutes'
  | 'remSleepMinutes'
  | 'lightSleepMinutes'
  | 'bloodPressure'
  | 'weight'
  | 'bodyFat'
  | 'hydration'
  | 'mindfulnessMinutes';

export interface HealthMetricConfig {
  type: HealthMetricType;
  enabled: boolean;
  unit: string;
  goal?: number;
  priority: 'high' | 'medium' | 'low';
}

