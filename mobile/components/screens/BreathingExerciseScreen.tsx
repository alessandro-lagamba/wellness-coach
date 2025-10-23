import React from 'react';
import { Breathing478 } from '../wellness/BreathingExercise';
import { useRouter } from 'expo-router';

export const BreathingExerciseScreen: React.FC = () => {
  const router = useRouter();

  const handleComplete = () => {
    // Navigate back or show completion message
    router.back();
  };

  const handleClose = () => {
    router.back();
  };

  return (
    <Breathing478
      onComplete={handleComplete}
      onClose={handleClose}
    />
  );
};
