import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient as SvgLinearGradient, Stop, Rect, Text as SvgText } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from '../../hooks/useTranslation';

const { width } = Dimensions.get('window');

interface EmotionTrendChartProps {
  noCard?: boolean;
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
  noCard = false,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const activeMetrics = useMemo(() => (visibleMetrics && visibleMetrics.length > 0
    ? visibleMetrics
    : (['valence', 'arousal'] as Array<'valence' | 'arousal'>)
  ), [visibleMetrics]);
  const showValence = activeMetrics.includes('valence');
  const showArousal = activeMetrics.includes('arousal');

  const chartData = data.length > 0 ? data : [
    { date: '13/1', valence: 0.2, arousal: 0.6, emotion: 'neutral' },
    { date: '14/1', valence: 0.4, arousal: 0.5, emotion: 'happy' },
    { date: '15/1', valence: 0.6, arousal: 0.4, emotion: 'happy' },
    { date: '16/1', valence: 0.3, arousal: 0.7, emotion: 'excited' },
    { date: '17/1', valence: 0.5, arousal: 0.3, emotion: 'calm' },
    { date: '18/1', valence: 0.1, arousal: 0.8, emotion: 'stressed' },
    { date: '19/1', valence: 0.7, arousal: 0.2, emotion: 'content' },
  ];

  const hasData = data.length > 0;
  // 🆕 FIX: Data is sorted descending (newest first), so [0] is the most recent
  const latestDataPoint = chartData[chartData.length - 1];
  const latestValence = latestDataPoint?.valence || 0;
  const latestArousal = latestDataPoint?.arousal || 0;

  // Calculate SVG path for the lines
  const chartWidth = width - 80;
  const chartHeight = 150;
  const padding = 20;
  const leftPadding = 40;
  const bottomPadding = 30;

  const createPath = (values: number[]) => {
    if (values.length < 2) {
      if (values.length === 1) {
        const normalizedValue = (values[0] + 1) / 2;
        const y = padding + (1 - normalizedValue) * (chartHeight - padding - bottomPadding);
        return `M ${leftPadding} ${y} L ${chartWidth - padding} ${y}`;
      }
      return '';
    }

    return values.map((value, index) => {
      const x = leftPadding + (index * (chartWidth - leftPadding - padding)) / (values.length - 1);
      const normalizedValue = (value + 1) / 2;
      const y = padding + (1 - normalizedValue) * (chartHeight - padding - bottomPadding);
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  };

  const valencePath = showValence ? createPath(chartData.map(d => d.valence)) : '';
  const arousalPath = showArousal ? createPath(chartData.map(d => d.arousal)) : '';

  const chartContent = (
    <View style={styles.chartContainer}>
      <Svg width={chartWidth} height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
        <Defs>
          <SvgLinearGradient id="valenceGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#f97316" stopOpacity="0.3" />
            <Stop offset="100%" stopColor="#f97316" stopOpacity="0" />
          </SvgLinearGradient>
          <SvgLinearGradient id="arousalGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
            <Stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </SvgLinearGradient>
        </Defs>

        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map((value, index) => {
          const normalizedValue = value / 100;
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

        {/* Y-axis labels */}
        {[0, 25, 50, 75, 100].map((value, index) => {
          const normalizedValue = value / 100;
          const y = padding + (1 - normalizedValue) * (chartHeight - padding - bottomPadding);
          return (
            <React.Fragment key={`y-label-${index}`}>
              <SvgText
                x={leftPadding - 8}
                y={y + 4}
                textAnchor="end"
                fontSize="10"
                fontFamily="Figtree_500Medium"
                fill={colors.textSecondary}
              >
                {value}
              </SvgText>
            </React.Fragment>
          );
        })}

        {/* X-axis labels */}
        {chartData.length > 0 && chartData.map((point, index) => {
          if (chartData.length > 7 && index % 2 !== 0) return null;
          const x = chartData.length === 1
            ? leftPadding + (chartWidth - leftPadding - padding) / 2
            : leftPadding + (index * (chartWidth - leftPadding - padding)) / (chartData.length - 1);
          const y = chartHeight - bottomPadding + 15;
          return (
            <React.Fragment key={`x-label-${index}`}>
              <SvgText
                x={x}
                y={y}
                textAnchor="middle"
                fontSize="10"
                fontFamily="Figtree_500Medium"
                fill={colors.textSecondary}
              >
                {point.date}
              </SvgText>
            </React.Fragment>
          );
        })}

        {/* Valence line */}
        {valencePath && (
          <Path
            d={valencePath}
            stroke="#f97316"
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
            stroke="#3b82f6"
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
              fill="#f97316"
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
              fill="#3b82f6"
              stroke={colors.surface}
              strokeWidth="2"
            />
          );
        })}
      </Svg>

      {!hasData && (
        <View style={styles.placeholderContainer}>
          <FontAwesome name="heart" size={24} color={colors.textTertiary} />
          <Text style={[styles.placeholderText, { color: colors.textSecondary }]}>
            {t('analysis.emotion.trends.emptyState') || 'Inizia a registrare sessioni per vedere l’andamento emotivo'}
          </Text>
        </View>
      )}
    </View>
  );

  if (noCard) {
    return <View style={{ alignItems: 'center' }}>{chartContent}</View>;
  }

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
          {chartContent}
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginBottom: 10,
    marginTop: 2,
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
    fontFamily: 'Figtree_700Bold',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: 'Figtree_500Medium',
  },
  chartContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  placeholderContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  placeholderText: {
    fontSize: 12,
    fontFamily: 'Figtree_500Medium',
  },
});