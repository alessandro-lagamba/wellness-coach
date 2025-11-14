// Wellness Activity Sync Service
import CalendarService, { CalendarEvent } from './calendar.service';
import { NotificationService } from './notifications.service';
import { getUserLanguage } from './language.service';

export interface WellnessActivity {
  id: string;
  title: string;
  description: string;
  startTime: Date;
  endTime: Date;
  category: 'mindfulness' | 'movement' | 'nutrition' | 'recovery';
  reminderMinutes?: number; // Minutes before activity to remind
  recurrence?: 'daily' | 'weekly' | 'monthly';
  syncToCalendar: boolean;
  syncToReminders: boolean;
  calendarEventId?: string;
  reminderId?: string;
}

// Helper interface per compatibilità
interface WellnessReminder {
  id: string;
  title: string;
  body: string;
  triggerDate: Date;
  category: 'wellness' | 'mindfulness' | 'movement' | 'nutrition' | 'recovery';
  activityId: string;
  repeat?: 'daily' | 'weekly' | 'monthly';
}

export class WellnessSyncService {
  private static instance: WellnessSyncService;
  private calendarService: CalendarService;

  public static getInstance(): WellnessSyncService {
    if (!WellnessSyncService.instance) {
      WellnessSyncService.instance = new WellnessSyncService();
    }
    return WellnessSyncService.instance;
  }

  constructor() {
    this.calendarService = CalendarService.getInstance();
  }

  /**
   * Initialize both calendar and notification services
   */
  async initialize(): Promise<{ calendar: boolean; notifications: boolean }> {
    const [calendarResult, notificationResult] = await Promise.all([
      this.calendarService.initialize(),
      NotificationService.initialize(),
    ]);

    return {
      calendar: calendarResult,
      notifications: notificationResult,
    };
  }

  /**
   * Add a wellness activity and sync to calendar/reminders
   */
  async addWellnessActivity(activity: WellnessActivity): Promise<{
    success: boolean;
    calendarEventId?: string;
    reminderId?: string;
    error?: string;
  }> {
    try {
      let calendarEventId: string | null = null;
      let reminderId: string | null = null;

      // Sync to calendar if enabled
      if (activity.syncToCalendar) {
        const calendarEvent: CalendarEvent = {
          id: activity.id,
          title: activity.title,
          description: activity.description,
          startDate: activity.startTime,
          endDate: activity.endTime,
          recurrence: activity.recurrence,
        };

        calendarEventId = await this.calendarService.addActivityToCalendar(calendarEvent);
      }

      // Sync to reminders if enabled
      if (activity.syncToReminders && activity.reminderMinutes) {
        const reminderTime = new Date(activity.startTime);
        reminderTime.setMinutes(reminderTime.getMinutes() - activity.reminderMinutes);
        
        // Convert category to NotificationCategory
        const notificationCategory = this.mapCategoryToNotificationCategory(activity.category);
        
        // Calculate seconds from now for relative trigger
        const now = new Date();
        const secondsFromNow = Math.max(1, Math.floor((reminderTime.getTime() - now.getTime()) / 1000));
        
        // 🆕 Ottieni la lingua dell'utente per tradurre la notifica
        const userLanguage = await getUserLanguage();
        const notificationBody = userLanguage === 'it' 
          ? `${activity.title}: ${activity.description || 'È il momento della tua attività'}` 
          : `${activity.title}: ${activity.description || 'Time for your activity'}`;
        
        // If reminder is in the future, schedule it
        if (secondsFromNow > 0) {
          reminderId = await NotificationService.schedule(
            notificationCategory,
            activity.title,
            notificationBody,
            {
              secondsFromNow,
              repeats: !!activity.recurrence,
            },
            {
              activityId: activity.id,
              category: activity.category,
            }
          );
        } else {
          // If reminder time has passed, schedule for the next occurrence
          const hour = reminderTime.getHours();
          const minute = reminderTime.getMinutes();
          // Fix weekday: getDay() returns 0=Sun, 1=Mon... but Expo wants 1..7 with Sun=1
          const weekday = activity.recurrence === 'weekly'
            ? ((reminderTime.getDay() === 0 ? 7 : reminderTime.getDay()) as number)
            : undefined;
          
          reminderId = await NotificationService.schedule(
            notificationCategory,
            activity.title,
            notificationBody,
            {
              hour,
              minute,
              weekday,
              repeats: !!activity.recurrence,
            },
            {
              activityId: activity.id,
              category: activity.category,
            }
          );
        }
      }

      return {
        success: true,
        calendarEventId: calendarEventId || undefined,
        reminderId: reminderId || undefined,
      };
    } catch (error) {
      console.error('Failed to add wellness activity:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Update a wellness activity and sync changes
   */
  async updateWellnessActivity(activity: WellnessActivity): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // Update calendar event if it exists
      if (activity.calendarEventId && activity.syncToCalendar) {
        const calendarEvent: CalendarEvent = {
          id: activity.id,
          title: activity.title,
          description: activity.description,
          startDate: activity.startTime,
          endDate: activity.endTime,
          recurrence: activity.recurrence,
        };

        await this.calendarService.updateActivityInCalendar(activity.calendarEventId, calendarEvent);
      }

      // Update reminder if it exists
      if (activity.reminderId && activity.syncToReminders) {
        // Cancel existing reminder
        await NotificationService.cancel(activity.reminderId);

        // Schedule new reminder if reminder time is specified
        if (activity.reminderMinutes) {
          const reminderTime = new Date(activity.startTime);
          reminderTime.setMinutes(reminderTime.getMinutes() - activity.reminderMinutes);
          
          const notificationCategory = this.mapCategoryToNotificationCategory(activity.category);
          const now = new Date();
          const secondsFromNow = Math.max(1, Math.floor((reminderTime.getTime() - now.getTime()) / 1000));
          
          // 🆕 Ottieni la lingua dell'utente per tradurre la notifica
          const userLanguage = await getUserLanguage();
          const notificationBody = userLanguage === 'it' 
            ? `${activity.title}: ${activity.description || 'È il momento della tua attività'}` 
            : `${activity.title}: ${activity.description || 'Time for your activity'}`;
          
          if (secondsFromNow > 0) {
            const newReminderId = await NotificationService.schedule(
              notificationCategory,
              activity.title,
              notificationBody,
              {
                secondsFromNow,
                repeats: !!activity.recurrence,
              },
              {
                activityId: activity.id,
                category: activity.category,
              }
            );
            if (newReminderId) {
              activity.reminderId = newReminderId;
            }
          } else {
            const hour = reminderTime.getHours();
            const minute = reminderTime.getMinutes();
            // Fix weekday: getDay() returns 0=Sun, 1=Mon... but Expo wants 1..7 with Sun=1
            const weekday = activity.recurrence === 'weekly'
              ? ((reminderTime.getDay() === 0 ? 7 : reminderTime.getDay()) as number)
              : undefined;
            
            const newReminderId = await NotificationService.schedule(
              notificationCategory,
              activity.title,
              notificationBody,
              {
                hour,
                minute,
                weekday,
                repeats: !!activity.recurrence,
              },
              {
                activityId: activity.id,
                category: activity.category,
              }
            );
            if (newReminderId) {
              activity.reminderId = newReminderId;
            }
          }
        }
      }

      return { success: true };
    } catch (error) {
      console.error('Failed to update wellness activity:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Remove a wellness activity and clean up calendar/reminders
   */
  async removeWellnessActivity(activity: WellnessActivity): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // Remove from calendar if it exists
      if (activity.calendarEventId) {
        await this.calendarService.removeActivityFromCalendar(activity.calendarEventId);
      }

      // Remove reminders if they exist
      if (activity.reminderId) {
        await NotificationService.cancel(activity.reminderId);
      }

      // Also cancel any other reminders for this activity
      // Note: notifications.service.ts doesn't have cancelActivityReminders,
      // so we need to get all scheduled notifications and filter
      try {
        const { getAllScheduledNotificationsAsync, cancelScheduledNotificationAsync } = await import('expo-notifications');
        const scheduled = await getAllScheduledNotificationsAsync();
        const activityNotifications = scheduled.filter(
          (n: any) => n.content?.data?.activityId === activity.id
        );
        for (const notification of activityNotifications) {
          await cancelScheduledNotificationAsync(notification.identifier);
        }
      } catch (error) {
        console.error('Failed to cancel activity reminders:', error);
      }

      return { success: true };
    } catch (error) {
      console.error('Failed to remove wellness activity:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get upcoming activities from calendar
   */
  async getUpcomingActivities(days: number = 7): Promise<CalendarEvent[]> {
    return await this.calendarService.getUpcomingActivities(days);
  }

  /**
   * Get scheduled reminders
   */
  async getScheduledReminders() {
    try {
      const { getAllScheduledNotificationsAsync } = await import('expo-notifications');
      const scheduled = await getAllScheduledNotificationsAsync();
      return scheduled.filter((n: any) => n.content?.data?.category);
    } catch (error) {
      console.error('Failed to get scheduled reminders:', error);
      return [];
    }
  }

  /**
   * Get weekly trend data (placeholder - implement if needed)
   */
  async getWeeklyTrendData(userId: string): Promise<any> {
    // TODO: Implement if needed
    return [];
  }

  /**
   * Check permissions status
   */
  async getPermissionsStatus(): Promise<{ calendar: boolean; notifications: boolean }> {
    const notificationStatus = await NotificationService.ensurePermission();
    return {
      calendar: this.calendarService.hasCalendarPermissions(),
      notifications: notificationStatus,
    };
  }

  /**
   * Request permissions for both services
   */
  async requestPermissions(): Promise<{ calendar: boolean; notifications: boolean }> {
    const [calendarResult, notificationResult] = await Promise.all([
      this.calendarService.requestPermissions(),
      NotificationService.ensurePermission(),
    ]);

    return {
      calendar: calendarResult,
      notifications: notificationResult,
    };
  }

  /**
   * Map wellness activity category to notification category
   */
  private mapCategoryToNotificationCategory(category: 'mindfulness' | 'movement' | 'nutrition' | 'recovery'): 'emotion_skin_reminder' | 'journal_reminder' | 'breathing_break' | 'hydration_reminder' {
    switch (category) {
      case 'mindfulness':
        return 'breathing_break';
      case 'movement':
        return 'emotion_skin_reminder'; // Fallback, could add new category
      case 'nutrition':
        return 'hydration_reminder';
      case 'recovery':
        return 'journal_reminder';
      default:
        return 'journal_reminder';
    }
  }

  /**
   * Create a wellness activity from the Today's Activity data
   */
  createWellnessActivityFromToday(
    activity: {
      id: string;
      title: string;
      description: string;
      time: string;
      category: 'mindfulness' | 'movement' | 'nutrition' | 'recovery';
    },
    syncToCalendar: boolean = true,
    syncToReminders: boolean = true,
    reminderMinutes: number = 15
  ): WellnessActivity {
    // Parse time string (e.g., "8:00 AM", "6:00 PM", "Ongoing")
    const now = new Date();
    let startTime: Date;
    let endTime: Date;

    if (activity.time === 'Ongoing') {
      // For ongoing activities, set to current time
      startTime = new Date();
      endTime = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour duration
    } else {
      // Parse time string
      const timeMatch = activity.time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      if (timeMatch) {
        let hours = parseInt(timeMatch[1]);
        const minutes = parseInt(timeMatch[2]);
        const ampm = timeMatch[3].toUpperCase();

        if (ampm === 'PM' && hours !== 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;

        startTime = new Date(now);
        startTime.setHours(hours, minutes, 0, 0);

        endTime = new Date(startTime);
        endTime.setMinutes(endTime.getMinutes() + 30); // 30 minute duration
      } else {
        // Default to current time if parsing fails
        startTime = new Date();
        endTime = new Date(now.getTime() + 60 * 60 * 1000);
      }
    }

    return {
      id: activity.id,
      title: activity.title,
      description: activity.description,
      startTime,
      endTime,
      category: activity.category,
      reminderMinutes,
      syncToCalendar,
      syncToReminders,
    };
  }
}

export default WellnessSyncService;
