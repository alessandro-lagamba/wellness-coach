import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ScrollView,
  Image,
  StatusBar,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HealthPermissionsModal } from './HealthPermissionsModal';

const { width, height } = Dimensions.get('window');

interface OnboardingScreenProps {
  onComplete: () => void;
}

interface OnboardingStep {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  gradient: string[];
  features: string[];
  actionText: string;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Benvenuto in Wellness Coach',
    subtitle: 'Il tuo compagno AI per il benessere',
    description: 'Scopri come l\'intelligenza artificiale può trasformare la tua routine di benessere quotidiana.',
    icon: '🤖',
    gradient: ['#667eea', '#764ba2'],
    features: [
      'Analisi emotiva in tempo reale',
      'Monitoraggio della pelle avanzato',
      'Coaching personalizzato 24/7'
    ],
    actionText: 'Iniziamo!'
  },
  {
    id: 'features',
    title: 'Funzionalità Principali',
    subtitle: 'Tutto quello che ti serve in un\'app',
    description: 'Esplora le potenti funzionalità progettate per migliorare il tuo benessere.',
    icon: '✨',
    gradient: ['#f093fb', '#f5576c'],
    features: [
      'Dashboard personalizzabile con widget',
      'Analisi della pelle con AI',
      'Rilevamento emozioni avanzato',
      'Journaling intelligente',
      'Esercizi di respirazione guidati'
    ],
    actionText: 'Continua'
  },
  {
    id: 'health',
    title: 'Integrazione Salute',
    subtitle: 'Connetti i tuoi dati di salute',
    description: 'Sincronizza con Apple Health o Google Fit per un monitoraggio completo del tuo benessere.',
    icon: '❤️',
    gradient: ['#4facfe', '#00f2fe'],
    features: [
      'Sincronizzazione automatica con HealthKit',
      'Monitoraggio sonno e attività',
      'Analisi HRV e frequenza cardiaca',
      'Tracking passi e calorie'
    ],
    actionText: 'Abilita Salute'
  },
  {
    id: 'ai',
    title: 'AI Daily Copilot',
    subtitle: 'Il tuo assistente personale',
    description: 'Ricevi consigli personalizzati basati sui tuoi dati di salute e preferenze.',
    icon: '🧠',
    gradient: ['#43e97b', '#38f9d7'],
    features: [
      'Analisi giornaliera del tuo stato',
      'Raccomandazioni personalizzate',
      'Insights intelligenti sui tuoi dati',
      'Piano di benessere adattivo'
    ],
    actionText: 'Scopri AI Copilot'
  },
  {
    id: 'privacy',
    title: 'Privacy e Sicurezza',
    subtitle: 'I tuoi dati sono al sicuro',
    description: 'Utilizziamo crittografia end-to-end e non condividiamo mai i tuoi dati personali.',
    icon: '🔒',
    gradient: ['#fa709a', '#fee140'],
    features: [
      'Crittografia end-to-end',
      'Dati salvati localmente',
      'Nessuna condivisione con terzi',
      'Controllo completo sui tuoi dati'
    ],
    actionText: 'Accetta e Continua'
  }
];

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [showHealthPermissions, setShowHealthPermissions] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const currentStepData = ONBOARDING_STEPS[currentStep];
  const isLastStep = currentStep === ONBOARDING_STEPS.length - 1;

  const handleNext = async () => {
    // Haptic feedback
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Check if this is the health step
    if (currentStepData.id === 'health') {
      setShowHealthPermissions(true);
      return;
    }

    if (isLastStep) {
      // Complete onboarding
      await AsyncStorage.setItem('onboarding_completed', 'true');
      await AsyncStorage.setItem('onboarding_completed_at', new Date().toISOString());
      onComplete();
    } else {
      // Mark current step as completed
      const newCompletedSteps = new Set(completedSteps);
      newCompletedSteps.add(currentStepData.id);
      setCompletedSteps(newCompletedSteps);

      // Move to next step
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      
      // Scroll to next step
      if (scrollViewRef.current) {
        scrollViewRef.current.scrollTo({ x: nextStep * width, animated: true });
      }
    }
  };

  const handleSkip = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await AsyncStorage.setItem('onboarding_completed', 'true');
    await AsyncStorage.setItem('onboarding_skipped', 'true');
    onComplete();
  };

  const handleHealthPermissionsSuccess = () => {
    setShowHealthPermissions(false);
    // Continue to next step
    const nextStep = currentStep + 1;
    setCurrentStep(nextStep);
    
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ x: nextStep * width, animated: true });
    }
  };

  const handleHealthPermissionsClose = () => {
    setShowHealthPermissions(false);
    // Continue to next step even if permissions were skipped
    const nextStep = currentStep + 1;
    setCurrentStep(nextStep);
    
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ x: nextStep * width, animated: true });
    }
  };

  const handlePrevious = async () => {
    if (currentStep > 0) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      
      if (scrollViewRef.current) {
        scrollViewRef.current.scrollTo({ x: prevStep * width, animated: true });
      }
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* Background Gradient */}
      <LinearGradient
        colors={currentStepData.gradient}
        style={styles.backgroundGradient}
      />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.progressContainer}>
          {ONBOARDING_STEPS.map((_, index) => (
            <View
              key={index}
              style={[
                styles.progressDot,
                index <= currentStep ? styles.progressDotActive : styles.progressDotInactive
              ]}
            />
          ))}
        </View>
        
        {currentStep > 0 && (
          <TouchableOpacity onPress={handlePrevious} style={styles.backButton}>
            <MaterialCommunityIcons name="chevron-left" size={24} color="#fff" />
          </TouchableOpacity>
        )}
        
        <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
          <Text style={styles.skipText}>Salta</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        style={styles.scrollView}
      >
        {ONBOARDING_STEPS.map((step, index) => (
          <View key={step.id} style={styles.stepContainer}>
            <View style={styles.stepContent}>
              {/* Icon */}
              <View style={styles.iconContainer}>
                <Text style={styles.iconText}>{step.icon}</Text>
              </View>

              {/* Title */}
              <Text style={styles.title}>{step.title}</Text>
              <Text style={styles.subtitle}>{step.subtitle}</Text>
              
              {/* Description */}
              <Text style={styles.description}>{step.description}</Text>

              {/* Features */}
              <View style={styles.featuresContainer}>
                {step.features.map((feature, featureIndex) => (
                  <View key={featureIndex} style={styles.featureItem}>
                    <MaterialCommunityIcons 
                      name="check-circle" 
                      size={20} 
                      color="#fff" 
                      style={styles.featureIcon}
                    />
                    <Text style={styles.featureText}>{feature}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <BlurView intensity={20} style={styles.footerBlur}>
          <TouchableOpacity
            onPress={handleNext}
            style={styles.nextButton}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#fff', '#f8f9fa']}
              style={styles.nextButtonGradient}
            >
              <Text style={styles.nextButtonText}>
                {isLastStep ? 'Inizia il tuo viaggio' : currentStepData.actionText}
              </Text>
              <MaterialCommunityIcons 
                name={isLastStep ? "rocket-launch" : "arrow-right"} 
                size={20} 
                color="#667eea" 
              />
            </LinearGradient>
          </TouchableOpacity>
        </BlurView>
      </View>

      {/* Health Permissions Modal */}
      <HealthPermissionsModal
        visible={showHealthPermissions}
        onClose={handleHealthPermissionsClose}
        onSuccess={handleHealthPermissionsSuccess}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  progressDotActive: {
    backgroundColor: '#fff',
  },
  progressDotInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  backButton: {
    padding: 8,
    marginRight: 10,
  },
  skipButton: {
    padding: 8,
  },
  skipText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  stepContainer: {
    width,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  stepContent: {
    alignItems: 'center',
    maxWidth: 320,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  iconText: {
    fontSize: 48,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '500',
  },
  description: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
  },
  featuresContainer: {
    width: '100%',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
  },
  featureIcon: {
    marginRight: 12,
  },
  featureText: {
    color: '#fff',
    fontSize: 16,
    flex: 1,
    fontWeight: '500',
  },
  footer: {
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    paddingHorizontal: 20,
  },
  footerBlur: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  nextButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  nextButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 32,
  },
  nextButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#667eea',
    marginRight: 8,
  },
});
