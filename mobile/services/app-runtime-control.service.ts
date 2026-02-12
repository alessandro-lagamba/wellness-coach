import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { AppRuntimeControl, supabase } from '../lib/supabase';

type RuntimePlatform = 'ios' | 'android';
type RuntimeGateReason = 'maintenance' | 'force_update' | null;
type RuntimeGateSource = 'remote' | 'cache' | 'default';

export interface RuntimeGateDecision {
  block: boolean;
  reason: RuntimeGateReason;
  source: RuntimeGateSource;
  platform: RuntimePlatform;
  currentVersion: string;
  minSupportedVersion: string;
  latestVersion?: string | null;
  title?: string | null;
  message?: string | null;
  updateUrl?: string | null;
}

export class AppRuntimeControlService {
  private static readonly CACHE_PREFIX = '@runtime_control';
  private static readonly REQUEST_TIMEOUT_MS = 5000;

  private static getPlatform(): RuntimePlatform {
    return Platform.OS === 'ios' ? 'ios' : 'android';
  }

  private static getCacheKey(platform: RuntimePlatform): string {
    return `${this.CACHE_PREFIX}:${platform}`;
  }

  static getCurrentVersion(): string {
    const expoVersion = Constants.expoConfig?.version;
    const nativeVersion = Constants.nativeApplicationVersion;
    return nativeVersion || expoVersion || '0.0.0';
  }

  private static withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('RUNTIME_CONTROL_TIMEOUT')), timeoutMs);

      Promise.resolve(promise)
        .then((value) => {
          clearTimeout(timer);
          resolve(value);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  private static toVersionParts(version: string): number[] {
    const sanitized = version.trim().split(/[+-]/)[0];
    if (!sanitized) return [0];

    return sanitized
      .split('.')
      .map((part) => {
        const numericPart = part.match(/^\d+/)?.[0] ?? '0';
        const parsed = Number.parseInt(numericPart, 10);
        return Number.isFinite(parsed) ? parsed : 0;
      });
  }

  static compareVersions(a: string, b: string): number {
    const aParts = this.toVersionParts(a);
    const bParts = this.toVersionParts(b);
    const maxLength = Math.max(aParts.length, bParts.length);

    for (let i = 0; i < maxLength; i += 1) {
      const aPart = aParts[i] ?? 0;
      const bPart = bParts[i] ?? 0;
      if (aPart > bPart) return 1;
      if (aPart < bPart) return -1;
    }

    return 0;
  }

  private static normalizeControlRow(raw: any, platform: RuntimePlatform): AppRuntimeControl {
    const rawPlatform = raw?.platform;
    const normalizedPlatform =
      rawPlatform === 'ios' || rawPlatform === 'android' || rawPlatform === 'all'
        ? rawPlatform
        : platform;

    return {
      platform: normalizedPlatform === 'all' ? platform : normalizedPlatform,
      min_supported_version: typeof raw?.min_supported_version === 'string' && raw.min_supported_version.trim()
        ? raw.min_supported_version.trim()
        : '0.0.0',
      latest_version: typeof raw?.latest_version === 'string' ? raw.latest_version : null,
      force_update: Boolean(raw?.force_update),
      is_maintenance: Boolean(raw?.is_maintenance),
      maintenance_title: raw?.maintenance_title ?? null,
      maintenance_message: raw?.maintenance_message ?? null,
      update_url: typeof raw?.update_url === 'string' ? raw.update_url : null,
      updated_at: typeof raw?.updated_at === 'string' ? raw.updated_at : new Date().toISOString(),
    };
  }

  private static async fetchRemoteControl(platform: RuntimePlatform): Promise<AppRuntimeControl> {
    const rpcResponse = await this.withTimeout(
      supabase.rpc('get_app_runtime_control', { p_platform: platform }),
      this.REQUEST_TIMEOUT_MS
    );
    const { data, error } = rpcResponse as { data: any; error: any };

    if (error) {
      throw error;
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      throw new Error('RUNTIME_CONTROL_EMPTY_RESPONSE');
    }

    const normalized = this.normalizeControlRow(row, platform);
    await AsyncStorage.setItem(this.getCacheKey(platform), JSON.stringify(normalized));
    return normalized;
  }

  private static async readCachedControl(platform: RuntimePlatform): Promise<AppRuntimeControl | null> {
    try {
      const raw = await AsyncStorage.getItem(this.getCacheKey(platform));
      if (!raw) return null;
      return this.normalizeControlRow(JSON.parse(raw), platform);
    } catch {
      return null;
    }
  }

  private static getDefaultControl(platform: RuntimePlatform): AppRuntimeControl {
    return {
      platform,
      min_supported_version: '0.0.0',
      latest_version: null,
      force_update: false,
      is_maintenance: false,
      maintenance_title: null,
      maintenance_message: null,
      update_url: null,
      updated_at: new Date().toISOString(),
    };
  }

  private static evaluateDecision(
    control: AppRuntimeControl,
    source: RuntimeGateSource,
    currentVersion: string,
    platform: RuntimePlatform
  ): RuntimeGateDecision {
    const belowMinimum = this.compareVersions(currentVersion, control.min_supported_version) < 0;
    const blockForUpdate = control.force_update && belowMinimum;
    const blockForMaintenance = control.is_maintenance;
    const reason: RuntimeGateReason = blockForMaintenance
      ? 'maintenance'
      : blockForUpdate
        ? 'force_update'
        : null;

    return {
      block: Boolean(reason),
      reason,
      source,
      platform,
      currentVersion,
      minSupportedVersion: control.min_supported_version,
      latestVersion: control.latest_version ?? null,
      title: control.maintenance_title ?? null,
      message: control.maintenance_message ?? null,
      updateUrl: control.update_url ?? null,
    };
  }

  static async getRuntimeGateDecision(forceRefresh: boolean = false): Promise<RuntimeGateDecision> {
    const platform = this.getPlatform();
    const currentVersion = this.getCurrentVersion();

    try {
      const remote = await this.fetchRemoteControl(platform);
      return this.evaluateDecision(remote, 'remote', currentVersion, platform);
    } catch (error) {
      console.warn(
        `[RuntimeControl] ${forceRefresh ? 'Forced refresh' : 'Remote fetch'} failed, using fallback:`,
        error
      );
    }

    const cached = await this.readCachedControl(platform);
    if (cached) {
      return this.evaluateDecision(cached, 'cache', currentVersion, platform);
    }

    return this.evaluateDecision(this.getDefaultControl(platform), 'default', currentVersion, platform);
  }
}
