import React from 'react';
import { Stack } from 'expo-router';
import { ChatScreen } from '../../components/ChatScreen';

export default function ChatRoute() {
  return (
    <>
      <Stack.Screen 
        options={{ 
          headerShown: false 
        }} 
      />
      <ChatScreen />
    </>
  );
}
