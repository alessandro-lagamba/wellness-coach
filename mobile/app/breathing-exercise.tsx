import React from 'react';
import { BreathingExerciseScreen } from '../components/screens/BreathingExerciseScreen';
import { Stack } from 'expo-router';

export default function BreathingExercisePage() {
  return (
    <>
      <Stack.Screen 
        options={{ 
          title: 'Esercizio di Respirazione',
          headerBackTitle: 'Indietro'
        }} 
      />
      <BreathingExerciseScreen />
    </>
  );
}
