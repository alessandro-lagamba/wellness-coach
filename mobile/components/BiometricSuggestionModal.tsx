import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { BiometricAuthService } from '../services/biometric-auth.service';
import { useTranslation } from '../hooks/useTranslation'; // 🆕 i18n

interface BiometricSuggestionModalProps {
  visible: boolean;
  onEnable: () => void;
  onSkip: () => void;
  userEmail: string;
  userPassword: string;
}

export const BiometricSuggestionModal: React.FC<BiometricSuggestionModalProps> = ({
  visible,
  onEnable,
  onSkip,
  userEmail,
  userPassword,
}) => {
  const { t } = useTranslation(); // 🆕 i18n hook
  const [biometricType, setBiometricType] = useState<string>('');
  const [canUseBiometric, setCanUseBiometric] = useState(false);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const pulseAnim = useState(new Animated.Value(1))[0];

  useEffect(() => {
    if (visible) {
      checkBiometricCapabilities();
      startPulseAnimation();
    }
  }, [visible]);

  const checkBiometricCapabilities = async () => {
    try {
      const [canUse, type] = await Promise.all([
        BiometricAuthService.canUseBiometric(),
        BiometricAuthService.getSupportedBiometricType(),
      ]);
      setCanUseBiometric(canUse);
      setBiometricType(type);
    } catch (error) {
      console.error('Error checking biometric capabilities:', error);
      setCanUseBiometric(false);
    }
  };

  const startPulseAnimation = () => {
    const pulse = () => {
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ]).start(() => pulse());
    };
    pulse();
  };

  const handleEnableBiometric = async () => {
    if (!canUseBiometric) {
      onSkip();
      return;
    }

    setIsSettingUp(true);
    try {
      console.log('🔐 Setting up biometric authentication...');
      
      // Save credentials for biometric login
      await BiometricAuthService.saveBiometricCredentials(userEmail, userPassword);
      
      console.log('✅ Biometric credentials saved successfully');
      onEnable();
    } catch (error) {
      console.error('❌ Error setting up biometric authentication:', error);
      onSkip();
    } finally {
      setIsSettingUp(false);
    }
  };

  const getBiometricIcon = () => {
    switch (biometricType.toLowerCase()) {
      case 'face id':
        return 'face-recognition';
      case 'touch id':
        return 'fingerprint';
      case 'iris':
        return 'eye';
      default:
        return 'fingerprint';
    }
  };

  const getBiometricTitle = () => {
    if (!canUseBiometric) {
      return t('modals.biometricSuggestion.title');
    }
    return t('modals.biometricSuggestion.enableTitle', { type: biometricType });
  };

  const getBiometricDescription = () => {
    if (!canUseBiometric) {
      return t('modals.biometric.notSupported');
    }
    return t('modals.biometricSuggestion.description', { type: biometricType });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <BlurView intensity={20} style={styles.blurContainer}>
          <LinearGradient
            colors={['#667eea', '#764ba2']}
            style={styles.modalContainer}
          >
            <View style={styles.content}>
              <Animated.View 
                style={[
                  styles.iconContainer,
                  { transform: [{ scale: pulseAnim }] }
                ]}
              >
                <MaterialCommunityIcons
                  name={getBiometricIcon()}
                  size={80}
                  color="#fff"
                />
              </Animated.View>
              
              <Text style={styles.title}>
                {getBiometricTitle()}
              </Text>
              
              <Text style={styles.subtitle}>
                {getBiometricDescription()}
              </Text>

              {canUseBiometric && (
                <View style={styles.benefitsContainer}>
                  <View style={styles.benefitItem}>
                    <MaterialCommunityIcons name="shield-check" size={20} color="#fff" />
                    <Text style={styles.benefitText}>{t('modals.biometric.benefit1')}</Text>
                  </View>
                  <View style={styles.benefitItem}>
                    <MaterialCommunityIcons name="lightning-bolt" size={20} color="#fff" />
                    <Text style={styles.benefitText}>{t('modals.biometric.benefit2')}</Text>
                  </View>
                  <View style={styles.benefitItem}>
                    <MaterialCommunityIcons name="lock" size={20} color="#fff" />
                    <Text style={styles.benefitText}>{t('modals.biometric.benefit3')}</Text>
                  </View>
                </View>
              )}
              
              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={styles.skipButton}
                  onPress={onSkip}
                >
                  <Text style={styles.skipButtonText}>{t('common.skip')}</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.enableButton,
                    (!canUseBiometric || isSettingUp) && styles.enableButtonDisabled
                  ]}
                  onPress={handleEnableBiometric}
                  disabled={!canUseBiometric || isSettingUp}
                >
                  {isSettingUp ? (
                    <View style={styles.loadingContainer}>
                      <View style={styles.loadingDots}>
                        <View style={[styles.dot, styles.dot1]} />
                        <View style={[styles.dot, styles.dot2]} />
                        <View style={[styles.dot, styles.dot3]} />
                      </View>
                    </View>
                  ) : (
                    <>
                      <MaterialCommunityIcons 
                        name="check" 
                        size={20} 
                        color="#667eea" 
                      />
                      <Text style={styles.enableButtonText}>
                        {canUseBiometric ? t('modals.biometric.enable') : t('modals.biometric.notAvailable')}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  blurContainer: {
    width: width * 0.9,
    borderRadius: 20,
    overflow: 'hidden',
  },
  modalContainer: {
    padding: 32,
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    width: '100%',
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  benefitsContainer: {
    width: '100%',
    marginBottom: 32,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
  },
  benefitText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 12,
  },
  buttonContainer: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  skipButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  skipButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  enableButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  enableButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    shadowOpacity: 0.1,
  },
  enableButtonText: {
    color: '#667eea',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingDots: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#667eea',
    marginHorizontal: 2,
  },
  dot1: {
    animationDelay: '0s',
  },
  dot2: {
    animationDelay: '0.2s',
  },
  dot3: {
    animationDelay: '0.4s',
  },
});

