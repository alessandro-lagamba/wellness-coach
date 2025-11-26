/**
 * Utility functions for locale-aware formatting
 * Ensures dates, times, numbers, and currencies are formatted correctly
 * based on user's locale and system preferences
 */

import { Platform } from 'react-native';

/**
 * Get the user's locale (language + region)
 */
export const getUserLocale = (language?: string): string => {
  if (language === 'it') return 'it-IT';
  if (language === 'en') return 'en-US';
  // Fallback to system locale
  return Platform.OS === 'ios' 
    ? 'en-US' // iOS doesn't expose locale easily, default to en-US
    : 'en-US';
};

/**
 * Format a date using locale-specific format
 */
export const formatDate = (date: Date, language?: string, options?: Intl.DateTimeFormatOptions): string => {
  const locale = getUserLocale(language);
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  };
  return new Intl.DateTimeFormat(locale, { ...defaultOptions, ...options }).format(date);
};

/**
 * Format a time using locale-specific format (respects 12h/24h preference)
 */
export const formatTime = (date: Date, language?: string, options?: Intl.DateTimeFormatOptions): string => {
  const locale = getUserLocale(language);
  const defaultOptions: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    hour12: undefined, // Let system decide
  };
  return new Intl.DateTimeFormat(locale, { ...defaultOptions, ...options }).format(date);
};

/**
 * Format a number with locale-specific decimal separator
 */
export const formatNumber = (value: number, language?: string, options?: Intl.NumberFormatOptions): string => {
  const locale = getUserLocale(language);
  return new Intl.NumberFormat(locale, options).format(value);
};

/**
 * Format a decimal number (respects locale decimal separator)
 */
export const formatDecimal = (value: number, decimals: number = 1, language?: string): string => {
  return formatNumber(value, language, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

/**
 * Format a currency value (if needed in future)
 */
export const formatCurrency = (value: number, currency: string = 'EUR', language?: string): string => {
  const locale = getUserLocale(language);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(value);
};

/**
 * Get today's date in local timezone as ISO string (YYYY-MM-DD)
 * This ensures "today" is always the local date, not UTC
 * ⚠️ IMPORTANT: Use this instead of new Date().toISOString().slice(0, 10)
 * to avoid timezone issues
 */
export const getTodayISODate = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Convert a Date to ISO date string (YYYY-MM-DD) using local timezone
 * This is critical for timezone-aware date handling
 */
export const toLocalISODate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Parse an ISO date string (YYYY-MM-DD) to a Date object in local timezone
 */
export const fromLocalISODate = (iso: string): Date => {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date();
  date.setFullYear(year || date.getFullYear(), (month || 1) - 1, day || 1);
  date.setHours(0, 0, 0, 0);
  return date;
};

/**
 * Check if a date is today (in local timezone)
 */
export const isToday = (date: Date | string): boolean => {
  const dateObj = typeof date === 'string' ? fromLocalISODate(date) : date;
  const today = getTodayISODate();
  const dateStr = toLocalISODate(dateObj);
  return today === dateStr;
};

/**
 * Check if a date is yesterday (in local timezone)
 */
export const isYesterday = (date: Date | string): boolean => {
  const dateObj = typeof date === 'string' ? fromLocalISODate(date) : date;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = toLocalISODate(yesterday);
  const dateStr = toLocalISODate(dateObj);
  return yesterdayStr === dateStr;
};

/**
 * Get system 24-hour format preference
 * Note: This is a best-effort detection, as React Native doesn't expose this directly
 */
export const is24HourFormat = (): boolean => {
  // On iOS, we can check the system preference
  // On Android, we can try to detect from system settings
  // For now, default to false (12-hour) for US, true for most other locales
  // This should be enhanced with a native module if needed
  try {
    const testDate = new Date();
    const testString = testDate.toLocaleTimeString();
    // If the string contains AM/PM, it's 12-hour format
    return !testString.match(/AM|PM/i);
  } catch {
    return false; // Default to 12-hour
  }
};

