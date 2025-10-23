import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Switch,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { BiometricAuthService } from '../services/biometric-auth.service';
import { AuthService } from '../services/auth.service';

interface BiometricSecurityModalProps {
  visible: boolean;
  onClose: () => void;
  userEmail: string;
}

export const BiometricSecurityModal: React.FC<BiometricSecurityModalProps> = ({
  visible,
  onClose,
  userEmail,
}) => {
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);
  const [canUseBiometric, setCanUseBiometric] = useState(false);
  const [biometricType, setBiometricType] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      checkBiometricStatus();
    }
  }, [visible]);

  const checkBiometricStatus = async () => {
    try {
      setIsLoading(true);
      console.log('🔐 Checking biometric status...');
      
      // Check capabilities first
      const capabilities = await BiometricAuthService.getCapabilities();
      console.log('🔐 Biometric capabilities:', {
        isAvailable: capabilities.isAvailable,
        hasHardware: capabilities.hasHardware,
        isEnrolled: capabilities.isEnrolled,
        supportedTypes: capabilities.supportedTypes,
      });

      const [isEnabled, canUse, type] = await Promise.all([
        BiometricAuthService.isBiometricEnabled(),
        BiometricAuthService.canUseBiometric(),
        BiometricAuthService.getSupportedBiometricType(),
      ]);
      
      console.log('🔐 Biometric status:', {
        isEnabled,
        canUse,
        type,
        deviceSupports: capabilities.isAvailable,
      });
      
      setIsBiometricEnabled(isEnabled);
      setCanUseBiometric(canUse && capabilities.isAvailable);
      setBiometricType(type);
    } catch (error) {
      console.error('Error checking biometric status:', error);
      setCanUseBiometric(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleBiometric = async (value: boolean) => {
    if (!canUseBiometric) {
      Alert.alert('Non disponibile', 'I dati biometrici non sono disponibili su questo dispositivo');
      return;
    }

    if (value) {
      Alert.prompt(
        'Abilita Autenticazione Biometrica',
        'Inserisci la tua password per salvare i dati biometrici',
        [
          {
            text: 'Annulla',
            onPress: () => {},
            style: 'cancel',
          },
          {
            text: 'Abilita',
            onPress: async (password) => {
              if (!password) {
                Alert.alert('Errore', 'La password è obbligatoria');
                return;
              }

              try {
                setIsLoading(true);
                console.log('🔐 Enabling biometric authentication...');

                const { user, error } = await AuthService.signIn(userEmail, password, false);
                if (error) {
                  Alert.alert('Errore', 'Password non corretta');
                  return;
                }

                await BiometricAuthService.saveBiometricCredentials(userEmail, password);
                console.log('✅ Biometric authentication enabled');

                setIsBiometricEnabled(true);
                Alert.alert(
                  'Successo',
                  `Autenticazione biometrica abilitata!\nPotrai accedere usando ${biometricType} al prossimo accesso.`
                );
              } catch (err) {
                console.error('Error enabling biometric:', err);
                Alert.alert('Errore', 'Impossibile abilitare l\'autenticazione biometrica');
              } finally {
                setIsLoading(false);
              }
            },
          },
        ],
        'secure-text'
      );
    } else {
      try {
        setIsLoading(true);
        console.log('🔐 Disabling biometric authentication...');
        await BiometricAuthService.clearBiometricCredentials();
        setIsBiometricEnabled(false);
        Alert.alert('Successo', 'Autenticazione biometrica disabilitata');
      } catch (err) {
        console.error('Error disabling biometric:', err);
        Alert.alert('Errore', 'Impossibile disabilitare l\'autenticazione biometrica');
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <BlurView intensity={20} style={styles.blurContainer}>
          <LinearGradient
            colors={['#667eea', '#764ba2']}
            style={styles.modalContainer}
          >
            <View style={styles.header}>
              <TouchableOpacity onPress={onClose}>
                <MaterialCommunityIcons name="close" size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.title}>Biometric Security</Text>
              <View style={{ width: 24 }} />
            </View>

            <View style={styles.content}>
              <View style={styles.iconContainer}>
                <MaterialCommunityIcons
                  name={biometricType.toLowerCase().includes('face') ? 'face-recognition' : 'fingerprint'}
                  size={60}
                  color="#fff"
                />
              </View>

              <Text style={styles.contentTitle}>
                {canUseBiometric ? `Usa ${biometricType}` : 'Biometrico Non Disponibile'}
              </Text>

              <Text style={styles.contentDescription}>
                {canUseBiometric
                  ? `Abilita l'autenticazione biometrica per accedere all'app in modo sicuro e veloce usando ${biometricType}.`
                  : 'Il tuo dispositivo non supporta l\'autenticazione biometrica.'}
              </Text>

              <View style={styles.statusSection}>
                <View style={styles.statusRow}>
                  <View>
                    <Text style={styles.statusLabel}>Stato Attuale</Text>
                    <Text style={styles.statusValue}>
                      {isBiometricEnabled ? '✅ Abilitato' : '❌ Disabilitato'}
                    </Text>
                  </View>
                  {canUseBiometric && !isLoading && (
                    <Switch
                      value={isBiometricEnabled}
                      onValueChange={handleToggleBiometric}
                      disabled={isLoading}
                      trackColor={{ false: '#cbd5e1', true: '#86efac' }}
                      thumbColor={isBiometricEnabled ? '#22c55e' : '#e2e8f0'}
                    />
                  )}
                  {isLoading && <ActivityIndicator color="#fff" />}
                </View>
              </View>

              {canUseBiometric && (
                <View style={styles.benefitsSection}>
                  <Text style={styles.benefitsTitle}>Vantaggi</Text>
                  <View style={styles.benefitItem}>
                    <MaterialCommunityIcons name="shield-check" size={20} color="#86efac" />
                    <Text style={styles.benefitText}>Accesso sicuro e veloce</Text>
                  </View>
                  <View style={styles.benefitItem}>
                    <MaterialCommunityIcons name="lightning-bolt" size={20} color="#86efac" />
                    <Text style={styles.benefitText}>Nessuna password da ricordare</Text>
                  </View>
                  <View style={styles.benefitItem}>
                    <MaterialCommunityIcons name="lock" size={20} color="#86efac" />
                    <Text style={styles.benefitText}>Protezione avanzata</Text>
                  </View>
                </View>
              )}

              <View style={styles.infoSection}>
                <MaterialCommunityIcons name="information-outline" size={20} color="#fbbf24" />
                <Text style={styles.infoText}>
                  I tuoi dati biometrici rimangono sempre privati e non vengono mai condivisi.
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              disabled={isLoading}
            >
              <Text style={styles.closeButtonText}>Chiudi</Text>
            </TouchableOpacity>
          </LinearGradient>
        </BlurView>
      </View>
    </Modal>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  blurContainer: {
    flex: 1,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    alignSelf: 'center',
  },
  contentTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 12,
  },
  contentDescription: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  statusSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 4,
  },
  statusValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  benefitsSection: {
    marginBottom: 24,
  },
  benefitsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
  },
  benefitText: {
    color: '#fff',
    fontSize: 14,
    marginLeft: 12,
    fontWeight: '500',
  },
  infoSection: {
    flexDirection: 'row',
    backgroundColor: 'rgba(251, 191, 36, 0.2)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
  },
  infoText: {
    color: '#fef3c7',
    fontSize: 13,
    marginLeft: 12,
    flex: 1,
    lineHeight: 18,
  },
  closeButton: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 20,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  closeButtonText: {
    color: '#667eea',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
