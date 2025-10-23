// Wellness Activity Sync Service
import CalendarService, { CalendarEvent } from './calendar.service';
import NotificationService, { WellnessReminder } from './notification.service';

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

export class WellnessSyncService {
  private static instance: WellnessSyncService;
  private calendarService: CalendarService;
  private notificationService: NotificationService;

  public static getInstance(): WellnessSyncService {
    if (!WellnessSyncService.instance) {
      WellnessSyncService.instance = new WellnessSyncService();
    }
    return WellnessSyncService.instance;
  }

  constructor() {
    this.calendarService = CalendarService.getInstance();
    this.notificationService = NotificationService.getInstance();
  }

  /**
   * Initialize both calendar and notification services
   */
  async initialize(): Promise<{ calendar: boolean; notifications: boolean }> {
    const [calendarResult, notificationResult] = await Promise.all([
      this.calendarService.initialize(),
      this.notificationService.initialize(),
    ]);

    // Setup notification handlers
    this.notificationService.setupNotificationHandlers();

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

        const reminder: WellnessReminder = {
          id: `${activity.id}_reminder`,
          title: activity.title,
          body: `Time for your ${activity.category} activity: ${activity.description}`,
          triggerDate: reminderTime,
          category: activity.category,
          activityId: activity.id,
          repeat: activity.recurrence,
        };

        reminderId = await this.notificationService.scheduleReminder(reminder);
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
        await this.notificationService.cancelReminder(activity.reminderId);

        // Schedule new reminder if reminder time is specified
        if (activity.reminderMinutes) {
          const reminderTime = new Date(activity.startTime);
          reminderTime.setMinutes(reminderTime.getMinutes() - activity.reminderMinutes);

          const reminder: WellnessReminder = {
            id: `${activity.id}_reminder`,
            title: activity.title,
            body: `Time for your ${activity.category} activity: ${activity.description}`,
            triggerDate: reminderTime,
            category: activity.category,
            activityId: activity.id,
            repeat: activity.recurrence,
          };

          const newReminderId = await this.notificationService.scheduleReminder(reminder);
          if (newReminderId) {
            activity.reminderId = newReminderId;
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
        await this.notificationService.cancelReminder(activity.reminderId);
      }

      // Also cancel any other reminders for this activity
      await this.notificationService.cancelActivityReminders(activity.id);

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
    return await this.notificationService.getScheduledReminders();
  }

  /**
   * Check permissions status
   */
  getPermissionsStatus(): { calendar: boolean; notifications: boolean } {
    return {
      calendar: this.calendarService.hasCalendarPermissions(),
      notifications: this.notificationService.hasNotificationPermissions(),
    };
  }

  /**
   * Request permissions for both services
   */
  async requestPermissions(): Promise<{ calendar: boolean; notifications: boolean }> {
    const [calendarResult, notificationResult] = await Promise.all([
      this.calendarService.requestPermissions(),
      this.notificationService.requestPermissions(),
    ]);

    return {
      calendar: calendarResult,
      notifications: notificationResult,
    };
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
