import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { AuthService } from '../services/auth.service';
import { BiometricAuthService } from '../services/biometric-auth.service';
import { UserProfile } from '../lib/supabase';
import { PersonalInformationScreen } from './settings/PersonalInformationScreen';
import { HealthPermissionsModal } from './HealthPermissionsModal';
import { BiometricSecurityModal } from './BiometricSecurityModal';
import { useHealthData } from '../hooks/useHealthData';
import { useTranslation } from '../hooks/useTranslation';
import { saveLanguage } from '../i18n';
import { Switch } from 'react-native';
import { useTheme } from '../contexts/ThemeContext'; // 🆕 Theme hook

interface SettingsItem {
  id: string;
  label: string;
  description: string;
  icon: string;
}

interface SettingsScreenProps {
  user: any;
  onLogout: () => void;
}

// 🆕 Items verranno costruiti dinamicamente con traduzioni nel componente

const UserProfileCard = ({ 
  userProfile, 
  isLoading, 
  t, 
  colors 
}: { 
  userProfile: UserProfile | null; 
  isLoading: boolean; 
  t: (key: string) => string;
  colors: any; // 🆕 Theme colors
}) => {
  if (isLoading) {
    return (
      <View style={[styles.profileCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={[styles.profileLoadingText, { color: colors.textSecondary }]}>{t('settings.profile.loading')}</Text>
      </View>
    );
  }

  if (!userProfile) {
    return (
      <View style={[styles.profileCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.profileErrorText, { color: colors.error }]}>{t('settings.profile.error')}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.profileCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.profileHeader}>
        <View style={[styles.profileAvatar, { backgroundColor: colors.primary }]}>
          <FontAwesome name="user" size={24} color={colors.textInverse} />
        </View>
        <View style={styles.profileInfo}>
          <Text style={[styles.profileName, { color: colors.text }]}>{userProfile.full_name || 'User'}</Text>
          <Text style={[styles.profileEmail, { color: colors.textSecondary }]}>{userProfile.email}</Text>
        </View>
      </View>
      
      <View style={[styles.profileDetails, { borderTopColor: colors.divider }]}>
        <View style={styles.profileDetailRow}>
          <Text style={[styles.profileDetailLabel, { color: colors.textSecondary }]}>{t('settings.profile.age')}</Text>
          <Text style={[styles.profileDetailValue, { color: colors.text }]}>{userProfile.age || t('settings.profile.notSpecified')}</Text>
        </View>
        <View style={styles.profileDetailRow}>
          <Text style={[styles.profileDetailLabel, { color: colors.textSecondary }]}>{t('settings.profile.gender')}</Text>
          <Text style={[styles.profileDetailValue, { color: colors.text }]}>
            {userProfile.gender === 'male' ? t('settings.profile.male') : 
             userProfile.gender === 'female' ? t('settings.profile.female') : 
             userProfile.gender === 'other' ? t('settings.profile.other') : 
             t('settings.profile.preferNotToSay')}
          </Text>
        </View>
        <View style={styles.profileDetailRow}>
          <Text style={[styles.profileDetailLabel, { color: colors.textSecondary }]}>{t('settings.profile.memberSince')}</Text>
          <Text style={[styles.profileDetailValue, { color: colors.text }]}>
            {new Date(userProfile.created_at).toLocaleDateString()}
          </Text>
        </View>
      </View>
    </View>
  );
};

const SettingsSection = ({ 
  title, 
  items, 
  onItemPress, 
  colors, 
  darkModeValue 
}: { 
  title: string; 
  items: SettingsItem[]; 
  onItemPress: (itemId: string) => void;
  colors: any; // 🆕 Theme colors
  darkModeValue?: boolean; // 🆕 Value for dark mode toggle
}) => {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      {items.map((item) => (
        <TouchableOpacity 
          key={item.id} 
          style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]} 
          activeOpacity={0.85}
          onPress={() => onItemPress(item.id)}
        >
          <View style={[styles.rowIconWrapper, { backgroundColor: `${colors.primary}15` }]}>
            <FontAwesome name={item.icon as any} size={16} color={colors.primary} />
          </View>
          <View style={styles.rowCopy}>
            <Text style={[styles.rowTitle, { color: colors.text }]}>{item.label}</Text>
            <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>{item.description}</Text>
          </View>
          {/* 🆕 Mostra Switch per dark-mode, altrimenti chevron */}
          {item.id === 'dark-mode' ? (
            <Switch
              value={darkModeValue || false}
              onValueChange={() => onItemPress(item.id)}
              trackColor={{ false: colors.border, true: colors.primaryMuted }}
              thumbColor={darkModeValue ? colors.primary : colors.textSecondary}
            />
          ) : (
            <FontAwesome name="chevron-right" size={14} color={colors.textTertiary} />
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
};

// ---------------- Notifications Settings Subscreen ----------------
const NotificationsSettings = ({ onBack }: { onBack: () => void }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);

  // Toggles
  const [emotionSkin, setEmotionSkin] = useState(true);
  const [diary, setDiary] = useState(true);
  const [fridgeExpiry, setFridgeExpiry] = useState(true);
  const [breathing, setBreathing] = useState(true);
  const [hydration, setHydration] = useState(false);
  const [morningGreeting, setMorningGreeting] = useState(false);
  const [eveningWinddown, setEveningWinddown] = useState(false);
  const [sleepPreparation, setSleepPreparation] = useState(false);

  // Simple time customization: Diary time (HH:MM)
  const [diaryHour, setDiaryHour] = useState(21);
  const [diaryMinute, setDiaryMinute] = useState(30);

  const inc = (setter: (v: number) => void, value: number, max: number) => setter((value + 1) > max ? 0 : (value + 1));
  const dec = (setter: (v: number) => void, value: number, max: number) => setter((value - 1) < 0 ? max : (value - 1));

  const format2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);

  const handleSave = async () => {
    try {
      setLoading(true);
      const { NotificationService } = await import('../services/notifications.service');
      await NotificationService.initialize();
      await NotificationService.cancelAll();

      // Schedule selected
      if (emotionSkin) await NotificationService.scheduleEmotionSkinWeekly();
      if (diary) {
        // Custom diary time
        await NotificationService.schedule(
          'journal_reminder',
          t('settings.notifications.diaryTitle') || 'Diario',
          t('settings.notifications.diaryBody') || 'Ti va di scrivere una breve voce nel diario?',
          { hour: diaryHour, minute: diaryMinute, repeats: true },
          { screen: 'journal' }
        );
      }
      if (fridgeExpiry) await NotificationService.scheduleFridgeExpiryCheck(); // Daily check at 18:00
      if (breathing) await NotificationService.scheduleBreathingNudges();
      if (hydration) await NotificationService.scheduleHydrationReminders();
      if (morningGreeting) await NotificationService.scheduleMorningGreeting();
      if (eveningWinddown) await NotificationService.scheduleEveningWinddown();
      if (sleepPreparation) await NotificationService.scheduleSleepPreparation();

      Alert.alert(t('common.success'), t('settings.notifications.saved') || 'Notifiche aggiornate');
      onBack();
    } catch (e) {
      Alert.alert(t('common.error'), (e as any)?.message || 'Impossibile aggiornare le notifiche');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}> 
        <Text style={[styles.title, { color: colors.text }]}>{t('settings.notificationsTitle')}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {t('settings.notificationsDescription')}
        </Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Category toggles */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('settings.notificationsCategories') || 'Categorie'}</Text>

            {[{ id: 'emotionSkin', label: t('settings.notifications.emotionSkin') || 'Analisi Emozioni/Pelle', value: emotionSkin, setter: setEmotionSkin },
              { id: 'diary', label: t('settings.notifications.diary') || 'Diario', value: diary, setter: setDiary },
              { id: 'fridge', label: t('settings.notifications.fridgeExpiry') || 'Ingredienti in scadenza', value: fridgeExpiry, setter: setFridgeExpiry },
              { id: 'breathing', label: t('settings.notifications.breathing') || 'Pausa/Respirazione', value: breathing, setter: setBreathing },
              { id: 'hydration', label: t('settings.notifications.hydration') || 'Idratazione', value: hydration, setter: setHydration },
              { id: 'morning', label: t('settings.notifications.morningGreeting') || 'Saluto mattutino', value: morningGreeting, setter: setMorningGreeting },
              { id: 'evening', label: t('settings.notifications.eveningWinddown') || 'Buona serata', value: eveningWinddown, setter: setEveningWinddown },
              { id: 'sleep', label: t('settings.notifications.sleepPreparation') || 'Preparazione al sonno', value: sleepPreparation, setter: setSleepPreparation },
            ].map((row) => (
              <View key={row.id} style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
                <View style={styles.rowCopy}>
                  <Text style={[styles.rowTitle, { color: colors.text }]}>{row.label}</Text>
                </View>
                <Switch
                  value={row.value}
                  onValueChange={() => row.setter(!row.value)}
                  trackColor={{ false: colors.border, true: colors.primaryMuted }}
                  thumbColor={row.value ? colors.primary : colors.textSecondary}
                />
              </View>
            ))}
          </View>

          {/* Diary time customization */}
          {diary && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('settings.notifications.diaryTimeTitle') || 'Orario Diario'}</Text>
              <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border, justifyContent: 'space-between' }]}> 
                <Text style={[styles.rowTitle, { color: colors.text }]}>
                  {format2(diaryHour)}:{format2(diaryMinute)}
                </Text>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <TouchableOpacity onPress={() => inc(setDiaryHour, diaryHour, 23)} style={[styles.smallBtn, { borderColor: colors.border }]}>
                    <Text style={{ color: colors.text }}>+H</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => dec(setDiaryHour, diaryHour, 23)} style={[styles.smallBtn, { borderColor: colors.border }]}>
                    <Text style={{ color: colors.text }}>-H</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => inc(setDiaryMinute, diaryMinute, 59)} style={[styles.smallBtn, { borderColor: colors.border }]}>
                    <Text style={{ color: colors.text }}>+M</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => dec(setDiaryMinute, diaryMinute, 59)} style={[styles.smallBtn, { borderColor: colors.border }]}>
                    <Text style={{ color: colors.text }}>
                      -M
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Actions */}
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
            <TouchableOpacity 
              style={[styles.logoutButton, { backgroundColor: colors.surface, borderColor: colors.primary + '40' }]}
              onPress={handleSave}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <FontAwesome name="check" size={16} color={colors.primary} />
                  <Text style={[styles.logoutText, { color: colors.primary }]}>{t('common.save')}</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.logoutButton, { backgroundColor: colors.surface, borderColor: colors.border }]} 
              onPress={onBack}
              disabled={loading}
            >
              <FontAwesome name="chevron-left" size={16} color={colors.textSecondary} />
              <Text style={[styles.logoutText, { color: colors.textSecondary }]}>{t('common.back')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ user, onLogout }) => {
  const { t, language, changeLanguage } = useTranslation(); // 🆕 Hook traduzioni
  const { mode, colors, toggleTheme } = useTheme(); // 🆕 Theme hook
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentScreen, setCurrentScreen] = useState<'main' | 'personal-info' | 'notifications'>('main');
  const [healthPermissionsModal, setHealthPermissionsModal] = useState<boolean>(false);
  const [biometricSecurityModal, setBiometricSecurityModal] = useState<boolean>(false);
  
  // Health data hook
  const { permissions: healthPermissions, hasData: hasHealthData, isInitialized } = useHealthData();
  
  // 🆕 Costruisci items con traduzioni
  const accountItems: SettingsItem[] = [
    { id: 'profile', label: t('settings.personalInfo'), description: t('settings.personalInfoDescription'), icon: 'user-circle' },
    { id: 'preferences', label: t('settings.preferences'), description: t('settings.preferencesDescription'), icon: 'sliders' },
  ];

  const appItems: SettingsItem[] = [
    { id: 'health-permissions', label: t('settings.healthPermissions'), description: t('settings.healthPermissionsDescription'), icon: 'heart' },
    { id: 'biometric-security', label: t('settings.biometricSecurity'), description: t('settings.biometricSecurityDescription'), icon: 'shield' },
    { id: 'language', label: t('settings.language'), description: t('settings.languageDescription'), icon: 'globe' },
    { id: 'dark-mode', label: t('settings.darkMode'), description: t('settings.darkModeDescription'), icon: 'moon-o' }, // 🆕 Dark mode toggle
    { id: 'app-config', label: t('settings.appConfig'), description: t('settings.appConfigDescription'), icon: 'wrench' },
    { id: 'notifications', label: t('settings.notificationsTitle'), description: t('settings.notificationsDescription'), icon: 'bell' },
    { id: 'subscription', label: t('settings.subscription'), description: t('settings.subscriptionDescription'), icon: 'credit-card' },
    { id: 'about', label: t('settings.about'), description: t('settings.aboutDescription'), icon: 'info-circle' },
  ];

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      setIsLoading(true);
      const profile = await AuthService.getUserProfile(user.id);
      setUserProfile(profile);
    } catch (error) {
      console.error('Error loading user profile:', error);
      // In caso di errore, mostra i dati di base dell'utente
      setUserProfile({
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || 'User',
        age: null,
        gender: 'prefer_not_to_say',
        created_at: user.created_at,
        updated_at: user.updated_at,
      } as UserProfile);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      t('settings.logout'),
      t('settings.logoutConfirm'),
      [
        { text: t('settings.logoutCancel'), style: 'cancel' },
        { text: t('settings.logout'), style: 'destructive', onPress: onLogout }
      ]
    );
  };
  
  // 🆕 Handler per cambio lingua
  const handleLanguageChange = async (newLang: 'it' | 'en') => {
    await saveLanguage(newLang);
    await changeLanguage(newLang);
    Alert.alert(
      t('common.success'),
      t('settings.languageChanged', { lang: newLang === 'it' ? 'Italiano' : 'English' })
    );
  };

  const handleItemPress = (itemId: string) => {
    switch (itemId) {
      case 'profile':
        setCurrentScreen('personal-info');
        break;
      case 'health-permissions':
        setHealthPermissionsModal(true);
        break;
      case 'biometric-security':
        setBiometricSecurityModal(true);
        break;
      case 'language':
        // 🆕 Mostra dialog per selezione lingua
        Alert.alert(
          t('settings.language'),
          t('settings.chooseLanguage'),
          [
            { text: t('common.cancel'), style: 'cancel' },
            { 
              text: 'English', 
              onPress: () => handleLanguageChange('en'),
              style: language === 'en' ? 'default' : 'default'
            },
            { 
              text: 'Italiano', 
              onPress: () => handleLanguageChange('it'),
              style: language === 'it' ? 'default' : 'default'
            },
          ]
        );
        break;
      case 'dark-mode':
        // 🆕 Toggle dark mode
        toggleTheme();
        break;
      case 'preferences':
        Alert.alert(t('settings.comingSoon'), t('settings.comingSoonMessage'));
        break;
      case 'app-config':
        Alert.alert(t('settings.comingSoon'), t('settings.comingSoonMessage'));
        break;
      case 'notifications':
        setCurrentScreen('notifications');
        break;
      case 'subscription':
        Alert.alert(t('settings.comingSoon'), t('settings.comingSoonMessage'));
        break;
      case 'about':
        Alert.alert(t('settings.aboutTitle'), t('settings.aboutMessage'));
        break;
      default:
        break;
    }
  };

  const handleBackToMain = () => {
    setCurrentScreen('main');
    // Reload profile data when returning from personal info screen
    loadUserProfile();
  };

  // Show sub-screens
  if (currentScreen === 'personal-info') {
    return <PersonalInformationScreen user={user} onBack={handleBackToMain} />;
  }
  if (currentScreen === 'notifications') {
    return <NotificationsSettings onBack={handleBackToMain} />;
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>{t('settings.title')}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {t('settings.subtitle')}
        </Text>
      </View>

      {/* Content */}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* User Profile Card */}
          <UserProfileCard userProfile={userProfile} isLoading={isLoading} t={t} colors={colors} />
          
          <SettingsSection 
            title={t('settings.account')} 
            items={accountItems} 
            onItemPress={handleItemPress}
            colors={colors}
          />
          <SettingsSection 
            title={t('settings.appSettings')} 
            items={appItems} 
            onItemPress={handleItemPress}
            colors={colors}
            darkModeValue={mode === 'dark'} // 🆕 Pass dark mode value
          />

          {/* Logout Button */}
          <TouchableOpacity 
            style={[styles.logoutButton, { backgroundColor: colors.surface, borderColor: colors.error + '40' }]} 
            onPress={handleLogout}
          >
            <FontAwesome name="sign-out" size={16} color={colors.error} />
            <Text style={[styles.logoutText, { color: colors.error }]}>{t('settings.logout')}</Text>
          </TouchableOpacity>

          <View style={[styles.versionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.versionLabel, { color: colors.textSecondary }]}>{t('settings.version')}</Text>
            <Text style={[styles.versionValue, { color: colors.primary }]}>{t('settings.versionValue')}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Health Permissions Modal */}
      <HealthPermissionsModal
        visible={healthPermissionsModal}
        onClose={() => setHealthPermissionsModal(false)}
        onSuccess={() => {
          // 🆕 Rimossi log per performance
          Alert.alert(
            t('settings.healthPermissionsUpdated'),
            t('settings.healthPermissionsUpdatedMessage'),
            [{ text: t('common.ok') }]
          );
        }}
      />

      {/* Biometric Security Modal */}
      <BiometricSecurityModal
        visible={biometricSecurityModal}
        onClose={() => setBiometricSecurityModal(false)}
        userEmail={userProfile?.email || user?.email || ''}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    lineHeight: 24,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 100, // Increased padding to account for bottom navigation bar
  },
  section: {
    marginBottom: 32,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  rowIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(99,102,241,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  rowCopy: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 2,
  },
  rowSubtitle: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },
  versionCard: {
    marginTop: 20,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    padding: 20,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  versionLabel: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 4,
  },
  versionValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6366f1',
  },
  // Profile Card Styles
  profileCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    // backgroundColor sarà sovrascritto dinamicamente con colors.primary
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: '#64748b',
  },
  profileDetails: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 16,
  },
  profileDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  profileDetailLabel: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  profileDetailValue: {
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '600',
  },
  profileLoadingText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 8,
  },
  profileErrorText: {
    fontSize: 14,
    color: '#ef4444',
    textAlign: 'center',
  },
  // Logout Button Styles
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#fecaca',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ef4444',
    marginLeft: 8,
  },
  smallBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default SettingsScreen;
