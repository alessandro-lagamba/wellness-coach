import { useState, useEffect, useCallback } from 'react';
import { HealthDataService } from '../services/health-data.service';
import { 
  HealthData, 
  HealthPermissions, 
  HealthDataSyncResult 
} from '../types/health.types';

export interface UseHealthDataReturn {
  // Data
  healthData: HealthData | null;
  permissions: HealthPermissions;
  isLoading: boolean;
  isInitialized: boolean;
  lastSyncDate: Date | null;
  error: string | null;

  // Actions
  requestPermissions: () => Promise<HealthPermissions>;
  syncData: () => Promise<HealthDataSyncResult>;
  refreshData: () => Promise<void>;
  
  // Status
  isPermissionGranted: (metric: string) => boolean;
  hasData: boolean;
}

export function useHealthData(): UseHealthDataReturn {
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [permissions, setPermissions] = useState<HealthPermissions>({
    steps: false,
    heartRate: false,
    sleep: false,
    hrv: false,
    bloodPressure: false,
    weight: false,
    bodyFat: false,
    hydration: false,
    mindfulness: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [lastSyncDate, setLastSyncDate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const healthService = HealthDataService.getInstance();

  // Initialize service on mount
  useEffect(() => {
    const initializeService = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const success = await healthService.initialize();
        setIsInitialized(success);
        
        if (success) {
          // Auto-sync data after initialization
          await syncData();
        }
      } catch (err) {
        console.error('Failed to initialize health service:', err);
        setError(err instanceof Error ? err.message : 'Initialization failed');
      } finally {
        setIsLoading(false);
      }
    };

    initializeService();
  }, []);

  // Request permissions
  const requestPermissions = useCallback(async (): Promise<HealthPermissions> => {
    try {
      setIsLoading(true);
      setError(null);
      
      const newPermissions = await healthService.requestPermissions();
      setPermissions(newPermissions);
      
      // Sync data after getting permissions
      if (Object.values(newPermissions).some(Boolean)) {
        await syncData();
      }
      
      return newPermissions;
    } catch (err) {
      console.error('Failed to request permissions:', err);
      setError(err instanceof Error ? err.message : 'Permission request failed');
      return permissions;
    } finally {
      setIsLoading(false);
    }
  }, [healthService, permissions]);

  // Sync health data
  const syncData = useCallback(async (): Promise<HealthDataSyncResult> => {
    try {
      setIsLoading(true);
      setError(null);
      
      const result = await healthService.syncHealthData();
      
      if (result.success && result.data) {
        setHealthData(result.data);
        setLastSyncDate(result.lastSyncDate || new Date());
      } else {
        setError(result.error || 'Sync failed');
      }
      
      return result;
    } catch (err) {
      console.error('Failed to sync health data:', err);
      const errorMessage = err instanceof Error ? err.message : 'Sync failed';
      setError(errorMessage);
      
      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      setIsLoading(false);
    }
  }, [healthService]);

  // Refresh data (alias for syncData)
  const refreshData = useCallback(async (): Promise<void> => {
    await syncData();
  }, [syncData]);

  // Check if permission is granted for a specific metric
  const isPermissionGranted = useCallback((metric: string): boolean => {
    return healthService.isMetricAvailable(metric as any);
  }, [healthService]);

  // Computed values
  const hasData = healthData !== null;
  const hasAnyPermission = Object.values(permissions).some(Boolean);

  return {
    // Data
    healthData,
    permissions,
    isLoading,
    isInitialized,
    lastSyncDate,
    error,

    // Actions
    requestPermissions,
    syncData,
    refreshData,
    
    // Status
    isPermissionGranted,
    hasData: hasData && hasAnyPermission,
  };
}

// Hook for specific health metrics
export function useHealthMetric(metric: string) {
  const { healthData, isPermissionGranted, isLoading, error } = useHealthData();
  
  const value = healthData ? (healthData as any)[metric] : null;
  const hasPermission = isPermissionGranted(metric);
  
  return {
    value,
    hasPermission,
    isLoading,
    error,
    isAvailable: hasPermission && value !== null,
  };
}

// Hook for steps data
export function useStepsData() {
  return useHealthMetric('steps');
}

// Hook for sleep data
export function useSleepData() {
  const { healthData, isPermissionGranted, isLoading, error } = useHealthData();
  
  const sleepData = healthData ? {
    hours: healthData.sleepHours,
    quality: healthData.sleepQuality,
    deepSleep: healthData.deepSleepMinutes,
    remSleep: healthData.remSleepMinutes,
    lightSleep: healthData.lightSleepMinutes,
  } : null;
  
  const hasPermission = isPermissionGranted('sleepHours');
  
  return {
    data: sleepData,
    hasPermission,
    isLoading,
    error,
    isAvailable: hasPermission && sleepData !== null,
  };
}

// Hook for heart rate data
export function useHeartRateData() {
  const { healthData, isPermissionGranted, isLoading, error } = useHealthData();
  
  const heartRateData = healthData ? {
    current: healthData.heartRate,
    resting: healthData.restingHeartRate,
    hrv: healthData.hrv,
  } : null;
  
  const hasPermission = isPermissionGranted('heartRate');
  
  return {
    data: heartRateData,
    hasPermission,
    isLoading,
    error,
    isAvailable: hasPermission && heartRateData !== null,
  };
}

