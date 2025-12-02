import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Dimensions,
  Animated,
  Pressable,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../hooks/useTranslation';
import { menstrualCycleService, CycleData, CyclePhase } from '../services/menstrual-cycle.service';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

interface MenstrualCycleModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: () => void;
  currentData: CycleData | null;
}

// 🆕 Range completo per lo scroll picker (da 21 a 40 giorni)
const CYCLE_LENGTH_MIN = 21;
const CYCLE_LENGTH_MAX = 40;
const CYCLE_LENGTH_OPTIONS = Array.from(
  { length: CYCLE_LENGTH_MAX - CYCLE_LENGTH_MIN + 1 }, 
  (_, i) => CYCLE_LENGTH_MIN + i
);
const PHASE_COLORS: Record<CyclePhase, string[]> = {
  menstrual: ['#ef4444', '#dc2626'],
  follicular: ['#f59e0b', '#d97706'],
  ovulation: ['#10b981', '#059669'],
  luteal: ['#8b5cf6', '#7c3aed'],
};

const PHASE_ICONS: Record<CyclePhase, string> = {
  menstrual: 'water',
  follicular: 'flower-outline',
  ovulation: 'star',
  luteal: 'moon-waning-crescent',
};

export const MenstrualCycleModal: React.FC<MenstrualCycleModalProps> = ({
  visible,
  onClose,
  onSave,
  currentData,
}) => {
  const { colors, mode: themeMode } = useTheme();
  const { t, language } = useTranslation();
  
  // Animation
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  
  // 🆕 Ref per lo scroll picker della durata ciclo
  const cycleLengthScrollRef = useRef<ScrollView>(null);
  const ITEM_HEIGHT = 44; // Altezza di ogni item nello scroll picker
  
  // State
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [cycleLength, setCycleLength] = useState<number>(28);
  const [periodStarted, setPeriodStarted] = useState<boolean>(false);
  const [note, setNote] = useState<string>('');
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [savedNotes, setSavedNotes] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  
  // Load existing data
  useEffect(() => {
    if (visible) {
      loadExistingData();
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 20,
          stiffness: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      slideAnim.setValue(50);
    }
  }, [visible]);
  
  // 🆕 Funzione per scrollare allo cycle length selezionato
  const scrollToCycleLength = (length: number) => {
    const index = CYCLE_LENGTH_OPTIONS.indexOf(length);
    if (index >= 0 && cycleLengthScrollRef.current) {
      setTimeout(() => {
        cycleLengthScrollRef.current?.scrollTo({
          y: index * ITEM_HEIGHT,
          animated: false,
        });
      }, 100);
    }
  };

  const loadExistingData = async () => {
    try {
      let loadedLength = 28;
      if (currentData) {
        loadedLength = currentData.cycleLength;
        setCycleLength(loadedLength);
        setSelectedDate(new Date(currentData.lastPeriodDate));
        setPeriodStarted(true);
      } else {
        loadedLength = await menstrualCycleService.getCycleLength();
        setCycleLength(loadedLength);
        const lastPeriod = await menstrualCycleService.getLastPeriodDate();
        if (lastPeriod) {
          setSelectedDate(new Date(lastPeriod));
          setPeriodStarted(true);
        }
      }
      
      // 🆕 Scroll allo cycle length caricato
      scrollToCycleLength(loadedLength);
      
      // Load saved notes
      const { supabase } = await import('../lib/supabase');
      const { AuthService } = await import('../services/auth.service');
      const currentUser = await AuthService.getCurrentUser();
      if (currentUser?.id) {
        const { data } = await supabase
          .from('menstrual_cycle_notes')
          .select('date, note')
          .eq('user_id', currentUser.id);
        
        if (data) {
          const notesMap: Record<string, string> = {};
          data.forEach((item: any) => {
            notesMap[item.date] = item.note;
          });
          setSavedNotes(notesMap);
        }
      }
    } catch (error) {
      console.error('Error loading cycle data:', error);
    }
  };
  
  const handleSave = async () => {
    try {
      setIsSaving(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Save last period date
      const dateStr = selectedDate.toISOString().split('T')[0];
      await menstrualCycleService.setLastPeriodDate(dateStr);
      await menstrualCycleService.setCycleLength(cycleLength);
      
      // Save note if provided
      if (note.trim()) {
        const { supabase } = await import('../lib/supabase');
        const { AuthService } = await import('../services/auth.service');
        const currentUser = await AuthService.getCurrentUser();
        if (currentUser?.id) {
          const today = new Date().toISOString().split('T')[0];
          await supabase
            .from('menstrual_cycle_notes')
            .upsert({
              user_id: currentUser.id,
              date: today,
              note: note.trim(),
              created_at: new Date().toISOString(),
            }, { onConflict: 'user_id,date' });
        }
      }
      
      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving cycle data:', error);
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleDateSelect = (date: Date) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedDate(date);
    setPeriodStarted(true);
  };
  
  const handleCycleLengthChange = (length: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCycleLength(length);
  };
  
  // Calculate cycle info for display
  const calculateCycleInfo = () => {
    if (!periodStarted) return null;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastPeriod = new Date(selectedDate);
    lastPeriod.setHours(0, 0, 0, 0);
    
    const diffTime = today.getTime() - lastPeriod.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return { day: 1, phase: 'menstrual' as CyclePhase, nextPeriod: cycleLength };
    
    const day = (diffDays % cycleLength) + 1;
    let phase: CyclePhase;
    if (day <= 5) phase = 'menstrual';
    else if (day <= 13) phase = 'follicular';
    else if (day <= 16) phase = 'ovulation';
    else phase = 'luteal';
    
    const nextPeriod = cycleLength - day + 1;
    
    return { day, phase, nextPeriod };
  };
  
  const cycleInfo = calculateCycleInfo();
  
  // Generate calendar days
  const generateCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = (firstDay.getDay() + 6) % 7; // Monday = 0
    
    const days: (Date | null)[] = [];
    
    // Empty slots for days before the first
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }
    
    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    
    return days;
  };
  
  const calendarDays = generateCalendarDays();
  
  const isSelectedDate = (date: Date | null) => {
    if (!date) return false;
    return date.toDateString() === selectedDate.toDateString();
  };
  
  const isToday = (date: Date | null) => {
    if (!date) return false;
    return date.toDateString() === new Date().toDateString();
  };
  
  const isFutureDate = (date: Date | null) => {
    if (!date) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    return date > today;
  };
  
  const hasNote = (date: Date | null) => {
    if (!date) return false;
    const dateStr = date.toISOString().split('T')[0];
    return !!savedNotes[dateStr];
  };
  
  const phaseTranslations: Record<CyclePhase, string> = {
    menstrual: t('home.cycle.phases.menstrual') || 'Mestruale',
    follicular: t('home.cycle.phases.follicular') || 'Follicolare',
    ovulation: t('home.cycle.phases.ovulation') || 'Ovulazione',
    luteal: t('home.cycle.phases.luteal') || 'Luteale',
  };
  
  const phaseDescriptions: Record<CyclePhase, string> = {
    menstrual: t('home.cycle.descriptions.menstrual') || 'Periodo mestruale. Riposo e cura di sé sono importanti.',
    follicular: t('home.cycle.descriptions.follicular') || 'Fase di crescita. Energia in aumento, ottimo momento per nuovi progetti.',
    ovulation: t('home.cycle.descriptions.ovulation') || 'Fase di ovulazione. Picco di energia e fertilità.',
    luteal: t('home.cycle.descriptions.luteal') || 'Fase luteale. Possibili sbalzi d\'umore, prenditi cura di te.',
  };
  
  const weekDays = language === 'it' 
    ? ['L', 'M', 'M', 'G', 'V', 'S', 'D']
    : ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  
  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <BlurView intensity={20} tint={themeMode === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        
        <Animated.View 
          style={[
            styles.modalContainer,
            { transform: [{ translateY: slideAnim }] }
          ]}
        >
          <View style={[styles.modal, { backgroundColor: colors.surface }]}>
            {/* Header */}
            <LinearGradient
              colors={cycleInfo ? PHASE_COLORS[cycleInfo.phase] : ['#ec4899', '#db2777']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.header}
            >
              <View style={styles.headerContent}>
                <View style={styles.headerIconContainer}>
                  <MaterialCommunityIcons 
                    name={cycleInfo ? PHASE_ICONS[cycleInfo.phase] : 'heart-pulse'} 
                    size={32} 
                    color="#fff" 
                  />
                </View>
                <View style={styles.headerTextContainer}>
                  <Text style={styles.headerTitle}>
                    {t('home.cycle.title') || 'Ciclo Mestruale'}
                  </Text>
                  {cycleInfo && (
                    <Text style={styles.headerSubtitle}>
                      {t('home.cycle.day', { day: cycleInfo.day }) || `Giorno ${cycleInfo.day}`} • {phaseTranslations[cycleInfo.phase]}
                    </Text>
                  )}
                </View>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <MaterialCommunityIcons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </LinearGradient>
            
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              {/* Phase Info Card */}
              {cycleInfo && (
                <View style={[styles.phaseCard, { backgroundColor: colors.surfaceMuted }]}>
                  <View style={styles.phaseHeader}>
                    <View style={[styles.phaseDot, { backgroundColor: PHASE_COLORS[cycleInfo.phase][0] }]} />
                    <Text style={[styles.phaseTitle, { color: colors.text }]}>
                      {phaseTranslations[cycleInfo.phase]}
                    </Text>
                  </View>
                  <Text style={[styles.phaseDescription, { color: colors.textSecondary }]}>
                    {phaseDescriptions[cycleInfo.phase]}
                  </Text>
                  <View style={styles.phaseStats}>
                    <View style={styles.phaseStat}>
                      <Text style={[styles.phaseStatValue, { color: PHASE_COLORS[cycleInfo.phase][0] }]}>
                        {cycleInfo.nextPeriod}
                      </Text>
                      <Text style={[styles.phaseStatLabel, { color: colors.textSecondary }]}>
                        {t('home.cycle.daysUntilNext') || 'giorni al prossimo'}
                      </Text>
                    </View>
                    <View style={styles.phaseStatDivider} />
                    <View style={styles.phaseStat}>
                      <Text style={[styles.phaseStatValue, { color: PHASE_COLORS[cycleInfo.phase][0] }]}>
                        {cycleLength}
                      </Text>
                      <Text style={[styles.phaseStatLabel, { color: colors.textSecondary }]}>
                        {t('home.cycle.cycleLength') || 'durata ciclo'}
                      </Text>
                    </View>
                  </View>
                </View>
              )}
              
              {/* Calendar Section */}
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  {t('home.cycle.lastPeriodStart') || 'Inizio ultimo ciclo'}
                </Text>
                
                {/* Month Navigation */}
                <View style={styles.monthNav}>
                  <TouchableOpacity 
                    onPress={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                    style={[styles.monthNavButton, { backgroundColor: colors.surfaceMuted }]}
                  >
                    <MaterialCommunityIcons name="chevron-left" size={24} color={colors.text} />
                  </TouchableOpacity>
                  <Text style={[styles.monthTitle, { color: colors.text }]}>
                    {currentMonth.toLocaleDateString(language === 'it' ? 'it-IT' : 'en-US', { month: 'long', year: 'numeric' })}
                  </Text>
                  <TouchableOpacity 
                    onPress={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                    style={[styles.monthNavButton, { backgroundColor: colors.surfaceMuted }]}
                  >
                    <MaterialCommunityIcons name="chevron-right" size={24} color={colors.text} />
                  </TouchableOpacity>
                </View>
                
                {/* Week Days Header */}
                <View style={styles.weekDaysRow}>
                  {weekDays.map((day, index) => (
                    <Text key={index} style={[styles.weekDay, { color: colors.textSecondary }]}>
                      {day}
                    </Text>
                  ))}
                </View>
                
                {/* Calendar Grid */}
                <View style={styles.calendarGrid}>
                  {calendarDays.map((date, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.calendarDay,
                        isSelectedDate(date) && styles.calendarDaySelected,
                        isToday(date) && !isSelectedDate(date) && [styles.calendarDayToday, { borderColor: colors.primary }],
                        !date && styles.calendarDayEmpty,
                        isFutureDate(date) && styles.calendarDayFuture,
                      ]}
                      onPress={() => date && !isFutureDate(date) && handleDateSelect(date)}
                      disabled={!date || isFutureDate(date)}
                    >
                      {date && (
                        <>
                          <Text style={[
                            styles.calendarDayText,
                            { color: colors.text },
                            isSelectedDate(date) && styles.calendarDayTextSelected,
                            isFutureDate(date) && { color: colors.textTertiary },
                          ]}>
                            {date.getDate()}
                          </Text>
                          {hasNote(date) && (
                            <View style={[styles.noteDot, { backgroundColor: '#ec4899' }]} />
                          )}
                        </>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              
              {/* Cycle Length Section - Vertical Scroll Picker */}
              <View style={styles.sectionCompact}>
                <View style={styles.cycleLengthHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    {t('home.cycle.cycleLengthTitle') || 'Durata del ciclo'}
                  </Text>
                </View>
                
                {/* 🆕 Scroll Picker verticale */}
                <View style={[styles.cycleLengthPickerContainer, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                  {/* Indicatore di selezione centrale */}
                  <View style={[styles.cycleLengthPickerHighlight, { backgroundColor: `${'#ec4899'}20`, borderColor: '#ec4899' }]} />
                  
                  <ScrollView
                    ref={cycleLengthScrollRef}
                    style={styles.cycleLengthPicker}
                    contentContainerStyle={styles.cycleLengthPickerContent}
                    showsVerticalScrollIndicator={false}
                    snapToInterval={ITEM_HEIGHT}
                    decelerationRate="fast"
                    onMomentumScrollEnd={(event) => {
                      const offsetY = event.nativeEvent.contentOffset.y;
                      const index = Math.round(offsetY / ITEM_HEIGHT);
                      const clampedIndex = Math.max(0, Math.min(index, CYCLE_LENGTH_OPTIONS.length - 1));
                      const newLength = CYCLE_LENGTH_OPTIONS[clampedIndex];
                      if (newLength !== cycleLength) {
                        handleCycleLengthChange(newLength);
                      }
                    }}
                  >
                    {/* Padding top per centrare il primo elemento */}
                    <View style={{ height: ITEM_HEIGHT }} />
                    
                    {CYCLE_LENGTH_OPTIONS.map((length, index) => {
                      const isSelected = cycleLength === length;
                      return (
                        <TouchableOpacity
                          key={length}
                          style={[
                            styles.cycleLengthPickerItem,
                            { height: ITEM_HEIGHT },
                          ]}
                          onPress={() => {
                            handleCycleLengthChange(length);
                            cycleLengthScrollRef.current?.scrollTo({
                              y: index * ITEM_HEIGHT,
                              animated: true,
                            });
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={[
                            styles.cycleLengthPickerNumber,
                            { color: isSelected ? '#ec4899' : colors.textSecondary },
                            isSelected && styles.cycleLengthPickerNumberSelected,
                          ]}>
                            {length}
                          </Text>
                          <Text style={[
                            styles.cycleLengthPickerLabel,
                            { color: isSelected ? '#ec4899' : colors.textTertiary },
                            isSelected && styles.cycleLengthPickerLabelSelected,
                          ]}>
                            {language === 'it' ? 'giorni' : 'days'}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                    
                    {/* Padding bottom per centrare l'ultimo elemento */}
                    <View style={{ height: ITEM_HEIGHT }} />
                  </ScrollView>
                </View>
              </View>
              
              {/* Notes Section */}
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  {t('home.cycle.addNote') || 'Aggiungi una nota'}
                </Text>
                <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                  {t('home.cycle.noteSubtitle') || 'Registra sintomi, umore o altri dettagli'}
                </Text>
                
                <TextInput
                  style={[
                    styles.noteInput,
                    { 
                      backgroundColor: colors.surfaceMuted, 
                      color: colors.text,
                      borderColor: colors.border,
                    }
                  ]}
                  placeholder={t('home.cycle.notePlaceholder') || 'Es: Crampi leggeri, stanchezza...'}
                  placeholderTextColor={colors.textTertiary}
                  value={note}
                  onChangeText={setNote}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>
              
              {/* Info Card */}
              <View style={[styles.infoCard, { backgroundColor: `${colors.primary}15` }]}>
                <MaterialCommunityIcons name="information-outline" size={20} color={colors.primary} />
                <Text style={[styles.infoText, { color: colors.text }]}>
                  {t('home.cycle.infoText') || 'Le tue note saranno disponibili per l\'assistente AI per darti consigli personalizzati.'}
                </Text>
              </View>
            </ScrollView>
            
            {/* Footer */}
            <View style={[styles.footer, { borderTopColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.cancelButton, { backgroundColor: colors.surfaceMuted }]}
                onPress={onClose}
              >
                <Text style={[styles.cancelButtonText, { color: colors.text }]}>
                  {t('common.cancel') || 'Annulla'}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.saveButton,
                  !periodStarted && styles.saveButtonDisabled,
                ]}
                onPress={handleSave}
                disabled={!periodStarted || isSaving}
              >
                <LinearGradient
                  colors={periodStarted ? ['#ec4899', '#db2777'] : ['#9ca3af', '#6b7280']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.saveButtonGradient}
                >
                  <Text style={styles.saveButtonText}>
                    {isSaving ? (t('common.saving') || 'Salvataggio...') : (t('common.save') || 'Salva')}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContainer: {
    maxHeight: '92%',
  },
  modal: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 4,
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
    padding: 20,
    maxHeight: 500,
  },
  phaseCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  phaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  phaseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  phaseTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  phaseDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  phaseStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  phaseStat: {
    flex: 1,
    alignItems: 'center',
  },
  phaseStatValue: {
    fontSize: 28,
    fontWeight: '700',
  },
  phaseStatLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  phaseStatDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  section: {
    marginBottom: 12, // 🔥 Ridotto da 16 a 12
  },
  sectionCompact: {
    marginBottom: 16, // 🔥 Ridotto da 20 a 16
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    marginBottom: 12,
  },
  sectionSubtitleSmall: {
    fontSize: 12,
    marginTop: 2,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  monthNavButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  weekDaysRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekDay: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDay: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    padding: 2,
  },
  calendarDaySelected: {
    backgroundColor: '#ec4899',
  },
  calendarDayToday: {
    borderWidth: 2,
  },
  calendarDayEmpty: {
    backgroundColor: 'transparent',
  },
  calendarDayFuture: {
    opacity: 0.4,
  },
  calendarDayText: {
    fontSize: 14,
    fontWeight: '500',
  },
  calendarDayTextSelected: {
    color: '#fff',
    fontWeight: '700',
  },
  noteDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    position: 'absolute',
    bottom: 4,
  },
  cycleLengthHeader: {
    marginBottom: 12,
  },
  // 🆕 Stili per lo scroll picker verticale
  cycleLengthPickerContainer: {
    height: 132, // 3 items visibili (44 * 3)
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  cycleLengthPickerHighlight: {
    position: 'absolute',
    top: 44, // Posizione centrale (ITEM_HEIGHT)
    left: 8,
    right: 8,
    height: 44,
    borderRadius: 10,
    borderWidth: 1.5,
    zIndex: 0,
  },
  cycleLengthPicker: {
    flex: 1,
  },
  cycleLengthPickerContent: {
    paddingHorizontal: 16,
  },
  cycleLengthPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  cycleLengthPickerNumber: {
    fontSize: 22,
    fontWeight: '600',
  },
  cycleLengthPickerNumberSelected: {
    fontSize: 26,
    fontWeight: '800',
  },
  cycleLengthPickerLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  cycleLengthPickerLabelSelected: {
    fontSize: 15,
    fontWeight: '600',
  },
  noteInput: {
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    minHeight: 100,
    borderWidth: 1,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 12,
    gap: 10,
    marginBottom: 20,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
  },
  cancelButton: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 2,
    height: 50,
    borderRadius: 14,
    overflow: 'hidden',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});

export default MenstrualCycleModal;

