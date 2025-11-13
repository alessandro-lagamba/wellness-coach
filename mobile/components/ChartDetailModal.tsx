import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../hooks/useTranslation';
import { HealthDataSyncService } from '../services/health-data-sync.service';
import { AuthService } from '../services/auth.service';
import { TrendChart } from './TrendChart';

const { width } = Dimensions.get('window');

export type ChartType = 'steps' | 'sleepHours' | 'hrv' | 'heartRate' | 'hydration' | 'meditation';

interface ChartDetailModalProps {
  visible: boolean;
  onClose: () => void;
  chartType: ChartType;
  currentValue?: number;
  color: string;
}

export const ChartDetailModal: React.FC<ChartDetailModalProps> = ({
  visible,
  onClose,
  chartType,
  currentValue,
  color,
}) => {
  const { t } = useTranslation();
  const { colors: themeColors } = useTheme();
  const [data, setData] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [days, setDays] = useState<7 | 30>(7);

  const getChartTitle = () => {
    switch (chartType) {
      case 'steps': return t('widgets.steps');
      case 'sleepHours': return t('widgets.sleep');
      case 'hrv': return t('widgets.hrv');
      case 'heartRate': return t('home.weeklyProgress.heartRate');
      case 'hydration': return t('widgets.hydration');
      case 'meditation': return t('widgets.meditation');
      default: return '';
    }
  };

  const getChartIcon = () => {
    switch (chartType) {
      case 'steps': return 'walk';
      case 'sleepHours': return 'sleep';
      case 'hrv': return 'heart-pulse';
      case 'heartRate': return 'heart';
      case 'hydration': return 'cup-water';
      case 'meditation': return 'meditation';
      default: return 'chart-line';
    }
  };

  const formatValue = (value: number): string => {
    switch (chartType) {
      case 'steps':
        return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toString();
      case 'sleepHours':
        return `${value.toFixed(1)}h`;
      case 'hrv':
        return value >= 100 ? Math.round(value).toString() : value.toFixed(1);
      case 'heartRate':
        return `${Math.round(value)} ${t('home.bpm')}`;
      case 'hydration':
        return `${Math.round(value / 250)} ${t('home.glasses')}`;
      case 'meditation':
        return `${Math.round(value)} ${t('home.minutes')}`;
      default:
        return value.toString();
    }
  };

  const getCurrentValueLabel = (): string => {
    if (currentValue === undefined) return '';
    switch (chartType) {
      case 'steps':
        return `${currentValue.toLocaleString()} ${t('home.weeklyProgress.today')}`;
      case 'sleepHours':
        return `${(currentValue).toFixed(1)}h ${t('home.weeklyProgress.today')}`;
      case 'hrv':
        return `${currentValue >= 100 ? Math.round(currentValue) : (Math.round(currentValue * 10) / 10)} ${t('home.weeklyProgress.current')}`;
      case 'heartRate':
        return `${Math.round(currentValue)} ${t('home.bpm')} ${t('home.weeklyProgress.current')}`;
      case 'hydration':
        return `${Math.round(currentValue / 250)} ${t('home.glasses')} (${(currentValue / 1000).toFixed(1)} L)`;
      case 'meditation':
        return `${Math.round(currentValue)} ${t('home.minutes')} ${t('home.weeklyProgress.today')}`;
      default:
        return '';
    }
  };

  useEffect(() => {
    if (visible) {
      loadChartData();
    }
  }, [visible, days]);

  const loadChartData = async () => {
    try {
      setLoading(true);
      const currentUser = await AuthService.getCurrentUser();
      if (!currentUser?.id) return;

      const syncService = HealthDataSyncService.getInstance();
      const trendData = await syncService.getTrendData(currentUser.id, days);

      switch (chartType) {
        case 'steps':
          setData(trendData.steps);
          break;
        case 'sleepHours':
          setData(trendData.sleepHours);
          break;
        case 'hrv':
          setData(trendData.hrv);
          break;
        case 'heartRate':
          setData(trendData.heartRate);
          break;
      case 'hydration':
        // I dati dal database sono in ml, convertiamo in bicchieri per il grafico
        setData(trendData.hydration.map(v => Math.round(v / 250)));
        break;
        case 'meditation':
          setData(trendData.meditation);
          break;
      }
    } catch (error) {
      console.error('Error loading chart data:', error);
    } finally {
      setLoading(false);
    }
  };

  const maxValue = data.length > 0 ? Math.max(...data, currentValue || 0, 1) : (currentValue || 100);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={[styles.modalContent, { backgroundColor: themeColors.surface }]}>
          <LinearGradient
            colors={[color + '20', color + '10']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            <View style={styles.headerContent}>
              <View style={styles.headerLeft}>
                <MaterialCommunityIcons name={getChartIcon() as any} size={28} color={color} />
                <View style={styles.headerText}>
                  <Text style={[styles.title, { color: themeColors.text }]}>{getChartTitle()}</Text>
                  {currentValue !== undefined && (
                    <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>
                      {getCurrentValueLabel()}
                    </Text>
                  )}
                </View>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <MaterialCommunityIcons name="close" size={24} color={themeColors.text} />
              </TouchableOpacity>
            </View>
          </LinearGradient>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Period selector */}
            <View style={styles.periodSelector}>
              <TouchableOpacity
                style={[
                  styles.periodButton,
                  days === 7 && styles.periodButtonActive,
                  { backgroundColor: days === 7 ? color + '20' : themeColors.surfaceMuted }
                ]}
                onPress={() => setDays(7)}
              >
                <Text style={[
                  styles.periodButtonText,
                  { color: days === 7 ? color : themeColors.textSecondary }
                ]}>
                  {t('home.weeklyProgress.week', { count: 1 }) || '7 giorni'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.periodButton,
                  days === 30 && styles.periodButtonActive,
                  { backgroundColor: days === 30 ? color + '20' : themeColors.surfaceMuted }
                ]}
                onPress={() => setDays(30)}
              >
                <Text style={[
                  styles.periodButtonText,
                  { color: days === 30 ? color : themeColors.textSecondary }
                ]}>
                  {t('home.weeklyProgress.month', { count: 1 }) || '30 giorni'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Chart */}
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={color} />
                <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>
                  {t('common.loading')}
                </Text>
              </View>
            ) : (
              <View style={styles.chartContainer}>
                <TrendChart
                  data={data}
                  color={color}
                  maxValue={maxValue}
                  formatValue={formatValue}
                  days={days}
                />
              </View>
            )}

            {/* Stats */}
            {data.length > 0 && (
              <View style={styles.statsContainer}>
                <View style={[styles.statCard, { backgroundColor: themeColors.surfaceElevated, borderColor: themeColors.border }]}>
                  <Text style={[styles.statLabel, { color: themeColors.textSecondary }]}>
                    {t('home.weeklyProgress.average') || 'Media'}
                  </Text>
                  <Text style={[styles.statValue, { color: themeColors.text }]}>
                    {formatValue(data.reduce((a, b) => a + b, 0) / data.length)}
                  </Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: themeColors.surfaceElevated, borderColor: themeColors.border }]}>
                  <Text style={[styles.statLabel, { color: themeColors.textSecondary }]}>
                    {t('home.weeklyProgress.max') || 'Massimo'}
                  </Text>
                  <Text style={[styles.statValue, { color: themeColors.text }]}>
                    {formatValue(Math.max(...data))}
                  </Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: themeColors.surfaceElevated, borderColor: themeColors.border }]}>
                  <Text style={[styles.statLabel, { color: themeColors.textSecondary }]}>
                    {t('home.weeklyProgress.min') || 'Minimo'}
                  </Text>
                  <Text style={[styles.statValue, { color: themeColors.text }]}>
                    {formatValue(Math.min(...data.filter(v => v > 0)))}
                  </Text>
                </View>
              </View>
            )}
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
  periodSelector: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  periodButtonActive: {
    borderWidth: 2,
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: '600',
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
  chartContainer: {
    marginBottom: 24,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
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
});

export default ChartDetailModal;

