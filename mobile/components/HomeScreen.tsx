import React, { useEffect, useState, useRef } from 'react';
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
} from 'react-native';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Animated, { useAnimatedStyle, withDelay, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar } from './Avatar';
import { WellnessSuggestions } from './WellnessSuggestions';
import Colors from '../constants/Colors';
import WellnessSyncService from '../services/wellness-sync.service';
import { MomentumService, MomentumData } from '../services/momentum.service';
import { AuthService } from '../services/auth.service';
import PillDetailPopup from './PillDetailPopup';
import MiniGaugeChart from './MiniGaugeChart';
import MiniInfoCard from './MiniInfoCard';
import { TodayGlanceService, WidgetData } from '../services/today-glance.service';
import { useWidgetConfig, WidgetDataService } from '../services/widget-config.service';
import EditableWidget from './EditableWidget';
import { useTutorial } from '../contexts/TutorialContext';
import WidgetGoalModal from './WidgetGoalModal';
import { widgetGoalsService } from '../services/widget-goals.service';
import { HealthPermissionsModal } from './HealthPermissionsModal';
import { useHealthData } from '../hooks/useHealthData';
import { InsightSection } from './InsightSection';
// Removed useInsights - now using DailyCopilot for insights
import DailyCopilot from './DailyCopilot';
import RecommendationDetailModal from './RecommendationDetailModal';
import DailyCopilotHistory from './DailyCopilotHistory';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Slider from '@react-native-community/slider';
import MoodCheckinCard from './MoodCheckinCard';
import SleepCheckinCard from './SleepCheckinCard';
import PrimaryCTA from './PrimaryCTA';

const { width } = Dimensions.get('window');

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

const highlightCards: HighlightCard[] = [
  { id: 'mood', label: 'Mood Balance', value: 'Positive', delta: '+6% vs yesterday', colors: ['#6366f1', '#8b5cf6'], icon: 'smile-o' },
  { id: 'sleep', label: 'Restful Sleep', value: '7h 45m', delta: '+15m today', colors: ['#0ea5e9', '#22d3ee'], icon: 'moon-o' },
  { id: 'hydration', label: 'Hydration', value: '5 / 8 cups', delta: 'Sip water now', colors: ['#10b981', '#34d399'], icon: 'tint' },
];

const todaysActivities: DailyActivity[] = [
  {
    id: 'morning-meditation',
    title: 'Morning Meditation',
    description: '5-minute breathing exercise',
    icon: 'leaf',
    completed: true,
    time: '8:00 AM',
    category: 'mindfulness',
  },
  {
    id: 'water-intake',
    title: 'Hydration Goal',
    description: 'Drink 8 glasses of water',
    icon: 'tint',
    completed: false,
    progress: 62,
    time: 'Ongoing',
    category: 'nutrition',
  },
  {
    id: 'walk',
    title: 'Evening Walk',
    description: '20-minute outdoor walk',
    icon: 'road',
    completed: false,
    time: '6:00 PM',
    category: 'movement',
  },
  {
    id: 'journal',
    title: 'Gratitude Journal',
    description: 'Write 3 things you\'re grateful for',
    icon: 'book',
    completed: false,
    time: '9:00 PM',
    category: 'mindfulness',
  },
];

// Removed quickLinks and QuickLink interface - replaced with Today at a glance widgets

interface HomeScreenProps {
  user?: any;
  onLogout?: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ 
  user, 
  onLogout
}) => {
  const { setShowTutorial } = useTutorial();
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);
  const [activities, setActivities] = useState<DailyActivity[]>(todaysActivities);
  const [syncService] = useState(() => WellnessSyncService.getInstance());
  const [permissions, setPermissions] = useState({ calendar: false, notifications: false });
  const [userFirstName, setUserFirstName] = useState<string>('User');
  const [momentumData, setMomentumData] = useState<MomentumData | null>(null);
  const [selectedPill, setSelectedPill] = useState<'streak' | 'momentum' | 'next-session' | null>(null);
  const [todayGlanceWidgets, setTodayGlanceWidgets] = useState<WidgetData[]>([]);
  
  // Widget configuration
  const { 
    config: widgetConfig, 
    loading: configLoading, 
    toggleWidget, changeSize,
    addWidget,                // useremo questo al punto (B)
  } = useWidgetConfig();
  const [widgetData, setWidgetData] = useState<any[]>([]);
  const [dragTargetPosition, setDragTargetPosition] = useState<number | null>(null);
  const [editMode, setEditMode] = useState<boolean>(false);
  const [goalModal, setGoalModal] = useState<{visible: boolean; widgetId: 'steps'|'hydration'|'meditation'|'sleep'|null}>({visible:false, widgetId:null});
  const [healthPermissionsModal, setHealthPermissionsModal] = useState<boolean>(false);
  const [recommendationModal, setRecommendationModal] = useState<{visible: boolean; recommendation: any}>({visible: false, recommendation: null});
  const [showHistory, setShowHistory] = useState<boolean>(false);
  
  // Health data hook
  const { permissions: healthPermissions, hasData: hasHealthData, isInitialized } = useHealthData();
  
  // Intelligent insights are now handled by DailyCopilot component

  // --- Self check (Mood & Sleep)
  const [showMoodCheckin, setShowMoodCheckin] = useState(false);
  const [showSleepCheckin, setShowSleepCheckin] = useState(false);
  const [moodValue, setMoodValue] = useState<number>(3);        // 1..5
  const [sleepQuality, setSleepQuality] = useState<number>(80); // 0..100
  // NEW
  const [moodNote, setMoodNote] = useState('');
  const [sleepNote, setSleepNote] = useState('');
  const [restLevel, setRestLevel] = useState<1|2|3|4|5>(3);

  const moodDescriptors = [
    { value: 1, emoji: '☁️', label: 'Very low', suggestion: 'Take a mindful pause' },
    { value: 2, emoji: '🌧️', label: 'Low', suggestion: 'A short walk could help' },
    { value: 3, emoji: '⛅️', label: 'Neutral', suggestion: 'Keep noticing your cues' },
    { value: 4, emoji: '🌤️', label: 'Good', suggestion: 'Celebrate the little wins' },
    { value: 5, emoji: '🌞', label: 'Great', suggestion: 'Share the positive energy' },
  ] as const;

  const computeGaugeProgress = (info: any) => {
    if (info?.steps) return Math.min(100, (info.steps.current / info.steps.goal) * 100);
    if (info?.hydration) return Math.min(100, (info.hydration.glasses / info.hydration.goal) * 100);
    if (info?.meditation) return Math.min(100, (info.meditation.minutes / info.meditation.goal) * 100);
    return 0;
  };

  const computeGaugeSubtitle = (info: any) => {
    if (info?.steps) return `Goal • ${info.steps.goal.toLocaleString()} steps`;
    if (info?.hydration) return `Goal • ${info.hydration.goal} glasses`;
    if (info?.meditation) return `Goal • ${info.meditation.goal} mins`;
    return '';
  };

  const computeGaugeTrend = (progress: number) => {
    if (progress >= 85) return 'Excellent';
    if (progress >= 60) return 'Good';
    if (progress >= 40) return `+${Math.max(1, Math.round((progress - 40) / 2))}%`;
    return '!';
  };

  const getInfoCardValue = (id: string, info: any) => {
    switch (id) {
      case 'sleep':
        return `${info.sleep?.hours ?? 7.5}h`;
      case 'hrv':
        return `${info.hrv?.value ?? info.hrv?.avgHRV ?? 35}ms`;
      case 'analyses':
        return info.analyses?.completed ? 'Complete' : 'Pending';
      default:
        return info.value ?? '--';
    }
  };

  const getInfoCardSubtitle = (id: string, info: any) => {
    switch (id) {
      case 'sleep':
        return `Quality • ${info.sleep?.quality ?? 82}%`;
      case 'hrv':
        return `Resting HR • ${info.hrv?.restingHR ?? 66} bpm`;
      case 'analyses':
        return info.analyses?.lastCheckIn ?? 'Today';
      default:
        return info.subtitle ?? '';
    }
  };

  const getInfoCardTrend = (id: string, info: any) => {
    switch (id) {
      case 'sleep': {
        const quality = info.sleep?.quality ?? 0;
        if (quality >= 85) return 'Excellent';
        if (quality >= 70) return 'Good';
        if (quality >= 50) return '+5%';
        return '!';
      }
      case 'hrv': {
        const hrvScore = info.hrv?.value ?? 0;
        if (hrvScore >= 45) return 'Excellent';
        if (hrvScore >= 30) return 'Good';
        return '!';
      }
      case 'analyses':
        return info.analyses?.completed ? '✓' : '!';
      default:
        return undefined;
    }
  };

  const getInfoCardDetails = (id: string, info: any) => {
    switch (id) {
      case 'sleep':
        return [
          { icon: '💤', label: 'Deep sleep', value: info.sleep?.deepSleep ?? '2h 15m' },
          { icon: '🧠', label: 'REM', value: info.sleep?.remSleep ?? '1h 45m' },
          { icon: '⏰', label: 'Wake time', value: info.sleep?.wakeTime ?? '7:30 AM' },
        ];
      case 'hrv':
        return [
          { icon: '💓', label: 'Resting HR', value: `${info.hrv?.restingHR ?? 66} bpm` },
          { icon: '🛡️', label: 'Recovery', value: info.hrv?.recovery ?? 'Good' },
        ];
      case 'analyses':
        return [
          { icon: '🔥', label: 'Streak', value: `${info.analyses?.streak ?? 0} days` },
          { icon: info.analyses?.completed ? '✅' : '🕒', label: 'Status', value: info.analyses?.completed ? 'Logged today' : 'Complete check-ins' },
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
  const displayedSleepQuality = showSleepCheckin
    ? sleepQuality
    : (sleepStats?.quality ?? sleepQuality);

  // chiavi giornaliere
  const dayKey = () => new Date().toISOString().slice(0,10);
  const STORAGE_KEYS = {
    mood: (d: string) => `checkin:mood:${d}`,
    sleep: (d: string) => `checkin:sleep:${d}`,
    moodNote: (d: string) => `checkin:mood_note:${d}`,
    sleepNote: (d: string) => `checkin:sleep_note:${d}`,
    restLevel: (d: string) => `checkin:rest_level:${d}`,
  };

  // Load today glance data
  const loadTodayGlanceData = async () => {
    try {
      const currentUser = await AuthService.getCurrentUser();
      if (currentUser) {
        const widgets = await TodayGlanceService.getTodayGlanceData(currentUser.id);
        setTodayGlanceWidgets(widgets);
      }
    } catch (error) {
      console.error('Failed to load today glance data:', error);
    }
  };

  // Debug: log quando widgetConfig cambia
  useEffect(() => {
    console.log('🔄 HOMESCREEN WIDGET CONFIG CHANGED:', widgetConfig.map(w => ({ 
      id: w.id, 
      position: w.position, 
      enabled: w.enabled, 
      size: w.size 
    })));
  }, [widgetConfig]);

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
  useEffect(() => {
    if (isInitialized && !hasHealthData && !healthPermissionsModal) {
      const timer = setTimeout(() => {
        setHealthPermissionsModal(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isInitialized, hasHealthData, healthPermissionsModal]);

  // carica eventuali check-in del giorno all'apertura
  useEffect(() => {
    (async () => {
      try {
        const dk = dayKey();
        const savedMood = await AsyncStorage.getItem(STORAGE_KEYS.mood(dk));
        const savedSleep = await AsyncStorage.getItem(STORAGE_KEYS.sleep(dk));
        const savedMoodNote = await AsyncStorage.getItem(STORAGE_KEYS.moodNote(dk));
        const savedSleepNote = await AsyncStorage.getItem(STORAGE_KEYS.sleepNote(dk));
        const savedRestLevel = await AsyncStorage.getItem(STORAGE_KEYS.restLevel(dk));
        if (savedMood) setMoodValue(parseInt(savedMood, 10));
        if (savedSleep) setSleepQuality(parseInt(savedSleep, 10));
        if (savedMoodNote) setMoodNote(savedMoodNote);
        if (savedSleepNote) setSleepNote(savedSleepNote);
        if (savedRestLevel) setRestLevel(parseInt(savedRestLevel, 10) as 1|2|3|4|5);
      } catch {}
    })();
  }, []);

  // salva rapidi
  const saveMood = async (val: number) => {
    setMoodValue(val);
    try { await AsyncStorage.setItem(STORAGE_KEYS.mood(dayKey()), String(val)); } catch {}
  };

  const saveSleep = async (val: number) => {
    setSleepQuality(val);
    try { await AsyncStorage.setItem(STORAGE_KEYS.sleep(dayKey()), String(val)); } catch {}
  };

  // nuove funzioni di salvataggio con note
  async function saveMoodCheckin(value: number, note: string) {
    const dk = dayKey();
    await AsyncStorage.multiSet([
      [STORAGE_KEYS.mood(dk), String(value)],
      [STORAGE_KEYS.moodNote(dk), note],
    ]);
    // TODO: manda al backend
    try {
      // esempio: await CheckinService.saveMood({ date: dk, value, note });
    } catch(e) { console.warn('Failed remote mood save', e); }
  }

  async function saveSleepCheckin(quality: number, note: string, restLevel: number) {
    const dk = dayKey();
    await AsyncStorage.multiSet([
      [STORAGE_KEYS.sleep(dk), String(quality)],
      [STORAGE_KEYS.sleepNote(dk), note],
      [STORAGE_KEYS.restLevel(dk), String(restLevel)],
    ]);
    try {
      // es: await CheckinService.saveSleep({ date: dk, quality, note, restLevel });
    } catch(e) { console.warn('Failed remote sleep save', e); }
  }

  // Handle pill press
  const handlePillPress = (pillType: 'streak' | 'momentum' | 'next-session') => {
    setSelectedPill(pillType);
  };

  const closePillPopup = () => {
    setSelectedPill(null);
  };

  // Handle widget interactions
  const handleWidgetPress = (widgetId: string) => {
    console.log('Widget pressed:', widgetId);
    switch (widgetId) {
      case 'steps':
        break;
      case 'hydration':
        TodayGlanceService.handleQuickAction(widgetId, 'add_water');
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
    console.log(`Long press on empty space at position: ${position}`);
    // Qui potremmo aprire un modal per aggiungere un widget
    // Per ora, mostriamo un alert
    Alert.alert(
      'Aggiungi Widget',
      `Vuoi aggiungere un widget alla posizione ${position}?`,
      [
        { text: 'Annulla', style: 'cancel' },
        { text: 'Aggiungi', onPress: () => addWidgetToPosition(position) }
      ]
    );
  };

  const addWidgetToPosition = async (position: number) => {
    try {
      // Trova un widget disabilitato da riabilitare
      const disabledWidget = widgetConfig.find(w => !w.enabled);
      console.log('Disabled widget found:', disabledWidget);
  
      if (disabledWidget) {
        // forza la dimensione iniziale a 'small' e posiziona nello slot scelto
        await addWidget(disabledWidget.id, 'small', position);
      } else {
        console.log('All widgets are enabled:', widgetConfig.filter(w => w.enabled).length);
        Alert.alert('Nessun Widget Disponibile', 'Tutti i widget sono già attivi.');
      }
    } catch (error) {
      console.warn('Failed to add widget:', error);
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
            style={[styles.emptySlot, { width: getWidgetWidth('small') }]}
            onLongPress={() => handleEmptySpaceLongPress(pos)}
            activeOpacity={0.7}
          >
            <Text style={styles.emptySlotText}>+</Text>
            <Text style={styles.emptySlotHint}>Long press to add widget</Text>
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
      : 'Loading...';
    
    return [
      { icon: 'fire', label: 'Streak', value: '12 days' },
      { icon: 'line-chart', label: 'Momentum', value: momentumValue },
      { icon: 'calendar', label: 'Next Session', value: 'Today • 6:00 PM' },
    ];
  };

  // Initialize sync service
  useEffect(() => {
    const initializeSync = async () => {
      const result = await syncService.initialize();
      setPermissions(result);
    };
    initializeSync();
  }, []);

  // Load user data and momentum
  useEffect(() => {
    const loadUserData = async () => {
      try {
        // Get current user
        const currentUser = await AuthService.getCurrentUser();
        if (currentUser?.id) {
          // Load user profile for first name
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

          // Load momentum data
          const momentum = await MomentumService.calculateMomentum(currentUser.id);
          setMomentumData(momentum);

          // Load today glance widgets
          const widgets = await TodayGlanceService.getTodayGlanceData(currentUser.id);
          setTodayGlanceWidgets(widgets);
          
          // Load widget data with saved goals
          const goals = await widgetGoalsService.getGoals();
          const widgetData = WidgetDataService.generateWidgetData(goals);
          setWidgetData(widgetData);
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      }
    };

    loadUserData();
  }, []);

  const syncActivityToCalendar = async (activity: DailyActivity) => {
    try {
      const wellnessActivity = syncService.createWellnessActivityFromToday(
        {
          id: activity.id,
          title: activity.title,
          description: activity.description,
          time: activity.time || 'Ongoing',
          category: activity.category,
        },
        true, // syncToCalendar
        false, // syncToReminders (we'll add this separately)
        15 // reminderMinutes
      );

      const result = await syncService.addWellnessActivity(wellnessActivity);
      
      if (result.success) {
        // Update activity with sync status
        setActivities(prev => prev.map(a => 
          a.id === activity.id 
            ? { ...a, syncedToCalendar: true }
            : a
        ));
        
        Alert.alert(
          'Synced to Calendar',
          `${activity.title} has been added to your calendar!`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Sync Failed',
          result.error || 'Failed to sync to calendar. Please check your permissions.',
          [{ text: 'OK' }]
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

  const requestPermissions = async () => {
    const result = await syncService.requestPermissions();
    setPermissions(result);
    
    if (!result.calendar && !result.notifications) {
      Alert.alert(
        'Permissions Required',
        'To sync activities with your calendar and reminders, please enable permissions in Settings.',
        [{ text: 'OK' }]
      );
    }
  };

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
      <Animated.View key={activity.id} style={[styles.activityCard, animatedStyle]}>
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
                <Text style={[styles.activityTitle, activity.completed && styles.activityCompleted]}>
                  {activity.title}
                </Text>
                <Text style={styles.activityDescription}>{activity.description}</Text>
                <Text style={styles.activityTime}>{activity.time}</Text>
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
    switch (size) {
      case 'small': return rowWidth / 3;   // 1/3 della riga
      case 'medium': return (rowWidth * 2) / 3;  // 2/3 della riga
      case 'large': return rowWidth;   // 3/3 della riga (tutta la riga)
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
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} ref={scrollViewRef}>
        <LinearGradient colors={[Colors.palette.primary, Colors.palette.primaryBright]} style={styles.heroCard}>
          {/* Header with buttons inside the purple box */}
          <View style={styles.heroTopRow}>
            <View style={styles.heroGreeting}>
              <Text style={styles.greeting}>Hello, {userFirstName}</Text>
              <Text style={styles.tagline}>Here's a quick pulse on your wellness journey.</Text>
            </View>
            <View style={styles.heroActions}>
              <TouchableOpacity
                style={styles.heroHealthButton}
                onPress={() => setShowTutorial(true)}
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
          </View>

          <View style={styles.heroAvatarRow}>
            <Avatar onMicPress={() => {
              console.log('Mic button pressed - navigating to voice chat');
              // Force navigation by using a unique timestamp parameter
              const timestamp = Date.now();
              router.push(`/(tabs)/coach?voiceMode=true&t=${timestamp}`);
            }} />
            <View style={styles.heroStats}>
              {getStats().map((item) => {
                const isMomentum = item.label === 'Momentum';
                const isStreak = item.label === 'Streak';
                const isNextSession = item.label === 'Next Session';
                
                let trendColor = '#6366f1'; // Default purple
                if (isStreak) trendColor = '#f97316'; // Orange
                else if (isMomentum && momentumData) trendColor = MomentumService.getTrendColor(momentumData.trend);
                else if (isNextSession) trendColor = '#3b82f6'; // Blue
                
                // Determine pill type for popup
                let pillType: 'streak' | 'momentum' | 'next-session' | null = null;
                if (item.label === 'Streak') pillType = 'streak';
                else if (item.label === 'Momentum') pillType = 'momentum';
                else if (item.label === 'Next Session') pillType = 'next-session';
                
                return (
                  <TouchableOpacity 
                    key={item.label} 
                    style={styles.heroChip}
                    onPress={() => pillType && handlePillPress(pillType)}
                    activeOpacity={0.7}
                  >
                  <View style={[styles.heroChipIcon, { backgroundColor: isMomentum ? `${trendColor}30` : 'rgba(255,255,255,0.18)' }]}>
                      <FontAwesome name={item.icon as any} size={12} color={isMomentum ? trendColor : '#ffffff'} />
                  </View>
                  <View style={styles.heroChipTextContainer}>
                    <Text style={styles.heroChipLabel} numberOfLines={1} ellipsizeMode="tail">{item.label}</Text>
                      <Text style={styles.heroChipValue} numberOfLines={2} ellipsizeMode="tail">{item.value}</Text>
                  </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </LinearGradient>

        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderContent}>
            <View>
              <Text style={styles.sectionTitle}>Today at a Glance</Text>
              <Text style={styles.sectionSubtitle}>Your wellness snapshot</Text>
        </View>
            <View style={styles.headerActions}>
              {editMode ? (
                <TouchableOpacity 
                  onPress={() => {
                    console.log('🟢 EXITING EDIT MODE');
                    setEditMode(false);
                  }}
                  style={styles.exitEditButton}
                >
                  <Text style={styles.exitEditButtonText}>Done</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.headerButtons}>

              {/* DEBUG: Biometric Test Button */}
                  
                  <TouchableOpacity 
                    onPress={() => {
                      console.log('🟢 ENTERING EDIT MODE');
                      setEditMode(true);
                    }}
                    style={styles.editModeButton}
                  >
                    <Text style={styles.editModeButtonText}>Edit</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </View>
        <View style={styles.widgetGrid}>
          {/* Protezione per evitare crash se widgetData è vuoto */}
          {widgetData.length === 0 || configLoading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading widgets...</Text>
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
                    // 👇 lascia esattamente il tuo map attuale (non serve cambiare la logica interna)
                    const widgetInfo = widgetData.find(w => w.id === widget.id);
                    if (!widgetInfo) return null;

                    const WidgetComponent =
                      widget.id === 'sleep' || widget.id === 'hrv' || widget.id === 'analyses'
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
                          onResize={async (newSize) => { try { await changeSize(widget.id, newSize); } catch {} }}
                          onRemove={async () => { try { await toggleWidget(widget.id); } catch {} }}
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
                              onPress={() => handleWidgetPress(widget.id)}
                              onLongPress={() => handleWidgetLongPress(widget.id)}
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
                              onPress={() => handleWidgetPress(widget.id)}
                              onLongPress={() => handleWidgetLongPress(widget.id)}
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
                  const widgetInfo = widgetData.find(w => w.id === widget.id);
                  if (!widgetInfo) return null;

                  const WidgetComponent =
                    widget.id === 'sleep' || widget.id === 'hrv' || widget.id === 'analyses'
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
                        onResize={async (newSize) => { try { await changeSize(widget.id, newSize); } catch {} }}
                        onRemove={async () => { try { await toggleWidget(widget.id); } catch {} }}
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
                            onPress={() => handleWidgetPress(widget.id)}
                            onLongPress={() => handleWidgetLongPress(widget.id)}
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
                            onPress={() => handleWidgetPress(widget.id)}
                            onLongPress={() => handleWidgetLongPress(widget.id)}
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
      </View>
      

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Daily Check-In</Text>
          <Text style={styles.sectionSubtitle}>A glance at how your body and mind feel</Text>
        </View>

        {/* Self-check: Mood & Sleep */}
        <View style={styles.focusGrid}>
          <View style={{ flex: 1 }}>
            <MoodCheckinCard
              value={moodValue as 1|2|3|4|5}
              note={moodNote}
              onChange={(v) => { setMoodValue(v); }}
              onSave={async ({value, note}) => { setMoodValue(value); setMoodNote(note); await saveMoodCheckin(value, note); }}
              editing={showMoodCheckin}
              onToggleEdit={() => setShowMoodCheckin(v => !v)}
            />
          </View>

          <View style={{ flex: 1 }}>
            <SleepCheckinCard
              hours={displayedSleepHours}
              quality={displayedSleepQuality}
              bedtime={sleepStats?.bedtime ?? '11:30 PM'}
              waketime={sleepStats?.wakeTime ?? '7:30 AM'}
              note={sleepNote}
              onSave={async ({quality, note}) => { setSleepQuality(quality); setSleepNote(note); await saveSleepCheckin(quality, note, restLevel); }}
              editing={showSleepCheckin}
              onToggleEdit={() => setShowSleepCheckin(v => !v)}
            />
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Today's Activities</Text>
          <Text style={styles.sectionSubtitle}>
            {activities.filter(a => a.completed).length} of {activities.length} completed
          </Text>
        </View>
        <View style={styles.activityContainer}>
          {activities.map((activity, index) => (
            <ActivityItem
              key={activity.id}
              activity={activity}
              index={index}
              onSync={syncActivityToCalendar}
              permissions={permissions}
            />
          ))}
        </View>

        {/* AI Daily Copilot Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>AI Daily Copilot</Text>
          <Text style={styles.sectionSubtitle}>La tua guida personalizzata per oggi</Text>
        </View>
        
        <DailyCopilot
          compact={false}
          onRecommendationPress={(recommendation) => {
            setRecommendationModal({ visible: true, recommendation });
          }}
          onViewHistory={() => setShowHistory(true)}
        />

        <View style={styles.sectionFooter}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Suggested For You</Text>
            <Text style={styles.sectionSubtitle}>Curated routines to keep momentum going</Text>
          </View>
          <WellnessSuggestions context="general" />
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
              case 'hydration': return w.hydration?.goal;
              case 'meditation': return w.meditation?.goal;
              case 'sleep': return w.sleep?.goal;
              default: return undefined;
            }
          })()}
          onClose={() => setGoalModal({ visible: false, widgetId: null })}
          onSave={async (newVal) => {
            // salva
            await widgetGoalsService.setGoal(goalModal.widgetId!, newVal);
            // ricarica widget data con i nuovi goal
            const goals = await widgetGoalsService.getGoals();
            const data = WidgetDataService.generateWidgetData(goals);
            setWidgetData(data);
            setGoalModal({ visible: false, widgetId: null });
          }}
        />
      )}

      {/* Health Permissions Modal */}
      <HealthPermissionsModal
        visible={healthPermissionsModal}
        onClose={() => setHealthPermissionsModal(false)}
        onSuccess={() => {
          console.log('Health permissions granted');
          // Refresh widget data to show real health data
          loadTodayGlanceData();
        }}
      />

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
  const isPositive = moodLabel === 'Positive';
  const isNeutral  = moodLabel === 'Neutral';
  const gradient   = isPositive
    ? ['#A7F3D0', '#6EE7B7'] as const
    : isNeutral
    ? ['#FDE68A', '#FCD34D'] as const
    : ['#FECACA', '#FCA5A5'] as const;

  const emoji = isPositive ? '🙂' : isNeutral ? '😐' : '☹️';
  const trendIcon = deltaPct >= 0 ? 'arrow-up' : 'arrow-down';

  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} style={{ flex: 1 }}>
      <LinearGradient colors={gradient} start={{x:0,y:0}} end={{x:1,y:1}} style={styles.focusCard}>
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

        <Text style={styles.focusTitle}>Mood Balance</Text>
        <Text style={styles.focusPrimaryValue}>{moodLabel}</Text>
        <Text style={styles.focusSubtext}>vs yesterday</Text>
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
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} style={{ flex: 1 }}>
      <LinearGradient colors={['#BFDBFE', '#93C5FD'] as const} start={{x:0,y:0}} end={{x:1,y:1}} style={styles.focusCard}>
        <View style={styles.focusCardHeader}>
          <MaterialCommunityIcons name="moon-waning-crescent" size={22} color="#0C4A6E" />
          {typeof quality === 'number' && quality > 0 && (
            <View style={[styles.focusBadge, { backgroundColor: 'rgba(255,255,255,0.7)' }]}>
              <MaterialCommunityIcons name="star" size={14} color="#334155" />
              <Text style={[styles.focusBadgeText, { color: '#334155' }]}>{quality}%</Text>
            </View>
          )}
        </View>

        <Text style={styles.focusTitle}>Restful Sleep</Text>
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
}> = ({ activity, index, onSync, permissions }) => {
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: withDelay(index * 80, withTiming(1, { duration: 320 })),
    transform: [{ translateY: withDelay(index * 80, withTiming(0, { duration: 320 })) }],
  }));

  const colors = (() => {
    switch (activity.category) {
      case 'mindfulness': return ['#8b5cf6', '#a78bfa'] as const;
      case 'movement':    return ['#10b981', '#34d399'] as const;
      case 'nutrition':   return ['#f59e0b', '#fbbf24'] as const;
      case 'recovery':    return ['#3b82f6', '#60a5fa'] as const;
      default:            return ['#6b7280', '#9ca3af'] as const;
    }
  })();

  return (
    <Animated.View style={[styles.activityCard, animatedStyle]}>
      <TouchableOpacity activeOpacity={0.85}>
        <View style={styles.activityContent}>
          <View style={styles.activityLeft}>
            <View style={[styles.activityIcon, { backgroundColor: activity.completed ? '#10b981' : `${colors[0]}20` }]}>
              <FontAwesome
                name={activity.completed ? 'check' : (activity.icon as any)}
                size={16}
                color={activity.completed ? '#ffffff' : colors[0]}
              />
            </View>
            <View style={styles.activityText}>
              <Text style={[styles.activityTitle, activity.completed && styles.activityCompleted]}>
                {activity.title}
              </Text>
              <Text style={styles.activityDescription}>{activity.description}</Text>
              <Text style={styles.activityTime}>{activity.time}</Text>
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

            <View style={styles.syncButtons}>
              {!activity.syncedToCalendar && permissions.calendar && (
                <TouchableOpacity
                  style={styles.syncButton}
                  onPress={() => onSync(activity)}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f9fc',
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
    marginBottom: 24,
    shadowColor: '#312e81',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 8,
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
    color: '#ffffff',
  },
  tagline: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.85)',
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
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    paddingVertical: 12, // Increased from 10
    paddingHorizontal: 16, // Increased from 14
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52, // Increased from 48 for more spacious feel
    maxWidth: '100%', // Prevent overflow
  },
  heroChipIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  heroChipTextContainer: {
    flex: 1, // Take remaining space
    justifyContent: 'center',
  },
  heroChipLabel: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    marginBottom: 2,
  },
  heroChipValue: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 16, // Better line height for readability
  },
  sectionHeader: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionHeaderContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  sectionSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: '#6b7280',
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
  },
  activityCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  activityContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  activityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityText: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 2,
  },
  activityCompleted: {
    textDecorationLine: 'line-through',
    color: '#6b7280',
  },
  activityDescription: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 2,
  },
  activityTime: {
    fontSize: 12,
    color: '#94a3b8',
  },
  activityRight: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  statusContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncButtons: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  syncedBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#10b981',
  },
  completedBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressContainer: {
    alignItems: 'center',
    minWidth: 60,
  },
  progressBar: {
    width: 60,
    height: 6,
    backgroundColor: '#f1f5f9',
    borderRadius: 3,
    marginBottom: 4,
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  pendingBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySlot: {
    height: 140,
    backgroundColor: '#f8fafc',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySlotText: {
    fontSize: 32,
    color: '#94a3b8',
    fontWeight: '300',
    marginBottom: 4,
  },
  emptySlotHint: {
    fontSize: 10,
    color: '#94a3b8',
    textAlign: 'center',
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  exitEditButton: {
    backgroundColor: '#10b981',
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
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2563eb',
  },
  editModeButtonText: {
    fontSize: 12,
    color: '#ffffff',
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
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
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
});

export default HomeScreen;
