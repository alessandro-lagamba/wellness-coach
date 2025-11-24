import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActionInfo } from './actions.service';

export type ActionStatus = 'added' | 'snoozed' | 'dismissed';

export interface ActionLogEntry {
  id: string;
  title: string;
  description?: string;
  category: ActionInfo['category'];
  priority: ActionInfo['priority'];
  status: ActionStatus;
  timestamp: string;
  snoozeUntil?: string;
}

const STORAGE_KEY = '@wellness:action-log';
const MAX_ENTRIES = 50;

async function readEntries(): Promise<ActionLogEntry[]> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as ActionLogEntry[];
  } catch (error) {
    console.warn('[ActionTracker] Failed to read entries', error);
    return [];
  }
}

async function writeEntries(entries: ActionLogEntry[]) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch (error) {
    console.warn('[ActionTracker] Failed to persist entries', error);
  }
}

export const ActionTrackerService = {
  async logAction(action: ActionInfo, status: ActionStatus, snoozeUntil?: Date) {
    const entries = await readEntries();
    const entry: ActionLogEntry = {
      id: `${action.id}-${Date.now()}`,
      title: action.title,
      description: action.description,
      category: action.category,
      priority: action.priority,
      status,
      timestamp: new Date().toISOString(),
      snoozeUntil: snoozeUntil ? snoozeUntil.toISOString() : undefined,
    };
    await writeEntries([entry, ...entries]);
    return entry;
  },

  async getRecentEntries(limit = 10): Promise<ActionLogEntry[]> {
    const entries = await readEntries();
    return entries.slice(0, limit);
  },
};


