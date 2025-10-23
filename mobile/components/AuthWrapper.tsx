import React, { useState, useEffect } from 'react';
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
        
        if (isBiometricEnabled && biometricAvailable) {
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
