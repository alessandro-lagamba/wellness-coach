import { Activities, Observers, Permissions, Units } from './src/constants'
import { NativeModules } from 'react-native'

// Fix for React Native 0.76+ lazy loading of native modules
// Instead of destructuring immediately, we use a getter that accesses
// the native module when it's actually needed

const getAppleHealthKit = () => {
    const { AppleHealthKit } = NativeModules
    if (!AppleHealthKit) {
        console.warn('[react-native-health] AppleHealthKit native module not found. Make sure you are running on iOS and have properly linked the native module.')
        return {}
    }
    return AppleHealthKit
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
        return nativeModule[prop]
    },
    has(target, prop) {
        if (prop === 'Constants') return true
        const nativeModule = getAppleHealthKit()
        return prop in nativeModule
    }
})

export const HealthKit = AppleHealthKitProxy

module.exports = AppleHealthKitProxy
