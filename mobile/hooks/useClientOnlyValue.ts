import { Platform } from 'react-native';

/**
 * Use this hook to return different values on web vs native
 */
export function useClientOnlyValue<T>(web: T, native: T): T {
  return Platform.OS === 'web' ? web : native;
}
