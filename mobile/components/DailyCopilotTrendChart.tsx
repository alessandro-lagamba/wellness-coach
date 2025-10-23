import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

interface TrendData {
  date: string;
  score: number;
  mood: number;
}

interface DailyCopilotTrendChartProps {
  data: TrendData[];
  loading?: boolean;
}

export const DailyCopilotTrendChart: React.FC<DailyCopilotTrendChartProps> = ({
  data,
  loading = false,
}) => {
  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <MaterialCommunityIcons name="chart-line" size={24} color="#8b5cf6" />
          <Text style={styles.title}>Trend Ultimi 14 Giorni</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Caricamento dati...</Text>
        </View>
      </View>
    );
  }

  if (!data || data.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <MaterialCommunityIcons name="chart-line" size={24} color="#8b5cf6" />
          <Text style={styles.title}>Trend Ultimi 14 Giorni</Text>
        </View>
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="chart-line-variant" size={48} color="#9ca3af" />
          <Text style={styles.emptyText}>Nessun dato disponibile</Text>
          <Text style={styles.emptySubtext}>I trend appariranno dopo alcuni giorni di utilizzo</Text>
        </View>
      </View>
    );
  }

  // Prepara i dati per il grafico
  const chartData = {
    labels: data.map(item => {
      const date = new Date(item.date);
      return `${date.getDate()}/${date.getMonth() + 1}`;
    }),
    datasets: [
      {
        data: data.map(item => item.score),
        color: (opacity = 1) => `rgba(139, 92, 246, ${opacity})`, // Purple
        strokeWidth: 3,
      },
      {
        data: data.map(item => item.mood * 20), // Scale mood 1-5 to 0-100
        color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`, // Green
        strokeWidth: 2,
      },
    ],
  };

  const chartConfig = {
    backgroundColor: '#ffffff',
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '4',
      strokeWidth: '2',
      stroke: '#8b5cf6',
    },
    propsForBackgroundLines: {
      strokeDasharray: '',
      stroke: '#e5e7eb',
      strokeWidth: 1,
    },
  };

  // Calcola statistiche
  const avgScore = data.reduce((sum, item) => sum + item.score, 0) / data.length;
  const avgMood = data.reduce((sum, item) => sum + item.mood, 0) / data.length;
  const trend = data.length > 1 ? 
    (data[data.length - 1].score - data[0].score) : 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="chart-line" size={24} color="#8b5cf6" />
        <Text style={styles.title}>Trend Ultimi 14 Giorni</Text>
      </View>

      {/* Statistiche */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{Math.round(avgScore)}</Text>
          <Text style={styles.statLabel}>Score Medio</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{avgMood.toFixed(1)}</Text>
          <Text style={styles.statLabel}>Mood Medio</Text>
        </View>
        <View style={styles.statItem}>
          <MaterialCommunityIcons 
            name={trend >= 0 ? "trending-up" : "trending-down"} 
            size={20} 
            color={trend >= 0 ? "#10b981" : "#ef4444"} 
          />
          <Text style={[styles.statLabel, { color: trend >= 0 ? "#10b981" : "#ef4444" }]}>
            {trend >= 0 ? "In crescita" : "In calo"}
          </Text>
        </View>
      </View>

      {/* Grafico */}
      <View style={styles.chartContainer}>
        <LineChart
          data={chartData}
          width={width - 40}
          height={220}
          chartConfig={chartConfig}
          bezier
          style={styles.chart}
          withDots={true}
          withShadow={false}
          withScrollableDot={false}
        />
      </View>

      {/* Legenda */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: '#8b5cf6' }]} />
          <Text style={styles.legendText}>Score Generale</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: '#10b981' }]} />
          <Text style={styles.legendText}>Mood (scalato)</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  loadingContainer: {
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
  },
  emptyContainer: {
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
    paddingVertical: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
  },
  statItem: {
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  chartContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  chart: {
    borderRadius: 16,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
});

export default DailyCopilotTrendChart;

