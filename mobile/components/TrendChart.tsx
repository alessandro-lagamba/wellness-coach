import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Circle, Line, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../contexts/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 80; // Larghezza con padding
const CHART_HEIGHT = 300; // Altezza maggiore per il modal
const PADDING_TOP = 20;
const PADDING_BOTTOM = 40; // Spazio per le etichette dei giorni
const PADDING_LEFT = 70; // Spazio per i valori verticali (aumentato per evitare troncamenti come 'bicchieri')
const PADDING_RIGHT = 16;
const CHART_AREA_WIDTH = CHART_WIDTH - PADDING_LEFT - PADDING_RIGHT;
const CHART_AREA_HEIGHT = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM;

interface TrendChartProps {
  data: number[];
  color?: string;
  maxValue?: number;
  formatValue?: (value: number) => string;
  days: 7 | 30;
}

export const TrendChart: React.FC<TrendChartProps> = ({
  data,
  color = '#f97316',
  maxValue,
  formatValue = (v) => v.toLocaleString(),
  days,
}) => {
  const { colors } = useTheme();

  // Genera le etichette dei giorni
  const getDayLabels = (): string[] => {
    const labels: string[] = [];
    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      if (days === 7) {
        const dayName = date.toLocaleDateString('it-IT', { weekday: 'short' });
        labels.push(dayName.charAt(0).toUpperCase() + dayName.slice(1, 3));
      } else {
        // Per 30 giorni, mostra solo il giorno del mese ogni 5 giorni
        const dayOfMonth = date.getDate();
        if (i % 5 === 0 || i === days - 1) {
          labels.push(dayOfMonth.toString());
        } else {
          labels.push('');
        }
      }
    }
    return labels;
  };

  const dayLabels = getDayLabels();

  if (!data || data.length === 0) {
    return (
      <View style={styles.container}>
        <View style={[styles.emptyChart, { backgroundColor: colors.surfaceMuted }]}>
          <View style={[styles.emptyLine, { backgroundColor: colors.border }]} />
        </View>
      </View>
    );
  }

  // Normalizza i dati per il grafico
  let normalizedData = [...data];
  while (normalizedData.length < days) {
    normalizedData.unshift(0);
  }
  normalizedData = normalizedData.slice(-days); // Prendi solo gli ultimi N giorni

  normalizedData = normalizedData.map((value) => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return 0;
    return value;
  });

  // Calcola il valore massimo
  const max = maxValue || Math.max(...normalizedData, 1);
  const min = Math.min(...normalizedData, 0);
  const range = max - min || 1;

  // Calcola i valori per la scala verticale (5 valori)
  const scaleValues = [
    max,
    min + range * 0.75,
    min + range * 0.5,
    min + range * 0.25,
    min,
  ].filter(v => v >= 0);

  // Calcola i punti del grafico
  const points: { x: number; y: number; value: number }[] = normalizedData.map((value, index) => {
    const x = PADDING_LEFT + (index * CHART_AREA_WIDTH) / (normalizedData.length - 1 || 1);
    // Inverti Y perché SVG ha Y=0 in alto
    const normalizedValue = range > 0 ? ((value - min) / range) : 0.5;
    const y = PADDING_TOP + CHART_AREA_HEIGHT * (1 - normalizedValue);
    return { x, y, value };
  });

  // Crea il path per la linea
  const pathData = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');

  // Punti per i cerchi (solo il primo e l'ultimo)
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];

  return (
    <View style={styles.container}>
      <Svg width={CHART_WIDTH} height={CHART_HEIGHT} style={styles.chart}>
        {/* Linee di griglia orizzontali */}
        {scaleValues.map((value, index) => {
          const normalizedValue = range > 0 ? ((value - min) / range) : 0.5;
          const y = PADDING_TOP + CHART_AREA_HEIGHT * (1 - normalizedValue);
          return (
            <Line
              key={`grid-${index}`}
              x1={PADDING_LEFT}
              y1={y}
              x2={CHART_WIDTH - PADDING_RIGHT}
              y2={y}
              stroke={colors.border}
              strokeWidth={0.5}
              opacity={0.2}
              strokeDasharray="2,2"
            />
          );
        })}

        {/* Valori della scala verticale */}
        {(() => {
          const seenLabels = new Set<string>();
          return scaleValues.map((value, index) => {
            const label = formatValue(value);
            if (seenLabels.has(label)) return null;
            seenLabels.add(label);

            const normalizedValue = range > 0 ? ((value - min) / range) : 0.5;
            const y = PADDING_TOP + CHART_AREA_HEIGHT * (1 - normalizedValue);
            return (
              <SvgText
                key={`label-${index}`}
                x={PADDING_LEFT - 8}
                y={y + 5}
                fontSize={11}
                fill={colors.textSecondary}
                textAnchor="end"
                fontWeight="500"
              >
                {label}
              </SvgText>
            );
          });
        })()}

        {/* Linea di base */}
        <Line
          x1={PADDING_LEFT}
          y1={PADDING_TOP + CHART_AREA_HEIGHT}
          x2={CHART_WIDTH - PADDING_RIGHT}
          y2={PADDING_TOP + CHART_AREA_HEIGHT}
          stroke={colors.border}
          strokeWidth={1}
          opacity={0.3}
        />

        {/* Linea del trend */}
        {points.length > 1 && pathData && (
          <Path
            d={pathData}
            fill="none"
            stroke={color}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Cerchio sul primo punto */}
        {firstPoint && (
          <Circle
            cx={firstPoint.x}
            cy={firstPoint.y}
            r={4}
            fill={color}
            opacity={0.7}
          />
        )}

        {/* Cerchio sull'ultimo punto */}
        {lastPoint && (
          <Circle
            cx={lastPoint.x}
            cy={lastPoint.y}
            r={5}
            fill={color}
          />
        )}

        {/* Etichette dei giorni sotto il grafico */}
        {dayLabels.map((label, index) => {
          if (!label) return null; // Salta le etichette vuote
          const x = PADDING_LEFT + (index * CHART_AREA_WIDTH) / (dayLabels.length - 1 || 1);
          return (
            <SvgText
              key={`day-${index}`}
              x={x}
              y={CHART_HEIGHT - 12}
              fontSize={10}
              fill={colors.textSecondary}
              textAnchor="middle"
              fontWeight="500"
            >
              {label}
            </SvgText>
          );
        })}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: CHART_WIDTH,
    height: CHART_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chart: {
    flex: 1,
  },
  emptyChart: {
    width: CHART_WIDTH,
    height: CHART_HEIGHT,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyLine: {
    width: CHART_WIDTH - 16,
    height: 2,
    borderRadius: 1,
  },
});

export default TrendChart;

