import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AuthService } from '../services/auth.service';
import { OnboardingService } from '../services/onboarding.service';
import { BiometricAuthService } from '../services/biometric-auth.service';
import { AuthScreen } from './auth/AuthScreen';
import { OnboardingScreen } from './OnboardingScreen';
import { InteractiveTutorial } from './InteractiveTutorial';
import { BiometricPromptModal } from './BiometricPromptModal';
import { TutorialProvider, useTutorial } from '../contexts/TutorialContext';
import { useRouter } from 'expo-router';
import PushNotificationService from '../services/push-notification.service'; // 🆕 Push notifications
import { useStatusBarColor } from '../contexts/StatusBarContext'; // 🆕 StatusBar override
import * as Notifications from 'expo-notifications'; // 🆕 Local notifications
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  const [biometricPromptVisible, setBiometricPromptVisible] = useState(false);
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
  const checkAuthStatus = useCallback(async () => {
    try {
      // 🔥 FIX: Rimuoviamo console.log eccessivi - manteniamo solo errori critici
      const isAuth = await AuthService.isAuthenticated();
      const currentUser = await AuthService.getCurrentUser();
      
      if (isAuth && currentUser) {
        // User is already authenticated, proceed with biometric check
        
        // Check if biometric authentication is enabled
        const isBiometricEnabled = await BiometricAuthService.isBiometricEnabled();
        
        // Check if device actually supports biometrics
        let biometricAvailable = false;
        try {
          const capabilities = await BiometricAuthService.getCapabilities();
          biometricAvailable = capabilities.isAvailable;
        } catch (error) {
          // 🔥 FIX: Solo errori critici in console
          console.error('Error checking biometric availability:', error);
          biometricAvailable = false;
        }
        
        // 🔥 Fallback: se ci sono credenziali biometriche salvate, proponi comunque il prompt
        let hasSavedBiometricCredentials = false;
        try {
          const creds = await BiometricAuthService.getBiometricCredentials();
          hasSavedBiometricCredentials = !!(creds.email && creds.password);
        } catch (error) {
          // 🔥 FIX: Solo errori critici in console
          console.error('Error checking saved biometric credentials:', error);
        }

        // 🔥 Mostra il prompt biometrico se:
        // 1. L'autenticazione biometrica è abilitata E il dispositivo supporta biometrics
        // 2. OPPURE ci sono credenziali biometriche salvate E il dispositivo supporta biometrics
        const shouldShowBiometric = (isBiometricEnabled || hasSavedBiometricCredentials) && biometricAvailable;

        if (shouldShowBiometric) {
          // 🔥 Imposta isAuthenticated a true PRIMA di mostrare il prompt
          // Questo permette al prompt di essere mostrato (perché isAuthenticated è true)
          setIsAuthenticated(true);
          setUser(currentUser);
          setBiometricPromptVisible(true);
          // Il prompt biometrico verrà mostrato e, se confermato, chiamerà handleBiometricSuccess
        } else {
          // No biometric required or not available, proceed normally
          if (isBiometricEnabled && !biometricAvailable) {
            // Optionally disable biometric if device doesn't support it anymore
            try {
              await BiometricAuthService.clearBiometricCredentials();
            } catch (e) {
              // 🔥 FIX: Solo errori critici in console
              console.error('Error clearing biometric credentials:', e);
            }
          }
          
          setIsAuthenticated(true);
          setUser(currentUser);
          
          // Check if onboarding is needed
          const isOnboardingCompleted = await OnboardingService.isOnboardingCompleted();
          if (!isOnboardingCompleted) {
            setShowOnboarding(true);
          } else {
            onAuthSuccessRef.current(currentUser);
          }
        }
      } else {
        // User not authenticated, show login screen
        setIsAuthenticated(false);
        setUser(null);
        setBiometricPromptVisible(false); // Ensure biometric prompt is hidden
        // Don't show biometric prompt for unauthenticated users
        // Let AuthScreen handle biometric authentication
      }
    } catch (error) {
      // 🔥 FIX: Solo errori critici in console + feedback utente per errori critici
      console.error('Error checking auth status:', error);
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []); // 🔥 FIX: Rimossi onAuthSuccess dalle dipendenze - usiamo ref

  useEffect(() => {
    checkAuthStatus();
    
    // Ascolta i cambiamenti di autenticazione
    const { data: { subscription } } = AuthService.onAuthStateChange(
      async (event, session) => {
        // 🔥 FIX: Rimuoviamo console.log eccessivi
        if (event === 'SIGNED_IN' && session?.user) {
          setIsAuthenticated(true);
          setUser(session.user);
          onAuthSuccessRef.current(session.user);
        } else if (event === 'SIGNED_OUT') {
          setIsAuthenticated(false);
          setUser(null);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [checkAuthStatus]); // 🔥 FIX: Rimossi onAuthSuccess dalle dipendenze - usiamo ref

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

  // 🆕 Inizializza notifiche locali programmate quando l'utente è autenticato
  const NOTIFICATIONS_SCHEDULED_KEY = '@notifications_scheduled';
  const NOTIFICATIONS_LAST_SCHEDULED_KEY = '@notifications_last_scheduled';
  const notificationsScheduledRef = useRef(false);
  
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;
    
    // Evita rischedulazioni multiple durante lo stesso mount
    if (notificationsScheduledRef.current) {
      return;
    }

    const initLocalNotifications = async () => {
      // 🔥 FIX: Verifica se il componente è ancora montato
      if (!isMountedRef.current) return;
      
      try {
        // 🔥 PRIMA verifica se ci sono già notifiche schedulate (PRIMA di chiamare initialize)
        const scheduled = await Notifications.getAllScheduledNotificationsAsync();
        
        // 🔥 MIGLIORATO: Verifica se ci sono notifiche valide (non scadute)
        const now = Date.now();
        const validNotifications = scheduled.filter(notif => {
          if (!notif.trigger) return false;
          // Verifica se la notifica è ricorrente o ha una data futura
          if ('repeats' in notif.trigger && notif.trigger.repeats) {
            return true; // Notifiche ricorrenti sono sempre valide
          }
          if ('date' in notif.trigger && notif.trigger.date) {
            const triggerDate = new Date(notif.trigger.date).getTime();
            return triggerDate > now; // Solo notifiche future
          }
          return false;
        });
        
        // Se ci sono già notifiche valide (almeno 10), non rischedulare
        if (validNotifications.length >= 10) {
          await AsyncStorage.setItem(NOTIFICATIONS_SCHEDULED_KEY, 'true');
          await AsyncStorage.setItem(NOTIFICATIONS_LAST_SCHEDULED_KEY, now.toString());
          notificationsScheduledRef.current = true;
          return;
        }

        // 🔥 MIGLIORATO: Verifica quando sono state schedulate l'ultima volta
        const lastScheduledStr = await AsyncStorage.getItem(NOTIFICATIONS_LAST_SCHEDULED_KEY);
        if (lastScheduledStr) {
          const lastScheduled = parseInt(lastScheduledStr, 10);
          const hoursSinceLastSchedule = (now - lastScheduled) / (1000 * 60 * 60);
          
          // Se sono state schedulate meno di 24 ore fa e ci sono ancora notifiche valide, non rischedulare
          if (hoursSinceLastSchedule < 24 && validNotifications.length >= 5) {
            notificationsScheduledRef.current = true;
            return;
          }
        }

        // Verifica se le notifiche sono già state schedulate in una sessione precedente
        const wasScheduled = await AsyncStorage.getItem(NOTIFICATIONS_SCHEDULED_KEY);
        if (wasScheduled === 'true' && validNotifications.length >= 10) {
          notificationsScheduledRef.current = true;
          return;
        }

        // 🔥 MIGLIORATO: Rischedula solo se necessario
        // Se le notifiche sono state cancellate o non ci sono abbastanza notifiche valide, rischedula
        if (validNotifications.length < 10) {
          // 🔥 FIX: Verifica di nuovo se il componente è ancora montato
          if (!isMountedRef.current) return;
          
          const { NotificationService } = await import('../services/notifications.service');
          const granted = await NotificationService.initialize();
          
          if (granted) {
            // Cancella solo le notifiche non valide (scadute)
            const expiredNotifications = scheduled.filter(notif => {
              if (!notif.trigger) return true;
              if ('repeats' in notif.trigger && notif.trigger.repeats) {
                return false; // Non cancellare notifiche ricorrenti
              }
              if ('date' in notif.trigger && notif.trigger.date) {
                const triggerDate = new Date(notif.trigger.date).getTime();
                return triggerDate <= now; // Cancella solo quelle scadute
              }
              return true;
            });
            
            // Cancella solo le notifiche scadute
            for (const notif of expiredNotifications) {
              try {
                await Notifications.cancelScheduledNotificationAsync(notif.identifier);
              } catch (error) {
                // Ignora errori se la notifica non esiste più
              }
            }
            
            // Schedula le nuove notifiche solo se necessario
            const ids = await NotificationService.scheduleDefaults();
            
            // Salva il flag e il timestamp per evitare rischedulazioni future
            await AsyncStorage.setItem(NOTIFICATIONS_SCHEDULED_KEY, 'true');
            await AsyncStorage.setItem(NOTIFICATIONS_LAST_SCHEDULED_KEY, now.toString());
            notificationsScheduledRef.current = true;
          }
        }
      } catch (error) {
        // 🔥 FIX: Solo errori critici in console
        console.error('[AuthWrapper] ❌ Error initializing local notifications:', error);
      }
    };

    // Delay di 3 secondi per evitare rischedulazioni immediate all'avvio
    const timer = setTimeout(() => {
      if (isMountedRef.current) {
        initLocalNotifications();
      }
    }, 3000);

    return () => {
      clearTimeout(timer);
    };
  }, [isAuthenticated, user?.id]);

  // 🔥 FIX: checkAuthStatus è già definita come useCallback sopra (linea 54) - rimuoviamo questa duplicata

  const handleAuthSuccess = (user: any) => {
    setIsAuthenticated(true);
    setUser(user);
    onAuthSuccessRef.current(user);
  };

  const handleBiometricSuccess = async () => {
    try {
      // 🔥 FIX: Rimuoviamo console.log eccessivi
      setBiometricPromptVisible(false);
      
      // User is already authenticated (set in checkAuthStatus), just proceed with onboarding check
      const currentUser = await AuthService.getCurrentUser();
      if (currentUser) {
        // isAuthenticated e user sono già impostati in checkAuthStatus, quindi non serve reimpostarli
        
        // Check if onboarding is needed
        const isOnboardingCompleted = await OnboardingService.isOnboardingCompleted();
        if (!isOnboardingCompleted) {
          setShowOnboarding(true);
        } else {
          onAuthSuccessRef.current(currentUser);
        }
      } else {
        // 🔥 FIX: Solo errori critici in console
        console.error('❌ No authenticated user found after biometric success');
        setIsAuthenticated(false);
        setUser(null);
      }
    } catch (error) {
      // 🔥 FIX: Solo errori critici in console
      console.error('❌ Error in biometric success handler:', error);
      setIsAuthenticated(false);
      setUser(null);
    }
  };

  const handleBiometricFailure = () => {
    // 🔥 FIX: Rimuoviamo console.log eccessivi
    setBiometricPromptVisible(false);
    setIsAuthenticated(false);
    setUser(null);
  };

  const handleOnboardingComplete = async () => {
    setShowOnboarding(false);
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
      
      {/* Biometric Authentication Modal - Only show for authenticated users */}
      {isAuthenticated && (
        <BiometricPromptModal
          visible={biometricPromptVisible}
          onSuccess={handleBiometricSuccess}
          onFailure={handleBiometricFailure}
        />
      )}
      
      {/* Global Tutorial */}
      <InteractiveTutorial
        visible={showTutorial}
        onClose={() => setShowTutorial(false)}
        onComplete={() => setShowTutorial(false)}
        onNavigateToScreen={(screen) => {
          // 🔥 FIX: Rimuoviamo console.log eccessivi
          switch (screen) {
            case 'home':
              router.push('/(tabs)/');
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
