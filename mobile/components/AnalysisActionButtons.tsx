import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome } from '@expo/vector-icons';

interface AnalysisActionButtonProps {
  type: 'emotion' | 'skin';
  onPress: () => void;
  disabled?: boolean;
}

export const AnalysisActionButton: React.FC<AnalysisActionButtonProps> = ({
  type,
  onPress,
  disabled = false
}) => {
  const buttonConfig = {
    emotion: {
      icon: 'heart',
      text: '🔍 Analizza Emozioni',
      colors: ['#ef4444', '#dc2626'],
      route: '/emotion-detection'
    },
    skin: {
      icon: 'camera',
      text: '📸 Analizza Pelle',
      colors: ['#3b82f6', '#2563eb'],
      route: '/skin-analysis'
    }
  };

  const config = buttonConfig[type];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[styles.button, disabled && styles.buttonDisabled]}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={disabled ? ['#9ca3af', '#6b7280'] : config.colors}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <View style={styles.buttonContent}>
          <FontAwesome 
            name={config.icon as any} 
            size={16} 
            color="#fff" 
            style={styles.icon}
          />
          <Text style={styles.buttonText}>{config.text}</Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
};

interface AnalysisActionButtonsProps {
  message: string;
  onEmotionAnalysis: () => void;
  onSkinAnalysis: () => void;
  disabled?: boolean;
}

export const AnalysisActionButtons: React.FC<AnalysisActionButtonsProps> = ({
  message,
  onEmotionAnalysis,
  onSkinAnalysis,
  disabled = false
}) => {
  // Rileva se il messaggio contiene call-to-action
  const hasEmotionCTA = message.includes('🔍 Analizza Emozioni');
  const hasSkinCTA = message.includes('📸 Analizza Pelle');

  // Non mostrare bottoni se non ci sono CTA nel messaggio
  if (!hasEmotionCTA && !hasSkinCTA) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.suggestionText}>
        💡 Suggerimento dell'IA:
      </Text>
      <View style={styles.buttonsContainer}>
        {hasEmotionCTA && (
          <AnalysisActionButton
            type="emotion"
            onPress={onEmotionAnalysis}
            disabled={disabled}
          />
        )}
        {hasSkinCTA && (
          <AnalysisActionButton
            type="skin"
            onPress={onSkinAnalysis}
            disabled={disabled}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
    marginHorizontal: 4,
  },
  suggestionText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  buttonsContainer: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  button: {
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  gradient: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
