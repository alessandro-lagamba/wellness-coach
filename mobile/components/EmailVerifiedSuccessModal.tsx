import React, { useEffect, useRef } from 'react';
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
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../hooks/useTranslation';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

interface EmailVerifiedSuccessModalProps {
  visible: boolean;
  onClose: () => void;
  userName?: string;
  userGender?: string;
}

export const EmailVerifiedSuccessModal: React.FC<EmailVerifiedSuccessModalProps> = ({
  visible,
  onClose,
  userName,
  userGender,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const checkmarkScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Haptic feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Animate modal in
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          damping: 15,
          stiffness: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Animate checkmark with delay
      setTimeout(() => {
        Animated.spring(checkmarkScale, {
          toValue: 1,
          damping: 12,
          stiffness: 180,
          useNativeDriver: true,
        }).start();
      }, 200);

      // Auto-close after 3 seconds
      const timer = setTimeout(() => {
        handleClose();
      }, 3000);

      return () => clearTimeout(timer);
    } else {
      scaleAnim.setValue(0.8);
      opacityAnim.setValue(0);
      checkmarkScale.setValue(0);
    }
  }, [visible]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0.8,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.modalContainer,
            {
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <LinearGradient
            colors={['#10b981', '#059669', '#047857']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.modal}
          >
            {/* Success Icon */}
            <Animated.View
              style={[
                styles.iconContainer,
                { transform: [{ scale: checkmarkScale }] },
              ]}
            >
              <View style={styles.iconCircle}>
                <MaterialCommunityIcons name="check" size={48} color="#10b981" />
              </View>
            </Animated.View>

            {/* Title */}
            <Text style={styles.title}>
              {t('auth.emailVerifiedSuccessTitle') || 'Email Verificata!'}
            </Text>

            {/* Message */}
            <Text style={styles.message}>
              {userName 
                ? (userGender === 'female' 
                    ? (t('auth.emailVerifiedSuccessMessageWithNameFemale') || `Benvenuta ${userName}! Il tuo account è ora attivo.`).replace('${name}', userName)
                    : (t('auth.emailVerifiedSuccessMessageWithName') || `Benvenuto ${userName}! Il tuo account è ora attivo.`).replace('${name}', userName)
                  )
                : (t('auth.emailVerifiedSuccessMessage') || 'Il tuo account è stato verificato con successo. Ora puoi accedere a tutte le funzionalità dell\'app.')
              }
            </Text>

            {/* Features unlocked */}
            <View style={styles.featuresContainer}>
              <View style={styles.featureRow}>
                <MaterialCommunityIcons name="check-circle" size={18} color="rgba(255,255,255,0.9)" />
                <Text style={styles.featureText}>
                  {t('auth.featureUnlocked1') || 'Analisi AI complete'}
                </Text>
              </View>
              <View style={styles.featureRow}>
                <MaterialCommunityIcons name="check-circle" size={18} color="rgba(255,255,255,0.9)" />
                <Text style={styles.featureText}>
                  {t('auth.featureUnlocked2') || 'Sincronizzazione dati'}
                </Text>
              </View>
              <View style={styles.featureRow}>
                <MaterialCommunityIcons name="check-circle" size={18} color="rgba(255,255,255,0.9)" />
                <Text style={styles.featureText}>
                  {t('auth.featureUnlocked3') || 'Coaching personalizzato'}
                </Text>
              </View>
            </View>

            {/* Continue Button */}
            <TouchableOpacity
              style={styles.continueButton}
              onPress={handleClose}
              activeOpacity={0.9}
            >
              <Text style={styles.continueButtonText}>
                {t('auth.continueToApp') || 'Continua'}
              </Text>
              <MaterialCommunityIcons name="arrow-right" size={20} color="#10b981" />
            </TouchableOpacity>

            {/* Auto-close hint */}
            <Text style={styles.autoCloseHint}>
              {t('auth.autoCloseHint') || 'Chiusura automatica in 3 secondi...'}
            </Text>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#10b981',
    shadowOpacity: 0.4,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 15 },
    elevation: 25,
  },
  modal: {
    padding: 28,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 20,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginBottom: 24,
  },
  featuresContainer: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.95)',
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 14,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10b981',
  },
  autoCloseHint: {
    marginTop: 16,
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    fontStyle: 'italic',
  },
});

