import React, { useState, useMemo } from 'react';
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
import { useTranslation } from '../hooks/useTranslation';
import { useTheme } from '../contexts/ThemeContext';
import { useAutoScrollToTop } from '../hooks/useAutoScrollToTop';

import { WELLNESS_CATEGORIES, WELLNESS_SUGGESTIONS, WellnessSuggestion } from '../data/wellnessSuggestions';

const { width } = Dimensions.get('window');

export const WellnessSuggestionsScreen: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const router = useRouter();
  const { t, language } = useTranslation();
  const { colors } = useTheme();
  const scrollRef = useAutoScrollToTop<ScrollView>('suggestions');

  const safeT = (key: string, fallbackEn: string, fallbackIt: string) => {
    const v = t(key);
    if (v === key) {
      return language === 'it' ? fallbackIt : fallbackEn;
    }
    return v;
  };

  // Helper function to translate category
  const getTranslatedCategory = (category: typeof WELLNESS_CATEGORIES[0]) => {
    // Mappa le chiavi delle categorie alle chiavi di traduzione
    const map: { [key: string]: { k: string } } = {
      'mind-body': { k: 'mindBody' },
      'nutrition': { k: 'nutrition' },
      'recovery': { k: 'recovery' },
      'mindfulness': { k: 'mindfulness' },
      'energy': { k: 'energy' },
    };
    const translationKey = map[category.id]?.k;

    // Usa sempre le traduzioni dai file di traduzione con fallback
    if (translationKey) {
      const name = safeT(
        `wellnessSuggestions.categories.${translationKey}.name`,
        category.name, // fallback EN
        category.name  // fallback IT (le traduzioni sono già nei file)
      );
      const description = safeT(
        `wellnessSuggestions.categories.${translationKey}.description`,
        category.description, // fallback EN
        category.description  // fallback IT (le traduzioni sono già nei file)
      );
      return { name, description };
    }

    // Fallback se la chiave non esiste
    return { name: category.name, description: category.description };
  };

  // Helper function to translate suggestion
  const getTranslatedSuggestion = (suggestion: WellnessSuggestion) => {
    const id = suggestion.id;
    const keyBaseMap: { [key: string]: string } = {
      'breathing-exercises': 'breathingExercises',
      'take-a-walk': 'takeAWalk',
      'stretching': 'stretching',
      'yoga-flow': 'yogaFlow',
      'hydration': 'hydration',
      'healthy-snack': 'healthySnack',
      'green-tea': 'greenTea',
      'evening-routine': 'eveningRoutine',
      'progressive-relaxation': 'progressiveRelaxation',
      'sleep-meditation': 'sleepMeditation',
      'mindfulness-meditation': 'mindfulnessMeditation',
      'gratitude-practice': 'gratitudePractice',
      'body-scan': 'bodyScan',
      'morning-energy': 'morningEnergy',
      'power-breathing': 'powerBreathing',
      'dance-break': 'danceBreak',
    };
    const key = keyBaseMap[id];

    const fbTitle = suggestion.title;
    const fbDesc = suggestion.description;

    const title = key ? safeT(`wellnessSuggestions.suggestions.${key}.title`, fbTitle, fbTitle) : fbTitle;
    const description = key ? safeT(`wellnessSuggestions.suggestions.${key}.description`, fbDesc, fbDesc) : fbDesc;

    // duration
    let duration = suggestion.duration || '';
    if (duration === 'Ongoing') {
      duration = safeT('wellnessSuggestions.duration.ongoing', 'Ongoing', 'In corso');
    } else if (/\bminutes?\b/.test(duration)) {
      const minutes = duration.replace(/[^0-9]/g, '') || '0';
      duration = t('wellnessSuggestions.duration.minutes', { minutes });
    }

    return { ...suggestion, title, description, duration };
  };

  // Translate all suggestions and categories using useMemo
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const translatedSuggestions = useMemo(() =>
    WELLNESS_SUGGESTIONS.map(getTranslatedSuggestion),
    [t] // Only depend on t, functions will be recreated but that's fine
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const translatedCategories = useMemo(() =>
    WELLNESS_CATEGORIES.map(cat => ({
      ...cat,
      ...getTranslatedCategory(cat),
    })),
    [t] // Only depend on t, functions will be recreated but that's fine
  );

  const handleSuggestionPress = (suggestion: WellnessSuggestion) => {
    // Handle specific suggestions with navigation
    if (suggestion.id === 'breathing-exercises' ||
      suggestion.title.toLowerCase().includes('breathing') ||
      suggestion.title.toLowerCase().includes('respirazione')) {
      router.push('/breathing-exercise');
    } else {
      // For other suggestions, show a placeholder message for now
      console.log('Selected suggestion:', suggestion.title);
      // TODO: Implement other wellness activities
    }
  };


  const renderCategoryCard = (category: typeof translatedCategories[0]) => {
    const suggestions = translatedSuggestions.filter(s => s.category.id === category.id);
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
                <Text style={styles.categoryTitle} allowFontScaling={false}>{category.name}</Text>
                <Text style={styles.categoryDescription} allowFontScaling={false}>{category.description}</Text>
                <Text style={styles.categoryCount} allowFontScaling={false}>
                  {t('wellnessSuggestions.categoriesMeta.count', { count: suggestions.length })}
                </Text>
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
                        <FontAwesome name={suggestion.icon as any} size={16} color="#ffffff" />
                        <Text style={styles.suggestionTitle} allowFontScaling={false}>{suggestion.title}</Text>
                        <Text style={styles.suggestionDuration} allowFontScaling={false}>{suggestion.duration}</Text>
                      </View>
                      <Text style={styles.suggestionDescription} allowFontScaling={false}>{suggestion.description}</Text>
                      <View style={styles.suggestionTags}>
                        {suggestion.tags.slice(0, 3).map((tag) => (
                          <View key={tag} style={[styles.tag, { backgroundColor: category.colors.light }]}>
                            <Text style={[styles.tagText, { color: category.colors.primary }]} allowFontScaling={false}>{tag}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                    <FontAwesome name="chevron-right" size={14} color="#ffffff" />
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
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]} allowFontScaling={false}>{t('wellnessSuggestions.title')}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]} allowFontScaling={false}>
          {t('wellnessSuggestions.subtitle')}
        </Text>
      </View>


      {/* Categories */}
      <ScrollView ref={scrollRef} style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.categoriesContainer}>
          {translatedCategories.map(renderCategoryCard)}
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
    paddingTop: 32,
    paddingBottom: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: {
    fontSize: 24,
    fontFamily: 'Figtree_700Bold', // Was 700
    color: '#0f172a',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    lineHeight: 24,
    fontFamily: 'Figtree_500Medium',
  },
  scrollView: {
    flex: 1,
  },
  categoriesContainer: {
    paddingHorizontal: 20,
    paddingTop: 24,
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
    fontSize: 22,
    fontFamily: 'Figtree_700Bold', // Was 700
    color: '#ffffff',
    marginBottom: 4,
  },
  categoryDescription: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 4,
    fontFamily: 'Figtree_500Medium',
  },
  categoryCount: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    fontFamily: 'Figtree_500Medium', // Was 500
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
    fontSize: 18,
    fontFamily: 'Figtree_700Bold', // Was 600
    color: '#ffffff',
    flex: 1,
  },
  suggestionDuration: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    fontFamily: 'Figtree_500Medium', // Was 500
  },
  suggestionDescription: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 20,
    fontFamily: 'Figtree_500Medium',
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
    fontSize: 13,
    fontFamily: 'Figtree_500Medium', // Was 500
  },
});

export default WellnessSuggestionsScreen;