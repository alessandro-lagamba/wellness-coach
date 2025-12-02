import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../hooks/useTranslation';
import { AuthService } from '../services/auth.service';

interface EmailVerificationModalProps {
  visible: boolean;
  userEmail: string;
  onClose: () => void;
  onEmailVerified?: () => void;
}

export const EmailVerificationModal: React.FC<EmailVerificationModalProps> = ({
  visible,
  userEmail,
  onClose,
  onEmailVerified,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [isResending, setIsResending] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  const handleResendEmail = async () => {
    try {
      setIsResending(true);
      const { error } = await AuthService.resendConfirmationEmail(userEmail);
      
      if (error) {
        Alert.alert(
          t('auth.emailResendError') || 'Errore',
          error.message || t('auth.emailResendErrorMessage') || 'Impossibile inviare l\'email di conferma. Riprova più tardi.'
        );
      } else {
        Alert.alert(
          t('auth.emailResent') || 'Email inviata',
          t('auth.emailResentMessage') || 'Abbiamo inviato una nuova email di conferma. Controlla la tua casella di posta.'
        );
      }
    } catch (error) {
      console.error('Error resending confirmation email:', error);
      Alert.alert(
        t('auth.emailResendError') || 'Errore',
        t('auth.emailResendErrorMessage') || 'Impossibile inviare l\'email di conferma. Riprova più tardi.'
      );
    } finally {
      setIsResending(false);
    }
  };

  const handleCheckVerification = async () => {
    try {
      setIsChecking(true);
      
      // 🔥 FIX: Forza il refresh della sessione da Supabase prima di controllare
      const { supabase } = await import('../lib/supabase');
      console.log('🔄 Refreshing session from Supabase...');
      
      // Prima ottieni la sessione corrente
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        console.error('❌ Error getting session:', sessionError);
      } else {
        console.log('📧 Current session user email_confirmed_at:', session?.user?.email_confirmed_at);
      }
      
      // Poi forza un refresh dell'utente
      const { data: { user: refreshedUser }, error: refreshError } = await supabase.auth.getUser();
      
      if (refreshError) {
        console.error('❌ Error refreshing user:', refreshError);
        throw refreshError;
      }
      
      console.log('✅ User refreshed, email_confirmed_at:', refreshedUser?.email_confirmed_at);
      
      if (refreshedUser?.email_confirmed_at) {
        // Email verificata!
        Alert.alert(
          t('auth.emailVerified') || 'Email verificata!',
          t('auth.emailVerifiedMessage') || 'La tua email è stata verificata con successo. Ora puoi accedere a tutte le funzionalità dell\'app.',
          [
            {
              text: t('common.ok') || 'OK',
              onPress: () => {
                onEmailVerified?.();
                onClose();
              },
            },
          ]
        );
      } else {
        Alert.alert(
          t('auth.emailNotVerified') || 'Email non ancora verificata',
          t('auth.emailNotVerifiedMessage') || 'L\'email non è ancora stata verificata. Controlla la tua casella di posta e clicca sul link di conferma.'
        );
      }
    } catch (error) {
      console.error('❌ Error checking email verification:', error);
      Alert.alert(
        t('common.error') || 'Errore',
        t('auth.emailCheckError') || 'Impossibile verificare lo stato dell\'email. Riprova più tardi.'
      );
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modal, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Icon */}
          <View style={[styles.iconContainer, { backgroundColor: 'rgba(139,92,246,0.15)' }]}>
            <MaterialCommunityIcons name="email-check" size={48} color="#8b5cf6" />
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: colors.text }]}>
            {t('auth.verifyEmailRequired') || 'Conferma la tua email'}
          </Text>

          {/* Description */}
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            {t('auth.verifyEmailRequiredMessage') || `Per accedere a tutte le funzionalità dell'app, devi confermare la tua email.\n\nAbbiamo inviato un'email di conferma a:`}
          </Text>

          {/* Email */}
          <View style={[styles.emailContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="email" size={20} color={colors.primary} />
            <Text style={[styles.emailText, { color: colors.text }]}>{userEmail}</Text>
          </View>

          {/* Instructions */}
          <View style={styles.instructionsContainer}>
            <Text style={[styles.instructionsTitle, { color: colors.text }]}>
              {t('auth.verifyEmailInstructions') || 'Cosa fare:'}
            </Text>
            <View style={styles.instructionRow}>
              <MaterialCommunityIcons name="numeric-1-circle" size={20} color={colors.primary} />
              <Text style={[styles.instructionText, { color: colors.textSecondary }]}>
                {t('auth.verifyEmailStep1') || 'Apri la tua casella email'}
              </Text>
            </View>
            <View style={styles.instructionRow}>
              <MaterialCommunityIcons name="numeric-2-circle" size={20} color={colors.primary} />
              <Text style={[styles.instructionText, { color: colors.textSecondary }]}>
                {t('auth.verifyEmailStep2') || 'Clicca sul link di conferma nell\'email'}
              </Text>
            </View>
            <View style={styles.instructionRow}>
              <MaterialCommunityIcons name="numeric-3-circle" size={20} color={colors.primary} />
              <Text style={[styles.instructionText, { color: colors.textSecondary }]}>
                {t('auth.verifyEmailStep3') || 'Torna nell\'app e clicca su "Ho verificato"'}
              </Text>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: colors.border }]}
              onPress={handleResendEmail}
              disabled={isResending || isChecking}
              activeOpacity={0.7}
            >
              {isResending ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <MaterialCommunityIcons name="email-send" size={18} color={colors.primary} />
                  <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>
                    {t('auth.resendEmail') || 'Reinvia email'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleCheckVerification}
              disabled={isResending || isChecking}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={['#8b5cf6', '#7c3aed']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.primaryGradient}
              >
                {isChecking ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="check-circle" size={18} color="#ffffff" />
                    <Text style={styles.primaryButtonText}>
                      {t('auth.iVerified') || 'Ho verificato'}
                    </Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Note */}
          <Text style={[styles.note, { color: colors.textTertiary }]}>
            {t('auth.verifyEmailNote') || 'Nota: Dopo aver verificato l\'email, potrai accedere a tutte le funzionalità dell\'app.'}
          </Text>
        </View>
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
  modal: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 20,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 20,
  },
  emailContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
    gap: 10,
  },
  emailText: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  instructionsContainer: {
    marginBottom: 24,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  instructionText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  actionsContainer: {
    gap: 12,
    marginBottom: 16,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  primaryButton: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#8b5cf6',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 10,
  },
  primaryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
  },
  note: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

