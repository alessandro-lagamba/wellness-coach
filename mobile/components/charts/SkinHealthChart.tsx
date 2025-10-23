import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient as SvgLinearGradient, Stop, Rect } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import FontAwesome from '@expo/vector-icons/FontAwesome';

const { width } = Dimensions.get('window');

interface SkinHealthChartProps {
  data: Array<{ date: string; texture: number; redness: number; hydration: number; overall: number }>;
  title: string;
  subtitle?: string;
}

export const SkinHealthChart: React.FC<SkinHealthChartProps> = ({ data, title, subtitle }) => {
  // Generate sample data if none provided
  const chartData = data.length > 0 ? data : [
    { date: '1/1', texture: 65, redness: 25, hydration: 40, overall: 55 },
    { date: '1/2', texture: 68, redness: 22, hydration: 42, overall: 58 },
    { date: '1/3', texture: 70, redness: 20, hydration: 45, overall: 60 },
    { date: '1/4', texture: 72, redness: 18, hydration: 48, overall: 62 },
    { date: '1/5', texture: 75, redness: 15, hydration: 50, overall: 65 },
    { date: '1/6', texture: 73, redness: 17, hydration: 47, overall: 63 },
    { date: '1/7', texture: 76, redness: 14, hydration: 52, overall: 66 },
  ];

  const hasData = data.length > 0;
  const latestOverall = chartData[chartData.length - 1]?.overall || 0;
  const previousOverall = chartData[chartData.length - 2]?.overall || 0;
  const trend = latestOverall - previousOverall;

  // Calculate SVG path for the line
  const chartWidth = width - 120;
  const chartHeight = 100;
  const padding = 20;
  
  const mapValueToY = (value: number) => (
    padding + ((100 - value) * (chartHeight - 2 * padding)) / 100
  );

  const createPathPoints = (values: number[]) => {
    if (!values.length) {
      return [];
    }

    if (values.length === 1) {
      const y = mapValueToY(values[0]);
      return [
        { x: padding, y },
        { x: chartWidth - padding, y },
      ];
    }

    return values.map((value, index) => ({
      x: padding + (index * (chartWidth - 2 * padding)) / (values.length - 1),
      y: mapValueToY(value),
    }));
  };

  const overallPoints = createPathPoints(chartData.map(d => d.overall));
  const overallPath = overallPoints
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');
  const hasOverallPath = overallPoints.length > 0;

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
          
          <View style={styles.scoreContainer}>
            <Text style={styles.scoreValue}>{latestOverall}</Text>
            <Text style={styles.scoreLabel}>/100</Text>
            {trend !== 0 && (
              <FontAwesome
                name={trend > 0 ? 'arrow-up' : 'arrow-down'}
                size={12}
                color={trend > 0 ? '#10b981' : '#ef4444'}
                style={styles.trendIcon}
              />
            )}
          </View>
        </View>

        <View style={styles.chartContainer}>
          <Svg width={chartWidth} height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
            <Defs>
              <SvgLinearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <Stop offset="0%" stopColor="#6366f1" stopOpacity="0.3" />
                <Stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
              </SvgLinearGradient>
            </Defs>
            
            {/* Grid lines */}
            {[0, 25, 50, 75, 100].map((value, index) => (
              <Rect
                key={index}
                x={padding}
                y={padding + ((100 - value) * (chartHeight - 2 * padding)) / 100}
                width={chartWidth - 2 * padding}
                height={1}
                fill="#e2e8f0"
                opacity={0.5}
              />
            ))}
            
            {/* Area fill */}
            {hasOverallPath && (
              <Path
                d={`${overallPath} L ${chartWidth - padding} ${chartHeight - padding} L ${padding} ${chartHeight - padding} Z`}
                fill="url(#areaGradient)"
              />
            )}
            
            {/* Main line */}
            {hasOverallPath && (
              <Path
                d={overallPath}
                stroke="#6366f1"
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            
            {/* Data points */}
            {chartData.map((point, index) => {
              const total = chartData.length;
              const x = total <= 1
                ? padding + (chartWidth - 2 * padding) / 2
                : padding + (index * (chartWidth - 2 * padding)) / (total - 1);
              const y = mapValueToY(point.overall);
              return (
                <Circle
                  key={index}
                  cx={x}
                  cy={y}
                  r="4"
                  fill="#6366f1"
                  stroke="#ffffff"
                  strokeWidth="2"
                />
              );
            })}
          </Svg>
        </View>

        <View style={styles.metricsRow}>
          <View style={styles.metricItem}>
            <View style={[styles.metricDot, { backgroundColor: '#8b5cf6' }]} />
            <Text style={styles.metricLabel}>Texture</Text>
            <Text style={styles.metricValue}>{chartData[chartData.length - 1]?.texture || 0}</Text>
          </View>
          
          <View style={styles.metricItem}>
            <View style={[styles.metricDot, { backgroundColor: '#ef4444' }]} />
            <Text style={styles.metricLabel}>Redness</Text>
            <Text style={styles.metricValue}>{chartData[chartData.length - 1]?.redness || 0}</Text>
          </View>
          
          <View style={styles.metricItem}>
            <View style={[styles.metricDot, { backgroundColor: '#f59e0b' }]} />
            <Text style={styles.metricLabel}>Hydration</Text>
            <Text style={styles.metricValue}>{chartData[chartData.length - 1]?.hydration || 0}</Text>
          </View>
        </View>

        {!hasData && (
          <View style={styles.placeholderContainer}>
            <FontAwesome name="line-chart" size={24} color="#94a3b8" />
            <Text style={styles.placeholderText}>Start scanning to see your trends</Text>
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
  scoreContainer: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  scoreValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#6366f1',
  },
  scoreLabel: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  trendIcon: {
    marginLeft: 4,
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
