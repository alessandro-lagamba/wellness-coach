import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import Svg, { Circle, Path, Text as SvgText, Defs, LinearGradient as SvgLinearGradient, Stop, TSpan } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { GaugePopup } from './GaugePopup';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from '../../hooks/useTranslation';

const { width } = Dimensions.get('window');

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
}

export const GaugeChart: React.FC<GaugeChartProps> = ({
  value,
  maxValue,
  label,
  color,
  subtitle,
  trend,
  description,
  historicalData,
  metric,
  icon
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [showPopup, setShowPopup] = useState(false);

  // ✅ FIX: Robust value validation and fallback
  const safeValue = (() => {
    if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
      console.warn(`⚠️ Invalid value for ${label}:`, value, 'Using fallback');
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
  const radius = 40;
  const strokeWidth = 6;
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#10b981'; // Green
    if (score >= 60) return '#f59e0b'; // Yellow
    if (score >= 40) return '#ef4444'; // Red
    return '#6b7280'; // Gray
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return t('analysis.gauge.excellent');
    if (score >= 60) return t('analysis.gauge.good');
    if (score >= 40) return t('analysis.gauge.fair');
    return t('analysis.gauge.poor');
  };

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
            <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
            {subtitle && <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>}
          </View>

          <View style={styles.chartContainer}>
            <Svg width={100} height={100} viewBox="0 0 100 100">
              <Defs>
                <SvgLinearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor={color} stopOpacity="0.8" />
                  <Stop offset="100%" stopColor={color} stopOpacity="1" />
                </SvgLinearGradient>
              </Defs>

              {/* Background circle */}
              <Circle
                cx="50"
                cy="50"
                r={40}
                stroke={colors.borderLight}
                strokeWidth={6}
                fill="none"
              />

              {/* Progress circle */}
              <Circle
                cx="50"
                cy="50"
                r={40}
                stroke="url(#gradient)"
                strokeWidth={6}
                fill="none"
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                transform="rotate(-90 50 50)"
              />

              {/* Center text */}
              <SvgText
                x="50"
                y="48"
                textAnchor="middle"
                fontSize="18"
                fontWeight="700"
                fill={getScoreColor(safeValue)}
              >
                {safeValue}
              </SvgText>
              <SvgText
                x="50"
                y="60"
                textAnchor="middle"
                fontSize="10"
                fill={colors.textSecondary}
              >
                /<TSpan dx="8">{maxValue}</TSpan>
              </SvgText>
            </Svg>
          </View>

          <View style={styles.footer}>
            <View style={styles.scoreContainer}>
              <View style={[styles.scoreBadge, { backgroundColor: getScoreColor(safeValue) }]}>
                <Text style={styles.scoreText}>{getScoreLabel(safeValue)}</Text>
              </View>

              {safeTrend !== undefined && safeTrend !== 0 && (
                <View style={styles.trendContainer}>
                  <FontAwesome
                    name={safeTrend > 0 ? 'arrow-up' : 'arrow-down'}
                    size={10}
                    color={safeTrend > 0 ? '#10b981' : '#ef4444'}
                  />
                  <Text style={[styles.trendText, { color: safeTrend > 0 ? '#10b981' : '#ef4444' }]}>
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
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginHorizontal: 4, // Ridotto da 8 a 4 per più spazio
  },
  gaugeCard: {
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    minHeight: 160,
  },
  gaugeCardInner: {
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    minHeight: 160,
  },
  header: {
    alignItems: 'center',
    marginBottom: 8, // Ridotto da 12 a 8
  },
  label: {
    fontSize: 13, // Ridotto da 14 a 13
    fontWeight: '600',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 9, // Ridotto da 10 a 9
    fontWeight: '500',
    marginTop: 2,
  },
  chartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8, // Ridotto da 12 a 8
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
    paddingHorizontal: 6, // Ridotto da 8 a 6
    borderRadius: 10, // Ridotto da 12 a 10
  },
  scoreText: {
    fontSize: 9, // Ridotto da 10 a 9
    fontWeight: '600',
    color: '#ffffff',
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  trendText: {
    fontSize: 9, // Ridotto da 10 a 9
    fontWeight: '600',
  },
});