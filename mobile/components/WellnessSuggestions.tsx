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
  const defaultSuggestions = WELLNESS_SUGGESTIONS.slice(0, 3);
  
  // Stress-related suggestions
  const stressSuggestions: WellnessSuggestion[] = [
    {
      id: 's1',
      title: 'Take a Nature Break',
      description: 'Spending 20 minutes in a park or green space can significantly reduce stress hormones.',
      icon: 'leaf',
      category: 'activity'
    },
    {
      id: 's2',
      title: 'Deep Breathing Exercise',
      description: 'Try 4-7-8 breathing: Inhale for 4 seconds, hold for 7, exhale for 8. Repeat 5 times.',
      icon: 'cloud',
      category: 'emotion'
    },
    {
      id: 's3',
      title: 'Hydration Check',
      description: 'Dehydration can worsen stress. Drink a glass of water with lemon to refresh.',
      icon: 'tint',
      category: 'nutrition'
    }
  ];
  
  // Skin-related suggestions
  const skinSuggestions: WellnessSuggestion[] = [
    {
      id: 'sk1',
      title: 'Gentle Cleansing',
      description: 'Use a pH-balanced cleanser twice daily to maintain healthy skin barrier.',
      icon: 'star',
      category: 'skin'
    },
    {
      id: 'sk2',
      title: 'Sun Protection',
      description: 'Apply SPF 30+ sunscreen daily, even on cloudy days.',
      icon: 'sun-o',
      category: 'skin'
    }
  ];
  
  // Sleep-related suggestions
  const sleepSuggestions: WellnessSuggestion[] = [
    {
      id: 'sl1',
      title: 'Consistent Schedule',
      description: 'Go to bed and wake up at the same time every day, even on weekends.',
      icon: 'clock-o',
      category: 'sleep'
    },
    {
      id: 'sl2',
      title: 'Screen-Free Hour',
      description: 'Avoid screens 1 hour before bedtime to improve sleep quality.',
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
            <Text style={styles.suggestionTitle}>{suggestion.title}</Text>
            <Text style={styles.suggestionDescription}>{suggestion.description}</Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Personalized Wellness Insights</Text>
        <TouchableOpacity 
          style={styles.viewAllButton}
          onPress={() => router.push('/(tabs)/suggestions')}
        >
          <Text style={styles.viewAllText}>View All</Text>
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
    backgroundColor: 'white', // HeroUI bg-content1
    borderRadius: 12, // HeroUI rounded-medium
    padding: 16, // HeroUI p-4
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12, // HeroUI mb-3
  },
  title: {
    fontSize: 16, // HeroUI text-medium
    fontWeight: '500', // HeroUI font-medium
    color: '#374151', // HeroUI text-foreground
  },
  viewAllButton: {
    paddingHorizontal: 8, // HeroUI px-2
    paddingVertical: 4, // HeroUI py-1
  },
  viewAllText: {
    fontSize: 12, // HeroUI text-small
    color: '#6366f1', // HeroUI primary
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
    fontSize: 12, // HeroUI text-small
    fontWeight: '500', // HeroUI font-medium
    color: '#374151', // HeroUI text-foreground
    marginBottom: 4, // HeroUI mb-1
  },
  suggestionDescription: {
    fontSize: 10, // HeroUI text-xs
    color: '#6b7280', // HeroUI text-default-500
    lineHeight: 14, // HeroUI leading-3.5
  },
});
