import React, { useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, Pressable, Dimensions,
  Animated, ScrollView, Platform, PanResponder
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string[];
  features: string[];
  actionText: string;
  highlightElement?: string;
  targetScreen?: string;
}

interface InteractiveTutorialProps {
  visible: boolean;
  onClose: () => void;
  onComplete: () => void;
  onNavigateToScreen?: (screen: string) => void;
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Benvenuto in Wellness Coach',
    description: 'La tua app di benessere completa, alimentata da AI. Scopri come monitorare salute, emozioni e bellezza in un unico posto.',
    icon: '🎯',
    color: ['#667eea', '#764ba2'],
    features: [
      'Dashboard personalizzabile',
      'Analisi AI in tempo reale',
      'Monitoraggio completo del benessere'
    ],
    actionText: 'Iniziamo!',
    targetScreen: 'home',
  },
  {
    id: 'dashboard',
    title: 'Dashboard Principale',
    description: 'La tua dashboard mostra tutti i dati di benessere in un colpo d\'occhio. L\'AI Daily Copilot analizza i tuoi dati e fornisce consigli personalizzati ogni giorno.',
    icon: '📊',
    color: ['#f093fb', '#f5576c'],
    features: [
      'Widget personalizzabili',
      'Dati di salute in tempo reale',
      'AI Daily Copilot attivo',
      'Check-in giornalieri'
    ],
    actionText: 'Scopri i Widget',
    targetScreen: 'home',
  },
  {
    id: 'widgets',
    title: 'Widget Interattivi',
    description: 'I widget mostrano i tuoi dati di salute con grafici e metriche dettagliate. Visualizza i tuoi progressi in tempo reale.',
    icon: '📈',
    color: ['#4facfe', '#00f2fe'],
    features: [
      'Grafici animati',
      'Metriche in tempo reale',
      'Tendenze e insights',
      'Personalizzazione completa'
    ],
    actionText: 'Le tue Emozioni',
    targetScreen: 'home'
  },
  {
    id: 'emotion-analysis',
    title: 'Analisi delle Emozioni',
    description: 'Scopri come l\'AI analizza le tue emozioni in tempo reale utilizzando la fotocamera. Traccia i tuoi sentimenti nel tempo.',
    icon: '😊',
    color: ['#fa709a', '#fee140'],
    features: [
      'Rilevamento emozioni',
      'Analisi in tempo reale',
      'Insights personalizzati',
      'Tracking emotivo'
    ],
    actionText: 'La tua Pelle',
    targetScreen: 'emotion'
  },
  {
    id: 'skin-analysis',
    title: 'Analisi della Pelle',
    description: 'Strumenti avanzati per l\'analisi della salute della tua pelle. Monitora la tua pelle e ricevi consigli skincare personalizzati.',
    icon: '✨',
    color: ['#4a90a4', '#6b5b95'],
    features: [
      'Analisi della pelle',
      'Raccomandazioni skincare',
      'Tracking del progresso',
      'Insights personalizzati'
    ],
    actionText: 'Analisi del Cibo',
    targetScreen: 'skin'
  },
  {
    id: 'food-analysis',
    title: 'Analisi del Cibo',
    description: 'Scatta una foto del tuo pasto e ricevi un\'analisi completa dei macronutrienti, calorie e consigli nutrizionali personalizzati.',
    icon: '🍎',
    color: ['#43e97b', '#38f9d7'],
    features: [
      'Analisi nutrizionale automatica',
      'Calcolo macronutrienti',
      'Raccomandazioni personalizzate',
      'Tracking delle calorie'
    ],
    actionText: 'Chat & Journal',
    targetScreen: 'food'
  },
  {
    id: 'journal',
    title: 'Journal Intelligente e Chat AI',
    description: 'Il tuo diario personale con AI che analizza i tuoi pensieri. Parla con il nostro AI Coach per ricevere supporto e consigli.',
    icon: '📝',
    color: ['#667eea', '#764ba2'],
    features: [
      'Scrittura guidata da AI',
      'Chat con AI Coach 24/7',
      'Analisi sentimenti automatica',
      'Tracking del benessere mentale'
    ],
    actionText: 'Esplora Esercizi',
    targetScreen: 'chat'
  },
  {
    id: 'exercises',
    title: 'Esercizi di Benessere',
    description: 'Scopri una libreria completa di esercizi di respirazione, meditazioni e wellness routines per migliorare il tuo benessere.',
    icon: '🧘',
    color: ['#d97757', '#b8624a'],
    features: [
      'Esercizi di respirazione guidati',
      'Meditazioni personalizzate',
      'Tracking del progresso',
      'Libreria completa'
    ],
    actionText: 'Ora sai tutto!',
    targetScreen: 'suggestions'
  },
  {
    id: 'completato',
    title: 'Sei Pronto a Iniziare!',
    description: 'Hai imparato tutte le funzionalità principali. Ora inizia il tuo viaggio verso il benessere con Wellness Coach.',
    icon: '🎉',
    color: ['#667eea', '#764ba2', '#f093fb'],
    features: [
      'Dashboard personalizzata',
      'AI Copilot attivo',
      'Analisi avanzate disponibili',
      'Journal, Chat e Esercizi pronti'
    ],
    actionText: 'Accedi all\'App',
    targetScreen: 'home'
  }
];

export const InteractiveTutorial: React.FC<InteractiveTutorialProps> = ({
  visible, onClose, onComplete, onNavigateToScreen
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const insets = useSafeAreaInsets(); // ✅ Gestione automatica safe area per Android/iOS

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const modalFadeAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(height)).current;
  const cardOpacity = useRef(new Animated.Value(1)).current;

  // ✅ Memoization per evitare ricalcoli inutili
  const current = useMemo(() => TUTORIAL_STEPS[currentStep], [currentStep]);
  const last = useMemo(() => currentStep === TUTORIAL_STEPS.length - 1, [currentStep]);
  
  // ✅ Memoization dei colori derivati
  const { accent, accentSecondary, accentSoft, accentStroke, gradientColors } = useMemo(() => {
    const accent = current.color[0];
    const accentSecondary = current.color[current.color.length - 1] || accent;
    const accentSoft = `${accent}1A`;
    const accentStroke = `${accent}33`;
    
    // Assicurati che colors sia sempre un array di almeno 2 colori
    const gradientColors = current.color.length >= 2
      ? (current.color as [string, string, ...string[]])
      : ([current.color[0], current.color[0]] as [string, string]);
    
    return { accent, accentSecondary, accentSoft, accentStroke, gradientColors };
  }, [current.color]);

  React.useEffect(() => {
    if (visible) {
      // Reset initial states
      cardOpacity.setValue(1);
      
      Animated.parallel([
        Animated.timing(modalFadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 28,
          stiffness: 320,
          mass: 0.9,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(modalFadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: height,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  React.useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: (currentStep+1)/TUTORIAL_STEPS.length,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [currentStep]);

  React.useEffect(() => {
    // Reset pan when step changes
    pan.setValue(0);
    // Ensure card is always visible
    cardOpacity.setValue(1);
  }, [currentStep]);

  const goTo = (next: number) => {
    if (next < 0 || next >= TUTORIAL_STEPS.length) return;
    if (isAnimating) return;
    setIsAnimating(true);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Reset pan immediately
    pan.setValue(0);
    
    // Change step immediately - NO animation on opacity
    // This prevents the flash/invisible card issue
    setCurrentStep(next);
    
    const step = TUTORIAL_STEPS[next];
    if (step.targetScreen && onNavigateToScreen) {
      if (step.id === 'completato') {
        onNavigateToScreen('home');
      } else {
        onNavigateToScreen(step.targetScreen);
      }
      
      // Scroll helpers
      setTimeout(() => {
        if (next === 2) {
          global.scrollToWidgets?.();
        } else if (next === 3) {
          global.scrollToCoplot?.();
        }
      }, 200);
    }

    // Small delay then unlock
    setTimeout(() => setIsAnimating(false), 100);
  };

  const next = () => last ? onComplete() : goTo(currentStep+1);
  const prev = () => goTo(currentStep-1);

  const skip = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onClose();
  };

  // Swipe gesture
  const pan = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > Math.abs(g.dy) && Math.abs(g.dx) > 12,
      onPanResponderMove: Animated.event([null, { dx: pan }], { useNativeDriver: false }),
      onPanResponderRelease: (_, g) => {
        if (g.dx < -60) next();
        else if (g.dx > 60) prev();
        Animated.spring(pan, { toValue: 0, useNativeDriver: true }).start();
      },
    })
  ).current;

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      {/* Backdrop scuro per contrasto */}
      <Animated.View style={[styles.backdrop, { opacity: modalFadeAnim }]} />
      
      {/* Bottom sheet animato */}
      <Animated.View
        style={[
          styles.bottomSheet,
          {
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <View style={styles.shell}>
          {/* Gradient dinamico per ogni step */}
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.gradient,
              {
                // ✅ Gestione automatica safe area: rispetta i pulsanti di navigazione Android
                // Su Android con pulsanti fisici/software: insets.bottom sarà > 0 (es. 48px)
                // Su Android con gesture navigation: insets.bottom sarà 0 o molto piccolo
                // Su iOS: insets.bottom è gestito automaticamente se necessario
                paddingBottom: Math.max(
                  Platform.OS === 'ios' ? 34 : 20, // Padding minimo
                  insets.bottom > 0 ? insets.bottom + 20 : 20 // Aggiungi padding extra se ci sono insets
                ),
              },
            ]}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.progressContainer}>
                <View style={styles.progressTrack}>
                  <Animated.View
                    style={[
                      styles.progressFill,
                      { 
                        width: progressAnim.interpolate({
                          inputRange: [0,1],
                          outputRange: ['0%','100%']
                        })
                      }
                    ]}
                  />
                </View>
                <Text style={styles.stepCounter}>
                  {currentStep + 1} / {TUTORIAL_STEPS.length}
                </Text>
              </View>
              <Pressable 
                onPress={skip} 
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={({ pressed }) => [
                  styles.skipBtn,
                  pressed && styles.skipBtnPressed
                ]}
              >
                <Text style={styles.skip}>Salta</Text>
                <MaterialCommunityIcons name="close" size={18} color="#fff" />
              </Pressable>
            </View>

            <ScrollView
              style={styles.scrollArea}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              bounces
            >
              <View
                {...panResponder.panHandlers}
                style={styles.cardContainer}
              >
                <View style={[styles.card, { borderColor: accentStroke, backgroundColor: '#ffffff' }]}>
                  <View style={styles.iconWrap}>
                    <Text style={styles.iconText} allowFontScaling={false}>{current.icon}</Text>
                  </View>

                  <Text style={styles.title}>{current.title}</Text>
                  <Text style={styles.desc}>{current.description}</Text>

                  <View style={styles.featureGrid}>
                    {current.features.map((f, i) => (
                      <View key={i} style={[styles.featurePill, { borderColor: accentStroke, backgroundColor: accentSoft }]}>
                        <MaterialCommunityIcons name="radiobox-marked" size={14} color={accent} />
                        <Text style={styles.featureTxt}>{f}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            </ScrollView>

            {/* Footer con bottoni migliorati e feedback visivo */}
            <View style={styles.footer}>
              {currentStep > 0 ? (
                <Pressable 
                  onPress={prev} 
                  disabled={isAnimating} 
                  style={({ pressed }) => [
                    styles.secondaryBtn,
                    pressed && styles.secondaryBtnPressed
                  ]}
                >
                  <MaterialCommunityIcons name="chevron-left" size={22} color="#ffffff" />
                  <Text style={styles.secondaryTxt}>Indietro</Text>
                </Pressable>
              ) : <View style={{ flex: 1 }} />}

              <Pressable 
                onPress={next} 
                disabled={isAnimating} 
                style={({ pressed }) => [
                  styles.primaryBtn,
                  pressed && styles.primaryBtnPressed
                ]}
              >
                <LinearGradient
                  colors={[accent, accentSecondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.primaryGradient}
                >
                  <Text style={styles.primaryTxt}>
                    {last ? 'Scopri l\'App!' : current.actionText}
                  </Text>
                  <MaterialCommunityIcons 
                    name={last ? 'rocket-launch' : 'arrow-right'} 
                    size={18} 
                    color="#ffffff" 
                  />
                </LinearGradient>
              </Pressable>
            </View>
          </LinearGradient>
        </View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    zIndex: 9997,
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 9998,
    maxHeight: height * 0.78,
  },
  shell: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: -10 },
    elevation: 20,
  },
  gradient: {
    padding: 20,
    paddingTop: 18,
    // paddingBottom sarà applicato dinamicamente nel componente per rispettare safe area
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  progressContainer: {
    flex: 1,
    marginRight: 16,
  },
  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: 4,
    backgroundColor: '#fff',
    borderRadius: 999,
  },
  stepCounter: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
  },
  skipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  skipBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    transform: [{ scale: 0.96 }],
  },
  skip: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  cardContainer: {
    marginTop: 2,
    marginBottom: 14,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    padding: 20,
    paddingTop: 18,
    paddingBottom: 18,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    borderWidth: 1.5,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    backgroundColor: '#f1f5f9',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  iconText: {
    fontSize: 36,
    lineHeight: 42,
  },
  title: {
    fontSize: 23,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.5,
    color: '#0f172a',
  },
  desc: {
    fontSize: 15,
    textAlign: 'left',
    lineHeight: 23,
    marginBottom: 6,
    fontWeight: '500',
    color: '#0f172a',
    paddingHorizontal: 4,
  },
  scrollArea: {
    maxHeight: height * 0.62,
  },
  scrollContent: {
    paddingBottom: 10,
  },
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  featureTxt: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    flexShrink: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    flex: 1,
    justifyContent: 'center',
  },
  secondaryBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    transform: [{ scale: 0.97 }],
  },
  secondaryTxt: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  primaryBtn: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 10,
  },
  primaryBtnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  primaryGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    paddingHorizontal: 20,
    borderRadius: 14,
  },
  primaryTxt: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
  },
});