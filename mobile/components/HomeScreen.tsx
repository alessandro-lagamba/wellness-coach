import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ScrollView,
  Alert,
  Pressable,
  Platform,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar } from './Avatar';
import Colors from '../constants/Colors';
import { useTheme } from '../contexts/ThemeContext';
import WellnessSyncService from '../services/wellness-sync.service';
import { MomentumService, MomentumData } from '../services/momentum.service';
import { AuthService } from '../services/auth.service';
import PillDetailPopup from './PillDetailPopup';
import MiniGaugeChart from './MiniGaugeChart';
import MiniInfoCard from './MiniInfoCard';
import { TodayGlanceService } from '../services/today-glance.service';
import { WidgetData } from '../services/widget-config.service';
import { useWidgetConfig, WidgetDataService } from '../services/widget-config.service';
import EditableWidget from './EditableWidget';
import { useTutorial } from '../contexts/TutorialContext';
import WidgetGoalModal from './WidgetGoalModal';
import { widgetGoalsService } from '../services/widget-goals.service';
import { HealthPermissionsModal } from './HealthPermissionsModal';
// WelcomeOverlay rimosso - usiamo solo InteractiveTutorial
import { useHealthData } from '../hooks/useHealthData';
import { useChartConfig, ChartType } from '../services/chart-config.service';
import { ChartSelectionModal } from './ChartSelectionModal';
import { CopilotProvider, walkthroughable, CopilotStep, useCopilot } from 'react-native-copilot';
import { TutorialTooltip } from './TutorialTooltip';
import { OnboardingService } from '../services/onboarding.service';
// Removed useInsights - now using DailyCopilot for insights
import DailyCopilot from './DailyCopilot';
import RecommendationDetailModal from './RecommendationDetailModal';
import { WellnessPermissionsModal } from './WellnessPermissionsModal';
import PushNotificationService from '../services/push-notification.service';
import DailyCopilotHistory from './DailyCopilotHistory';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Slider from '@react-native-community/slider';
import { HydrationActionModal } from './HydrationActionModal';
import MoodCheckinCard from './MoodCheckinCard';
import SleepCheckinCard from './SleepCheckinCard';
import PrimaryCTA from './PrimaryCTA';
import { useTranslation } from '../hooks/useTranslation'; // 🆕 i18n
import { HealthDataStatus } from '../types/health.types';
import { WidgetSelectionModal } from './WidgetSelectionModal';
import { MiniTrendChart } from './MiniTrendChart';
import { HealthDataSyncService } from '../services/health-data-sync.service';
import { UserFeedbackService } from '../services/user-feedback.service';
import { DatabaseVerificationService } from '../services/database-verification.service';
import { DataValidationService } from '../services/data-validation.service';
import { RetryService } from '../services/retry.service';
import { OperationLockService } from '../services/operation-lock.service';
import { AvatarService } from '../services/avatar.service';
import AvatarCommunityModal from './AvatarCommunityModal';
import { ChartDetailModal } from './ChartDetailModal';

const { width } = Dimensions.get('window');
// 🔥 FIX: Calcola larghezza dinamica per il grafico.
// Aumentiamo la larghezza sottraendo meno spazio (150 invece di 180) per avvicinarci al look Android
const CHART_WIDTH = Math.min(400, width - 150);

const PLACEHOLDER_TREND_DATA = {
  steps: [6200, 6800, 7000, 7300, 7100, 7600, 7800],
  sleepHours: [7.2, 7.5, 7.1, 7.8, 7.4, 7.6, 7.3],
  hrv: [35, 38, 36, 40, 39, 41, 38],
  heartRate: [66, 65, 67, 64, 66, 65, 63],
  hydration: [750, 900, 1100, 1000, 1200, 1300, 1400],
  meditation: [8, 10, 12, 9, 14, 11, 13],
};

const PLACEHOLDER_WIDGET_SNAPSHOT = {
  steps: 6777,
  hydrationMl: 1250,
  hydrationGlasses: 5,
  meditationMinutes: 18,
};

// Removed QuickLink interface - replaced with Today at a glance widgets

interface HighlightCard {
  id: string;
  label: string;
  value: string;
  delta: string;
  colors: [string, string];
  icon: string;
}

interface DailyActivity {
  id: string;
  title: string;
  description: string;
  icon: string;
  completed: boolean;
  progress?: number; // 0-100 for partial completion
  time?: string;
  category: 'mindfulness' | 'movement' | 'nutrition' | 'recovery';
  syncedToCalendar?: boolean;
  syncedToReminders?: boolean;
}

// Stats will be generated dynamically based on momentum data

// 🆕 highlightCards verranno costruiti dinamicamente con traduzioni

// 🆕 todaysActivities verranno costruiti dinamicamente con traduzioni nel componente

// Removed quickLinks and QuickLink interface - replaced with Today at a glance widgets

interface HomeScreenProps {
  user?: any;
  onLogout?: () => void;
}

const WalkthroughableView = walkthroughable(View);
const WalkthroughableText = walkthroughable(Text);

export const HomeScreen: React.FC<HomeScreenProps> = ({ user, onLogout }) => {
  // We need to wrap the content in a component to use useCopilot hook
  return (
    <CopilotProvider
      overlay="view"
      tooltipComponent={TutorialTooltip}
      verticalOffset={Platform.OS === 'ios' ? 40 : 0}
      arrowColor="transparent"
      backdropColor="rgba(0, 0, 0, 0.6)"
      labels={{
        previous: "Indietro",
        next: "Avanti",
        skip: "Salta",
        finish: "Finito"
      }}
    >
      <HomeScreenContent user={user} onLogout={onLogout} />
    </CopilotProvider>
  );
};

const HomeScreenContent: React.FC<HomeScreenProps> = ({ user, onLogout }) => {
  const { start: startCopilot } = useCopilot();
  const { t, language } = useTranslation(); // 🆕 i18n hook
  const { colors: themeColors } = useTheme();
  const { setShowTutorial } = useTutorial();
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);
  // 🆕 Attività hardcoded di default (sempre presenti)
  const defaultActivities = useMemo<DailyActivity[]>(() => [
    {
      id: 'morning-meditation',
      title: t('home.activities.morningMeditation'),
      description: t('home.activities.breathingExercise'),
      icon: 'leaf',
      completed: true,
      time: '8:00 AM',
      category: 'mindfulness',
    },
    {
      id: 'water-intake',
      title: t('home.activities.hydrationGoal'),
      description: t('home.activities.drinkGlasses', { count: 8 }),
      icon: 'tint',
      completed: false,
      progress: 62,
      time: t('home.activities.ongoing'),
      category: 'nutrition',
    },
    {
      id: 'walk',
      title: t('home.activities.eveningWalk'),
      description: t('home.activities.outdoorWalk'),
      icon: 'road',
      completed: false,
      time: '6:00 PM',
      category: 'movement',
    },
    {
      id: 'journal',
      title: t('home.activities.gratitudeJournal'),
      description: t('home.activities.gratefulThings'),
      icon: 'book',
      completed: false,
      time: '9:00 PM',
      category: 'mindfulness',
    },
  ], [t, language]);

  // 🆕 Attività caricate dal database
  const [wellnessActivities, setWellnessActivities] = useState<DailyActivity[]>([]);

  // 🆕 Combina attività default con quelle dal database
  const todaysActivities = useMemo<DailyActivity[]>(() => {
    // Mappa le attività wellness dal database a DailyActivity
    const mappedWellnessActivities: DailyActivity[] = wellnessActivities.map((activity) => ({
      id: activity.id,
      title: activity.title,
      description: activity.description,
      icon: activity.icon,
      completed: activity.completed,
      time: activity.time,
      category: activity.category,
      syncedToCalendar: activity.syncedToCalendar,
      syncedToReminders: activity.syncedToReminders,
    }));

    // Combina: prima le default, poi quelle dal database
    return [...defaultActivities, ...mappedWellnessActivities];
  }, [defaultActivities, wellnessActivities]);

  const placeholderMessages = useMemo(
    () => ({
      loading: t('home.placeholders.loading'),
      'waiting-permission': t('home.placeholders.waitingPermission'),
      empty: t('home.placeholders.empty'),
      error: t('home.placeholders.error'),
      ready: '',
    }),
    [t]
  );

  const placeholderChartSamples = useMemo(() => ({
    steps: {
      value: 7800,
      trend: [3200, 4800, 5600, 6800, 7200, 7600, 7800],
      max: 10000,
    },
    sleepHours: {
      value: 7.5,
      trend: [6.2, 6.8, 7.1, 7.6, 7.4, 7.9, 8.0],
      max: 10,
    },
    hrv: {
      value: 38,
      trend: [28, 30, 35, 34, 36, 37, 38],
      max: 60,
    },
    heartRate: {
      value: 72,
      trend: [72, 70, 68, 73, 74, 71, 72],
      max: 120,
    },
    hydration: {
      value: 6,
      trend: [3, 4, 5, 6, 5, 7, 6],
      max: 10,
    },
    meditation: {
      value: 18,
      trend: [5, 8, 10, 12, 14, 16, 18],
      max: 40,
    },
  }), []);

  // 🔥 Rimuoviamo stato duplicato - usiamo direttamente todaysActivities
  // const [activities, setActivities] = useState<DailyActivity[]>(() => todaysActivities);
  const [syncService] = useState(() => WellnessSyncService.getInstance());
  const [permissions, setPermissions] = useState({ calendar: false, notifications: false });
  const [showWellnessPermissionsModal, setShowWellnessPermissionsModal] = useState(false);
  const [requestingWellnessPermissions, setRequestingWellnessPermissions] = useState(false);
  useEffect(() => {
    let isMounted = true;
    const syncPermissionStatus = async () => {
      try {
        const status = await syncService.getPermissionsStatus();
        if (isMounted) {
          setPermissions(status);
        }
      } catch (error) {
        console.error('Error checking wellness permissions:', error);
      }
    };

    syncPermissionStatus();

    return () => {
      isMounted = false;
    };
  }, [syncService]);

  const [userFirstName, setUserFirstName] = useState<string>('User');
  const [momentumData, setMomentumData] = useState<MomentumData | null>(null);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [avatarGenerating, setAvatarGenerating] = useState(false);
  const [communityModalVisible, setCommunityModalVisible] = useState(false);
  const communityAvatars = useMemo(() => [
    { id: 'community-1', imageUrl: 'https://images.unsplash.com/photo-1544723795-3fb646b5b39?auto=format&fit=crop&w=400&q=80', displayName: 'Elena R.', streak: 24 },
    { id: 'community-2', imageUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=400&q=80', displayName: 'Marco T.', streak: 15 },
    { id: 'community-3', imageUrl: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=400&q=80', displayName: 'Giulia S.', streak: 12 },
    { id: 'community-4', imageUrl: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=400&q=80', displayName: 'Luca P.', streak: 9 },
    { id: 'community-5', imageUrl: 'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?auto=format&fit=crop&w=400&q=80', displayName: 'Sara B.', streak: 18 },
    { id: 'community-6', imageUrl: 'https://images.unsplash.com/photo-1523475472560-d2df97ec485c?auto=format&fit=crop&w=400&q=80', displayName: 'Daniela C.', streak: 7 },
    { id: 'community-7', imageUrl: 'https://images.unsplash.com/photo-1542145938-0b3c26372d4d?auto=format&fit=crop&w=400&q=80', displayName: 'Michele F.', streak: 20 },
    { id: 'community-8', imageUrl: 'https://images.unsplash.com/photo-1525130413817-d45c1d127c42?auto=format&fit=crop&w=400&q=80', displayName: 'Valentina H.', streak: 11 },
    { id: 'community-9', imageUrl: 'https://images.unsplash.com/photo-1481214110143-ed630356e1bb?auto=format&fit=crop&w=400&q=80', displayName: 'Andrea L.', streak: 26 },
    { id: 'community-10', imageUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80', displayName: 'Irene G.', streak: 14 },
    { id: 'community-11', imageUrl: 'https://images.unsplash.com/photo-1554151228-14d9def656e4?auto=format&fit=crop&w=400&q=80', displayName: 'Paolo D.', streak: 8 },
    { id: 'community-12', imageUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80', displayName: 'Chiara M.', streak: 17 },
    { id: 'community-13', imageUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80', displayName: 'Francesca V.', streak: 5 },
    { id: 'community-14', imageUrl: 'https://images.unsplash.com/photo-1507120410856-1f35574c3b45?auto=format&fit=crop&w=400&q=80', displayName: 'Federico N.', streak: 23 },
    { id: 'community-15', imageUrl: 'https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=400&q=80', displayName: 'Marta O.', streak: 10 },
    { id: 'community-16', imageUrl: 'https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?auto=format&fit=crop&w=400&q=80', displayName: 'Stefano Q.', streak: 6 },
    { id: 'community-17', imageUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80', displayName: 'Claudia Z.', streak: 19 },
    { id: 'community-18', imageUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80', displayName: 'Davide K.', streak: 21 },
    { id: 'community-19', imageUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=400&q=80', displayName: 'Alice E.', streak: 13 },
    { id: 'community-20', imageUrl: 'https://images.unsplash.com/photo-1614285146320-45e7d88b16a5?auto=format&fit=crop&w=400&q=80', displayName: 'Giorgia U.', streak: 16 },
    { id: 'community-21', imageUrl: 'https://images.unsplash.com/photo-1603415526960-f7e0328c63b1?auto=format&fit=crop&w=400&q=80', displayName: 'Matteo Y.', streak: 9 },
    { id: 'community-22', imageUrl: 'https://images.unsplash.com/photo-1521391406205-4a6af174a7f6?auto=format&fit=crop&w=400&q=80', displayName: 'Laura P.', streak: 4 },
    { id: 'community-23', imageUrl: 'https://images.unsplash.com/photo-1552058544-f2b08422138a?auto=format&fit=crop&w=400&q=80', displayName: 'Cristian W.', streak: 28 },
    { id: 'community-24', imageUrl: 'https://images.unsplash.com/photo-1531891437562-4301cf35b7e4?auto=format&fit=crop&w=400&q=80', displayName: 'Sofia J.', streak: 12 },
  ], []);
  const [selectedPill, setSelectedPill] = useState<'streak' | 'momentum' | 'next-session' | null>(null);
  const [todayGlanceWidgets, setTodayGlanceWidgets] = useState<WidgetData[]>([]);

  // Carica l'avatar al mount e quando la schermata torna in focus
  const loadAvatar = useCallback(async () => {
    try {
      // Prima prova a recuperare dal database (user_profiles.avatar_url)
      const currentUser = await AuthService.getCurrentUser();
      if (currentUser?.id) {
        const userProfile = await AuthService.getUserProfile(currentUser.id);
        if (userProfile?.avatar_url) {
          setAvatarUri(userProfile.avatar_url);
          // Salva anche in AsyncStorage come cache locale
          await AsyncStorage.setItem('user:avatarUri', userProfile.avatar_url);
          return;
        }
      }

      // Fallback: recupera da AsyncStorage (per retrocompatibilità)
      const savedAvatar = await AsyncStorage.getItem('user:avatarUri');
      if (savedAvatar) {
        setAvatarUri(savedAvatar);

        // 🔄 MIGRAZIONE: Se l'avatar esiste in AsyncStorage ma non nel DB, migralo al DB
        // Questo assicura che gli avatar esistenti vengano sincronizzati nel database
        if (currentUser?.id && savedAvatar.startsWith('http')) {
          try {
            await AuthService.updateUserProfile(currentUser.id, { avatar_url: savedAvatar });
            console.log('✅ Avatar migrato da AsyncStorage al database');
          } catch (migrationError) {
            // Non bloccare se la migrazione fallisce (non critico)
            console.warn('⚠️ Errore durante migrazione avatar al DB (non critico):', migrationError);
          }
        }
      }
    } catch (error) {
      console.error('Error loading avatar:', error);
      // In caso di errore, prova comunque AsyncStorage
      try {
        const savedAvatar = await AsyncStorage.getItem('user:avatarUri');
        if (savedAvatar) {
          setAvatarUri(savedAvatar);
        }
      } catch (storageError) {
        console.error('Error loading avatar from storage:', storageError);
      }
    }
  }, []);

  useEffect(() => {
    loadAvatar();
  }, [loadAvatar]);

  // Ricarica l'avatar quando la schermata torna in focus (dopo aver creato un nuovo avatar)
  useFocusEffect(
    useCallback(() => {
      loadAvatar();
    }, [loadAvatar])
  );

  // Widget configuration
  const {
    config: widgetConfig,
    loading: configLoading,
    toggleWidget, changeSize,
    addWidget,                // useremo questo al punto (B)
  } = useWidgetConfig();
  const [widgetData, setWidgetData] = useState<WidgetData[]>([]);
  const [dragTargetPosition, setDragTargetPosition] = useState<number | null>(null);
  const [editMode, setEditMode] = useState<boolean>(false);
  const [goalModal, setGoalModal] = useState<{ visible: boolean; widgetId: 'steps' | 'hydration' | 'meditation' | 'sleep' | null }>({ visible: false, widgetId: null });
  const [healthPermissionsModal, setHealthPermissionsModal] = useState<boolean>(false);
  // WelcomeOverlay rimosso - usiamo solo InteractiveTutorial
  const [recommendationModal, setRecommendationModal] = useState<{ visible: boolean; recommendation: any }>({ visible: false, recommendation: null });
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [widgetSelectionModal, setWidgetSelectionModal] = useState<{ visible: boolean; position: number }>({ visible: false, position: 0 });
  const [weeklyTrendData, setWeeklyTrendData] = useState<{
    steps: number[];
    sleepHours: number[];
    hrv: number[];
    heartRate: number[];
    hydration: number[];
    meditation: number[];
  }>({ steps: [], sleepHours: [], hrv: [], heartRate: [], hydration: [], meditation: [] });
  const [chartEditMode, setChartEditMode] = useState<boolean>(false);
  const [chartSelectionModal, setChartSelectionModal] = useState<boolean>(false);
  const [hydrationActionModal, setHydrationActionModal] = useState<boolean>(false);
  const [chartDetailModal, setChartDetailModal] = useState<{ visible: boolean; chartType: ChartType | null; currentValue?: number; color: string }>({
    visible: false,
    chartType: null,
    currentValue: undefined,
    color: '#10b981',
  });

  // Chart configuration
  const { enabledCharts, toggleChart, config: chartConfig, enableChart, getAvailableCharts } = useChartConfig();
  const disabledCharts = chartConfig.filter(c => !c.enabled);
  const [availableChartsList, setAvailableChartsList] = useState<ChartType[]>([]);

  // Carica i grafici disponibili quando entra in modalità edit
  useEffect(() => {
    if (chartEditMode) {
      getAvailableCharts().then(setAvailableChartsList);
    }
  }, [chartEditMode, getAvailableCharts]);

  // Health data hook
  const { permissions: healthPermissions, hasData: hasHealthData, isInitialized, healthData, syncData, refreshPermissions, status: healthStatus } = useHealthData();
  const hasAnyHealthPermission =
    healthPermissions.steps ||
    healthPermissions.heartRate ||
    healthPermissions.sleep ||
    healthPermissions.hrv;
  const initialHealthSyncAttempted = useRef(false);

  useEffect(() => {
    if (!isInitialized) return;
    if (!hasAnyHealthPermission) return;
    if (healthData && Object.keys(healthData).length > 0) return;
    if (initialHealthSyncAttempted.current) return;

    initialHealthSyncAttempted.current = true;
    syncData().catch((error) => {
      console.error('❌ Failed to sync health data for widgets:', error);
    });
  }, [
    isInitialized,
    hasAnyHealthPermission,
    healthData,
    syncData,
  ]);

  useEffect(() => {
    if (!hasAnyHealthPermission) {
      initialHealthSyncAttempted.current = false;
    }
  }, [hasAnyHealthPermission]);

  // 🔥 Helper function per costruire i widget dati da healthData
  const buildWidgetDataFromHealthDataHelper = async (
    hd: any,
    stepsGoal: number,
    hydrationGoalInGlasses: number, // 🔥 FIX: Goal sempre in bicchieri internamente
    meditationGoal: number,
    sleepGoal: number,
    cycle?: { day: number; phase: string; phaseName: string; nextPeriodDays: number; cycleLength: number } | null
  ): Promise<WidgetData[]> => {
    // 🔥 FIX: Converti goal e valore corrente all'unità preferita per la visualizzazione
    const { hydrationUnitService } = await import('../services/hydration-unit.service');
    const preferredUnit = await hydrationUnitService.getPreferredUnit();
    const unitConfig = hydrationUnitService.getUnitConfig(preferredUnit);
    const hydrationMl = hd.hydration || 0;
    const hydrationInPreferredUnit = hydrationUnitService.mlToUnit(hydrationMl, preferredUnit);
    const hydrationGoalInPreferredUnit = hydrationUnitService.mlToUnit(hydrationGoalInGlasses * 250, preferredUnit);
    const normalizeHrv = (value?: number | null) => {
      if (typeof value !== 'number' || Number.isNaN(value) || value <= 0) return 0;
      return value >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
    };
    const normalizedHrv = normalizeHrv(hd.hrv);
    const normalizedResting = typeof hd.restingHeartRate === 'number' && hd.restingHeartRate > 0
      ? Math.round(hd.restingHeartRate)
      : 0;
    const normalizedCurrentHR = typeof hd.heartRate === 'number' && hd.heartRate > 0
      ? Math.round(hd.heartRate)
      : 0;
    const rawDistance = typeof hd.distance === 'number' && hd.distance > 0 ? hd.distance : 0;
    const fallbackDistanceKm = Math.round(((hd.steps || 0) * 0.0008) * 100) / 100;
    const distanceKm = rawDistance > 0
      ? rawDistance >= 100
        ? Math.round((rawDistance / 1000) * 100) / 100
        : Math.round(rawDistance * 100) / 100
      : fallbackDistanceKm;
    const resolvedDistanceKm = distanceKm > 0 ? distanceKm : fallbackDistanceKm;
    const estimatedCalories = typeof hd.calories === 'number' && hd.calories > 0
      ? hd.calories
      : (hd.steps || 0) * 0.04;

    return [
      {
        id: 'steps', title: t('widgets.steps'), icon: '🚶', color: '#10b981', backgroundColor: '#f0fdf4', category: 'health',
        steps: {
          current: Math.max(0, hd.steps || 0),
          goal: stepsGoal,
          km: resolvedDistanceKm,
          calories: Math.round(estimatedCalories),
        }
      },
      {
        id: 'meditation', title: t('widgets.meditation'), icon: '🧘', color: '#8b5cf6', backgroundColor: '#f3f4f6', category: 'wellness',
        meditation: { minutes: Math.max(0, hd.mindfulnessMinutes || 0), goal: meditationGoal, sessions: 0, streak: 0, favoriteType: 'Breathing' }
      },
      {
        id: 'hydration', title: t('widgets.hydration'), icon: '💧', color: '#3b82f6', backgroundColor: '#eff6ff', category: 'health',
        hydration: { 
          glasses: Math.round(hydrationInPreferredUnit * 10) / 10, // 🔥 FIX: Usa unità preferita (anche se si chiama "glasses" per retrocompatibilità)
          goal: Math.round(hydrationGoalInPreferredUnit * 10) / 10, // 🔥 FIX: Goal in unità preferita
          ml: Math.max(0, hydrationMl), 
          lastDrink: '',
          preferredUnit: preferredUnit, // 🆕 Aggiungi unità preferita
          unitLabel: unitConfig.label, // 🆕 Aggiungi etichetta unità
        }
      },
      {
        id: 'sleep', title: t('widgets.sleep'), icon: '🌙', color: '#6366f1', backgroundColor: '#eef2ff', category: 'health',
        sleep: { hours: Math.round((hd.sleepHours || 0) * 10) / 10, quality: Math.max(0, hd.sleepQuality || 0), goal: sleepGoal, deepSleep: hd.deepSleepMinutes ? `${Math.floor(hd.deepSleepMinutes / 60)}h ${Math.round(hd.deepSleepMinutes % 60)}m` : '—', remSleep: hd.remSleepMinutes ? `${Math.floor(hd.remSleepMinutes / 60)}h ${Math.round(hd.remSleepMinutes % 60)}m` : '—', bedtime: '', wakeTime: '' }
      },
      {
        id: 'hrv', title: t('widgets.hrv'), icon: '🫀', color: '#ef4444', backgroundColor: '#fef2f2', category: 'health',
        hrv: {
          value: normalizedHrv,
          avgHRV: normalizedHrv,
          currentHR: normalizedCurrentHR,
          restingHR: normalizedResting,
          recovery: 'Good',
        }
      },
      {
        id: 'analyses', title: t('widgets.analyses'), icon: '📊', color: '#10b981', backgroundColor: '#f0fdf4', category: 'analysis',
        analyses: { completed: true, emotionAnalysis: true, skinAnalysis: true, lastCheckIn: t('home.analyses.today'), streak: 0 }
      },
      // 🆕 Aggiungi widget ciclo solo se l'utente è di genere femminile E ci sono dati disponibili
      ...(userGender === 'female' && cycle ? [{
        id: 'cycle', title: t('widgets.cycle'), icon: '🌸', color: '#ec4899', backgroundColor: '#fdf2f8', category: 'health' as const,
        cycle: {
          day: cycle.day,
          phase: cycle.phase,
          phaseName: cycle.phaseName,
          nextPeriodDays: cycle.nextPeriodDays,
          cycleLength: cycle.cycleLength,
        }
      }] : []),
    ];
  };

  // 🆕 Stato per i dati del ciclo mestruale
  const [cycleData, setCycleData] = useState<{ day: number; phase: string; phaseName: string; nextPeriodDays: number; cycleLength: number } | null>(null);
  // 🆕 Stato per il genere dell'utente (per filtrare il widget ciclo)
  const [userGender, setUserGender] = useState<'male' | 'female' | 'other' | 'prefer_not_to_say' | null>(null);

  // 🆕 Funzione per caricare genere e dati del ciclo
  const loadUserGenderAndCycle = useCallback(async () => {
    try {
      const currentUser = await AuthService.getCurrentUser();
      if (currentUser?.id) {
        const userProfile = await AuthService.getUserProfile(currentUser.id);
        const gender = userProfile?.gender || null;
        setUserGender(gender);

        // Carica i dati del ciclo solo se l'utente è di genere femminile
        if (gender === 'female') {
          // 🔥 FIX: Abilita automaticamente il widget del ciclo per utenti di genere femminile
          const { widgetConfigService } = await import('../services/widget-config.service');
          const config = await widgetConfigService.getWidgetConfig();
          const cycleWidget = config.find(w => w.id === 'cycle');
          if (cycleWidget && !cycleWidget.enabled) {
            // Abilita il widget se non è già abilitato
            await widgetConfigService.enableWidget('cycle', 'small');
            console.log('✅ Cycle widget automatically enabled for female user');
          }

          const { menstrualCycleService } = await import('../services/menstrual-cycle.service');
          const cycle = await menstrualCycleService.getCycleData();
          setCycleData(cycle);
        } else {
          setCycleData(null);
        }
      }
    } catch (error) {
      console.warn('[HomeScreen] Failed to load user gender/cycle data:', error);
      setCycleData(null);
    }
  }, []);

  // 🆕 Carica il genere dell'utente e i dati del ciclo mestruale all'avvio
  useEffect(() => {
    loadUserGenderAndCycle();
  }, [loadUserGenderAndCycle]);

  // 🆕 Ricarica genere e ciclo quando la schermata torna in focus (es. dopo aver cambiato il genere nelle impostazioni)
  useFocusEffect(
    useCallback(() => {
      loadUserGenderAndCycle();
    }, [loadUserGenderAndCycle])
  );

  // 🔥 FIX: Helper function per tradurre widget title (evita duplicazione)
  const translateWidgetTitle = useCallback((widgetId: string): string => {
    switch (widgetId) {
      case 'steps': return t('widgets.steps');
      case 'meditation': return t('widgets.meditation');
      case 'hydration': return t('widgets.hydration');
      case 'sleep': return t('widgets.sleep');
      case 'hrv': return t('widgets.hrv');
      case 'analyses': return t('widgets.analyses');
      case 'cycle': return t('widgets.cycle');
      default: return widgetId;
    }
  }, [t]);

  // Costruisce i dati dei widget partendo dai dati reali di salute + goals
  // 🔥 FIX: Memoizziamo per evitare ricreazioni ad ogni render
  const buildWidgetDataFromHealth = useCallback(async (): Promise<WidgetData[]> => {
    const goals = await widgetGoalsService.getGoals();
    const stepsGoal = goals?.steps ?? 10000;
    // 🔥 FIX: Mantieni sempre il goal in bicchieri internamente (per retrocompatibilità)
    const hydrationGoalInGlasses = goals?.hydration ?? 8;
    const meditationGoal = goals?.meditation ?? 30;
    const sleepGoal = goals?.sleep ?? 8;

    if (healthStatus !== 'ready') {
      // 🔥 FIX: Per placeholder, converti goal all'unità preferita per la visualizzazione
      const { hydrationUnitService } = await import('../services/hydration-unit.service');
      const preferredUnit = await hydrationUnitService.getPreferredUnit();
      const hydrationGoalForDisplay = hydrationUnitService.mlToUnit(hydrationGoalInGlasses * 250, preferredUnit);
      
      const placeholderData = WidgetDataService.generateWidgetData({
        steps: stepsGoal,
        hydration: Math.round(hydrationGoalForDisplay), // Usa unità preferita per placeholder
        meditation: meditationGoal,
        sleep: sleepGoal,
      }).map((widget) => ({
        ...widget,
        title: translateWidgetTitle(widget.id),
        placeholder: {
          status: healthStatus,
          message: placeholderMessages[healthStatus],
        },
      }));
      return placeholderData;
    }

    // 🔥 Gestisci null/undefined healthData
    if (!healthData) {
      // 🔥 FIX: Rimuoviamo console.warn eccessivi
      // Ritorna widget con valori 0 se healthData non è disponibile
      const hd = {
        steps: 0,
        heartRate: 0,
        restingHeartRate: 0,
        hrv: 0,
        sleepHours: 0,
        sleepQuality: 0,
        deepSleepMinutes: 0,
        remSleepMinutes: 0,
        hydration: 0,
        mindfulnessMinutes: 0,
        distance: 0,
        calories: 0,
      };
      return await buildWidgetDataFromHealthDataHelper(hd, stepsGoal, hydrationGoalInGlasses, meditationGoal, sleepGoal);
    }

    const hd = healthData;
    // 🆕 Passa cycleData solo se l'utente è di genere femminile
    const cycleForWidget = userGender === 'female' ? cycleData : null;
    return await buildWidgetDataFromHealthDataHelper(hd, stepsGoal, hydrationGoalInGlasses, meditationGoal, sleepGoal, cycleForWidget);
  }, [healthData, healthStatus, placeholderMessages, translateWidgetTitle, cycleData, userGender, t]);

  // Load today glance data
  // 🔥 FIX: Memoizziamo la funzione con useCallback per evitare ricreazioni ad ogni render
  // 🔥 FIX: Spostata qui prima del useEffect che la usa per evitare errore di dichiarazione
  const loadTodayGlanceData = useCallback(async () => {
    try {
      const currentUser = await AuthService.getCurrentUser();
      if (currentUser) {
        const widgets = await TodayGlanceService.getTodayGlanceData(currentUser.id);
        setTodayGlanceWidgets(widgets);
      }
    } catch (error) {
      // 🔥 FIX: Solo errori critici in console + feedback utente per errori critici
      console.error('Failed to load today glance data:', error);
      // Mostra feedback utente solo per errori critici (non per errori di rete temporanei)
      if (error instanceof Error && error.message.includes('critical')) {
        // Non mostriamo Alert qui perché è un'operazione in background
        // Gli errori critici sono già loggati in console
      }
    }
  }, []);

  const handleCreateAvatar = useCallback(() => {
    // Naviga alla schermata di cattura avatar
    router.push('/avatar-capture');
  }, [router]);

  // 🔥 FIX: Usiamo useRef per tracciare l'ultimo healthData processato per evitare loop infiniti
  const lastProcessedHealthDataRef = useRef<string | null>(null);

  // Aggiorna i widget quando i dati di salute cambiano
  // 🔥 FIX: Rimuoviamo dipendenze ridondanti - se healthData cambia, anche healthData?.steps cambia
  useEffect(() => {
    // 🔥 FIX: Crea una chiave univoca per healthData per evitare processamenti duplicati
    const healthDataKey = healthData
      ? `${healthData.steps}-${healthData.heartRate}-${healthData.sleepHours}-${healthData.hrv}`
      : 'null';

    // 🔥 FIX: Evita processamento se i dati non sono cambiati
    if (healthDataKey === lastProcessedHealthDataRef.current) {
      return;
    }

    (async () => {
      if (healthStatus !== 'ready') {
        try {
          const placeholderData = await buildWidgetDataFromHealth();
          lastProcessedHealthDataRef.current = `placeholder-${healthStatus}`;
          setWidgetData(placeholderData);
        } catch (error) {
          console.error('❌ Error building placeholder widget data:', error);
        }
        return;
      }

      // 🔥 Aggiorna sempre i widget se abbiamo dati di salute reali (anche se sono 0)
      // Verifica se healthData è disponibile (non null/undefined) e se ci sono permessi
      if (healthData !== null && healthData !== undefined && hasAnyHealthPermission) {
        // Aggiorna i widget con dati reali (anche se sono 0)
        try {
          const data = await buildWidgetDataFromHealth();
          // 🔥 FIX: Aggiorna il ref solo dopo aver costruito i dati con successo
          lastProcessedHealthDataRef.current = healthDataKey;
          setWidgetData(data);
          // 🔥 FIX: Rimuoviamo console.log eccessivi - manteniamo solo errori critici
          // Aggiorna anche la sezione Today At a Glance
          loadTodayGlanceData();
        } catch (error) {
          // 🔥 FIX: Solo errori critici in console + feedback utente per errori critici
          console.error('❌ Error building widget data from health:', error);
          // Mostra feedback utente solo per errori critici (non per errori di rete temporanei)
          if (error instanceof Error && error.message.includes('critical')) {
            Alert.alert(
              t('common.error') || 'Errore',
              t('home.errors.widgetDataLoad') || 'Errore nel caricamento dei dati dei widget. Riprova più tardi.'
            );
          }
        }
      } else if (isInitialized && (healthData === null || healthData === undefined) && !hasAnyHealthPermission) {
        // Se non ci sono dati E non ci sono permessi, usa i mock
        try {
          const goals = await widgetGoalsService.getGoals();
          const widgetData = WidgetDataService.generateWidgetData(goals);
          const translatedWidgetData = widgetData.map(w => ({
            ...w,
            title: translateWidgetTitle(w.id),
          }));
          // 🔥 FIX: Aggiorna il ref anche per i mock
          lastProcessedHealthDataRef.current = healthDataKey;
          setWidgetData(translatedWidgetData);
        } catch (error) {
          // 🔥 FIX: Solo errori critici in console + feedback utente per errori critici
          console.error('❌ Error generating mock widget data:', error);
          // Mostra feedback utente solo per errori critici
          if (error instanceof Error && error.message.includes('critical')) {
            Alert.alert(
              t('common.error') || 'Errore',
              t('home.errors.mockDataLoad') || 'Errore nel caricamento dei dati mock. Riprova più tardi.'
            );
          }
        }
      }
    })();
  }, [
    healthData, // 🔥 FIX: Solo healthData - le proprietà nested cambiano automaticamente
    isInitialized,
    hasAnyHealthPermission,
    healthStatus,
    buildWidgetDataFromHealth, // 🔥 FIX: Aggiungiamo la funzione memoizzata
    translateWidgetTitle, // 🔥 FIX: Aggiungiamo la funzione memoizzata
    loadTodayGlanceData, // 🔥 FIX: Aggiungiamo la funzione memoizzata
  ]);

  // Intelligent insights are now handled by DailyCopilot component

  // --- Self check (Mood & Sleep)
  const [moodValue, setMoodValue] = useState<number>(3);        // 1..5
  const [sleepQuality, setSleepQuality] = useState<number>(80); // 0..100
  // NEW
  const [moodNote, setMoodNote] = useState('');
  const [sleepNote, setSleepNote] = useState('');
  const [restLevel, setRestLevel] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [hasExistingMoodCheckin, setHasExistingMoodCheckin] = useState(false); // 🆕 Traccia se esiste già un check-in mood
  const [hasExistingSleepCheckin, setHasExistingSleepCheckin] = useState(false); // 🆕 Traccia se esiste già un check-in sleep

  // 🆕 moodDescriptors con traduzioni
  const moodDescriptors = [
    { value: 1, emoji: '☁️', label: t('home.moodDescriptors.veryLow'), suggestion: t('home.moodDescriptors.suggestions.veryLow') },
    { value: 2, emoji: '🌧️', label: t('home.moodDescriptors.low'), suggestion: t('home.moodDescriptors.suggestions.low') },
    { value: 3, emoji: '⛅️', label: t('home.moodDescriptors.neutral'), suggestion: t('home.moodDescriptors.suggestions.neutral') },
    { value: 4, emoji: '🌤️', label: t('home.moodDescriptors.good'), suggestion: t('home.moodDescriptors.suggestions.good') },
    { value: 5, emoji: '🌞', label: t('home.moodDescriptors.great'), suggestion: t('home.moodDescriptors.suggestions.great') },
  ] as const;

  const computeGaugeProgress = (info: any) => {
    if (info?.steps) return Math.min(100, (info.steps.current / info.steps.goal) * 100);
    if (info?.hydration) return Math.min(100, (info.hydration.glasses / info.hydration.goal) * 100);
    if (info?.meditation) return Math.min(100, (info.meditation.minutes / info.meditation.goal) * 100);
    return 0;
  };

  const computeGaugeSubtitle = (info: any) => {
    if (info?.steps) return `${t('home.goal')} • ${info.steps.goal.toLocaleString()} steps`;
    if (info?.hydration) {
      // 🔥 FIX: Usa unità preferita se disponibile, altrimenti "glasses" come default
      const unitLabel = info.hydration.unitLabel || t('home.glasses') || 'glasses';
      return `${t('home.goal')} • ${info.hydration.goal} ${unitLabel}`;
    }
    if (info?.meditation) return `${t('home.goal')} • ${info.meditation.goal} mins`;
    return '';
  };

  const computeGaugeTrend = (progress: number) => {
    if (progress >= 85) return t('home.status.excellent');
    if (progress >= 60) return t('home.status.good');
    if (progress >= 40) return `+${Math.max(1, Math.round((progress - 40) / 2))}%`;
    return '!';
  };

  const isHealthDataReady = healthStatus === 'ready';

  const getInfoCardValue = (id: string, info: any) => {
    switch (id) {
      case 'sleep':
        return t('home.sleep.hours', { hours: info.sleep?.hours ?? 7.5 });
      case 'hrv': {
        const rawValue = Number(info.hrv?.value ?? info.hrv?.avgHRV ?? 0);
        if (!Number.isFinite(rawValue) || rawValue <= 0) {
          return t('home.hrv.value', { value: 0 });
        }
        const formatted =
          rawValue >= 100
            ? Math.round(rawValue).toString()
            : (Math.round(rawValue * 10) / 10).toString();
        return t('home.hrv.value', { value: formatted });
      }
      case 'analyses':
        return info.analyses?.completed ? t('home.status.complete') : t('home.status.pending');
      case 'cycle':
        return info.cycle ? t('home.cycle.day', { day: info.cycle.day }) : '—';
      default:
        return info.value ?? '--';
    }
  };

  const getInfoCardSubtitle = (id: string, info: any) => {
    switch (id) {
      case 'sleep':
        return `${t('home.sleep.quality')} • ${info.sleep?.quality ?? 82}%`;
      case 'hrv': {
        const currentHr = Number(info.hrv?.currentHR ?? info.hrv?.restingHR ?? 0);
        const hasCurrent = Number.isFinite(currentHr) && currentHr > 0;
        return `${t('home.hrv.currentHR')} • ${hasCurrent ? `${Math.round(currentHr)} ${t('home.bpm')}` : '—'
          }`;
      }
      case 'analyses':
        return info.analyses?.lastCheckIn ?? t('home.analyses.today');
      case 'cycle':
        if (!info.cycle) return '';
        const phaseKey = `home.cycle.phases.${info.cycle.phase}`;
        return t(phaseKey, { defaultValue: info.cycle.phaseName });
      default:
        return info.subtitle ?? '';
    }
  };

  const getInfoCardTrend = (id: string, info: any) => {
    switch (id) {
      case 'sleep': {
        const quality = info.sleep?.quality ?? 0;
        if (quality >= 85) return t('home.status.excellent');
        if (quality >= 70) return t('home.status.good');
        if (quality >= 50) return '+5%';
        return '!';
      }
      case 'hrv': {
        const hrvScore = info.hrv?.value ?? 0;
        if (hrvScore >= 45) return t('home.status.excellent');
        if (hrvScore >= 30) return t('home.status.good');
        return '!';
      }
      case 'analyses':
        return info.analyses?.completed ? '✓' : '!';
      case 'cycle':
        if (!info.cycle) return undefined;
        // Mostra i giorni fino al prossimo periodo come trend
        if (info.cycle.nextPeriodDays <= 3) return '!';
        if (info.cycle.nextPeriodDays <= 7) return '⚠';
        return '✓';
      default:
        return undefined;
    }
  };

  const getInfoCardDetails = (id: string, info: any) => {
    switch (id) {
      case 'sleep':
        return [
          { icon: '💤', label: t('home.sleep.deepSleep'), value: info.sleep?.deepSleep ?? '2h 15m' },
          { icon: '🧠', label: t('home.sleep.rem'), value: info.sleep?.remSleep ?? '1h 45m' },
          { icon: '⏰', label: t('home.sleep.wakeTime'), value: info.sleep?.wakeTime ?? '7:30 AM' },
        ];
      case 'hrv':
        return [
          {
            icon: '❤️',
            label: t('home.hrv.currentHR'),
            value:
              info.hrv?.currentHR && info.hrv.currentHR > 0
                ? `${info.hrv.currentHR} ${t('home.bpm')}`
                : '—',
          },
          {
            icon: '💓',
            label: t('home.hrv.restingHR'),
            value:
              info.hrv?.restingHR && info.hrv.restingHR > 0
                ? `${info.hrv.restingHR} ${t('home.bpm')}`
                : '—',
          },
          { icon: '🛡️', label: t('home.hrv.recovery'), value: info.hrv?.recovery ?? t('home.status.good') },
        ];
      case 'analyses':
        return [
          { icon: '🔥', label: t('home.analyses.streak'), value: t('home.analyses.days', { count: info.analyses?.streak ?? 0 }) },
          { icon: info.analyses?.completed ? '✅' : '🕒', label: t('home.analyses.status'), value: info.analyses?.completed ? t('home.status.loggedToday') : t('home.status.completeCheckIns') },
        ];
      case 'cycle':
        if (!info.cycle) return undefined;
        return [
          { icon: '📅', label: t('home.cycle.nextPeriod'), value: t('home.cycle.days', { count: info.cycle.nextPeriodDays }) },
          { icon: '🔄', label: t('home.cycle.cycleLength'), value: t('home.cycle.days', { count: info.cycle.cycleLength }) },
        ];
      default:
        return undefined;
    }
  };

  const currentMoodDescriptor =
    moodDescriptors[Math.min(moodDescriptors.length - 1, Math.max(0, moodValue - 1))] ?? moodDescriptors[2];

  const sleepWidget = widgetData.find(w => w.id === 'sleep');
  const sleepStats = sleepWidget?.sleep;
  const displayedSleepHours = sleepStats?.hours ?? 7.5;
  const displayedSleepQuality = sleepStats?.quality ?? sleepQuality;

  // chiavi giornaliere
  const dayKey = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const STORAGE_KEYS = {
    mood: (d: string) => `checkin:mood:${d}`,
    sleep: (d: string) => `checkin:sleep:${d}`,
    moodNote: (d: string) => `checkin:mood_note:${d}`,
    sleepNote: (d: string) => `checkin:sleep_note:${d}`,
    restLevel: (d: string) => `checkin:rest_level:${d}`,
  };

  // 🆕 Rimosso log widget config per performance (useEffect completo rimosso)
  // 🔥 FIX: loadTodayGlanceData è stata spostata prima del useEffect che la usa (linea ~310)

  // Setup global scroll functions for tutorial
  useEffect(() => {
    global.scrollToWidgets = () => {
      if (scrollViewRef.current) {
        scrollViewRef.current.scrollTo({ y: 800, animated: true });
      }
    };
    global.scrollToCoplot = () => {
      if (scrollViewRef.current) {
        scrollViewRef.current.scrollTo({ y: 1600, animated: true });
      }
    };
  }, []);

  // Show health permissions modal if no health data is available
  // 🔥 FIX: Solo se non ci sono permessi concessi E non è stato già mostrato durante onboarding
  useEffect(() => {
    (async () => {
      if (!isInitialized || healthPermissionsModal) return;
      if (hasHealthData) return;

      try {
        const { HealthPermissionsService } = await import('../services/health-permissions.service');
        const { OnboardingService } = await import('../services/onboarding.service');

        const [grantedPermissions, setupCompleted, onboardingCompleted] = await Promise.all([
          HealthPermissionsService.getGrantedPermissions(),
          HealthPermissionsService.isSetupCompleted(),
          OnboardingService.isOnboardingCompleted(),
        ]);

        // Verifica se tutti i permessi richiesti sono concessi
        const requiredPermissions = ['steps', 'heart_rate', 'sleep'];
        const allRequiredGranted = requiredPermissions.every(perm => grantedPermissions.includes(perm));

        // Mostra il modal solo se:
        // 1. Mancano permessi richiesti
        // 2. Il setup non è stato completato
        // 3. L'onboarding è stato completato (per evitare doppia richiesta durante onboarding)
        // 4. Non ci sono dati health (per evitare di mostrare se l'utente ha già dati)
        if (!allRequiredGranted && !setupCompleted && onboardingCompleted) {
          const timer = setTimeout(() => {
            setHealthPermissionsModal(true);
          }, 2000); // Aumentato delay per dare tempo all'onboarding di completare
          return () => clearTimeout(timer);
        }
      } catch { }
    })();
  }, [isInitialized, hasHealthData, healthPermissionsModal, healthPermissions.steps, healthPermissions.heartRate, healthPermissions.sleep]);

  // carica eventuali check-in del giorno all'apertura
  useEffect(() => {
    (async () => {
      try {
        const dk = dayKey();

        // 🆕 Verifica PRIMA se esistono check-in nel database per oggi (priorità al database)
        const currentUser = await AuthService.getCurrentUser();
        if (currentUser?.id) {
          const { supabase } = await import('../lib/supabase');
          const { data: existingCheckin } = await supabase
            .from('daily_copilot_analyses')
            .select('mood, sleep_quality, mood_note, sleep_note')
            .eq('user_id', currentUser.id)
            .eq('date', dk)
            .maybeSingle();

          if (existingCheckin) {
            // 🔥 FIX: Carica i valori dal database se esiste un check-in
            if (existingCheckin.mood !== null && existingCheckin.mood !== undefined) {
              setMoodValue(existingCheckin.mood as 1 | 2 | 3 | 4 | 5);
              setHasExistingMoodCheckin(true);
            } else {
              setHasExistingMoodCheckin(false);
            }

            if (existingCheckin.mood_note) {
              // Decifra mood_note prima di mostrarlo
              try {
                const { decryptText } = await import('../services/encryption.service');
                const decrypted = await decryptText(existingCheckin.mood_note, currentUser.id);
                if (decrypted !== null) {
                  setMoodNote(decrypted);
                } else {
                  setMoodNote(existingCheckin.mood_note); // Fallback per dati vecchi non cifrati
                }
              } catch (err) {
                setMoodNote(existingCheckin.mood_note); // Fallback
              }
            }

            if (existingCheckin.sleep_quality !== null && existingCheckin.sleep_quality !== undefined && existingCheckin.sleep_quality > 0) {
              setSleepQuality(existingCheckin.sleep_quality);
              setHasExistingSleepCheckin(true);

              // 🔥 FIX: Calcola restLevel da sleep_quality (0-100 -> 1-5)
              // sleep_quality: 0-20 -> 1, 21-40 -> 2, 41-60 -> 3, 61-80 -> 4, 81-100 -> 5
              const calculatedRestLevel = Math.min(5, Math.max(1, Math.ceil((existingCheckin.sleep_quality / 100) * 5))) as 1 | 2 | 3 | 4 | 5;
              setRestLevel(calculatedRestLevel);
            } else {
              setHasExistingSleepCheckin(false);
            }

            if (existingCheckin.sleep_note) {
              // Decifra sleep_note prima di mostrarlo
              try {
                const { decryptText } = await import('../services/encryption.service');
                const decrypted = await decryptText(existingCheckin.sleep_note, currentUser.id);
                if (decrypted !== null) {
                  setSleepNote(decrypted);
                } else {
                  setSleepNote(existingCheckin.sleep_note); // Fallback per dati vecchi non cifrati
                }
              } catch (err) {
                setSleepNote(existingCheckin.sleep_note); // Fallback
              }
            }
          } else {
            // 🔥 FIX: Se non esiste un check-in nel database, usa AsyncStorage come fallback
            const savedMood = await AsyncStorage.getItem(STORAGE_KEYS.mood(dk));
            const savedSleep = await AsyncStorage.getItem(STORAGE_KEYS.sleep(dk));
            const savedMoodNote = await AsyncStorage.getItem(STORAGE_KEYS.moodNote(dk));
            const savedSleepNote = await AsyncStorage.getItem(STORAGE_KEYS.sleepNote(dk));
            const savedRestLevel = await AsyncStorage.getItem(STORAGE_KEYS.restLevel(dk));

            if (savedMood) setMoodValue(parseInt(savedMood, 10));
            if (savedSleep) setSleepQuality(parseInt(savedSleep, 10));
            if (savedMoodNote) setMoodNote(savedMoodNote);
            if (savedSleepNote) setSleepNote(savedSleepNote);
            if (savedRestLevel) setRestLevel(parseInt(savedRestLevel, 10) as 1 | 2 | 3 | 4 | 5);

            // 🔥 FIX: Se non esiste un check-in nel database, imposta esplicitamente a false
            setHasExistingMoodCheckin(false);
            setHasExistingSleepCheckin(false);
          }
        } else {
          // 🔥 FIX: Se non c'è un utente, usa AsyncStorage come fallback
          const savedMood = await AsyncStorage.getItem(STORAGE_KEYS.mood(dk));
          const savedSleep = await AsyncStorage.getItem(STORAGE_KEYS.sleep(dk));
          const savedMoodNote = await AsyncStorage.getItem(STORAGE_KEYS.moodNote(dk));
          const savedSleepNote = await AsyncStorage.getItem(STORAGE_KEYS.sleepNote(dk));
          const savedRestLevel = await AsyncStorage.getItem(STORAGE_KEYS.restLevel(dk));

          if (savedMood) setMoodValue(parseInt(savedMood, 10));
          if (savedSleep) setSleepQuality(parseInt(savedSleep, 10));
          if (savedMoodNote) setMoodNote(savedMoodNote);
          if (savedSleepNote) setSleepNote(savedSleepNote);
          if (savedRestLevel) setRestLevel(parseInt(savedRestLevel, 10) as 1 | 2 | 3 | 4 | 5);

          // 🔥 FIX: Se non c'è un utente, imposta esplicitamente a false
          setHasExistingMoodCheckin(false);
          setHasExistingSleepCheckin(false);
        }
      } catch { }
    })();
  }, []);

  // salva rapidi
  const saveMood = async (val: number) => {
    setMoodValue(val);
    try { await AsyncStorage.setItem(STORAGE_KEYS.mood(dayKey()), String(val)); } catch { }
  };

  const saveSleep = async (val: number) => {
    setSleepQuality(val);
    try { await AsyncStorage.setItem(STORAGE_KEYS.sleep(dayKey()), String(val)); } catch { }
  };

  // nuove funzioni di salvataggio con note
  async function saveMoodCheckin(value: number, note: string) {
    const dk = dayKey();
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // 🔥 FIX: Verifica che la data sia quella di oggi (non permettere salvataggi per giorni passati/futuri)
    if (dk !== today) {
      UserFeedbackService.showError('Puoi salvare il check-in solo per oggi. La data non corrisponde.');
      return;
    }

    // 🆕 Validazione dati prima del salvataggio
    const validation = DataValidationService.validateMoodCheckin({ value, note });
    if (!validation.valid) {
      UserFeedbackService.showError(`Dati non validi: ${validation.errors.join(', ')}`);
      return;
    }

    // Salva in AsyncStorage locale
    await AsyncStorage.multiSet([
      [STORAGE_KEYS.mood(dk), String(value)],
      [STORAGE_KEYS.moodNote(dk), note],
    ]);

    // 🆕 Salva nel database Supabase con enhanced error handling
    try {
      const currentUser = await AuthService.getCurrentUser();
      if (!currentUser?.id) {
        UserFeedbackService.showWarning('Devi essere loggato per salvare i check-in.');
        return;
      }

      // 🆕 Usa locking per prevenire race conditions
      await OperationLockService.withLock(
        'save',
        `mood_checkin_${currentUser.id}_${dk}`,
        async () => {
          // 🆕 Usa retry logic per operazioni database
          await RetryService.withRetry(
            async () => {
              const { supabase } = await import('../lib/supabase');

              // 🔥 FIX: Usa UPSERT invece di check-then-insert/update per evitare race conditions
              // Il constraint UNIQUE(user_id, date) gestisce automaticamente i duplicati

              // Controlla se esiste già un record per preservare i valori esistenti e mostrare warning
              const { data: existing } = await supabase
                .from('daily_copilot_analyses')
                .select('id, mood, mood_note, sleep_hours, sleep_quality, sleep_note, overall_score, health_metrics, recommendations, summary, created_at')
                .eq('user_id', currentUser.id)
                .eq('date', dk)
                .maybeSingle();

              // 🔥 FIX: Warning se si sta aggiornando un check-in già esistente
              if (existing && existing.mood !== null && existing.mood !== undefined) {
                // Calcola il tempo trascorso dal primo salvataggio
                const createdAt = new Date(existing.created_at);
                const now = new Date();
                const hoursSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

                // Mostra warning se è passato più di 1 ora (permette correzioni immediate)
                if (hoursSinceCreation > 1) {
                  UserFeedbackService.showWarning(`Stai aggiornando un check-in salvato ${Math.round(hoursSinceCreation)} ore fa.`);
                }
              }

              // Cifra mood_note prima di salvare
              let encryptedMoodNote: string | null = null;
              if (note) {
                try {
                  const { encryptText } = await import('../services/encryption.service');
                  encryptedMoodNote = await encryptText(note, currentUser.id);
                } catch (encError) {
                  console.warn('[HomeScreen] ⚠️ Encryption failed for mood_note, saving as plaintext (fallback):', encError);
                  encryptedMoodNote = note; // Fallback
                }
              }

              const upsertData = {
                user_id: currentUser.id,
                date: dk,
                mood: value,
                mood_note: encryptedMoodNote || null, // Salva la nota cifrata (o null se vuota)
                updated_at: new Date().toISOString(),
                // Preserva i valori esistenti per sleep e altri campi se esistono
                ...(existing ? {
                  sleep_hours: existing.sleep_hours,
                  sleep_quality: existing.sleep_quality,
                  sleep_note: existing.sleep_note,
                  overall_score: existing.overall_score,
                  health_metrics: existing.health_metrics,
                  recommendations: existing.recommendations,
                  summary: existing.summary,
                } : {
                  // Valori di default per nuovo record
                  overall_score: 50,
                  sleep_hours: 0,
                  sleep_quality: 0,
                  health_metrics: {},
                  recommendations: [],
                  summary: {},
                }),
              };

              const { error: upsertError } = await supabase
                .from('daily_copilot_analyses')
                .upsert(upsertData, {
                  onConflict: 'user_id,date',
                  ignoreDuplicates: false
                });

              if (upsertError) {
                throw new Error(`Error upserting mood check-in: ${upsertError.message}`);
              }

              // 🆕 Verifica post-salvataggio che i dati siano nel database
              const verification = await DatabaseVerificationService.verifyMoodCheckin(currentUser.id, dk);
              if (!verification.found) {
                UserFeedbackService.showWarning('Il check-in è stato salvato ma potrebbe non essere visibile immediatamente. Riprova più tardi.');
              } else {
                UserFeedbackService.showSaveSuccess('check-in');
                // 🆕 Aggiorna lo stato per cambiare il testo del pulsante
                setHasExistingMoodCheckin(true);
              }
            },
            'save_mood_checkin',
            {
              maxAttempts: 3,
              delay: 1000,
              backoff: 'exponential',
              shouldRetry: RetryService.isRetryableError,
            }
          );
        }
      );
    } catch (e) {
      // 🆕 Errore durante il salvataggio - mostra feedback all'utente
      const error = e instanceof Error ? e : new Error('Unknown error');
      UserFeedbackService.showSaveError('check-in', async () => {
        // Retry logic
        try {
          await saveMoodCheckin(value, note);
        } catch (retryError) {
          UserFeedbackService.showError('Impossibile salvare il check-in. Riprova più tardi.');
        }
      });
    }
  }

  async function saveSleepCheckin(quality: number, note: string, restLevel: number) {
    const dk = dayKey();
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // 🔥 FIX: Verifica che la data sia quella di oggi (non permettere salvataggi per giorni passati/futuri)
    if (dk !== today) {
      UserFeedbackService.showError('Puoi salvare il check-in solo per oggi. La data non corrisponde.');
      return;
    }

    // 🆕 Validazione dati prima del salvataggio
    const sleepWidget = widgetData.find(w => w.id === 'sleep');
    const sleepHours = sleepWidget?.sleep?.hours ?? 0;
    const validation = DataValidationService.validateSleepCheckin({ quality, hours: sleepHours, note });
    if (!validation.valid) {
      UserFeedbackService.showError(`Dati non validi: ${validation.errors.join(', ')}`);
      return;
    }

    // Salva in AsyncStorage locale
    await AsyncStorage.multiSet([
      [STORAGE_KEYS.sleep(dk), String(quality)],
      [STORAGE_KEYS.sleepNote(dk), note],
      [STORAGE_KEYS.restLevel(dk), String(restLevel)],
    ]);

    // 🆕 Salva nel database Supabase con enhanced error handling
    try {
      const currentUser = await AuthService.getCurrentUser();
      if (!currentUser?.id) {
        UserFeedbackService.showWarning('Devi essere loggato per salvare i check-in.');
        return;
      }

      // 🆕 Usa locking per prevenire race conditions
      await OperationLockService.withLock(
        'save',
        `sleep_checkin_${currentUser.id}_${dk}`,
        async () => {
          // 🆕 Usa retry logic per operazioni database
          await RetryService.withRetry(
            async () => {
              const { supabase } = await import('../lib/supabase');

              // 🔥 FIX: Usa UPSERT invece di check-then-insert/update per evitare race conditions
              // Il constraint UNIQUE(user_id, date) gestisce automaticamente i duplicati

              // Controlla se esiste già un record per preservare i valori esistenti e mostrare warning
              const { data: existing } = await supabase
                .from('daily_copilot_analyses')
                .select('id, mood, mood_note, sleep_quality, sleep_hours, sleep_note, overall_score, health_metrics, recommendations, summary, created_at')
                .eq('user_id', currentUser.id)
                .eq('date', dk)
                .maybeSingle();

              // 🔥 FIX: Warning se si sta aggiornando un check-in già esistente
              if (existing && existing.sleep_quality !== null && existing.sleep_quality !== undefined && existing.sleep_quality > 0) {
                // Calcola il tempo trascorso dal primo salvataggio
                const createdAt = new Date(existing.created_at);
                const now = new Date();
                const hoursSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

                // Mostra warning se è passato più di 1 ora (permette correzioni immediate)
                if (hoursSinceCreation > 1) {
                  UserFeedbackService.showWarning(`Stai aggiornando un check-in salvato ${Math.round(hoursSinceCreation)} ore fa.`);
                }
              }

              // Cifra sleep_note prima di salvare
              let encryptedSleepNote: string | null = null;
              if (note) {
                try {
                  const { encryptText } = await import('../services/encryption.service');
                  encryptedSleepNote = await encryptText(note, currentUser.id);
                } catch (encError) {
                  console.warn('[HomeScreen] ⚠️ Encryption failed for sleep_note, saving as plaintext (fallback):', encError);
                  encryptedSleepNote = note; // Fallback
                }
              }

              const upsertData = {
                user_id: currentUser.id,
                date: dk,
                sleep_quality: quality,
                sleep_hours: sleepHours,
                sleep_note: encryptedSleepNote || null, // Salva la nota cifrata (o null se vuota)
                updated_at: new Date().toISOString(),
                // Preserva i valori esistenti per mood e altri campi se esistono
                ...(existing ? {
                  mood: existing.mood,
                  mood_note: existing.mood_note,
                  overall_score: existing.overall_score,
                  health_metrics: existing.health_metrics,
                  recommendations: existing.recommendations,
                  summary: existing.summary,
                } : {
                  // Valori di default per nuovo record
                  mood: 3,
                  overall_score: 50,
                  health_metrics: {},
                  recommendations: [],
                  summary: {},
                }),
              };

              const { error: upsertError } = await supabase
                .from('daily_copilot_analyses')
                .upsert(upsertData, {
                  onConflict: 'user_id,date',
                  ignoreDuplicates: false
                });

              if (upsertError) {
                throw new Error(`Error upserting sleep check-in: ${upsertError.message}`);
              }

              // 🆕 Verifica post-salvataggio che i dati siano nel database
              const verification = await DatabaseVerificationService.verifySleepCheckin(currentUser.id, dk);
              if (!verification.found) {
                UserFeedbackService.showWarning('Il check-in è stato salvato ma potrebbe non essere visibile immediatamente. Riprova più tardi.');
              } else {
                UserFeedbackService.showSaveSuccess('check-in');
                // 🆕 Aggiorna lo stato per cambiare il testo del pulsante
                setHasExistingSleepCheckin(true);
              }
            },
            'save_sleep_checkin',
            {
              maxAttempts: 3,
              delay: 1000,
              backoff: 'exponential',
              shouldRetry: RetryService.isRetryableError,
            }
          );
        }
      );
    } catch (e) {
      // 🆕 Errore durante il salvataggio - mostra feedback all'utente
      const error = e instanceof Error ? e : new Error('Unknown error');
      UserFeedbackService.showSaveError('check-in', async () => {
        // Retry logic
        try {
          await saveSleepCheckin(quality, note, restLevel);
        } catch (retryError) {
          UserFeedbackService.showError('Impossibile salvare il check-in. Riprova più tardi.');
        }
      });
    }
  }

  // Handle pill press
  const handlePillPress = (pillType: 'streak' | 'momentum' | 'next-session') => {
    setSelectedPill(pillType);
  };

  const closePillPopup = () => {
    setSelectedPill(null);
  };

  // Handle widget interactions
  const handleWidgetPress = async (widgetId: string) => {
    if (healthStatus !== 'ready') {
      if (healthStatus === 'waiting-permission') {
        setHealthPermissionsModal(true);
      }
      return;
    }
    // 🆕 Rimosso log per performance
    switch (widgetId) {
      case 'steps':
        break;
      case 'hydration':
        // 🔥 FIX: Mostra menu per aggiungere/rimuovere acqua quando si fa tap sul widget
        try {
          const currentUser = await AuthService.getCurrentUser();
          if (!currentUser?.id) {
            UserFeedbackService.showWarning('Devi essere loggato per gestire l\'acqua.');
            return;
          }

          // Mostra modal personalizzato
          setHydrationActionModal(true);
        } catch (error) {
          console.error('❌ Error managing water:', error);
          UserFeedbackService.showError(
            t('home.hydrationActions.addError') || 'Errore durante la gestione dell\'acqua',
            t('common.error') || 'Errore'
          );
        }
        break;
      case 'meditation': // <-- id corretto
        router.push('/breathing-exercise' as any);
        break;
      case 'hrv':
        break;
      case 'sleep':
        break;
      case 'analyses':
        router.push('/(tabs)/emotion' as any);
        break;
      case 'cycle':
        // 🆕 Apri modal per configurare/visualizzare il ciclo mestruale
        // Per ora, mostra un alert informativo (in futuro si può creare un modal dedicato)
        const cycleInfo = widgetData.find(w => w.id === 'cycle')?.cycle;
        if (cycleInfo) {
          Alert.alert(
            t('widgets.cycle'),
            `${t('home.cycle.day', { day: cycleInfo.day })}\n${t('home.cycle.phases.' + cycleInfo.phase, { defaultValue: cycleInfo.phaseName })}\n${t('home.cycle.nextPeriod')}: ${t('home.cycle.days', { count: cycleInfo.nextPeriodDays })}`,
            [{ text: t('common.ok') }]
          );
        } else {
          Alert.alert(
            t('widgets.cycle'),
            t('home.cycle.notConfigured') || 'Configura il tuo ciclo mestruale nelle impostazioni per vedere le informazioni qui.',
            [{ text: t('common.ok') }]
          );
        }
        break;
    }
  };

  const handleWidgetLongPress = async (widgetId: string) => {
    // Apri le preferenze solo per i widget che hanno goal
    if (widgetId === 'steps' || widgetId === 'hydration' || widgetId === 'meditation' || widgetId === 'sleep') {
      setGoalModal({ visible: true, widgetId });
      return;
    }
    // fallback per gli altri, se vuoi mantenere quick actions:
    // await TodayGlanceService.handleQuickAction(widgetId, 'quick_action');
  };

  const handleEmptySpaceLongPress = (position: number) => {
    // Apri il modal di selezione widget
    setWidgetSelectionModal({ visible: true, position });
  };

  // 🔥 Lista di tutti i widget disponibili (filtra 'cycle' se l'utente non è di genere femminile)
  const ALL_AVAILABLE_WIDGETS = useMemo(() => {
    const baseWidgets = ['steps', 'meditation', 'hydration', 'sleep', 'hrv', 'analyses'];
    // Aggiungi 'cycle' solo se l'utente è di genere femminile
    if (userGender === 'female') {
      baseWidgets.push('cycle');
    }
    return baseWidgets;
  }, [userGender]);

  // 🔥 Filtra i widget NON ancora mostrati (non presenti nella config o disabilitati)
  const getAvailableWidgets = (): string[] => {
    return ALL_AVAILABLE_WIDGETS.filter(widgetId => {
      const widgetInConfig = widgetConfig.find(w => w.id === widgetId);
      // Mostra solo se NON è presente nella config OPPURE è disabilitato
      return !widgetInConfig || !widgetInConfig.enabled;
    });
  };

  const handleWidgetSelect = async (widgetId: string) => {
    try {
      const position = widgetSelectionModal.position;
      // Aggiungi il widget alla posizione specificata
      await addWidget(widgetId, 'small', position);
      // 🔥 FIX: Rimuoviamo console.log eccessivi
    } catch (error) {
      console.error('❌ Errore durante l\'aggiunta del widget:', error);
      Alert.alert(
        t('widgetSelection.error') || 'Errore',
        t('widgetSelection.addError') || 'Errore durante l\'aggiunta del widget'
      );
    }
  };

  // Funzione per creare slot vuoti
  const createEmptySlots = (rowStart: number, rowEnd: number) => {
    const rowIndex = rowStart === 0 ? 0 : 1;
    if (rowHasLarge(rowIndex)) return [];

    const slots = [];
    for (let pos = rowStart; pos < rowEnd; pos++) {
      // Se il pos è coperto da un widget (medium/large) → skip
      if (isPositionCovered(pos)) continue;

      const hasWidgetStartingHere = widgetConfig.some(
        w => w.enabled && w.position === pos
      );
      if (!hasWidgetStartingHere) {
        slots.push(
          <TouchableOpacity
            key={`empty-${pos}`}
            style={[
              styles.emptySlot,
              {
                width: getWidgetWidth('small'),
                backgroundColor: themeColors.surfaceMuted,
                borderColor: themeColors.border,
              }
            ]}
            onLongPress={() => handleEmptySpaceLongPress(pos)}
            activeOpacity={0.7}
          >
            <Text style={[styles.emptySlotText, { color: themeColors.textTertiary }]}>+</Text>
            <Text style={[styles.emptySlotHint, { color: themeColors.textTertiary }]}>{t('home.emptySlot.addWidget')}</Text>
          </TouchableOpacity>
        );
      }
    }
    return slots;
  };

  // Generate stats dynamically based on momentum data
  const getStats = () => {
    const momentumValue = momentumData
      ? MomentumService.formatMomentumValue(momentumData)
      : t('home.stats.loading');

    return [
      { id: 'streak', icon: 'fire', label: t('home.stats.streak'), value: t('home.stats.days', { count: 12 }) },
      { id: 'momentum', icon: 'line-chart', label: t('home.stats.momentum'), value: momentumValue },
      { id: 'next-session', icon: 'calendar', label: t('home.stats.nextSession'), value: `${t('home.analyses.today')} • 6:00 PM` },
    ];
  };

  // 🔥 FIX: Usiamo useRef per tracciare se i dati utente sono già stati caricati per evitare loop infiniti
  const userDataLoadedRef = useRef(false);
  const lastUserIdRef = useRef<string | null>(null);

  // Load user data and momentum (solo una volta al mount o quando cambia l'utente)
  useEffect(() => {
    const loadUserData = async () => {
      try {
        // Get current user
        const currentUser = await AuthService.getCurrentUser();
        if (!currentUser?.id) return;

        // 🔥 FIX: Evita ricaricamento se l'utente è lo stesso e i dati sono già stati caricati
        if (userDataLoadedRef.current && lastUserIdRef.current === currentUser.id) {
          return;
        }

        // 🔥 FIX: Segna che stiamo caricando i dati per questo utente
        lastUserIdRef.current = currentUser.id;
        userDataLoadedRef.current = true;

        // Load user profile for first name and gender
        const userProfile = await AuthService.getUserProfile(currentUser.id);
        if (userProfile?.first_name) {
          setUserFirstName(userProfile.first_name);
        } else if (currentUser.user_metadata?.full_name) {
          const firstName = currentUser.user_metadata.full_name.split(' ')[0];
          setUserFirstName(firstName);
        } else if (currentUser.email) {
          const firstName = currentUser.email.split('@')[0].split('.')[0];
          setUserFirstName(firstName);
        }

        // 🆕 Aggiorna il genere dell'utente e carica i dati del ciclo se necessario
        const gender = userProfile?.gender || null;
        setUserGender(gender);

        // Carica i dati del ciclo solo se l'utente è di genere femminile
        if (gender === 'female') {
          // 🔥 FIX: Abilita automaticamente il widget del ciclo per utenti di genere femminile
          try {
            const { widgetConfigService } = await import('../services/widget-config.service');
            const config = await widgetConfigService.getWidgetConfig();
            const cycleWidget = config.find(w => w.id === 'cycle');
            if (cycleWidget && !cycleWidget.enabled) {
              // Abilita il widget se non è già abilitato
              await widgetConfigService.enableWidget('cycle', 'small');
              console.log('✅ Cycle widget automatically enabled for female user');
            }
          } catch (error) {
            console.warn('[HomeScreen] Failed to enable cycle widget:', error);
          }

          const { menstrualCycleService } = await import('../services/menstrual-cycle.service');
          const cycle = await menstrualCycleService.getCycleData();
          setCycleData(cycle);
        } else {
          setCycleData(null);
        }

        // Load momentum data (solo se non è già stato caricato)
        if (!momentumData) {
          const momentum = await MomentumService.calculateMomentum(currentUser.id);
          setMomentumData(momentum);
        }

        // Load weekly trend data for charts (solo se non è già stato caricato)
        if (weeklyTrendData.steps.length === 0 && weeklyTrendData.sleepHours.length === 0) {
          const syncService = HealthDataSyncService.getInstance();
          const trendData = await syncService.getWeeklyTrendData(currentUser.id);
          setWeeklyTrendData(trendData);
        }

        // Load today glance widgets (solo se non sono già stati caricati)
        if (todayGlanceWidgets.length === 0) {
          const widgets = await TodayGlanceService.getTodayGlanceData(currentUser.id);
          // 🔥 FIX: Usiamo la funzione helper per tradurre i widget (evita duplicazione)
          const translatedWidgets = widgets.map(w => ({
            ...w,
            title: w.id === 'mindfulness' ? translateWidgetTitle('meditation') : translateWidgetTitle(w.id),
          }));
          setTodayGlanceWidgets(translatedWidgets);
        }

        // 🔥 FIX: Widget data viene gestito dal useEffect separato che dipende da healthData
        // Non lo carichiamo qui per evitare loop
      } catch (error) {
        console.error('Error loading user data:', error);
        // 🔥 FIX: Reset il flag in caso di errore per permettere un retry
        userDataLoadedRef.current = false;
      }
    };

    loadUserData();
  }, []); // 🔥 FIX: Rimuoviamo translateWidgetTitle dalle dipendenze - viene caricato solo al mount

  // 🆕 Funzione per caricare le attività (esportata per essere riutilizzata)
  const loadWellnessActivities = useCallback(async () => {
    try {
      const currentUser = await AuthService.getCurrentUser();
      if (!currentUser?.id) return;

      const WellnessActivitiesService = (await import('../services/wellness-activities.service')).default;
      const activities = await WellnessActivitiesService.getTodayActivities();

      // Mappa le attività dal database a DailyActivity
      const mappedActivities: DailyActivity[] = activities.map((activity) => {
        // Determina l'icona in base alla categoria
        const iconMap: Record<string, string> = {
          mindfulness: 'leaf',
          movement: 'road',
          nutrition: 'tint',
          recovery: 'moon-o',
        };

        // Formatta l'orario
        const timeStr = activity.scheduled_time || '12:00';
        const [hours, minutes] = timeStr.split(':');
        const hour = parseInt(hours, 10);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
        const formattedTime = `${displayHour}:${minutes} ${ampm}`;

        return {
          id: activity.id,
          title: activity.title,
          description: activity.description,
          icon: iconMap[activity.category] || 'heart',
          completed: activity.completed,
          time: formattedTime,
          category: activity.category,
          syncedToCalendar: !!activity.calendar_event_id,
          syncedToReminders: !!activity.reminder_id,
        };
      });

      setWellnessActivities(mappedActivities);
    } catch (error) {
      console.error('Error loading wellness activities:', error);
    }
  }, []);

  // 🆕 Carica le attività wellness dal database
  useEffect(() => {
    loadWellnessActivities();

    // Ricarica ogni minuto per aggiornare le attività
    const interval = setInterval(loadWellnessActivities, 60000);
    return () => clearInterval(interval);
  }, [loadWellnessActivities]);

  // WelcomeOverlay rimosso - usiamo solo InteractiveTutorial gestito da AuthWrapper

  // 🔥 Rimuoviamo useEffect non necessario - usiamo direttamente todaysActivities che è già memoizzato

  // Load weekly trend data when health data changes
  // 🔥 FIX: Rimuoviamo dipendenze ridondanti - se healthData cambia, anche le proprietà nested cambiano
  useEffect(() => {
    const loadTrendData = async () => {
      try {
        const currentUser = await AuthService.getCurrentUser();
        if (currentUser?.id && hasAnyHealthPermission) {
          const syncService = HealthDataSyncService.getInstance();
          const trendData = await syncService.getWeeklyTrendData(currentUser.id);
          setWeeklyTrendData(trendData);
        }
      } catch (error) {
        // 🔥 FIX: Solo errori critici in console
        console.error('Error loading weekly trend data:', error);
      }
    };

    if (isInitialized && hasAnyHealthPermission) {
      loadTrendData();
    }
  }, [isInitialized, hasAnyHealthPermission, healthData]); // 🔥 FIX: Solo healthData - le proprietà nested cambiano automaticamente

  // Auto-sync health data more frequently towards end of day
  // 🔥 FIX: Memory leak - aggiungiamo ref per tracciare se il componente è montato
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isInitialized || !hasAnyHealthPermission) return;

    const getSyncInterval = (): number => {
      const now = new Date();
      const hour = now.getHours();

      // Dopo le 18:00, sincronizza ogni 30 minuti
      // Dopo le 20:00, sincronizza ogni 15 minuti
      // Dopo le 22:00, sincronizza ogni 10 minuti
      if (hour >= 22) return 10 * 60 * 1000; // 10 minuti
      if (hour >= 20) return 15 * 60 * 1000; // 15 minuti
      if (hour >= 18) return 30 * 60 * 1000; // 30 minuti
      // Durante il giorno, sincronizza ogni ora
      return 60 * 60 * 1000; // 60 minuti
    };

    const syncAndUpdateTrends = async () => {
      // 🔥 FIX: Verifica se il componente è ancora montato prima di aggiornare lo stato
      if (!isMountedRef.current) return;

      try {
        const currentUser = await AuthService.getCurrentUser();
        if (!currentUser?.id || !isMountedRef.current) return;

        // Sincronizza i dati di salute
        await syncData();

        // 🔥 FIX: Verifica di nuovo prima di aggiornare lo stato
        if (!isMountedRef.current) return;

        // Aggiorna i dati storici per i grafici
        const syncService = HealthDataSyncService.getInstance();
        const trendData = await syncService.getWeeklyTrendData(currentUser.id);

        // 🔥 FIX: Verifica finale prima di setState
        if (isMountedRef.current) {
          setWeeklyTrendData(trendData);
        }
      } catch (error) {
        // 🔥 FIX: Solo errori critici in console, non tutti i log
        if (error instanceof Error && error.message.includes('critical')) {
          console.error('Error in auto-sync:', error);
        }
      }
    };

    // Prima sincronizzazione immediata
    syncAndUpdateTrends();

    let currentInterval: ReturnType<typeof setInterval> | null = null;
    let intervalUpdater: ReturnType<typeof setInterval> | null = null;

    const startInterval = () => {
      // 🔥 FIX: Pulisci sempre l'intervallo precedente
      if (currentInterval) {
        clearInterval(currentInterval);
        currentInterval = null;
      }

      // 🔥 FIX: Verifica se il componente è ancora montato prima di creare nuovo intervallo
      if (!isMountedRef.current) return;

      currentInterval = setInterval(() => {
        if (isMountedRef.current) {
          syncAndUpdateTrends();
        } else {
          // 🔥 FIX: Se il componente è smontato, pulisci l'intervallo
          if (currentInterval) {
            clearInterval(currentInterval);
            currentInterval = null;
          }
        }
      }, getSyncInterval());
    };

    // Avvia l'intervallo iniziale
    startInterval();

    // Aggiorna l'intervallo ogni ora per adattarsi all'ora del giorno
    intervalUpdater = setInterval(() => {
      if (isMountedRef.current) {
        startInterval();
      } else {
        // 🔥 FIX: Se il componente è smontato, pulisci l'intervallo updater
        if (intervalUpdater) {
          clearInterval(intervalUpdater);
          intervalUpdater = null;
        }
      }
    }, 60 * 60 * 1000); // Ogni ora

    // 🔥 FIX: Cleanup completo - assicurati che tutti gli intervalli siano puliti
    return () => {
      if (currentInterval) {
        clearInterval(currentInterval);
        currentInterval = null;
      }
      if (intervalUpdater) {
        clearInterval(intervalUpdater);
        intervalUpdater = null;
      }
    };
  }, [isInitialized, hasAnyHealthPermission]); // 🔥 FIX: Rimuoviamo syncData dalle dipendenze per evitare loop

  const syncActivityToCalendar = async (activity: DailyActivity) => {
    try {
      const wellnessActivity = syncService.createWellnessActivityFromToday(
        {
          id: activity.id,
          title: activity.title,
          description: activity.description,
          time: activity.time || t('home.activities.ongoing'),
          category: activity.category,
        },
        true, // syncToCalendar
        false, // syncToReminders (we'll add this separately)
        15 // reminderMinutes
      );

      const result = await syncService.addWellnessActivity(wellnessActivity);

      if (result.success) {
        // 🔥 FIX: Non aggiorniamo più lo stato activities (rimosso) - le attività sono read-only
        // Le attività vengono da todaysActivities che è memoizzato e non cambia durante l'esecuzione

        Alert.alert(
          t('home.calendar.synced'),
          t('home.calendar.addedMessage', { title: activity.title }),
          [{ text: t('common.ok') }]
        );
      } else {
        Alert.alert(
          t('home.calendar.syncFailed'),
          result.error || t('home.calendar.syncFailedMessage'),
          [{ text: t('common.ok') }]
        );
      }
    } catch (error) {
      console.error('Failed to sync activity:', error);
      Alert.alert(
        'Sync Error',
        'Failed to sync activity to calendar. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const ensureNotificationScheduling = useCallback(async () => {
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
      console.error('Error enabling notification scheduling:', error);
    }
  }, []);

  const handleEnableWellnessPermissions = async () => {
    try {
      setRequestingWellnessPermissions(true);
      const result = await syncService.requestPermissions();
      setPermissions(result);

      if (result.notifications) {
        await ensureNotificationScheduling();
      }

      setShowWellnessPermissionsModal(false);

      if (result.calendar || result.notifications) {
        Alert.alert(t('common.success'), t('home.permissions.success'));
      } else {
        Alert.alert(t('home.permissions.required'), t('home.permissions.requiredMessage'), [{ text: t('common.ok') }]);
      }
    } catch (error) {
      console.error('Error requesting wellness permissions:', error);
      Alert.alert(t('common.error'), t('home.permissions.error'));
    } finally {
      setRequestingWellnessPermissions(false);
    }
  };

  const handleSkipWellnessPermissions = () => {
    setShowWellnessPermissionsModal(false);
  };

  const shouldShowWellnessPermissionCard = !permissions.calendar || !permissions.notifications;

  // Removed renderQuickLink function - replaced with Today at a glance widgets

  const renderHighlight = (card: HighlightCard, index: number) => {
    const animatedStyle = useAnimatedStyle(() => ({
      opacity: withDelay(index * 110, withTiming(1, { duration: 320 })),
      transform: [
        { translateY: withDelay(index * 110, withTiming(0, { duration: 320 })) },
      ],
    }));

    return (
      <Animated.View key={card.id} style={[styles.highlightCard, animatedStyle]}>
        <LinearGradient
          colors={card.colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.highlightGradient}
        >
          <View style={styles.highlightHeader}>
            <View style={styles.highlightIconWrap}>
              <FontAwesome name={card.icon as any} size={18} color="#ffffff" />
            </View>
            <View>
              <Text style={styles.highlightLabel}>{card.label}</Text>
              <Text style={styles.highlightDelta}>{card.delta}</Text>
            </View>
          </View>
          <Text style={styles.highlightValue}>{card.value}</Text>
        </LinearGradient>
      </Animated.View>
    );
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'mindfulness': return ['#8b5cf6', '#a78bfa'];
      case 'movement': return ['#10b981', '#34d399'];
      case 'nutrition': return ['#f59e0b', '#fbbf24'];
      case 'recovery': return ['#3b82f6', '#60a5fa'];
      default: return ['#6b7280', '#9ca3af'];
    }
  };

  const renderActivity = (activity: DailyActivity, index: number) => {
    const animatedStyle = useAnimatedStyle(() => ({
      opacity: withDelay(index * 80, withTiming(1, { duration: 320 })),
      transform: [
        { translateY: withDelay(index * 80, withTiming(0, { duration: 320 })) },
      ],
    }));

    const colors = getCategoryColor(activity.category);
    const completedCount = todaysActivities.filter(a => a.completed).length;
    const totalCount = todaysActivities.length;

    return (
      <Animated.View key={activity.id} style={[styles.activityCard, animatedStyle, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
        <TouchableOpacity activeOpacity={0.85}>
          <View style={styles.activityContent}>
            <View style={styles.activityLeft}>
              <View style={[styles.activityIcon, { backgroundColor: activity.completed ? '#10b981' : `${colors[0]}20` }]}>
                <FontAwesome
                  name={activity.completed ? 'check' : activity.icon as any}
                  size={16}
                  color={activity.completed ? '#ffffff' : colors[0]}
                />
              </View>
              <View style={styles.activityText}>
                <Text style={[styles.activityTitle, { color: themeColors.text }, activity.completed && styles.activityCompleted]}>
                  {activity.title}
                </Text>
                <Text style={[styles.activityDescription, { color: themeColors.textSecondary }]}>{activity.description}</Text>
                <Text style={[styles.activityTime, { color: themeColors.textTertiary }]}>{activity.time}</Text>
              </View>
            </View>
            <View style={styles.activityRight}>
              <View style={styles.statusContainer}>
                {activity.completed ? (
                  <View style={styles.completedBadge}>
                    <FontAwesome name="check-circle" size={20} color="#10b981" />
                  </View>
                ) : activity.progress ? (
                  <View style={styles.progressContainer}>
                    <View style={styles.progressBar}>
                      <View style={[styles.progressFill, { width: `${activity.progress}%`, backgroundColor: colors[0] }]} />
                    </View>
                    <Text style={styles.progressText}>{activity.progress}%</Text>
                  </View>
                ) : (
                  <View style={styles.pendingBadge}>
                    <FontAwesome name="clock-o" size={16} color="#6b7280" />
                  </View>
                )}
              </View>

              {/* Sync buttons */}
              <View style={styles.syncButtons}>
                {!activity.syncedToCalendar && permissions.calendar && (
                  <TouchableOpacity
                    style={styles.syncButton}
                    onPress={() => syncActivityToCalendar(activity)}
                    activeOpacity={0.7}
                  >
                    <FontAwesome name="calendar-plus-o" size={14} color="#6366f1" />
                  </TouchableOpacity>
                )}
                {activity.syncedToCalendar && (
                  <View style={styles.syncedBadge}>
                    <FontAwesome name="calendar-check-o" size={14} color="#10b981" />
                  </View>
                )}
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const getWidgetWidth = (size: 'small' | 'medium' | 'large') => {
    const screenWidth = width - 40; // 20px margin on each side
    const rowWidth = screenWidth - 16; // 8px gap on each side
    const gapBetweenWidgets = 8; // gap tra i widget nella riga
    switch (size) {
      case 'small': return rowWidth / 3;   // 1/3 della riga
      case 'medium': return (rowWidth * 2) / 3 + gapBetweenWidgets;  // 2/3 della riga + 1 gap
      case 'large': return rowWidth + (gapBetweenWidgets * 2);   // 3/3 della riga + 2 gap (per allinearsi con 3 widget small)
      default: return rowWidth / 3;
    }
  };

  const getWidgetSize = (size: 'small' | 'medium' | 'large') => {
    // Ora i componenti usano direttamente le dimensioni originali
    return size;
  };

  // True se nella riga (0..1) c'è un widget large che parte in colonna 0
  const rowHasLarge = (rowIndex: 0 | 1) =>
    widgetConfig.some(w =>
      w.enabled &&
      w.size === 'large' &&
      Math.floor(w.position / 3) === rowIndex &&
      (w.position % 3) === 0
    );

  const isPositionCovered = (pos: number) => {
    const row = Math.floor(pos / 3);

    return widgetConfig.some(w => {
      if (!w.enabled) return false;
      const wRow = Math.floor(w.position / 3);
      if (wRow !== row) return false;

      if (w.size === 'small') {
        return pos === w.position;
      }
      if (w.size === 'medium') {
        const col = w.position % 3; // 0,1,2
        return pos === w.position || (col !== 2 && pos === w.position + 1);
      }
      if (w.size === 'large') {
        return true; // copre tutta la riga
      }
      return false;
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={["top"]}>
      <ScrollView style={{ backgroundColor: themeColors.background }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} ref={scrollViewRef}>
        <LinearGradient colors={[themeColors.primaryDark, themeColors.primary]} style={styles.heroCard}>
          {/* Header with buttons inside the purple box */}
          <CopilotStep text="Benvenuto" order={1} name="header">
            <WalkthroughableView style={styles.heroTopRow}>
              <View style={styles.heroGreeting}>
                <Text style={styles.greeting}>{t('home.hello', { name: userFirstName })}</Text>
                <Text style={styles.tagline}>{t('home.tagline')}</Text>
              </View>
              <View style={styles.heroActions}>
                <TouchableOpacity
                  style={styles.heroHealthButton}
                  onPress={async () => {
                    // Mostra un alert per confermare il reset del tutorial
                    Alert.alert(
                      t('home.onboarding.resetTitle') || 'Rivisualizza Tutorial',
                      t('home.onboarding.resetMessage') || 'Vuoi rivisualizzare il tutorial?',
                      [
                        {
                          text: t('common.cancel') || 'Annulla',
                          style: 'cancel',
                        },
                        {
                          text: t('common.confirm') || 'Conferma',
                          style: 'default',
                          onPress: async () => {
                            try {
                              // Usa il metodo globale per forzare la visualizzazione del tutorial
                              if ((global as any).forceShowTutorial) {
                                await (global as any).forceShowTutorial();
                              } else {
                                // Fallback: reset tutorial e mostra messaggio
                                await OnboardingService.resetOnboarding();
                                setShowTutorial(true);
                              }
                            } catch (error) {
                              console.error('Error resetting tutorial:', error);
                              Alert.alert(
                                t('common.error') || 'Errore',
                                t('home.onboarding.resetError') || 'Impossibile resettare il tutorial. Riprova più tardi.'
                              );
                            }
                          },
                        },
                      ]
                    );
                  }}
                >
                  <FontAwesome name="question-circle" size={16} color="#ffffff" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.heroSettings}
                  onPress={() => router.push('/(tabs)/settings')}
                >
                  <FontAwesome name="cog" size={18} color="#ffffff" />
                </TouchableOpacity>
              </View>
            </WalkthroughableView>
          </CopilotStep>

          <View style={styles.heroAvatarRow}>
            <CopilotStep text="Il tuo Coach AI" order={2} name="dailyCopilot">
              <WalkthroughableView>
                <Avatar
                  avatarUri={avatarUri}
                  isGenerating={avatarGenerating}
                  onCreateAvatar={handleCreateAvatar}
                  onOpenCommunity={() => setCommunityModalVisible(true)}
                  onMicPress={() => {
                    // 🆕 Rimosso log per performance
                    // Force navigation by using a unique timestamp parameter
                    const timestamp = Date.now();
                    router.push(`/(tabs)/coach?voiceMode=true&t=${timestamp}`);
                  }}
                />
              </WalkthroughableView>
            </CopilotStep>
            <View style={styles.heroStats}>
              {getStats().map((item: any) => {
                const isMomentum = item.id === 'momentum';
                const isStreak = item.id === 'streak';
                const isNextSession = item.id === 'next-session';

                // Determine pill type for popup
                let pillType: 'streak' | 'momentum' | 'next-session' | null = null;
                if (item.id === 'streak') pillType = 'streak';
                else if (item.id === 'momentum') pillType = 'momentum';
                else if (item.id === 'next-session') pillType = 'next-session';

                return (
                  <TouchableOpacity
                    key={item.label}
                    style={styles.heroChip}
                    onPress={() => pillType && handlePillPress(pillType)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.heroChipIcon, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
                      <FontAwesome name={item.icon as any} size={12} color="#ffffff" />
                    </View>
                    <View style={styles.heroChipTextContainer}>
                      <Text style={styles.heroChipLabel} numberOfLines={1} ellipsizeMode="tail">{item.label}</Text>
                      {/* Forza bianco perché è su gradiente viola */}
                      <Text style={[styles.heroChipValue, { color: '#ffffff' }]} numberOfLines={2} ellipsizeMode="tail">{item.value}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </LinearGradient>

        {shouldShowWellnessPermissionCard && (
          <TouchableOpacity
            style={[
              styles.permissionCard,
              { backgroundColor: themeColors.surface, borderColor: themeColors.border }
            ]}
            activeOpacity={0.9}
            onPress={() => setShowWellnessPermissionsModal(true)}
          >
            <View style={[styles.permissionCardIcon, { backgroundColor: `${themeColors.primary}20` }]}>
              <MaterialCommunityIcons name="bell-plus" size={20} color={themeColors.primary} />
            </View>
            <View style={styles.permissionCardCopy}>
              <Text style={[styles.permissionCardTitle, { color: themeColors.text }]}>
                {t('home.permissions.cardTitle')}
              </Text>
              <Text style={[styles.permissionCardSubtitle, { color: themeColors.textSecondary }]}>
                {t('home.permissions.cardSubtitle')}
              </Text>
            </View>
            <View style={[styles.permissionCardAction, { borderColor: themeColors.primary }]}>
              <Text style={[styles.permissionCardActionText, { color: themeColors.primary }]}>
                {t('home.permissions.cardCta')}
              </Text>
            </View>
          </TouchableOpacity>
        )}

        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderContent}>
            <View>
              <Text style={[styles.sectionTitle, { color: themeColors.text }]}>{t('home.todayAtGlance')}</Text>
              <Text style={[styles.sectionSubtitle, { color: themeColors.textSecondary }]}>{t('home.todaySubtitle')}</Text>
            </View>
            <View style={styles.headerActions}>
              {editMode ? (
                <TouchableOpacity
                  onPress={() => {
                    // 🆕 Rimosso log per performance
                    setEditMode(false);
                  }}
                  style={styles.exitEditButton}
                >
                  <Text style={styles.exitEditButtonText}>{t('home.done')}</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.headerButtons}>

                  {/* DEBUG: Biometric Test Button */}

                  <TouchableOpacity
                    onPress={() => {
                      // 🆕 Rimosso log per performance
                      setEditMode(true);
                    }}
                    style={[
                      styles.editModeButton,
                      {
                        backgroundColor: themeColors.primary,
                        borderColor: themeColors.primaryDark,
                      }
                    ]}
                  >
                    <Text style={styles.editModeButtonText}>{t('home.edit')}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </View>
        {healthStatus !== 'ready' && (
          <View
            style={[
              styles.placeholderBanner,
              { backgroundColor: themeColors.surfaceMuted, borderColor: themeColors.border },
            ]}
          >
            <View style={styles.placeholderBannerIcon}>
              <MaterialCommunityIcons name="information" size={18} color={themeColors.text} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.placeholderBannerTitle, { color: themeColors.text }]}>
                {t('home.placeholders.previewBadge')}
              </Text>
              <Text style={[styles.placeholderBannerText, { color: themeColors.textSecondary }]}>
                {placeholderMessages[healthStatus as keyof typeof placeholderMessages]}
              </Text>
            </View>
            {healthStatus === 'waiting-permission' && (
              <TouchableOpacity
                style={[
                  styles.placeholderActionButton,
                  { borderColor: themeColors.primary, backgroundColor: themeColors.primary + '15' },
                ]}
                onPress={() => setHealthPermissionsModal(true)}
              >
                <Text style={[styles.placeholderActionText, { color: themeColors.primary }]}>
                  {t('home.permissions.required')}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        <CopilotStep text="I tuoi Widget" order={3} name="widgets">
          <WalkthroughableView style={styles.widgetGrid}>
            {/* Protezione per evitare crash se widgetData è vuoto */}
            {widgetData.length === 0 || configLoading ? (
              <View style={styles.loadingContainer}>
                <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>{t('home.loadingWidgets')}</Text>
              </View>
            ) : (
              <>
                {/* Riga 1: Posizioni 0, 1, 2 */}
                <View style={styles.widgetRow}>
                  {(rowHasLarge(0)
                    ? widgetConfig.filter(w => w.enabled && w.position === 0 && w.size === 'large')
                    : widgetConfig.filter(w => w.enabled && w.position < 3)
                  )
                    .sort((a, b) => a.position - b.position)
                    .map((widget) => {
                      // 🆕 Filtra il widget 'cycle' se l'utente non è di genere femminile
                      if (widget.id === 'cycle' && userGender !== 'female') {
                        return null;
                      }

                      // 👇 lascia esattamente il tuo map attuale (non serve cambiare la logica interna)
                      const widgetInfo = widgetData.find(w => w.id === widget.id);
                      if (!widgetInfo) return null;

                      const WidgetComponent =
                        widget.id === 'sleep' || widget.id === 'hrv' || widget.id === 'analyses' || widget.id === 'cycle'
                          ? MiniInfoCard
                          : MiniGaugeChart;

                      const gaugeProgress = computeGaugeProgress(widgetInfo);
                      const gaugeSubtitle = computeGaugeSubtitle(widgetInfo);
                      const gaugeTrend = computeGaugeTrend(gaugeProgress);
                      const infoValue = getInfoCardValue(widget.id, widgetInfo);
                      const infoSubtitle = getInfoCardSubtitle(widget.id, widgetInfo);
                      const infoTrend = getInfoCardTrend(widget.id, widgetInfo);
                      const infoDetails = getInfoCardDetails(widget.id, widgetInfo);

                      return (
                        <View key={widget.id} style={{ width: getWidgetWidth(widget.size) }}>
                          {dragTargetPosition === widget.position && (
                            <View style={styles.dropIndicator}>
                              <View style={styles.dropIndicatorInner} />
                            </View>
                          )}

                          <EditableWidget
                            widgetId={widget.id}
                            widgetTitle={widgetInfo.title}
                            onPress={() => handleWidgetPress(widget.id)}
                            onLongPress={() => handleWidgetLongPress(widget.id)}
                            onEnterEditMode={() => setEditMode(true)}
                            onDragTargetChange={setDragTargetPosition}
                            onResize={async (newSize) => { try { await changeSize(widget.id, newSize); } catch { } }}
                            onRemove={async () => { try { await toggleWidget(widget.id); } catch { } }}
                            editMode={editMode}
                          >
                            {WidgetComponent === MiniGaugeChart ? (
                              <MiniGaugeChart
                                value={gaugeProgress}
                                maxValue={100}
                                label={widgetInfo.title}
                                color={widgetInfo.color}
                                subtitle={gaugeSubtitle}
                                backgroundColor={widgetInfo.backgroundColor}
                                trendValue={gaugeTrend}
                                icon={widgetInfo.icon}
                                size={getWidgetSize(widget.size)}
                                additionalData={
                                  widgetInfo.steps
                                    ? { steps: widgetInfo.steps }
                                    : widgetInfo.hydration
                                      ? { hydration: widgetInfo.hydration }
                                      : widgetInfo.meditation
                                        ? { meditation: widgetInfo.meditation }
                                        : undefined
                                }
                              />
                            ) : (
                              <MiniInfoCard
                                label={widgetInfo.title}
                                value={infoValue}
                                subtitle={infoSubtitle}
                                icon={widgetInfo.icon}
                                color={widgetInfo.color}
                                backgroundColor={widgetInfo.backgroundColor}
                                trendValue={infoTrend}
                                size={getWidgetSize(widget.size)}
                                showStatus={widget.id === 'analyses'}
                                status={widgetInfo.analyses?.completed ? 'completed' : 'pending'}
                                detailChips={infoDetails}
                              />
                            )}
                          </EditableWidget>
                        </View>
                      );
                    })}
                  {!rowHasLarge(0) && createEmptySlots(0, 3)}
                </View>

                {/* Riga 2: Posizioni 3, 4, 5 */}
                <View style={styles.widgetRow}>
                  {(rowHasLarge(1)
                    ? widgetConfig.filter(w => w.enabled && w.position === 3 && w.size === 'large')
                    : widgetConfig.filter(w => w.enabled && w.position >= 3)
                  )
                    .sort((a, b) => a.position - b.position)
                    .map((widget) => {
                      // 🆕 Filtra il widget 'cycle' se l'utente non è di genere femminile
                      if (widget.id === 'cycle' && userGender !== 'female') {
                        return null;
                      }

                      const widgetInfo = widgetData.find(w => w.id === widget.id);
                      if (!widgetInfo) return null;

                      const WidgetComponent =
                        widget.id === 'sleep' || widget.id === 'hrv' || widget.id === 'analyses' || widget.id === 'cycle'
                          ? MiniInfoCard
                          : MiniGaugeChart;

                      const gaugeProgress = computeGaugeProgress(widgetInfo);
                      const gaugeSubtitle = computeGaugeSubtitle(widgetInfo);
                      const gaugeTrend = computeGaugeTrend(gaugeProgress);
                      const infoValue = getInfoCardValue(widget.id, widgetInfo);
                      const infoSubtitle = getInfoCardSubtitle(widget.id, widgetInfo);
                      const infoTrend = getInfoCardTrend(widget.id, widgetInfo);
                      const infoDetails = getInfoCardDetails(widget.id, widgetInfo);

                      return (
                        <View key={widget.id} style={{ width: getWidgetWidth(widget.size) }}>
                          {dragTargetPosition === widget.position && (
                            <View style={styles.dropIndicator}>
                              <View style={styles.dropIndicatorInner} />
                            </View>
                          )}
                          <EditableWidget
                            widgetId={widget.id}
                            widgetTitle={widgetInfo.title}
                            onPress={() => handleWidgetPress(widget.id)}
                            onLongPress={() => handleWidgetLongPress(widget.id)}
                            onEnterEditMode={() => setEditMode(true)}
                            onDragTargetChange={setDragTargetPosition}
                            onResize={async (newSize) => { try { await changeSize(widget.id, newSize); } catch { } }}
                            onRemove={async () => { try { await toggleWidget(widget.id); } catch { } }}
                            editMode={editMode}
                          >
                            {WidgetComponent === MiniGaugeChart ? (
                              <MiniGaugeChart
                                value={gaugeProgress}
                                maxValue={100}
                                label={widgetInfo.title}
                                color={widgetInfo.color}
                                subtitle={gaugeSubtitle}
                                backgroundColor={widgetInfo.backgroundColor}
                                trendValue={gaugeTrend}
                                icon={widgetInfo.icon}
                                size={getWidgetSize(widget.size)}
                                additionalData={
                                  widgetInfo.steps
                                    ? { steps: widgetInfo.steps }
                                    : widgetInfo.hydration
                                      ? { hydration: widgetInfo.hydration }
                                      : widgetInfo.meditation
                                        ? { meditation: widgetInfo.meditation }
                                        : undefined
                                }
                              />
                            ) : (
                              <MiniInfoCard
                                label={widgetInfo.title}
                                value={infoValue}
                                subtitle={infoSubtitle}
                                icon={widgetInfo.icon}
                                color={widgetInfo.color}
                                backgroundColor={widgetInfo.backgroundColor}
                                trendValue={infoTrend}
                                size={getWidgetSize(widget.size)}
                                showStatus={widget.id === 'analyses'}
                                status={widgetInfo.analyses?.completed ? 'completed' : 'pending'}
                                detailChips={infoDetails}
                              />
                            )}
                          </EditableWidget>
                        </View>
                      );
                    })}
                  {!rowHasLarge(1) && createEmptySlots(3, 6)}
                </View>
              </>
            )}
          </WalkthroughableView>
        </CopilotStep>


        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>{t('home.dailyCheckIn.title')}</Text>
          <Text style={[styles.sectionSubtitle, { color: themeColors.textSecondary }]}>{t('home.dailyCheckIn.subtitle')}</Text>
        </View>

        {/* Self-check: Mood & Sleep */}
        <CopilotStep text="Check-in Giornalieri" order={4} name="dailyCheckin">
          <WalkthroughableView style={styles.focusGrid}>
            <View style={{ flex: 1 }}>
              <MoodCheckinCard
                value={moodValue as 1 | 2 | 3 | 4 | 5}
                note={moodNote}
                hasExistingCheckin={hasExistingMoodCheckin}
                onChange={(v) => { setMoodValue(v); }}
                onSave={async ({ value, note }) => { setMoodValue(value); setMoodNote(note); await saveMoodCheckin(value, note); }}
              />
            </View>

            <View style={{ flex: 1 }}>
              <SleepCheckinCard
                hours={displayedSleepHours}
                quality={displayedSleepQuality}
                bedtime={sleepStats?.bedtime ?? '11:30 PM'}
                waketime={sleepStats?.wakeTime ?? '7:30 AM'}
                note={sleepNote}
                restLevel={restLevel}
                hasExistingCheckin={hasExistingSleepCheckin}
                onChangeRestLevel={(level) => { setRestLevel(level); }}
                onSave={async ({ quality, note }) => { setSleepQuality(quality); setSleepNote(note); await saveSleepCheckin(quality, note, restLevel); }}
              />
            </View>
          </WalkthroughableView>
        </CopilotStep>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>{t('home.activities.title')}</Text>
          <Text style={[styles.sectionSubtitle, { color: themeColors.textSecondary }]}>
            {t('home.calendar.ofCompleted', {
              completed: todaysActivities.filter(a => a.completed).length,
              total: todaysActivities.length
            })}
          </Text>
        </View>
        <View style={styles.activityContainer}>
          {todaysActivities.map((activity, index) => (
            <ActivityItem
              key={activity.id}
              activity={activity}
              index={index}
              onSync={syncActivityToCalendar}
              permissions={permissions}
              onActivityUpdated={loadWellnessActivities}
            />
          ))}
        </View>

        {/* AI Daily Copilot Section */}
        <CopilotStep text="AI Daily Copilot" order={5} name="dailyCopilotSection">
          <WalkthroughableView>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderContent}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sectionTitle, { color: themeColors.text }]}>{t('home.dailyCopilot.title')}</Text>
                  <Text style={[styles.sectionSubtitle, { color: themeColors.textSecondary }]}>{t('home.dailyCopilot.subtitle')}</Text>
                </View>
                {showHistory !== undefined && (
                  <TouchableOpacity
                    onPress={() => setShowHistory(true)}
                    style={styles.historyButtonHeader}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons name="history" size={20} color={themeColors.primary} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <DailyCopilot
              compact={false}
              onRecommendationPress={(recommendation) => {
                setRecommendationModal({ visible: true, recommendation });
              }}
            />
          </WalkthroughableView>
        </CopilotStep>

        {/* Weekly Progress Section */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderContent}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
                {t('home.weeklyProgress.title') || 'I tuoi progressi questa settimana'}
              </Text>
              <Text style={[styles.sectionSubtitle, { color: themeColors.textSecondary }]}>
                {t('home.weeklyProgress.subtitle') || 'Un riepilogo dei tuoi miglioramenti'}
              </Text>
            </View>
            <View style={styles.headerActions}>
              {chartEditMode ? (
                <>
                  {availableChartsList.length > 0 && (
                    <TouchableOpacity
                      onPress={() => setChartSelectionModal(true)}
                      style={[styles.addChartButton, { backgroundColor: themeColors.primary, borderColor: themeColors.primaryDark }]}
                    >
                      <FontAwesome name="plus" size={14} color="#ffffff" />
                      <Text style={styles.addChartButtonText}>{t('home.addChart')}</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={() => setChartEditMode(false)}
                    style={styles.exitEditButton}
                  >
                    <Text style={styles.exitEditButtonText}>{t('home.done')}</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  onPress={() => setChartEditMode(true)}
                  style={[
                    styles.editModeButton,
                    {
                      backgroundColor: themeColors.primary,
                      borderColor: themeColors.primaryDark,
                    }
                  ]}
                >
                  <Text style={styles.editModeButtonText}>{t('home.edit')}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* ✅ FIX: Banner informativo per dati di esempio - mostrato SOLO se non ci sono dati reali */}
        {!isHealthDataReady && enabledCharts.length > 0 && (
          <View style={[styles.sampleDataBanner, { backgroundColor: themeColors.surfaceMuted, borderColor: themeColors.border }]}>
            <MaterialCommunityIcons name="information-outline" size={18} color={themeColors.primary} />
            <View style={styles.sampleDataBannerContent}>
              <Text style={[styles.sampleDataBannerTitle, { color: themeColors.text }]}>
                {t('home.placeholders.sampleDataBadge')}
              </Text>
              <Text style={[styles.sampleDataBannerText, { color: themeColors.textSecondary }]}>
                {t('home.placeholders.sampleChartDescription')}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.weeklyProgressContainer}>
          {enabledCharts.length === 0 && !chartEditMode ? (
            <View style={[styles.progressCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
              <Text style={[styles.progressCardTitle, { color: themeColors.textSecondary }]}>
                {t('home.weeklyProgress.noCharts') || 'Nessun grafico abilitato. Usa il pulsante "Modifica" per abilitare i grafici.'}
              </Text>
            </View>
          ) : (
            <>
              {enabledCharts.map((chartConfig) => {
                // Steps Progress
                const shouldRenderSteps =
                  chartConfig.id === 'steps' &&
                  (isHealthDataReady ? healthData?.steps !== undefined : true);
                if (shouldRenderSteps) {
                  const stepsValue = isHealthDataReady ? (healthData?.steps || 0) : placeholderChartSamples.steps.value;
                  const stepsTrendData = isHealthDataReady
                    ? (() => {
                      const todayValue = healthData?.steps || 0;
                      const chartData = [...weeklyTrendData.steps];
                      if (chartData.length > 0) {
                        chartData[chartData.length - 1] = todayValue;
                      } else {
                        chartData.push(todayValue);
                      }
                      while (chartData.length < 7) {
                        chartData.unshift(0);
                      }
                      return chartData.slice(-7);
                    })()
                    : placeholderChartSamples.steps.trend;
                  const stepsMaxValue = isHealthDataReady
                    ? (() => {
                      const todayValue = healthData?.steps || 0;
                      const allValues = [...weeklyTrendData.steps, todayValue].filter(v => v > 0);
                      if (allValues.length === 0) return 10000;
                      const max = Math.max(...allValues);
                      return Math.ceil(max / 5000) * 5000 || 10000;
                    })()
                    : placeholderChartSamples.steps.max;
                  return (
                    <TouchableOpacity
                      key="steps"
                      style={[styles.progressCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
                      onPress={() => !chartEditMode && isHealthDataReady && setChartDetailModal({ visible: true, chartType: 'steps', currentValue: healthData?.steps || 0, color: '#10b981' })}
                      activeOpacity={chartEditMode ? 1 : 0.7}
                      disabled={chartEditMode || !isHealthDataReady}
                    >
                      <View style={styles.progressCardHeader}>
                        <MaterialCommunityIcons name="walk" size={24} color="#10b981" />
                        <Text style={[styles.progressCardTitle, { color: themeColors.text }]}>
                          {t('widgets.steps')}
                        </Text>
                        {chartEditMode && (
                          <TouchableOpacity
                            onPress={() => toggleChart('steps')}
                            style={[styles.chartEditButton, { backgroundColor: themeColors.error + '20' }]}
                          >
                            <FontAwesome name="times" size={14} color={themeColors.error} />
                          </TouchableOpacity>
                        )}
                      </View>
                      <View style={styles.progressCardContent}>
                        <View style={styles.progressCardLeft}>
                          <View style={styles.valueContainer}>
                            <Text style={[styles.progressCardValue, { color: themeColors.text }]}>
                              {stepsValue.toLocaleString()}
                            </Text>
                            <Text style={[styles.progressCardUnit, { color: themeColors.textSecondary }]}>
                              {t('home.weeklyProgress.steps') || 'passi'}
                            </Text>
                          </View>
                          <Text style={[styles.progressCardSubtitle, { color: themeColors.textSecondary }]}>
                            {t('home.weeklyProgress.today')}
                          </Text>
                        </View>
                        <View style={styles.progressCardRight}>
                          <MiniTrendChart
                            data={stepsTrendData}
                            color="#10b981"
                            maxValue={stepsMaxValue}
                            formatValue={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toString()}
                            width={CHART_WIDTH}
                          />
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                }

                // Sleep Progress
                const shouldRenderSleep =
                  chartConfig.id === 'sleepHours' &&
                  (isHealthDataReady ? healthData?.sleepHours !== undefined : true);
                if (shouldRenderSleep) {
                  const sleepValue = isHealthDataReady ? (healthData?.sleepHours || 0) : placeholderChartSamples.sleepHours.value;
                  const sleepTrendData = isHealthDataReady
                    ? (() => {
                      const todayValue = healthData?.sleepHours || 0;
                      const chartData = [...weeklyTrendData.sleepHours];
                      if (chartData.length > 0) {
                        chartData[chartData.length - 1] = todayValue;
                      } else {
                        chartData.push(todayValue);
                      }
                      while (chartData.length < 7) {
                        chartData.unshift(0);
                      }
                      return chartData.slice(-7);
                    })()
                    : placeholderChartSamples.sleepHours.trend;
                  const sleepMaxValue = isHealthDataReady
                    ? (() => {
                      const todayValue = healthData?.sleepHours || 0;
                      const allValues = [...weeklyTrendData.sleepHours, todayValue].filter(v => v > 0);
                      if (allValues.length === 0) return 10;
                      const max = Math.max(...allValues);
                      return Math.ceil(max / 2) * 2 || 10;
                    })()
                    : placeholderChartSamples.sleepHours.max;
                  return (
                    <TouchableOpacity
                      key="sleepHours"
                      style={[styles.progressCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
                      onPress={() => !chartEditMode && isHealthDataReady && setChartDetailModal({ visible: true, chartType: 'sleepHours', currentValue: healthData?.sleepHours || 0, color: '#6366f1' })}
                      activeOpacity={chartEditMode ? 1 : 0.7}
                      disabled={chartEditMode || !isHealthDataReady}
                    >
                      <View style={styles.progressCardHeader}>
                        <MaterialCommunityIcons name="sleep" size={24} color="#6366f1" />
                        <Text style={[styles.progressCardTitle, { color: themeColors.text }]}>
                          {t('widgets.sleep')}
                        </Text>
                        {chartEditMode && (
                          <TouchableOpacity
                            onPress={() => toggleChart('sleepHours')}
                            style={[styles.chartEditButton, { backgroundColor: themeColors.error + '20' }]}
                          >
                            <FontAwesome name="times" size={14} color={themeColors.error} />
                          </TouchableOpacity>
                        )}
                      </View>
                      <View style={styles.progressCardContent}>
                        <View style={styles.progressCardLeft}>
                          <View style={styles.valueContainer}>
                            <Text style={[styles.progressCardValue, { color: themeColors.text }]}>
                              {sleepValue ? `${Math.round(sleepValue * 10) / 10}` : '—'}
                            </Text>
                            <Text style={[styles.progressCardUnit, { color: themeColors.textSecondary }]}>
                              {sleepValue ? 'h' : ''}
                            </Text>
                          </View>
                          <Text style={[styles.progressCardSubtitle, { color: themeColors.textSecondary }]} numberOfLines={2}>
                            {healthData?.sleepQuality
                              ? `${Math.round(healthData.sleepQuality)}% ${t('home.weeklyProgress.quality')}`
                              : t('home.weeklyProgress.today')}
                          </Text>
                        </View>
                        <View style={styles.progressCardRight}>
                          <MiniTrendChart
                            data={sleepTrendData}
                            color="#6366f1"
                            maxValue={sleepMaxValue}
                            formatValue={(v) => `${v.toFixed(1)}h`}
                            width={CHART_WIDTH}
                          />
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                }

                // HRV Progress
                const shouldRenderHrv =
                  chartConfig.id === 'hrv' &&
                  (isHealthDataReady ? (healthData?.hrv ?? 0) > 0 : true);
                if (shouldRenderHrv) {
                  const hrvValue = isHealthDataReady ? (healthData?.hrv || 0) : placeholderChartSamples.hrv.value;
                  const hrvTrendData = isHealthDataReady
                    ? (() => {
                      const todayValue = healthData?.hrv || 0;
                      const chartData = [...weeklyTrendData.hrv];
                      if (chartData.length > 0) {
                        chartData[chartData.length - 1] = todayValue;
                      } else {
                        chartData.push(todayValue);
                      }
                      while (chartData.length < 7) {
                        chartData.unshift(0);
                      }
                      return chartData.slice(-7);
                    })()
                    : placeholderChartSamples.hrv.trend;
                  const hrvMaxValue = isHealthDataReady
                    ? (() => {
                      const todayValue = healthData?.hrv || 0;
                      const allValues = [...weeklyTrendData.hrv, todayValue].filter(v => v > 0);
                      if (allValues.length === 0) return 100;
                      const max = Math.max(...allValues);
                      return Math.ceil(max / 25) * 25 || 100;
                    })()
                    : placeholderChartSamples.hrv.max;
                  return (
                    <TouchableOpacity
                      key="hrv"
                      style={[styles.progressCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
                      onPress={() => !chartEditMode && isHealthDataReady && setChartDetailModal({ visible: true, chartType: 'hrv', currentValue: healthData?.hrv || 0, color: '#ef4444' })}
                      activeOpacity={chartEditMode ? 1 : 0.7}
                      disabled={chartEditMode || !isHealthDataReady}
                    >
                      <View style={styles.progressCardHeader}>
                        <MaterialCommunityIcons name="heart-pulse" size={24} color="#ef4444" />
                        <Text style={[styles.progressCardTitle, { color: themeColors.text }]}>
                          {t('widgets.hrv')}
                        </Text>
                        {chartEditMode && (
                          <TouchableOpacity
                            onPress={() => toggleChart('hrv')}
                            style={[styles.chartEditButton, { backgroundColor: themeColors.error + '20' }]}
                          >
                            <FontAwesome name="times" size={14} color={themeColors.error} />
                          </TouchableOpacity>
                        )}
                      </View>
                      <View style={styles.progressCardContent}>
                        <View style={styles.progressCardLeft}>
                          <View style={styles.valueContainer}>
                            <Text style={[styles.progressCardValue, { color: themeColors.text }]}>
                              {hrvValue >= 100 ? Math.round(hrvValue) : (Math.round(hrvValue * 10) / 10)}
                            </Text>
                            <Text style={[styles.progressCardUnit, { color: themeColors.textSecondary }]}>
                              ms
                            </Text>
                          </View>
                          <Text style={[styles.progressCardSubtitle, { color: themeColors.textSecondary }]} numberOfLines={1}>
                            {t('home.weeklyProgress.current')}
                          </Text>
                        </View>
                        <View style={styles.progressCardRight}>
                          <MiniTrendChart
                            data={hrvTrendData}
                            color="#ef4444"
                            maxValue={hrvMaxValue}
                            formatValue={(v) => v >= 100 ? Math.round(v).toString() : v.toFixed(1)}
                            width={CHART_WIDTH}
                          />
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                }

                // Heart Rate Progress
                const shouldRenderHeartRate =
                  chartConfig.id === 'heartRate' &&
                  (isHealthDataReady ? (healthData?.heartRate ?? 0) > 0 : true);
                if (shouldRenderHeartRate) {
                  const heartRateValue = isHealthDataReady ? (healthData?.heartRate || 0) : placeholderChartSamples.heartRate.value;
                  const heartRateTrendData = isHealthDataReady
                    ? (() => {
                      const todayValue = healthData?.heartRate || 0;
                      const chartData = [...weeklyTrendData.heartRate];
                      if (chartData.length > 0) {
                        chartData[chartData.length - 1] = todayValue;
                      } else {
                        chartData.push(todayValue);
                      }
                      while (chartData.length < 7) {
                        chartData.unshift(0);
                      }
                      return chartData.slice(-7);
                    })()
                    : placeholderChartSamples.heartRate.trend;
                  const heartRateMaxValue = isHealthDataReady
                    ? (() => {
                      const todayValue = healthData?.heartRate || 0;
                      const allValues = [...weeklyTrendData.heartRate, todayValue].filter(v => v > 0);
                      if (allValues.length === 0) return 100;
                      const max = Math.max(...allValues);
                      return Math.ceil(max / 25) * 25 || 100;
                    })()
                    : placeholderChartSamples.heartRate.max;
                  return (
                    <TouchableOpacity
                      key="heartRate"
                      style={[styles.progressCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
                      onPress={() => !chartEditMode && isHealthDataReady && setChartDetailModal({ visible: true, chartType: 'heartRate', currentValue: heartRateValue, color: '#ef4444' })}
                      activeOpacity={chartEditMode ? 1 : 0.7}
                      disabled={chartEditMode || !isHealthDataReady}
                    >
                      <View style={styles.progressCardHeader}>
                        <MaterialCommunityIcons name="heart" size={24} color="#ef4444" />
                        <Text style={[styles.progressCardTitle, { color: themeColors.text }]}>
                          {t('home.weeklyProgress.heartRate')}
                        </Text>
                        {chartEditMode && (
                          <TouchableOpacity
                            onPress={() => toggleChart('heartRate')}
                            style={[styles.chartEditButton, { backgroundColor: themeColors.error + '20' }]}
                          >
                            <FontAwesome name="times" size={14} color={themeColors.error} />
                          </TouchableOpacity>
                        )}
                      </View>
                      <View style={styles.progressCardContent}>
                        <View style={styles.progressCardLeft}>
                          <View style={styles.valueContainer}>
                            <Text style={[styles.progressCardValue, { color: themeColors.text }]}>
                              {Math.round(heartRateValue)}
                            </Text>
                            <Text style={[styles.progressCardUnit, { color: themeColors.textSecondary }]}>
                              {t('home.bpm')}
                            </Text>
                          </View>
                          <Text style={[styles.progressCardSubtitle, { color: themeColors.textSecondary }]} numberOfLines={2}>
                            {healthData?.restingHeartRate
                              ? `${t('home.hrv.restingHR')}: ${Math.round(healthData.restingHeartRate)} ${t('home.bpm')}`
                              : t('home.weeklyProgress.current')}
                          </Text>
                        </View>
                        <View style={styles.progressCardRight}>
                          <MiniTrendChart
                            data={heartRateTrendData}
                            color="#ef4444"
                            maxValue={heartRateMaxValue}
                            formatValue={(v) => `${Math.round(v)}`}
                            width={CHART_WIDTH}
                          />
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                }

                // Hydration Progress
                if (chartConfig.id === 'hydration') {
                  const hydrationValue = isHealthDataReady ? Math.round((healthData?.hydration || 0) / 250) : placeholderChartSamples.hydration.value;
                  const hydrationTrendData = isHealthDataReady
                    ? (() => {
                      const todayValue = Math.round((healthData?.hydration || 0) / 250);
                      const chartData = weeklyTrendData.hydration.map(v => Math.round(v / 250));
                      if (chartData.length > 0) {
                        chartData[chartData.length - 1] = todayValue;
                      } else {
                        chartData.push(todayValue);
                      }
                      while (chartData.length < 7) {
                        chartData.unshift(0);
                      }
                      return chartData.slice(-7);
                    })()
                    : placeholderChartSamples.hydration.trend;
                  const hydrationMaxValue = isHealthDataReady
                    ? (() => {
                      const todayValue = Math.round((healthData?.hydration || 0) / 250);
                      const allValues = [...weeklyTrendData.hydration.map(v => Math.round(v / 250)), todayValue].filter(v => v > 0);
                      if (allValues.length === 0) return 8;
                      const max = Math.max(...allValues);
                      return Math.ceil(max / 2) * 2 || 8;
                    })()
                    : placeholderChartSamples.hydration.max;
                  return (
                    <TouchableOpacity
                      key="hydration"
                      style={[styles.progressCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
                      onPress={() => !chartEditMode && isHealthDataReady && setChartDetailModal({ visible: true, chartType: 'hydration', currentValue: healthData?.hydration || 0, color: '#3b82f6' })}
                      activeOpacity={chartEditMode ? 1 : 0.7}
                      disabled={chartEditMode || !isHealthDataReady}
                    >
                      <View style={styles.progressCardHeader}>
                        <MaterialCommunityIcons name="cup-water" size={24} color="#3b82f6" />
                        <Text style={[styles.progressCardTitle, { color: themeColors.text }]}>
                          {t('widgets.hydration')}
                        </Text>
                        {chartEditMode && (
                          <TouchableOpacity
                            onPress={() => toggleChart('hydration')}
                            style={[styles.chartEditButton, { backgroundColor: themeColors.error + '20' }]}
                          >
                            <FontAwesome name="times" size={14} color={themeColors.error} />
                          </TouchableOpacity>
                        )}
                      </View>
                      <View style={styles.progressCardContent}>
                        <View style={styles.progressCardLeft}>
                          <View style={styles.valueContainer}>
                            <Text style={[styles.progressCardValue, { color: themeColors.text }]}>
                              {hydrationValue}
                            </Text>
                            <Text style={[styles.progressCardUnit, { color: themeColors.textSecondary }]}>
                              {t('home.glasses')}
                            </Text>
                          </View>
                          <Text style={[styles.progressCardSubtitle, { color: themeColors.textSecondary }]} numberOfLines={2}>
                            {healthData?.hydration ? `${(healthData.hydration / 1000).toFixed(1)} L` : t('home.weeklyProgress.today')}
                          </Text>
                        </View>
                        <View style={styles.progressCardRight}>
                          <MiniTrendChart
                            data={hydrationTrendData}
                            color="#3b82f6"
                            maxValue={hydrationMaxValue}
                            formatValue={(v) => `${Math.round(v)}`}
                            width={CHART_WIDTH}
                          />
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                }

                // Meditation Progress
                if (chartConfig.id === 'meditation') {
                  const meditationValue = isHealthDataReady ? Math.round(healthData?.mindfulnessMinutes || 0) : placeholderChartSamples.meditation.value;
                  const meditationTrendData = isHealthDataReady
                    ? (() => {
                      const todayValue = healthData?.mindfulnessMinutes || 0;
                      const chartData = [...weeklyTrendData.meditation];
                      if (chartData.length > 0) {
                        chartData[chartData.length - 1] = todayValue;
                      } else {
                        chartData.push(todayValue);
                      }
                      while (chartData.length < 7) {
                        chartData.unshift(0);
                      }
                      return chartData.slice(-7);
                    })()
                    : placeholderChartSamples.meditation.trend;
                  const meditationMaxValue = isHealthDataReady
                    ? (() => {
                      const todayValue = healthData?.mindfulnessMinutes || 0;
                      const allValues = [...weeklyTrendData.meditation, todayValue].filter(v => v > 0);
                      if (allValues.length === 0) return 30;
                      const max = Math.max(...allValues);
                      return Math.ceil(max / 15) * 15 || 30;
                    })()
                    : placeholderChartSamples.meditation.max;
                  return (
                    <TouchableOpacity
                      key="meditation"
                      style={[styles.progressCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
                      onPress={() => !chartEditMode && isHealthDataReady && setChartDetailModal({ visible: true, chartType: 'meditation', currentValue: healthData?.mindfulnessMinutes || 0, color: '#8b5cf6' })}
                      activeOpacity={chartEditMode ? 1 : 0.7}
                      disabled={chartEditMode || !isHealthDataReady}
                    >
                      <View style={styles.progressCardHeader}>
                        <MaterialCommunityIcons name="meditation" size={24} color="#8b5cf6" />
                        <Text style={[styles.progressCardTitle, { color: themeColors.text }]}>
                          {t('widgets.meditation')}
                        </Text>
                        {chartEditMode && (
                          <TouchableOpacity
                            onPress={() => toggleChart('meditation')}
                            style={[styles.chartEditButton, { backgroundColor: themeColors.error + '20' }]}
                          >
                            <FontAwesome name="times" size={14} color={themeColors.error} />
                          </TouchableOpacity>
                        )}
                      </View>
                      <View style={styles.progressCardContent}>
                        <View style={styles.progressCardLeft}>
                          <View style={styles.valueContainer}>
                            <Text style={[styles.progressCardValue, { color: themeColors.text }]}>
                              {meditationValue}
                            </Text>
                            <Text style={[styles.progressCardUnit, { color: themeColors.textSecondary }]}>
                              {t('home.minutes')}
                            </Text>
                          </View>
                          <Text style={[styles.progressCardSubtitle, { color: themeColors.textSecondary }]} numberOfLines={2}>
                            {t('home.weeklyProgress.today')}
                          </Text>
                        </View>
                        <View style={styles.progressCardRight}>
                          <MiniTrendChart
                            data={meditationTrendData}
                            color="#8b5cf6"
                            maxValue={meditationMaxValue}
                            formatValue={(v) => `${Math.round(v)}`}
                            width={CHART_WIDTH}
                          />
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                }

                return null;
              })}

              {/* Mostra i grafici disabilitati in modalità edit per permettere di riabilitarli */}
              {chartEditMode && disabledCharts.length > 0 && (
                <View style={styles.disabledChartsContainer}>
                  <Text style={[styles.disabledChartsTitle, { color: themeColors.textSecondary }]}>
                    {t('home.weeklyProgress.disabledCharts') || 'Grafici disabilitati'}
                  </Text>
                  {disabledCharts.map((chart) => {
                    const chartLabels: Record<ChartType, { icon: string; label: string; color: string }> = {
                      steps: { icon: 'walk', label: t('widgets.steps'), color: '#10b981' },
                      sleepHours: { icon: 'sleep', label: t('widgets.sleep'), color: '#6366f1' },
                      hrv: { icon: 'heart-pulse', label: t('widgets.hrv'), color: '#ef4444' },
                      heartRate: { icon: 'heart', label: t('home.weeklyProgress.heartRate'), color: '#ef4444' },
                      hydration: { icon: 'cup-water', label: t('widgets.hydration'), color: '#3b82f6' },
                      meditation: { icon: 'meditation', label: t('widgets.meditation'), color: '#8b5cf6' },
                    };
                    const chartInfo = chartLabels[chart.id];

                    return (
                      <TouchableOpacity
                        key={chart.id}
                        onPress={() => enableChart(chart.id)}
                        style={[styles.disabledChartCard, { backgroundColor: themeColors.surfaceMuted, borderColor: themeColors.border }]}
                      >
                        <MaterialCommunityIcons name={chartInfo.icon as any} size={20} color={chartInfo.color} />
                        <Text style={[styles.disabledChartLabel, { color: themeColors.text }]}>{chartInfo.label}</Text>
                        <FontAwesome name="plus-circle" size={18} color={themeColors.primary} />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* Pill Detail Popup */}
      <PillDetailPopup
        visible={selectedPill !== null}
        onClose={closePillPopup}
        type={selectedPill || 'streak'}
        momentumData={momentumData}
      />

      {/* Widget Goal Modal */}
      {goalModal.visible && goalModal.widgetId && (
        <WidgetGoalModal
          visible={goalModal.visible}
          widgetId={goalModal.widgetId}
          initialValue={(() => {
            const w = widgetData.find(w => w.id === goalModal.widgetId);
            if (!w) return undefined;
            switch (goalModal.widgetId) {
              case 'steps': return w.steps?.goal;
              case 'hydration': {
                // 🔥 FIX: Converti da bicchieri all'unità preferita per la visualizzazione
                const glasses = w.hydration?.goal ?? 8;
                // Convertiamo in modo asincrono, ma per ora usiamo bicchieri come default
                // Il modal caricherà l'unità preferita e convertirà automaticamente
                return glasses;
              }
              case 'meditation': return w.meditation?.goal;
              case 'sleep': return w.sleep?.goal;
              default: return undefined;
            }
          })()}
          onClose={() => setGoalModal({ visible: false, widgetId: null })}
          onSave={async (newVal) => {
            // 🔥 FIX: Per hydration, converti dall'unità preferita a bicchieri per retrocompatibilità
            let valueToSave = newVal;
            if (goalModal.widgetId === 'hydration') {
              const { hydrationUnitService } = await import('../services/hydration-unit.service');
              const preferredUnit = await hydrationUnitService.getPreferredUnit();
              // Converti dall'unità preferita a ml, poi a bicchieri (250ml)
              const ml = hydrationUnitService.unitToMl(newVal, preferredUnit);
              valueToSave = Math.round(ml / 250); // Salva sempre in bicchieri internamente
            }
            
            // salva
            await widgetGoalsService.setGoal(goalModal.widgetId!, valueToSave);
            // ricarica widget data con i nuovi goal
            const goals = await widgetGoalsService.getGoals();
            const data = WidgetDataService.generateWidgetData(goals);
            // 🔥 FIX: Usiamo la funzione helper per tradurre i widget (evita duplicazione)
            const translatedData = data.map(w => ({
              ...w,
              title: translateWidgetTitle(w.id),
            }));
            setWidgetData(translatedData);
            setGoalModal({ visible: false, widgetId: null });
          }}
        />
      )}

      {/* Health Permissions Modal */}
      <HealthPermissionsModal
        visible={healthPermissionsModal}
        onClose={() => setHealthPermissionsModal(false)}
        onSuccess={async () => {
          // 🔥 FIX: Chiudi il modal PRIMA di fare sync per evitare loop
          setHealthPermissionsModal(false);

          // 🔥 FIX: Forza sync immediata dei dati dopo concessione permessi
          try {
            // 🔥 CRITICO: PRIMA aggiorna i permessi nel hook (reinizializza servizio e aggiorna stato)
            await refreshPermissions();
            
            // 🔥 Poi sincronizza i dati con i nuovi permessi
            const syncResult = await syncData();
            
            // 🔥 Aspetta un attimo per dare tempo ai dati di essere processati
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // 🔥 Aggiorna i widget immediatamente con i nuovi dati
            if (syncResult.success && syncResult.data) {
              const data = await buildWidgetDataFromHealth();
              setWidgetData(data);
            } else {
              // Fallback: prova a costruire i widget con i dati disponibili
              const data = await buildWidgetDataFromHealth();
              setWidgetData(data);
            }
            
            // Ricarica anche i dati del Daily Copilot
            loadTodayGlanceData();
          } catch (error) {
            console.error('Error syncing after permissions:', error);
            // Fallback: prova comunque a sincronizzare tramite hook
            try {
              await refreshPermissions();
              await syncData();
              const data = await buildWidgetDataFromHealth();
              setWidgetData(data);
            } catch (fallbackError) {
              console.error('Fallback sync also failed:', fallbackError);
            }
          }
        }}
      />

      <WellnessPermissionsModal
        visible={showWellnessPermissionsModal}
        onEnable={handleEnableWellnessPermissions}
        onSkip={handleSkipWellnessPermissions}
        loading={requestingWellnessPermissions}
        missingCalendar={!permissions.calendar}
        missingNotifications={!permissions.notifications}
      />

      {/* WelcomeOverlay rimosso - usiamo solo InteractiveTutorial gestito da AuthWrapper */}

      {/* Recommendation Detail Modal */}
      {recommendationModal.recommendation && (
        <RecommendationDetailModal
          visible={recommendationModal.visible}
          onClose={() => setRecommendationModal({ visible: false, recommendation: null })}
          recommendation={recommendationModal.recommendation}
        />
      )}

      {/* Daily Copilot History Modal */}
      {showHistory && (
        <DailyCopilotHistory
          onClose={() => setShowHistory(false)}
        />
      )}

      {/* Widget Selection Modal */}
      <WidgetSelectionModal
        visible={widgetSelectionModal.visible}
        onClose={() => setWidgetSelectionModal({ visible: false, position: 0 })}
        onSelect={handleWidgetSelect}
        availableWidgets={getAvailableWidgets()}
        position={widgetSelectionModal.position}
      />

      <AvatarCommunityModal
        visible={communityModalVisible}
        onClose={() => setCommunityModalVisible(false)}
        onCreateAvatar={handleCreateAvatar}
        avatars={communityAvatars}
        currentUserAvatarUri={avatarUri}
        currentUserName={userFirstName}
        onAvatarPress={(avatar) => {
          Alert.alert(
            avatar.displayName,
            avatar.streak
              ? `🔥 Streak: ${avatar.streak} giorni\n${avatar.hasAvatar || avatar.imageUrl ? '✓ Ha un avatar personalizzato' : 'Non ha ancora creato un avatar'}`
              : `Nuovo membro\n${avatar.hasAvatar || avatar.imageUrl ? '✓ Ha un avatar personalizzato' : 'Non ha ancora creato un avatar'}`,
            [{ text: 'OK', style: 'default' }]
          );
        }}
      />

      {/* Chart Selection Modal */}
      <ChartSelectionModal
        visible={chartSelectionModal}
        onClose={() => setChartSelectionModal(false)}
        onSelect={async (chartId) => {
          await enableChart(chartId);
          // Ricarica i grafici disponibili
          const available = await getAvailableCharts();
          setAvailableChartsList(available);
        }}
        availableCharts={availableChartsList}
      />

      {/* Chart Detail Modal */}
      {chartDetailModal.chartType && (
        <ChartDetailModal
          visible={chartDetailModal.visible}
          onClose={() => setChartDetailModal({ visible: false, chartType: null, currentValue: undefined, color: '#10b981' })}
          chartType={chartDetailModal.chartType}
          currentValue={chartDetailModal.currentValue}
          color={chartDetailModal.color}
        />
      )}

      {/* Hydration Action Modal */}
      <HydrationActionModal
        visible={hydrationActionModal}
        onClose={() => setHydrationActionModal(false)}
        onAdd={async () => {
          const currentUser = await AuthService.getCurrentUser();
          if (!currentUser?.id) return;

          const result = await TodayGlanceService.addWaterGlass(currentUser.id);
          
          if (result.success) {
            const { hydrationUnitService } = await import('../services/hydration-unit.service');
            const unit = await hydrationUnitService.getPreferredUnit();
            const config = hydrationUnitService.getUnitConfig(unit);
            const units = hydrationUnitService.mlToUnit(result.newHydration || 0, unit);
            
            UserFeedbackService.showSuccess(
              t('home.hydrationActions.addedSuccess', { 
                units: Math.round(units * 10) / 10,
                unitLabel: config.label 
              }) || `Aggiunto! Totale: ${Math.round(units * 10) / 10} ${config.label}`,
              t('home.hydrationActions.addedTitle') || 'Acqua aggiunta'
            );

            // Aggiorna i dati di salute e i widget
            await syncData();
            const updatedWidgetData = await buildWidgetDataFromHealth();
            setWidgetData(updatedWidgetData);
          } else {
            UserFeedbackService.showError(
              result.error || t('home.hydrationActions.addError') || 'Errore durante l\'aggiunta dell\'acqua',
              t('common.error') || 'Errore'
            );
          }
        }}
        onRemove={async () => {
          const currentUser = await AuthService.getCurrentUser();
          if (!currentUser?.id) return;

          const result = await TodayGlanceService.removeWaterGlass(currentUser.id);
          
          if (result.success) {
            const { hydrationUnitService } = await import('../services/hydration-unit.service');
            const unit = await hydrationUnitService.getPreferredUnit();
            const config = hydrationUnitService.getUnitConfig(unit);
            const units = hydrationUnitService.mlToUnit(result.newHydration || 0, unit);
            
            UserFeedbackService.showSuccess(
              t('home.hydrationActions.removedSuccess', { 
                units: Math.round(units * 10) / 10,
                unitLabel: config.label 
              }) || `Rimosso! Totale: ${Math.round(units * 10) / 10} ${config.label}`,
              t('home.hydrationActions.removedTitle') || 'Acqua rimossa'
            );

            // Aggiorna i dati di salute e i widget
            await syncData();
            const updatedWidgetData = await buildWidgetDataFromHealth();
            setWidgetData(updatedWidgetData);
          } else {
            UserFeedbackService.showError(
              result.error || t('home.hydrationActions.removeError') || 'Errore durante la rimozione dell\'acqua',
              t('common.error') || 'Errore'
            );
          }
        }}
      />

    </SafeAreaView>
  );
};

/** ---------- MoodFocusCard ---------- */
const MoodFocusCard: React.FC<{
  moodLabel: 'Positive' | 'Neutral' | 'Negative';
  deltaPct?: number; // es: +6
  onPress?: () => void;
  onLongPress?: () => void;
}> = ({ moodLabel, deltaPct = 0, onPress, onLongPress }) => {
  const { t } = useTranslation(); // 🆕 i18n
  const isPositive = moodLabel === 'Positive';
  const isNeutral = moodLabel === 'Neutral';
  const gradient = isPositive
    ? ['#A7F3D0', '#6EE7B7'] as const
    : isNeutral
      ? ['#FDE68A', '#FCD34D'] as const
      : ['#FECACA', '#FCA5A5'] as const;

  const emoji = isPositive ? '🙂' : isNeutral ? '😐' : '☹️';
  const trendIcon = deltaPct >= 0 ? 'arrow-up' : 'arrow-down';

  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} style={{ flex: 1 }}>
      <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.focusCard}>
        <View style={styles.focusCardHeader}>
          <Text style={styles.focusEmoji}>{emoji}</Text>
          <View style={styles.focusBadge}>
            <MaterialCommunityIcons
              name={deltaPct >= 0 ? 'trending-up' : 'trending-down'}
              size={14}
              color={deltaPct >= 0 ? '#065F46' : '#7F1D1D'}
            />
            <Text style={[styles.focusBadgeText, { color: deltaPct >= 0 ? '#065F46' : '#7F1D1D' }]}>
              {deltaPct >= 0 ? `+${deltaPct}%` : `${deltaPct}%`}
            </Text>
          </View>
        </View>

        <Text style={styles.focusTitle}>{t('home.moodBalance')}</Text>
        <Text style={styles.focusPrimaryValue}>{moodLabel}</Text>
        <Text style={styles.focusSubtext}>{t('home.vsYesterday')}</Text>
      </LinearGradient>
    </Pressable>
  );
};

/** ---------- SleepFocusCard ---------- */
const SleepFocusCard: React.FC<{
  hoursLabel: string;        // es "7h 45m"
  quality?: number;          // es 82
  deep?: string;             // es "2h 15m"
  rem?: string;              // es "1h 45m"
  onPress?: () => void;
  onLongPress?: () => void;
}> = ({ hoursLabel, quality = 0, deep, rem, onPress, onLongPress }) => {
  const { t } = useTranslation(); // 🆕 i18n
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} style={{ flex: 1 }}>
      <LinearGradient colors={['#BFDBFE', '#93C5FD'] as const} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.focusCard}>
        <View style={styles.focusCardHeader}>
          <MaterialCommunityIcons name="moon-waning-crescent" size={22} color="#0C4A6E" />
          {typeof quality === 'number' && quality > 0 && (
            <View style={[styles.focusBadge, { backgroundColor: 'rgba(255,255,255,0.7)' }]}>
              <MaterialCommunityIcons name="star" size={14} color="#334155" />
              <Text style={[styles.focusBadgeText, { color: '#334155' }]}>{quality}%</Text>
            </View>
          )}
        </View>

        <Text style={styles.focusTitle}>{t('home.restfulSleep')}</Text>
        <Text style={styles.focusPrimaryValue}>{hoursLabel}</Text>

        {(deep || rem) && (
          <View style={styles.sleepChipsRow}>
            {deep && (
              <View style={styles.sleepChip}>
                <Text style={styles.sleepChipText}>💤 {deep}</Text>
              </View>
            )}
            {rem && (
              <View style={styles.sleepChip}>
                <Text style={styles.sleepChipText}>🧠 {rem}</Text>
              </View>
            )}
          </View>
        )}
      </LinearGradient>
    </Pressable>
  );
};

const ActivityItem: React.FC<{
  activity: DailyActivity;
  index: number;
  onSync: (a: DailyActivity) => void;
  permissions: { calendar: boolean; notifications: boolean };
  onActivityUpdated?: () => void;
}> = ({ activity, index, onSync, permissions, onActivityUpdated }) => {
  const { colors: themeColors } = useTheme();
  const [isCompleting, setIsCompleting] = React.useState(false);
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: withDelay(index * 80, withTiming(1, { duration: 320 })),
    transform: [
      { translateY: withDelay(index * 80, withTiming(0, { duration: 320 })) },
      { scale: scale.value },
    ] as const,
  }));

  const colors = (() => {
    switch (activity.category) {
      case 'mindfulness': return ['#8b5cf6', '#a78bfa'] as const;
      case 'movement': return ['#10b981', '#34d399'] as const;
      case 'nutrition': return ['#f59e0b', '#fbbf24'] as const;
      case 'recovery': return ['#3b82f6', '#60a5fa'] as const;
      default: return ['#6b7280', '#9ca3af'] as const;
    }
  })();

  const handleToggleComplete = async () => {
    if (isCompleting) return;

    setIsCompleting(true);
    scale.value = withTiming(0.95, { duration: 100 }, () => {
      scale.value = withTiming(1, { duration: 100 });
    });

    try {
      const WellnessActivitiesService = (await import('../services/wellness-activities.service')).default;
      const result = await WellnessActivitiesService.markActivityCompleted(activity.id, !activity.completed);

      if (result.success) {
        // Ricarica le attività dopo un breve delay per permettere l'animazione
        setTimeout(() => {
          onActivityUpdated?.();
        }, 300);
      }
    } catch (error) {
      console.error('Error toggling activity completion:', error);
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <Animated.View style={[styles.activityCard, animatedStyle, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={handleToggleComplete}
        disabled={isCompleting}
      >
        <View style={styles.activityContent}>
          {/* Left side with icon and text */}
          <View style={styles.activityLeft}>
            <View style={[styles.activityIconContainer, { backgroundColor: activity.completed ? `${colors[0]}15` : `${colors[0]}10` }]}>
              {activity.completed ? (
                <LinearGradient
                  colors={[colors[0], colors[1]]}
                  style={styles.activityIconGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <FontAwesome name="check" size={18} color="#ffffff" />
                </LinearGradient>
              ) : (
                <FontAwesome
                  name={activity.icon as any}
                  size={18}
                  color={colors[0]}
                />
              )}
            </View>
            <View style={styles.activityText}>
              <Text style={[
                styles.activityTitle,
                { color: activity.completed ? themeColors.textSecondary : themeColors.text },
                activity.completed && styles.activityCompleted
              ]}>
                {activity.title}
              </Text>
              <Text style={[styles.activityDescription, { color: themeColors.textSecondary }]}>
                {activity.description}
              </Text>
              <View style={styles.activityMeta}>
                <FontAwesome name="clock-o" size={10} color={themeColors.textTertiary} />
                <Text style={[styles.activityTime, { color: themeColors.textTertiary }]}>
                  {activity.time}
                </Text>
              </View>
            </View>
          </View>

          {/* Right side with status and actions */}
          <View style={styles.activityRight}>
            {activity.completed ? (
              <View style={styles.completedIndicator}>
                <LinearGradient
                  colors={['#10b981', '#34d399']}
                  style={styles.completedBadgeGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <FontAwesome name="check-circle" size={20} color="#ffffff" />
                </LinearGradient>
              </View>
            ) : activity.progress ? (
              <View style={styles.progressContainer}>
                <View style={[styles.progressBar, { backgroundColor: `${colors[0]}20` }]}>
                  <Animated.View
                    style={[
                      styles.progressFill,
                      {
                        width: `${activity.progress}%`,
                        backgroundColor: colors[0]
                      }
                    ]}
                  />
                </View>
                <Text style={[styles.progressText, { color: colors[0] }]}>
                  {activity.progress}%
                </Text>
              </View>
            ) : (
              <View style={[styles.pendingIndicator, { backgroundColor: `${themeColors.textTertiary}15` }]}>
                <FontAwesome name="clock-o" size={16} color={themeColors.textTertiary} />
              </View>
            )}

            {/* Sync button */}
            <View style={styles.syncButtons}>
              {!activity.syncedToCalendar && permissions.calendar && (
                <TouchableOpacity
                  style={[styles.syncButton, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
                  onPress={(e) => {
                    e.stopPropagation();
                    onSync(activity);
                  }}
                  activeOpacity={0.7}
                >
                  <FontAwesome name="calendar-plus-o" size={12} color={themeColors.primary} />
                </TouchableOpacity>
              )}
              {activity.syncedToCalendar && (
                <View style={[styles.syncedBadge, { backgroundColor: `${themeColors.primary}15` }]}>
                  <FontAwesome name="calendar-check-o" size={12} color={themeColors.primary} />
                </View>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    paddingBottom: 120,
  },
  heroCard: {
    borderRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 28,
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 12,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  heroGreeting: {
    flex: 1,
    paddingRight: 16,
  },
  heroActions: {
    flexDirection: 'row',
    gap: 12,
  },
  heroHealthButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
  },
  heroSettings: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
  },
  greeting: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff', // Sempre bianco sul gradient viola
  },
  tagline: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.9)', // Più leggibile
    fontSize: 13,
    lineHeight: 18,
  },
  heroAvatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
  },
  heroStats: {
    flex: 1,
    marginLeft: 12, // Reduced margin to give more space to stats
    maxWidth: '70%', // Increased max width for wider boxes
  },
  heroChip: {
    backgroundColor: 'rgba(255,255,255,0.12)', // Più trasparente per eleganza
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    maxWidth: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)', // Bordo sottile per definizione
  },
  heroChipIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  heroChipTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  heroChipLabel: {
    color: 'rgba(255,255,255,0.75)', // Più leggibile
    fontSize: 11,
    marginBottom: 2,
    fontWeight: '500',
  },
  heroChipValue: {
    color: '#ffffff', // Sarà sovrascritto inline per dark mode
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 16,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  permissionCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
  },
  permissionCardIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  permissionCardCopy: {
    flex: 1,
  },
  permissionCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  permissionCardSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  permissionCardAction: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  permissionCardActionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  sectionHeaderContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  historyButtonHeader: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    marginLeft: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    // Colore gestito inline con themeColors.text
  },
  sectionSubtitle: {
    marginTop: 4,
    fontSize: 12,
    flexWrap: 'wrap',
    flexShrink: 1,
    // Colore gestito inline con themeColors.textSecondary
  },
  widgetGrid: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  widgetRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: 12,
    gap: 8,
  },
  dropIndicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 2,
    borderColor: '#3b82f6',
    borderStyle: 'dashed',
    borderRadius: 20,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    zIndex: 10,
  },
  dropIndicatorInner: {
    flex: 1,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderRadius: 18,
    margin: 2,
  },
  widgetSmall: {
    flex: 1,
    maxWidth: '30%',
  },
  widgetLarge: {
    flex: 2,
    maxWidth: '65%',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '500',
  },
  placeholderBanner: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  placeholderBannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  placeholderBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  placeholderBannerText: {
    fontSize: 13,
    marginTop: 2,
    lineHeight: 18,
  },
  placeholderActionButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
  },
  placeholderActionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  // Removed quickCard styles - replaced with Today at a glance widgets
  highlightRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginBottom: 12,
  },
  highlightCard: {
    width: (width - 60) / 2,
    borderRadius: 22,
    marginBottom: 16,
    shadowColor: '#1f2937',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 6,
  },
  highlightGradient: {
    borderRadius: 22,
    padding: 18,
    minHeight: 150,
    justifyContent: 'space-between',
  },
  highlightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  highlightIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  highlightLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
  },
  highlightDelta: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 4,
  },
  highlightValue: {
    marginTop: 12,
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
  },
  sectionFooter: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  activityContainer: {
    paddingHorizontal: 20,
    marginBottom: 24,
    gap: 12,
  },
  activityCard: {
    borderRadius: 20,
    marginBottom: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    overflow: 'hidden',
    borderWidth: 1,
  },
  activityContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    backgroundColor: 'transparent',
  },
  activityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 14,
  },
  activityIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  activityIconGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityText: {
    flex: 1,
    gap: 4,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
    marginBottom: 2,
  },
  activityCompleted: {
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
  activityDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
  },
  activityMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  activityTime: {
    fontSize: 11,
    fontWeight: '500',
  },
  activityRight: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginLeft: 12,
  },
  statusContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedIndicator: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedBadgeGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingIndicator: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minWidth: 60,
  },
  progressBar: {
    width: 60,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 11,
    fontWeight: '600',
  },
  syncButtons: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  syncedBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityIcon: {
    width: 24,
    height: 24,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  emptySlot: {
    height: 140,
    borderRadius: 20,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    // Colori gestiti inline con themeColors
  },
  emptySlotText: {
    fontSize: 32,
    fontWeight: '300',
    marginBottom: 4,
    // Colore gestito inline con themeColors.textTertiary
  },
  emptySlotHint: {
    fontSize: 10,
    textAlign: 'center',
    fontWeight: '500',
    // Colore gestito inline con themeColors.textTertiary
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  exitEditButton: {
    backgroundColor: '#10b981', // Success sempre verde
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#059669',
  },
  exitEditButtonText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '600',
  },
  editModeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    // Colori gestiti inline con themeColors.primary
  },
  editModeButtonText: {
    fontSize: 12,
    color: '#ffffff', // Sempre bianco sul bottone primario
    fontWeight: '600',
  },
  /** ---- Focus Cards ---- */
  focusGrid: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 20,
    marginBottom: 24,
    flexWrap: 'wrap',
  },
  focusCardContainer: {
    flex: 1,
    borderRadius: 24,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 12,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  focusCardInner: {
    flex: 1,
    borderRadius: 24,
    padding: 18,
    minHeight: 200,
  },
  focusCard: {
    flex: 1,
    borderRadius: 24,
    padding: 20,
    minHeight: 180,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  focusCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  focusTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  focusSubtitleLabel: {
    fontSize: 12,
    color: '#0f172a99',
    fontWeight: '600',
    marginTop: 2,
  },
  focusEmoji: {
    fontSize: 26,
  },

  // Icon containers con glow effect
  moodIconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moodIconGlow: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    opacity: 0.6,
  },
  sleepIconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sleepIconGlow: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    opacity: 0.6,
  },
  focusMoodSummary: {
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    marginBottom: 14,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  moodSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  moodScoreBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 40,
    alignItems: 'center',
  },
  moodScoreText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },
  focusMoodValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#047857',
  },
  focusDivider: {
    height: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.08)',
    marginVertical: 12,
  },
  focusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  focusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  focusTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 12,
  },
  focusPrimaryValue: {
    marginTop: 4,
    fontSize: 32,
    fontWeight: '900',
    color: '#0f172a',
    lineHeight: 36,
  },
  focusSubtext: {
    marginTop: 8,
    fontSize: 13,
    color: '#6b7280',
    opacity: 0.95,
    fontWeight: '600',
  },
  sleepSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  sleepHoursBlock: {
    flex: 1,
  },
  sleepQualityGauge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 5,
    borderColor: '#93c5fd',
    backgroundColor: '#ffffffd9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sleepQualityValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1d4ed8',
  },
  sleepQualityLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1e40af',
    marginTop: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sleepTextBlock: {
    flex: 1,
  },
  sleepBadgeRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    marginBottom: 12,
  },
  sleepBadge: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  sleepBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1e3a8a',
    textAlign: 'center',
  },
  sleepChipsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 0,
    flexWrap: 'wrap',
  },
  sleepChip: {
    flex: 0.5,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#eff6ffcc',
    borderWidth: 1.2,
    borderColor: '#bfdbfe',
  },
  sleepChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e40af',
    textAlign: 'center',
  },
  // --- Focus Grid base già presente ---
  // Aggiunte per i controlli interattivi
  checkinPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(16,185,129,0.15)',
    borderWidth: 1.2,
    borderColor: '#86EFAC',
  },
  checkinPillPositive: {
    backgroundColor: 'rgba(16,185,129,0.18)',
    borderColor: '#bbf7d0',
  },
  checkinPillSecondary: {
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderColor: '#bfdbfe',
  },
  checkinPillText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#065F46',
  },
  checkinPillActive: {
    backgroundColor: '#10b981',
    borderColor: '#059669',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  moodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    gap: 8,
  },
  emojiBtn: {
    flex: 1,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  emojiBtnActive: {
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
    shadowColor: '#10b981',
    shadowOpacity: 0.25,
    elevation: 3,
  },
  emojiText: { fontSize: 22, fontWeight: '700' },
  emojiTextActive: {
    transform: [{ scale: 1.1 }],
  },
  emojiBtnGlow: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(16, 185, 129, 0.3)',
    opacity: 0.6,
  },
  focusPrimaryValueSmall: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  focusTinyLabel: {
    fontSize: 13,
    color: '#334155',
    marginBottom: 10,
    fontWeight: '700',
  },
  insightsSection: {
    marginBottom: 24,
  },
  homeInsightsSection: {
    marginBottom: 20,
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sleepQualityGaugeSmall: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: '#93c5fd',
    backgroundColor: '#ffffffd9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sleepQualityValueSmall: {
    fontSize: 11,
    fontWeight: '900',
    color: '#1d4ed8',
  },
  sleepQualityLabelSmall: {
    fontSize: 7,
    fontWeight: '700',
    color: '#1e40af',
    marginTop: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Nuovi stili per Sleep Card migliorata
  sleepScoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  sleepScoreLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  sleepScoreBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 36,
    alignItems: 'center',
  },
  sleepScoreText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },
  sleepQualityGaugeModern: {
    width: 70,
    height: 70,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  sleepGaugeRing: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 4,
    borderColor: '#e0f2fe',
    position: 'absolute',
  },
  sleepGaugeProgress: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 4,
    borderColor: '#3b82f6',
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
    position: 'absolute',
  },
  sleepGaugeCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sleepQualityValueModern: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1e40af',
  },
  sleepQualityLabelModern: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sleepBadgeModern: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  sleepBadgeTextModern: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e40af',
  },

  // Stili per slider migliorati
  sliderContainer: {
    marginVertical: 8,
  },
  sliderLabel: {
    fontSize: 13,
    color: '#334155',
    marginBottom: 8,
    fontWeight: '600',
  },
  moodSlider: {
    height: 40,
  },
  sleepSlider: {
    height: 40,
  },
  sliderValueContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  sliderValueText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  moodInsight: {
    marginTop: 8,
  },
  moodSuggestion: {
    fontSize: 12,
    color: '#64748b',
    fontStyle: 'italic',
    marginTop: 4,
  },

  // Tutorial and Header Buttons
  tutorialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(102, 126, 234, 0.2)',
  },
  tutorialButtonText: {
    color: '#667eea',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  weeklyProgressContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    marginBottom: 24,
    gap: 12,
  },
  progressCard: {
    flex: 1,
    minWidth: '47%',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  progressCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 8,
  },
  chartEditButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  disabledChartsContainer: {
    width: '100%',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  disabledChartsTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  disabledChartCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    gap: 12,
  },
  disabledChartLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  addChartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    marginRight: 8,
  },
  addChartButtonText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '600',
  },
  progressCardTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  progressCardContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  sampleDataBanner: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  sampleDataBannerContent: {
    flex: 1,
    gap: 4,
  },
  sampleDataBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  sampleDataBannerText: {
    fontSize: 12,
    lineHeight: 16,
  },
  progressCardLeft: {
    flexShrink: 1,
    marginRight: 8, // Ridotto da 12 a 8 per dare più spazio al grafico
    maxWidth: 90, // Ridotto da 100 a 90
  },
  progressCardRight: {
    width: CHART_WIDTH,
    height: 150,
    flexShrink: 0,
  },
  valueContainer: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 2,
  },
  progressCardValue: {
    fontSize: 22, // Leggermente ridotto per risparmiare spazio
    fontWeight: '700',
    marginBottom: 2, // Ridotto da 4 a 2
  },
  progressCardUnit: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  progressCardSubtitle: {
    fontSize: 11, // Ridotto da 12 a 11
    lineHeight: 14, // Aggiunto per supportare 2 righe
  },
});

// Removed export default since we export named component above
// export default HomeScreen;
