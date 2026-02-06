/**
 * Empty State Card Component
 * Mostra messaggi chiari e guidati quando l'utente non ha dati
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../hooks/useTranslation';
import { useRouter } from 'expo-router';
import { useTutorial } from '../contexts/TutorialContext';

interface EmptyStateCardProps {
  type: 'emotion' | 'skin' | 'food' | 'journal' | 'general' | 'copilot';
  onAction?: () => void;
  customTitle?: string;
  customSubtitle?: string;
  customActionText?: string;
  showIllustration?: boolean;
  showTitle?: boolean;
  showLearnMore?: boolean;
  onLearnMore?: () => void;
}

export const EmptyStateCard: React.FC<EmptyStateCardProps> = ({
  type,
  onAction,
  customTitle,
  customSubtitle,
  customActionText,
  showIllustration = true,
  showTitle = true,
  showLearnMore = true,
  onLearnMore,
}) => {
  const { t } = useTranslation();
  const { colors, mode } = useTheme();
  const router = useRouter();
  const { setShowTutorial } = useTutorial();

  const getEmptyStateConfig = () => {
    switch (type) {
      case 'emotion':
        return {
          icon: 'emoticon-happy',
          gradient: ['#667eea', '#764ba2'],
          title: customTitle || t('emptyStates.emotion.title'),
          subtitle: customSubtitle || t('emptyStates.emotion.subtitle'),
          actionText: customActionText || t('emptyStates.emotion.action'),
          description: t('emptyStates.emotion.description'),
        };
      case 'skin':
        return {
          icon: 'face-woman',
          gradient: ['#f093fb', '#f5576c'],
          title: customTitle || t('emptyStates.skin.title'),
          subtitle: customSubtitle || t('emptyStates.skin.subtitle'),
          actionText: customActionText || t('emptyStates.skin.action'),
          description: t('emptyStates.skin.description'),
        };
      case 'food':
        return {
          icon: 'food',
          gradient: ['#ff9a56', '#ff6a88'],
          title: customTitle || t('emptyStates.food.title'),
          subtitle: customSubtitle || t('emptyStates.food.subtitle'),
          actionText: customActionText || t('emptyStates.food.action'),
          description: t('emptyStates.food.description'),
        };
      case 'journal':
        return {
          icon: 'book-open-variant',
          gradient: ['#10b981', '#059669'], // ✅ FIX: Gradiente verde più scuro per migliore leggibilità
          title: customTitle || t('emptyStates.journal.title'),
          subtitle: customSubtitle || t('emptyStates.journal.subtitle'),
          actionText: customActionText || t('emptyStates.journal.action'),
          description: t('emptyStates.journal.description'),
        };
      case 'copilot':
        return {
          icon: 'head-cog',
          gradient: ['#060efdff', '#0084ffff'],
          title: customTitle || t('emptyStates.copilot.title'),
          subtitle: customSubtitle || t('emptyStates.copilot.subtitle'),
          actionText: customActionText || t('emptyStates.copilot.action'),
          description: t('emptyStates.copilot.description'),
        };
      default:
        return {
          icon: 'information',
          gradient: ['#667eea', '#764ba2'],
          title: customTitle || t('emptyStates.general.title'),
          subtitle: customSubtitle || t('emptyStates.general.subtitle'),
          actionText: customActionText || t('emptyStates.general.action'),
          description: t('emptyStates.general.description'),
        };
    }
  };

  const config = getEmptyStateConfig();

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={config.gradient as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.card, { borderColor: colors.border }]}
      >
        {showIllustration && (
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons
              name={config.icon as any}
              size={48}
              color="#fff"
            />
          </View>
        )}

        {showTitle && <Text style={styles.title} allowFontScaling={false}>{config.title}</Text>}
        <Text style={styles.subtitle} allowFontScaling={false}>{config.subtitle}</Text>

        {config.description && (
          <Text style={styles.description} allowFontScaling={false}>{config.description}</Text>
        )}

        {onAction && (
          <TouchableOpacity
            onPress={onAction}
            style={styles.actionButton}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#fff', '#f8f9fa']}
              style={styles.actionButtonGradient}
            >
              <MaterialCommunityIcons name="arrow-right" size={20} color={config.gradient[0]} />
              <Text style={[styles.actionButtonText, { color: config.gradient[0] }]} allowFontScaling={false}>
                {config.actionText}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {showLearnMore && (
          <TouchableOpacity
            onPress={() => {
              if (onLearnMore) {
                onLearnMore();
              } else {
                // Default: show tutorial
                setShowTutorial(true);
              }
            }}
            style={styles.learnMoreButton}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="information-outline" size={16} color="rgba(255, 255, 255, 0.9)" />
            <Text style={styles.learnMoreText} allowFontScaling={false}>
              {t('emptyStates.learnMore')}
            </Text>
          </TouchableOpacity>
        )}
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
    marginHorizontal: 20,
  },
  card: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  title: {
    fontSize: 22,
    fontFamily: 'Figtree_700Bold', // Was bold
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginBottom: 12,
    fontFamily: 'Figtree_500Medium', // Was 500
  },
  description: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    fontFamily: 'Figtree_500Medium',
  },
  actionButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
  },
  actionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    gap: 8,
  },
  actionButtonText: {
    fontSize: 16,
    fontFamily: 'Figtree_700Bold', // Was 600
  },
  learnMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingVertical: 8,
    gap: 6,
  },
  learnMoreText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    textDecorationLine: 'underline',
    fontFamily: 'Figtree_500Medium',
  },
});


