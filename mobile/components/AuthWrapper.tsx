import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { AuthService } from '../services/auth.service';
import { OnboardingService } from '../services/onboarding.service';
import { AuthScreen } from './auth/AuthScreen';
// 🔥 REMOVED: OnboardingScreen - non lo usiamo più, andiamo direttamente a InteractiveTutorial
import { InteractiveTutorial } from './InteractiveTutorial';
import { useTheme } from '../contexts/ThemeContext';
import { TutorialProvider, useTutorial } from '../contexts/TutorialContext';
import { useRouter } from 'expo-router';
import PushNotificationService from '../services/push-notification.service'; // 🆕 Push notifications

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
  const router = useRouter();
  const { colors, mode } = useTheme(); // 🆕 Theme colors

  // 🔥 FIX: Esponiamo un metodo per forzare la visualizzazione del tutorial
  // Questo permette di rivisualizzare il tutorial da altre schermate (es. HomeScreen)
  const forceShowTutorial = useCallback(async () => {
    console.log('🔄 Forcing tutorial to show...');
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

      console.log('🔍 checkAndShowTutorial - onboardingCompleted:', onboardingCompleted, 'tutorialCompleted:', tutorialCompleted);

      // 🔥 CRITICO: Verifica se l'utente è nuovo o esistente controllando il profilo nel database
      // Se l'utente ha già un profilo, è un utente esistente e non dovrebbe vedere il tutorial
      let isExistingUser = false;
      try {
        const { AuthService } = await import('../services/auth.service');
        const existingProfile = await AuthService.getUserProfile(user.id);
        isExistingUser = !!existingProfile;
        console.log('🔍 checkAndShowTutorial - isExistingUser:', isExistingUser);
      } catch (error) {
        console.warn('⚠️ Could not check user profile in useEffect, assuming new user:', error);
      }

      // 🔥 FIX: Mostra il tutorial SOLO se:
      // 1. Il tutorial non è completato E
      // 2. L'utente è nuovo (non ha un profilo esistente) E
      // 3. Il tutorial non è già visibile
      // Questo previene che utenti esistenti vedano il tutorial dopo aver eliminato l'app
      if (!tutorialCompleted && !isExistingUser && !showTutorial) {
        console.log('🎓 New user detected, tutorial should be shown, scheduling in 2s...');
        setTimeout(() => {
          console.log('🎓 Showing tutorial now via useEffect');
          setShowTutorial(true);
        }, 2000);
      } else if (isExistingUser && !tutorialCompleted) {
        // 🔥 Se l'utente è esistente ma il tutorial non è completato (AsyncStorage resettato),
        // marca il tutorial come completato automaticamente
        console.log('✅ Existing user detected in useEffect, marking tutorial as completed automatically');
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
      console.log('⚠️ Authentication already in progress, skipping...');
      return;
    }

    if (processedUserIdRef.current === currentUser?.id && isAuthenticatedRef.current) {
      console.log('⚠️ User already processed, skipping...');
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
          const existingProfile = await AuthService.getUserProfile(currentUser.id);
          
          if (!existingProfile) {
            console.log('✅ Email verified, creating user profile...');
            // Crea il profilo con i dati disponibili dall'utente
            const fullName = currentUser.user_metadata?.full_name || 
                            currentUser.user_metadata?.name || 
                            currentUser.email?.split('@')[0] || 
                            'User';
            
            await AuthService.createUserProfile(
              currentUser.id,
              currentUser.email || '',
              fullName
            );
            
            // Se ci sono dati aggiuntivi nei metadata, aggiornali
            const firstName = currentUser.user_metadata?.first_name;
            const lastName = currentUser.user_metadata?.last_name;
            const age = currentUser.user_metadata?.age;
            const gender = currentUser.user_metadata?.gender;
            
            if (firstName || lastName || age || gender) {
              await AuthService.updateUserProfile(currentUser.id, {
                first_name: firstName,
                last_name: lastName,
                age: age ? parseInt(age) : undefined,
                gender: gender,
              });
            }
            
            console.log('✅ User profile created successfully after email verification');
          } else {
            console.log('✅ User profile already exists');
          }
        } else {
          console.log('⚠️ Email not verified yet, profile will be created after verification');
        }
      } catch (profileError) {
        console.error('❌ Error checking/creating user profile:', profileError);
        // Non blocchiamo l'autenticazione se la creazione del profilo fallisce
      }

      // 🔥 FIX: Non mostriamo più OnboardingScreen, andiamo direttamente al tutorial
      // Controlla se mostrare il tutorial
      const tutorialCompleted = await OnboardingService.isTutorialCompleted();
      console.log('🔍 proceedAfterAuthentication - tutorialCompleted:', tutorialCompleted);
      
      // 🔥 FIX: Marca l'onboarding come completato automaticamente (non lo mostriamo più)
      const onboardingCompleted = await OnboardingService.isOnboardingCompleted();
      if (!onboardingCompleted) {
        await OnboardingService.completeOnboarding();
        console.log('✅ Onboarding marked as completed automatically (skipping OnboardingScreen)');
      }
      
      // 🔥 CRITICO: Verifica se l'utente è nuovo o esistente controllando il profilo nel database
      // Se l'utente ha già un profilo, è un utente esistente e non dovrebbe vedere il tutorial
      // anche se AsyncStorage è stato resettato (es. dopo aver eliminato l'app)
      let isExistingUser = false;
      try {
        const { AuthService } = await import('../services/auth.service');
        const existingProfile = await AuthService.getUserProfile(currentUser.id);
        isExistingUser = !!existingProfile;
        console.log('🔍 User profile check - isExistingUser:', isExistingUser);
      } catch (error) {
        console.warn('⚠️ Could not check user profile, assuming new user:', error);
      }
      
      // 🔥 FIX: Mostra il tutorial SOLO se:
      // 1. Il tutorial non è completato E
      // 2. L'utente è nuovo (non ha un profilo esistente)
      // Questo previene che utenti esistenti vedano il tutorial dopo aver eliminato l'app
      if (!tutorialCompleted && !isExistingUser) {
        // Delay più lungo per permettere all'app di renderizzarsi completamente
        console.log('🎓 New user detected, scheduling InteractiveTutorial to show in 2s after authentication...');
        setTimeout(() => {
          console.log('🎓 Showing InteractiveTutorial after authentication');
          setShowTutorial(true);
        }, 2000);
      } else if (isExistingUser && !tutorialCompleted) {
        // 🔥 Se l'utente è esistente ma il tutorial non è completato (AsyncStorage resettato),
        // marca il tutorial come completato automaticamente
        console.log('✅ Existing user detected, marking tutorial as completed automatically');
        await OnboardingService.completeTutorial();
      } else {
        console.log('⚠️ Tutorial already completed or user is existing, skipping...');
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
          // 🔥 FIX: Evita di chiamare proceedAfterAuthentication se già chiamato da handleAuthSuccess
          // Il listener onAuthStateChange viene chiamato automaticamente dopo signIn/signUp
          // ma handleAuthSuccess viene chiamato prima, quindi controlliamo se l'utente è già stato processato
          if (processedUserIdRef.current !== session.user.id || !isAuthenticatedRef.current) {
            console.log('🔄 Auth state changed, processing user...');
            proceedAfterAuthentication(session.user);
          } else {
            console.log('⚠️ User already processed via handleAuthSuccess, skipping onAuthStateChange');
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
  console.log('🔍 AuthWrapper render - showTutorial:', showTutorial);
  
  return (
    <View style={styles.appContainer}>
      {children}

      {/* Global Tutorial - sempre renderizzato, visibilità controllata da showTutorial */}
      <InteractiveTutorial
        visible={showTutorial}
        onClose={async () => {
          console.log('🚪 Tutorial closed by user');
          setShowTutorial(false);
          // Mark tutorial as completed even if closed early
          await OnboardingService.completeTutorial();
        }}
        onComplete={async () => {
          console.log('✅ Tutorial completed by user');
          setShowTutorial(false);
          // Mark tutorial as completed
          await OnboardingService.completeTutorial();
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
