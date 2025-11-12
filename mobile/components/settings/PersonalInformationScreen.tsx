import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { AuthService } from '../../services/auth.service';
import { User } from '@supabase/supabase-js';
import { useTranslation } from '../../hooks/useTranslation'; // 🆕 i18n
import { useTheme } from '../../contexts/ThemeContext'; // 🆕 Theme hook
import { SafeAreaView } from 'react-native-safe-area-context'; // 🆕 SafeAreaView

interface PersonalInformationScreenProps {
  user: User;
  onBack: () => void;
}

export const PersonalInformationScreen: React.FC<PersonalInformationScreenProps> = ({
  user,
  onBack,
}) => {
  const { t } = useTranslation(); // 🆕 i18n hook
  const { colors } = useTheme(); // 🆕 Theme colors
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [profile, setProfile] = useState({
    full_name: '',
    email: '',
    age: '',
    gender: 'prefer_not_to_say' as 'male' | 'female' | 'prefer_not_to_say',
    weight: '',
    height: '',
    activity_level: 'sedentary' as 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'extremely_active',
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setIsLoading(true);
    try {
      const userProfile = await AuthService.getUserProfile(user.id);
      if (userProfile) {
        setProfile({
          full_name: userProfile.full_name || '',
          email: userProfile.email || user.email || '',
          age: userProfile.age ? userProfile.age.toString() : '',
          gender: userProfile.gender || 'prefer_not_to_say',
          weight: userProfile.weight ? userProfile.weight.toString() : '',
          height: userProfile.height ? userProfile.height.toString() : '',
          activity_level: userProfile.activity_level || 'sedentary',
        });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      Alert.alert(t('common.error'), t('profile.loadError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!profile.full_name.trim()) {
      Alert.alert(t('common.error'), t('profile.fullNameRequired'));
      return;
    }

    setIsSaving(true);
    try {
      await AuthService.updateUserProfile(user.id, {
        full_name: profile.full_name.trim(),
        age: profile.age ? parseInt(profile.age) : undefined,
        gender: profile.gender,
        weight: profile.weight ? parseFloat(profile.weight) : undefined,
        height: profile.height ? parseFloat(profile.height) : undefined,
        activity_level: profile.activity_level,
      });

      Alert.alert(t('common.success'), t('profile.updateSuccess'), [
        { text: t('common.ok'), onPress: onBack }
      ]);
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert(t('common.error'), t('profile.updateError'));
    } finally {
      setIsSaving(false);
    }
  };

  const getGenderLabel = (gender: string) => {
    switch (gender) {
      case 'male':
        return t('auth.gender.male');
      case 'female':
        return t('auth.gender.female');
      default:
        return t('auth.gender.preferNotToSay');
    }
  };

  const getActivityLevelLabel = (level: string) => {
    switch (level) {
      case 'sedentary':
        return t('profile.activityLevels.sedentary');
      case 'lightly_active':
        return t('profile.activityLevels.lightlyActive');
      case 'moderately_active':
        return t('profile.activityLevels.moderatelyActive');
      case 'very_active':
        return t('profile.activityLevels.veryActive');
      case 'extremely_active':
        return t('profile.activityLevels.extremelyActive');
      default:
        return t('profile.activityLevels.sedentary');
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor: colors.background }]} edges={['top']}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>{t('profile.loading')}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <KeyboardAvoidingView 
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <FontAwesome name="arrow-left" size={20} color={colors.primary} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>{t('profile.title')}</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Nome Completo */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>{t('profile.fullName')}</Text>
            <View style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <FontAwesome name="user" size={16} color={colors.primary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                value={profile.full_name}
                onChangeText={(text) => setProfile({ ...profile, full_name: text })}
                placeholder={t('profile.fullNamePlaceholder')}
                placeholderTextColor={colors.textTertiary}
              />
            </View>
          </View>

          {/* Email */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Email</Text>
            <View style={[styles.inputWrapper, { backgroundColor: colors.surfaceElevated, borderColor: colors.borderLight }]}>
              <FontAwesome name="envelope" size={16} color={colors.textTertiary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: colors.textSecondary }]}
                value={profile.email}
                editable={false}
                placeholder={t('auth.email')}
                placeholderTextColor={colors.textTertiary}
              />
            </View>
            <Text style={[styles.helpText, { color: colors.textTertiary }]}>{t('profile.emailCannotBeChanged')}</Text>
          </View>

          {/* Età */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>{t('auth.age')}</Text>
            <View style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <FontAwesome name="calendar" size={16} color={colors.primary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                value={profile.age}
                onChangeText={(text) => setProfile({ ...profile, age: text })}
                placeholder={t('auth.agePlaceholder')}
                placeholderTextColor={colors.textTertiary}
                keyboardType="numeric"
                maxLength={3}
              />
            </View>
          </View>

          {/* Genere */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>{t('auth.gender.label')}</Text>
            <TouchableOpacity 
              style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => {
                Alert.alert(
                  t('auth.gender.selectTitle'),
                  t('profile.selectGender'),
                  [
                    { text: t('auth.gender.male'), onPress: () => setProfile({ ...profile, gender: 'male' }) },
                    { text: t('auth.gender.female'), onPress: () => setProfile({ ...profile, gender: 'female' }) },
                    { text: t('auth.gender.preferNotToSay'), onPress: () => setProfile({ ...profile, gender: 'prefer_not_to_say' }) },
                    { text: t('common.cancel'), style: 'cancel' }
                  ]
                );
              }}
            >
              <FontAwesome name="venus-mars" size={16} color={colors.primary} style={styles.inputIcon} />
              <Text style={[styles.inputText, { color: colors.text }]}>{getGenderLabel(profile.gender)}</Text>
              <FontAwesome name="chevron-down" size={14} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>

          {/* Peso */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>{t('profile.weight')}</Text>
            <View style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <FontAwesome name="balance-scale" size={16} color={colors.primary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                value={profile.weight}
                onChangeText={(text) => setProfile({ ...profile, weight: text })}
                placeholder={t('profile.weightPlaceholder')}
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad"
              />
              <Text style={[styles.unitText, { color: colors.textSecondary }]}>kg</Text>
            </View>
          </View>

          {/* Altezza */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>{t('profile.height')}</Text>
            <View style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <FontAwesome name="ruler-vertical" size={16} color={colors.primary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                value={profile.height}
                onChangeText={(text) => setProfile({ ...profile, height: text })}
                placeholder={t('profile.heightPlaceholder')}
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad"
              />
              <Text style={[styles.unitText, { color: colors.textSecondary }]}>cm</Text>
            </View>
          </View>

          {/* Livello di Attività */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>{t('profile.activityLevel')}</Text>
            <TouchableOpacity 
              style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => {
                Alert.alert(
                  t('profile.selectActivityLevel'),
                  t('profile.selectActivityLevelDesc'),
                  [
                    { text: t('profile.activityLevels.sedentary'), onPress: () => setProfile({ ...profile, activity_level: 'sedentary' }) },
                    { text: t('profile.activityLevels.lightlyActive'), onPress: () => setProfile({ ...profile, activity_level: 'lightly_active' }) },
                    { text: t('profile.activityLevels.moderatelyActive'), onPress: () => setProfile({ ...profile, activity_level: 'moderately_active' }) },
                    { text: t('profile.activityLevels.veryActive'), onPress: () => setProfile({ ...profile, activity_level: 'very_active' }) },
                    { text: t('profile.activityLevels.extremelyActive'), onPress: () => setProfile({ ...profile, activity_level: 'extremely_active' }) },
                    { text: t('common.cancel'), style: 'cancel' }
                  ]
                );
              }}
            >
              <FontAwesome name="tachometer" size={16} color={colors.primary} style={styles.inputIcon} />
              <Text style={[styles.inputText, { color: colors.text }]}>{getActivityLevelLabel(profile.activity_level)}</Text>
              <FontAwesome name="chevron-down" size={14} color={colors.textTertiary} />
            </TouchableOpacity>
            <Text style={[styles.helpText, { color: colors.textTertiary }]}>{t('profile.activityLevelHelp')}</Text>
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity 
          style={[styles.saveButton, { backgroundColor: colors.primary }, isSaving && { backgroundColor: colors.primaryMuted }]} 
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={colors.textInverse} />
          ) : (
            <>
              <FontAwesome name="save" size={16} color={colors.textInverse} style={styles.buttonIcon} />
              <Text style={[styles.saveButtonText, { color: colors.textInverse }]}>{t('profile.saveChanges')}</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 30,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  placeholder: {
    width: 36,
  },
  form: {
    paddingHorizontal: 20,
    paddingTop: 30,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 50,
  },
  inputIcon: {
    marginRight: 12,
    width: 20,
  },
  input: {
    flex: 1,
    fontSize: 16,
  },
  inputText: {
    flex: 1,
    fontSize: 16,
  },
  helpText: {
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
  unitText: {
    fontSize: 14,
    marginLeft: 8,
    fontWeight: '500',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 16,
    marginHorizontal: 20,
    marginTop: 30,
    marginBottom: 20,
  },
  buttonIcon: {
    marginRight: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

