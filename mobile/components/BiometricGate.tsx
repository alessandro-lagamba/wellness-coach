/**
 * BiometricGate Component
 * 
 * A wrapper component that requires biometric authentication before
 * showing sensitive content. Uses the existing BiometricAuthService.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BiometricAuthService } from '../services/biometric-auth.service';

interface BiometricGateProps {
    children: React.ReactNode;
    /** Title to show on the lock screen */
    title?: string;
    /** Description text */
    description?: string;
    /** Whether biometric lock is enabled for this screen */
    enabled?: boolean;
    /** Callback when authentication fails */
    onAuthFailed?: () => void;
    /** Callback when user cancels */
    onCancel?: () => void;
}

export const BiometricGate: React.FC<BiometricGateProps> = ({
    children,
    title = 'Contenuto Protetto',
    description = 'Autenticati per accedere a questo contenuto',
    enabled = true,
    onAuthFailed,
    onCancel,
}) => {
    const insets = useSafeAreaInsets();
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [biometricType, setBiometricType] = useState<string>('biometrico');

    const checkBiometricAvailability = useCallback(async () => {
        try {
            const type = await BiometricAuthService.getSupportedBiometricType();
            setBiometricType(type);
        } catch {
            // Default to generic "biometric"
        }
    }, []);

    const authenticate = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const result = await BiometricAuthService.authenticateWithBiometric(
                `Autenticati per accedere a ${title.toLowerCase()}`
            );

            if (result.success) {
                setIsUnlocked(true);
            } else {
                setError(result.error || 'Autenticazione fallita');
                onAuthFailed?.();
            }
        } catch (err) {
            setError('Errore durante l\'autenticazione');
            onAuthFailed?.();
        } finally {
            setIsLoading(false);
        }
    }, [title, onAuthFailed]);

    useEffect(() => {
        if (!enabled) {
            setIsUnlocked(true);
            setIsLoading(false);
            return;
        }

        checkBiometricAvailability();
        authenticate();
    }, [enabled, authenticate, checkBiometricAvailability]);

    // If not enabled or already unlocked, show children
    if (!enabled || isUnlocked) {
        return <>{children}</>;
    }

    // Show lock screen
    return (
        <LinearGradient
            colors={['#1a1a2e', '#16213e', '#0f0f23']}
            style={[styles.container, { paddingTop: insets.top }]}
        >
            <View style={styles.content}>
                {/* Lock Icon */}
                <View style={styles.iconContainer}>
                    <Ionicons name="lock-closed" size={64} color="#a855f7" />
                </View>

                {/* Title */}
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.description}>{description}</Text>

                {/* Error Message */}
                {error && (
                    <View style={styles.errorContainer}>
                        <Ionicons name="warning" size={20} color="#ef4444" />
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                )}

                {/* Action Buttons */}
                <View style={styles.actions}>
                    {isLoading ? (
                        <ActivityIndicator size="large" color="#a855f7" />
                    ) : (
                        <>
                            <TouchableOpacity
                                style={styles.primaryButton}
                                onPress={authenticate}
                            >
                                <Ionicons
                                    name={biometricType === 'Face ID' ? 'scan' : 'finger-print'}
                                    size={24}
                                    color="#fff"
                                />
                                <Text style={styles.primaryButtonText}>
                                    Usa {biometricType}
                                </Text>
                            </TouchableOpacity>

                            {onCancel && (
                                <TouchableOpacity
                                    style={styles.secondaryButton}
                                    onPress={onCancel}
                                >
                                    <Text style={styles.secondaryButtonText}>Annulla</Text>
                                </TouchableOpacity>
                            )}
                        </>
                    )}
                </View>
            </View>

            {/* Privacy Note */}
            <View style={[styles.privacyNote, { paddingBottom: insets.bottom + 16 }]}>
                <Ionicons name="shield-checkmark" size={16} color="#6b7280" />
                <Text style={styles.privacyText}>
                    I tuoi dati sono protetti e archiviati in modo sicuro sul dispositivo
                </Text>
            </View>
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    iconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: 'rgba(168, 85, 247, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
        borderWidth: 2,
        borderColor: 'rgba(168, 85, 247, 0.3)',
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: '#fff',
        textAlign: 'center',
        marginBottom: 8,
    },
    description: {
        fontSize: 16,
        color: '#9ca3af',
        textAlign: 'center',
        marginBottom: 32,
        lineHeight: 24,
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        marginBottom: 24,
        gap: 8,
    },
    errorText: {
        color: '#ef4444',
        fontSize: 14,
        flex: 1,
    },
    actions: {
        alignItems: 'center',
        gap: 16,
        width: '100%',
    },
    primaryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#a855f7',
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 16,
        gap: 12,
        width: '100%',
        shadowColor: '#a855f7',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    primaryButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
    secondaryButton: {
        paddingVertical: 12,
        paddingHorizontal: 24,
    },
    secondaryButtonText: {
        color: '#9ca3af',
        fontSize: 16,
    },
    privacyNote: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
        gap: 8,
    },
    privacyText: {
        color: '#6b7280',
        fontSize: 12,
        textAlign: 'center',
        flex: 1,
    },
});

export default BiometricGate;
