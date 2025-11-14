import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withRepeat,
  Easing,
  cancelAnimation,
  interpolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
// import robusto per evitare undefined in alcune versioni
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../contexts/ThemeContext';
import { useFocusEffect } from 'expo-router';

const { width } = Dimensions.get('window');

/** ------------ Types -------------- */
type Phase = 'inhale' | 'hold' | 'exhale' | 'pause';
type CycleStep = { phase: Phase; duration: number; instruction: string; sub: string };

interface Props {
  onComplete?: () => void;
  onClose?: () => void;
  enableMusic?: boolean; // Nuovo prop per abilitare/disabilitare la musica
}

/** ------------ Costanti -------------- */
const PATTERN: CycleStep[] = [
  { phase: 'inhale', duration: 4, instruction: 'Inspira',   sub: 'Lentamente dal naso' },
  { phase: 'hold',   duration: 7, instruction: 'Trattieni', sub: 'Mantieni il respiro' },
  { phase: 'exhale', duration: 8, instruction: 'Espira',    sub: 'Lentamente dalla bocca' },
  { phase: 'pause',  duration: 2, instruction: 'Pausa',     sub: 'Rilassati' },
];

const TOTAL_CYCLES = 4;

// File audio di background (sostituisci con il tuo file)
const BACKGROUND_MUSIC = require('../../assets/audio/breathing-background.mp3');

// Funzione per ottenere il colore della fase (mantiene i colori originali per coerenza visiva)
const phaseColor = (p: Phase, colors: any) =>
  p === 'inhale' ? colors.success : p === 'hold' ? colors.accent : p === 'exhale' ? colors.primary : colors.primaryLight;

const phaseIcon = (p: Phase) =>
  p === 'inhale' ? 'arrow-up' : p === 'hold' ? 'pause' : p === 'exhale' ? 'arrow-down' : 'circle-outline';

export const Breathing478: React.FC<Props> = ({ onComplete, enableMusic = true }) => {
  const { colors } = useTheme(); // 🆕 Theme hook
  
  // UI state
  const [active, setActive] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [uiPhase, setUiPhase] = useState<Phase>('inhale');
  const [uiCountdown, setUiCountdown] = useState(PATTERN[0].duration);
  const [uiCycleIndex, setUiCycleIndex] = useState(0);
  const [uiStepIndex, setUiStepIndex] = useState(0);
  const [musicEnabled, setMusicEnabled] = useState(enableMusic);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);

  // Audio state
  const [backgroundSound, setBackgroundSound] = useState<Audio.Sound | null>(null);

  // refs per logica/timer (evita closure stale)
  const activeRef = useRef(false);
  const stepIndexRef = useRef(0);
  const cycleIndexRef = useRef(0);
  const countdownRef = useRef<number>(PATTERN[0].duration);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nextPhaseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // animazioni
  const circleScale = useSharedValue(1);
  const circleOpacity = useSharedValue(0.9);
  const haloScale = useSharedValue(1);
  const instructionOpacity = useSharedValue(1);

  // styles animati
  const circleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: circleScale.value }],
    opacity: circleOpacity.value,
  }));
  const haloStyle = useAnimatedStyle(() => ({
    transform: [{ scale: haloScale.value }],
    opacity: interpolate(haloScale.value, [1, 1.18], [0.22, 0]),
  }));
  const instructionStyle = useAnimatedStyle(() => ({
    opacity: instructionOpacity.value,
  }));

  const animateForPhase = (phase: Phase, durationSec: number) => {
    instructionOpacity.value = withSequence(
      withTiming(0, { duration: 120 }),
      withTiming(1, { duration: 160 })
    );
    switch (phase) {
      case 'inhale':
        circleScale.value = withTiming(1.28, { duration: durationSec * 1000, easing: Easing.out(Easing.cubic) });
        circleOpacity.value = withTiming(1, { duration: durationSec * 1000 });
        break;
      case 'hold':
        circleScale.value = withTiming(1.28, { duration: 200 });
        circleOpacity.value = withTiming(0.95, { duration: 200 });
        break;
      case 'exhale':
        circleScale.value = withTiming(0.72, { duration: durationSec * 1000, easing: Easing.in(Easing.cubic) });
        circleOpacity.value = withTiming(0.65, { duration: durationSec * 1000 });
        break;
      case 'pause':
        circleScale.value = withTiming(1, { duration: durationSec * 1000 });
        circleOpacity.value = withTiming(0.85, { duration: durationSec * 1000 });
        break;
    }
  };

  const startHalo = () => {
    haloScale.value = withRepeat(
      withSequence(
        withTiming(1.18, { duration: 1200, easing: Easing.out(Easing.quad) }),
        withTiming(1.0,  { duration: 1200, easing: Easing.in(Easing.quad) })
      ),
      -1,
      false
    );
  };
  const stopHalo = () => {
    cancelAnimation(haloScale);
    haloScale.value = withTiming(1, { duration: 200 });
  };

  const clearTimers = () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (nextPhaseTimeoutRef.current) { clearTimeout(nextPhaseTimeoutRef.current); nextPhaseTimeoutRef.current = null; }
  };

  // Funzioni per gestire l'audio e feedback aptico
  const loadBackgroundMusic = async () => {
    try {
      const { sound } = await Audio.Sound.createAsync(BACKGROUND_MUSIC, {
        shouldPlay: true,
        isLooping: true,
        volume: 0.4, // Volume moderato per il background
      });
      setBackgroundSound(sound);
    } catch (error) {
      console.warn('Failed to load background music:', error);
    }
  };

  const toggleMusic = async () => {
    // Feedback aptico immediato
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (musicEnabled) {
      // Disattiva la musica
      await stopAllAudio();
    } else {
      // Attiva la musica
      await loadBackgroundMusic();
    }
    setMusicEnabled(!musicEnabled);
  };

  const triggerHapticFeedback = (phase: Phase) => {
    if (!hapticsEnabled) return;
    
    try {
      switch (phase) {
        case 'inhale':
          // Vibrazione leggera per l'inizio dell'inspirazione
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;
        case 'hold':
          // Vibrazione media per il trattenimento
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          break;
        case 'exhale':
          // Vibrazione leggera per l'espirazione
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;
        case 'pause':
          // Vibrazione molto leggera per la pausa
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;
      }
    } catch (error) {
      console.warn('Failed to trigger haptic feedback:', error);
    }
  };

  const stopAllAudio = async () => {
    try {
      if (backgroundSound) {
        await backgroundSound.stopAsync();
        await backgroundSound.unloadAsync();
        setBackgroundSound(null);
      }
    } catch (error) {
      console.warn('Failed to stop audio:', error);
    }
  };

  const goToPhase = (stepIndex: number) => {
    const step = PATTERN[stepIndex];
    stepIndexRef.current = stepIndex;
    countdownRef.current = step.duration;

    setUiStepIndex(stepIndex);
    setUiPhase(step.phase);
    setUiCountdown(step.duration);

    animateForPhase(step.phase, step.duration);
    
    // Trigger feedback aptico per la fase corrente
    triggerHapticFeedback(step.phase);

    clearTimers();
    intervalRef.current = setInterval(() => {
      if (!activeRef.current) { clearTimers(); return; }
      const next = countdownRef.current - 1;
      countdownRef.current = next;
      setUiCountdown(next);
      if (next <= 0) {
        clearTimers();
        nextPhaseTimeoutRef.current = setTimeout(() => {
          advancePhase();
        }, 160);
      }
    }, 1000);
  };

  const advancePhase = () => {
    if (!activeRef.current) return;
    const nextStep = stepIndexRef.current + 1;

    if (nextStep >= PATTERN.length) {
      const nextCycle = cycleIndexRef.current + 1;
      cycleIndexRef.current = nextCycle;
      setUiCycleIndex(nextCycle);

      if (nextCycle >= TOTAL_CYCLES) {
        finishExercise();
        return;
      }
      goToPhase(0);
    } else {
      goToPhase(nextStep);
    }
  };

  const start = async () => {
    setCompleted(false);
    setActive(true);
    activeRef.current = true;

    cycleIndexRef.current = 0;
    stepIndexRef.current = 0;
    setUiCycleIndex(0);
    setUiStepIndex(0);
    setUiPhase(PATTERN[0].phase);
    setUiCountdown(PATTERN[0].duration);

    cancelAnimation(circleScale);
    cancelAnimation(circleOpacity);
    circleScale.value = 1;
    circleOpacity.value = 0.9;

    startHalo();
    
    // Carica e avvia la musica di background solo se abilitata
    if (musicEnabled) {
      await loadBackgroundMusic();
    }
    
    goToPhase(0);
  };

  const stop = async () => {
    setActive(false);
    activeRef.current = false;
    clearTimers();
    stopHalo();
    cancelAnimation(circleScale);
    cancelAnimation(circleOpacity);
    circleScale.value = withTiming(1, { duration: 300 });
    circleOpacity.value = withTiming(0.9, { duration: 300 });
    
    // Ferma tutta l'audio quando si ferma l'esercizio
    await stopAllAudio();
  };

  const finishExercise = async () => {
    setActive(false);
    activeRef.current = false;
    setCompleted(true);
    clearTimers();
    stopHalo();
    circleScale.value = withTiming(1, { duration: 500 });
    circleOpacity.value = withTiming(0.9, { duration: 500 });
    
    // Ferma tutta l'audio
    await stopAllAudio();
    
    setTimeout(() => onComplete?.(), 800);
  };

  // Cleanup quando il componente viene smontato
  useEffect(() => {
    return () => {
      activeRef.current = false;
      clearTimers();
      stopHalo();
      cancelAnimation(circleScale);
      cancelAnimation(circleOpacity);
      // Cleanup audio quando il componente viene smontato
      stopAllAudio();
    };
  }, []);

  // Cleanup quando la pagina perde il focus (navigazione via, cambio pagina, ecc.)
  useFocusEffect(
    React.useCallback(() => {
      // Quando la pagina guadagna il focus, non facciamo nulla
      return () => {
        // Quando la pagina perde il focus, ferma la musica
        activeRef.current = false;
        clearTimers();
        stopHalo();
        cancelAnimation(circleScale);
        cancelAnimation(circleOpacity);
        stopAllAudio();
      };
    }, [])
  );

  // Progress (solo per eventuali usi, non mostriamo più barre)
  useMemo(() => {
    // manteniamo calcolo se ti serve in futuro
    return null;
  }, [uiStepIndex, uiCountdown]);

  const step = PATTERN[uiStepIndex];
  const color = phaseColor(uiPhase, colors);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient colors={[colors.background, colors.surfaceMuted]} style={styles.gradient}>
        {/* HEADER interno rimosso: la pagina mostrerà solo la freccia del nav */}

        <View style={styles.center}>
          {/* Cerchio (alzato: più distanza dai testi sotto) */}
          <View style={styles.circleWrap}>
            <Animated.View style={[styles.halo, { backgroundColor: color }, haloStyle]} />
            <Animated.View style={[styles.circle, circleStyle, { shadowColor: colors.shadowColor }]}>
              <LinearGradient
                colors={[color, `${color}90`]}
                style={styles.circleGradient}
                start={{ x: 0.2, y: 0.1 }}
                end={{ x: 0.9, y: 0.9 }}
              >
                <MaterialCommunityIcons name={phaseIcon(uiPhase) as any} size={44} color="white" />
              </LinearGradient>
            </Animated.View>
          </View>

          {/* Testi + countdown */}
          <Animated.View style={[styles.instructions, instructionStyle]}>
            <Text style={[styles.instruction, { color }]}>{step.instruction}</Text>
            <Text style={[styles.sub, { color: colors.textSecondary }]}>{step.sub}</Text>
            <View style={[styles.countdownBox, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
              <Text style={[styles.countdown, { color }]}>{uiCountdown}</Text>
            </View>
          </Animated.View>

          {/* Solo contatore ciclo (pill), niente barre */}
          <View style={[styles.cyclePill, { backgroundColor: colors.primaryMuted }]}>
            <Text style={[styles.cyclePillText, { color: colors.textSecondary }]}>Ciclo {Math.min(uiCycleIndex + 1, TOTAL_CYCLES)} / {TOTAL_CYCLES}</Text>
          </View>
        </View>

        {/* Audio & Haptics Controls */}
        <View style={styles.controlsContainer}>
          <TouchableOpacity 
            onPress={toggleMusic}
            style={[styles.controlButton, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }, musicEnabled && { backgroundColor: colors.surface, borderColor: colors.borderLight }]}
          >
            <MaterialCommunityIcons 
              name={musicEnabled ? "music" : "music-off"} 
              size={18} 
              color={musicEnabled ? colors.success : colors.textSecondary} 
            />
            <Text style={[styles.controlButtonText, { color: colors.textSecondary }, musicEnabled && { color: colors.text }]}>
              {musicEnabled ? "Audio ON" : "Audio OFF"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => {
              setHapticsEnabled(!hapticsEnabled);
              // Test vibrazione quando si attiva
              if (!hapticsEnabled) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
            }}
            style={[styles.controlButton, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }, hapticsEnabled && { backgroundColor: colors.surface, borderColor: colors.borderLight }]}
          >
            <MaterialCommunityIcons 
              name={hapticsEnabled ? "vibrate" : "vibrate-off"} 
              size={18} 
              color={hapticsEnabled ? colors.primary : colors.textSecondary} 
            />
            <Text style={[styles.controlButtonText, { color: colors.textSecondary }, hapticsEnabled && { color: colors.text }]}>
              {hapticsEnabled ? "Vibrazione ON" : "Vibrazione OFF"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* CONTROLS: più grandi e più in basso */}
        <View style={styles.footer}>
          {!active && !completed && (
            <TouchableOpacity onPress={start} style={[styles.cta, styles.ctaStart, { shadowColor: colors.shadowColor }]}>
              <MaterialCommunityIcons name="play" size={24} color="white" />
              <Text style={styles.ctaText}>Inizia</Text>
            </TouchableOpacity>
          )}
          {active && (
            <TouchableOpacity onPress={stop} style={[styles.cta, styles.ctaStop, { shadowColor: colors.shadowColor }]}>
              <MaterialCommunityIcons name="stop" size={24} color="white" />
              <Text style={styles.ctaText}>Ferma</Text>
            </TouchableOpacity>
          )}
          {completed && (
            <View style={{ alignItems: 'center' }}>
              <MaterialCommunityIcons name="check-circle" size={48} color={colors.success} />
              <Text style={[styles.doneTitle, { color: colors.success }]}>Esercizio completato</Text>
              <Text style={[styles.doneSub, { color: colors.textSecondary }]}>Ottimo lavoro! Respira bene 😊</Text>
              <TouchableOpacity onPress={start} style={[styles.cta, styles.ctaReplay, { backgroundColor: colors.primary, shadowColor: colors.shadowColor }]}>
                <Text style={styles.ctaText}>Riprova</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
};

/** ======================= STILI ======================= */
const CIRCLE_SIZE = Math.min(260, Math.round(width * 0.74));

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },

  // area centrale
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 80, // Aumentiamo il padding top per abbassare il contenuto
    paddingBottom: 60, // Aggiungiamo padding bottom per dare spazio al footer
  },

  // cerchio più alto e con maggiore distanza dai testi (marginBottom maggiore)
  circleWrap: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    marginBottom: 56, // ↑ più spazio sotto
  },
  halo: {
    position: 'absolute',
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
  },
  circle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    overflow: 'hidden',
    // shadowColor sarà impostato dinamicamente
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  circleGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  instructions: { alignItems: 'center', marginBottom: 16 },
  instruction: { fontSize: 30, fontWeight: '800', letterSpacing: 0.3 },
  sub: { marginTop: 6, fontSize: 16 },
  countdownBox: {
    marginTop: 14,
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdown: { fontSize: 28, fontWeight: '800' },

  // pill “Ciclo X / Y”
  cyclePill: {
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  cyclePillText: {
    fontSize: 14,
    fontWeight: '700',
  },

  // footer con bottone in basso e più grande
  footer: {
    paddingHorizontal: 24,
    paddingTop: 20, // Aggiungiamo padding top per alzare il pulsante
    paddingBottom: 40, // Riduciamo il padding bottom
    alignItems: 'center',
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 36,
    paddingVertical: 18,
    borderRadius: 32,
    // shadowColor sarà impostato dinamicamente
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 10,
  },
  ctaStart: { backgroundColor: '#10b981' }, // Mantiene il verde per "Inizia"
  ctaStop: { backgroundColor: '#ef4444' }, // Mantiene il rosso per "Ferma"
  ctaReplay: { marginTop: 12 }, // backgroundColor sarà impostato dinamicamente
  ctaText: { color: 'white', fontSize: 18, fontWeight: '800' },

  doneTitle: { marginTop: 10, fontSize: 22, fontWeight: '800' },
  doneSub: { marginTop: 4, fontSize: 15 },

  // Audio & Haptics controls styles
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    minWidth: 100,
    justifyContent: 'center',
  },
  controlButtonActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  controlButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  controlButtonTextActive: {
    // Colore sarà impostato dinamicamente
  },
});
