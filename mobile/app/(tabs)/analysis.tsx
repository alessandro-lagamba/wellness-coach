/**
 * Analysis Screen - Emotion Detection & Skin Analysis
 * Features: Real-time emotion analysis, skin health metrics, wellness recommendations
 */

import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmotionDetectionScreen } from '../../components/EmotionDetectionScreen';

export default function AnalysisScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <EmotionDetectionScreen />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
});
