import React from 'react';
import { ChatScreen } from '../../components/ChatScreen';
import { useLocalSearchParams } from 'expo-router';
import { AuthService } from '../../services/auth.service';
import { useEffect, useState } from 'react';

export default function CoachTabScreen() {
  const { voiceMode, t } = useLocalSearchParams();
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    const getCurrentUser = async () => {
      console.log('🔐 Getting current user...');
      const currentUser = await AuthService.getCurrentUser();
      console.log('🔐 Current user result:', currentUser);
      setUser(currentUser);
      setIsLoading(false);
    };
    
    getCurrentUser();
    
    // Listen for auth state changes
    const { data: { subscription } } = AuthService.onAuthStateChange((event, session) => {
      console.log('🔐 Auth state changed:', event, session?.user ? { id: session.user.id, email: session.user.email } : null);
      setUser(session?.user || null);
    });
    
    return () => {
      subscription.unsubscribe();
    };
  }, []);
  
  // Use voiceMode and timestamp as key to force remount when they change
  const key = `${voiceMode}-${t}`;
  
  console.log('🔐 Coach.tsx passing user to ChatScreen:', user ? { id: user.id, email: user.email } : null);
  
  // Show loading or handle unauthenticated user
  if (isLoading) {
    return null; // or a loading component
  }
  
  return <ChatScreen key={key} user={user} />;
}
