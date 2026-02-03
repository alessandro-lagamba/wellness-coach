import React from 'react';
import { Stack } from 'expo-router';
import { ChatOnlyScreen } from '../../components/ChatOnlyScreen';

export default function ChatRoute() {
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false
        }}
      />
      <ChatOnlyScreen />
    </>
  );
}
