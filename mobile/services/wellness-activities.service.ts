// Wellness Activities Service
// Gestisce il salvataggio e il recupero delle attività wellness dal database
import { supabase } from '../lib/supabase';
import { AuthService } from './auth.service';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface WellnessActivityDB {
  id: string;
  user_id: string;
  title: string;
  description: string;
  category: 'mindfulness' | 'movement' | 'nutrition' | 'recovery';
  scheduled_time: string; // HH:mm format
  scheduled_date: string; // YYYY-MM-DD format
  completed: boolean;
  reminder_id?: string;
  calendar_event_id?: string;
  created_at: string;
  updated_at: string;
}

export interface WellnessActivityInput {
  title: string;
  description: string;
  category: 'mindfulness' | 'movement' | 'nutrition' | 'recovery';
  scheduledTime: Date; // Date con orario
  reminderId?: string;
  calendarEventId?: string;
}

class WellnessActivitiesService {
  private static instance: WellnessActivitiesService;
  private readonly STORAGE_KEY = 'wellness_activities_cache';

  public static getInstance(): WellnessActivitiesService {
    if (!WellnessActivitiesService.instance) {
      WellnessActivitiesService.instance = new WellnessActivitiesService();
    }
    return WellnessActivitiesService.instance;
  }

  /**
   * Salva un'attività wellness nel database
   */
  async saveActivity(activity: WellnessActivityInput): Promise<{
    success: boolean;
    activityId?: string;
    error?: string;
  }> {
    try {
      const currentUser = await AuthService.getCurrentUser();
      if (!currentUser?.id) {
        return { success: false, error: 'User not authenticated' };
      }

      // ✅ FIX: Use local timezone for scheduled date to avoid timezone issues
      const scheduledTime = activity.scheduledTime;
      const scheduledDate = `${scheduledTime.getFullYear()}-${String(scheduledTime.getMonth() + 1).padStart(2, '0')}-${String(scheduledTime.getDate()).padStart(2, '0')}`;
      const scheduledTimeStr = `${String(scheduledTime.getHours()).padStart(2, '0')}:${String(scheduledTime.getMinutes()).padStart(2, '0')}`; // HH:mm

      const { data, error } = await supabase
        .from('wellness_activities')
        .insert({
          user_id: currentUser.id,
          title: activity.title,
          description: activity.description,
          category: activity.category,
          scheduled_date: scheduledDate,
          scheduled_time: scheduledTimeStr,
          completed: false,
          reminder_id: activity.reminderId || null,
          calendar_event_id: activity.calendarEventId || null,
        })
        .select()
        .single();

      if (error) {
        console.error('Error saving wellness activity:', error);
        return { success: false, error: error.message };
      }

      // Invalida la cache
      await this.invalidateCache(currentUser.id);

      return { success: true, activityId: data.id };
    } catch (error) {
      console.error('Error in saveActivity:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Recupera le attività per una data specifica
   */
  async getActivitiesForDate(date: Date): Promise<WellnessActivityDB[]> {
    try {
      const currentUser = await AuthService.getCurrentUser();
      if (!currentUser?.id) {
        return [];
      }

      // ✅ FIX: Use local timezone for date to avoid timezone issues
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

      const { data, error } = await supabase
        .from('wellness_activities')
        .select('*')
        .eq('user_id', currentUser.id)
        .eq('scheduled_date', dateStr)
        .order('scheduled_time', { ascending: true });

      if (error) {
        console.error('Error fetching wellness activities:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getActivitiesForDate:', error);
      return [];
    }
  }

  /**
   * Recupera le attività per oggi
   */
  async getTodayActivities(): Promise<WellnessActivityDB[]> {
    return this.getActivitiesForDate(new Date());
  }

  /**
   * Aggiorna lo stato di completamento di un'attività
   */
  async markActivityCompleted(activityId: string, completed: boolean): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const currentUser = await AuthService.getCurrentUser();
      if (!currentUser?.id) {
        return { success: false, error: 'User not authenticated' };
      }

      const { error } = await supabase
        .from('wellness_activities')
        .update({ completed, updated_at: new Date().toISOString() })
        .eq('id', activityId)
        .eq('user_id', currentUser.id);

      if (error) {
        console.error('Error updating wellness activity:', error);
        return { success: false, error: error.message };
      }

      // Invalida la cache
      await this.invalidateCache(currentUser.id);

      return { success: true };
    } catch (error) {
      console.error('Error in markActivityCompleted:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Elimina un'attività
   */
  async deleteActivity(activityId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const currentUser = await AuthService.getCurrentUser();
      if (!currentUser?.id) {
        return { success: false, error: 'User not authenticated' };
      }

      const { error } = await supabase
        .from('wellness_activities')
        .delete()
        .eq('id', activityId)
        .eq('user_id', currentUser.id);

      if (error) {
        console.error('Error deleting wellness activity:', error);
        return { success: false, error: error.message };
      }

      // Invalida la cache
      await this.invalidateCache(currentUser.id);

      return { success: true };
    } catch (error) {
      console.error('Error in deleteActivity:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Invalida la cache locale
   */
  private async invalidateCache(userId: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(`${this.STORAGE_KEY}:${userId}`);
    } catch (error) {
      console.error('Error invalidating cache:', error);
    }
  }
}

const wellnessActivitiesService = WellnessActivitiesService.getInstance();
export default wellnessActivitiesService;
export { WellnessActivitiesService };

