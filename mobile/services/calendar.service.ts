// Calendar and Reminders Integration Service
import * as Calendar from 'expo-calendar';
import * as Notifications from 'expo-notifications';

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  startDate: Date;
  endDate: Date;
  location?: string;
  notes?: string;
  recurrence?: 'daily' | 'weekly' | 'monthly' | 'yearly';
}

export interface ReminderNotification {
  id: string;
  title: string;
  body: string;
  triggerDate: Date;
  category: 'wellness' | 'mindfulness' | 'movement' | 'nutrition' | 'recovery';
}

export class CalendarService {
  private static instance: CalendarService;
  private calendarId: string | null = null;
  private hasPermissions: boolean = false;

  /**
   * Keeps track of whether we've already attempted to lazily hydrate the calendar id.
   * Prevents repeated setup calls when checking permission status at app start.
   */
  private attemptedLazySetup = false;

  public static getInstance(): CalendarService {
    if (!CalendarService.instance) {
      CalendarService.instance = new CalendarService();
    }
    return CalendarService.instance;
  }

  /**
   * Initialize calendar service and request permissions
   */
  async initialize(): Promise<boolean> {
    try {
      // Request calendar permissions
      const { status } = await Calendar.requestCalendarPermissionsAsync();

      if (status === 'granted') {
        this.hasPermissions = true;

        // Get or create a calendar for wellness activities
        await this.setupWellnessCalendar();

        console.log('Calendar service initialized successfully');
        return true;
      } else {
        console.log('Calendar permissions denied');
        return false;
      }
    } catch (error) {
      console.error('Failed to initialize calendar service:', error);
      return false;
    }
  }

  /**
   * Refresh permission status without prompting the user.
   * Useful for silently checking current state on app launch.
   */
  async refreshPermissionStatus(): Promise<boolean> {
    try {
      const { status } = await Calendar.getCalendarPermissionsAsync();
      this.hasPermissions = status === 'granted';

      if (this.hasPermissions && !this.calendarId && !this.attemptedLazySetup) {
        this.attemptedLazySetup = true;
        await this.setupWellnessCalendar();
      }

      return this.hasPermissions;
    } catch (error) {
      console.error('Failed to refresh calendar permission status:', error);
      return false;
    }
  }

  /**
   * Setup a dedicated calendar for wellness activities
   */
  private async setupWellnessCalendar(): Promise<void> {
    try {
      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);

      // Look for existing wellness calendar
      const existingCalendar = calendars.find(cal =>
        cal.title.toLowerCase().includes('wellness') ||
        cal.title.toLowerCase().includes('health')
      );

      if (existingCalendar) {
        this.calendarId = existingCalendar.id;
      } else {
        // Create a new wellness calendar
        const defaultCalendarSource = calendars.find(cal => cal.source.name === 'Default') || calendars[0];

        if (defaultCalendarSource) {
          this.calendarId = await Calendar.createCalendarAsync({
            title: 'Yachai',
            color: '#6366f1',
            entityType: Calendar.EntityTypes.EVENT,
            sourceId: defaultCalendarSource.source.id,
            source: defaultCalendarSource.source,
            name: 'wellness_coach_calendar',
            ownerAccount: 'personal',
            accessLevel: Calendar.CalendarAccessLevel.OWNER,
          });
        }
      }
    } catch (error) {
      console.error('Failed to setup wellness calendar:', error);
    }
  }

  /**
   * Add a wellness activity to the calendar
   */
  async addActivityToCalendar(activity: CalendarEvent): Promise<string | null> {
    if (!this.hasPermissions || !this.calendarId) {
      console.log('Calendar permissions not granted or calendar not setup');
      return null;
    }

    try {
      const eventId = await Calendar.createEventAsync(this.calendarId, {
        title: activity.title,
        startDate: activity.startDate,
        endDate: activity.endDate,
        notes: activity.description,
        location: activity.location,
        recurrenceRule: activity.recurrence ? {
          frequency: activity.recurrence === 'weekly' ? Calendar.Frequency.WEEKLY :
            activity.recurrence === 'monthly' ? Calendar.Frequency.MONTHLY :
              activity.recurrence === 'yearly' ? Calendar.Frequency.YEARLY :
                Calendar.Frequency.DAILY,
          interval: 1,
        } : undefined,
      });

      console.log('Activity added to calendar:', eventId);
      return eventId;
    } catch (error) {
      console.error('Failed to add activity to calendar:', error);
      return null;
    }
  }

  /**
   * Remove an activity from the calendar
   */
  async removeActivityFromCalendar(eventId: string): Promise<boolean> {
    try {
      await Calendar.deleteEventAsync(eventId);
      console.log('Activity removed from calendar:', eventId);
      return true;
    } catch (error) {
      console.error('Failed to remove activity from calendar:', error);
      return false;
    }
  }

  /**
   * Update an activity in the calendar
   */
  async updateActivityInCalendar(eventId: string, activity: CalendarEvent): Promise<boolean> {
    try {
      await Calendar.updateEventAsync(eventId, {
        title: activity.title,
        startDate: activity.startDate,
        endDate: activity.endDate,
        notes: activity.description,
        location: activity.location,
      });
      console.log('Activity updated in calendar:', eventId);
      return true;
    } catch (error) {
      console.error('Failed to update activity in calendar:', error);
      return false;
    }
  }

  /**
   * Get upcoming wellness activities from calendar
   */
  async getUpcomingActivities(days: number = 7): Promise<CalendarEvent[]> {
    if (!this.hasPermissions || !this.calendarId) {
      return [];
    }

    try {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + days);

      const events = await Calendar.getEventsAsync([this.calendarId], startDate, endDate);

      return events.map(event => ({
        id: event.id,
        title: event.title,
        description: event.notes || '',
        startDate: new Date(event.startDate),
        endDate: new Date(event.endDate),
        location: event.location,
        notes: event.notes,
      }));
    } catch (error) {
      console.error('Failed to get upcoming activities:', error);
      return [];
    }
  }

  /**
   * Check if calendar permissions are granted
   */
  hasCalendarPermissions(): boolean {
    return this.hasPermissions;
  }

  /**
   * Request calendar permissions again
   */
  async requestPermissions(): Promise<boolean> {
    return await this.initialize();
  }
}

export default CalendarService;
