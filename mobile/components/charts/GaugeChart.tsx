import React, { useState, memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions, LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Path, Text as SvgText, Defs, LinearGradient as SvgLinearGradient, Stop, TSpan } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { GaugePopup } from './GaugePopup';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from '../../hooks/useTranslation';

// 🔥 Fixed viewBox for consistent coordinates
const VB_SIZE = 100;
const REFERENCE_SIZE = 120; // Reference size for scaling calculations

interface GaugeChartProps {
  value: number;
  maxValue: number;
  label: string;
  color: string;
  subtitle?: string;
  trend?: number;
  description?: string;
  historicalData?: Array<{ date: string; value: number }>;
  metric?: string; // 'valence', 'arousal', 'texture', 'redness', 'hydration', 'oiliness'
  icon?: string;
  unit?: string; // 🔥 NEW: Unit to display (e.g., 'g', 'kcal', '%')
}

// 🔥 PERF: Memoized to prevent unnecessary re-renders
export const GaugeChart: React.FC<GaugeChartProps> = memo(({
  value,
  maxValue,
  label,
  color,
  subtitle,
  trend,
  description,
  historicalData,
  metric,
  icon,
  unit
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [showPopup, setShowPopup] = useState(false);

  // ✅ Robust value validation and fallback
  const safeValue = (() => {
    if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
      // 🔥 PERF: Removed console.warn - fires too often on renders
      return 50; // Default fallback value
    }
    return Math.max(0, Math.min(value, maxValue)); // Clamp between 0 and maxValue
  })();

  const safeTrend = (() => {
    if (typeof trend !== 'number' || isNaN(trend) || !isFinite(trend)) {
      return 0;
    }
    return trend;
  })();

  const percentage = Math.min((safeValue / maxValue) * 100, 100);

  // 🔥 FIX: Dynamic sizing using onLayout - measures actual container width
  const { width: windowWidth } = useWindowDimensions();
  const [chartSize, setChartSize] = useState(Math.min(120, Math.max(85, windowWidth * 0.26)));

  const handleChartLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    // Take min between container width and reasonable max (clamped 85-130)
    const size = Math.max(85, Math.min(w * 0.9, 130));
    setChartSize(size);
  };

  // Fixed viewBox parameters
  const r = 40; // radius in viewBox units
  const strokeWidth = 6; // stroke in viewBox units
  const circumference = 2 * Math.PI * r;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference * (1 - percentage / 100);

  // 🆕 FIX: For redness/oiliness, LOWER values are BETTER (inverted scale)
  const isInvertedMetric = metric === 'redness' || metric === 'oiliness';
  // Calculate effective score for color/label (invert if needed)
  const scoreForLabel = isInvertedMetric ? (maxValue - safeValue) : safeValue;
  const percentageForLabel = (scoreForLabel / maxValue) * 100;

  const getScoreColor = (pctScore: number) => {
    if (pctScore >= 80) return '#10b981'; // Green
    if (pctScore >= 60) return '#f59e0b'; // Yellow
    if (pctScore >= 40) return '#ef4444'; // Red
    return '#6b7280'; // Gray
  };

  const getScoreLabel = (pctScore: number) => {
    if (pctScore >= 80) return t('analysis.gauge.excellent');
    if (pctScore >= 60) return t('analysis.gauge.good');
    if (pctScore >= 40) return t('analysis.gauge.fair');
    return t('analysis.gauge.poor');
  };

  // 🔧 Scaling for font/offset based on chartSize (pixels)
  const scale = chartSize / REFERENCE_SIZE;
  // 🔥 FIX: Scaled font sizes for balanced readability
  const valueFontSize = Math.max(20, 26 * scale); // Minimum 18, scales with chart
  const valueStr = String(safeValue);
  const centerX = VB_SIZE / 2; // 50 in viewBox units
  // Offset for unit text - convert px to viewBox units
  const charWidth = valueFontSize * 0.5;
  const valueWidth = valueStr.length * charWidth;
  const unitOffset = (valueWidth / 2 + 2) / (chartSize / VB_SIZE); // Convert to viewBox units
  const maxFontSize = Math.max(10, 13 * scale); // Minimum 10 for max value label

  return (
    <View style={styles.container}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => setShowPopup(true)}
        style={[styles.gaugeCard, { borderColor: colors.border }]}
      >
        <LinearGradient
          colors={[colors.surface, colors.surfaceElevated]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gaugeCardInner}
        >
          <View style={styles.header}>
            <Text style={[styles.label, { color: colors.text }]} numberOfLines={1} ellipsizeMode="tail" allowFontScaling={false}>{label}</Text>
            {subtitle && <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1} ellipsizeMode="tail" allowFontScaling={false}>{subtitle}</Text>}
          </View>

          <View
            style={styles.chartContainer}
            onLayout={handleChartLayout}
          >
            <Svg width={chartSize} height={chartSize} viewBox={`0 0 ${VB_SIZE} ${VB_SIZE}`}>
              <Defs>
                <SvgLinearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor={color} stopOpacity="0.8" />
                  <Stop offset="100%" stopColor={color} stopOpacity="1" />
                </SvgLinearGradient>
              </Defs>

              {/* Background circle */}
              <Circle
                cx={centerX}
                cy={centerX}
                r={r}
                stroke={colors.borderLight}
                strokeWidth={strokeWidth}
                fill="none"
              />

              {/* Progress circle */}
              <Circle
                cx={centerX}
                cy={centerX}
                r={r}
                stroke="url(#gradient)"
                strokeWidth={strokeWidth}
                fill="none"
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                transform={`rotate(-90 ${centerX} ${centerX})`}
              />

              {/* Center text - numero + unit centrati insieme */}
              <SvgText
                x={centerX}
                y="52"
                textAnchor="middle"
                fill={getScoreColor(percentageForLabel)}
              >
                <TSpan fontSize={valueFontSize} fontFamily="Figtree_700Bold">
                  {valueStr}
                </TSpan>
                {unit && (
                  <TSpan fontSize={valueFontSize * 0.55} fontFamily="Figtree_500Medium" dx="2" dy="-1">
                    {unit}
                  </TSpan>
                )}
              </SvgText>
            </Svg>
          </View>
          <View style={styles.footer}>
            <View style={styles.scoreContainer}>
              <View style={[styles.scoreBadge, { backgroundColor: getScoreColor(percentageForLabel) }]}>
                <Text style={styles.scoreText} allowFontScaling={false}>{getScoreLabel(percentageForLabel)}</Text>
              </View>

              {safeTrend !== undefined && safeTrend !== 0 && (
                <View style={styles.trendContainer}>
                  <FontAwesome
                    name={safeTrend > 0 ? 'arrow-up' : 'arrow-down'}
                    size={10}
                    color={safeTrend > 0 ? '#10b981' : '#ef4444'}
                  />
                  <Text style={[styles.trendText, { color: safeTrend > 0 ? '#10b981' : '#ef4444' }]} allowFontScaling={false}>
                    {Math.abs(safeTrend)}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>

      {/* Popup Modal */}
      <GaugePopup
        visible={showPopup}
        onClose={() => setShowPopup(false)}
        value={safeValue}
        maxValue={maxValue}
        label={label}
        color={color}
        subtitle={subtitle || ''}
        trend={safeTrend}
        description={description || `Questo grafico mostra il valore attuale di ${label.toLowerCase()}.`}
        historicalData={historicalData}
        metric={metric}
        icon={icon}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginHorizontal: 4,
  },
  gaugeCard: {
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    minHeight: 150,
  },
  gaugeCardInner: {
    borderRadius: 16,
    padding: 10,
    alignItems: 'center',
    minHeight: 150,
  },
  header: {
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 13,
    fontFamily: 'Figtree_700Bold', // Was 600
    textAlign: 'center',
    maxWidth: '100%',
  },
  subtitle: {
    fontSize: 9,
    fontFamily: 'Figtree_500Medium',
    marginTop: 2,
    maxWidth: '100%',
  },
  chartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10, // Ridotto da 12 a 8
  },
  footer: {
    alignItems: 'center',
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6, // Ridotto da 8 a 6
  },
  scoreBadge: {
    paddingVertical: 3, // Ridotto da 4 a 3
    paddingHorizontal: 8, // Ridotto da 8 a 6
    borderRadius: 12, // Ridotto da 12 a 10
  },
  scoreText: {
    fontSize: 10,
    fontFamily: 'Figtree_700Bold', // Was 600
    color: '#ffffff',
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  trendText: {
    fontSize: 9, // Ridotto da 10 a 9
    fontFamily: 'Figtree_700Bold', // Was 600
  },
});
