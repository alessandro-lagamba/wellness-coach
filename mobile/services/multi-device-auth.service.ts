/**
 * Multi-Device Auth Service
 * Gestisce login multipli e notifiche quando si accede da un nuovo dispositivo
 */

import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { AuthService } from './auth.service';

const DEVICE_ID_KEY = '@wellness:device_id';
const LAST_LOGIN_DEVICE_KEY = '@wellness:last_login_device';
const MULTI_DEVICE_NOTIFICATION_KEY = '@wellness:multi_device_notified';

export class MultiDeviceAuthService {
  /**
   * Genera o recupera un ID univoco per questo dispositivo
   */
  static async getDeviceId(): Promise<string> {
    try {
      let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
      
      if (!deviceId) {
        // Genera un nuovo device ID
        deviceId = `device_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
        await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
      }
      
      return deviceId;
    } catch (error) {
      console.error('Error getting device ID:', error);
      // Fallback: usa timestamp come device ID
      return `device_${Date.now()}`;
    }
  }

  /**
   * Verifica se questo è un nuovo dispositivo per l'utente
   */
  static async isNewDevice(): Promise<boolean> {
    try {
      const currentDeviceId = await this.getDeviceId();
      const lastLoginDeviceId = await AsyncStorage.getItem(LAST_LOGIN_DEVICE_KEY);
      
      // Se non c'è un device ID salvato, è un nuovo dispositivo
      if (!lastLoginDeviceId) {
        return true;
      }
      
      // Se il device ID è diverso, è un nuovo dispositivo
      return currentDeviceId !== lastLoginDeviceId;
    } catch (error) {
      console.error('Error checking if new device:', error);
      return false;
    }
  }

  /**
   * Salva il device ID dopo un login riuscito
   */
  static async saveDeviceAfterLogin(): Promise<void> {
    try {
      const deviceId = await this.getDeviceId();
      await AsyncStorage.setItem(LAST_LOGIN_DEVICE_KEY, deviceId);
    } catch (error) {
      console.error('Error saving device after login:', error);
    }
  }

  /**
   * Verifica se ci sono sessioni attive su altri dispositivi
   * Nota: Supabase gestisce una sessione per volta, quindi questo è più un check teorico
   */
  static async checkOtherDeviceSessions(): Promise<{
    hasOtherSessions: boolean;
    deviceInfo?: string;
  }> {
    try {
      const currentUser = await AuthService.getCurrentUser();
      if (!currentUser) {
        return { hasOtherSessions: false };
      }

      // Controlla se l'ultimo login è stato fatto da un dispositivo diverso
      const isNew = await this.isNewDevice();
      
      if (isNew) {
        // Questo è un nuovo dispositivo
        // In una implementazione più avanzata, potresti salvare i device ID su Supabase
        // e controllare se ci sono altri device ID attivi per questo utente
        
        return {
          hasOtherSessions: true,
          deviceInfo: 'Another device',
        };
      }

      return { hasOtherSessions: false };
    } catch (error) {
      console.error('Error checking other device sessions:', error);
      return { hasOtherSessions: false };
    }
  }

  /**
   * Mostra una notifica quando si accede da un nuovo dispositivo
   */
  static async notifyNewDeviceLogin(): Promise<void> {
    try {
      // Controlla se abbiamo già notificato per questo dispositivo
      const notified = await AsyncStorage.getItem(MULTI_DEVICE_NOTIFICATION_KEY);
      const deviceId = await this.getDeviceId();
      
      if (notified === deviceId) {
        // Già notificato per questo dispositivo
        return;
      }

      const isNew = await this.isNewDevice();
      if (!isNew) {
        return;
      }

      // Mostra notifica locale
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Nuovo dispositivo rilevato',
          body: 'Hai effettuato l\'accesso da un nuovo dispositivo. Se non sei stato tu, cambia la password.',
          data: { type: 'new_device_login' },
        },
        trigger: null, // Mostra immediatamente
      });

      // Salva che abbiamo notificato per questo dispositivo
      await AsyncStorage.setItem(MULTI_DEVICE_NOTIFICATION_KEY, deviceId);
    } catch (error) {
      console.error('Error notifying new device login:', error);
    }
  }

  /**
   * Pulisce le informazioni del dispositivo (utile per logout)
   */
  static async clearDeviceInfo(): Promise<void> {
    try {
      await AsyncStorage.removeItem(LAST_LOGIN_DEVICE_KEY);
      await AsyncStorage.removeItem(MULTI_DEVICE_NOTIFICATION_KEY);
      // Non rimuoviamo DEVICE_ID_KEY perché identifica questo dispositivo
    } catch (error) {
      console.error('Error clearing device info:', error);
    }
  }

  /**
   * Gestisce il login con controllo multi-dispositivo
   * Chiama questa funzione dopo un login riuscito
   */
  static async handleLogin(): Promise<{
    isNewDevice: boolean;
    notified: boolean;
  }> {
    try {
      const isNew = await this.isNewDevice();
      
      if (isNew) {
        // Notifica l'utente
        await this.notifyNewDeviceLogin();
        
        // Salva il device ID
        await this.saveDeviceAfterLogin();
        
        return {
          isNewDevice: true,
          notified: true,
        };
      } else {
        // Salva comunque il device ID (per sicurezza)
        await this.saveDeviceAfterLogin();
        
        return {
          isNewDevice: false,
          notified: false,
        };
      }
    } catch (error) {
      console.error('Error handling login:', error);
      return {
        isNewDevice: false,
        notified: false,
      };
    }
  }
}


