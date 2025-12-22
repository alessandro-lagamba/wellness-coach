import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient as SvgLinearGradient, Stop, Rect, Text as SvgText } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from '../../hooks/useTranslation';

const { width } = Dimensions.get('window');

interface EmotionTrendChartProps {
  data: Array<{ date: string; valence: number; arousal: number; emotion: string }>;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  visibleMetrics?: Array<'valence' | 'arousal'>;
  metricLabels?: Partial<Record<'valence' | 'arousal', string>>;
}

export const EmotionTrendChart: React.FC<EmotionTrendChartProps> = ({
  data,
  title,
  subtitle,
  onPress,
  visibleMetrics,
  metricLabels,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const activeMetrics = useMemo(() => (visibleMetrics && visibleMetrics.length > 0
    ? visibleMetrics
    : (['valence', 'arousal'] as Array<'valence' | 'arousal'>)
  ), [visibleMetrics]);
  const showValence = activeMetrics.includes('valence');
  const showArousal = activeMetrics.includes('arousal');
  const labels = {
    valence: metricLabels?.valence || t('analysis.emotion.metrics.valence'),
    arousal: metricLabels?.arousal || t('analysis.emotion.metrics.arousal'),
  };

  // Generate sample data if none provided
  const chartData = data.length > 0 ? data : [
    { date: '1/1', valence: 0.2, arousal: 0.6, emotion: 'neutral' },
    { date: '1/2', valence: 0.4, arousal: 0.5, emotion: 'happy' },
    { date: '1/3', valence: 0.6, arousal: 0.4, emotion: 'happy' },
    { date: '1/4', valence: 0.3, arousal: 0.7, emotion: 'excited' },
    { date: '1/5', valence: 0.5, arousal: 0.3, emotion: 'calm' },
    { date: '1/6', valence: 0.1, arousal: 0.8, emotion: 'stressed' },
    { date: '1/7', valence: 0.7, arousal: 0.2, emotion: 'content' },
  ];

  const hasData = data.length > 0;
  const latestDataPoint = chartData[chartData.length - 1];
  const latestValence = latestDataPoint?.valence || 0;
  const latestArousal = latestDataPoint?.arousal || 0;

  // Calculate SVG path for the lines
  const chartWidth = width - 120;
  const chartHeight = 120;
  const padding = 20;
  const leftPadding = 35; // 🔥 FIX: Extra padding for y-axis labels
  const bottomPadding = 40; // 🔥 FIX: Extra padding for x-axis labels

  const createPath = (values: number[], color: string) => {
    // Guard against insufficient data points
    if (values.length < 2) {
      if (values.length === 1) {
        // For single point, create a horizontal line
        const normalizedValue = (values[0] + 1) / 2;
        const y = padding + (1 - normalizedValue) * (chartHeight - padding - bottomPadding);
        return `M ${leftPadding} ${y} L ${chartWidth - padding} ${y}`;
      }
      // For no data, return empty path
      return '';
    }

    const points = values.map((value, index) => {
      const x = leftPadding + (index * (chartWidth - leftPadding - padding)) / (values.length - 1);
      // Convert from [-1, 1] range to [0, chartHeight - padding - bottomPadding] range
      const normalizedValue = (value + 1) / 2; // Convert to [0, 1]
      const y = padding + (1 - normalizedValue) * (chartHeight - padding - bottomPadding);
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
    return points;
  };

  const valencePath = showValence ? createPath(chartData.map(d => d.valence), '#10b981') : '';
  const arousalPath = showArousal ? createPath(chartData.map(d => d.arousal), '#ef4444') : '';

  return (
    <View style={styles.container}>
      <TouchableOpacity
        activeOpacity={onPress ? 0.7 : 1}
        onPress={onPress}
        disabled={!onPress}
      >
        <LinearGradient
          colors={[colors.surface, colors.surfaceElevated]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.chartCard, { borderColor: colors.border }]}
        >
          <View style={styles.header}>
            <View style={styles.titleContainer}>
              <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
              {subtitle && <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>}
            </View>
          </View>

          <View style={styles.chartContainer}>
            <Svg width={chartWidth} height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
              <Defs>
                <SvgLinearGradient id="valenceGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <Stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                  <Stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                </SvgLinearGradient>
                <SvgLinearGradient id="arousalGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <Stop offset="0%" stopColor="#ef4444" stopOpacity="0.3" />
                  <Stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
                </SvgLinearGradient>
              </Defs>

              {/* Grid lines */}
              {[-1, -0.5, 0, 0.5, 1].map((value, index) => {
                const normalizedValue = (value + 1) / 2;
                const y = padding + (1 - normalizedValue) * (chartHeight - padding - bottomPadding);
                return (
                  <Rect
                    key={index}
                    x={leftPadding}
                    y={y}
                    width={chartWidth - leftPadding - padding}
                    height={1}
                    fill={colors.borderLight}
                    opacity={0.5}
                  />
                );
              })}

              {/* 🔥 FIX: Y-axis labels */}
              {[-1, 0, 1].map((value, index) => {
                const normalizedValue = (value + 1) / 2;
                const y = padding + (1 - normalizedValue) * (chartHeight - padding - bottomPadding);
                return (
                  <React.Fragment key={`y-label-${index}`}>
                    <SvgText
                      x={leftPadding - 8}
                      y={y + 4}
                      textAnchor="end"
                      fontSize="10"
                      fill={colors.textSecondary}
                    >
                      {value > 0 ? `+${value}` : value}
                    </SvgText>
                  </React.Fragment>
                );
              })}

              {/* 🔥 FIX: X-axis labels */}
              {chartData.length > 0 && chartData.map((point, index) => {
                // Show every other label to avoid crowding
                if (chartData.length > 5 && index % 2 !== 0) return null;
                const x = chartData.length === 1
                  ? leftPadding + (chartWidth - leftPadding - padding) / 2
                  : leftPadding + (index * (chartWidth - leftPadding - padding)) / (chartData.length - 1);
                const y = chartHeight - bottomPadding + 15;
                // Extract day from date (e.g., "1/15" -> "15")
                const dateLabel = point.date.split('/').pop() || point.date;
                return (
                  <React.Fragment key={`x-label-${index}`}>
                    <SvgText
                      x={x}
                      y={y}
                      textAnchor="middle"
                      fontSize="10"
                      fill={colors.textSecondary}
                    >
                      {dateLabel}
                    </SvgText>
                  </React.Fragment>
                );
              })}

              {/* Valence line */}
              {valencePath && (
                <Path
                  d={valencePath}
                  stroke="#10b981"
                  strokeWidth="3"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Arousal line */}
              {arousalPath && (
                <Path
                  d={arousalPath}
                  stroke="#ef4444"
                  strokeWidth="3"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Data points for valence */}
              {showValence && chartData.length > 0 && chartData.map((point, index) => {
                const x = chartData.length === 1
                  ? leftPadding + (chartWidth - leftPadding - padding) / 2
                  : leftPadding + (index * (chartWidth - leftPadding - padding)) / (chartData.length - 1);
                const normalizedValence = (point.valence + 1) / 2;
                const y = padding + (1 - normalizedValence) * (chartHeight - padding - bottomPadding);
                return (
                  <Circle
                    key={`valence-${index}`}
                    cx={x}
                    cy={y}
                    r="3"
                    fill="#10b981"
                    stroke={colors.surface}
                    strokeWidth="2"
                  />
                );
              })}

              {/* Data points for arousal */}
              {showArousal && chartData.length > 0 && chartData.map((point, index) => {
                const x = chartData.length === 1
                  ? leftPadding + (chartWidth - leftPadding - padding) / 2
                  : leftPadding + (index * (chartWidth - leftPadding - padding)) / (chartData.length - 1);
                const normalizedArousal = (point.arousal + 1) / 2;
                const y = padding + (1 - normalizedArousal) * (chartHeight - padding - bottomPadding);
                return (
                  <Circle
                    key={`arousal-${index}`}
                    cx={x}
                    cy={y}
                    r="3"
                    fill="#ef4444"
                    stroke={colors.surface}
                    strokeWidth="2"
                  />
                );
              })}
            </Svg>
          </View>

          <View style={[styles.metricsRow, { borderTopColor: colors.border }]}>
            {showValence && (
              <View style={styles.metricItem}>
                <View style={[styles.metricDot, { backgroundColor: '#10b981' }]} />
                <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>{labels.valence}</Text>
                <Text style={[styles.metricValue, { color: colors.text }]}>{latestValence.toFixed(2)}</Text>
              </View>
            )}

            {showArousal && (
              <View style={styles.metricItem}>
                <View style={[styles.metricDot, { backgroundColor: '#ef4444' }]} />
                <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>{labels.arousal}</Text>
                <Text style={[styles.metricValue, { color: colors.text }]}>{latestArousal.toFixed(2)}</Text>
              </View>
            )}
          </View>

          {!hasData && (
            <View style={styles.placeholderContainer}>
              <FontAwesome name="heart" size={24} color={colors.textTertiary} />
              <Text style={[styles.placeholderText, { color: colors.textSecondary }]}>
                {t('analysis.emotion.trends.emptyState') || 'Inizia a registrare sessioni per vedere l’andamento emotivo'}
              </Text>
            </View>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  chartCard: {
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
  },
  chartContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: 1,
  },
  metricItem: {
    alignItems: 'center',
    gap: 4,
  },
  metricDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '500',
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  placeholderContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  placeholderText: {
    fontSize: 12,
    fontWeight: '500',
  },
});