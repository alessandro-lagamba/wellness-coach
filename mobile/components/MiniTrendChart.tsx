import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Circle, Line, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../contexts/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = 320; // Aumentato da 300 a 320
const CHART_HEIGHT = 150; // Aumentato da 130 a 150
const PADDING_TOP = 8;
const PADDING_BOTTOM = 24; // Spazio per le etichette dei giorni
const PADDING_LEFT = 32; // Spazio per i valori verticali
const PADDING_RIGHT = 8;
const CHART_AREA_WIDTH = CHART_WIDTH - PADDING_LEFT - PADDING_RIGHT;
const CHART_AREA_HEIGHT = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM;

interface MiniTrendChartProps {
  data: number[];
  color?: string;
  maxValue?: number;
  formatValue?: (value: number) => string;
}

export const MiniTrendChart: React.FC<MiniTrendChartProps> = ({
  data,
  color = '#10b981',
  maxValue,
  formatValue = (v) => v.toLocaleString(),
}) => {
  const { colors } = useTheme();
  
  // Genera le etichette dei giorni (ultimi 7 giorni)
  const getDayLabels = (): string[] => {
    const labels: string[] = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dayName = date.toLocaleDateString('it-IT', { weekday: 'short' });
      labels.push(dayName.charAt(0).toUpperCase() + dayName.slice(1, 3));
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

  // Normalizza i dati per il grafico (assicurati che siano 7 valori)
  let normalizedData = [...data];
  while (normalizedData.length < 7) {
    normalizedData.unshift(0);
  }
  normalizedData = normalizedData.slice(-7); // Prendi solo gli ultimi 7

  normalizedData = normalizedData.map((value) => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return 0;
    return value;
  });

  // 🔥 FIX: Calcola il max reale dai dati (per normalizzazione corretta)
  const dataMax = normalizedData.length > 0 ? Math.max(...normalizedData) : 0;
  // 🔥 FIX: Usa il max reale per normalizzare i punti, così i valori sono posizionati correttamente
  // maxValue viene usato solo per le etichette della scala (per avere valori "puliti")
  const maxForNormalization = dataMax > 0 ? dataMax : 1; // Usa sempre il max reale per normalizzare
  const maxForLabels = maxValue && maxValue >= dataMax ? maxValue : (dataMax > 0 ? dataMax : 1); // Usa maxValue arrotondato per le etichette
  const min = 0; // Sempre inizia da 0 per tutti i grafici
  const range = maxForNormalization - min || 1;

  // Calcola i valori per la scala verticale (3 valori: max, medio, min)
  // 🔥 FIX: Usa maxForLabels per le etichette (valori "puliti"), ma normalizza con maxForNormalization
  const scaleValues = [
    maxForLabels,
    maxForLabels * 0.5,
    min,
  ].filter(v => v >= 0);

  // Calcola i punti del grafico
  // 🔥 FIX: Normalizzazione con max reale per posizionamento corretto
  const points: { x: number; y: number; value: number }[] = normalizedData.map((value, index) => {
    const x = PADDING_LEFT + (index * CHART_AREA_WIDTH) / (normalizedData.length - 1 || 1);
    // Inverti Y perché SVG ha Y=0 in alto
    // Usa maxForNormalization (max reale) per normalizzare, così i valori sono posizionati correttamente
    const normalizedValue = range > 0 ? (value / maxForNormalization) : 0;
    // Clamp tra 0 e 1 per evitare valori fuori range
    const clampedValue = Math.max(0, Math.min(1, normalizedValue));
    const y = PADDING_TOP + CHART_AREA_HEIGHT * (1 - clampedValue);
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
          // 🔥 FIX: Normalizza le etichette rispetto al max reale per posizionamento corretto
          // Se value > maxForNormalization, posiziona al top (1.0)
          const normalizedValue = value <= maxForNormalization 
            ? (value / maxForNormalization) 
            : 1.0;
          const clampedValue = Math.max(0, Math.min(1, normalizedValue));
          const y = PADDING_TOP + CHART_AREA_HEIGHT * (1 - clampedValue);
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
        {scaleValues.map((value, index) => {
          // 🔥 FIX: Normalizza le etichette rispetto al max reale per posizionamento corretto
          // Se value > maxForNormalization, posiziona al top (1.0)
          const normalizedValue = value <= maxForNormalization 
            ? (value / maxForNormalization) 
            : 1.0;
          const clampedValue = Math.max(0, Math.min(1, normalizedValue));
          const y = PADDING_TOP + CHART_AREA_HEIGHT * (1 - clampedValue);
          return (
            <SvgText
              key={`label-${index}`}
              x={PADDING_LEFT - 4}
              y={y + 4}
              fontSize={9}
              fill={colors.textSecondary}
              textAnchor="end"
            >
              {formatValue(value)}
            </SvgText>
          );
        })}

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
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        
        {/* Cerchio sul primo punto */}
        {firstPoint && (
          <Circle
            cx={firstPoint.x}
            cy={firstPoint.y}
            r={3.5}
            fill={color}
            opacity={0.7}
          />
        )}
        
        {/* Cerchio sull'ultimo punto */}
        {lastPoint && (
          <Circle
            cx={lastPoint.x}
            cy={lastPoint.y}
            r={4.5}
            fill={color}
          />
        )}

        {/* Etichette dei giorni sotto il grafico */}
        {dayLabels.map((label, index) => {
          const x = PADDING_LEFT + (index * CHART_AREA_WIDTH) / (dayLabels.length - 1 || 1);
          return (
            <SvgText
              key={`day-${index}`}
              x={x}
              y={CHART_HEIGHT - 8}
              fontSize={9}
              fill={colors.textSecondary}
              textAnchor="middle"
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

export default MiniTrendChart;

