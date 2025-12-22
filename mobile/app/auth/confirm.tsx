import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../contexts/ThemeContext';
import { SafeAreaWrapper } from '../../components/shared/SafeAreaWrapper';
import { useTranslation } from '../../hooks/useTranslation';

/**
 * Route per gestire il deep link di conferma email
 * wellnesscoach://auth/confirm#access_token=...&type=...
 */
export default function AuthConfirmScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    const handleEmailConfirmation = async () => {
      try {
        console.log('📧 Processing email confirmation...');
        
        // Supabase gestisce automaticamente i parametri hash (#access_token=...) quando chiamiamo getSession()
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('❌ Error confirming email:', error);
          setStatus('error');
          setMessage(t('auth.emailConfirmationErrorMessage') || 'Si è verificato un errore durante la conferma dell\'email. Riprova più tardi.');
          // Naviga alla schermata di login dopo 3 secondi
          setTimeout(() => {
            router.replace('/(tabs)');
          }, 3000);
          return;
        }

        if (session?.user) {
          console.log('✅ Email confirmed successfully, user:', session.user.email);
          setStatus('success');
          setMessage(t('auth.emailConfirmed') || 'Email confermata con successo!');
          
          // Naviga alla schermata principale dopo un breve delay
          setTimeout(() => {
            router.replace('/(tabs)');
          }, 1500);
        } else {
          console.warn('⚠️ No session found after email confirmation');
          setStatus('error');
          setMessage(t('auth.emailConfirmationErrorMessage') || 'Si è verificato un errore durante la conferma dell\'email. Riprova più tardi.');
          // Naviga alla schermata di login dopo 3 secondi
          setTimeout(() => {
            router.replace('/(tabs)');
          }, 3000);
        }
      } catch (error) {
        console.error('❌ Error handling email confirmation:', error);
        setStatus('error');
        setMessage(t('auth.emailConfirmationErrorMessage') || 'Si è verificato un errore durante la conferma dell\'email. Riprova più tardi.');
        // Naviga alla schermata principale dopo 3 secondi
        setTimeout(() => {
          router.replace('/(tabs)');
        }, 3000);
      }
    };

    handleEmailConfirmation();
  }, [router, t]);

  return (
    <SafeAreaWrapper>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {status === 'loading' && (
          <>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.message, { color: colors.text }]}>
              {t('auth.confirmingEmail') || 'Conferma email in corso...'}
            </Text>
          </>
        )}
        
        {status === 'success' && (
          <>
            <Text style={[styles.icon, { color: colors.primary }]}>✓</Text>
            <Text style={[styles.message, { color: colors.text }]}>
              {message}
            </Text>
            <Text style={[styles.submessage, { color: colors.textSecondary }]}>
              {t('auth.redirecting') || 'Reindirizzamento...'}
            </Text>
          </>
        )}
        
        {status === 'error' && (
          <>
            <Text style={[styles.icon, { color: '#ef4444' }]}>✕</Text>
            <Text style={[styles.message, { color: colors.text }]}>
              {message}
            </Text>
            <Text style={[styles.submessage, { color: colors.textSecondary }]}>
              {t('auth.redirecting') || 'Reindirizzamento...'}
            </Text>
          </>
        )}
      </View>
    </SafeAreaWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  icon: {
    fontSize: 64,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  message: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
  },
  submessage: {
    fontSize: 14,
    textAlign: 'center',
  },
});






