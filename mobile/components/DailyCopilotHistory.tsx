import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import DailyCopilotService from '../services/daily-copilot.service';
import { AuthService } from '../services/auth.service';
import { DailyCopilotTrendChart } from './DailyCopilotTrendChart';

interface HistoryRecord {
  id: string;
  date: string;
  overall_score: number;
  mood: number;
  sleep_hours: number;
  sleep_quality: number;
  summary: {
    focus: string;
    energy: string;
    recovery: string;
    mood: string;
  };
}

interface DailyCopilotHistoryProps {
  onClose: () => void;
}

export const DailyCopilotHistory: React.FC<DailyCopilotHistoryProps> = ({
  onClose,
}) => {
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [trendData, setTrendData] = useState<{ date: string; score: number; mood: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadHistoryData();
  }, []);

  const loadHistoryData = async () => {
    try {
      setLoading(true);
      setError(null);

      const currentUser = await AuthService.getCurrentUser();
      if (!currentUser?.id) {
        setError('Utente non autenticato');
        return;
      }

      const dailyCopilotService = DailyCopilotService.getInstance();

      // Carica storico
      const historyResult = await dailyCopilotService.getCopilotHistory(currentUser.id, 30);
      if (historyResult.success && historyResult.data) {
        setHistory(historyResult.data);
      }

      // Carica dati per trend
      const trendResult = await dailyCopilotService.getTrendData(currentUser.id, 14);
      if (trendResult.success && trendResult.data) {
        setTrendData(trendResult.data);
      }

    } catch (err) {
      console.error('Error loading history data:', err);
      setError('Errore nel caricamento dei dati');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Oggi';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Ieri';
    } else {
      return date.toLocaleDateString('it-IT', { 
        day: 'numeric', 
        month: 'short' 
      });
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#10b981';
    if (score >= 60) return '#f59e0b';
    return '#ef4444';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Eccellente';
    if (score >= 60) return 'Buono';
    return 'Da migliorare';
  };

  const getMoodIcon = (mood: number) => {
    if (mood >= 4) return 'emoticon-happy';
    if (mood >= 3) return 'emoticon-neutral';
    return 'emoticon-sad';
  };

  const getMoodColor = (mood: number) => {
    if (mood >= 4) return '#10b981';
    if (mood >= 3) return '#f59e0b';
    return '#ef4444';
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Storico Daily Copilot</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <MaterialCommunityIcons name="close" size={24} color="#6b7280" />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8b5cf6" />
          <Text style={styles.loadingText}>Caricamento storico...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Storico Daily Copilot</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <MaterialCommunityIcons name="close" size={24} color="#6b7280" />
          </TouchableOpacity>
        </View>
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons name="alert-circle" size={48} color="#ef4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadHistoryData}>
            <Text style={styles.retryButtonText}>Riprova</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Storico Daily Copilot</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <MaterialCommunityIcons name="close" size={24} color="#6b7280" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Grafico dei trend */}
        <DailyCopilotTrendChart data={trendData} loading={loading} />

        {/* Lista storico */}
        <View style={styles.historySection}>
          <Text style={styles.sectionTitle}>Storico Giornaliero</Text>
          
          {history.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="history" size={48} color="#9ca3af" />
              <Text style={styles.emptyText}>Nessun storico disponibile</Text>
              <Text style={styles.emptySubtext}>I dati appariranno dopo alcuni giorni di utilizzo</Text>
            </View>
          ) : (
            history.map((record, index) => (
              <View key={record.id} style={styles.historyItem}>
                <View style={styles.historyHeader}>
                  <Text style={styles.historyDate}>{formatDate(record.date)}</Text>
                  <View style={styles.scoreContainer}>
                    <Text style={[styles.scoreValue, { color: getScoreColor(record.overall_score) }]}>
                      {record.overall_score}
                    </Text>
                    <Text style={styles.scoreLabel}>/100</Text>
                  </View>
                </View>

                <View style={styles.historyMetrics}>
                  <View style={styles.metricItem}>
                    <MaterialCommunityIcons 
                      name={getMoodIcon(record.mood)} 
                      size={16} 
                      color={getMoodColor(record.mood)} 
                    />
                    <Text style={styles.metricText}>Mood {record.mood}/5</Text>
                  </View>
                  
                  <View style={styles.metricItem}>
                    <MaterialCommunityIcons name="bed" size={16} color="#3b82f6" />
                    <Text style={styles.metricText}>{record.sleep_hours}h</Text>
                  </View>
                  
                  <View style={styles.metricItem}>
                    <MaterialCommunityIcons name="star" size={16} color="#f59e0b" />
                    <Text style={styles.metricText}>{record.sleep_quality}%</Text>
                  </View>
                </View>

                <View style={styles.focusContainer}>
                  <Text style={styles.focusLabel}>Focus:</Text>
                  <Text style={styles.focusText}>{record.summary.focus}</Text>
                </View>

                <View style={styles.statusContainer}>
                  <View style={[styles.statusBadge, { backgroundColor: getScoreColor(record.overall_score) + '20' }]}>
                    <Text style={[styles.statusText, { color: getScoreColor(record.overall_score) }]}>
                      {getScoreLabel(record.overall_score)}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 40,
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#8b5cf6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  historySection: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
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
  historyItem: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  historyDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  scoreValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  scoreLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginLeft: 2,
  },
  historyMetrics: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metricText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  focusContainer: {
    marginBottom: 12,
  },
  focusLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
    marginBottom: 4,
  },
  focusText: {
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '500',
  },
  statusContainer: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
});

export default DailyCopilotHistory;

