import React, { useState, useEffect } from 'react';
import { SettingsScreen } from '../../components/SettingsScreen';
import { AuthService } from '../../services/auth.service';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useColorScheme } from 'react-native';

export default function SettingsTabScreen() {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { colors } = useTheme();
  const systemColorScheme = useColorScheme();
  // 🔥 FIX: Fallback color basato su useColorScheme per evitare flash bianco
  const fallbackBackground = systemColorScheme === 'dark' ? '#1a1625' : '#f8fafc';
  const backgroundColor = colors?.background || fallbackBackground;

  useEffect(() => {
    loadCurrentUser();
  }, []);

  const loadCurrentUser = async () => {
    try {
      const currentUser = await AuthService.getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      console.error('Error loading current user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await AuthService.signOut();
      // Il logout sarà gestito dall'AuthWrapper
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  // 🔥 FIX: Mostra un componente con backgroundColor invece di null per evitare flash bianco
  if (isLoading || !user) {
    return <View style={[styles.loadingContainer, { backgroundColor }]} />;
  }

  return <SettingsScreen user={user} onLogout={handleLogout} />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
  },
});
