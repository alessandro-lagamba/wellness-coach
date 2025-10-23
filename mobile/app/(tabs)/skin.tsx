import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SkinAnalysisScreen from '../../components/SkinAnalysisScreen';

export default function SkinTabScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <SkinAnalysisScreen />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
});
