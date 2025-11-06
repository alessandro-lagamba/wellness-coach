import React, { useState, useEffect, useRef } from 'react';
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

  useEffect(() => {
    checkAuthStatus();
    
    // Ascolta i cambiamenti di autenticazione
    const { data: { subscription } } = AuthService.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, !!session);
        
        if (event === 'SIGNED_IN' && session?.user) {
          setIsAuthenticated(true);
          setUser(session.user);
          onAuthSuccess(session.user);
        } else if (event === 'SIGNED_OUT') {
          setIsAuthenticated(false);
          setUser(null);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // 🆕 Inizializza push notifications quando l'utente è autenticato
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    let intervalId: NodeJS.Timeout | null = null;

    const initPushNotifications = async () => {
      const pushService = PushNotificationService.getInstance();
      const enabled = await pushService.isEnabled();
      
      if (enabled) {
        const initialized = await pushService.initialize(user.id);
        if (initialized) {
          console.log('[AuthWrapper] ✅ Push notifications initialized');
          
          // 🆕 Esegui controlli delle regole ogni 6 ore
          const checkRules = async () => {
            await pushService.checkAllRules(user.id);
          };
          
          // Controlla immediatamente
          checkRules();
          
          // Poi ogni 6 ore (solo se ancora autenticato)
          intervalId = setInterval(() => {
            if (isAuthenticated && user?.id) {
              checkRules();
            }
          }, 6 * 60 * 60 * 1000);
        }
      }
    };

    initPushNotifications();
    
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isAuthenticated, user?.id]);

  // 🆕 Inizializza notifiche locali programmate quando l'utente è autenticato
  const NOTIFICATIONS_SCHEDULED_KEY = '@notifications_scheduled';
  const notificationsScheduledRef = useRef(false);
  
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;
    
    // Evita rischedulazioni multiple durante lo stesso mount
    if (notificationsScheduledRef.current) {
      console.log('[AuthWrapper] ⏭️ Notifications already scheduled in this session');
      return;
    }

    const initLocalNotifications = async () => {
      try {
        // Verifica se le notifiche sono già state schedulate in una sessione precedente
        const wasScheduled = await AsyncStorage.getItem(NOTIFICATIONS_SCHEDULED_KEY);
        if (wasScheduled === 'true') {
          // Verifica che ci siano effettivamente notifiche schedulate
          const scheduled = await Notifications.getAllScheduledNotificationsAsync();
          if (scheduled.length >= 15) {
            console.log('[AuthWrapper] ℹ️ Notifications already scheduled:', scheduled.length);
            notificationsScheduledRef.current = true;
            return;
          }
          // Se le notifiche sono state cancellate, rischedula
          console.log('[AuthWrapper] ⚠️ Notifications were scheduled but not found, rescheduling...');
        }

        const { NotificationService } = await import('../services/notifications.service');
        const granted = await NotificationService.initialize();
        
        if (granted) {
          console.log('[AuthWrapper] ✅ Local notifications initialized');
          
          // Verifica se ci sono già notifiche schedulate
          const scheduled = await Notifications.getAllScheduledNotificationsAsync();
          
          // Controlla se ci sono già notifiche schedulate (almeno 15 per essere sicuri)
          if (scheduled.length >= 15) {
            console.log('[AuthWrapper] ℹ️ Notifications already scheduled:', scheduled.length);
            await AsyncStorage.setItem(NOTIFICATIONS_SCHEDULED_KEY, 'true');
            notificationsScheduledRef.current = true;
            return;
          }
          
          // Se ci sono poche notifiche o nessuna, cancellale tutte e rischedula
          if (scheduled.length === 0 || scheduled.length < 15) {
            console.log('[AuthWrapper] 📅 Scheduling default notifications...');
            // Cancella eventuali notifiche esistenti per evitare duplicati
            await NotificationService.cancelAll();
            // Schedula le nuove notifiche
            const ids = await NotificationService.scheduleDefaults();
            console.log('[AuthWrapper] ✅ Scheduled default notifications:', ids.length);
            // Salva il flag per evitare rischedulazioni future
            await AsyncStorage.setItem(NOTIFICATIONS_SCHEDULED_KEY, 'true');
            notificationsScheduledRef.current = true;
          }
        } else {
          console.log('[AuthWrapper] ⚠️ Notification permission not granted');
        }
      } catch (error) {
        console.error('[AuthWrapper] ❌ Error initializing local notifications:', error);
      }
    };

    // Delay di 3 secondi per evitare rischedulazioni immediate all'avvio
    const timer = setTimeout(() => {
      initLocalNotifications();
    }, 3000);

    return () => {
      clearTimeout(timer);
    };
  }, [isAuthenticated, user?.id]);

  const checkAuthStatus = async () => {
    try {
      console.log('🔍 Checking authentication status...');
      const isAuth = await AuthService.isAuthenticated();
      const currentUser = await AuthService.getCurrentUser();
      
      console.log('🔍 Auth status:', { isAuth, hasUser: !!currentUser });
      
      if (isAuth && currentUser) {
        // User is already authenticated, proceed with biometric check
        console.log('✅ User already authenticated, proceeding with biometric check...');
        
        // Check if biometric authentication is enabled
        const isBiometricEnabled = await BiometricAuthService.isBiometricEnabled();
        console.log('🔐 Biometric enabled:', isBiometricEnabled);
        
        // Check if device actually supports biometrics
        let biometricAvailable = false;
        try {
          const capabilities = await BiometricAuthService.getCapabilities();
          biometricAvailable = capabilities.isAvailable;
          console.log('🔐 Biometric available on device:', biometricAvailable);
        } catch (error) {
          console.error('Error checking biometric availability:', error);
          biometricAvailable = false;
        }
        
        // 🔥 Fallback: se ci sono credenziali biometriche salvate, proponi comunque il prompt
        let hasSavedBiometricCredentials = false;
        try {
          const creds = await BiometricAuthService.getBiometricCredentials();
          hasSavedBiometricCredentials = !!(creds.email && creds.password);
        } catch {}

        if ((isBiometricEnabled || hasSavedBiometricCredentials) && biometricAvailable) {
          console.log('🔐 Biometric authentication required, showing prompt...');
          setBiometricPromptVisible(true);
          // Don't set authenticated yet, wait for biometric confirmation
        } else {
          // No biometric required or not available, proceed normally
          if (isBiometricEnabled && !biometricAvailable) {
            console.log('⚠️ Biometric was enabled but not available, disabling...');
            // Optionally disable biometric if device doesn't support it anymore
            try {
              await BiometricAuthService.clearBiometricCredentials();
            } catch (e) {
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
            onAuthSuccess(currentUser);
          }
        }
      } else {
        // User not authenticated, show login screen
        console.log('❌ User not authenticated, showing login screen');
        setIsAuthenticated(false);
        setUser(null);
        setBiometricPromptVisible(false); // Ensure biometric prompt is hidden
        // Don't show biometric prompt for unauthenticated users
        // Let AuthScreen handle biometric authentication
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuthSuccess = (user: any) => {
    setIsAuthenticated(true);
    setUser(user);
    onAuthSuccess(user);
  };

  const handleBiometricSuccess = async () => {
    try {
      console.log('🔐 Biometric authentication successful, proceeding with already authenticated user...');
      setBiometricPromptVisible(false);
      
      // User is already authenticated, just proceed
      const currentUser = await AuthService.getCurrentUser();
      if (currentUser) {
        console.log('✅ Proceeding with authenticated user:', currentUser.email);
        setIsAuthenticated(true);
        setUser(currentUser);
        
        // Check if onboarding is needed
        const isOnboardingCompleted = await OnboardingService.isOnboardingCompleted();
        if (!isOnboardingCompleted) {
          setShowOnboarding(true);
        } else {
          onAuthSuccess(currentUser);
        }
      } else {
        console.error('❌ No authenticated user found after biometric success');
        setIsAuthenticated(false);
        setUser(null);
      }
    } catch (error) {
      console.error('❌ Error in biometric success handler:', error);
      setIsAuthenticated(false);
      setUser(null);
    }
  };

  const handleBiometricFailure = () => {
    console.log('❌ Biometric authentication failed or cancelled');
    setBiometricPromptVisible(false);
    setIsAuthenticated(false);
    setUser(null);
  };

  const handleOnboardingComplete = async () => {
    setShowOnboarding(false);
    if (user) {
      onAuthSuccess(user);
    }
  };

  const handleLogout = async () => {
    try {
      await AuthService.signOut();
      setIsAuthenticated(false);
      setUser(null);
    } catch (error) {
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
          console.log('🎯 Global Tutorial navigating to:', screen);
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
              console.log('Unknown screen:', screen);
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
