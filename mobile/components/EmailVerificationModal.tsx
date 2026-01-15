import React, { useState, useEffect, useRef } from 'react';
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
import { supabase } from '../lib/supabase';

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
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 🆕 Polling: Auto-check email verification every 5 seconds when modal is visible
  useEffect(() => {
    if (!visible) {
      // Clear polling when modal is hidden
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      return;
    }

    // Start polling
    console.log('📧 Starting email verification polling...');

    const checkEmailVerification = async () => {
      try {
        // 🔥 FIX: Don't call refreshSession() - it can break unconfirmed user sessions
        // Instead, just check current session and try to get user
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          // No session - this is expected, user needs to click email link
          console.log('📧 No session found in polling (expected)');
          return;
        }

        // Check user data - getUser() fetches from server using current token
        const { data: { user }, error } = await supabase.auth.getUser();

        if (error) {
          console.log('📧 Polling getUser failed:', error.message);
          return;
        }

        if (user?.email_confirmed_at) {
          console.log('✅ Email verified (detected by polling)!');
          // Stop polling
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          // Trigger success callback
          onEmailVerified?.();
          onClose();
        } else {
          console.log('📧 Email not yet verified, polling continues...');
        }
      } catch (error) {
        console.log('📧 Polling error (non-critical):', error);
      }
    };

    // 🔥 FIX: Wait 2 seconds before first check to let session stabilize
    const initialTimeout = setTimeout(() => {
      checkEmailVerification();
    }, 2000);

    // Then poll every 5 seconds
    pollingIntervalRef.current = setInterval(checkEmailVerification, 5000);

    return () => {
      clearTimeout(initialTimeout);
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [visible, onEmailVerified, onClose]);

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

      console.log('🔄 Checking email verification status...');

      // 🔥 FIX: First check if we have a session at all
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('❌ Session error:', sessionError.message);
      }

      if (!session) {
        // 🔥 FIX: Show a more helpful message instead of "Sessione scaduta"
        // This is the EXPECTED state before email confirmation
        console.log('📧 No session - waiting for email confirmation link to be clicked');
        Alert.alert(
          t('auth.emailNotYetVerifiedTitle') || 'Email non ancora verificata',
          t('auth.emailNotYetVerifiedMessage') || 'Per completare la verifica, clicca sul link nell\'email dal tuo telefono. Se hai già cliccato dal PC, l\'app rileverà automaticamente la conferma entro pochi secondi.',
          [{ text: t('common.ok') || 'OK' }]
        );
        return;
      }

      // 🔥 FIX: Don't call refreshSession() - it breaks unconfirmed user sessions!
      // Just get user data directly - getUser() will fetch from server
      console.log('🔄 Getting user data...');
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError) {
        console.error('❌ Failed to get user:', userError.message);
        Alert.alert(
          t('common.error') || 'Errore',
          t('auth.emailCheckErrorRetry') || 'Si è verificato un errore. Clicca sul link di conferma nella tua email per continuare.'
        );
        return;
      }

      if (!user) {
        console.error('❌ No user returned');
        Alert.alert(
          t('auth.sessionExpired') || 'Sessione scaduta',
          t('auth.sessionExpiredMessage') || 'Clicca sul link di conferma nella tua email per continuare.'
        );
        return;
      }

      console.log('✅ User retrieved, email_confirmed_at:', user.email_confirmed_at);

      if (user.email_confirmed_at) {
        // Email verified! Close modal silently
        console.log('✅ Email verified, closing modal');
        onEmailVerified?.();
        onClose();
      } else {
        Alert.alert(
          t('auth.emailNotVerified') || 'Email non ancora verificata',
          t('auth.emailNotVerifiedMessage') || 'L\'email non è ancora stata verificata. Clicca sul link di conferma nella tua email.'
        );
      }
    } catch (error: any) {
      console.error('❌ Error checking email verification:', error);
      Alert.alert(
        t('common.error') || 'Errore',
        t('auth.emailCheckErrorRetry') || 'Si è verificato un errore. Clicca sul link di conferma nella tua email per continuare.'
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
            {t('auth.verifyEmailRequiredMessage') || `Per accedere a tutte le funzionalità dell'app, devi confermare la tua email. Una volta cliccato sul link, l'app si aprirà automaticamente.\n\nAbbiamo inviato un'email di conferma a:`}
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
                {t('auth.verifyEmailStep3') || 'L\'app si aprirà automaticamente'}
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
                  <MaterialCommunityIcons name="email-fast" size={18} color={colors.primary} />
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
