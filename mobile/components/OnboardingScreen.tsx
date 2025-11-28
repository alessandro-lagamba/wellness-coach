import React, { useState, useRef, useCallback } from 'react';
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
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HealthPermissionsModal } from './HealthPermissionsModal';
import { WellnessPermissionsModal } from './WellnessPermissionsModal';
import WellnessSyncService from '../services/wellness-sync.service';
import PushNotificationService from '../services/push-notification.service';
import { AuthService } from '../services/auth.service';
import { useTranslation } from '../hooks/useTranslation'; // 🆕 i18n

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

// 🆕 Steps verranno costruiti dinamicamente con traduzioni
const getOnboardingSteps = (t: any): OnboardingStep[] => [
  {
    id: 'welcome',
    title: t('onboarding.welcome.title'),
    subtitle: t('onboarding.welcome.subtitle'),
    description: t('onboarding.welcome.description'),
    icon: '🤖',
    gradient: ['#667eea', '#764ba2'],
    features: [
      t('onboarding.welcome.features.0'),
      t('onboarding.welcome.features.1'),
      t('onboarding.welcome.features.2')
    ],
    actionText: t('onboarding.welcome.actionText')
  },
  {
    id: 'features',
    title: t('onboarding.features.title'),
    subtitle: t('onboarding.features.subtitle'),
    description: t('onboarding.features.description'),
    icon: '✨',
    gradient: ['#f093fb', '#f5576c'],
    features: [
      t('onboarding.features.features.0'),
      t('onboarding.features.features.1'),
      t('onboarding.features.features.2'),
      t('onboarding.features.features.3'),
      t('onboarding.features.features.4')
    ],
    actionText: t('onboarding.features.actionText')
  },
  {
    id: 'health',
    title: t('onboarding.health.title'),
    subtitle: t('onboarding.health.subtitle'),
    description: t('onboarding.health.description'),
    icon: '❤️',
    gradient: ['#4facfe', '#00f2fe'],
    features: [
      t('onboarding.health.features.0'),
      t('onboarding.health.features.1'),
      t('onboarding.health.features.2'),
      t('onboarding.health.features.3')
    ],
    actionText: t('onboarding.health.actionText')
  },
  {
    id: 'ai',
    title: t('onboarding.ai.title'),
    subtitle: t('onboarding.ai.subtitle'),
    description: t('onboarding.ai.description'),
    icon: '🧠',
    gradient: ['#43e97b', '#38f9d7'],
    features: [
      t('onboarding.ai.features.0'),
      t('onboarding.ai.features.1'),
      t('onboarding.ai.features.2'),
      t('onboarding.ai.features.3')
    ],
    actionText: t('onboarding.ai.actionText')
  },
  {
    id: 'food',
    title: t('onboarding.food.title'),
    subtitle: t('onboarding.food.subtitle'),
    description: t('onboarding.food.description'),
    icon: '🍽️',
    gradient: ['#ff9a56', '#ff6a88'],
    features: [
      t('onboarding.food.features.0'),
      t('onboarding.food.features.1'),
      t('onboarding.food.features.2'),
      t('onboarding.food.features.3')
    ],
    actionText: t('onboarding.food.actionText')
  },
  {
    id: 'privacy',
    title: t('onboarding.privacy.title'),
    subtitle: t('onboarding.privacy.subtitle'),
    description: t('onboarding.privacy.description'),
    icon: '🔒',
    gradient: ['#fa709a', '#fee140'],
    features: [
      t('onboarding.privacy.features.0'),
      t('onboarding.privacy.features.1'),
      t('onboarding.privacy.features.2'),
      t('onboarding.privacy.features.3')
    ],
    actionText: t('onboarding.privacy.actionText')
  }
];

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete }) => {
  const { t } = useTranslation(); // 🆕 i18n hook
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [showHealthPermissions, setShowHealthPermissions] = useState(false);
  const [showWellnessPermissions, setShowWellnessPermissions] = useState(false);
  const [requestingWellnessPermissions, setRequestingWellnessPermissions] = useState(false);
  const wellnessSyncServiceRef = useRef(WellnessSyncService.getInstance());
  const scrollViewRef = useRef<ScrollView>(null);
  
  // 🆕 Costruisci steps dinamicamente con traduzioni
  const ONBOARDING_STEPS = getOnboardingSteps(t);
  const currentStepData = ONBOARDING_STEPS[currentStep];
  const isLastStep = currentStep === ONBOARDING_STEPS.length - 1;

  const advanceToNextStep = () => {
    const newCompletedSteps = new Set(completedSteps);
    newCompletedSteps.add(currentStepData.id);
    setCompletedSteps(newCompletedSteps);

    const nextStep = currentStep + 1;
    setCurrentStep(nextStep);

    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ x: nextStep * width, animated: true });
    }
  };

  const handleNext = async () => {
    // Haptic feedback
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Check if this is the health step
    if (currentStepData.id === 'health') {
      setShowHealthPermissions(true);
      return;
    }

    // Device permissions are now requested when needed (when user tries to use camera/microphone)
    // Removed automatic request during onboarding

    if (isLastStep) {
      // Complete onboarding
      try {
        await AsyncStorage.setItem('onboarding_completed', 'true');
        await AsyncStorage.setItem('onboarding_completed_at', new Date().toISOString());
      } catch (error) {
        console.error('Error saving onboarding completion:', error);
        // Continue anyway - non critico
      }
      onComplete();
    } else {
      advanceToNextStep();
    }
  };

  const handleSkip = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await AsyncStorage.setItem('onboarding_completed', 'true');
      await AsyncStorage.setItem('onboarding_skipped', 'true');
    } catch (error) {
      console.error('Error saving onboarding skip:', error);
      // Continue anyway - non critico
    }
    onComplete();
  };

  const handleHealthPermissionsSuccess = () => {
    setShowHealthPermissions(false);
    setShowWellnessPermissions(true);
  };

  const handleHealthPermissionsClose = () => {
    setShowHealthPermissions(false);
    setShowWellnessPermissions(true);
  };

  const enableNotificationScheduling = useCallback(async () => {
    try {
      const currentUser = await AuthService.getCurrentUser();
      const pushService = PushNotificationService.getInstance();
      await pushService.setEnabled(true);
      if (currentUser?.id) {
        await pushService.initialize(currentUser.id);
      }
      const { NotificationService } = await import('../services/notifications.service');
      await NotificationService.scheduleDefaults();
    } catch (error) {
      console.error('Error enabling notification scheduling during onboarding:', error);
    }
  }, []);

  const handleWellnessPermissionsEnable = async () => {
    try {
      setRequestingWellnessPermissions(true);
      const result = await wellnessSyncServiceRef.current.requestPermissions();

      if (result.notifications) {
        await enableNotificationScheduling();
      }

      setShowWellnessPermissions(false);
      advanceToNextStep();

      if (result.calendar || result.notifications) {
        Alert.alert(t('common.success'), t('home.permissions.success'));
      }
    } catch (error) {
      console.error('Error requesting wellness permissions:', error);
      Alert.alert(t('common.error'), t('home.permissions.error'));
    } finally {
      setRequestingWellnessPermissions(false);
    }
  };

  const handleWellnessPermissionsSkip = () => {
    setShowWellnessPermissions(false);
    advanceToNextStep();
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
          <Text style={styles.skipText}>{t('onboarding.skip')}</Text>
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
                {isLastStep ? t('onboarding.startJourney') : currentStepData.actionText}
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
      <WellnessPermissionsModal
        visible={showWellnessPermissions}
        onEnable={handleWellnessPermissionsEnable}
        onSkip={handleWellnessPermissionsSkip}
        loading={requestingWellnessPermissions}
        missingCalendar={true}
        missingNotifications={true}
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
