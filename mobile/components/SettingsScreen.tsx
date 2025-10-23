import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Colors from '../constants/Colors';
import { AuthService } from '../services/auth.service';
import { BiometricAuthService } from '../services/biometric-auth.service';
import { UserProfile } from '../types/database.types';
import { PersonalInformationScreen } from './settings/PersonalInformationScreen';
import { HealthPermissionsModal } from './HealthPermissionsModal';
import { BiometricSecurityModal } from './BiometricSecurityModal';
import { useHealthData } from '../hooks/useHealthData';

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

const accountItems: SettingsItem[] = [
  { id: 'profile', label: 'Personal Information', description: 'Manage your personal info', icon: 'user-circle' },
  { id: 'preferences', label: 'Preferences', description: 'Update your wellness focus', icon: 'sliders' },
];

const appItems: SettingsItem[] = [
  { id: 'health-permissions', label: 'Health Data Permissions', description: 'Manage access to your health data', icon: 'heart' },
  { id: 'biometric-security', label: 'Biometric Security', description: 'Manage Face ID / Touch ID login', icon: 'shield' },
  { id: 'app-config', label: 'App Configuration', description: 'Control app experience', icon: 'wrench' },
  { id: 'notifications', label: 'Notifications', description: 'Define reminders & alerts', icon: 'bell' },
  { id: 'subscription', label: 'Subscription', description: 'Manage your plan', icon: 'credit-card' },
  { id: 'about', label: 'About', description: 'Learn more about Wellness Coach', icon: 'info-circle' },
];

const UserProfileCard = ({ userProfile, isLoading }: { userProfile: UserProfile | null; isLoading: boolean }) => {
  if (isLoading) {
    return (
      <View style={styles.profileCard}>
        <ActivityIndicator size="small" color={Colors.palette.primary} />
        <Text style={styles.profileLoadingText}>Loading profile...</Text>
      </View>
    );
  }

  if (!userProfile) {
    return (
      <View style={styles.profileCard}>
        <Text style={styles.profileErrorText}>Unable to load profile</Text>
      </View>
    );
  }

  return (
    <View style={styles.profileCard}>
      <View style={styles.profileHeader}>
        <View style={styles.profileAvatar}>
          <FontAwesome name="user" size={24} color="#fff" />
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{userProfile.full_name || 'User'}</Text>
          <Text style={styles.profileEmail}>{userProfile.email}</Text>
        </View>
      </View>
      
      <View style={styles.profileDetails}>
        <View style={styles.profileDetailRow}>
          <Text style={styles.profileDetailLabel}>Age</Text>
          <Text style={styles.profileDetailValue}>{userProfile.age || 'Not specified'}</Text>
        </View>
        <View style={styles.profileDetailRow}>
          <Text style={styles.profileDetailLabel}>Gender</Text>
          <Text style={styles.profileDetailValue}>
            {userProfile.gender === 'male' ? 'Male' : 
             userProfile.gender === 'female' ? 'Female' : 
             userProfile.gender === 'other' ? 'Other' : 
             'Prefer not to say'}
          </Text>
        </View>
        <View style={styles.profileDetailRow}>
          <Text style={styles.profileDetailLabel}>Member since</Text>
          <Text style={styles.profileDetailValue}>
            {new Date(userProfile.created_at).toLocaleDateString()}
          </Text>
        </View>
      </View>
    </View>
  );
};

const SettingsSection = ({ title, items, onItemPress }: { title: string; items: SettingsItem[]; onItemPress: (itemId: string) => void }) => {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {items.map((item) => (
        <TouchableOpacity 
          key={item.id} 
          style={styles.row} 
          activeOpacity={0.85}
          onPress={() => onItemPress(item.id)}
        >
          <View style={styles.rowIconWrapper}>
            <FontAwesome name={item.icon as any} size={16} color={Colors.palette.primary} />
          </View>
          <View style={styles.rowCopy}>
            <Text style={styles.rowTitle}>{item.label}</Text>
            <Text style={styles.rowSubtitle}>{item.description}</Text>
          </View>
          <FontAwesome name="chevron-right" size={14} color="#9ca3af" />
        </TouchableOpacity>
      ))}
    </View>
  );
};

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ user, onLogout }) => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentScreen, setCurrentScreen] = useState<'main' | 'personal-info'>('main');
  const [healthPermissionsModal, setHealthPermissionsModal] = useState<boolean>(false);
  const [biometricSecurityModal, setBiometricSecurityModal] = useState<boolean>(false);
  
  // Health data hook
  const { permissions: healthPermissions, hasData: hasHealthData, isInitialized } = useHealthData();

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
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: onLogout }
      ]
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
      case 'preferences':
        Alert.alert('Coming Soon', 'Preferences will be available in a future update');
        break;
      case 'app-config':
        Alert.alert('Coming Soon', 'App Configuration will be available in a future update');
        break;
      case 'notifications':
        Alert.alert('Coming Soon', 'Notifications settings will be available in a future update');
        break;
      case 'subscription':
        Alert.alert('Coming Soon', 'Subscription management will be available in a future update');
        break;
      case 'about':
        Alert.alert('About Wellness Coach', 'Version 1.0.0\n\nYour personal AI wellness coach powered by advanced emotion and skin analysis.');
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

  // Show Personal Information Screen
  if (currentScreen === 'personal-info') {
    return <PersonalInformationScreen user={user} onBack={handleBackToMain} />;
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>
          Personalize your experience, manage notifications, and configure your AI coach.
        </Text>
      </View>

      {/* Content */}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* User Profile Card */}
          <UserProfileCard userProfile={userProfile} isLoading={isLoading} />
          
          <SettingsSection title="Account" items={accountItems} onItemPress={handleItemPress} />
          <SettingsSection title="App Settings" items={appItems} onItemPress={handleItemPress} />

          {/* Logout Button */}
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <FontAwesome name="sign-out" size={16} color="#ef4444" />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>

          <View style={styles.versionCard}>
            <Text style={styles.versionLabel}>App Version</Text>
            <Text style={styles.versionValue}>1.0.0</Text>
          </View>
        </View>
      </ScrollView>

      {/* Health Permissions Modal */}
      <HealthPermissionsModal
        visible={healthPermissionsModal}
        onClose={() => setHealthPermissionsModal(false)}
        onPermissionsGranted={(permissions) => {
          console.log('Health permissions granted from settings:', permissions);
          Alert.alert(
            'Permissions Updated',
            'Your health data permissions have been updated successfully.',
            [{ text: 'OK' }]
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
    paddingVertical: 20,
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
    backgroundColor: Colors.palette.primary,
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
});

export default SettingsScreen;
