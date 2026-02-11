import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import { SafeAreaWrapper } from '../../components/shared/SafeAreaWrapper';
import { useTranslation } from '../../hooks/useTranslation';
import { AuthService } from '../../services/auth.service';
import { supabase } from '../../lib/supabase';

/**
 * Route per gestire il deep link OAuth:
 * yachai://auth/callback#access_token=... oppure ?code=...
 */
export default function AuthCallbackScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    let mounted = true;

    const completeAuthFlow = async () => {
      try {
        // Se la sessione esiste già (es. gestita da openAuthSessionAsync), basta chiudere la callback route.
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          if (!mounted) return;
          setStatus('success');
          setMessage(t('auth.loginSuccess') || 'Accesso completato.');
          setTimeout(() => router.replace('/(tabs)'), 300);
          return;
        }

        const initialUrl = await Linking.getInitialURL();
        if (initialUrl?.includes('auth/callback')) {
          const { user, error } = await AuthService.handleOAuthCallback(initialUrl);
          if (error || !user) {
            if (!mounted) return;
            setStatus('error');
            setMessage(error?.message || t('auth.operationError') || 'Errore durante il login social.');
            setTimeout(() => router.replace('/(tabs)'), 1500);
            return;
          }

          if (!mounted) return;
          setStatus('success');
          setMessage(t('auth.loginSuccess') || 'Accesso completato.');
          setTimeout(() => router.replace('/(tabs)'), 300);
          return;
        }

        // Nessun token/callback utile: ritorna alla root evitando schermata "Unmatched Route".
        if (!mounted) return;
        setStatus('error');
        setMessage(t('auth.operationError') || 'Callback OAuth non valida.');
        setTimeout(() => router.replace('/(tabs)'), 800);
      } catch (error) {
        if (!mounted) return;
        console.error('❌ Error in OAuth callback route:', error);
        setStatus('error');
        setMessage(t('auth.operationError') || 'Errore durante il login social.');
        setTimeout(() => router.replace('/(tabs)'), 1500);
      }
    };

    completeAuthFlow();

    return () => {
      mounted = false;
    };
  }, [router, t]);

  return (
    <SafeAreaWrapper>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {status === 'loading' && (
          <>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.message, { color: colors.text }]}>
              {t('auth.redirecting') || 'Accesso in corso...'}
            </Text>
          </>
        )}

        {status === 'success' && (
          <>
            <Text style={[styles.icon, { color: colors.primary }]}>✓</Text>
            <Text style={[styles.message, { color: colors.text }]}>
              {message}
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
    fontSize: 56,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  message: {
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 10,
  },
  submessage: {
    fontSize: 14,
    textAlign: 'center',
  },
});

