import React, { useEffect, useState, memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  ScrollView,
  Modal,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  withTiming,
  useSharedValue,
  FadeInUp,
  FadeOutDown,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { useDailyCopilot } from '../hooks/useDailyCopilot';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../hooks/useTranslation';
import { EmptyStateCard } from './EmptyStateCard';

const { width } = Dimensions.get('window');

interface DailyCopilotProps {
  onRecommendationPress?: (recommendation: any) => void;
  onViewDetails?: () => void;
  onViewHistory?: () => void;
  compact?: boolean;
}

// 🔥 PERF: Memoized component to prevent unnecessary re-renders
export const DailyCopilot: React.FC<DailyCopilotProps> = memo(({
  onRecommendationPress,
  onViewDetails,
  onViewHistory,
  compact = false,
}) => {
  const { copilotData, loading, error, reload } = useDailyCopilot();
  const { colors: themeColors } = useTheme();
  const { t, language } = useTranslation();
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  // 🔥 PERF: Removed debug useEffect that logged on every state change
  // This was causing unnecessary logging and potential performance impact

  // Animation values
  const fadeInValue = useSharedValue(0);

  useEffect(() => {
    if (copilotData) {
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
  const fadeInStyle = useAnimatedStyle(() => ({
    opacity: fadeInValue.value,
    transform: [{ translateY: (1 - fadeInValue.value) * 20 }],
  }));

  if (loading) {
    return (
      <View style={[styles.container, compact && styles.compactContainer]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8b5cf6" />
          <Text style={styles.loadingText}>
            {language === 'it' ? 'Analizzando i tuoi dati...' : 'Analyzing your data...'}
          </Text>
        </View>
      </View>
    );
  }

  if (error) {
    if (compact) {
      return (
        <View style={[styles.compactContainer, styles.compactEmptyState]}>
          <MaterialCommunityIcons name="head-cog" size={28} color="#8b5cf6" />
          <Text style={styles.compactEmptyTitle}>
            {t('emptyStates.copilot.errorTitle') || 'Copilot non disponibile'}
          </Text>
          <Text style={styles.compactEmptySubtitle}>
            {error || t('emptyStates.copilot.subtitle')}
          </Text>
          <TouchableOpacity style={styles.compactRetryButton} onPress={reload}>
            <Text style={styles.compactRetryText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={[styles.container, compact && styles.compactContainer]}>
        <EmptyStateCard
          type="copilot"
          customTitle={t('emptyStates.copilot.errorTitle') || 'Copilot non disponibile'}
          customSubtitle={error || t('emptyStates.copilot.subtitle')}
          customActionText={t('common.retry')}
          onAction={reload}
          showLearnMore={false}
        />
      </View>
    );
  }

  if (!copilotData) {
    if (compact) {
      return (
        <View style={[styles.compactContainer, styles.compactEmptyState]}>
          <MaterialCommunityIcons name="head-cog" size={28} color="#8b5cf6" />
          <Text style={styles.compactEmptyTitle}>{t('home.dailyCopilot.title')}</Text>
          <Text style={styles.compactEmptySubtitle}>
            {t('home.dailyCopilot.insufficientData')}
          </Text>
        </View>
      );
    }

    return (
      <View style={[styles.container, compact && styles.compactContainer]}>
        <EmptyStateCard
          type="copilot"
          customTitle={t('home.dailyCopilot.title')}
          customSubtitle={t('home.dailyCopilot.insufficientData')}
          showLearnMore={false}
        />
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
    focusEn: 'General Wellness',
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
              {language === 'it' ? 'Oggi focus su: ' : 'Today focus on: '}
              <Text style={styles.compactFocusBold}>
                {language === 'it' ? copilotData.summary.focus : (copilotData.summary.focusEn || copilotData.summary.focus)}
              </Text>
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
        {/* Header - Always visible, acts as toggle */}
        <TouchableOpacity
          onPress={() => setIsExpanded(!isExpanded)}
          activeOpacity={0.9}
          style={[styles.header, { marginBottom: isExpanded ? 20 : 0 }]}
        >
          {/* Left Column: Typography & Status */}
          <View style={styles.headerLeft}>
            <Text
              allowFontScaling={false}
              style={[styles.headerTitleMain, { color: themeColors.text }]}
            >
              Il Punteggio
            </Text>
            <Text
              allowFontScaling={false}
              style={[styles.headerSubtitleHighlight, { color: scoreColors[0] }]}
            >
              di Oggi
            </Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
              <Text
                allowFontScaling={false}
                style={{ color: themeColors.textSecondary, fontSize: 14, fontFamily: 'Figtree_500Medium', marginRight: 4 }}
              >
                {isExpanded ? (language === 'it' ? 'Nascondi raccomandazioni' : 'Hide recommendations') : (language === 'it' ? 'Vedi raccomandazioni' : 'See recommendations')}
              </Text>
              <MaterialCommunityIcons
                name={isExpanded ? "chevron-up" : "chevron-down"}
                size={20}
                color={themeColors.textSecondary}
              />
            </View>
          </View>

          {/* Right Column: Enhanced Gauge */}
          <View style={styles.scoreTouchable}>
            <View style={styles.scoreContainer}>
              {/* Svg Circle Layer */}
              <View style={StyleSheet.absoluteFill}>
                <Svg width={80} height={80} viewBox="0 0 80 80">
                  <Defs>
                    <SvgLinearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <Stop offset="0%" stopColor={scoreColors[0]} />
                      <Stop offset="100%" stopColor={scoreColors[1]} />
                    </SvgLinearGradient>
                  </Defs>

                  {/* Background Fill (Light) */}
                  <Circle
                    cx="40"
                    cy="40"
                    r="36"
                    fill={scoreColors[0]}
                    fillOpacity="0.15"
                  />

                  {/* Background Track */}
                  <Circle
                    cx="40"
                    cy="40"
                    r="36"
                    stroke={themeColors.border}
                    strokeWidth="6"
                    fill="none"
                    opacity={0.3}
                  />

                  {/* Progress Arc */}
                  <Circle
                    cx="40"
                    cy="40"
                    r="36"
                    stroke="url(#scoreGradient)"
                    strokeWidth="6"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 36}`}
                    strokeDashoffset={`${2 * Math.PI * 36 * (1 - copilotData.overallScore / 100)}`}
                    strokeLinecap="round"
                    transform="rotate(-90 40 40)"
                  />
                </Svg>
              </View>

              {/* Text Layer */}
              <View style={styles.scoreContentCentered}>
                <Text
                  allowFontScaling={false}
                  style={[styles.scoreValue, { color: themeColors.text }]}
                >
                  {Math.round(copilotData.overallScore)}
                </Text>
                <Text
                  allowFontScaling={false}
                  style={[styles.scoreLabelSmall, { color: themeColors.textSecondary }]}
                >
                  PUNTI
                </Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {/* Recommendations - Collapsible */}
        {isExpanded && (
          <View style={styles.recommendationsContainer}>
            <Text
              allowFontScaling={false}
              style={[styles.recommendationsTitle, { color: themeColors.text }]}
            >
              {language === 'it' ? 'Raccomandazioni per oggi:' : 'Today\'s Recommendations:'}
            </Text>

            <View style={styles.recommendationsList}>
              {recommendations.length === 0 ? (
                <View style={[styles.emptyRecommendations, { backgroundColor: themeColors.surfaceElevated, borderColor: themeColors.border }]}>
                  <MaterialCommunityIcons name="information-outline" size={24} color={themeColors.textSecondary} />
                  <Text style={[styles.emptyRecommendationsText, { color: themeColors.textSecondary }]}>
                    {language === 'it' ? 'Nessuna raccomandazione disponibile al momento' : 'No recommendations available at the moment'}
                  </Text>
                </View>
              ) : (
                recommendations.map((rec, index) => (
                  <View
                    key={rec.id}
                    style={[
                      styles.recommendationCardSimple,
                      {
                        borderLeftColor: getPriorityColor(rec.priority),
                        backgroundColor: themeColors.surfaceElevated,
                        borderColor: themeColors.border,
                      }
                    ]}
                  >
                    <Text
                      style={[styles.recommendationActionSimple, { color: themeColors.text }]}
                    >
                      {rec.action}
                    </Text>

                    <Text
                      style={[styles.recommendationReasonSimple, { color: themeColors.textSecondary }]}
                    >
                      {rec.reason}
                    </Text>

                    <View style={styles.recommendationFooterSimple}>
                      <View style={styles.categoryBadgeSimple}>
                        <MaterialCommunityIcons
                          name={getCategoryIcon(rec.category) as any}
                          size={14}
                          color={getCategoryColor(rec.category)}
                        />
                        <Text
                          style={[
                            styles.categoryTextSimple,
                            { color: getCategoryColor(rec.category) }
                          ]}
                        >
                          {t(`popups.recommendation.categories.${rec.category}`)}
                        </Text>
                      </View>
                      {rec.estimatedTime && (
                        <Text
                          style={[styles.timeTextSimple, { color: themeColors.textTertiary }]}
                        >
                          {rec.estimatedTime}
                        </Text>
                      )}
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>
        )}
      </LinearGradient>

      {/* Score Explanation Modal */}
      <Modal
        visible={showScoreModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowScoreModal(false)}
        statusBarTranslucent
      >
        <View style={styles.modalOverlay} pointerEvents="box-none">
          <TouchableWithoutFeedback onPress={() => setShowScoreModal(false)}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
          <Animated.View
            entering={FadeInUp.duration(250)}
            exiting={FadeOutDown.duration(200)}
            style={[styles.modalContent, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
          >
            <LinearGradient
              colors={[themeColors.surface, themeColors.surfaceElevated]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.modalGradient}
            >
              <View style={[styles.modalHeader, { borderBottomColor: themeColors.border }]}>
                <View style={styles.modalTitleContainer}>
                  <Text style={[styles.modalTitle, { color: themeColors.text }]}>
                    {t('home.dailyCopilot.scoreModal.title')}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowScoreModal(false)}
                  style={[styles.modalCloseButton, { backgroundColor: themeColors.surfaceElevated }]}
                >
                  <MaterialCommunityIcons name="close" size={20} color={themeColors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.modalScroll}
                contentContainerStyle={styles.modalScrollContent}
                showsVerticalScrollIndicator={true}
                nestedScrollEnabled={true}
              >
                <Text style={[styles.modalDescription, { color: themeColors.textSecondary }]}>
                  {t('home.dailyCopilot.scoreModal.description')}
                </Text>

                <View style={styles.scoreBreakdown}>
                  <View style={styles.scoreBreakdownRow}>
                    <View style={styles.scoreBreakdownHeader}>
                      <View style={[styles.scoreBreakdownIconContainer, { backgroundColor: '#8b5cf6' + '20' }]}>
                        <MaterialCommunityIcons name="emoticon-happy" size={22} color="#8b5cf6" />
                      </View>
                      <Text style={[styles.scoreBreakdownLabel, { color: themeColors.text }]}>
                        {t('home.dailyCopilot.scoreModal.mood')}
                      </Text>
                    </View>
                    <Text style={[styles.scoreBreakdownDescription, { color: themeColors.textSecondary }]}>
                      {t('home.dailyCopilot.scoreModal.moodDesc')}
                    </Text>
                  </View>

                  <View style={styles.scoreBreakdownRow}>
                    <View style={styles.scoreBreakdownHeader}>
                      <View style={[styles.scoreBreakdownIconContainer, { backgroundColor: '#3b82f6' + '20' }]}>
                        <MaterialCommunityIcons name="bed" size={22} color="#3b82f6" />
                      </View>
                      <Text style={[styles.scoreBreakdownLabel, { color: themeColors.text }]}>
                        {t('home.dailyCopilot.scoreModal.sleep')}
                      </Text>
                    </View>
                    <Text style={[styles.scoreBreakdownDescription, { color: themeColors.textSecondary }]}>
                      {t('home.dailyCopilot.scoreModal.sleepDesc')}
                    </Text>
                  </View>

                  <View style={styles.scoreBreakdownRow}>
                    <View style={styles.scoreBreakdownHeader}>
                      <View style={[styles.scoreBreakdownIconContainer, { backgroundColor: '#10b981' + '20' }]}>
                        <MaterialCommunityIcons name="walk" size={22} color="#10b981" />
                      </View>
                      <Text style={[styles.scoreBreakdownLabel, { color: themeColors.text }]}>
                        {t('home.dailyCopilot.scoreModal.steps')}
                      </Text>
                    </View>
                    <Text style={[styles.scoreBreakdownDescription, { color: themeColors.textSecondary }]}>
                      {t('home.dailyCopilot.scoreModal.stepsDesc')}
                    </Text>
                  </View>

                  <View style={styles.scoreBreakdownRow}>
                    <View style={styles.scoreBreakdownHeader}>
                      <View style={[styles.scoreBreakdownIconContainer, { backgroundColor: '#ef4444' + '20' }]}>
                        <MaterialCommunityIcons name="heart-pulse" size={22} color="#ef4444" />
                      </View>
                      <Text style={[styles.scoreBreakdownLabel, { color: themeColors.text }]}>
                        {t('home.dailyCopilot.scoreModal.hrv')}
                      </Text>
                    </View>
                    <Text style={[styles.scoreBreakdownDescription, { color: themeColors.textSecondary }]}>
                      {t('home.dailyCopilot.scoreModal.hrvDesc')}
                    </Text>
                  </View>

                  <View style={[styles.scoreBreakdownRow, styles.scoreBreakdownRowLast]}>
                    <View style={styles.scoreBreakdownHeader}>
                      <View style={[styles.scoreBreakdownIconContainer, { backgroundColor: '#06b6d4' + '20' }]}>
                        <MaterialCommunityIcons name="water" size={22} color="#06b6d4" />
                      </View>
                      <Text style={[styles.scoreBreakdownLabel, { color: themeColors.text }]}>
                        {t('home.dailyCopilot.scoreModal.hydration')}
                      </Text>
                    </View>
                    <Text style={[styles.scoreBreakdownDescription, { color: themeColors.textSecondary }]}>
                      {t('home.dailyCopilot.scoreModal.hydrationDesc')}
                    </Text>
                  </View>
                </View>
              </ScrollView>
            </LinearGradient>
          </Animated.View>
        </View>
      </Modal>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  compactContainer: {
    marginHorizontal: 20,
    marginBottom: 16,
  },
  compactEmptyState: {
    borderRadius: 16,
    padding: 20,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  compactEmptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
  },
  compactEmptySubtitle: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
  },
  compactRetryButton: {
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: '#ede9fe',
  },
  compactRetryText: {
    color: '#7c3aed',
    fontWeight: '600',
    fontSize: 13,
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
    fontFamily: 'Figtree_700Bold',
    color: '#0f172a',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    fontFamily: 'Figtree_500Medium',
  },
  scoreTouchable: {
    flexShrink: 0,
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreContainer: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreContentCentered: {
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  scoreValue: {
    fontSize: 24,
    fontFamily: 'Figtree_700Bold',
    includeFontPadding: false,
    textAlign: 'center',
    lineHeight: 28,
  },
  scoreLabelSmall: {
    fontSize: 9,
    fontFamily: 'Figtree_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerLeft: {
    flex: 1,
    justifyContent: 'center',
    paddingRight: 16,
  },
  headerTitleMain: {
    fontSize: 26,
    fontFamily: 'Figtree_700Bold',
    lineHeight: 30,
  },
  headerSubtitleHighlight: {
    fontSize: 26,
    fontFamily: 'Figtree_700Bold',
    lineHeight: 30,
    marginBottom: 8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '92%',
    maxWidth: 420,
    maxHeight: '80%',
    borderRadius: 28,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 20,
  },
  modalGradient: {
    paddingHorizontal: 24,
    paddingBottom: 28,
    paddingTop: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
  },
  modalTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  modalTitleIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 22,
    fontFamily: 'Figtree_700Bold',
    flex: 1,
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScroll: {
    maxHeight: 380,
  },
  modalScrollContent: {
    paddingBottom: 24,
  },
  modalDescription: {
    fontSize: 14,
    lineHeight: 22,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 20,
    color: '#6b7280',
    fontFamily: 'Figtree_500Medium',
  },
  scoreBreakdown: {
    paddingHorizontal: 8,
    marginTop: 12,
  },
  scoreBreakdownRow: {
    flexDirection: 'column',
    gap: 6,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
  },
  scoreBreakdownRowLast: {
    borderBottomWidth: 0,
  },
  scoreBreakdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  scoreBreakdownIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  scoreBreakdownTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  scoreBreakdownLabel: {
    fontSize: 17,
    fontFamily: 'Figtree_700Bold',
    marginBottom: 0,
    color: '#0f172a',
    flex: 1,
  },
  scoreBreakdownDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: '#64748b',
    fontFamily: 'Figtree_500Medium',
  },
  scoreBreakdownBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    flexShrink: 0,
  },
  scoreBreakdownPercentage: {
    fontSize: 15,
    fontWeight: '800',
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
    fontSize: 15,
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
    fontSize: 14,
    fontFamily: 'Figtree_700Bold',
    color: '#0f172a',
    marginBottom: 6,
  },
  recommendationReasonSimple: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 10,
    fontFamily: 'Figtree_500Medium',
    lineHeight: 18,
  },
  recommendationFooterSimple: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  categoryBadgeSimple: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  categoryTextSimple: {
    fontSize: 13,
    fontFamily: 'Figtree_600SemiBold',
    textTransform: 'capitalize',
  },
  timeTextSimple: {
    fontSize: 13,
    color: '#9ca3af',
    fontFamily: 'Figtree_500Medium',
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
    fontFamily: 'Figtree_700Bold',
    color: '#0f172a',
  },
  compactSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    fontFamily: 'Figtree_500Medium',
  },
  compactScoreBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  compactScoreText: {
    fontSize: 12,
    fontFamily: 'Figtree_700Bold',
  },
  compactContent: {
    marginBottom: 12,
  },
  compactFocus: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 12,
    fontFamily: 'Figtree_500Medium',
  },
  compactFocusBold: {
    fontFamily: 'Figtree_700Bold',
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
    fontFamily: 'Figtree_700Bold',
    color: '#0f172a',
    marginBottom: 6,
    lineHeight: 18,
  },
  compactRecReason: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 8,
    lineHeight: 16,
    fontFamily: 'Figtree_500Medium',
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
    fontFamily: 'Figtree_600SemiBold',
    textTransform: 'capitalize',
  },
  compactTimeText: {
    fontSize: 11,
    color: '#9ca3af',
    fontFamily: 'Figtree_500Medium',
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
    fontFamily: 'Figtree_700Bold',
  },
  headerScoreLabel: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
});

export default DailyCopilot;
