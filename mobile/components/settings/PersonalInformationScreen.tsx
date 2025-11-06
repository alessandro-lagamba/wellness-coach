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

interface PersonalInformationScreenProps {
  user: User;
  onBack: () => void;
}

export const PersonalInformationScreen: React.FC<PersonalInformationScreenProps> = ({
  user,
  onBack,
}) => {
  const { t } = useTranslation(); // 🆕 i18n hook
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
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text style={styles.loadingText}>{t('profile.loading')}</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <FontAwesome name="arrow-left" size={20} color="#8B5CF6" />
          </TouchableOpacity>
          <Text style={styles.title}>{t('profile.title')}</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Nome Completo */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('profile.fullName')}</Text>
            <View style={styles.inputWrapper}>
              <FontAwesome name="user" size={16} color="#8B5CF6" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={profile.full_name}
                onChangeText={(text) => setProfile({ ...profile, full_name: text })}
                placeholder={t('profile.fullNamePlaceholder')}
                placeholderTextColor="#9CA3AF"
              />
            </View>
          </View>

          {/* Email */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <View style={[styles.inputWrapper, styles.disabledInput]}>
              <FontAwesome name="envelope" size={16} color="#9CA3AF" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, styles.disabledText]}
                value={profile.email}
                editable={false}
                placeholder={t('auth.email')}
                placeholderTextColor="#9CA3AF"
              />
            </View>
            <Text style={styles.helpText}>{t('profile.emailCannotBeChanged')}</Text>
          </View>

          {/* Età */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('auth.age')}</Text>
            <View style={styles.inputWrapper}>
              <FontAwesome name="calendar" size={16} color="#8B5CF6" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={profile.age}
                onChangeText={(text) => setProfile({ ...profile, age: text })}
                placeholder={t('auth.agePlaceholder')}
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
                maxLength={3}
              />
            </View>
          </View>

          {/* Genere */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('auth.gender.label')}</Text>
            <TouchableOpacity 
              style={styles.inputWrapper}
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
              <FontAwesome name="venus-mars" size={16} color="#8B5CF6" style={styles.inputIcon} />
              <Text style={styles.inputText}>{getGenderLabel(profile.gender)}</Text>
              <FontAwesome name="chevron-down" size={14} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          {/* Peso */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('profile.weight')}</Text>
            <View style={styles.inputWrapper}>
              <FontAwesome name="balance-scale" size={16} color="#8B5CF6" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={profile.weight}
                onChangeText={(text) => setProfile({ ...profile, weight: text })}
                placeholder={t('profile.weightPlaceholder')}
                placeholderTextColor="#9CA3AF"
                keyboardType="decimal-pad"
              />
              <Text style={styles.unitText}>kg</Text>
            </View>
          </View>

          {/* Altezza */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('profile.height')}</Text>
            <View style={styles.inputWrapper}>
              <FontAwesome name="ruler-vertical" size={16} color="#8B5CF6" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={profile.height}
                onChangeText={(text) => setProfile({ ...profile, height: text })}
                placeholder={t('profile.heightPlaceholder')}
                placeholderTextColor="#9CA3AF"
                keyboardType="decimal-pad"
              />
              <Text style={styles.unitText}>cm</Text>
            </View>
          </View>

          {/* Livello di Attività */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('profile.activityLevel')}</Text>
            <TouchableOpacity 
              style={styles.inputWrapper}
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
              <FontAwesome name="tachometer" size={16} color="#8B5CF6" style={styles.inputIcon} />
              <Text style={styles.inputText}>{getActivityLevelLabel(profile.activity_level)}</Text>
              <FontAwesome name="chevron-down" size={14} color="#9CA3AF" />
            </TouchableOpacity>
            <Text style={styles.helpText}>{t('profile.activityLevelHelp')}</Text>
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity 
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]} 
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <FontAwesome name="save" size={16} color="#FFFFFF" style={styles.buttonIcon} />
              <Text style={styles.saveButtonText}>{t('profile.saveChanges')}</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
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
    borderBottomColor: '#F3F4F6',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
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
    color: '#374151',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 50,
  },
  disabledInput: {
    backgroundColor: '#F3F4F6',
    borderColor: '#D1D5DB',
  },
  inputIcon: {
    marginRight: 12,
    width: 20,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
  },
  disabledText: {
    color: '#9CA3AF',
  },
  inputText: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
  },
  helpText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    fontStyle: 'italic',
  },
  unitText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
    fontWeight: '500',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8B5CF6',
    borderRadius: 12,
    paddingVertical: 16,
    marginHorizontal: 20,
    marginTop: 30,
    marginBottom: 20,
  },
  saveButtonDisabled: {
    backgroundColor: '#A78BFA',
  },
  buttonIcon: {
    marginRight: 8,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

