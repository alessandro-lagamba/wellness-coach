// 🔥 PATCH FOR react-native-health v1.19.0
// This file should be copied to node_modules/react-native-health/index.js after npm install
// 
// FIX: Removed Proxy pattern which doesn't work reliably with Hermes bytecode compilation.
// Uses direct module access with eager initialization instead.

import { Activities, Observers, Permissions, Units } from './src/constants'
import { NativeModules, Platform } from 'react-native'

let nativeModule = null;
let moduleInitialized = false;

const initializeModule = () => {
    if (moduleInitialized) {
        return nativeModule;
    }

    moduleInitialized = true;

    if (Platform.OS !== 'ios') {
        console.log('[react-native-health] Not iOS, returning null');
        nativeModule = null;
        return null;
    }

    // Strategy 1: Direct NativeModules access
    if (NativeModules.AppleHealthKit) {
        console.log('[react-native-health] ✅ Found AppleHealthKit via NativeModules');
        nativeModule = NativeModules.AppleHealthKit;
        return nativeModule;
    }

    // Strategy 2: Alternative module names
    const alternativeNames = ['RNAppleHealthKit', 'RNHealthKit', 'AppleHealthKitModule'];
    for (const name of alternativeNames) {
        if (NativeModules[name]) {
            console.log(`[react-native-health] ✅ Found module via: ${name}`);
            nativeModule = NativeModules[name];
            return nativeModule;
        }
    }

    // Strategy 3: TurboModuleRegistry
    try {
        const TurboModuleRegistry = require('react-native/Libraries/TurboModule/TurboModuleRegistry');
        if (TurboModuleRegistry?.get) {
            const turboModule = TurboModuleRegistry.get('AppleHealthKit');
            if (turboModule) {
                console.log('[react-native-health] ✅ Found via TurboModuleRegistry');
                nativeModule = turboModule;
                return nativeModule;
            }
        }
    } catch (e) { }

    console.error('[react-native-health] ❌ Native module NOT FOUND');
    nativeModule = null;
    return null;
};

initializeModule();

const createHealthKitWrapper = () => {
    const module = initializeModule();

    if (!module) {
        const stub = (name) => (...args) => {
            console.error(`[react-native-health] ${name}() unavailable`);
            const cb = args.find(a => typeof a === 'function');
            if (cb) cb('Module unavailable', null);
        };
        return {
            Constants: { Activities, Observers, Permissions, Units },
            initHealthKit: stub('initHealthKit'),
            isAvailable: stub('isAvailable'),
            getStepCount: stub('getStepCount'),
            getHeartRateSamples: stub('getHeartRateSamples'),
            getSleepSamples: stub('getSleepSamples'),
            getHeartRateVariabilitySamples: stub('getHeartRateVariabilitySamples'),
            getActiveEnergyBurned: stub('getActiveEnergyBurned'),
            getDistanceWalkingRunning: stub('getDistanceWalkingRunning'),
            getAuthStatus: stub('getAuthStatus'),
        };
    }

    const wrapper = { Constants: { Activities, Observers, Permissions, Units } };
    const methods = [
        'initHealthKit', 'isAvailable', 'getAuthStatus', 'getStepCount',
        'getDailyStepCountSamples', 'getHeartRateSamples', 'getRestingHeartRate',
        'getHeartRateVariabilitySamples', 'getSleepSamples', 'getActiveEnergyBurned',
        'getBasalEnergyBurned', 'getDistanceWalkingRunning', 'getDistanceCycling',
        'getFlightsClimbed', 'getLatestWeight', 'getWeightSamples', 'saveWeight',
        'getLatestHeight', 'getHeightSamples', 'getLatestBmi', 'getBmiSamples',
        'getLatestBodyFatPercentage', 'getBodyFatPercentageSamples',
        'getBloodPressureSamples', 'getBloodGlucoseSamples', 'getOxygenSaturationSamples',
        'getRespiratoryRateSamples', 'getMindfulSessionSamples', 'getWorkoutRouteSamples',
        'setObserver', 'saveSteps', 'saveFood', 'saveWater', 'saveMindfulSession', 'saveWorkout',
    ];

    for (const m of methods) {
        wrapper[m] = typeof module[m] === 'function'
            ? module[m].bind(module)
            : (...args) => {
                const cb = args.find(a => typeof a === 'function');
                if (cb) cb(null, null);
            };
    }

    return wrapper;
};

const AppleHealthKit = createHealthKitWrapper();
export const HealthKit = AppleHealthKit;
export default AppleHealthKit;
module.exports = AppleHealthKit;
