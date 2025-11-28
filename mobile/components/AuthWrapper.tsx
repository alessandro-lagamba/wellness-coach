import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AuthService } from '../services/auth.service';
import { OnboardingService } from '../services/onboarding.service';
import { AuthScreen } from './auth/AuthScreen';
import { OnboardingScreen } from './OnboardingScreen';
import { InteractiveTutorial } from './InteractiveTutorial';
import { TutorialProvider, useTutorial } from '../contexts/TutorialContext';
import { useRouter } from 'expo-router';
import PushNotificationService from '../services/push-notification.service'; // 🆕 Push notifications
import { useStatusBarColor } from '../contexts/StatusBarContext'; // 🆕 StatusBar override

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
  const [showOnboarding, setShowOnboarding] = useState(false);
  const { showTutorial, setShowTutorial } = useTutorial();
  const router = useRouter();
  const { setStatusBarColor } = useStatusBarColor(); // 🆕 Override status bar color
  
  // 🔥 FIX: Usiamo useRef per onAuthSuccess per evitare loop infiniti
  const onAuthSuccessRef = useRef(onAuthSuccess);
  useEffect(() => {
    onAuthSuccessRef.current = onAuthSuccess;
  }, [onAuthSuccess]);
  
  // 🆕 Imposta il colore della status bar quando viene renderizzato il loading screen o AuthScreen
  useEffect(() => {
    // Se siamo in loading o non autenticati, usa il colore del gradiente
    if (isLoading || !isAuthenticated) {
      setStatusBarColor('#667eea');
    } else {
      // Se siamo autenticati, ripristina il colore del tema
      setStatusBarColor(null);
    }
    
    // Cleanup: ripristina il colore del tema quando il componente viene smontato
    return () => {
      setStatusBarColor(null);
    };
  }, [isLoading, isAuthenticated, setStatusBarColor]);

  // 🔥 FIX: Memoizziamo checkAuthStatus per evitare ricreazioni - rimuoviamo onAuthSuccess dalle dipendenze
  const proceedAfterAuthentication = useCallback(async (currentUser: any) => {
    setIsAuthenticated(true);
    setUser(currentUser);

    const onboardingCompleted = await OnboardingService.isOnboardingCompleted();
    if (!onboardingCompleted) {
      setShowOnboarding(true);
      return;
    }

    const tutorialCompleted = await OnboardingService.isTutorialCompleted();
    if (!tutorialCompleted) {
      setTimeout(() => {
        setShowTutorial(true);
      }, 400);
    }

    onAuthSuccessRef.current(currentUser);
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
        // 🔥 FIX: Rimuoviamo console.log eccessivi
        if (event === 'SIGNED_IN' && session?.user) {
          proceedAfterAuthentication(session.user);
        } else if (event === 'SIGNED_OUT') {
          setIsAuthenticated(false);
          setUser(null);
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

  const handleOnboardingComplete = async () => {
    setShowOnboarding(false);
    await OnboardingService.completeOnboarding();
  
    // Check if tutorial should be shown automatically after onboarding
    const isTutorialCompleted = await OnboardingService.isTutorialCompleted();
    if (!isTutorialCompleted) {
      // Show tutorial automatically after a short delay to allow UI to settle
      setTimeout(() => {
        setShowTutorial(true);
      }, 500);
    }
    
    if (user) {
      onAuthSuccessRef.current(user);
    }
  };

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
      <View style={styles.loadingContainer}>
        <LinearGradient
          colors={['#667eea', '#764ba2', '#f093fb']}
          style={styles.loadingGradient}
        >
          <ActivityIndicator size="large" color="#fff" />
        </LinearGradient>
      </View>
    );
  }

  if (!isAuthenticated) {
    return <AuthScreen onAuthSuccess={handleAuthSuccess} />;
  }

  if (showOnboarding) {
    return <OnboardingScreen onComplete={handleOnboardingComplete} />;
  }

  // Renderizza l'app principale con il contesto di autenticazione
  return (
    <View style={styles.appContainer}>
      {children}
      
      {/* Global Tutorial */}
      <InteractiveTutorial
        visible={showTutorial}
        onClose={async () => {
          setShowTutorial(false);
          // Mark tutorial as completed even if closed early
          await OnboardingService.completeTutorial();
        }}
        onComplete={async () => {
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
              // Le suggestions sono mostrate nella home screen
              router.push('/(tabs)');
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
    backgroundColor: '#667eea',
  },
  loadingGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  appContainer: {
    flex: 1,
  },
});
