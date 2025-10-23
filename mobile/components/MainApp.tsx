import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AuthWrapper } from './AuthWrapper';
import { ChatScreen } from './ChatScreen';

/**
 * Main App Component
 * Integrates authentication and chat functionality
 */
export const MainApp: React.FC = () => {
  const handleAuthSuccess = (user: any) => {
    console.log('✅ User authenticated:', user.email);
  };

  return (
    <View style={styles.container}>
      <AuthWrapper onAuthSuccess={handleAuthSuccess}>
        <ChatScreen />
      </AuthWrapper>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default MainApp;


