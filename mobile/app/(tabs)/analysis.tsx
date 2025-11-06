/**
 * Analysis Screen - Emotion Detection & Skin Analysis
 * Features: Real-time emotion analysis, skin health metrics, wellness recommendations
 */

import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmotionDetectionScreen } from '../../components/EmotionDetectionScreen';
import { useTheme } from '../../contexts/ThemeContext';

export default function AnalysisScreen() {
  const { colors } = useTheme();
  
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <EmotionDetectionScreen />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
