import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Dimensions,
} from 'react-native';
import Svg, { Path, Rect, Circle, Text as SvgText } from 'react-native-svg';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from '../hooks/useTranslation';
import { useTheme } from '../contexts/ThemeContext';
import { ChartDataService } from '../services/chart-data.service';

const { width } = Dimensions.get('window');

type SkinMetric = 'overall' | 'texture' | 'redness' | 'hydration' | 'oiliness';

interface SkinTrendDetailModalProps {
  visible: boolean;
  onClose: () => void;
}

interface SkinTrendPoint {
  date: string;
  overall: number;
  texture: number;
  redness: number;
  hydration: number;
  oiliness: number;
}

const metricOrder: SkinMetric[] = ['overall', 'texture', 'redness', 'hydration', 'oiliness'];

export const SkinTrendDetailModal: React.FC<SkinTrendDetailModalProps> = ({ visible, onClose }) => {
  const { t } = useTranslation();
  const { colors: themeColors } = useTheme();
  const [days, setDays] = useState<7 | 30>(7);
  const [selectedMetrics, setSelectedMetrics] = useState<SkinMetric[]>(['overall', 'texture', 'redness', 'hydration', 'oiliness']);
  const [data, setData] = useState<SkinTrendPoint[]>([]);
  const [loading, setLoading] = useState(false);

  const metricConfig = useMemo(() => ({
    overall: { color: '#6366f1', label: t('analysis.skin.metrics.overall') || 'Punteggio' },
    texture: { color: '#8b5cf6', label: t('analysis.skin.metrics.texture') || 'Texture' },
    redness: { color: '#ef4444', label: t('analysis.skin.metrics.redness') || 'Rossore' },
    hydration: { color: '#22d3ee', label: t('analysis.skin.metrics.hydration') || 'Idratazione' },
    oiliness: { color: '#f59e0b', label: t('analysis.skin.metrics.oiliness') || 'Oleosità' },
  }), [t]);

  useEffect(() => {
    if (visible) {
      loadSkinData();
    }
  }, [visible, days]);

  const loadSkinData = async () => {
    try {
      setLoading(true);
      const sessions = await ChartDataService.loadSkinDataForPeriod(days);
      const formatted: SkinTrendPoint[] = [...sessions]
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        .map((session) => {
          const date = new Date(session.timestamp);
          return {
            date: `${date.getDate()}/${date.getMonth() + 1}`,
            overall: session.overall || 0,
            texture: session.texture || 0,
            redness: session.redness || 0,
            hydration: session.hydration || 0,
            oiliness: session.oiliness || 0,
          };
        });
      setData(formatted);
    } catch (error) {
      console.error('Error loading skin trend data:', error);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleMetric = (metric: SkinMetric) => {
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

  const chartWidth = width - 80;
  const chartHeight = 160;
  const padding = 28;

  const mapValueToY = (value: number) =>
    padding + ((100 - value) * (chartHeight - 2 * padding)) / 100;

  const createPath = (values: number[]) => {
    if (values.length === 0) {
      return '';
    }
    if (values.length === 1) {
      const y = mapValueToY(values[0]);
      return `M ${padding} ${y} L ${chartWidth - padding} ${y}`;
    }
    return values
      .map((value, index) => {
        const x = padding + (index * (chartWidth - 2 * padding)) / (values.length - 1);
        const y = mapValueToY(value);
        return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');
  };

  const metricPaths = useMemo(() => {
    const result: Partial<Record<SkinMetric, string>> = {};
    selectedMetrics.forEach((metric) => {
      const values = data.map((point) => point[metric]);
      result[metric] = createPath(values);
    });
    return result;
  }, [data, selectedMetrics]);

  const metricStats = (metric: SkinMetric) => {
    if (data.length === 0) {
      return null;
    }
    const values = data.map((point) => point[metric]);
    const avg = values.reduce((acc, v) => acc + v, 0) / values.length;
    const max = Math.max(...values);
    const min = Math.min(...values);
    const midPoint = Math.floor(values.length / 2) || 1;
    const firstHalfAvg = values.slice(0, midPoint).reduce((acc, v) => acc + v, 0) / midPoint;
    const secondHalfAvg = values.slice(midPoint).reduce((acc, v) => acc + v, 0) / Math.max(values.length - midPoint, 1);
    const trend = secondHalfAvg > firstHalfAvg ? 'up' : secondHalfAvg < firstHalfAvg ? 'down' : 'stable';
    return { avg, max, min, trend };
  };

  const totalSessions = data.length;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={[styles.modalContent, { backgroundColor: themeColors.surface }]}>
          <LinearGradient
            colors={['#22d3ee20', '#6366f110']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            <View style={styles.headerContent}>
              <View style={styles.headerLeft}>
                <MaterialCommunityIcons name="face-woman-shimmer" size={28} color="#22d3ee" />
                <View style={styles.headerText}>
                  <Text style={[styles.title, { color: themeColors.text }]} numberOfLines={2} ellipsizeMode="tail">
                    {t('analysis.skin.trends.title')}
                  </Text>
                  <Text style={[styles.subtitle, { color: themeColors.textSecondary }]} numberOfLines={1} ellipsizeMode="tail">
                    {t('analysis.skin.trends.detailedView') || 'Visualizzazione dettagliata'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <MaterialCommunityIcons name="close" size={24} color={themeColors.text} />
              </TouchableOpacity>
            </View>
          </LinearGradient>

          <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
            {/* Period selector */}
            <View style={styles.periodSelector}>
              {[7, 30].map((period) => (
                <TouchableOpacity
                  key={period}
                  style={[
                    styles.periodButton,
                    {
                      backgroundColor: days === period ? '#22d3ee20' : themeColors.surfaceMuted,
                      borderColor: days === period ? '#22d3ee' : themeColors.border,
                    },
                  ]}
                  onPress={() => setDays(period as 7 | 30)}
                >
                  <Text
                    style={[
                      styles.periodButtonText,
                      { color: days === period ? '#22d3ee' : themeColors.textSecondary },
                    ]}
                  >
                    {period === 7
                      ? t('home.weeklyProgress.week', { count: 1 }) || '7 giorni'
                      : t('home.weeklyProgress.month', { count: 1 }) || '30 giorni'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Metric filters */}
            <View style={styles.metricFilterRow}>
              {metricOrder.map((metric) => {
                const config = metricConfig[metric];
                const isActive = selectedMetrics.includes(metric);
                return (
                  <TouchableOpacity
                    key={metric}
                    style={[
                      styles.metricFilterChip,
                      {
                        borderColor: isActive ? config.color : themeColors.border,
                        backgroundColor: isActive ? `${config.color}20` : themeColors.surfaceMuted,
                      },
                    ]}
                    onPress={() => toggleMetric(metric)}
                  >
                    <View style={[styles.metricFilterDot, { backgroundColor: config.color }]} />
                    <Text style={[styles.metricFilterText, { color: isActive ? config.color : themeColors.textSecondary }]} numberOfLines={1}>
                      {config.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Chart */}
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#22d3ee" />
                <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>{t('common.loading')}</Text>
              </View>
            ) : data.length === 0 ? (
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons name="chart-line" size={48} color={themeColors.textTertiary} />
                <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
                  {t('analysis.skin.trends.noData') || 'Registra un’analisi per vedere il trend della pelle'}
                </Text>
              </View>
            ) : (
              <View style={styles.chartContainer}>
                <Svg width={chartWidth} height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
                  {/* Grid lines */}
                  {[0, 25, 50, 75, 100].map((value, index) => {
                    const y = padding + ((100 - value) * (chartHeight - 2 * padding)) / 100;
                    return (
                      <React.Fragment key={`grid-group-${index}`}>
                        <Rect
                          x={padding}
                          y={y}
                          width={chartWidth - 2 * padding}
                          height={1}
                          fill={themeColors.borderLight}
                          opacity={0.5}
                        />
                        <SvgText
                          x={padding - 8} // Posiziona il testo a sinistra della griglia
                          y={y + 4}
                          textAnchor="end"
                          fontSize="10"
                          fill={themeColors.textSecondary}
                        >
                          {value}
                        </SvgText>
                      </React.Fragment>
                    );
                  })}

                  {selectedMetrics.map((metric) => (
                    metricPaths[metric] ? (
                      <Path
                        key={`path-${metric}`}
                        d={metricPaths[metric] || ''}
                        stroke={metricConfig[metric].color}
                        strokeWidth={3}
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    ) : null
                  ))}

                  {selectedMetrics.map((metric) => (
                    data.map((point, index) => {
                      const total = data.length;
                      const x = total <= 1
                        ? padding + (chartWidth - 2 * padding) / 2
                        : padding + (index * (chartWidth - 2 * padding)) / (total - 1);
                      const y = mapValueToY(point[metric]);
                      return (
                        <Circle
                          key={`${metric}-${index}`}
                          cx={x}
                          cy={y}
                          r="3"
                          fill={metricConfig[metric].color}
                          stroke={themeColors.surface}
                          strokeWidth={2}
                        />
                      );
                    })
                  ))}
                  {/* X-axis labels */}
                  {data.map((point, index) => {
                    const total = data.length;
                    const x = total <= 1
                      ? padding + (chartWidth - 2 * padding) / 2
                      : padding + (index * (chartWidth - 2 * padding)) / (total - 1);
                    const y = chartHeight - 5;
                    return (
                      <SvgText
                        key={`x-label-${index}`}
                        x={x}
                        y={y}
                        textAnchor="middle"
                        fontSize="10"
                        fill={themeColors.textSecondary}
                      >
                        {point.date}
                      </SvgText>
                    );
                  })}
                </Svg>
              </View>
            )}

            {/* Stats */}
            {selectedMetrics.map((metric) => {
              const stats = metricStats(metric);
              if (!stats) return null;
              const trendIcon = stats.trend === 'up'
                ? 'trending-up'
                : stats.trend === 'down'
                  ? 'trending-down'
                  : 'trending-neutral';
              const trendColor = stats.trend === 'up'
                ? '#10b981'
                : stats.trend === 'down'
                  ? '#ef4444'
                  : themeColors.textSecondary;

              return (
                <View key={`stat-${metric}`} style={styles.metricSection}>
                  <View style={styles.metricHeader}>
                    <View style={[styles.metricDot, { backgroundColor: metricConfig[metric].color }]} />
                    <Text style={[styles.metricTitle, { color: themeColors.text }]} numberOfLines={1} ellipsizeMode="tail">
                      {metricConfig[metric].label}
                    </Text>
                  </View>
                  <View style={styles.statsRow}>
                    <View style={[styles.statCard, { backgroundColor: themeColors.surfaceElevated, borderColor: themeColors.border }]}>
                      <Text style={[styles.statLabel, { color: themeColors.textSecondary }]}>
                        {t('home.weeklyProgress.average') || 'Media'}
                      </Text>
                      <Text style={[styles.statValue, { color: themeColors.text }]}>{stats.avg.toFixed(1)}</Text>
                    </View>
                    <View style={[styles.statCard, { backgroundColor: themeColors.surfaceElevated, borderColor: themeColors.border }]}>
                      <Text style={[styles.statLabel, { color: themeColors.textSecondary }]}>
                        {t('home.weeklyProgress.max') || 'Massimo'}
                      </Text>
                      <Text style={[styles.statValue, { color: themeColors.text }]}>{stats.max.toFixed(0)}</Text>
                    </View>
                    <View style={[styles.statCard, { backgroundColor: themeColors.surfaceElevated, borderColor: themeColors.border }]}>
                      <Text style={[styles.statLabel, { color: themeColors.textSecondary }]}>
                        {t('home.weeklyProgress.min') || 'Minimo'}
                      </Text>
                      <Text style={[styles.statValue, { color: themeColors.text }]}>{stats.min.toFixed(0)}</Text>
                    </View>
                  </View>
                  <View style={styles.trendIndicator}>
                    <MaterialCommunityIcons name={trendIcon as any} size={16} color={trendColor} />
                    <Text style={[styles.trendText, { color: trendColor }]}>
                      {stats.trend === 'up'
                        ? t('analysis.skin.trends.improving') || 'In miglioramento'
                        : stats.trend === 'down'
                          ? t('analysis.skin.trends.declining') || 'In calo'
                          : t('analysis.skin.trends.stable') || 'Stabile'}
                    </Text>
                  </View>
                </View>
              );
            })}
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
    marginBottom: 16,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  periodButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  metricFilterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
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
  chartContainer: {
    marginBottom: 24,
    alignItems: 'center',
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
  summaryMetricsContainer: {
    marginTop: 4,
  },
  summaryMetricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  summaryMetricChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    gap: 6,
  },
  summaryMetricDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  summaryMetricText: {
    fontSize: 12,
    fontWeight: '500',
  },
});

export default SkinTrendDetailModal;

