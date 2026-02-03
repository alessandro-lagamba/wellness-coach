import React from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from '../../hooks/useTranslation';

const withAlpha = (color: string | undefined, alpha: string) => {
  if (typeof color === 'string' && color.startsWith('#') && color.length === 7) {
    return `${color}${alpha}`;
  }
  return color || undefined;
};

interface AnalysisCaptureLayoutProps {
  renderCamera: React.ReactNode;
  onBack: () => void;
  onCancel: () => void;
  onCapture: () => void;
  captureDisabled?: boolean;
  showSwitch?: boolean;
  switchLabel?: string;
  onSwitch?: () => void;
  switchDisabled?: boolean;
  cancelLabel?: string;
  captureLabel?: string;
}

export const AnalysisCaptureLayout: React.FC<AnalysisCaptureLayoutProps> = ({
  renderCamera,
  onBack,
  onCancel,
  onCapture,
  captureDisabled = false,
  showSwitch = false,
  switchLabel,
  onSwitch,
  switchDisabled = false,
  cancelLabel,
  captureLabel,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const primaryColor = colors.primary || '#6366f1';
  const primaryLightColor = colors.primaryLight || primaryColor;
  const primaryMutedColor = colors.primaryMuted || primaryColor;
  const primaryDarkColor = colors.primaryDark || primaryColor;
  const textInverseColor = colors.textInverse || '#ffffff';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
        <View style={styles.captureLayout}>
          {/* Header */}
          <View style={styles.captureHeader}>
            <TouchableOpacity
              onPress={onBack}
              activeOpacity={0.7}
              style={[
                styles.captureBackButton,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <FontAwesome name="chevron-left" size={14} color={colors.text} />
              <Text style={[styles.captureBackButtonText, { color: colors.text }]}>{t('common.back')}</Text>
            </TouchableOpacity>
          </View>

          {/* Camera Preview */}
          <View style={styles.cameraWrapper}>{renderCamera}</View>

          {/* Footer Controls */}
          <View style={styles.cameraControls}>

            {/* Left: Cancel Button */}
            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: withAlpha(colors.text, '20') }]}
              onPress={onCancel}
              activeOpacity={0.7}
            >
              <FontAwesome name="times" size={20} color={colors.text} />
            </TouchableOpacity>

            {/* Center: Capture Button */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={onCapture}
              disabled={captureDisabled}
              style={[styles.captureButtonContainer, captureDisabled && { opacity: 0.6 }]}
            >
              <LinearGradient
                colors={[primaryColor, primaryLightColor]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.primaryButton}
              >
                <FontAwesome name="camera" size={24} color={textInverseColor} />
              </LinearGradient>
            </TouchableOpacity>

            {/* Right: Switch Camera Button */}
            {showSwitch ? (
              <TouchableOpacity
                style={[styles.secondaryButton, { borderColor: withAlpha(colors.text, '20') }, switchDisabled && { opacity: 0.5 }]}
                onPress={onSwitch}
                disabled={switchDisabled}
                activeOpacity={0.7}
              >
                <MaterialIcons name="flip-camera-ios" size={22} color={colors.text} />
              </TouchableOpacity>
            ) : (
              <View style={[styles.secondaryButton, { opacity: 0 }]} />
            )}

          </View>
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  captureLayout: {
    flex: 1,
    justifyContent: 'space-between',
    paddingBottom: 20, // Reduced bottom padding
  },
  captureHeader: {
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: 8, // Reduced top padding
    paddingBottom: 8,
    zIndex: 10,
  },
  captureBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  captureBackButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  cameraWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 10,
  },
  cameraControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around', // Distribute space evenly
    paddingHorizontal: 30,
    paddingBottom: 20,
    height: 100,
  },
  secondaryButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)', // Subtle background
    borderWidth: 1,
  },
  captureButtonContainer: {
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  primaryButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
});

export default AnalysisCaptureLayout;

