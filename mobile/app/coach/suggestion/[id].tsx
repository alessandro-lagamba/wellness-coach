import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { getSuggestionById } from '../../../data/wellnessSuggestions';
import Colors from '../../../constants/Colors';

export default function SuggestionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const suggestion = id ? getSuggestionById(id) : undefined;

  if (!suggestion) {
    return (
      <SafeAreaView style={styles.emptyContainer} edges={["top"]}>
        <Text style={styles.emptyTitle}>Suggestion not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.emptyButton}>
          <Text style={styles.emptyButtonText}>Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <FontAwesome name="angle-left" size={18} color={Colors.palette.primary} />
          <Text style={styles.backButtonText}>Wellness Suggestions</Text>
        </TouchableOpacity>

        <Text style={styles.title}>{suggestion.title}</Text>
        <Text style={styles.subtitle}>{suggestion.description}</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How It Helps</Text>
          <Text style={styles.sectionBody}>{suggestion.longDescription}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Yachai Tips</Text>
          {suggestion.tips.map((tip, index) => (
            <View key={index} style={styles.tipRow}>
              <FontAwesome name="check" size={14} color={Colors.palette.primary} />
              <Text style={styles.tipBody}>{tip}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.palette.surfaceMuted,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  backButtonText: {
    marginLeft: 8,
    fontSize: 13,
    color: Colors.palette.primary,
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.palette.textPrimary,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.palette.textSecondary,
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.palette.textPrimary,
    marginBottom: 12,
  },
  sectionBody: {
    fontSize: 13,
    lineHeight: 20,
    color: Colors.palette.textSecondary,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  tipBody: {
    marginLeft: 10,
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    color: Colors.palette.textPrimary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.palette.surfaceMuted,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: Colors.palette.textPrimary,
  },
  emptyButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: Colors.palette.primary,
  },
  emptyButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
});
