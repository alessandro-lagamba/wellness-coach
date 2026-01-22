import React from 'react';
import { ChatOnlyScreen } from '../../components/ChatOnlyScreen';
import { useLocalSearchParams } from 'expo-router';
import { AuthService } from '../../services/auth.service';
import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useColorScheme } from 'react-native';

export default function CoachTabScreen() {
  const { voiceMode, t } = useLocalSearchParams();
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { colors } = useTheme();
  const systemColorScheme = useColorScheme();
  // 🔥 FIX: Fallback color basato su useColorScheme per evitare flash bianco
  const fallbackBackground = systemColorScheme === 'dark' ? '#1a1625' : '#f8fafc';
  const backgroundColor = colors?.background || fallbackBackground;

  useEffect(() => {
    const getCurrentUser = async () => {
      // 🔥 FIX: Rimossi log eccessivi
      const currentUser = await AuthService.getCurrentUser();
      setUser(currentUser);
      setIsLoading(false);
    };

    getCurrentUser();

    // Listen for auth state changes
    const { data: { subscription } } = AuthService.onAuthStateChange((event, session) => {
      // 🔥 FIX: Rimossi log eccessivi
      setUser(session?.user || null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Use voiceMode and timestamp as key to force remount when they change
  const key = `${voiceMode}-${t}`;

  // 🔥 FIX: Mostra un componente con backgroundColor invece di null per evitare flash bianco
  if (isLoading) {
    return <View style={[styles.loadingContainer, { backgroundColor }]} />;
  }

  return <ChatOnlyScreen key={key} user={user} />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
  },
});
