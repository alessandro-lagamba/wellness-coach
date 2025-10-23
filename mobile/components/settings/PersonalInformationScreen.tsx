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

interface PersonalInformationScreenProps {
  user: User;
  onBack: () => void;
}

export const PersonalInformationScreen: React.FC<PersonalInformationScreenProps> = ({
  user,
  onBack,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [profile, setProfile] = useState({
    full_name: '',
    email: '',
    age: '',
    gender: 'prefer_not_to_say' as 'male' | 'female' | 'prefer_not_to_say',
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
        });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      Alert.alert('Errore', 'Impossibile caricare il profilo');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!profile.full_name.trim()) {
      Alert.alert('Errore', 'Il nome completo è obbligatorio');
      return;
    }

    setIsSaving(true);
    try {
      await AuthService.updateUserProfile(user.id, {
        full_name: profile.full_name.trim(),
        age: profile.age ? parseInt(profile.age) : undefined,
        gender: profile.gender,
      });

      Alert.alert('Successo', 'Profilo aggiornato con successo', [
        { text: 'OK', onPress: onBack }
      ]);
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Errore', 'Impossibile aggiornare il profilo');
    } finally {
      setIsSaving(false);
    }
  };

  const getGenderLabel = (gender: string) => {
    switch (gender) {
      case 'male':
        return 'Maschio';
      case 'female':
        return 'Femmina';
      default:
        return 'Preferisco non dire';
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text style={styles.loadingText}>Caricamento profilo...</Text>
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
          <Text style={styles.title}>Informazioni Personali</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Nome Completo */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nome Completo</Text>
            <View style={styles.inputWrapper}>
              <FontAwesome name="user" size={16} color="#8B5CF6" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={profile.full_name}
                onChangeText={(text) => setProfile({ ...profile, full_name: text })}
                placeholder="Inserisci il tuo nome completo"
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
                placeholder="Email"
                placeholderTextColor="#9CA3AF"
              />
            </View>
            <Text style={styles.helpText}>L'email non può essere modificata</Text>
          </View>

          {/* Età */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Età</Text>
            <View style={styles.inputWrapper}>
              <FontAwesome name="calendar" size={16} color="#8B5CF6" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={profile.age}
                onChangeText={(text) => setProfile({ ...profile, age: text })}
                placeholder="Inserisci la tua età"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
                maxLength={3}
              />
            </View>
          </View>

          {/* Genere */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Genere</Text>
            <TouchableOpacity 
              style={styles.inputWrapper}
              onPress={() => {
                Alert.alert(
                  'Seleziona Genere',
                  'Scegli il tuo genere',
                  [
                    { text: 'Maschio', onPress: () => setProfile({ ...profile, gender: 'male' }) },
                    { text: 'Femmina', onPress: () => setProfile({ ...profile, gender: 'female' }) },
                    { text: 'Preferisco non dire', onPress: () => setProfile({ ...profile, gender: 'prefer_not_to_say' }) },
                    { text: 'Annulla', style: 'cancel' }
                  ]
                );
              }}
            >
              <FontAwesome name="venus-mars" size={16} color="#8B5CF6" style={styles.inputIcon} />
              <Text style={styles.inputText}>{getGenderLabel(profile.gender)}</Text>
              <FontAwesome name="chevron-down" size={14} color="#9CA3AF" />
            </TouchableOpacity>
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
              <Text style={styles.saveButtonText}>Salva Modifiche</Text>
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

