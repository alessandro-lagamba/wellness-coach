import { useState, useEffect, useCallback, useMemo } from 'react';
import { HealthDataService } from '../services/health-data.service';
import { 
  HealthData, 
  HealthPermissions, 
  HealthDataSyncResult,
  HealthDataStatus,
} from '../types/health.types';

export interface UseHealthDataReturn {
  // Data
  healthData: HealthData | null;
  permissions: HealthPermissions;
  isLoading: boolean;
  isInitialized: boolean;
  lastSyncDate: Date | null;
  error: string | null;
  status: HealthDataStatus;

  // Actions
  requestPermissions: () => Promise<HealthPermissions>;
  syncData: () => Promise<HealthDataSyncResult>;
  refreshData: () => Promise<void>;
  refreshPermissions: () => Promise<void>; // 🔥 NUOVO: Forza refresh dei permessi
  
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
          // Snapshot permessi e sync forzata se già concessi
          const currentPerms = healthService.getPermissions();
          setPermissions(currentPerms);
          if (Object.values(currentPerms).some(Boolean)) {
            await syncData();
          }
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

  const hasMeaningfulData = (data?: HealthData | null) => {
    if (!data) return false;
    return (
      (data.steps ?? 0) > 0 ||
      (data.sleepHours ?? 0) > 0 ||
      (data.hrv ?? 0) > 0 ||
      (data.heartRate ?? 0) > 0 ||
      (data.hydration ?? 0) > 0 ||
      (data.mindfulnessMinutes ?? 0) > 0
    );
  };

  // Sync health data (supports forced sync via service cooldown bypass)
  const syncData = useCallback(async (): Promise<HealthDataSyncResult> => {
    try {
      setIsLoading(true);
      setError(null);
      
      const result = await healthService.syncHealthData(true);
      let resolvedResult = result;
      
      // 🔥 Aggiorna sempre i dati se disponibili, anche se la sync è stata "skipped"
      if (result.success && result.data) {
        setHealthData(result.data);
        setLastSyncDate(result.lastSyncDate || new Date());
        console.log('✅ Health data updated in hook:', {
          steps: result.data.steps,
          heartRate: result.data.heartRate,
          hrv: result.data.hrv,
          sleepHours: result.data.sleepHours,
        });
      } else if (result.success && !result.data) {
        // Se la sync è riuscita ma non ci sono dati nuovi, mantieni i dati esistenti
        console.log('⚠️ Sync successful but no new data returned');
      } else {
        setError(result.error || 'Sync failed');
      }

      if (!hasMeaningfulData(resolvedResult.data)) {
        const fallback = await healthService.getLatestSyncedHealthData();
        if (fallback.data && hasMeaningfulData(fallback.data)) {
          setHealthData(fallback.data);
          setLastSyncDate(fallback.syncedAt || new Date());
          resolvedResult = {
            success: true,
            data: fallback.data,
            lastSyncDate: fallback.syncedAt || new Date(),
          };
          setError(null);
        } else if (!result.success && !fallback.data) {
          setError(result.error || 'Sync failed');
        }
      } else {
        resolvedResult = {
          success: true,
          data: result.data!,
          lastSyncDate: result.lastSyncDate,
        };
      }
      
      return resolvedResult;
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

  // 🔥 NUOVO: Forza refresh dei permessi e reinizializzazione
  const refreshPermissions = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Reinizializza il servizio per aggiornare i permessi
      const success = await healthService.initialize();
      setIsInitialized(success);
      
      if (success) {
        // Aggiorna i permessi nello stato del hook
        const currentPerms = healthService.getPermissions();
        setPermissions(currentPerms);
        
        // Se ci sono permessi concessi, sincronizza i dati
        if (Object.values(currentPerms).some(Boolean)) {
          await syncData();
        }
      }
    } catch (err) {
      console.error('Failed to refresh permissions:', err);
      setError(err instanceof Error ? err.message : 'Permission refresh failed');
    } finally {
      setIsLoading(false);
    }
  }, [healthService, syncData]);

  // Check if permission is granted for a specific metric
  const isPermissionGranted = useCallback((metric: string): boolean => {
    return healthService.isMetricAvailable(metric as any);
  }, [healthService]);

  // Computed values
  const hasData = healthData !== null;
  const hasAnyPermission = Object.values(permissions).some(Boolean);

  const status: HealthDataStatus = useMemo(() => {
    if (!isInitialized || (isLoading && !hasAnyPermission && !healthData)) {
      return 'loading';
    }

    if (!hasAnyPermission) {
      return 'waiting-permission';
    }

    if (hasMeaningfulData(healthData)) {
      return 'ready';
    }

    if (error && !healthData) {
      return 'error';
    }

    if (isLoading && !healthData) {
      return 'loading';
    }

    return 'empty';
  }, [isInitialized, isLoading, hasAnyPermission, healthData, error]);

  // Schedule periodic background sync based on service configuration
  useEffect(() => {
    if (!isInitialized || !hasAnyPermission) {
      return;
    }

    const intervalMinutes = healthService.getSyncIntervalMinutes
      ? healthService.getSyncIntervalMinutes()
      : 15;

    if (!intervalMinutes || intervalMinutes <= 0) {
      return;
    }

    const intervalMs = intervalMinutes * 60_000;
    const intervalId = setInterval(() => {
      syncData().catch(err => {
        console.warn('⚠️ Periodic health sync failed:', err);
      });
    }, intervalMs);

    console.log(`⏱️ Health data auto-sync scheduled every ${intervalMinutes} minute(s)`);

    return () => clearInterval(intervalId);
  }, [isInitialized, hasAnyPermission, syncData, healthService]);

  return {
    // Data
    healthData,
    permissions,
    isLoading,
    isInitialized,
    lastSyncDate,
    error,
    status,

    // Actions
    requestPermissions,
    syncData,
    refreshData,
    refreshPermissions, // 🔥 NUOVO
    
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
