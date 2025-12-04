import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FoodAnalysisService } from '../services/food-analysis.service';
import { FoodAnalysis } from '../lib/supabase';
import { AuthService } from '../services/auth.service';
import * as Haptics from 'expo-haptics';

const { width, height } = Dimensions.get('window');

interface CalorieHistoryModalProps {
  visible: boolean;
  onClose: () => void;
  currentCalories: number;
  targetCalories: number;
  dietGoal?: 'maintenance' | 'weight_loss' | 'bulk';
}

interface DayData {
  date: string;
  calories: number;
  label: string;
}

export const CalorieHistoryModal: React.FC<CalorieHistoryModalProps> = ({
  visible,
  onClose,
  currentCalories,
  targetCalories,
  dietGoal = 'maintenance',
}) => {
  const { colors, mode } = useTheme();
  const isDark = mode === 'dark';
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [historyData, setHistoryData] = useState<DayData[]>([]);
  const [showBMIInfo, setShowBMIInfo] = useState(false);
  const [weeklyStats, setWeeklyStats] = useState({
    avgCalories: 0,
    totalDeficit: 0,
    totalSurplus: 0,
    daysOnTarget: 0,
    trend: 0,
  });

  // Load calorie history
  useEffect(() => {
    if (visible) {
      loadCalorieHistory();
    }
  }, [visible]);

  const loadCalorieHistory = async () => {
    setLoading(true);
    try {
      const currentUser = await AuthService.getCurrentUser();
      if (!currentUser?.id) {
        setLoading(false);
        return;
      }

      // Get last 14 days of food analysis
      console.log('[CalorieHistory] Fetching recent analyses for user:', currentUser.id);
      const sessions = await FoodAnalysisService.getRecentAnalyses(currentUser.id, 30);
      console.log('[CalorieHistory] Fetched sessions count:', sessions.length);

      // Group by date and calculate daily totals
      const dailyTotals = new Map<string, number>();
      const today = new Date();

      // Initialize last 14 days
      for (let i = 13; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        dailyTotals.set(dateStr, 0);
      }

      // Sum up calories for each day
      sessions.forEach((session: FoodAnalysis) => {
        const dateStr = new Date(session.created_at).toISOString().split('T')[0];
        if (dailyTotals.has(dateStr)) {
          dailyTotals.set(dateStr, (dailyTotals.get(dateStr) || 0) + Math.round(session.calories || 0));
        }
      });

      // Convert to array
      const data: DayData[] = [];
      dailyTotals.forEach((calories, date) => {
        const d = new Date(date);
        data.push({
          date,
          calories,
          label: `${d.getDate()}/${d.getMonth() + 1}`,
        });
      });

      setHistoryData(data);

      // Calculate weekly stats
      const last7Days = data.slice(-7);
      const totalCals = last7Days.reduce((sum, d) => sum + d.calories, 0);
      const avgCals = totalCals / 7;

      let deficit = 0;
      let surplus = 0;
      let onTarget = 0;

      last7Days.forEach(day => {
        const diff = day.calories - targetCalories;
        if (Math.abs(diff) <= targetCalories * 0.1) {
          onTarget++;
        } else if (diff > 0) {
          surplus += diff;
        } else {
          deficit += Math.abs(diff);
        }
      });

      // Calculate trend (last 7 vs previous 7)
      const prev7Days = data.slice(-14, -7);
      const prev7Total = prev7Days.reduce((sum, d) => sum + d.calories, 0);
      const trend = totalCals - prev7Total;

      setWeeklyStats({
        avgCalories: Math.round(avgCals),
        totalDeficit: Math.round(deficit),
        totalSurplus: Math.round(surplus),
        daysOnTarget: onTarget,
        trend: Math.round(trend / 7),
      });

    } catch (error) {
      console.error('Error loading calorie history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  // Prepare chart data
  const chartData = {
    labels: historyData.map(d => d.label),
    datasets: [
      {
        data: historyData.map(d => d.calories || 1), // Avoid 0 for chart scaling
        color: (opacity = 1) => `rgba(239, 68, 68, ${opacity})`, // Red for calories
        strokeWidth: 3,
      },
      {
        data: historyData.map(() => targetCalories), // Target line
        color: (opacity = 1) => `rgba(156, 163, 175, ${opacity})`, // Gray for target
        strokeWidth: 2,
      },
    ],
    legend: [t('analysis.food.calorieHistory.consumed'), t('analysis.food.calorieHistory.target')],
  };

  const chartConfig = {
    backgroundColor: colors.surface,
    backgroundGradientFrom: colors.surface,
    backgroundGradientTo: colors.surface,
    decimalPlaces: 0,
    color: (opacity = 1) => isDark ? `rgba(255, 255, 255, ${opacity})` : `rgba(0, 0, 0, ${opacity})`,
    labelColor: (opacity = 1) => isDark ? `rgba(255, 255, 255, ${opacity * 0.7})` : `rgba(0, 0, 0, ${opacity * 0.7})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '3',
      strokeWidth: '2',
      stroke: '#ef4444',
    },
    propsForBackgroundLines: {
      strokeDasharray: '5, 5',
      stroke: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
      strokeWidth: 1,
    },
  };

  // Calculate balance status
  const getDietGoalLabel = () => {
    switch (dietGoal) {
      case 'weight_loss': return t('analysis.food.goals.dietGoals.weight_loss');
      case 'bulk': return t('analysis.food.goals.dietGoals.bulk');
      default: return t('analysis.food.goals.dietGoals.maintenance');
    }
  };

  const getBalanceStatus = () => {
    const diff = currentCalories - targetCalories;
    const percent = Math.abs(Math.round((diff / targetCalories) * 100));

    if (Math.abs(diff) <= targetCalories * 0.05) {
      return { label: t('analysis.food.calorieHistory.onTarget'), color: '#10b981', icon: 'check-circle' };
    } else if (diff > 0) {
      return { label: `+${Math.round(diff)} kcal (${percent}% ${t('analysis.food.calorieHistory.surplus')})`, color: '#ef4444', icon: 'arrow-up-circle' };
    } else {
      return { label: `${Math.round(diff)} kcal (${percent}% ${t('analysis.food.calorieHistory.deficit')})`, color: '#3b82f6', icon: 'arrow-down-circle' };
    }
  };

  const balanceStatus = getBalanceStatus();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <BlurView intensity={20} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'}>
        <View style={[styles.overlay, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <View style={[styles.container, { backgroundColor: colors.surface }]}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <MaterialCommunityIcons name="chart-line" size={28} color="#ef4444" />
                <Text style={[styles.title, { color: colors.text }]}>
                  {t('analysis.food.calorieHistory.title')}
                </Text>
              </View>
              <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                <MaterialCommunityIcons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.accent} />
                  <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                    {t('common.loading')}
                  </Text>
                </View>
              ) : (
                <>
                  {/* Today's Status */}
                  <View style={[styles.statusCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
                    <View style={styles.statusHeader}>
                      <Text style={[styles.statusTitle, { color: colors.text }]}>
                        {t('analysis.food.calorieHistory.todayStatus')}
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <View style={[styles.dietBadge, { backgroundColor: colors.accent + '20' }]}>
                          <Text style={[styles.dietBadgeText, { color: colors.accent }]}>
                            {getDietGoalLabel()}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => setShowBMIInfo(true)}
                          style={[styles.infoButton, { backgroundColor: colors.surfaceMuted }]}
                        >
                          <MaterialCommunityIcons name="information-variant" size={16} color={colors.textSecondary} />
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={styles.calorieDisplay}>
                      <Text style={[styles.calorieValue, { color: colors.text }]}>
                        {Math.round(currentCalories)}
                      </Text>
                      <Text style={[styles.calorieTarget, { color: colors.textSecondary }]}>
                        / {targetCalories} kcal
                      </Text>
                    </View>

                    <View style={[styles.balanceRow, { backgroundColor: balanceStatus.color + '15' }]}>
                      <MaterialCommunityIcons name={balanceStatus.icon as any} size={20} color={balanceStatus.color} />
                      <Text style={[styles.balanceText, { color: balanceStatus.color }]}>
                        {balanceStatus.label}
                      </Text>
                    </View>
                  </View>

                  {/* Chart */}
                  <View style={styles.chartSection}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>
                      {t('analysis.food.calorieHistory.last14Days')}
                    </Text>

                    {historyData.length > 0 ? (
                      <View style={styles.chartContainer}>
                        <LineChart
                          data={chartData}
                          width={width - 72}
                          height={220}
                          chartConfig={chartConfig}
                          bezier
                          style={styles.chart}
                          withDots={true}
                          withShadow={false}
                          withScrollableDot={false}
                          withVerticalLines={false}
                        />
                      </View>
                    ) : (
                      <View style={[styles.emptyChart, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
                        <MaterialCommunityIcons name="chart-line-variant" size={48} color={colors.textTertiary} />
                        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                          {t('analysis.food.calorieHistory.noData')}
                        </Text>
                      </View>
                    )}

                    {/* Legend */}
                    <View style={styles.legend}>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: '#ef4444' }]} />
                        <Text style={[styles.legendText, { color: colors.textSecondary }]}>
                          {t('analysis.food.calorieHistory.consumed')}
                        </Text>
                      </View>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: '#9ca3af' }]} />
                        <Text style={[styles.legendText, { color: colors.textSecondary }]}>
                          {t('analysis.food.calorieHistory.target')}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Weekly Stats */}
                  <View style={styles.statsSection}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>
                      {t('analysis.food.calorieHistory.weeklyStats')}
                    </Text>

                    <View style={styles.statsGrid}>
                      <View style={[styles.statCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
                        <MaterialCommunityIcons name="fire" size={24} color="#ef4444" />
                        <Text style={[styles.statValue, { color: colors.text }]}>
                          {weeklyStats.avgCalories}
                        </Text>
                        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                          {t('analysis.food.calorieHistory.avgDaily')}
                        </Text>
                      </View>

                      <View style={[styles.statCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
                        <MaterialCommunityIcons name="check-circle" size={24} color="#10b981" />
                        <Text style={[styles.statValue, { color: colors.text }]}>
                          {weeklyStats.daysOnTarget}/7
                        </Text>
                        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                          {t('analysis.food.calorieHistory.daysOnTarget')}
                        </Text>
                      </View>

                      <View style={[styles.statCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
                        <MaterialCommunityIcons
                          name={weeklyStats.trend >= 0 ? 'trending-up' : 'trending-down'}
                          size={24}
                          color={weeklyStats.trend >= 0 ? '#ef4444' : '#3b82f6'}
                        />
                        <Text style={[styles.statValue, { color: colors.text }]}>
                          {weeklyStats.trend >= 0 ? '+' : ''}{weeklyStats.trend}
                        </Text>
                        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                          {t('analysis.food.calorieHistory.trend')}
                        </Text>
                      </View>
                    </View>

                    {/* Balance Summary */}
                    <View style={styles.balanceSummary}>
                      {weeklyStats.totalDeficit > 0 && (
                        <View style={[styles.balanceItem, { backgroundColor: '#3b82f6' + '15' }]}>
                          <MaterialCommunityIcons name="arrow-down-circle" size={20} color="#3b82f6" />
                          <Text style={[styles.balanceItemText, { color: colors.text }]}>
                            <Text style={{ fontWeight: '700', color: '#3b82f6' }}>{weeklyStats.totalDeficit} kcal</Text>
                            {' '}{t('analysis.food.calorieHistory.weeklyDeficit')}
                          </Text>
                        </View>
                      )}

                      {weeklyStats.totalSurplus > 0 && (
                        <View style={[styles.balanceItem, { backgroundColor: '#ef4444' + '15' }]}>
                          <MaterialCommunityIcons name="arrow-up-circle" size={20} color="#ef4444" />
                          <Text style={[styles.balanceItemText, { color: colors.text }]}>
                            <Text style={{ fontWeight: '700', color: '#ef4444' }}>{weeklyStats.totalSurplus} kcal</Text>
                            {' '}{t('analysis.food.calorieHistory.weeklySurplus')}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Tips */}
                  <View style={[styles.tipsSection, { backgroundColor: isDark ? 'rgba(139, 92, 246, 0.1)' : 'rgba(139, 92, 246, 0.05)' }]}>
                    <MaterialCommunityIcons name="lightbulb-outline" size={24} color="#8b5cf6" />
                    <View style={styles.tipsContent}>
                      <Text style={[styles.tipsTitle, { color: colors.text }]}>
                        {t('analysis.food.calorieHistory.tipTitle')}
                      </Text>
                      <Text style={[styles.tipsText, { color: colors.textSecondary }]}>
                        {dietGoal === 'weight_loss'
                          ? t('analysis.food.calorieHistory.tipWeightLoss')
                          : dietGoal === 'bulk'
                            ? t('analysis.food.calorieHistory.tipBulk')
                            : t('analysis.food.calorieHistory.tipMaintenance')
                        }
                      </Text>
                    </View>
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </BlurView>

      {/* BMI Info Modal */}
      <Modal
        visible={showBMIInfo}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBMIInfo(false)}
      >
        <View style={styles.bmiModalOverlay}>
          <View style={[styles.bmiModalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.bmiHeader}>
              <Text style={[styles.bmiTitle, { color: colors.text }]}>BMI Categories</Text>
              <TouchableOpacity onPress={() => setShowBMIInfo(false)}>
                <MaterialCommunityIcons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.bmiTable}>
              <View style={[styles.bmiRow, styles.bmiHeaderRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.bmiCol, { color: colors.textSecondary }]}>Category</Text>
                <Text style={[styles.bmiCol, { color: colors.textSecondary }]}>BMI Range</Text>
              </View>
              <View style={[styles.bmiRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.bmiCol, { color: '#3b82f6' }]}>Underweight</Text>
                <Text style={[styles.bmiCol, { color: colors.text }]}>&lt; 18.5</Text>
              </View>
              <View style={[styles.bmiRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.bmiCol, { color: '#10b981' }]}>Normal weight</Text>
                <Text style={[styles.bmiCol, { color: colors.text }]}>18.5 - 24.9</Text>
              </View>
              <View style={[styles.bmiRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.bmiCol, { color: '#f59e0b' }]}>Overweight</Text>
                <Text style={[styles.bmiCol, { color: colors.text }]}>25 - 29.9</Text>
              </View>
              <View style={[styles.bmiRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.bmiCol, { color: '#ef4444' }]}>Obesity</Text>
                <Text style={[styles.bmiCol, { color: colors.text }]}>&ge; 30</Text>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)', // Darker overlay for better visibility
    justifyContent: 'flex-end',
  },
  container: {
    maxHeight: height * 0.9,
    minHeight: height * 0.7, // Make it more prominent (70% of screen)
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: 20,

  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
  },
  statusCard: {
    margin: 20,
    padding: 20,
    borderRadius: 16,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  dietBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  dietBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  calorieDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 16,
  },
  calorieValue: {
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: -2,
  },
  calorieTarget: {
    fontSize: 20,
    fontWeight: '500',
    marginLeft: 8,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  balanceText: {
    fontSize: 14,
    fontWeight: '600',
  },
  chartSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  chartContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  chart: {
    borderRadius: 16,
  },
  emptyChart: {
    height: 200,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
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
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    fontWeight: '500',
  },
  statsSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    gap: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
  balanceSummary: {
    marginTop: 16,
    gap: 8,
  },
  balanceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
  },
  balanceItemText: {
    fontSize: 14,
    flex: 1,
  },
  tipsSection: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 16,
    borderRadius: 16,
    gap: 12,
  },
  tipsContent: {
    flex: 1,
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  tipsText: {
    fontSize: 13,
    lineHeight: 18,
  },
  infoButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bmiModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  bmiModalContent: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 10,
  },
  bmiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  bmiTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  bmiTable: {
    gap: 0,
  },
  bmiRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  bmiHeaderRow: {
    paddingVertical: 8,
  },
  bmiCol: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
});

export default CalorieHistoryModal;


