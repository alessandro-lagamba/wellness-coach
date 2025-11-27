import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { IntelligentInsightCard } from './IntelligentInsightCard';
import IntelligentInsightService, { IntelligentInsight, InsightAnalysisResponse } from '../services/intelligent-insight.service';
import IntelligentInsightDBService from '../services/intelligent-insight-db.service';
import { useTheme } from '../contexts/ThemeContext';
import { getTodayISODate } from '../utils/locale-formatters';

interface IntelligentInsightsSectionProps {
  category: 'emotion' | 'skin' | 'food';
  data: any;
  maxInsights?: number;
  showTitle?: boolean;
  compact?: boolean;
  onInsightPress?: (insight: IntelligentInsight) => void;
  onActionPress?: (insight: IntelligentInsight, action: 'start' | 'remind' | 'track') => void;
  enabled?: boolean;
  sourceDate?: string | null;
}

export const IntelligentInsightsSection: React.FC<IntelligentInsightsSectionProps> = ({
  category,
  data,
  maxInsights = 3,
  showTitle = true,
  compact = false,
  onInsightPress,
  onActionPress,
  enabled = true,
  sourceDate = null,
}) => {
  const { colors } = useTheme();
  const [insights, setInsights] = useState<IntelligentInsight[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [trendSummary, setTrendSummary] = useState<string>('');
  const [overallScore, setOverallScore] = useState<number>(70);
  const [focus, setFocus] = useState<string>('');
  const [lastGeneratedDate, setLastGeneratedDate] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  const insightService = IntelligentInsightService.getInstance();
  const dbService = IntelligentInsightDBService.getInstance();

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    if (!data) {
      setLoading(false);
      setError(null);
      setInsights([]);
      return;
    }

    const analysisDate = sourceDate || getTodayISODate();

    if (lastGeneratedDate === analysisDate) {
      setLoading(false);
      return;
    }

    loadIntelligentInsights(analysisDate);
  }, [category, data, enabled, sourceDate, lastGeneratedDate]);

  const loadIntelligentInsights = async (analysisDate?: string) => {
    if (!enabled || !data) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log(`🧠 Loading intelligent insights for ${category}...`);
      
      const response = await insightService.generateIntelligentInsights({
        category,
        data,
      });

      if (!isMountedRef.current) {
        return;
      }

      setInsights(response.insights.slice(0, maxInsights));
      // Filter out the fallback trend summary text and empty/placeholder messages
      const filteredTrendSummary = (
        response.trendSummary === 'Analisi trend non disponibile' || 
        response.trendSummary === 'Nessun trend disponibile' ||
        !response.trendSummary || 
        response.trendSummary.trim() === ''
      ) ? '' : response.trendSummary;
      setTrendSummary(filteredTrendSummary);
      setOverallScore(response.overallScore || 70);
      setFocus(response.focus || 'Miglioramento generale');
      setLastGeneratedDate(analysisDate || getTodayISODate());

      // Note: Database saving is now handled in the service layer
      // to avoid duplicate saves and improve performance

    } catch (err) {
      console.error(`❌ Error loading intelligent insights for ${category}:`, err);
      setError('Impossibile caricare gli insight intelligenti');
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  const handleActionPress = async (insight: IntelligentInsight, action: 'start' | 'remind' | 'track') => {
    try {
      switch (action) {
        case 'start':
          Alert.alert(
            'Inizia Routine',
            `Vuoi iniziare la routine: "${insight.title}"?`,
            [
              { text: 'Annulla', style: 'cancel' },
              { 
                text: 'Inizia', 
                onPress: () => {
                  onActionPress?.(insight, action);
                  Alert.alert('Routine Avviata', 'La routine è stata aggiunta alle tue attività di oggi!');
                }
              }
            ]
          );
          break;
        case 'remind':
          Alert.alert(
            'Imposta Promemoria',
            `Vuoi impostare un promemoria per: "${insight.title}"?`,
            [
              { text: 'Annulla', style: 'cancel' },
              { 
                text: 'Imposta', 
                onPress: () => {
                  onActionPress?.(insight, action);
                  Alert.alert('Promemoria Impostato', 'Ti ricorderemo di questa attività!');
                }
              }
            ]
          );
          break;
        case 'track':
          Alert.alert(
            'Traccia Progresso',
            `Vuoi iniziare a tracciare i progressi per: "${insight.title}"?`,
            [
              { text: 'Annulla', style: 'cancel' },
              { 
                text: 'Traccia', 
                onPress: () => {
                  onActionPress?.(insight, action);
                  Alert.alert('Tracking Avviato', 'Inizieremo a tracciare i tuoi progressi!');
                }
              }
            ]
          );
          break;
      }
    } catch (error) {
      console.error('Error handling action press:', error);
      Alert.alert('Errore', 'Si è verificato un errore. Riprova più tardi.');
    }
  };

  const getCategoryInfo = () => {
    switch (category) {
      case 'emotion':
        return {
          title: 'Cosa fare oggi',
          subtitle: 'Suggerimenti personalizzati per il tuo benessere emotivo',
          icon: 'brain',
          colors: ['#8b5cf6', '#a855f7'],
          bgColors: ['#faf5ff', '#f3e8ff'],
        };
      case 'skin':
        return {
          title: 'Cosa fare oggi',
          subtitle: 'Suggerimenti personalizzati per la tua pelle',
          icon: 'face-woman-shimmer',
          colors: ['#22d3ee', '#6366f1'],
          bgColors: ['#f0fdfa', '#e0f2fe'],
        };
      case 'food':
        return {
          title: 'Cosa fare oggi',
          subtitle: 'Suggerimenti personalizzati per la tua alimentazione',
          icon: 'food-apple',
          colors: ['#f59e0b', '#ef4444'],
          bgColors: ['#fef3c7', '#fee2e2'],
        };
      default:
        return {
          title: 'Cosa fare oggi',
          subtitle: 'Suggerimenti personalizzati per te',
          icon: 'lightbulb',
          colors: ['#6b7280', '#9ca3af'],
          bgColors: ['#f9fafb', '#f3f4f6'],
        };
    }
  };

  const categoryInfo = getCategoryInfo();
  // ✅ FIX: Capitalizza solo la prima lettera invece di tutto maiuscolo
  const capitalizeFirst = (str: string) => {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  };
  const sectionTitle = capitalizeFirst(categoryInfo.title || '');

  const titleColor = colors.text;
  const subtitleColor = colors.textSecondary;
  const cardBackground = colors.surface;
  const cardBorder = colors.border;
  const accentColor = categoryInfo.colors[0];

  if (loading) {
    return (
      <View style={styles.container}>
        {showTitle && (
          <View style={styles.header}>
            <Text style={[styles.title, { color: titleColor }]}>{sectionTitle}</Text>
            <Text style={[styles.subtitle, { color: subtitleColor }]}>{categoryInfo.subtitle}</Text>
          </View>
        )}
        
        <View style={[styles.loadingCard, { backgroundColor: cardBackground, borderColor: cardBorder }]}>
          <ActivityIndicator size="large" color={accentColor} />
          <Text style={[styles.loadingText, { color: titleColor }]}>
            Generando insight intelligenti...
          </Text>
          <Text style={[styles.loadingSubtext, { color: subtitleColor }]}>
            L'AI sta analizzando i tuoi dati
          </Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        {showTitle && (
          <View style={styles.header}>
            <Text style={[styles.title, { color: titleColor }]}>{sectionTitle}</Text>
            <Text style={[styles.subtitle, { color: subtitleColor }]}>{categoryInfo.subtitle}</Text>
          </View>
        )}
        
        <View style={[styles.errorCard, { backgroundColor: cardBackground, borderColor: cardBorder }]}>
          <MaterialCommunityIcons name="alert-circle" size={32} color="#ef4444" />
          <Text style={[styles.errorTitle, { color: titleColor }]}>Errore</Text>
          <Text style={[styles.errorText, { color: subtitleColor }]}>{error}</Text>
          <TouchableOpacity 
            style={[styles.retryButton, { backgroundColor: accentColor }]}
            onPress={loadIntelligentInsights}
          >
            <Text style={styles.retryButtonText}>Riprova</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (insights.length === 0) {
    return (
      <View style={styles.container}>
        {showTitle && (
          <View style={styles.header}>
            <Text style={[styles.title, { color: titleColor }]}>{sectionTitle}</Text>
            <Text style={[styles.subtitle, { color: subtitleColor }]}>{categoryInfo.subtitle}</Text>
          </View>
        )}
        
        <View style={[styles.emptyCard, { backgroundColor: cardBackground, borderColor: cardBorder }]}>
          <MaterialCommunityIcons name="lightbulb-outline" size={32} color={accentColor} />
          <Text style={[styles.emptyTitle, { color: titleColor }]}>Nessun insight disponibile</Text>
          <Text style={[styles.emptyText, { color: subtitleColor }]}>
            Completa più analisi per ricevere insight personalizzati
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {showTitle && (
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <View style={styles.titleContainer}>
              <Text style={[styles.title, { color: titleColor }]}>{sectionTitle}</Text>
              <Text style={[styles.subtitle, { color: subtitleColor }]}>{categoryInfo.subtitle}</Text>
            </View>
            <TouchableOpacity 
              style={[styles.refreshButton, { backgroundColor: `${accentColor}22` }]}
              onPress={loadIntelligentInsights}
            >
              <MaterialCommunityIcons name="refresh" size={20} color={accentColor} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Trend Summary Card */}
      {trendSummary && (
        <View style={[styles.trendCard, { backgroundColor: categoryInfo.bgColors[1], borderColor: cardBorder }]}>
          <LinearGradient
            colors={categoryInfo.colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.trendGradient}
          >
            <View style={styles.trendContent}>
              <View style={styles.trendHeader}>
                <MaterialCommunityIcons name={categoryInfo.icon as any} size={20} color="#ffffff" />
                <Text style={styles.trendTitle}>Analisi Trend</Text>
              </View>
              <Text style={styles.trendText}>{trendSummary}</Text>
              {focus && (
                <Text style={styles.focusText}>Focus: {focus}</Text>
              )}
            </View>
          </LinearGradient>
        </View>
      )}

      {/* Insights List */}
      <View style={styles.insightsList}>
        {insights.map((insight, index) => (
          <IntelligentInsightCard
            key={insight.id}
            insight={insight}
            compact={compact}
            onPress={onInsightPress}
            onActionPress={handleActionPress}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  header: {
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  trendCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  trendGradient: {
    padding: 16,
  },
  trendContent: {
    gap: 8,
  },
  trendHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trendTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  trendText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 20,
  },
  focusText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    fontStyle: 'italic',
  },
  insightsList: {
    gap: 8,
  },
  loadingCard: {
    marginHorizontal: 16,
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  loadingSubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  errorCard: {
    marginHorizontal: 16,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    gap: 12,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ef4444',
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  emptyCard: {
    marginHorizontal: 16,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default IntelligentInsightsSection;
