import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { BiometricAuthService, BiometricCapabilities } from '../services/biometric-auth.service';

const { width, height } = Dimensions.get('window');

interface BiometricSetupModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userEmail?: string;
  userPassword?: string;
}

export const BiometricSetupModal: React.FC<BiometricSetupModalProps> = ({
  visible,
  onClose,
  onSuccess,
  userEmail,
  userPassword,
}) => {
  const [capabilities, setCapabilities] = useState<BiometricCapabilities | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [biometricType, setBiometricType] = useState<string>('');

  useEffect(() => {
    if (visible) {
      loadCapabilities();
    }
  }, [visible]);

  const loadCapabilities = async () => {
    setIsLoading(true);
    try {
      const caps = await BiometricAuthService.getCapabilities();
      setCapabilities(caps);
      
      if (caps.isAvailable) {
        const type = await BiometricAuthService.getSupportedBiometricType();
        setBiometricType(type);
      }
    } catch (error) {
      console.error('Error loading biometric capabilities:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnableBiometric = async () => {
    if (!userEmail || !userPassword) {
      Alert.alert('Errore', 'Credenziali non disponibili per la configurazione biometrica');
      return;
    }

    setIsSettingUp(true);
    try {
      // Abilita l'autenticazione biometrica
      const enableResult = await BiometricAuthService.enableBiometric();
      
      if (!enableResult.success) {
        Alert.alert('Errore', enableResult.error || 'Impossibile abilitare l\'autenticazione biometrica');
        return;
      }

      // Salva le credenziali in modo sicuro
      const saveResult = await BiometricAuthService.saveBiometricCredentials(userEmail, userPassword);
      
      if (!saveResult.success) {
        Alert.alert('Errore', saveResult.error || 'Impossibile salvare le credenziali');
        return;
      }

      // Haptic feedback
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      Alert.alert(
        'Successo!',
        `L'autenticazione ${biometricType} è stata configurata con successo. D'ora in poi potrai accedere rapidamente all'app.`,
        [
          {
            text: 'Perfetto!',
            onPress: () => {
              onSuccess();
              onClose();
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error setting up biometric auth:', error);
      Alert.alert('Errore', 'Si è verificato un errore durante la configurazione');
    } finally {
      setIsSettingUp(false);
    }
  };

  const handleSkip = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <BlurView intensity={20} style={styles.blurContainer}>
          <View style={styles.modalContainer}>
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              style={styles.modalGradient}
            >
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.iconContainer}>
                  <MaterialCommunityIcons 
                    name="fingerprint" 
                    size={32} 
                    color="#fff" 
                  />
                </View>
                <Text style={styles.title}>Autenticazione Biometrica</Text>
                <Text style={styles.subtitle}>
                  Configura {biometricType} per un accesso rapido e sicuro
                </Text>
              </View>

              {/* Content */}
              <View style={styles.content}>
                {isLoading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#fff" />
                    <Text style={styles.loadingText}>Verifica delle capacità del dispositivo...</Text>
                  </View>
                ) : capabilities?.isAvailable ? (
                  <View style={styles.availableContainer}>
                    <View style={styles.featureList}>
                      <View style={styles.featureItem}>
                        <MaterialCommunityIcons name="check-circle" size={20} color="#4ade80" />
                        <Text style={styles.featureText}>
                          {biometricType} disponibile su questo dispositivo
                        </Text>
                      </View>
                      <View style={styles.featureItem}>
                        <MaterialCommunityIcons name="check-circle" size={20} color="#4ade80" />
                        <Text style={styles.featureText}>
                          Accesso rapido e sicuro
                        </Text>
                      </View>
                      <View style={styles.featureItem}>
                        <MaterialCommunityIcons name="check-circle" size={20} color="#4ade80" />
                        <Text style={styles.featureText}>
                          Nessuna password da ricordare
                        </Text>
                      </View>
                    </View>

                    <View style={styles.securityNote}>
                      <MaterialCommunityIcons name="shield-check" size={16} color="#fbbf24" />
                      <Text style={styles.securityText}>
                        Le tue credenziali sono protette con crittografia end-to-end
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.unavailableContainer}>
                    <MaterialCommunityIcons name="alert-circle" size={48} color="#f87171" />
                    <Text style={styles.unavailableTitle}>
                      Autenticazione biometrica non disponibile
                    </Text>
                    <Text style={styles.unavailableText}>
                      {!capabilities?.hasHardware 
                        ? 'Il tuo dispositivo non supporta l\'autenticazione biometrica'
                        : 'Configura l\'autenticazione biometrica nelle impostazioni del dispositivo'
                      }
                    </Text>
                  </View>
                )}
              </View>

              {/* Footer */}
              <View style={styles.footer}>
                {capabilities?.isAvailable ? (
                  <View style={styles.buttonContainer}>
                    <TouchableOpacity
                      onPress={handleSkip}
                      style={styles.skipButton}
                      disabled={isSettingUp}
                    >
                      <Text style={styles.skipButtonText}>Salta per ora</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      onPress={handleEnableBiometric}
                      style={styles.enableButton}
                      disabled={isSettingUp}
                    >
                      {isSettingUp ? (
                        <ActivityIndicator size="small" color="#667eea" />
                      ) : (
                        <>
                          <MaterialCommunityIcons name="fingerprint" size={20} color="#667eea" />
                          <Text style={styles.enableButtonText}>Configura {biometricType}</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={handleSkip}
                    style={styles.continueButton}
                  >
                    <Text style={styles.continueButtonText}>Continua</Text>
                  </TouchableOpacity>
                )}
              </View>
            </LinearGradient>
          </View>
        </BlurView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  blurContainer: {
    width: width * 0.9,
    maxWidth: 400,
    borderRadius: 20,
    overflow: 'hidden',
  },
  modalContainer: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  modalGradient: {
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 22,
  },
  content: {
    marginBottom: 24,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 12,
  },
  availableContainer: {
    // Container for available biometric auth
  },
  featureList: {
    marginBottom: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
  },
  featureText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 12,
    flex: 1,
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.2)',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
  },
  securityText: {
    color: '#fff',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  unavailableContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  unavailableTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  unavailableText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 22,
  },
  footer: {
    // Footer container
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skipButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  skipButtonText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
    fontWeight: '500',
  },
  enableButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  enableButtonText: {
    color: '#667eea',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  continueButton: {
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  continueButtonText: {
    color: '#667eea',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

