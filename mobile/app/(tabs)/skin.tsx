import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SkinAnalysisScreen from '../../components/SkinAnalysisScreen';
import { useTheme } from '../../contexts/ThemeContext';

export default function SkinTabScreen() {
  const { colors } = useTheme();
  
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <SkinAnalysisScreen />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
