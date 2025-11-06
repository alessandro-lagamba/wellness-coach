import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';
import { WELLNESS_SUGGESTIONS } from '../data/wellnessSuggestions';
import Animated, {
  useAnimatedStyle,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { useTranslation } from '../hooks/useTranslation';
import { useTheme } from '../contexts/ThemeContext';

interface WellnessSuggestion {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: 'emotion' | 'skin' | 'sleep' | 'nutrition' | 'activity';
}

interface WellnessSuggestionProps {
  context?: string | null;
}

export const WellnessSuggestions: React.FC<WellnessSuggestionProps> = ({ context }) => {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors: themeColors } = useTheme();
  
  // Helper functions to get translated titles and descriptions
  const getTranslatedTitle = (id: string): string => {
    const keyMap: { [key: string]: string } = {
      'breathing-exercises': 'wellnessSuggestions.suggestions.breathingExercises.title',
      'take-a-walk': 'wellnessSuggestions.suggestions.takeAWalk.title',
      'stretching': 'wellnessSuggestions.suggestions.stretching.title',
      'yoga-flow': 'wellnessSuggestions.suggestions.yogaFlow.title',
      'hydration': 'wellnessSuggestions.suggestions.hydration.title',
      'healthy-snack': 'wellnessSuggestions.suggestions.healthySnack.title',
      'green-tea': 'wellnessSuggestions.suggestions.greenTea.title',
      'evening-routine': 'wellnessSuggestions.suggestions.eveningRoutine.title',
      'progressive-relaxation': 'wellnessSuggestions.suggestions.progressiveRelaxation.title',
      'sleep-meditation': 'wellnessSuggestions.suggestions.sleepMeditation.title',
      'mindfulness-meditation': 'wellnessSuggestions.suggestions.mindfulnessMeditation.title',
      'gratitude-practice': 'wellnessSuggestions.suggestions.gratitudePractice.title',
      'body-scan': 'wellnessSuggestions.suggestions.bodyScan.title',
      'morning-energy': 'wellnessSuggestions.suggestions.morningEnergy.title',
      'power-breathing': 'wellnessSuggestions.suggestions.powerBreathing.title',
      'dance-break': 'wellnessSuggestions.suggestions.danceBreak.title',
    };
    return keyMap[id] ? t(keyMap[id]) : id;
  };

  const getTranslatedDescription = (id: string): string => {
    const keyMap: { [key: string]: string } = {
      'breathing-exercises': 'wellnessSuggestions.suggestions.breathingExercises.description',
      'take-a-walk': 'wellnessSuggestions.suggestions.takeAWalk.description',
      'stretching': 'wellnessSuggestions.suggestions.stretching.description',
      'yoga-flow': 'wellnessSuggestions.suggestions.yogaFlow.description',
      'hydration': 'wellnessSuggestions.suggestions.hydration.description',
      'healthy-snack': 'wellnessSuggestions.suggestions.healthySnack.description',
      'green-tea': 'wellnessSuggestions.suggestions.greenTea.description',
      'evening-routine': 'wellnessSuggestions.suggestions.eveningRoutine.description',
      'progressive-relaxation': 'wellnessSuggestions.suggestions.progressiveRelaxation.description',
      'sleep-meditation': 'wellnessSuggestions.suggestions.sleepMeditation.description',
      'mindfulness-meditation': 'wellnessSuggestions.suggestions.mindfulnessMeditation.description',
      'gratitude-practice': 'wellnessSuggestions.suggestions.gratitudePractice.description',
      'body-scan': 'wellnessSuggestions.suggestions.bodyScan.description',
      'morning-energy': 'wellnessSuggestions.suggestions.morningEnergy.description',
      'power-breathing': 'wellnessSuggestions.suggestions.powerBreathing.description',
      'dance-break': 'wellnessSuggestions.suggestions.danceBreak.description',
    };
    return keyMap[id] ? t(keyMap[id]) : id;
  };

  // Get contextual suggestions based on user input
  const getSuggestionsByContext = () => {
    if (!context) return defaultSuggestions;
    
    switch(context.toLowerCase()) {
      case 'stress':
        return stressSuggestions;
      case 'skin':
        return skinSuggestions;
      case 'sleep':
        return sleepSuggestions;
      default:
        return defaultSuggestions;
    }
  };
  
  // Default suggestions - use first 3 items from main data for consistency
  const defaultSuggestions = WELLNESS_SUGGESTIONS.slice(0, 3).map(s => ({
    ...s,
    title: getTranslatedTitle(s.id),
    description: getTranslatedDescription(s.id),
  }));
  
  // Stress-related suggestions
  const stressSuggestions: WellnessSuggestion[] = [
    {
      id: 's1',
      title: t('wellnessSuggestions.suggestions.natureBreak.title'),
      description: t('wellnessSuggestions.suggestions.natureBreak.description'),
      icon: 'leaf',
      category: 'activity'
    },
    {
      id: 's2',
      title: t('wellnessSuggestions.suggestions.deepBreathing.title'),
      description: t('wellnessSuggestions.suggestions.deepBreathing.description'),
      icon: 'cloud',
      category: 'emotion'
    },
    {
      id: 's3',
      title: t('wellnessSuggestions.suggestions.hydrationCheck.title'),
      description: t('wellnessSuggestions.suggestions.hydrationCheck.description'),
      icon: 'tint',
      category: 'nutrition'
    }
  ];
  
  // Skin-related suggestions
  const skinSuggestions: WellnessSuggestion[] = [
    {
      id: 'sk1',
      title: t('wellnessSuggestions.suggestions.gentleCleansing.title'),
      description: t('wellnessSuggestions.suggestions.gentleCleansing.description'),
      icon: 'star',
      category: 'skin'
    },
    {
      id: 'sk2',
      title: t('wellnessSuggestions.suggestions.sunProtection.title'),
      description: t('wellnessSuggestions.suggestions.sunProtection.description'),
      icon: 'sun-o',
      category: 'skin'
    }
  ];
  
  // Sleep-related suggestions
  const sleepSuggestions: WellnessSuggestion[] = [
    {
      id: 'sl1',
      title: t('wellnessSuggestions.suggestions.consistentSchedule.title'),
      description: t('wellnessSuggestions.suggestions.consistentSchedule.description'),
      icon: 'clock-o',
      category: 'sleep'
    },
    {
      id: 'sl2',
      title: t('wellnessSuggestions.suggestions.screenFreeHour.title'),
      description: t('wellnessSuggestions.suggestions.screenFreeHour.description'),
      icon: 'tablet',
      category: 'sleep'
    }
  ];
  
  const suggestions = getSuggestionsByContext();
  
  const getCategoryColor = (category: any): string => {
    // Use the actual category colors from the data
    if (typeof category === 'object' && category?.colors?.primary) {
      return category.colors.primary;
    }
    return '#6b7280'; // fallback color
  };
  
  const getCategoryBg = (category: any): string => {
    // Use the actual category colors from the data
    if (typeof category === 'object' && category?.colors?.light) {
      return category.colors.light;
    }
    return 'rgba(107, 114, 128, 0.1)'; // fallback color
  };

  const handleSuggestionPress = (suggestion: WellnessSuggestion) => {
    // Handle specific suggestions with navigation
    if (suggestion.id === 's2' || suggestion.title.toLowerCase().includes('breathing')) {
      router.push('/breathing-exercise');
    } else {
      // For other suggestions, just log for now
      console.log('Selected suggestion:', suggestion.title);
    }
  };

  const SuggestionCard = ({ suggestion, index }: { suggestion: WellnessSuggestion; index: number }) => {
    const animatedStyle = useAnimatedStyle(() => ({
      opacity: withDelay(index * 100, withTiming(1, { duration: 300 })),
      transform: [
        { translateY: withDelay(index * 100, withTiming(0, { duration: 300 })) },
      ],
    }));

    return (
      <Animated.View style={animatedStyle}>
        <TouchableOpacity 
          style={styles.suggestionCard}
          onPress={() => handleSuggestionPress(suggestion)}
          activeOpacity={0.7}
        >
          <View style={[styles.iconContainer, { backgroundColor: getCategoryBg(suggestion.category) }]}>
            <FontAwesome 
              name={suggestion.icon as any} 
              size={18} 
              color={getCategoryColor(suggestion.category)}
            />
          </View>
          <View style={styles.suggestionContent}>
            <Text style={[styles.suggestionTitle, { color: themeColors.text }]}>{suggestion.title}</Text>
            <Text style={[styles.suggestionDescription, { color: themeColors.textSecondary }]}>{suggestion.description}</Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: themeColors.text }]}>{t('wellnessSuggestions.personalizedInsights')}</Text>
        <TouchableOpacity 
          style={styles.viewAllButton}
          onPress={() => router.push('/(tabs)/suggestions')}
        >
          <Text style={[styles.viewAllText, { color: themeColors.primary }]}>{t('wellnessSuggestions.viewAll')}</Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {suggestions.map((suggestion, index) => (
          <SuggestionCard key={suggestion.id} suggestion={suggestion} index={index} />
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 1,
    // Background e border gestiti inline con themeColors
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12, // HeroUI mb-3
  },
  title: {
    fontSize: 16,
    fontWeight: '500',
    // Colore gestito inline con themeColors.text
  },
  viewAllButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  viewAllText: {
    fontSize: 12,
    // Colore gestito inline con themeColors.primary
  },
  scrollContent: {
    paddingRight: 16, // HeroUI pr-4
  },
  suggestionCard: {
    width: 160, // Fixed width for horizontal scroll
    marginRight: 12, // HeroUI mr-3
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 32, // HeroUI icon size
    height: 32,
    borderRadius: 16, // HeroUI rounded-full
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12, // HeroUI mr-3
  },
  suggestionContent: {
    flex: 1,
  },
  suggestionTitle: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
    // Colore gestito inline con themeColors.text
  },
  suggestionDescription: {
    fontSize: 10,
    lineHeight: 14,
    // Colore gestito inline con themeColors.textSecondary
  },
});
