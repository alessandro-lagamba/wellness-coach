import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { MaterialCommunityIcons, FontAwesome6 } from '@expo/vector-icons';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop, Text as SvgText } from 'react-native-svg';
import { MetricsService } from '../../services/metrics.service';
import { ActionsService } from '../../services/actions.service';
import { useTranslation } from '../../hooks/useTranslation'; // 🆕 i18n
import { useTheme } from '../../contexts/ThemeContext';

const { width, height } = Dimensions.get('window');

interface GaugePopupProps {
  visible: boolean;
  onClose: () => void;
  value: number;
  maxValue: number;
  label: string;
  color: string;
  subtitle: string;
  trend: number;
  description: string;
  historicalData?: Array<{ date: string; value: number }>;
  metric?: string; // 'valence', 'arousal', 'texture', 'redness', 'hydration', 'oiliness'
  icon?: string;
}

export const GaugePopup: React.FC<GaugePopupProps> = ({
  visible,
  onClose,
  value,
  maxValue,
  label,
  color,
  subtitle,
  trend,
  description,
  historicalData = [],
  metric,
  icon
}) => {
  const { t } = useTranslation(); // 🆕 i18n hook
  const { colors, mode } = useTheme();

  const isNutritionMetric = metric === 'carbohydrates' || metric === 'proteins' || metric === 'fats' || metric === 'calories';
  // Calcola bucket e trend personalizzato
  const getBucketAndTrend = () => {
    if (!metric) return { bucket: null, trendInfo: null, action: null };

    try {
      let bucket, trendInfo, action;

      // Extract historical values from historicalData (which is {date, value}[])
      const historicalValues = historicalData.map(item => item.value).filter(v => typeof v === 'number' && !isNaN(v));

      if (metric === 'valence' || metric === 'arousal') {
        bucket = MetricsService.getEmotionBucket(metric, value);
        // Use getPersonalizedTrend directly with extracted values
        trendInfo = historicalValues.length > 0
          ? MetricsService.getPersonalizedTrend(value, historicalValues)
          : { trend: '→' as const, text: 'Prima misurazione', percentage: 0 };
        action = ActionsService.getNextBestAction(metric, value, bucket);
      } else {
        bucket = MetricsService.getSkinBucket(metric, value);
        // Use getPersonalizedTrend directly with extracted values
        trendInfo = historicalValues.length > 0
          ? MetricsService.getPersonalizedTrend(value, historicalValues)
          : { trend: '→' as const, text: 'Prima misurazione', percentage: 0 };
        action = ActionsService.getNextBestAction(metric, value, bucket);
      }

      return { bucket, trendInfo, action };
    } catch (error) {
      console.warn('Error calculating bucket and trend:', error);
      return { bucket: null, trendInfo: null, action: null };
    }
  };

  const { bucket, trendInfo, action } = getBucketAndTrend();

  // Ottieni informazioni specifiche per la metrica
  const getMetricInfo = () => {
    switch (metric) {
      case 'valence':
        return {
          whyItMatters: 'Misura la positività/negatività del tuo stato emotivo.',
          howItWorks: 'Stima basata su segnali facciali (bocca/occhi/sopracciglia).',
          examples: {
            positive: 'Felice, contento, soddisfatto',
            negative: 'Triste, frustrato, deluso'
          }
        };
      case 'arousal':
        return {
          whyItMatters: "Indica quanta attivazione/energia emotiva c'è in questo momento.",
          howItWorks: 'Valutazione dell\'intensità dei segnali espressivi.',
          examples: {
            high: 'Eccitato, stressato, energico',
            low: 'Calmo, rilassato, tranquillo'
          }
        };
      case 'texture':
        return {
          whyItMatters: 'Indica uniformità e levigatezza della pelle.',
          howItWorks: 'Analisi delle irregolarità superficiali.',
          examples: {
            good: 'Pelle liscia e uniforme',
            poor: 'Pelle ruvida o irregolare'
          }
        };
      case 'redness':
        return {
          whyItMatters: 'Stima arrossamento/irritazione visibile.',
          howItWorks: 'Analisi dei segnali cromatici cutanei.',
          examples: {
            low: 'Pelle calma e uniforme',
            high: 'Pelle arrossata o irritata'
          }
        };
      case 'hydration':
        return {
          whyItMatters: "Contenuto d'acqua superficiale.",
          howItWorks: "Stima dell'idratazione da pattern cutanei.",
          examples: {
            good: 'Pelle ben idratata ed elastica',
            poor: 'Pelle secca e disidratata'
          }
        };
      case 'oiliness':
        return {
          whyItMatters: 'Equilibrio del sebo e lucidità.',
          howItWorks: 'Rilevazione della brillantezza superficiale.',
          examples: {
            balanced: 'Pelle con equilibrio sebaceo',
            excess: 'Pelle lucida o oleosa'
          }
        };
      default:
        return {
          whyItMatters: 'Metrica importante per la tua salute.',
          howItWorks: 'Analisi basata su algoritmi avanzati.',
          examples: {}
        };
    }
  };

  const metricInfo = getMetricInfo();

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.popupContainer, { backgroundColor: colors.surface, shadowColor: colors.shadowColor }]}>
          {/* Header - Fixed at top */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.titleContainer}>
              <View style={styles.titleRow}>
                {icon && (
                  <View style={[styles.iconContainer, { backgroundColor: `${color}20` }]}>
                    {icon === 'wheat-awn' ? (
                      <FontAwesome6 name="wheat-awn" size={20} color={color} />
                    ) : (
                      <MaterialCommunityIcons name={icon as any} size={24} color={color} />
                    )}
                  </View>
                )}
                <View style={styles.titleTextContainer}>
                  <Text style={[styles.title, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>{label}</Text>
                  <Text style={[styles.subtitle, { color: colors.textSecondary }]} maxFontSizeMultiplier={1.5}>{subtitle}</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <FontAwesome name="times" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Scrollable Content */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.content}>
              {/* Score Section */}
              <View style={styles.scoreSection}>
                <Text style={[styles.valueText, { color }]} adjustsFontSizeToFit numberOfLines={1}>{value}/{maxValue}</Text>
                {bucket && (
                  <View style={[styles.bucketBadge, { backgroundColor: `${bucket.color}20`, borderColor: `${bucket.color}40` }]}>
                    <Text style={[styles.bucketText, { color: bucket.color }]} maxFontSizeMultiplier={1.5}>{t(bucket.label)}</Text>
                  </View>
                )}
              </View>

              {/* Trend Section */}
              {trendInfo && (
                <View style={[styles.trendSection, { backgroundColor: colors.surfaceMuted }]}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]} maxFontSizeMultiplier={1.5}>{t('popups.gauge.trend')}</Text>
                  <View style={styles.trendRow}>
                    <FontAwesome
                      name={trendInfo.trend === '↑' ? 'arrow-up' : trendInfo.trend === '↓' ? 'arrow-down' : 'arrow-right'}
                      size={16}
                      color={trendInfo.trend === '↑' ? '#10b981' : trendInfo.trend === '↓' ? '#ef4444' : colors.textSecondary}
                    />
                    <Text style={[styles.trendText, { color: colors.textSecondary }]}>{trendInfo.text}</Text>
                    {trendInfo.percentage !== 0 && (
                      <Text style={[styles.trendPercentage, { color: colors.text }]}>{trendInfo.percentage}%</Text>
                    )}
                  </View>
                </View>
              )}

              {!isNutritionMetric && (
                <>
                  {/* Why it matters */}
                  <View style={styles.infoSection}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]} maxFontSizeMultiplier={1.5}>{t('popups.gauge.whyImportant')}</Text>
                    <Text style={[styles.infoText, { color: colors.textSecondary }]}>{metricInfo.whyItMatters}</Text>
                  </View>

                  {/* How it works */}
                  <View style={styles.infoSection}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]} maxFontSizeMultiplier={1.5}>{t('popups.gauge.howItWorks')}</Text>
                    <Text style={[styles.infoText, { color: colors.textSecondary }]}>{metricInfo.howItWorks}</Text>
                  </View>

                  {/* Examples */}
                  {Object.keys(metricInfo.examples).length > 0 && (
                    <View style={styles.infoSection}>
                      <Text style={[styles.sectionTitle, { color: colors.text }]} maxFontSizeMultiplier={1.5}>{t('popups.gauge.examples')}</Text>
                      {Object.entries(metricInfo.examples).map(([key, example], index) => (
                        <View key={index} style={styles.exampleRow}>
                          <Text style={styles.exampleIcon} maxFontSizeMultiplier={1.5}>{key === 'positive' || key === 'good' || key === 'balanced' ? '✓' : '⚠'}</Text>
                          <Text style={[styles.exampleText, { color: colors.textSecondary }]}>{example}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </>
              )}

              {/* Action Section */}
              {!isNutritionMetric && action && action.actionable && (
                <View style={styles.actionSection}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]} maxFontSizeMultiplier={1.5}>{t('popups.gauge.recommendedAction')}</Text>
                  <View style={[styles.actionCard, { backgroundColor: colors.surfaceMuted, borderLeftColor: '#0ea5e9' }]}>
                    <Text style={[styles.actionTitle, { color: colors.text }]} maxFontSizeMultiplier={1.5}>{action.title}</Text>
                    <Text style={[styles.actionDescription, { color: colors.textSecondary }]}>{action.description}</Text>
                    {action.resources && action.resources.length > 0 && (
                      <View style={styles.resourcesContainer}>
                        <Text style={[styles.resourcesLabel, { color: colors.text }]}>{t('popups.gauge.resources')}:</Text>
                        {action.resources.map((resource, index) => (
                          <Text key={index} style={[styles.resourceItem, { color: colors.textSecondary }]}>• {resource}</Text>
                        ))}
                      </View>
                    )}
                  </View>
                </View>
              )}

              {/* Disclaimer */}
              {!isNutritionMetric && (
                <View style={[styles.disclaimerSection, { backgroundColor: mode === 'dark' ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7', borderLeftColor: '#f59e0b', marginBottom: 20 }]}>
                  <Text style={[styles.disclaimerText, { color: mode === 'dark' ? colors.textSecondary : '#92400e' }]}>
                    {t('popups.gauge.disclaimer')}
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  popupContainer: {
    width: width * 0.9,
    maxHeight: height * 0.85,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
    overflow: 'hidden', // Ensure header and content stay within rounded corners
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  titleContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleTextContainer: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontFamily: 'Figtree_700Bold',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 2,
    fontFamily: 'Figtree_500Medium',
  },
  closeButton: {
    padding: 8,
    marginLeft: 8,
  },
  scrollView: {
    width: '100%',
  },
  scrollContent: {
    paddingBottom: 0,
  },
  content: {
    gap: 20,
    padding: 24,
    paddingBottom: 32,
  },
  scoreSection: {
    alignItems: 'center',
    marginBottom: 4,
  },
  valueText: {
    fontSize: 48,
    fontFamily: 'Figtree_800ExtraBold',
    marginBottom: 10,
    letterSpacing: -1,
  },
  bucketBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  bucketText: {
    fontSize: 14,
    fontFamily: 'Figtree_600SemiBold',
    textTransform: 'uppercase',
  },
  trendSection: {
    padding: 16,
    borderRadius: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Figtree_700Bold',
    marginBottom: 8,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trendText: {
    fontSize: 15,
    fontFamily: 'Figtree_500Medium',
    flex: 1,
    flexWrap: 'wrap',
  },
  trendPercentage: {
    fontSize: 15,
    fontFamily: 'Figtree_700Bold',
  },
  infoSection: {
    gap: 8,
  },
  infoText: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: 'Figtree_500Medium',
  },
  exampleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 6,
  },
  exampleIcon: {
    fontSize: 16,
    fontFamily: 'Figtree_700Bold',
    width: 16,
    textAlign: 'center',
  },
  exampleText: {
    fontSize: 15,
    flex: 1,
    lineHeight: 22,
    fontFamily: 'Figtree_500Medium',
  },
  actionSection: {
    gap: 8,
  },
  actionCard: {
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
  },
  actionTitle: {
    fontSize: 16,
    fontFamily: 'Figtree_700Bold',
    marginBottom: 6,
  },
  actionDescription: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 10,
    fontFamily: 'Figtree_500Medium',
  },
  resourcesContainer: {
    gap: 4,
  },
  resourcesLabel: {
    fontSize: 12,
    fontFamily: 'Figtree_600SemiBold',
  },
  resourceItem: {
    fontSize: 12,
    marginLeft: 8,
    fontFamily: 'Figtree_500Medium',
  },
  disclaimerSection: {
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
  },
  disclaimerText: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Figtree_500Medium',
    fontStyle: 'italic',
  },
});
