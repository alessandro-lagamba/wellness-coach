import React, { useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, Dimensions,
  Animated, ScrollView, Platform, PanResponder
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';

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
    title: 'Benvenuto in NeuroTracer',
    description: 'La tua app di benessere completa, alimentata da AI. Scopri come monitorare salute, emozioni e bellezza in un unico posto.',
    icon: '🎯',
    color: ['#667eea', '#764ba2'],
    features: [
      'Dashboard personalizzabile',
      'Analisi AI in tempo reale',
      'Monitoraggio completo del benessere'
    ],
    actionText: 'Iniziamo!',
    targetScreen: 'home'
  },
  {
    id: 'dashboard',
    title: 'Dashboard Principale',
    description: 'La tua dashboard mostra tutti i dati di benessere in un colpo d\'occhio. Accedi per visualizzare i tuoi ultimi dati.',
    icon: '📊',
    color: ['#f093fb', '#f5576c'],
    features: [
      'Widget personalizzabili',
      'Dati di salute in tempo reale',
      'AI Daily Copilot',
      'Check-in giornalieri'
    ],
    actionText: 'Scopri i Widget',
    targetScreen: 'home'
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
    actionText: 'Scopri il Copilot',
    targetScreen: 'home'
  },
  {
    id: 'ai-copilot',
    title: 'AI Daily Copilot',
    description: 'Il tuo assistente AI analizza i tuoi dati e fornisce consigli personalizzati per migliorare il tuo benessere giornaliero.',
    icon: '🤖',
    color: ['#43e97b', '#38f9d7'],
    features: [
      'Analisi giornaliera automatica',
      'Raccomandazioni personalizzate',
      'Insights intelligenti',
      'Piano di benessere adattivo'
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
    color: ['#a8edea', '#fed6e3'],
    features: [
      'Analisi della pelle',
      'Raccomandazioni skincare',
      'Tracking del progresso',
      'Insights personalizzati'
    ],
    actionText: 'Chat & Journal',
    targetScreen: 'skin'
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
    color: ['#ffecd2', '#fcb69f'],
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
    description: 'Hai imparato tutte le funzionalità principali. Ora inizia il tuo viaggio verso il benessere con NeuroTracer.',
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

// Utils: calcola luminanza per rilevare se gradiente è chiaro
const hexToRgb = (hex: string) => {
  const h = hex.replace('#','');
  const b = h.length === 3 ? h.split('').map(x=>x+x).join('') : h;
  const int = parseInt(b, 16);
  return { r: (int>>16)&255, g: (int>>8)&255, b: int&255 };
};

const luminance = (hex: string) => {
  const { r,g,b } = hexToRgb(hex);
  const a = [r,g,b].map(v=>{
    const s = v/255;
    return s<=0.03928 ? s/12.92 : Math.pow((s+0.055)/1.055, 2.4);
  });
  return 0.2126*a[0] + 0.7152*a[1] + 0.0722*a[2];
};

const isLightGradient = (colors: string[]) => {
  const avg = colors.reduce((acc,c)=>acc+luminance(c),0)/colors.length;
  return avg > 0.7;
};

export const InteractiveTutorial: React.FC<InteractiveTutorialProps> = ({
  visible, onClose, onComplete, onNavigateToScreen
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const modalFadeAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  const current = TUTORIAL_STEPS[currentStep];
  const last = currentStep === TUTORIAL_STEPS.length - 1;

  const useDarkText = useMemo(()=> isLightGradient(current.color), [current.color]);
  const titleColor = '#0f172a'; // Always dark for visibility
  const bodyColor  = '#334155'; // Always dark for visibility

  React.useEffect(() => {
    Animated.timing(modalFadeAnim, {
      toValue: visible ? 1 : 0, 
      duration: visible ? 280 : 180, 
      useNativeDriver: true
    }).start();
  }, [visible]);

  React.useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: (currentStep+1)/TUTORIAL_STEPS.length,
      duration: 350,
      useNativeDriver: false,
    }).start();
  }, [currentStep]);

  const goTo = (next: number) => {
    if (next < 0 || next >= TUTORIAL_STEPS.length) return;
    if (isAnimating) return;
    setIsAnimating(true);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(scaleAnim,{ toValue: 0.96, duration: 180, useNativeDriver: true }),
    ]).start(() => {
      setCurrentStep(next);
      const step = TUTORIAL_STEPS[next];
      if (step.targetScreen && onNavigateToScreen) {
        // Handle special navigation cases
        if (step.id === 'completato') {
          // Navigate to home to finish
          onNavigateToScreen('home');
        } else {
          onNavigateToScreen(step.targetScreen);
        }
        
        // Scroll behavior based on step
        setTimeout(() => {
          if (next === 2) {
            // Scroll to widgets section
            global.scrollToWidgets?.();
          } else if (next === 3) {
            // Scroll to AI Daily Copilot section
            global.scrollToCoplot?.();
          }
        }, 300);
      }

      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.spring(scaleAnim,{ toValue: 1, useNativeDriver: true, damping: 14, stiffness: 180 }),
      ]).start(() => setIsAnimating(false));
    });
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

  const modalMaxH = Math.min(height * 0.96, 700);

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[styles.overlay, { opacity: modalFadeAnim }]}>
        <View style={[styles.shell, { maxHeight: modalMaxH }]}>
          <BlurView intensity={24} tint="light" style={styles.blur}>
            <LinearGradient colors={current.color as any} style={styles.gradient}>
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.progressTrack}>
                  <Animated.View
                    style={[
                      styles.progressFill,
                      { width: progressAnim.interpolate({
                          inputRange: [0,1],
                          outputRange: ['0%','100%']
                        })
                      }
                    ]}
                  />
                </View>
                <TouchableOpacity onPress={skip} hitSlop={8}>
                  <Text style={styles.skip}>Salta</Text>
                </TouchableOpacity>
              </View>

              {/* Content Card */}
              <Animated.View
                {...panResponder.panHandlers}
                style={[
                  styles.card, 
                  { opacity: fadeAnim, transform: [{ scale: scaleAnim }, { translateX: pan }] }
                ]}
              >
                <View style={styles.iconWrap}>
                  <Text style={styles.iconText}>{current.icon}</Text>
                </View>

                <Text style={[styles.title, { color: titleColor }]}>{current.title}</Text>
                <Text style={[styles.desc,  { color: bodyColor }]}>{current.description}</Text>

                <ScrollView
                  style={styles.featuresScroll}
                  contentContainerStyle={styles.featuresContent}
                  showsVerticalScrollIndicator={false}
                >
                  {current.features.map((f, i) => (
                    <View key={i} style={styles.featureRow}>
                      <View style={styles.tick}>
                        <MaterialCommunityIcons name="check" size={16} color="#16a34a" />
                      </View>
                      <Text style={styles.featureText}>{f}</Text>
                    </View>
                  ))}
                </ScrollView>
              </Animated.View>

              {/* Footer */}
              <View style={styles.footer}>
                {currentStep > 0 ? (
                  <TouchableOpacity onPress={prev} disabled={isAnimating} style={styles.secondaryBtn}>
                    <MaterialCommunityIcons name="chevron-left" size={20} color="#0f172a" />
                    <Text style={styles.secondaryTxt}>Indietro</Text>
                  </TouchableOpacity>
                ) : <View style={{ width: 110 }} />}

                <TouchableOpacity onPress={next} disabled={isAnimating} style={styles.primaryBtn}>
                  <Text style={styles.primaryTxt}>
                    {last ? 'Scopri l\'App!' : current.actionText}
                  </Text>
                  <MaterialCommunityIcons name={last ? 'rocket-launch' : 'arrow-right'} size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </BlurView>
        </View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay:{ flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'center', alignItems:'center' },
  shell:{ width: width*0.92, maxWidth: 420, borderRadius:22, overflow:'hidden' },
  blur:{ borderRadius:22, overflow:'hidden' },
  gradient:{ padding:16, paddingBottom:24 },

  header:{
    flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:12,
  },
  progressTrack:{
    flex:1, height:6, backgroundColor:'rgba(255,255,255,0.35)', borderRadius:999, marginRight:12, overflow:'hidden'
  },
  progressFill:{
    height:6, backgroundColor:'#fff', borderRadius:999,
  },
  skip:{ fontSize:15, fontWeight:'700', opacity:0.9, color: '#fff' },

  card:{
    backgroundColor:'rgba(255,255,255,0.95)',
    borderRadius:20, padding:24,
    borderWidth:1, borderColor:'rgba(255,255,255,0.95)',
    shadowColor:'#000', shadowOpacity:0.12, shadowRadius:16, shadowOffset:{width:0,height:10},
    maxHeight: 580,
  },
  iconWrap:{
    width:90, height:90, borderRadius:45, alignSelf:'center',
    alignItems:'center', justifyContent:'center',
    backgroundColor:'rgba(15,23,42,0.08)', marginBottom:14,
    borderWidth:2, borderColor:'rgba(15,23,42,0.1)',
  },
  iconText:{ fontSize:48, lineHeight: 54 },
  title:{ fontSize:24, fontWeight:'900', textAlign:'center', marginBottom:8, letterSpacing: -0.5 },
  desc:{ fontSize:15, textAlign:'center', lineHeight:22, marginBottom:16, fontWeight: '500' },

  featuresScroll:{ maxHeight: 240 },
  featuresContent:{ paddingBottom:4 },
  featureRow:{
    flexDirection:'row', alignItems:'center', gap:12,
    paddingVertical:12, paddingHorizontal:14,
    backgroundColor:'#f8fafc', borderRadius:16, borderWidth:1, borderColor:'#e2e8f0',
    marginBottom:11,
  },
  tick:{
    width:32, height:32, borderRadius:16, backgroundColor:'#ecfdf5',
    alignItems:'center', justifyContent:'center', borderWidth:2, borderColor:'#86efac', flexShrink: 0
  },
  featureText:{ flex:1, color:'#0f172a', fontSize:16, fontWeight:'700', lineHeight: 22 },

  footer:{
    flexDirection:'row', alignItems:'center', justifyContent:'space-between',
    paddingTop:18, gap: 10
  },
  secondaryBtn:{
    flexDirection:'row', alignItems:'center', gap:6,
    paddingVertical:11, paddingHorizontal:16,
    backgroundColor:'#f1f5f9',
    borderRadius:12, borderWidth:1.5, borderColor:'#cbd5e1',
    flex: 1,
    justifyContent: 'center'
  },
  secondaryTxt:{ color:'#0f172a', fontSize:15, fontWeight:'700' },

  primaryBtn:{
    flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8,
    backgroundColor:'#0f172a', paddingVertical:11, paddingHorizontal:20, borderRadius:12,
    flex: 1,
    shadowColor:'#0f172a', shadowOpacity:0.3, shadowRadius:8, shadowOffset:{width:0,height:4}
  },
  primaryTxt:{ color:'#fff', fontSize:15, fontWeight:'800' },
});
