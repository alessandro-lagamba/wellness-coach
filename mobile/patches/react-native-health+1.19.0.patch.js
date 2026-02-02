import { Activities, Observers, Permissions, Units } from './src/constants'
import { NativeModules, Platform } from 'react-native'

// Fix for React Native 0.76+ lazy loading of native modules
// Uses multiple strategies to get the native module

// Cache for the native module once found
let cachedAppleHealthKit = null;

const getAppleHealthKit = () => {
    // Return cached instance if available
    if (cachedAppleHealthKit) {
        return cachedAppleHealthKit;
    }

    // Only proceed on iOS
    if (Platform.OS !== 'ios') {
        console.log('[react-native-health] Not iOS, returning empty module');
        return {};
    }

    // Strategy 1: Direct NativeModules access
    const directModule = NativeModules.AppleHealthKit;
    if (directModule) {
        console.log('[react-native-health] ✅ Found AppleHealthKit via NativeModules');
        cachedAppleHealthKit = directModule;
        return directModule;
    }

    // Strategy 2: Try alternative module names (some builds register under different names)
    const alternativeNames = ['RNAppleHealthKit', 'RNHealthKit', 'AppleHealthKitModule'];
    for (const name of alternativeNames) {
        if (NativeModules[name]) {
            console.log(`[react-native-health] ✅ Found module via alternative name: ${name}`);
            cachedAppleHealthKit = NativeModules[name];
            return NativeModules[name];
        }
    }

    // Strategy 3: Try TurboModuleRegistry (React Native 0.76+ bridgeless mode)
    try {
        const TurboModuleRegistry = require('react-native/Libraries/TurboModule/TurboModuleRegistry');
        if (TurboModuleRegistry && TurboModuleRegistry.get) {
            const turboModule = TurboModuleRegistry.get('AppleHealthKit');
            if (turboModule) {
                console.log('[react-native-health] ✅ Found AppleHealthKit via TurboModuleRegistry');
                cachedAppleHealthKit = turboModule;
                return turboModule;
            }
        }
    } catch (e) {
        // TurboModuleRegistry not available, continue
    }

    // If we get here, module truly not found
    console.error('[react-native-health] ❌ AppleHealthKit native module NOT FOUND after all strategies');
    console.error('[react-native-health] Available NativeModules:', Object.keys(NativeModules).filter(k => k.includes('Health') || k.includes('Apple')));

    // Return a stub that throws meaningful errors instead of silently failing
    return new Proxy({}, {
        get(target, prop) {
            if (prop === 'then' || prop === 'catch' || typeof prop === 'symbol') {
                return undefined;
            }
            // Return a function that throws a clear error
            return (...args) => {
                const error = new Error(`[react-native-health] Cannot call ${String(prop)}() - AppleHealthKit native module is not available. Ensure the native module is properly linked.`);
                console.error(error.message);
                // If there's a callback (common pattern), call it with error
                const callback = args.find(arg => typeof arg === 'function');
                if (callback) {
                    callback(error.message, null);
                }
                throw error;
            };
        }
    });
}

// Create a proxy that lazily accesses the native module
const AppleHealthKitProxy = new Proxy({}, {
    get(target, prop) {
        const nativeModule = getAppleHealthKit()
        if (prop === 'Constants') {
            return {
                Activities,
                Observers,
                Permissions,
                Units,
            }
        }
        const value = nativeModule[prop];

        // If accessing a method, ensure proper binding
        if (typeof value === 'function') {
            return value.bind(nativeModule);
        }

        return value;
    },
    has(target, prop) {
        if (prop === 'Constants') return true
        const nativeModule = getAppleHealthKit()
        return prop in nativeModule
    }
})

export const HealthKit = AppleHealthKitProxy

module.exports = AppleHealthKitProxy
