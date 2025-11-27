/**
 * Root Layout - Simplified for End-to-End Test with Authentication
 */

import '../i18n'; // 🆕 Inizializza i18n all'avvio
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { registerGlobals } from '@livekit/react-native';

// Do required setup for LiveKit React-Native
registerGlobals();

// 🆕 Initialize Sentry (crash reporting)
try {
  const { initializeSentry } = require('../services/sentry.service');
  initializeSentry();
} catch (error) {
  // Sentry not installed or not configured, ignore
  if (__DEV__) {
    console.log('[Sentry] Not initialized (optional dependency)');
  }
}

// 🆕 Initialize Analytics
try {
  const { AnalyticsService } = require('../services/analytics.service');
  AnalyticsService.initialize().catch(() => {
    // Analytics initialization failed, continue anyway
  });
} catch (error) {
  // Analytics not available, ignore
  if (__DEV__) {
    console.log('[Analytics] Not initialized (optional dependency)');
  }
}

// Add polyfill for navigator.mediaDevices.addEventListener
if (typeof globalThis.navigator === 'undefined') {
  globalThis.navigator = {} as any;
}

if (!('mediaDevices' in globalThis.navigator) || !globalThis.navigator.mediaDevices) {
  console.log('[LiveKit] Creating navigator.mediaDevices polyfill');
  Object.defineProperty(globalThis.navigator, 'mediaDevices', {
    value: {} as any,
    configurable: true,
    enumerable: true,
  });
}

if (!globalThis.navigator.mediaDevices.addEventListener) {
  console.log('[LiveKit] Adding addEventListener polyfill to navigator.mediaDevices');
  
  const mediaDevices = globalThis.navigator.mediaDevices as any;
  
  mediaDevices.addEventListener = function(type: string, listener: EventListener) {
    if (typeof listener !== 'function') return;
    
    // Use the existing on* handlers
    const handlerProp = `on${type}`;
    const original = mediaDevices[handlerProp];
    
    mediaDevices[handlerProp] = function(event: any) {
      if (original && typeof original === 'function') {
        original.call(mediaDevices, event);
      }
      if (listener) {
        listener.call(mediaDevices, event);
      }
    };
  };
  
  mediaDevices.removeEventListener = function(type: string, listener: EventListener) {
    const handlerProp = `on${type}`;
    mediaDevices[handlerProp] = null;
  };
  
  console.log('[LiveKit] ✅ navigator.mediaDevices polyfill added');
}
import { DarkTheme as RNDark, DefaultTheme as RNLight, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { useColorScheme, Platform, View, LogBox } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import * as NavigationBar from 'expo-navigation-bar';
import { AuthWrapper } from '../components/AuthWrapper';
import { ThemeProvider as CustomThemeProvider, useTheme } from '../contexts/ThemeContext'; // 🆕 Our custom theme provider
import { StatusBarProvider, useStatusBarColor } from '../contexts/StatusBarContext'; // 🆕 StatusBar override context
import * as Notifications from 'expo-notifications'; // 🆕 Local notifications
import { useRouter } from 'expo-router'; // 🆕 Navigation
import { TabBarVisibilityProvider } from '../contexts/TabBarVisibilityContext';

// Prevent the splash screen from auto-hiding before asset loading is complete
SplashScreen.preventAutoHideAsync();

// 🆕 Sopprimi warning noti e non critici
if (__DEV__) {
  LogBox.ignoreLogs([
    // expo-av Video component deprecation warning (noto, non critico - usiamo ancora expo-av per Audio)
    /Video component from `expo-av` is deprecated/,
    // AvoidSoftInput warning con react-native-edge-to-edge (noto, gestito da KeyboardAvoidingView)
    /shouldMimic value is ignored when using react-native-edge-to-edge/,
  ]);
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    ...FontAwesome.font,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  // 🆕 Configure notification handler (Expo API update: use banner/list flags)
  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        priority: 'high',
      }),
    } as any);
  }, []);

  // (Removed global SystemUI override to avoid black bar across screens)

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  const handleAuthSuccess = (user: any) => {
    console.log('✅ User authenticated in RootLayout:', user.email);
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <CustomThemeProvider> {/* 🆕 Our custom theme provider (dark mode) */}
        <RootLayoutNavInner onAuthSuccess={handleAuthSuccess} />
      </CustomThemeProvider>
    </GestureHandlerRootView>
  );
}

// Componente interno che può usare useTheme perché è dentro CustomThemeProvider
function RootLayoutNavInner({ onAuthSuccess }: { onAuthSuccess: (user: any) => void }) {
  const { colors, mode } = useTheme(); // 🆕 Get colors from custom theme
  const router = useRouter();
  const systemColorScheme = useColorScheme();
  // 🔥 FIX: Fallback color basato su useColorScheme per evitare flash bianco
  const fallbackBackground = systemColorScheme === 'dark' ? '#1a1625' : '#f8fafc';
  const backgroundColor = colors?.background || fallbackBackground;

  // 🆕 Configure notification handler for navigation
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      const screen = data?.screen;
      const action = data?.action;

      console.log('[Notifications] Notification tapped:', { screen, action, data });

      if (screen === 'analysis') {
        router.push('/(tabs)/analysis');
      } else if (screen === 'journal') {
        router.push('/(tabs)/coach');
      } else if (screen === 'food') {
        router.push('/(tabs)/food');
        if (action === 'OPEN_FRIDGE_RECIPES') {
          // Could open fridge modal here if needed
        }
      } else if (screen === 'breathing') {
        router.push('/breathing-exercise');
      } else if (screen === 'home') {
        router.push('/(tabs)');
      } else if (screen === 'hydration') {
        // Could navigate to hydration tracking if exists
        router.push('/(tabs)');
      }
    });

    return () => subscription.remove();
  }, [router]);

  // Costruisci un tema RN coerente con i tuoi colori personalizzati
  const navTheme = React.useMemo(() => {
    const base = mode === 'dark' ? RNDark : RNLight;
    return {
      ...base,
      dark: mode === 'dark',
      colors: {
        ...base.colors,
        background: backgroundColor,   // 🔥 FIX: Usa backgroundColor con fallback
        card: backgroundColor,
        border: colors?.border || (mode === 'dark' ? '#3a2f4f' : '#e2e8f0'),
        primary: colors?.primary || '#6366f1',
        text: colors?.text || (mode === 'dark' ? '#f5f3ff' : '#0f172a'),
        notification: colors?.accent || '#f59e0b',
      },
    };
  }, [mode, colors, backgroundColor]);

  return (
    <StatusBarProvider>
      <StatusBarWrapper>
    <AuthWrapper onAuthSuccess={onAuthSuccess}>
      <TabBarVisibilityProvider>
        <NavThemeProvider value={navTheme}>
          <Stack
            screenOptions={{
              headerShown: false,
              // 🔥 FIX: Usa backgroundColor con fallback per evitare flash bianco
              contentStyle: { backgroundColor },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="breathing-exercise" options={{ headerShown: false }} />
          </Stack>
        </NavThemeProvider>
      </TabBarVisibilityProvider>
    </AuthWrapper>
      </StatusBarWrapper>
    </StatusBarProvider>
  );
}

// Componente wrapper per StatusBar dinamica basata sul tema
function StatusBarWrapper({ children }: { children: React.ReactNode }) {
  const { mode, colors } = useTheme();
  const { statusBarColor } = useStatusBarColor();
  const systemColorScheme = useColorScheme();
  // 🔥 FIX: Fallback color basato su useColorScheme per evitare flash bianco
  const fallbackBackground = systemColorScheme === 'dark' ? '#1a1625' : '#f8fafc';
  
  // Usa il colore override se disponibile, altrimenti usa il colore del tema, altrimenti fallback
  const effectiveStatusBarColor = statusBarColor || colors?.background || fallbackBackground;
  
  // 🆕 Fix StatusBar e NavigationBar: edge-to-edge con fondo tematizzato
  useEffect(() => {
    // Colora il "dietro" della status bar con il colore override o il tema
    // Questo evita la banda nera/bianca dietro le icone della status bar
    SystemUI.setBackgroundColorAsync(effectiveStatusBarColor).catch(() => {});
    
    if (Platform.OS === 'android') {
      // Colora la navigation bar in basso
      NavigationBar.setBackgroundColorAsync(effectiveStatusBarColor).catch(() => {});
      NavigationBar.setButtonStyleAsync(mode === 'dark' ? 'light' : 'dark').catch(() => {});
      // Rimuovi la riga di separazione
      NavigationBar.setBorderColorAsync('transparent').catch(() => {});
      // Opzionale: per edge-to-edge completo sotto la gesture bar (se necessario)
      // NavigationBar.setBehaviorAsync('overlay-swipe').catch(() => {});
    }
  }, [mode, effectiveStatusBarColor, statusBarColor, colors.background]);
  
  return (
    <>
      {/* View assoluto per coprire tutto lo schermo con il colore di background */}
      <View style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: effectiveStatusBarColor,
        zIndex: -1,
      }} />
      {/* Edge-to-edge: icone sopra al contenuto, il fondo dietro è già colorato da SystemUI */}
      <StatusBar
        translucent
        backgroundColor="transparent"
        style={mode === 'dark' ? 'light' : 'dark'}
      />
      {children}
    </>
  );
}