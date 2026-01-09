import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, ActivityIndicator, Linking, Alert } from 'react-native';
import { AuthService } from '../services/auth.service';
import { OnboardingService } from '../services/onboarding.service';
import { AuthScreen } from './auth/AuthScreen';
// 🔥 REMOVED: OnboardingScreen - non lo usiamo più, andiamo direttamente a InteractiveTutorial
import { InteractiveTutorial } from './InteractiveTutorial';
import { EmailVerificationModal } from './EmailVerificationModal';
import { EmailVerifiedSuccessModal } from './EmailVerifiedSuccessModal';
import { useTheme } from '../contexts/ThemeContext';
import { TutorialProvider, useTutorial } from '../contexts/TutorialContext';
import { useRouter } from 'expo-router';
import PushNotificationService from '../services/push-notification.service'; // 🆕 Push notifications
import { supabase } from '../lib/supabase';
import { useTranslation } from '../hooks/useTranslation';

interface AuthWrapperProps {
  children: React.ReactNode;
  onAuthSuccess: (user: any) => void;
}

// Componente interno che usa il context
const AuthWrapperContent: React.FC<AuthWrapperProps> = ({
  children,
  onAuthSuccess,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<any>(null);
  // 🔥 REMOVED: showOnboarding - non mostriamo più OnboardingScreen, solo InteractiveTutorial
  const { showTutorial, setShowTutorial } = useTutorial();
  const [showEmailVerificationModal, setShowEmailVerificationModal] = useState(false);
  const router = useRouter();
  const { colors, mode } = useTheme(); // 🆕 Theme colors

  // 🔥 FIX: Esponiamo un metodo per forzare la visualizzazione del tutorial
  // Questo permette di rivisualizzare il tutorial da altre schermate (es. HomeScreen)
  const forceShowTutorial = useCallback(async () => {
    // 🔥 PERF: Removed verbose logging
    // Reset tutorial state
    await OnboardingService.resetOnboarding(); // Reset anche tutorial
    // Force show tutorial
    setShowTutorial(true);
  }, [setShowTutorial]);

  // Esponiamo forceShowTutorial tramite un ref globale (per accesso da HomeScreen)
  useEffect(() => {
    (global as any).forceShowTutorial = forceShowTutorial;
    return () => {
      delete (global as any).forceShowTutorial;
    };
  }, [forceShowTutorial]);

  // 🔥 FIX: Usiamo useRef per onAuthSuccess per evitare loop infiniti
  const onAuthSuccessRef = useRef(onAuthSuccess);
  useEffect(() => {
    onAuthSuccessRef.current = onAuthSuccess;
  }, [onAuthSuccess]);

  // 🆕 Non serve più override del colore status bar - usa il tema
  // Il StatusBarWrapper userà automaticamente il colore del tema

  // 🔥 FIX: Ref per evitare doppie chiamate a proceedAfterAuthentication
  const isProcessingAuthRef = useRef(false);
  const processedUserIdRef = useRef<string | null>(null);
  const isAuthenticatedRef = useRef(false);

  // 🔥 FIX: Aggiorna ref quando isAuthenticated cambia
  useEffect(() => {
    isAuthenticatedRef.current = isAuthenticated;
  }, [isAuthenticated]);

  // 🔥 FIX: useEffect per controllare e mostrare il tutorial quando l'app è pronta
  useEffect(() => {
    const checkAndShowTutorial = async () => {
      // Solo se l'utente è autenticato e l'app è renderizzata
      if (!isAuthenticated || !user) {
        return;
      }

      const onboardingCompleted = await OnboardingService.isOnboardingCompleted();
      const tutorialCompleted = await OnboardingService.isTutorialCompleted();

      // 🔥 PERF: Removed verbose logging

      // 🔥 CRITICO: Verifica se l'utente è nuovo o esistente controllando il profilo nel database
      // Se l'utente ha già un profilo, è un utente esistente e non dovrebbe vedere il tutorial
      let isExistingUser = false;
      try {
        const { AuthService } = await import('../services/auth.service');
        const existingProfile = await AuthService.getUserProfile(user.id);
        isExistingUser = !!existingProfile;
        // 🔥 PERF: Removed verbose logging
      } catch (error) {
        console.warn('⚠️ Could not check user profile in useEffect, assuming new user:', error);
      }

      // 🔥 FIX: Mostra il tutorial SOLO se:
      // 1. Il tutorial non è completato E
      // 2. L'utente è nuovo (non ha un profilo esistente) E
      // 3. Il tutorial non è già visibile
      // Questo previene che utenti esistenti vedano il tutorial dopo aver eliminato l'app
      if (!tutorialCompleted && !isExistingUser && !showTutorial) {
        // 🔥 PERF: Removed verbose logging
        setTimeout(() => {
          // 🔥 PERF: Removed verbose logging
          setShowTutorial(true);
        }, 2000);
      } else if (isExistingUser && !tutorialCompleted) {
        // 🔥 Se l'utente è esistente ma il tutorial non è completato (AsyncStorage resettato),
        // marca il tutorial come completato automaticamente
        // 🔥 PERF: Removed verbose logging
        OnboardingService.completeTutorial().catch(err => {
          console.error('Error completing tutorial:', err);
        });
      }
    };

    // Delay per permettere all'app di renderizzarsi completamente
    const timer = setTimeout(checkAndShowTutorial, 1000);
    return () => clearTimeout(timer);
  }, [isAuthenticated, user, showTutorial, setShowTutorial]);

  // 🔥 FIX: Memoizziamo checkAuthStatus per evitare ricreazioni - rimuoviamo onAuthSuccess dalle dipendenze
  const proceedAfterAuthentication = useCallback(async (currentUser: any) => {
    // 🔥 FIX: Evita doppie chiamate per lo stesso utente
    if (isProcessingAuthRef.current) {
      // 🔥 PERF: Removed verbose logging
      return;
    }

    if (processedUserIdRef.current === currentUser?.id && isAuthenticatedRef.current) {
      // 🔥 PERF: Removed verbose logging
      return;
    }

    isProcessingAuthRef.current = true;
    processedUserIdRef.current = currentUser?.id || null;

    try {
      setIsAuthenticated(true);
      setUser(currentUser);

      // 🔥 FIX: Crea il profilo SOLO se l'email è verificata
      // Il profilo non viene creato durante la registrazione, ma solo dopo la verifica email
      try {
        const { AuthService } = await import('../services/auth.service');
        const emailVerified = Boolean(currentUser.email_confirmed_at);

        if (emailVerified) {
          // 🔥 FIX: Estrai i dati dai metadata PRIMA di creare/aggiornare il profilo
          const firstName = currentUser.user_metadata?.first_name;
          const lastName = currentUser.user_metadata?.last_name;
          // 🔥 FIX: Gestisci age come numero o stringa (può essere salvato come numero nei metadata)
          const ageValue = currentUser.user_metadata?.age;
          const age = typeof ageValue === 'number' ? ageValue : (ageValue ? parseInt(String(ageValue), 10) : undefined);
          const gender = currentUser.user_metadata?.gender;

          // 🔥 PERF: Removed verbose logging

          const existingProfile = await AuthService.getUserProfile(currentUser.id);

          if (!existingProfile) {
            // 🔥 PERF: Removed verbose logging
            // Crea il profilo con i dati disponibili dall'utente
            const fullName = currentUser.user_metadata?.full_name ||
              currentUser.user_metadata?.name ||
              currentUser.email?.split('@')[0] ||
              'User';

            // 🔥 CRITICAL: Crea il profilo con TUTTI i dati disponibili
            await AuthService.createUserProfile(
              currentUser.id,
              currentUser.email || '',
              fullName,
              firstName,
              lastName,
              age,
              gender
            );
            // 🔥 PERF: Removed verbose logging
          } else {
            // 🔥 PERF: Removed verbose logging

            // 🔥 CRITICAL: SEMPRE aggiorna il profilo con i metadata se sono disponibili
            const updateData: any = {};
            if (firstName) updateData.first_name = firstName;
            if (lastName) updateData.last_name = lastName;
            if (age !== undefined && age !== null) updateData.age = age;
            if (gender) updateData.gender = gender;

            if (Object.keys(updateData).length > 0) {
              // 🔥 PERF: Removed verbose logging
              await AuthService.updateUserProfile(currentUser.id, updateData);
              // 🔥 PERF: Removed verbose logging
            }
          }
        } else {
          // 🔥 PERF: Removed verbose logging
        }
      } catch (profileError) {
        console.error('❌ Error checking/creating user profile:', profileError);
        // Non blocchiamo l'autenticazione se la creazione del profilo fallisce
      }

      // 🔥 FIX: Non mostriamo più OnboardingScreen, andiamo direttamente al tutorial
      // Controlla se mostrare il tutorial
      const tutorialCompleted = await OnboardingService.isTutorialCompleted();
      // 🔥 PERF: Removed verbose logging

      // 🔥 FIX: Marca l'onboarding come completato automaticamente (non lo mostriamo più)
      const onboardingCompleted = await OnboardingService.isOnboardingCompleted();
      if (!onboardingCompleted) {
        await OnboardingService.completeOnboarding();
        // 🔥 PERF: Removed verbose logging
      }

      // 🔥 CRITICO: Verifica se l'utente è nuovo o esistente controllando il profilo nel database
      // Se l'utente ha già un profilo, è un utente esistente e non dovrebbe vedere il tutorial
      // anche se AsyncStorage è stato resettato (es. dopo aver eliminato l'app)
      let isExistingUser = false;
      try {
        const { AuthService } = await import('../services/auth.service');
        const existingProfile = await AuthService.getUserProfile(currentUser.id);
        isExistingUser = !!existingProfile;
        // 🔥 PERF: Removed verbose logging
      } catch (error) {
        console.warn('⚠️ Could not check user profile, assuming new user:', error);
      }

      // 🔥 FIX: Mostra il tutorial SOLO se:
      // 1. Il tutorial non è completato E
      // 2. L'utente è nuovo (non ha un profilo esistente) E
      // 3. Non stiamo processando un deep link
      if (!tutorialCompleted && !isExistingUser && !isProcessingDeepLink.current) {
        // 🔥 PERF: Removed verbose logging
        setTimeout(() => {
          // 🔥 PERF: Removed verbose logging
          setShowTutorial(true);
        }, 2000);
      } else if (isExistingUser && !tutorialCompleted) {
        // 🔥 Se l'utente è esistente ma il tutorial non è completato (AsyncStorage resettato),
        // marca il tutorial come completato automaticamente
        // 🔥 PERF: Removed verbose logging
        await OnboardingService.completeTutorial();
      } else {
        // 🔥 PERF: Removed verbose logging
      }

      onAuthSuccessRef.current(currentUser);
    } finally {
      // Reset dopo un breve delay per permettere al rendering di completarsi
      setTimeout(() => {
        isProcessingAuthRef.current = false;
      }, 500);
    }
  }, [setShowTutorial]);

  const checkAuthStatus = useCallback(async () => {
    try {
      const isAuth = await AuthService.isAuthenticated();
      const currentUser = await AuthService.getCurrentUser();

      if (isAuth && currentUser) {
        await proceedAfterAuthentication(currentUser);

        // 🔥 FIX: Mostra il modal di verifica email solo se necessario
        if (!currentUser.email_confirmed_at && !isProcessingDeepLink.current) {
          console.log('⚠️ Email not verified, showing verification modal...');
          setShowEmailVerificationModal(true);
        }
      } else {
        setIsAuthenticated(false);
        setUser(null);
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [proceedAfterAuthentication]);

  useEffect(() => {
    checkAuthStatus();

    // Ascolta i cambiamenti di autenticazione
    const { data: { subscription } } = AuthService.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 Auth state changed:', event, 'user:', session?.user?.id);
        if (event === 'SIGNED_IN' && session?.user) {
          if (processedUserIdRef.current !== session.user.id || !isAuthenticatedRef.current) {
            // 🔥 PERF: Removed verbose logging
            proceedAfterAuthentication(session.user);
          } else {
            // 🔥 PERF: Removed verbose logging
          }
        } else if (event === 'SIGNED_OUT') {
          setIsAuthenticated(false);
          setUser(null);
          processedUserIdRef.current = null;
          isProcessingAuthRef.current = false;
          isAuthenticatedRef.current = false;
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [checkAuthStatus, proceedAfterAuthentication]); // 🔥 FIX: Rimossi onAuthSuccess dalle dipendenze - usiamo ref

  // ✅ Gestione Deep Links per conferma email
  const { t } = useTranslation();
  const isProcessingDeepLink = useRef(false);

  // State for showing email verified success modal
  const [showEmailVerifiedSuccess, setShowEmailVerifiedSuccess] = useState(false);

  // 🔥 CRITICAL FIX: Extract tokens from URL and set session manually
  const handleEmailConfirmationDeepLink = async (url: string) => {
    if (isProcessingDeepLink.current) {
      // 🔥 PERF: Removed verbose logging
      return;
    }
    isProcessingDeepLink.current = true;

    // 🔥 PERF: Removed verbose logging

    try {
      // Extract tokens from URL fragment (after #)
      // URL format: wellnesscoach://auth/confirm#access_token=xxx&refresh_token=xxx&type=signup
      const hashIndex = url.indexOf('#');
      if (hashIndex !== -1) {
        const fragment = url.substring(hashIndex + 1);
        const params = new URLSearchParams(fragment);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const type = params.get('type');

        // 🔥 PERF: Removed verbose logging

        if (accessToken && refreshToken) {
          // 🔥 CRITICAL: Set the session manually with the tokens from the URL
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            console.error('❌ Error setting session from tokens:', error);
            isProcessingDeepLink.current = false;
            return;
          }

          if (data.user) {
            // 🔥 PERF: Removed verbose logging

            // Update app state
            setUser(data.user);
            setIsAuthenticated(true);
            setShowEmailVerificationModal(false);

            // 🔥 FIX: Create/update user profile immediately after email confirmation
            try {
              const { AuthService } = await import('../services/auth.service');
              const existingProfile = await AuthService.getUserProfile(data.user.id);

              if (!existingProfile) {
                // 🔥 PERF: Removed verbose logging
                const firstName = data.user.user_metadata?.first_name;
                const lastName = data.user.user_metadata?.last_name;
                const ageValue = data.user.user_metadata?.age;
                const age = typeof ageValue === 'number' ? ageValue : (ageValue ? parseInt(String(ageValue), 10) : undefined);
                const gender = data.user.user_metadata?.gender;
                const fullName = data.user.user_metadata?.full_name ||
                  data.user.user_metadata?.name ||
                  data.user.email?.split('@')[0] ||
                  'User';

                await AuthService.createUserProfile(
                  data.user.id,
                  data.user.email || '',
                  fullName,
                  firstName,
                  lastName,
                  age,
                  gender
                );
                // 🔥 PERF: Removed verbose logging
              } else {
                // 🔥 PERF: Removed verbose logging
                // Update profile with metadata if needed
                const firstName = data.user.user_metadata?.first_name;
                const lastName = data.user.user_metadata?.last_name;
                const ageValue = data.user.user_metadata?.age;
                const age = typeof ageValue === 'number' ? ageValue : (ageValue ? parseInt(String(ageValue), 10) : undefined);
                const gender = data.user.user_metadata?.gender;

                const updateData: any = {};
                if (firstName) updateData.first_name = firstName;
                if (lastName) updateData.last_name = lastName;
                if (age !== undefined && age !== null) updateData.age = age;
                if (gender) updateData.gender = gender;

                if (Object.keys(updateData).length > 0) {
                  await AuthService.updateUserProfile(data.user.id, updateData);
                  // 🔥 PERF: Removed verbose logging
                }
              }
            } catch (profileError) {
              console.error('❌ Error creating/updating profile:', profileError);
            }

            // 🔥 NEW: Show success modal
            setShowEmailVerifiedSuccess(true);

            // Proceed with authentication (but skip tutorial since user is returning)
            await proceedAfterAuthentication(data.user);

            // 🔥 PERF: Removed verbose logging
          }
        } else {
          console.warn('⚠️ No tokens found in URL fragment');
        }
      } else {
        console.warn('⚠️ No fragment found in URL');
        // Try to get existing session
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.email_confirmed_at) {
          // 🔥 PERF: Removed verbose logging
          setUser(session.user);
          setIsAuthenticated(true);
          setShowEmailVerificationModal(false);
          await proceedAfterAuthentication(session.user);
        }
      }
    } catch (error) {
      console.error('❌ Error processing deep link:', error);
    } finally {
      isProcessingDeepLink.current = false;
    }
  };

  useEffect(() => {
    // Handle deep link when app opens from a link
    const handleInitialURL = async () => {
      try {
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl && initialUrl.includes('auth/confirm')) {
          await handleEmailConfirmationDeepLink(initialUrl);
        }
      } catch (error) {
        console.error('❌ Error handling initial URL:', error);
      }
    };

    // Handle deep link when app is already open
    const handleURL = (event: { url: string }) => {
      const { url } = event;
      if (url.includes('auth/confirm')) {
        handleEmailConfirmationDeepLink(url);
      }
    };

    // Controlla URL iniziale quando l'app si apre
    handleInitialURL();

    // Ascolta nuovi deep links quando l'app è già aperta
    const subscription = Linking.addEventListener('url', handleURL);

    return () => {
      subscription.remove();
    };
  }, [proceedAfterAuthentication, t]);

  // 🆕 Inizializza push notifications quando l'utente è autenticato
  // 🔥 FIX: Memory leak - aggiungiamo ref per tracciare se il componente è montato
  const isMountedRef = useRef(true);
  // 🔥 FIX: Usiamo un ref per intervalId per evitare problemi con closure e cleanup
  const pushNotificationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      // 🔥 FIX: Pulisci l'intervallo se l'utente non è più autenticato
      if (pushNotificationIntervalRef.current) {
        clearInterval(pushNotificationIntervalRef.current);
        pushNotificationIntervalRef.current = null;
      }
      return;
    }

    const initPushNotifications = async () => {
      // 🔥 FIX: Verifica se il componente è ancora montato
      if (!isMountedRef.current) return;

      const pushService = PushNotificationService.getInstance();
      const enabled = await pushService.isEnabled();

      if (enabled) {
        const initialized = await pushService.initialize(user.id);
        if (initialized) {
          // 🔥 FIX: Rimuoviamo console.log eccessivi

          // 🆕 Esegui controlli delle regole ogni 6 ore
          // 🔥 FIX: Usiamo user.id direttamente dalla closure per evitare problemi con le dipendenze
          const userId = user.id;
          const checkRules = async () => {
            // 🔥 FIX: Verifica se il componente è ancora montato prima di eseguire
            if (!isMountedRef.current) {
              // 🔥 FIX: Pulisci l'intervallo se il componente è smontato
              if (pushNotificationIntervalRef.current) {
                clearInterval(pushNotificationIntervalRef.current);
                pushNotificationIntervalRef.current = null;
              }
              return;
            }
            await pushService.checkAllRules(userId);
          };

          // Controlla immediatamente
          checkRules();

          // 🔥 FIX: Pulisci l'intervallo precedente se esiste
          if (pushNotificationIntervalRef.current) {
            clearInterval(pushNotificationIntervalRef.current);
            pushNotificationIntervalRef.current = null;
          }

          // Poi ogni 6 ore (solo se ancora montato)
          pushNotificationIntervalRef.current = setInterval(() => {
            if (isMountedRef.current) {
              checkRules();
            } else {
              // 🔥 FIX: Se il componente è smontato, pulisci l'intervallo
              if (pushNotificationIntervalRef.current) {
                clearInterval(pushNotificationIntervalRef.current);
                pushNotificationIntervalRef.current = null;
              }
            }
          }, 6 * 60 * 60 * 1000);
        }
      }
    };

    initPushNotifications();

    return () => {
      // 🔥 FIX: Cleanup completo - assicurati che l'intervallo sia pulito
      if (pushNotificationIntervalRef.current) {
        clearInterval(pushNotificationIntervalRef.current);
        pushNotificationIntervalRef.current = null;
      }
    };
  }, [isAuthenticated, user?.id]);

  // 🔥 FIX: checkAuthStatus è già definita come useCallback sopra (linea 54) - rimuoviamo questa duplicata

  const handleAuthSuccess = (user: any) => {
    proceedAfterAuthentication(user);
  };

  // 🔥 REMOVED: handleOnboardingComplete - non usiamo più OnboardingScreen

  const handleLogout = async () => {
    try {
      await AuthService.signOut();
      setIsAuthenticated(false);
      setUser(null);
    } catch (error) {
      // 🔥 FIX: Solo errori critici in console
      console.error('Error signing out:', error);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <AuthScreen onAuthSuccess={handleAuthSuccess} />;
  }

  // 🔥 REMOVED: Non mostriamo più OnboardingScreen, andiamo direttamente all'app e al tutorial

  // Renderizza l'app principale con il contesto di autenticazione
  // 🔥 DEBUG: Log dello stato del tutorial
  // 🔥 PERF: Removed render-time debug logging - this was running on EVERY RENDER!

  return (
    <View style={styles.appContainer}>
      {children}

      {/* Global Tutorial - sempre renderizzato, visibilità controllata da showTutorial */}
      <InteractiveTutorial
        visible={showTutorial}
        onClose={async () => {
          // 🔥 PERF: Removed verbose logging
          setShowTutorial(false);
          // Mark tutorial as completed even if closed early
          await OnboardingService.completeTutorial();

          // 🔥 NEW: Se l'email non è verificata, mostra il modal di verifica
          if (user && !user.email_confirmed_at) {
            console.log('📧 Email not verified, showing verification modal');
            setTimeout(() => {
              setShowEmailVerificationModal(true);
            }, 500);
          }
        }}
        onComplete={async () => {
          // 🔥 PERF: Removed verbose logging
          setShowTutorial(false);
          // Mark tutorial as completed
          await OnboardingService.completeTutorial();

          // 🔥 NEW: Se l'email non è verificata, mostra il modal di verifica
          if (user && !user.email_confirmed_at) {
            console.log('📧 Email not verified, showing verification modal');
            setTimeout(() => {
              setShowEmailVerificationModal(true);
            }, 500);
          }
        }}
        onNavigateToScreen={(screen) => {
          // 🔥 FIX: Rimuoviamo console.log eccessivi
          switch (screen) {
            case 'home':
              router.push('/(tabs)');
              break;
            case 'emotion':
              router.push('/(tabs)/analysis');
              break;
            case 'skin':
              router.push('/(tabs)/skin');
              break;
            case 'food':
              router.push('/(tabs)/food');
              break;
            case 'chat':
              router.push('/coach/chat');
              break;
            case 'suggestions':
              // Naviga alla schermata WellnessSuggestions
              router.push('/(tabs)/suggestions');
              break;
            default:
              // 🔥 FIX: Solo errori critici in console
              console.error('Unknown screen:', screen);
          }
        }}
      />

      {/* Email Verification Modal - mostra dopo il tutorial se l'email non è verificata */}
      <EmailVerificationModal
        visible={showEmailVerificationModal}
        userEmail={user?.email || ''}
        onClose={() => {
          // Non permettere di chiudere il modal senza verificare l'email
          // L'utente può solo verificare o reinviare l'email
          Alert.alert(
            t('auth.verifyEmailRequired') || 'Conferma email richiesta',
            t('auth.verifyEmailRequiredCloseMessage') || 'Per utilizzare l\'app, devi confermare la tua email. Controlla la tua casella di posta e clicca sul link di conferma.',
            [{ text: t('common.ok') || 'OK' }]
          );
        }}
        onEmailVerified={async () => {
          // Email verificata! Ricarica l'utente per aggiornare lo stato
          console.log('✅ Email verified, reloading user...');
          setShowEmailVerificationModal(false);

          try {
            // 🔥 FIX: Forza il refresh dell'utente per ottenere i metadata aggiornati
            const { supabase } = await import('../lib/supabase');
            const { data: { user: refreshedUser }, error: refreshError } = await supabase.auth.getUser();

            if (refreshError) {
              console.error('Error refreshing user after email verification:', refreshError);
              // Fallback: usa getCurrentUser
              const currentUser = await AuthService.getCurrentUser();
              if (currentUser) {
                await proceedAfterAuthentication(currentUser);
              }
              return;
            }

            if (refreshedUser) {
              console.log('✅ User refreshed with metadata:', {
                first_name: refreshedUser.user_metadata?.first_name,
                last_name: refreshedUser.user_metadata?.last_name,
                age: refreshedUser.user_metadata?.age,
                gender: refreshedUser.user_metadata?.gender,
              });
              await proceedAfterAuthentication(refreshedUser);
            }
          } catch (error) {
            console.error('Error reloading user after email verification:', error);
            // Fallback: prova con getCurrentUser
            try {
              const currentUser = await AuthService.getCurrentUser();
              if (currentUser) {
                await proceedAfterAuthentication(currentUser);
              }
            } catch (fallbackError) {
              console.error('Fallback error:', fallbackError);
            }
          }
        }}
      />

      {/* 🆕 Email Verified Success Modal */}
      <EmailVerifiedSuccessModal
        visible={showEmailVerifiedSuccess}
        onClose={() => setShowEmailVerifiedSuccess(false)}
        userName={user?.user_metadata?.first_name || user?.user_metadata?.full_name?.split(' ')[0]}
        userGender={user?.user_metadata?.gender}
      />
    </View>
  );
};

// Wrapper principale con TutorialProvider
export const AuthWrapper: React.FC<AuthWrapperProps> = (props) => {
  return (
    <TutorialProvider>
      <AuthWrapperContent {...props} />
    </TutorialProvider>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  appContainer: {
    flex: 1,
  },
});
