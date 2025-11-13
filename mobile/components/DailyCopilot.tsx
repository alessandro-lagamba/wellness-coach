import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  withTiming,
  withSpring,
  useSharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { useDailyCopilot } from '../hooks/useDailyCopilot';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../hooks/useTranslation';

const { width } = Dimensions.get('window');

interface DailyCopilotProps {
  onRecommendationPress?: (recommendation: any) => void;
  onViewDetails?: () => void;
  onViewHistory?: () => void;
  compact?: boolean;
}

export const DailyCopilot: React.FC<DailyCopilotProps> = ({
  onRecommendationPress,
  onViewDetails,
  onViewHistory,
  compact = false,
}) => {
  const { copilotData, loading, error } = useDailyCopilot();
  const { colors: themeColors } = useTheme();
  const { t } = useTranslation();

  // 🔥 DEBUG: Log per capire perché non mostra i dati
  useEffect(() => {
    if (loading) {
      console.log('🔄 DailyCopilot: Loading...');
    } else if (error) {
      console.log('❌ DailyCopilot: Error:', error);
    } else if (copilotData) {
      console.log('✅ DailyCopilot: Data loaded:', {
        overallScore: copilotData.overallScore,
        recommendationsCount: copilotData.recommendations?.length || 0,
        summary: copilotData.summary
      });
    } else {
      console.log('⚠️ DailyCopilot: No data, no error, not loading');
    }
  }, [copilotData, loading, error]);

  // Animation values
  const progressValue = useSharedValue(0);
  const fadeInValue = useSharedValue(0);

  useEffect(() => {
    if (copilotData) {
      // Anima il progresso
      progressValue.value = withSpring(copilotData.overallScore / 100, {
        damping: 15,
        stiffness: 150,
      });
      
      // Anima il fade in
      fadeInValue.value = withTiming(1, { duration: 600 });
    }
  }, [copilotData]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return ['#10b981', '#34d399'];
    if (score >= 60) return ['#f59e0b', '#fbbf24'];
    return ['#ef4444', '#f87171'];
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Eccellente';
    if (score >= 60) return 'Buono';
    if (score >= 40) return 'Discreto';
    return 'Da migliorare';
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#10b981';
      default: return '#6b7280';
    }
  };

  const getPriorityEmoji = (priority: string) => {
    switch (priority) {
      case 'high': return '🚨'; // Urgente/Importante
      case 'medium': return '⚠️'; // Attenzione
      case 'low': return '✅'; // Tutto ok/Opzionale
      default: return '💡';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'nutrition': return 'food-apple';
      case 'movement': return 'run';
      case 'recovery': return 'bed';
      case 'mindfulness': return 'meditation';
      case 'energy': return 'lightning-bolt';
      default: return 'heart';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'nutrition': return '#f59e0b';
      case 'movement': return '#10b981';
      case 'recovery': return '#3b82f6';
      case 'mindfulness': return '#8b5cf6';
      case 'energy': return '#f97316';
      default: return '#6b7280';
    }
  };

  // Animation styles
  const progressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: progressValue.value }],
  }));

  const fadeInStyle = useAnimatedStyle(() => ({
    opacity: fadeInValue.value,
    transform: [{ translateY: (1 - fadeInValue.value) * 20 }],
  }));

  if (loading) {
    return (
      <View style={[styles.container, compact && styles.compactContainer]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8b5cf6" />
          <Text style={styles.loadingText}>Analizzando i tuoi dati...</Text>
        </View>
      </View>
    );
  }

  if (error || !copilotData) {
    return (
      <View style={[styles.container, compact && styles.compactContainer]}>
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons name="alert-circle" size={48} color="#ef4444" />
          <Text style={styles.errorText}>{error || 'Errore nel caricamento'}</Text>
          <Text style={styles.errorSubtext}>L'analisi verrà generata automaticamente al prossimo avvio</Text>
        </View>
      </View>
    );
  }

  // 🔥 FIX: Assicurati che recommendations sia sempre un array
  const recommendations = Array.isArray(copilotData.recommendations) 
    ? copilotData.recommendations 
    : [];

  // 🔥 FIX: Assicurati che summary abbia tutti i campi necessari
  const summary = copilotData.summary || {
    focus: 'Benessere generale',
    energy: 'medium' as const,
    recovery: 'good' as const,
    mood: 'neutral' as const,
  };

  const scoreColors = getScoreColor(copilotData.overallScore);
  const scoreLabel = getScoreLabel(copilotData.overallScore);

  if (compact) {
    return (
      <Animated.View style={[styles.compactContainer, fadeInStyle]}>
        <LinearGradient
          colors={['#f8fafc', '#e2e8f0']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.compactCard}
        >
          <View style={styles.compactHeader}>
            <View style={styles.compactTitleRow}>
              <Text style={styles.compactEmoji}>🧠</Text>
              <View style={styles.compactTitleContainer}>
                <Text style={styles.compactTitle}>AI Daily Copilot</Text>
                <Text style={styles.compactSubtitle}>Score: {copilotData.overallScore}/100</Text>
              </View>
            </View>
            <View style={[styles.compactScoreBadge, { backgroundColor: scoreColors[0] + '20' }]}>
              <Text style={[styles.compactScoreText, { color: scoreColors[0] }]}>
                {scoreLabel}
              </Text>
            </View>
          </View>
          
          <View style={styles.compactContent}>
            <Text style={styles.compactFocus}>
              Oggi focus su: <Text style={styles.compactFocusBold}>{copilotData.summary.focus}</Text>
            </Text>
            
            <View style={styles.compactRecommendations}>
              {copilotData.recommendations.slice(0, 2).map((rec, index) => (
                <View
                  key={rec.id}
                  style={styles.compactRecommendation}
                >
                  <View style={styles.compactRecHeader}>
                    <Text style={styles.compactRecIcon}>{rec.icon}</Text>
                    <View style={[
                      styles.compactPriorityBadge,
                      { backgroundColor: getPriorityColor(rec.priority) + '20' }
                    ]}>
                      <Text style={[
                        styles.compactPriorityText,
                        { color: getPriorityColor(rec.priority) }
                      ]}>
                        {getPriorityEmoji(rec.priority)}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.compactRecAction} numberOfLines={2}>
                    {rec.action}
                  </Text>
                  <Text style={styles.compactRecReason} numberOfLines={2}>
                    {rec.reason}
                  </Text>
                  <View style={styles.compactRecFooter}>
                    <View style={styles.compactCategoryBadge}>
                      <MaterialCommunityIcons 
                        name={getCategoryIcon(rec.category) as any} 
                        size={12} 
                        color={getCategoryColor(rec.category)} 
                      />
                      <Text style={[
                        styles.compactCategoryText,
                        { color: getCategoryColor(rec.category) }
                      ]}>
                        {t(`popups.recommendation.categories.${rec.category}`)}
                      </Text>
                    </View>
                    {rec.estimatedTime && (
                      <Text style={styles.compactTimeText}>{rec.estimatedTime}</Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          </View>
          
          {onViewDetails && (
            <TouchableOpacity style={styles.compactViewDetails} onPress={onViewDetails}>
              <Text style={styles.compactViewDetailsText}>Vedi dettagli</Text>
              <MaterialCommunityIcons name="chevron-right" size={16} color="#8b5cf6" />
            </TouchableOpacity>
          )}
        </LinearGradient>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.container, fadeInStyle]}>
      <LinearGradient
        colors={[themeColors.surface, themeColors.surfaceElevated]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.card, { borderColor: themeColors.border }]}
      >
        {/* Header - Riorganizzato */}
        <View style={styles.header}>
          {/* Left: Focus con emoticon */}
          <View style={styles.focusContainer}>
            <Text style={[styles.focusText, { color: themeColors.text }]}>
              Oggi focus su: <Text style={[styles.focusBold, { color: themeColors.text }]}>{summary.focus}</Text>
            </Text>
            
            <View style={styles.statusRow}>
              <View style={styles.statusItem}>
                <MaterialCommunityIcons 
                  name="lightning-bolt" 
                  size={18} 
                  color={summary.energy === 'high' ? '#10b981' : summary.energy === 'medium' ? '#f59e0b' : '#ef4444'} 
                />
                <Text style={[styles.statusText, { color: themeColors.textSecondary }]}>Energia</Text>
              </View>
              <View style={styles.statusItem}>
                <MaterialCommunityIcons 
                  name="bed" 
                  size={18} 
                  color={summary.recovery === 'excellent' ? '#10b981' : summary.recovery === 'good' ? '#f59e0b' : '#ef4444'} 
                />
                <Text style={[styles.statusText, { color: themeColors.textSecondary }]}>Recupero</Text>
              </View>
              <View style={styles.statusItem}>
                <MaterialCommunityIcons 
                  name="emoticon-happy" 
                  size={18} 
                  color={summary.mood === 'positive' ? '#10b981' : summary.mood === 'neutral' ? '#f59e0b' : '#ef4444'} 
                />
                <Text style={[styles.statusText, { color: themeColors.textSecondary }]}>Umore</Text>
              </View>
            </View>
          </View>
          
          {/* Right: Score Circle - Più visibile */}
          <Animated.View style={[styles.scoreContainer, progressStyle]}>
            <Svg width={80} height={80}>
              <Defs>
                <SvgLinearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor={scoreColors[0]} />
                  <Stop offset="100%" stopColor={scoreColors[1]} />
                </SvgLinearGradient>
              </Defs>
              <Circle
                cx="40"
                cy="40"
                r="35"
                stroke={themeColors.borderLight}
                strokeWidth="6"
                fill="none"
              />
              <Circle
                cx="40"
                cy="40"
                r="35"
                stroke="url(#scoreGradient)"
                strokeWidth="6"
                fill="none"
                strokeDasharray={`${2 * Math.PI * 35}`}
                strokeDashoffset={`${2 * Math.PI * 35 * (1 - copilotData.overallScore / 100)}`}
                strokeLinecap="round"
                transform="rotate(-90 40 40)"
              />
            </Svg>
            <View style={styles.scoreTextContainer}>
              <Text style={[styles.scoreValue, { color: scoreColors[0] }]}>
                {copilotData.overallScore}
              </Text>
              <Text style={[styles.scoreLabel, { color: themeColors.textSecondary }]}>/100</Text>
            </View>
          </Animated.View>
        </View>

        {/* Recommendations - Simplified */}
        <View style={styles.recommendationsContainer}>
          <Text style={[styles.recommendationsTitle, { color: themeColors.text }]}>Raccomandazioni per oggi</Text>
          
          <View style={styles.recommendationsList}>
            {recommendations.length === 0 ? (
              <View style={[styles.emptyRecommendations, { backgroundColor: themeColors.surfaceElevated, borderColor: themeColors.border }]}>
                <MaterialCommunityIcons name="information-outline" size={24} color={themeColors.textSecondary} />
                <Text style={[styles.emptyRecommendationsText, { color: themeColors.textSecondary }]}>
                  Nessuna raccomandazione disponibile al momento
                </Text>
              </View>
            ) : (
              recommendations.map((rec, index) => (
              <TouchableOpacity
                key={rec.id}
                style={[
                  styles.recommendationCardSimple,
                  { 
                    borderLeftColor: getPriorityColor(rec.priority),
                    backgroundColor: themeColors.surfaceElevated,
                    borderColor: themeColors.border,
                  }
                ]}
                onPress={() => onRecommendationPress?.(rec)}
                activeOpacity={0.7}
              >
                <View style={styles.recommendationHeaderSimple}>
                  <Text style={styles.recommendationIconSimple}>{rec.icon}</Text>
                  <View style={[
                    styles.priorityBadgeSimple,
                    { backgroundColor: getPriorityColor(rec.priority) + '20' }
                  ]}>
                    <Text style={[
                      styles.priorityTextSimple,
                      { color: getPriorityColor(rec.priority) }
                    ]}>
                      {getPriorityEmoji(rec.priority)}
                    </Text>
                  </View>
                </View>
                
                <Text style={[styles.recommendationActionSimple, { color: themeColors.text }]}>
                  {rec.action}
                </Text>
                
                <Text style={[styles.recommendationReasonSimple, { color: themeColors.textSecondary }]}>
                  {rec.reason}
                </Text>
                
                <View style={styles.recommendationFooterSimple}>
                  <View style={styles.categoryBadgeSimple}>
                    <MaterialCommunityIcons 
                      name={getCategoryIcon(rec.category) as any} 
                      size={14} 
                      color={getCategoryColor(rec.category)} 
                    />
                    <Text style={[
                      styles.categoryTextSimple,
                      { color: getCategoryColor(rec.category) }
                    ]}>
                      {t(`popups.recommendation.categories.${rec.category}`)}
                    </Text>
                  </View>
                  {rec.estimatedTime && (
                    <Text style={[styles.timeTextSimple, { color: themeColors.textTertiary }]}>{rec.estimatedTime}</Text>
                  )}
                </View>
              </TouchableOpacity>
              ))
            )}
          </View>
        </View>

      </LinearGradient>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  compactContainer: {
    marginHorizontal: 20,
    marginBottom: 16,
  },
  card: {
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  compactCard: {
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '500',
  },
  errorContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    color: '#ef4444',
    textAlign: 'center',
  },
  errorSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    gap: 16,
  },
  focusContainer: {
    flex: 1,
    marginRight: 12,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  scoreContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: 80,
    height: 80,
    flexShrink: 0,
  },
  scoreTextContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  scoreValue: {
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 28,
  },
  scoreLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
  },
  focusText: {
    fontSize: 15,
    color: '#374151',
    marginBottom: 12,
    lineHeight: 20,
  },
  focusBold: {
    fontWeight: '700',
    color: '#0f172a',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 16,
    marginTop: 8,
  },
  statusItem: {
    alignItems: 'center',
    gap: 6, // Aumentato da 4
  },
  statusText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
    marginTop: 2,
  },
  emptyRecommendations: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyRecommendationsText: {
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
  recommendationsContainer: {
    marginBottom: 20,
  },
  recommendationsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 16,
  },
  recommendationsScroll: {
    paddingRight: 20,
  },
  recommendationsList: {
    gap: 12,
  },
  recommendationCard: {
    width: 200,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginRight: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  recommendationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  recommendationIcon: {
    fontSize: 24,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '700',
  },
  recommendationAction: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 8,
    lineHeight: 18,
  },
  recommendationReason: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 12,
    lineHeight: 16,
  },
  recommendationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  timeText: {
    fontSize: 11,
    color: '#9ca3af',
    fontWeight: '500',
  },
  // Simplified recommendation styles
  recommendationCardSimple: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  recommendationHeaderSimple: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  recommendationIconSimple: {
    fontSize: 24,
  },
  priorityBadgeSimple: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  priorityTextSimple: {
    fontSize: 11,
    fontWeight: '700',
  },
  recommendationActionSimple: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 8,
    lineHeight: 22,
  },
  recommendationReasonSimple: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
    lineHeight: 20,
  },
  recommendationFooterSimple: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryBadgeSimple: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryTextSimple: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  timeTextSimple: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
  },
  viewDetailsButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  viewDetailsGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 8,
  },
  viewDetailsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  // Compact styles
  compactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  compactTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  compactEmoji: {
    fontSize: 24,
    marginRight: 8,
  },
  compactTitleContainer: {
    flex: 1,
  },
  compactTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  compactSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  compactScoreBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  compactScoreText: {
    fontSize: 12,
    fontWeight: '700',
  },
  compactContent: {
    marginBottom: 12,
  },
  compactFocus: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 12,
  },
  compactFocusBold: {
    fontWeight: '700',
    color: '#0f172a',
  },
  compactRecommendations: {
    gap: 12,
  },
  compactRecommendation: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  compactRecHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  compactRecIcon: {
    fontSize: 20,
  },
  compactPriorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  compactPriorityText: {
    fontSize: 10,
    fontWeight: '700',
  },
  compactRecAction: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 6,
    lineHeight: 18,
  },
  compactRecReason: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 8,
    lineHeight: 16,
  },
  compactRecFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  compactCategoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  compactCategoryText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  compactTimeText: {
    fontSize: 11,
    color: '#9ca3af',
    fontWeight: '500',
  },
  compactViewDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  compactViewDetailsText: {
    fontSize: 14,
    color: '#8b5cf6',
    fontWeight: '600',
  },
});

export default DailyCopilot;
