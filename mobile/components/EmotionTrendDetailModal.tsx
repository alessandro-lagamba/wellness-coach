import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../hooks/useTranslation';
import { ChartDataService } from '../services/chart-data.service';
import { EmotionTrendChart } from './charts/EmotionTrendChart';

const { width } = Dimensions.get('window');

interface EmotionTrendDetailModalProps {
  visible: boolean;
  onClose: () => void;
}

export const EmotionTrendDetailModal: React.FC<EmotionTrendDetailModalProps> = ({
  visible,
  onClose,
}) => {
  const { t } = useTranslation();
  const { colors: themeColors } = useTheme();
  const [data, setData] = useState<Array<{
    date: string;
    valence: number;
    arousal: number;
    emotion: string;
  }>>([]);
  const [loading, setLoading] = useState(false);
  const [days, setDays] = useState<7 | 30 | 90>(7);
  const [selectedMetrics, setSelectedMetrics] = useState<Array<'valence' | 'arousal'>>(['valence', 'arousal']);

  useEffect(() => {
    if (visible) {
      loadEmotionData();
    }
  }, [visible, days]);

  const loadEmotionData = async () => {
    try {
      setLoading(true);
      const sessions = await ChartDataService.loadEmotionDataForPeriod(days);

      if (sessions.length === 0) {
        setData([]);
        return;
      }

      // Formatta i dati per il grafico
      const formattedData = sessions.map((session) => {
        const date = new Date(session.timestamp);
        const day = date.getDate();
        const month = date.getMonth() + 1;
        return {
          date: `${day}/${month}`,
          valence: session.avg_valence,
          arousal: session.avg_arousal,
          emotion: session.dominant,
        };
      });

      setData(formattedData);
    } catch (error) {
      console.error('Error loading emotion data:', error);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const metricFilters = useMemo(() => ([
    { key: 'valence' as const, color: '#10b981', label: t('analysis.emotion.metrics.valence') },
    { key: 'arousal' as const, color: '#ef4444', label: t('analysis.emotion.metrics.arousal') },
  ]), [t]);

  const toggleMetric = (metric: 'valence' | 'arousal') => {
    setSelectedMetrics((prev) => {
      if (prev.includes(metric)) {
        if (prev.length === 1) {
          return prev;
        }
        return prev.filter((m) => m !== metric);
      }
      return [...prev, metric];
    });
  };

  // Calcola statistiche
  const calculateStats = () => {
    if (data.length === 0) return null;

    const valenceValues = data.map(d => d.valence);
    const arousalValues = data.map(d => d.arousal);

    const avgValence = valenceValues.reduce((a, b) => a + b, 0) / valenceValues.length;
    const avgArousal = arousalValues.reduce((a, b) => a + b, 0) / arousalValues.length;
    const maxValence = Math.max(...valenceValues);
    const minValence = Math.min(...valenceValues);
    const maxArousal = Math.max(...arousalValues);
    const minArousal = Math.min(...arousalValues);

    // Calcola il trend (confronta la prima metà con la seconda metà)
    const midPoint = Math.floor(data.length / 2);
    const firstHalfValence = valenceValues.slice(0, midPoint).reduce((a, b) => a + b, 0) / midPoint;
    const secondHalfValence = valenceValues.slice(midPoint).reduce((a, b) => a + b, 0) / (valenceValues.length - midPoint);
    const valenceTrend = secondHalfValence > firstHalfValence ? 'up' : secondHalfValence < firstHalfValence ? 'down' : 'stable';

    const firstHalfArousal = arousalValues.slice(0, midPoint).reduce((a, b) => a + b, 0) / midPoint;
    const secondHalfArousal = arousalValues.slice(midPoint).reduce((a, b) => a + b, 0) / (arousalValues.length - midPoint);
    const arousalTrend = secondHalfArousal > firstHalfArousal ? 'up' : secondHalfArousal < firstHalfArousal ? 'down' : 'stable';

    // Emozione dominante
    const emotionCounts: Record<string, number> = {};
    data.forEach(d => {
      emotionCounts[d.emotion] = (emotionCounts[d.emotion] || 0) + 1;
    });
    const dominantEmotion = Object.entries(emotionCounts).reduce((a, b) => 
      emotionCounts[a[0]] > emotionCounts[b[0]] ? a : b
    )[0];

    return {
      avgValence,
      avgArousal,
      maxValence,
      minValence,
      maxArousal,
      minArousal,
      valenceTrend,
      arousalTrend,
      dominantEmotion,
      totalSessions: data.length,
    };
  };

  const stats = calculateStats();
  const color = '#6366f1'; // Colore principale per i trend emotivi

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={[styles.modalContent, { backgroundColor: themeColors.surface }]}>
          <LinearGradient
            colors={[color + '20', color + '10']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            <View style={styles.headerContent}>
              <View style={styles.headerLeft}>
                <MaterialCommunityIcons name="chart-line-variant" size={28} color={color} />
                <View style={styles.headerText}>
                  <Text style={[styles.title, { color: themeColors.text }]} numberOfLines={2} ellipsizeMode="tail">
                    {t('analysis.emotion.trends.title')}
                  </Text>
                  <Text style={[styles.subtitle, { color: themeColors.textSecondary }]} numberOfLines={1} ellipsizeMode="tail">
                    {t('analysis.emotion.trends.detailedView') || 'Visualizzazione dettagliata'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <MaterialCommunityIcons name="close" size={24} color={themeColors.text} />
              </TouchableOpacity>
            </View>
          </LinearGradient>

          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
          >
            {/* Period selector */}
            <View style={styles.periodSelector}>
              <TouchableOpacity
                style={[
                  styles.periodButton,
                  days === 7 && styles.periodButtonActive,
                  { backgroundColor: days === 7 ? color + '20' : themeColors.surfaceMuted }
                ]}
                onPress={() => setDays(7)}
              >
                <Text style={[
                  styles.periodButtonText,
                  { color: days === 7 ? color : themeColors.textSecondary }
                ]}>
                  {t('home.weeklyProgress.week', { count: 1 }) || '7 giorni'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.periodButton,
                  days === 30 && styles.periodButtonActive,
                  { backgroundColor: days === 30 ? color + '20' : themeColors.surfaceMuted }
                ]}
                onPress={() => setDays(30)}
              >
                <Text style={[
                  styles.periodButtonText,
                  { color: days === 30 ? color : themeColors.textSecondary }
                ]}>
                  {t('home.weeklyProgress.month', { count: 1 }) || '30 giorni'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.periodButton,
                  days === 90 && styles.periodButtonActive,
                  { backgroundColor: days === 90 ? color + '20' : themeColors.surfaceMuted }
                ]}
                onPress={() => setDays(90)}
              >
                <Text style={[
                  styles.periodButtonText,
                  { color: days === 90 ? color : themeColors.textSecondary }
                ]}>
                  {t('analysis.emotion.trends.threeMonths') || '90 giorni'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Metric filters */}
            <View style={styles.metricFilterRow}>
              {metricFilters.map((metric) => {
                const isActive = selectedMetrics.includes(metric.key);
                return (
                  <TouchableOpacity
                    key={metric.key}
                    style={[
                      styles.metricFilterChip,
                      {
                        borderColor: isActive ? metric.color : themeColors.border,
                        backgroundColor: isActive ? `${metric.color}20` : themeColors.surfaceMuted,
                      },
                    ]}
                    onPress={() => toggleMetric(metric.key)}
                  >
                    <View style={[styles.metricFilterDot, { backgroundColor: metric.color }]} />
                    <Text style={[styles.metricFilterText, { color: isActive ? metric.color : themeColors.textSecondary }]}>
                      {metric.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Chart */}
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={color} />
                <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>
                  {t('common.loading')}
                </Text>
              </View>
            ) : data.length === 0 ? (
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons name="chart-line" size={48} color={themeColors.textTertiary} />
                <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
                  {t('analysis.emotion.trends.noData') || 'Nessun dato disponibile per questo periodo'}
                </Text>
              </View>
            ) : (
              <View style={styles.chartContainer}>
                <EmotionTrendChart
                  data={data}
                  title={t('analysis.emotion.trends.title')}
                  subtitle={t('analysis.emotion.trends.subtitle')}
                  visibleMetrics={selectedMetrics}
                  metricLabels={{
                    valence: t('analysis.emotion.metrics.valence'),
                    arousal: t('analysis.emotion.metrics.arousal'),
                  }}
                />
              </View>
            )}

            {/* Stats */}
            {stats && (
              <View style={styles.statsSection}>
                <Text style={[styles.sectionTitle, { color: themeColors.text }]} numberOfLines={1} ellipsizeMode="tail">
                  {t('analysis.emotion.trends.statistics') || 'Statistiche'}
                </Text>

                {/* Valence Stats */}
                {selectedMetrics.includes('valence') && (
                <View style={styles.metricSection}>
                  <View style={styles.metricHeader}>
                    <View style={[styles.metricDot, { backgroundColor: '#10b981' }]} />
                    <Text style={[styles.metricTitle, { color: themeColors.text }]} numberOfLines={1} ellipsizeMode="tail">
                      {t('analysis.emotion.metrics.valence') || 'Valence'}
                    </Text>
                  </View>
                  <View style={styles.statsRow}>
                    <View style={[styles.statCard, { backgroundColor: themeColors.surfaceElevated, borderColor: themeColors.border }]}>
                      <Text style={[styles.statLabel, { color: themeColors.textSecondary }]}>
                        {t('home.weeklyProgress.average') || 'Media'}
                      </Text>
                      <Text style={[styles.statValue, { color: themeColors.text }]}>
                        {stats.avgValence.toFixed(2)}
                      </Text>
                    </View>
                    <View style={[styles.statCard, { backgroundColor: themeColors.surfaceElevated, borderColor: themeColors.border }]}>
                      <Text style={[styles.statLabel, { color: themeColors.textSecondary }]}>
                        {t('home.weeklyProgress.max') || 'Massimo'}
                      </Text>
                      <Text style={[styles.statValue, { color: themeColors.text }]}>
                        {stats.maxValence.toFixed(2)}
                      </Text>
                    </View>
                    <View style={[styles.statCard, { backgroundColor: themeColors.surfaceElevated, borderColor: themeColors.border }]}>
                      <Text style={[styles.statLabel, { color: themeColors.textSecondary }]}>
                        {t('home.weeklyProgress.min') || 'Minimo'}
                      </Text>
                      <Text style={[styles.statValue, { color: themeColors.text }]}>
                        {stats.minValence.toFixed(2)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.trendIndicator}>
                    <MaterialCommunityIcons
                      name={stats.valenceTrend === 'up' ? 'trending-up' : stats.valenceTrend === 'down' ? 'trending-down' : 'trending-neutral'}
                      size={16}
                      color={stats.valenceTrend === 'up' ? '#10b981' : stats.valenceTrend === 'down' ? '#ef4444' : themeColors.textSecondary}
                    />
                    <Text style={[styles.trendText, { color: themeColors.textSecondary }]}>
                      {stats.valenceTrend === 'up' ? t('analysis.emotion.trends.improving') || 'In miglioramento' :
                       stats.valenceTrend === 'down' ? t('analysis.emotion.trends.declining') || 'In calo' :
                       t('analysis.emotion.trends.stable') || 'Stabile'}
                    </Text>
                  </View>
                </View>
                )}

                {/* Arousal Stats */}
                {selectedMetrics.includes('arousal') && (
                <View style={styles.metricSection}>
                  <View style={styles.metricHeader}>
                    <View style={[styles.metricDot, { backgroundColor: '#ef4444' }]} />
                    <Text style={[styles.metricTitle, { color: themeColors.text }]}>
                      {t('analysis.emotion.metrics.arousal') || 'Arousal'}
                    </Text>
                  </View>
                  <View style={styles.statsRow}>
                    <View style={[styles.statCard, { backgroundColor: themeColors.surfaceElevated, borderColor: themeColors.border }]}>
                      <Text style={[styles.statLabel, { color: themeColors.textSecondary }]}>
                        {t('home.weeklyProgress.average') || 'Media'}
                      </Text>
                      <Text style={[styles.statValue, { color: themeColors.text }]}>
                        {stats.avgArousal.toFixed(2)}
                      </Text>
                    </View>
                    <View style={[styles.statCard, { backgroundColor: themeColors.surfaceElevated, borderColor: themeColors.border }]}>
                      <Text style={[styles.statLabel, { color: themeColors.textSecondary }]}>
                        {t('home.weeklyProgress.max') || 'Massimo'}
                      </Text>
                      <Text style={[styles.statValue, { color: themeColors.text }]}>
                        {stats.maxArousal.toFixed(2)}
                      </Text>
                    </View>
                    <View style={[styles.statCard, { backgroundColor: themeColors.surfaceElevated, borderColor: themeColors.border }]}>
                      <Text style={[styles.statLabel, { color: themeColors.textSecondary }]}>
                        {t('home.weeklyProgress.min') || 'Minimo'}
                      </Text>
                      <Text style={[styles.statValue, { color: themeColors.text }]}>
                        {stats.minArousal.toFixed(2)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.trendIndicator}>
                    <MaterialCommunityIcons
                      name={stats.arousalTrend === 'up' ? 'trending-up' : stats.arousalTrend === 'down' ? 'trending-down' : 'trending-neutral'}
                      size={16}
                      color={stats.arousalTrend === 'up' ? '#10b981' : stats.arousalTrend === 'down' ? '#ef4444' : themeColors.textSecondary}
                    />
                    <Text style={[styles.trendText, { color: themeColors.textSecondary }]}>
                      {stats.arousalTrend === 'up' ? t('analysis.emotion.trends.increasing') || 'In aumento' :
                       stats.arousalTrend === 'down' ? t('analysis.emotion.trends.decreasing') || 'In diminuzione' :
                       t('analysis.emotion.trends.stable') || 'Stabile'}
                    </Text>
                  </View>
                </View>
                )}

                {/* Summary */}
                <View style={[styles.summaryCard, { backgroundColor: themeColors.surfaceElevated, borderColor: themeColors.border }]}>
                  <Text style={[styles.summaryTitle, { color: themeColors.text }]} numberOfLines={1} ellipsizeMode="tail">
                    {t('analysis.emotion.trends.summary') || 'Riepilogo'}
                  </Text>
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { color: themeColors.textSecondary }]} numberOfLines={1} ellipsizeMode="tail">
                      {t('analysis.emotion.trends.totalSessions') || 'Sessioni totali'}:
                    </Text>
                    <Text style={[styles.summaryValue, { color: themeColors.text }]} numberOfLines={1} ellipsizeMode="tail">
                      {stats.totalSessions}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { color: themeColors.textSecondary }]} numberOfLines={1} ellipsizeMode="tail">
                      {t('analysis.emotion.trends.dominantEmotion') || 'Emozione dominante'}:
                    </Text>
                    <Text style={[styles.summaryValue, { color: themeColors.text }]} numberOfLines={1} ellipsizeMode="tail">
                      {stats.dominantEmotion}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 16,
  },
  header: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerText: {
    marginLeft: 12,
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  content: {
    padding: 20,
  },
  contentContainer: {
    paddingBottom: 50,
  },
  periodSelector: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  periodButtonActive: {
    borderWidth: 2,
  },
  periodButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  chartContainer: {
    marginBottom: 24,
  },
  metricFilterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  metricFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    gap: 6,
  },
  metricFilterDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  metricFilterText: {
    fontSize: 13,
    fontWeight: '600',
  },
  statsSection: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  metricSection: {
    marginBottom: 24,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  metricDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  metricTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  trendIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  trendText: {
    fontSize: 13,
    fontWeight: '500',
  },
  summaryCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default EmotionTrendDetailModal;

