import { Platform, Alert, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppleHealthKit, { HealthValue, HealthKitPermissions } from 'react-native-health';
import { HealthConnect, HealthConnectApi } from 'react-native-health-connect';

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
   * Verifica la disponibilità di Health Connect su Android
   */
  private   static async checkHealthConnectAvailability(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        // Verifica se Health Connect è disponibile
        if (HealthConnectApi && HealthConnectApi.isHealthConnectAvailable) {
          const isAvailable = await HealthConnectApi.isHealthConnectAvailable();
          return isAvailable;
        }
        return false;
      }
      return false;
    } catch (error) {
      console.error('Error checking Health Connect availability:', error);
      return false;
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
      const permissions: HealthKitPermissions = {};
      
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
   * Richiede i permessi di Health Connect su Android
   */
  private static async requestHealthConnectPermissions(
    permissionIds: string[]
  ): Promise<{ success: boolean; granted: string[]; denied: string[] }> {
    try {
      if (Platform.OS === 'android') {
        const permissions = permissionIds.map(id => this.getHealthConnectPermissionType(id));
        
        const result = await HealthConnectApi.requestPermissions(permissions);
        
        if (result) {
          await this.saveGrantedPermissions(permissionIds);
          return {
            success: true,
            granted: permissionIds,
            denied: [],
          };
        } else {
          return {
            success: false,
            granted: [],
            denied: permissionIds,
          };
        }
      }
      
      return {
        success: false,
        granted: [],
        denied: permissionIds,
      };
    } catch (error) {
      console.error('Error requesting Health Connect permissions:', error);
      return {
        success: false,
        granted: [],
        denied: permissionIds,
      };
    }
  }

  /**
   * Converte l'ID del permesso nel tipo HealthKit
   */
  private static getHealthKitPermissionType(permissionId: string): any {
    const permissionMap: { [key: string]: any } = {
      'steps': 'StepCount',
      'heart_rate': 'HeartRate',
      'sleep': 'SleepAnalysis',
      'hrv': 'HeartRateVariability',
      'blood_pressure': 'BloodPressure',
      'weight': 'BodyMass',
      'height': 'Height',
      'bmi': 'BodyMassIndex',
      'body_fat': 'BodyFatPercentage',
      'muscle_mass': 'LeanBodyMass',
      'water_intake': 'Water',
      'exercise': 'Workout',
      'mindfulness': 'MindfulSession',
    };

    return permissionMap[permissionId] || null;
  }

  /**
   * Converte l'ID del permesso nel tipo Health Connect
   */
  private static getHealthConnectPermissionType(permissionId: string): string {
    const permissionMap: { [key: string]: string } = {
      'steps': 'Steps',
      'heart_rate': 'HeartRate',
      'sleep': 'SleepSession',
      'hrv': 'HeartRateVariability',
      'blood_pressure': 'BloodPressure',
      'weight': 'Weight',
      'height': 'Height',
      'bmi': 'BodyMassIndex',
      'body_fat': 'BodyFat',
      'muscle_mass': 'LeanBodyMass',
      'water_intake': 'Hydration',
      'exercise': 'ExerciseSession',
      'mindfulness': 'MindfulnessSession',
    };

    return permissionMap[permissionId] || permissionId;
  }

  /**
   * Salva i permessi concessi
   */
  private static async saveGrantedPermissions(permissions: string[]): Promise<void> {
    try {
      await AsyncStorage.setItem(
        this.STORAGE_KEYS.PERMISSIONS_GRANTED,
        JSON.stringify(permissions)
      );
      console.log('✅ Health permissions saved:', permissions);
    } catch (error) {
      console.error('Error saving health permissions:', error);
    }
  }

  /**
   * Ottiene i permessi concessi
   */
  private static async getGrantedPermissions(): Promise<string[]> {
    try {
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
      console.log('✅ Health permissions setup completed');
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
      console.error('Error checking setup status:', error);
      return false;
    }
  }

  /**
   * Apre le impostazioni di salute del dispositivo
   */
  static async openHealthSettings(): Promise<void> {
    try {
      if (Platform.OS === 'ios') {
        await Linking.openURL('App-Prefs:HEALTH');
      } else {
        await Linking.openURL('package:com.google.android.apps.fitness');
      }
    } catch (error) {
      console.error('Error opening health settings:', error);
      Alert.alert(
        'Impossibile aprire le impostazioni',
        'Vai manualmente alle impostazioni di salute del tuo dispositivo'
      );
    }
  }

  /**
   * Ottiene le statistiche dei permessi
   */
  static async getPermissionsStats(): Promise<{
    totalPermissions: number;
    grantedPermissions: number;
    requiredPermissions: number;
    grantedRequired: number;
    setupCompleted: boolean;
  }> {
    try {
      const state = await this.getHealthPermissionsState();
      const requiredPermissions = state.permissions.filter(p => p.required);
      const grantedRequired = requiredPermissions.filter(p => p.granted);

      return {
        totalPermissions: state.permissions.length,
        grantedPermissions: state.permissions.filter(p => p.granted).length,
        requiredPermissions: requiredPermissions.length,
        grantedRequired: grantedRequired.length,
        setupCompleted: state.setupCompleted,
      };
    } catch (error) {
      console.error('Error getting permissions stats:', error);
      return {
        totalPermissions: 0,
        grantedPermissions: 0,
        requiredPermissions: 0,
        grantedRequired: 0,
        setupCompleted: false,
      };
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
