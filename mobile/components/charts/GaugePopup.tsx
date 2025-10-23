import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop, Text as SvgText } from 'react-native-svg';
import { MetricsService } from '../../services/metrics.service';
import { ActionsService } from '../../services/actions.service';

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
  // Calcola bucket e trend personalizzato
  const getBucketAndTrend = () => {
    if (!metric) return { bucket: null, trendInfo: null, action: null };
    
    try {
      let bucket, trendInfo, action;
      
      if (metric === 'valence' || metric === 'arousal') {
        bucket = MetricsService.getEmotionBucket(metric, value);
        trendInfo = MetricsService.getPersonalizedTrendForMetric(metric, value, historicalData);
        action = ActionsService.getNextBestAction(metric, value, bucket);
      } else {
        bucket = MetricsService.getSkinBucket(metric, value);
        trendInfo = MetricsService.getPersonalizedTrendForMetric(metric, value, historicalData);
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
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.popupContainer}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.titleContainer}>
                <View style={styles.titleRow}>
                  {icon && (
                    <View style={[styles.iconContainer, { backgroundColor: `${color}20` }]}>
                      <MaterialCommunityIcons name={icon as any} size={24} color={color} />
                    </View>
                  )}
                  <View style={styles.titleTextContainer}>
                    <Text style={styles.title}>{label}</Text>
                    <Text style={styles.subtitle}>{subtitle}</Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <FontAwesome name="times" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Content */}
            <View style={styles.content}>
              {/* Score Section */}
              <View style={styles.scoreSection}>
                <Text style={[styles.valueText, { color }]}>{value}/{maxValue}</Text>
                {bucket && (
                  <View style={[styles.bucketBadge, { backgroundColor: `${bucket.color}20`, borderColor: `${bucket.color}40` }]}>
                    <Text style={[styles.bucketText, { color: bucket.color }]}>{bucket.label}</Text>
                  </View>
                )}
              </View>

              {/* Trend Section */}
              {trendInfo && (
                <View style={styles.trendSection}>
                  <Text style={styles.sectionTitle}>Trend vs tuo solito</Text>
                  <View style={styles.trendRow}>
                    <FontAwesome
                      name={trendInfo.trend === '↑' ? 'arrow-up' : trendInfo.trend === '↓' ? 'arrow-down' : 'arrow-right'}
                      size={16}
                      color={trendInfo.trend === '↑' ? '#10b981' : trendInfo.trend === '↓' ? '#ef4444' : '#6b7280'}
                    />
                    <Text style={styles.trendText}>{trendInfo.text}</Text>
                    {trendInfo.percentage !== 0 && (
                      <Text style={styles.trendPercentage}>{trendInfo.percentage}%</Text>
                    )}
                  </View>
                </View>
              )}

              {/* Why it matters */}
              <View style={styles.infoSection}>
                <Text style={styles.sectionTitle}>Perché è importante</Text>
                <Text style={styles.infoText}>{metricInfo.whyItMatters}</Text>
              </View>

              {/* How it works */}
              <View style={styles.infoSection}>
                <Text style={styles.sectionTitle}>Come funziona</Text>
                <Text style={styles.infoText}>{metricInfo.howItWorks}</Text>
              </View>

              {/* Examples */}
              {Object.keys(metricInfo.examples).length > 0 && (
                <View style={styles.infoSection}>
                  <Text style={styles.sectionTitle}>Esempi</Text>
                  {Object.entries(metricInfo.examples).map(([key, example]) => (
                    <View key={key} style={styles.exampleRow}>
                      <Text style={styles.exampleLabel}>{key === 'positive' || key === 'good' || key === 'balanced' ? '✓' : '⚠'}</Text>
                      <Text style={styles.exampleText}>{example}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Action Section */}
              {action && action.actionable && (
                <View style={styles.actionSection}>
                  <Text style={styles.sectionTitle}>Azione consigliata</Text>
                  <View style={styles.actionCard}>
                    <Text style={styles.actionTitle}>{action.title}</Text>
                    <Text style={styles.actionDescription}>{action.description}</Text>
                    {action.resources && action.resources.length > 0 && (
                      <View style={styles.resourcesContainer}>
                        <Text style={styles.resourcesLabel}>Risorse:</Text>
                        {action.resources.map((resource, index) => (
                          <Text key={index} style={styles.resourceItem}>• {resource}</Text>
                        ))}
                      </View>
                    )}
                  </View>
                </View>
              )}

              {/* Disclaimer */}
              <View style={styles.disclaimerSection}>
                <Text style={styles.disclaimerText}>
                  ⚠️ Valutazione cosmetica, non diagnostica. Per dubbi clinici rivolgiti a un professionista.
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  popupContainer: {
    width: width * 0.9,
    maxHeight: height * 0.8,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
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
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
  },
  closeButton: {
    padding: 8,
  },
  content: {
    gap: 20,
  },
  scoreSection: {
    alignItems: 'center',
    marginBottom: 10,
  },
  valueText: {
    fontSize: 48,
    fontWeight: '700',
    marginBottom: 10,
  },
  bucketBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  bucketText: {
    fontSize: 14,
    fontWeight: '600',
  },
  trendSection: {
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trendText: {
    fontSize: 14,
    color: '#64748b',
    flex: 1,
  },
  trendPercentage: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  infoSection: {
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },
  exampleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 4,
  },
  exampleLabel: {
    fontSize: 16,
    fontWeight: '600',
    width: 20,
  },
  exampleText: {
    fontSize: 14,
    color: '#64748b',
    flex: 1,
    lineHeight: 20,
  },
  actionSection: {
    gap: 8,
  },
  actionCard: {
    backgroundColor: '#f0f9ff',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#0ea5e9',
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0c4a6e',
    marginBottom: 4,
  },
  actionDescription: {
    fontSize: 14,
    color: '#0369a1',
    lineHeight: 20,
    marginBottom: 8,
  },
  resourcesContainer: {
    gap: 4,
  },
  resourcesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0c4a6e',
  },
  resourceItem: {
    fontSize: 12,
    color: '#0369a1',
    marginLeft: 8,
  },
  disclaimerSection: {
    backgroundColor: '#fef3c7',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  disclaimerText: {
    fontSize: 12,
    color: '#92400e',
    lineHeight: 16,
    fontStyle: 'italic',
  },
});
