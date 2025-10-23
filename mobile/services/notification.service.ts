// Notifications Service for Wellness Reminders
import { Platform } from 'react-native';

// Conditional import for expo-notifications (only in development builds)
let Notifications: any = null;
try {
  // Debug: log what's available in expo object for import
  console.log('🔍 Debug expo object for import:', {
    hasExpo: typeof expo !== 'undefined',
    expoKeys: typeof expo !== 'undefined' ? Object.keys(expo) : [],
    hasModules: typeof expo !== 'undefined' && expo?.modules,
    hasDevClient: typeof expo !== 'undefined' && expo?.modules?.devclient,
    isDev: __DEV__
  });
  
  // Only import if not in Expo Go (but allow in development build)
  // Check for ExpoDevMenu module which exists in development builds but not Expo Go
  const hasDevMenu = typeof expo !== 'undefined' && expo?.modules?.ExpoDevMenu;
  
  if (!__DEV__ || typeof expo === 'undefined' || hasDevMenu) {
    Notifications = require('expo-notifications');
    console.log('✅ Successfully imported expo-notifications');
  } else {
    console.log('❌ Skipping expo-notifications import (Expo Go detected)');
  }
} catch (error) {
  console.log('expo-notifications not available in Expo Go');
}

export interface WellnessReminder {
  id: string;
  title: string;
  body: string;
  triggerDate: Date;
  category: 'wellness' | 'mindfulness' | 'movement' | 'nutrition' | 'recovery';
  activityId: string;
  repeat?: 'daily' | 'weekly' | 'monthly';
}

// Configure notification behavior (only if available)
if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export class NotificationService {
  private static instance: NotificationService;
  private hasPermissions: boolean = false;

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Initialize notification service and request permissions
   */
  async initialize(): Promise<boolean> {
    try {
      // Check if running in Expo Go (development)
      // Debug: log what's available in expo object
      console.log('🔍 Debug expo object:', {
        hasExpo: typeof expo !== 'undefined',
        expoKeys: typeof expo !== 'undefined' ? Object.keys(expo) : [],
        hasModules: typeof expo !== 'undefined' && expo?.modules,
        hasDevClient: typeof expo !== 'undefined' && expo?.modules?.devclient,
        isDev: __DEV__
      });
      
      // More robust detection: check for ExpoDevMenu module which exists in development builds
      const hasDevMenu = typeof expo !== 'undefined' && expo?.modules?.ExpoDevMenu;
      const isExpoGo = __DEV__ && typeof expo !== 'undefined' && !hasDevMenu;
      
      if (isExpoGo || !Notifications) {
        console.log('Running in Expo Go - notifications limited. Use development build for full functionality.');
        this.hasPermissions = false;
        return false;
      }

      // Request notification permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Notification permissions denied');
        return false;
      }

      this.hasPermissions = true;

      // Configure notification categories for different wellness activities
      await this.setupNotificationCategories();

      console.log('Notification service initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize notification service:', error);
      return false;
    }
  }

  /**
   * Setup notification categories for different types of wellness activities
   */
  private async setupNotificationCategories(): Promise<void> {
    if (!Notifications) return;
    
    const categories = [
      {
        identifier: 'wellness',
        actions: [
          {
            identifier: 'COMPLETE',
            buttonTitle: 'Mark Complete',
            options: { opensAppToForeground: false },
          },
          {
            identifier: 'SNOOZE',
            buttonTitle: 'Remind Later',
            options: { opensAppToForeground: false },
          },
        ],
      },
      {
        identifier: 'mindfulness',
        actions: [
          {
            identifier: 'START_MEDITATION',
            buttonTitle: 'Start Now',
            options: { opensAppToForeground: true },
          },
          {
            identifier: 'SNOOZE',
            buttonTitle: 'Later',
            options: { opensAppToForeground: false },
          },
        ],
      },
      {
        identifier: 'movement',
        actions: [
          {
            identifier: 'START_WORKOUT',
            buttonTitle: 'Start Workout',
            options: { opensAppToForeground: true },
          },
          {
            identifier: 'SNOOZE',
            buttonTitle: 'Later',
            options: { opensAppToForeground: false },
          },
        ],
      },
      {
        identifier: 'nutrition',
        actions: [
          {
            identifier: 'LOG_INTAKE',
            buttonTitle: 'Log Intake',
            options: { opensAppToForeground: true },
          },
          {
            identifier: 'SNOOZE',
            buttonTitle: 'Later',
            options: { opensAppToForeground: false },
          },
        ],
      },
    ];

    await Notifications.setNotificationCategoryAsync('wellness', categories[0].actions);
    await Notifications.setNotificationCategoryAsync('mindfulness', categories[1].actions);
    await Notifications.setNotificationCategoryAsync('movement', categories[2].actions);
    await Notifications.setNotificationCategoryAsync('nutrition', categories[3].actions);
  }

  /**
   * Schedule a wellness reminder
   */
  async scheduleReminder(reminder: WellnessReminder): Promise<string | null> {
    if (!this.hasPermissions || !Notifications) {
      console.log('Notification permissions not granted or not available');
      return null;
    }

    try {
      const trigger: Notifications.NotificationTriggerInput = {
        date: reminder.triggerDate,
        repeats: !!reminder.repeat,
      };

      // Add repeat interval if specified
      if (reminder.repeat) {
        trigger.seconds = this.getRepeatInterval(reminder.repeat);
      }

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: reminder.title,
          body: reminder.body,
          categoryIdentifier: reminder.category,
          data: {
            activityId: reminder.activityId,
            category: reminder.category,
          },
        },
        trigger,
      });

      console.log('Reminder scheduled:', notificationId);
      return notificationId;
    } catch (error) {
      console.error('Failed to schedule reminder:', error);
      return null;
    }
  }

  /**
   * Cancel a scheduled reminder
   */
  async cancelReminder(notificationId: string): Promise<boolean> {
    if (!Notifications) return false;
    
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
      console.log('Reminder cancelled:', notificationId);
      return true;
    } catch (error) {
      console.error('Failed to cancel reminder:', error);
      return false;
    }
  }

  /**
   * Cancel all reminders for a specific activity
   */
  async cancelActivityReminders(activityId: string): Promise<boolean> {
    if (!Notifications) return false;
    
    try {
      const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
      
      const activityNotifications = scheduledNotifications.filter(
        notification => notification.content.data?.activityId === activityId
      );

      for (const notification of activityNotifications) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }

      console.log(`Cancelled ${activityNotifications.length} reminders for activity:`, activityId);
      return true;
    } catch (error) {
      console.error('Failed to cancel activity reminders:', error);
      return false;
    }
  }

  /**
   * Get all scheduled wellness reminders
   */
  async getScheduledReminders(): Promise<any[]> {
    if (!Notifications) return [];
    
    try {
      const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
      
      return scheduledNotifications.filter(
        notification => notification.content.data?.category
      );
    } catch (error) {
      console.error('Failed to get scheduled reminders:', error);
      return [];
    }
  }

  /**
   * Convert repeat type to seconds
   */
  private getRepeatInterval(repeat: string): number {
    switch (repeat) {
      case 'daily':
        return 24 * 60 * 60; // 24 hours
      case 'weekly':
        return 7 * 24 * 60 * 60; // 7 days
      case 'monthly':
        return 30 * 24 * 60 * 60; // 30 days
      default:
        return 0;
    }
  }

  /**
   * Check if notification permissions are granted
   */
  hasNotificationPermissions(): boolean {
    return this.hasPermissions;
  }

  /**
   * Request notification permissions again
   */
  async requestPermissions(): Promise<boolean> {
    return await this.initialize();
  }

  /**
   * Setup notification response handler
   */
  setupNotificationHandlers() {
    if (!Notifications) return;
    
    // Handle notification responses (when user taps on notification)
    Notifications.addNotificationResponseReceivedListener(response => {
      const { actionIdentifier, notification } = response;
      const data = notification.request.content.data;

      console.log('Notification response:', { actionIdentifier, data });

      // Handle different action types
      switch (actionIdentifier) {
        case 'COMPLETE':
          // Mark activity as complete
          console.log('Activity marked as complete:', data?.activityId);
          break;
        case 'START_MEDITATION':
        case 'START_WORKOUT':
        case 'LOG_INTAKE':
          // Open app to specific screen
          console.log('Opening app for activity:', data?.activityId);
          break;
        case 'SNOOZE':
          // Reschedule for later
          console.log('Snoozing activity:', data?.activityId);
          break;
        default:
          // Default action - just open the app
          console.log('Opening app');
          break;
      }
    });

    // Handle notifications received while app is in foreground
    Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
    });
  }
}

export default NotificationService;
