import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, withSpring, useSharedValue } from 'react-native-reanimated';
import { useRouter } from 'expo-router';

import { WELLNESS_CATEGORIES, WELLNESS_SUGGESTIONS, WellnessSuggestion } from '../data/wellnessSuggestions';

const { width } = Dimensions.get('window');

export const WellnessSuggestionsScreen: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const router = useRouter();

  const handleSuggestionPress = (suggestion: WellnessSuggestion) => {
    // Handle specific suggestions with navigation
    if (suggestion.id === 'breathing-exercises' || suggestion.title.toLowerCase().includes('breathing')) {
      router.push('/breathing-exercise');
    } else {
      // For other suggestions, show a placeholder message for now
      console.log('Selected suggestion:', suggestion.title);
      // TODO: Implement other wellness activities
    }
  };


  const renderCategoryCard = (category: typeof WELLNESS_CATEGORIES[0]) => {
    const suggestions = WELLNESS_SUGGESTIONS.filter(s => s.category.id === category.id);
    const isSelected = selectedCategory === category.id;

    return (
      <TouchableOpacity
        key={category.id}
        style={styles.categoryCard}
        onPress={() => setSelectedCategory(isSelected ? null : category.id)}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={category.colors.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.categoryGradient}
        >
          <View style={styles.categoryContent}>
            <View style={styles.categoryHeader}>
              <View style={[styles.categoryIcon, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                <FontAwesome name={category.icon as any} size={24} color="#ffffff" />
              </View>
              <View style={styles.categoryInfo}>
                <Text style={styles.categoryTitle}>{category.name}</Text>
                <Text style={styles.categoryDescription}>{category.description}</Text>
                <Text style={styles.categoryCount}>{suggestions.length} suggestions</Text>
              </View>
              <FontAwesome 
                name={isSelected ? 'chevron-up' : 'chevron-down'} 
                size={16} 
                color="#ffffff" 
              />
            </View>

            {isSelected && (
              <View style={styles.suggestionsList}>
                {suggestions.map((suggestion) => (
                  <TouchableOpacity
                    key={suggestion.id}
                    style={styles.suggestionItem}
                    onPress={() => handleSuggestionPress(suggestion)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.suggestionContent}>
                      <View style={styles.suggestionHeader}>
                        <FontAwesome name={suggestion.icon as any} size={16} color={category.colors.primary} />
                        <Text style={styles.suggestionTitle}>{suggestion.title}</Text>
                        <Text style={styles.suggestionDuration}>{suggestion.duration}</Text>
                      </View>
                      <Text style={styles.suggestionDescription}>{suggestion.description}</Text>
                      <View style={styles.suggestionTags}>
                        {suggestion.tags.slice(0, 3).map((tag) => (
                          <View key={tag} style={[styles.tag, { backgroundColor: category.colors.light }]}>
                            <Text style={[styles.tagText, { color: category.colors.primary }]}>{tag}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                    <FontAwesome name="chevron-right" size={14} color={category.colors.primary} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Wellness Suggestions</Text>
        <Text style={styles.subtitle}>
          Explore routines curated by your AI coach to support mood, sleep, and skin health
        </Text>
      </View>


      {/* Categories */}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.categoriesContainer}>
          {WELLNESS_CATEGORIES.map(renderCategoryCard)}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    lineHeight: 24,
  },
  scrollView: {
    flex: 1,
  },
  categoriesContainer: {
    paddingHorizontal: 20,
    paddingBottom: 100, // Increased padding to account for bottom navigation bar
    gap: 16,
  },
  categoryCard: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  categoryGradient: {
    padding: 20,
  },
  categoryContent: {
    gap: 16,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryInfo: {
    flex: 1,
  },
  categoryTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  categoryDescription: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 4,
  },
  categoryCount: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  suggestionsList: {
    gap: 12,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  suggestionContent: {
    flex: 1,
    gap: 8,
  },
  suggestionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  suggestionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    flex: 1,
  },
  suggestionDuration: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  suggestionDescription: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 20,
  },
  suggestionTags: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '500',
  },
});

export default WellnessSuggestionsScreen;