import React, { useEffect, useState, useRef, useCallback } from 'react';
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
  
  // 🔥 FIX: Memory leak - aggiungiamo ref per tracciare se il componente è montato
  const isMountedRef = useRef(true);
  // 🔥 FIX: Memory leak - aggiungiamo ref per tracciare le animazioni attive
  const animationRefs = useRef<Animated.CompositeAnimation[]>([]);
  
  // Animation values
  const dot1Anim = useState(new Animated.Value(0.3))[0];
  const dot2Anim = useState(new Animated.Value(0.3))[0];
  const dot3Anim = useState(new Animated.Value(0.3))[0];
  const progressAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // 🔥 FIX: Ferma tutte le animazioni quando il componente viene smontato
      animationRefs.current.forEach(anim => {
        if (anim) {
          anim.stop();
        }
      });
      animationRefs.current = [];
    };
  }, []);

  // 🔥 FIX: Ferma tutte le animazioni - definito prima del useEffect che lo usa
  const stopAnimations = useCallback(() => {
    animationRefs.current.forEach(anim => {
      if (anim) {
        anim.stop();
      }
    });
    animationRefs.current = [];
    
    // Reset animation values
    dot1Anim.setValue(0.3);
    dot2Anim.setValue(0.3);
    dot3Anim.setValue(0.3);
    progressAnim.setValue(0);
  }, [dot1Anim, dot2Anim, dot3Anim, progressAnim]);

  // 🔥 FIX: Usiamo un ref per isAuthenticating per evitare problemi con le dipendenze
  const isAuthenticatingRef = useRef(false);

  const triggerBiometricAuth = useCallback(async () => {
    // 🔥 FIX: Verifica se il componente è ancora montato
    if (!isMountedRef.current) return;
    
    if (isAuthenticatingRef.current) return;
    
    // 🔥 FIX: Verifica se il componente è ancora montato prima di setState
    if (!isMountedRef.current) return;
    isAuthenticatingRef.current = true;
    setIsAuthenticating(true);
    
    try {
      // 🔥 FIX: Rimuoviamo console.log eccessivi - manteniamo solo errori critici
      const result = await BiometricAuthService.authenticateWithBiometric(
        'Autenticazione biometrica in corso...'
      );
      
      // 🔥 FIX: Verifica se il componente è ancora montato prima di continuare
      if (!isMountedRef.current) return;
      
      if (result.success) {
        // 🔥 FIX: Rimuoviamo console.log eccessivi
        onSuccess();
      } else {
        // 🔥 FIX: Rimuoviamo console.log eccessivi
        onFailure();
      }
    } catch (error) {
      // 🔥 FIX: Solo errori critici in console
      console.error('❌ Error during biometric authentication:', error);
      
      // 🔥 FIX: Verifica se il componente è ancora montato prima di chiamare onFailure
      if (isMountedRef.current) {
        onFailure();
      }
    } finally {
      // 🔥 FIX: Verifica se il componente è ancora montato prima di setState
      if (isMountedRef.current) {
        isAuthenticatingRef.current = false;
        setIsAuthenticating(false);
      }
    }
  }, [onSuccess, onFailure]);

  const startAnimations = useCallback(() => {
    // 🔥 FIX: Ferma le animazioni precedenti prima di avviarne di nuove
    stopAnimations();
    
    // 🔥 FIX: Verifica se il componente è ancora montato
    if (!isMountedRef.current) return;

    // Animate dots - 🔥 FIX: Usiamo loop invece di ricorsione per evitare memory leak
    const dot1Loop = Animated.loop(
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
      ])
    );
    
    const dot2Loop = Animated.loop(
      Animated.sequence([
        Animated.delay(200),
        Animated.timing(dot2Anim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(dot2Anim, {
          toValue: 0.3,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    );
    
    const dot3Loop = Animated.loop(
      Animated.sequence([
        Animated.delay(400),
        Animated.timing(dot3Anim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(dot3Anim, {
          toValue: 0.3,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    );

    // Animate progress bar
    const progressLoop = Animated.loop(
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
    );

    // 🔥 FIX: Salva i riferimenti alle animazioni per poterle fermare
    animationRefs.current = [dot1Loop, dot2Loop, dot3Loop, progressLoop];
    
    // Avvia tutte le animazioni
    dot1Loop.start();
    dot2Loop.start();
    dot3Loop.start();
    progressLoop.start();
  }, [dot1Anim, dot2Anim, dot3Anim, progressAnim, stopAnimations]);

  useEffect(() => {
    if (visible) {
      triggerBiometricAuth();
      startAnimations();
    } else {
      // 🔥 FIX: Ferma tutte le animazioni quando il modal viene chiuso
      stopAnimations();
    }
  }, [visible, triggerBiometricAuth, startAnimations, stopAnimations]);


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
