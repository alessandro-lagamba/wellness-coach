import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  withTiming,
  withSpring,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import { UnifiedAnalysisService } from '../services/unified-analysis.service';
import { BACKEND_URL } from '../constants/env';
import { AnalysisIntentService } from '../services/analysis-intent.service';
import { AIContextService } from '../services/ai-context.service';
import { AuthService } from '../services/auth.service';
import { DetailedAnalysisDBService } from '../services/detailed-analysis-db.service';
import { useTranslation } from '../hooks/useTranslation'; // 🆕 i18n

const { width, height } = Dimensions.get('window');

interface DetailedAnalysisPopupProps {
  visible: boolean;
  onClose: () => void;
  analysisType: 'emotion' | 'skin' | 'food';
  analysisData?: any;
}

export const DetailedAnalysisPopup: React.FC<DetailedAnalysisPopupProps> = ({
  visible,
  onClose,
  analysisType,
  analysisData,
}) => {
  const { t } = useTranslation(); // 🆕 i18n hook
  const [analysis, setAnalysis] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analysisService = UnifiedAnalysisService.getInstance();
  const detailedAnalysisDB = DetailedAnalysisDBService.getInstance();


  useEffect(() => {
    if (visible && analysisData) {
      loadOrGenerateDetailedAnalysis();
    } else if (visible && !analysisData) {
      setError(t('popups.detailedAnalysis.noData'));
    }
  }, [visible, analysisData]);

  const loadOrGenerateDetailedAnalysis = async () => {
    setLoading(true);
    setError(null);
    setAnalysis('');

    // Timeout di sicurezza per evitare loader infinito
    const timeoutId = setTimeout(() => {
      console.warn('⏰ Detailed analysis timeout - forcing loading to false');
      setLoading(false);
      setError(t('popups.detailedAnalysis.timeout'));
    }, 30000); // 30 secondi

    try {
      const currentUser = await AuthService.getCurrentUser();
      if (!currentUser) {
        setError(t('popups.detailedAnalysis.notAuthenticated'));
        setLoading(false);
        return;
      }

      // Prima controlla se esiste già un'analisi per oggi
      const existingAnalysis = await detailedAnalysisDB.getTodaysDetailedAnalysis(
        currentUser.id,
        analysisType
      );

      if (existingAnalysis.success && existingAnalysis.data) {
        console.log('📋 Using cached detailed analysis from database');
        clearTimeout(timeoutId);
        setAnalysis(existingAnalysis.data.ai_response);
        setLoading(false);
        return;
      }

      // Se non esiste, genera una nuova analisi
      console.log('🤖 Generating new detailed analysis');
      await generateDetailedAnalysis(true); // Skip loading state since it's already set
    } catch (error) {
      console.error('Error in loadOrGenerateDetailedAnalysis:', error);
      clearTimeout(timeoutId);
      setError(t('popups.detailedAnalysis.loadingError'));
      setLoading(false);
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const generateDetailedAnalysis = async (skipLoadingState = false) => {
    if (!skipLoadingState) {
      setLoading(true);
      setError(null);
      setAnalysis('');
    }

    try {
      console.log('🔍 Starting detailed analysis generation...');
      const userMessage = analysisType === 'emotion' 
        ? 'Fammi un\'analisi dettagliata SOLAMENTE della mia ultima analisi delle emozioni, non di tutte le analisi precedenti'
        : 'Fammi un\'analisi dettagliata SOLAMENTE della mia ultima analisi della pelle, non di tutte le analisi precedenti';

      console.log('👤 Getting current user...');
      const currentUser = await AuthService.getCurrentUser();
      console.log('👤 Current user:', currentUser?.id);
      
      const sessionId = `detailed-analysis-${Date.now()}`;
      const analysisIntent = AnalysisIntentService.detectAnalysisIntent(userMessage);
      console.log('🎯 Analysis intent detected:', analysisIntent);

      const aiContext = currentUser?.id ? await AIContextService.getCompleteContext(currentUser.id) : null;
      const userContext = aiContext ? {
        emotionHistory: aiContext.emotionHistory,
        skinHistory: aiContext.skinHistory,
        emotionTrend: aiContext.emotionTrend,
        skinTrend: aiContext.skinTrend,
        insights: aiContext.insights,
        temporalPatterns: aiContext.temporalPatterns,
        behavioralInsights: aiContext.behavioralInsights,
        contextualFactors: aiContext.contextualFactors,
        firstName: currentUser?.user_metadata?.full_name?.split(' ')[0] || currentUser?.email?.split('@')[0]?.split('.')[0] || 'Utente',
        userName: currentUser?.user_metadata?.full_name?.split(' ')[0] || currentUser?.email?.split('@')[0]?.split('.')[0] || 'Utente'
      } : {
        emotionHistory: [],
        skinHistory: [],
        emotionTrend: null,
        skinTrend: null,
        insights: [],
        temporalPatterns: null,
        behavioralInsights: null,
        contextualFactors: null,
        userName: 'Utente',
        isAnonymous: true
      };

      const emotionContext = analysisType === 'emotion' ? analysisData : undefined;
      const skinContext = analysisType === 'skin' ? analysisData : undefined;
      const foodContext = analysisType === 'food' ? analysisData : undefined;

      console.log('🌐 Making request to backend...');
      console.log('📊 Analysis data:', analysisData);
      console.log('🔗 Backend URL:', BACKEND_URL);
      
      // Test di connettività al backend
      try {
        const testResponse = await fetch(`${BACKEND_URL}/health`, { 
          method: 'GET'
        });
        console.log('🏥 Backend health check:', testResponse.status);
      } catch (testError) {
        console.warn('⚠️ Backend health check failed:', testError);
      }
      
      const response = await fetch(`${BACKEND_URL}/api/chat/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          sessionId: sessionId,
          userId: currentUser?.id,
          emotionContext: emotionContext,
          skinContext: skinContext,
          foodContext: foodContext,
          userContext: userContext,
          analysisIntent: analysisIntent.confidence > 0.3 ? analysisIntent : undefined,
        }),
      });

      console.log('📡 Response status:', response.status);
      
      if (!response.ok) {
        console.error('❌ Backend request failed:', response.status, response.statusText);
        throw new Error(`Backend request failed: ${response.status} ${response.statusText}`);
      }

      console.log('📥 Parsing response...');
      const data = await response.json();
      console.log('📥 Response data:', data);

      if (data.success && (data.response || data.message || data.text)) {
        const analysisText = data.response || data.message || data.text;
        console.log('✅ Analysis text received, length:', analysisText.length);
        setAnalysis(analysisText);

        // Salva l'analisi nel database
        try {
          const currentUser = await AuthService.getCurrentUser();
          if (currentUser) {
            await detailedAnalysisDB.saveDetailedAnalysis(
              currentUser.id,
              analysisType,
              analysisData,
              analysisText
            );
            console.log('✅ Detailed analysis saved to database');
          }
        } catch (dbError) {
          console.warn('Failed to save detailed analysis to database:', dbError);
          // Non bloccare l'operazione se il salvataggio fallisce
        }
      } else {
        setError(t('popups.detailedAnalysis.generationFailed'));
      }
    } catch (err) {
      console.error('❌ Error in generateDetailedAnalysis:', err);
      setError(t('popups.detailedAnalysis.generationError'));
    } finally {
      console.log('🏁 Setting loading to false');
      setLoading(false);
    }
  };

  const getPopupTitle = () => {
    if (analysisType === 'emotion') {
      return t('popups.detailedAnalysis.emotionTitle');
    } else if (analysisType === 'skin') {
      return t('popups.detailedAnalysis.skinTitle');
    } else {
      return t('popups.detailedAnalysis.foodTitle') || 'Analisi Nutrizionale Avanzata';
    }
  };

  const getPopupIcon = () => {
    if (analysisType === 'emotion') {
      return 'emoticon-happy';
    } else if (analysisType === 'skin') {
      return 'face-woman-shimmer';
    } else {
      return 'food-apple';
    }
  };

  const getPopupColors = () => {
    if (analysisType === 'emotion') {
      return ['#8b5cf6', '#a855f7'];
    } else if (analysisType === 'skin') {
      return ['#22d3ee', '#6366f1'];
    } else {
      return ['#f59e0b', '#ef4444'];
    }
  };

  // Animation styles - Simple fade in
  const backdropStyle = useAnimatedStyle(() => {
    return {
      opacity: withTiming(visible ? 1 : 0, { duration: 300 }),
    };
  });

  const popupStyle = useAnimatedStyle(() => {
    return {
      opacity: withTiming(visible ? 1 : 0, { duration: 300 }),
    };
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <TouchableOpacity 
          style={styles.backdropTouchable} 
          activeOpacity={1} 
          onPress={onClose}
        />
        
        <Animated.View style={[styles.popupContainer, popupStyle]}>
          {/* Header */}
          <LinearGradient
            colors={getPopupColors() as any}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            <View style={styles.headerContent}>
              <View style={styles.titleContainer}>
                <MaterialCommunityIcons 
                  name={getPopupIcon() as any} 
                  size={24} 
                  color="#ffffff" 
                />
                <Text style={styles.title}>{getPopupTitle()}</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <MaterialCommunityIcons name="close" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </LinearGradient>

          {/* Content */}
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {loading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={getPopupColors()[0]} />
                <Text style={styles.loadingText}>
                  Generando analisi dettagliata...
                </Text>
                <Text style={styles.loadingSubtext}>
                  L'AI sta analizzando i tuoi dati
                </Text>
              </View>
            )}

            {error && !loading && (
              <View style={styles.errorContainer}>
                <MaterialCommunityIcons name="alert-circle" size={48} color="#ef4444" />
                <Text style={styles.errorTitle}>Errore</Text>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity 
                  style={[styles.retryButton, { backgroundColor: getPopupColors()[0] }]}
                  onPress={loadOrGenerateDetailedAnalysis}
                >
                  <Text style={styles.retryButtonText}>Riprova</Text>
                </TouchableOpacity>
              </View>
            )}

            {analysis && !loading && !error && (
              <View style={styles.analysisContainer}>
                <View style={styles.analysisHeader}>
                  <MaterialCommunityIcons 
                    name="brain" 
                    size={20} 
                    color={getPopupColors()[0]} 
                  />
                  <Text style={styles.analysisTitle}>Analisi AI</Text>
                </View>
                <Markdown style={markdownStyles}>{analysis}</Markdown>
              </View>
            )}

            {!loading && !error && !analysis && (
              <View style={styles.errorContainer}>
                <MaterialCommunityIcons name="help-circle" size={48} color="#6b7280" />
                <Text style={styles.errorTitle}>Nessun contenuto</Text>
                <Text style={styles.errorText}>
                  Non è stato possibile generare l'analisi. Riprova più tardi.
                </Text>
              </View>
            )}
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdropTouchable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  popupContainer: {
    width: width * 0.9,
    height: height * 0.8,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 20,
    overflow: 'hidden',
  },
  header: {
    paddingTop: 20,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 20,
    minHeight: 200,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
  },
  loadingSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ef4444',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  analysisContainer: {
    flex: 1,
    minHeight: 300,
    paddingBottom: 20,
  },
  analysisHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  analysisTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
  },
  analysisText: {
    fontSize: 15,
    lineHeight: 24,
    color: '#374151',
    textAlign: 'justify',
  },
});

// Stili per il markdown
const markdownStyles = {
  body: {
    fontSize: 15,
    lineHeight: 24,
    color: '#374151',
  },
  heading1: {
    fontSize: 20,
    fontWeight: '700' as any,
    color: '#1e293b',
    marginTop: 16,
    marginBottom: 8,
  },
  heading2: {
    fontSize: 18,
    fontWeight: '700' as any,
    color: '#1e293b',
    marginTop: 14,
    marginBottom: 6,
  },
  heading3: {
    fontSize: 16,
    fontWeight: '700' as any,
    color: '#1e293b',
    marginTop: 12,
    marginBottom: 4,
  },
  strong: {
    fontWeight: '700' as any,
    color: '#0f172a',
  },
  em: {
    fontStyle: 'italic' as any,
    color: '#475569',
  },
  list_item: {
    marginBottom: 4,
  },
  bullet_list: {
    marginBottom: 8,
  },
  ordered_list: {
    marginBottom: 8,
  },
  paragraph: {
    marginBottom: 8,
  },
  code_inline: {
    backgroundColor: '#f1f5f9',
    color: '#e11d48',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 14,
  },
  code_block: {
    backgroundColor: '#f8fafc',
    color: '#0f172a',
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
    fontSize: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#6366f1',
  },
};
