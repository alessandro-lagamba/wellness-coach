import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient as SvgLinearGradient, Stop, Rect } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import FontAwesome from '@expo/vector-icons/FontAwesome';

const { width } = Dimensions.get('window');

interface EmotionTrendChartProps {
  data: Array<{ date: string; valence: number; arousal: number; emotion: string }>;
  title: string;
  subtitle?: string;
}

export const EmotionTrendChart: React.FC<EmotionTrendChartProps> = ({ data, title, subtitle }) => {
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
  const latestValence = chartData[chartData.length - 1]?.valence || 0;
  const latestArousal = chartData[chartData.length - 1]?.arousal || 0;
  const latestEmotion = chartData[chartData.length - 1]?.emotion || 'neutral';

  const getEmotionColor = (emotion: string) => {
    switch (emotion.toLowerCase()) {
      case 'happy': return '#facc15';
      case 'neutral': return '#94a3b8';
      case 'sad': return '#60a5fa';
      case 'angry': return '#ef4444';
      case 'excited': return '#22d3ee';
      case 'calm': return '#10b981';
      case 'stressed': return '#f59e0b';
      case 'content': return '#8b5cf6';
      default: return '#6b7280';
    }
  };

  const getEmotionIcon = (emotion: string) => {
    switch (emotion.toLowerCase()) {
      case 'happy': return 'smile-o';
      case 'neutral': return 'meh-o';
      case 'sad': return 'frown-o';
      case 'angry': return 'angry';
      case 'excited': return 'star';
      case 'calm': return 'leaf';
      case 'stressed': return 'exclamation-triangle';
      case 'content': return 'heart';
      default: return 'circle';
    }
  };

  // Calculate SVG path for the lines
  const chartWidth = width - 120;
  const chartHeight = 120;
  const padding = 20;
  
  const createPath = (values: number[], color: string) => {
    // Guard against insufficient data points
    if (values.length < 2) {
      if (values.length === 1) {
        // For single point, create a horizontal line
        const normalizedValue = (values[0] + 1) / 2;
        const y = padding + (1 - normalizedValue) * (chartHeight - 2 * padding);
        return `M ${padding} ${y} L ${chartWidth - padding} ${y}`;
      }
      // For no data, return empty path
      return '';
    }
    
    const points = values.map((value, index) => {
      const x = padding + (index * (chartWidth - 2 * padding)) / (values.length - 1);
      // Convert from [-1, 1] range to [0, chartHeight - 2*padding] range
      const normalizedValue = (value + 1) / 2; // Convert to [0, 1]
      const y = padding + (1 - normalizedValue) * (chartHeight - 2 * padding);
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
    return points;
  };

  const valencePath = createPath(chartData.map(d => d.valence), '#10b981');
  const arousalPath = createPath(chartData.map(d => d.arousal), '#ef4444');

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#ffffff', '#f8fafc']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.chartCard}
      >
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>{title}</Text>
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          </View>
          
          <View style={styles.emotionContainer}>
            <FontAwesome
              name={getEmotionIcon(latestEmotion) as any}
              size={20}
              color={getEmotionColor(latestEmotion)}
            />
            <Text style={[styles.emotionText, { color: getEmotionColor(latestEmotion) }]}>
              {latestEmotion}
            </Text>
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
              const y = padding + (1 - normalizedValue) * (chartHeight - 2 * padding);
              return (
                <Rect
                  key={index}
                  x={padding}
                  y={y}
                  width={chartWidth - 2 * padding}
                  height={1}
                  fill="#e2e8f0"
                  opacity={0.5}
                />
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
            {chartData.length > 0 && chartData.map((point, index) => {
              const x = chartData.length === 1 
                ? padding + (chartWidth - 2 * padding) / 2  // Center for single point
                : padding + (index * (chartWidth - 2 * padding)) / (chartData.length - 1);
              const normalizedValence = (point.valence + 1) / 2;
              const y = padding + (1 - normalizedValence) * (chartHeight - 2 * padding);
              return (
                <Circle
                  key={`valence-${index}`}
                  cx={x}
                  cy={y}
                  r="3"
                  fill="#10b981"
                  stroke="#ffffff"
                  strokeWidth="2"
                />
              );
            })}
            
            {/* Data points for arousal */}
            {chartData.length > 0 && chartData.map((point, index) => {
              const x = chartData.length === 1 
                ? padding + (chartWidth - 2 * padding) / 2  // Center for single point
                : padding + (index * (chartWidth - 2 * padding)) / (chartData.length - 1);
              const normalizedArousal = (point.arousal + 1) / 2;
              const y = padding + (1 - normalizedArousal) * (chartHeight - 2 * padding);
              return (
                <Circle
                  key={`arousal-${index}`}
                  cx={x}
                  cy={y}
                  r="3"
                  fill="#ef4444"
                  stroke="#ffffff"
                  strokeWidth="2"
                />
              );
            })}
          </Svg>
        </View>

        <View style={styles.metricsRow}>
          <View style={styles.metricItem}>
            <View style={[styles.metricDot, { backgroundColor: '#10b981' }]} />
            <Text style={styles.metricLabel}>Valence</Text>
            <Text style={styles.metricValue}>{latestValence.toFixed(2)}</Text>
          </View>
          
          <View style={styles.metricItem}>
            <View style={[styles.metricDot, { backgroundColor: '#ef4444' }]} />
            <Text style={styles.metricLabel}>Arousal</Text>
            <Text style={styles.metricValue}>{latestArousal.toFixed(2)}</Text>
          </View>
        </View>

        {!hasData && (
          <View style={styles.placeholderContainer}>
            <FontAwesome name="heart" size={24} color="#94a3b8" />
            <Text style={styles.placeholderText}>Start sessions to see your emotional trends</Text>
          </View>
        )}
      </LinearGradient>
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
    borderColor: '#e2e8f0',
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
    color: '#1e293b',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  emotionContainer: {
    alignItems: 'center',
    gap: 4,
  },
  emotionText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
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
    borderTopColor: '#e2e8f0',
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
    color: '#64748b',
    fontWeight: '500',
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  placeholderContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  placeholderText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },
});