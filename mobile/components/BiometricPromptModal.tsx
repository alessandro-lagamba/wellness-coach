import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Dimensions,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { BiometricAuthService } from '../services/biometric-auth.service';

interface BiometricPromptModalProps {
  visible: boolean;
  onSuccess: () => void;
  onFailure: () => void;
}

export const BiometricPromptModal: React.FC<BiometricPromptModalProps> = ({
  visible,
  onSuccess,
  onFailure,
}) => {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  
  // Animation values
  const dot1Anim = useState(new Animated.Value(0.3))[0];
  const dot2Anim = useState(new Animated.Value(0.3))[0];
  const dot3Anim = useState(new Animated.Value(0.3))[0];
  const progressAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    if (visible) {
      triggerBiometricAuth();
      startAnimations();
    }
  }, [visible]);

  const startAnimations = () => {
    // Animate dots
    const animateDots = () => {
      Animated.sequence([
        Animated.timing(dot1Anim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(dot1Anim, {
          toValue: 0.3,
          duration: 600,
          useNativeDriver: true,
        }),
      ]).start(() => animateDots());
    };

    Animated.sequence([
      Animated.delay(0),
      Animated.timing(dot1Anim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.sequence([
      Animated.delay(200),
      Animated.timing(dot2Anim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.sequence([
      Animated.delay(400),
      Animated.timing(dot3Anim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    // Animate progress bar
    Animated.loop(
      Animated.sequence([
        Animated.timing(progressAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: false,
        }),
        Animated.timing(progressAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: false,
        }),
      ])
    ).start();
  };

  const triggerBiometricAuth = async () => {
    if (isAuthenticating) return;
    
    setIsAuthenticating(true);
    try {
      console.log('🔐 Triggering biometric authentication...');
      const result = await BiometricAuthService.authenticateWithBiometric(
        'Autenticazione biometrica in corso...'
      );
      
      if (result.success) {
        console.log('✅ Biometric authentication successful');
        console.log('🔐 Biometric authentication successful, proceeding with login...');
        onSuccess();
      } else {
        console.log('❌ Biometric authentication failed:', result.error);
        onFailure();
      }
    } catch (error) {
      console.error('❌ Error during biometric authentication:', error);
      onFailure();
    } finally {
      setIsAuthenticating(false);
    }
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
              {/* Modern Loading Animation */}
              <View style={styles.loadingContainer}>
                <View style={styles.loadingDots}>
                  <Animated.View style={[styles.dot, styles.dot1, { opacity: dot1Anim }]} />
                  <Animated.View style={[styles.dot, styles.dot2, { opacity: dot2Anim }]} />
                  <Animated.View style={[styles.dot, styles.dot3, { opacity: dot3Anim }]} />
                </View>
              </View>
              
              {/* Elegant Banner */}
              <View style={styles.bannerContainer}>
                <View style={styles.bannerHeader}>
                  <View style={styles.bannerIcon}>
                    <Text style={styles.bannerIconText}>🔐</Text>
                  </View>
                  <Text style={styles.bannerTitle}>Autenticazione</Text>
                </View>
                <Text style={styles.bannerText}>
                  Verifica biometrica in corso...
                </Text>
                <View style={styles.bannerFooter}>
                  <View style={styles.progressBar}>
                    <Animated.View 
                      style={[
                        styles.progressFill,
                        {
                          width: progressAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0%', '100%'],
                          }),
                        }
                      ]} 
                    />
                  </View>
                </View>
              </View>
            </View>
          </LinearGradient>
        </BlurView>
      </View>
    </Modal>
  );
};

const { width, height } = Dimensions.get('window');

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
    minHeight: 200,
  },
  content: {
    alignItems: 'center',
    width: '100%',
    gap: 24,
  },
  // Modern Loading Animation
  loadingContainer: {
    marginBottom: 8,
  },
  loadingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
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
  // Elegant Banner Design
  bannerContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingVertical: 24,
    paddingHorizontal: 28,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    width: '100%',
    maxWidth: 320,
  },
  bannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    gap: 12,
  },
  bannerIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  bannerIconText: {
    fontSize: 16,
  },
  bannerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
  },
  bannerText: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  bannerFooter: {
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 2,
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 2,
  },
});
