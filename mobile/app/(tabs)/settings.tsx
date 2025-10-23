import React, { useState, useEffect } from 'react';
import { SettingsScreen } from '../../components/SettingsScreen';
import { AuthService } from '../../services/auth.service';

export default function SettingsTabScreen() {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

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

  if (isLoading || !user) {
    return null; // O un loading spinner
  }

  return <SettingsScreen user={user} onLogout={handleLogout} />;
}
