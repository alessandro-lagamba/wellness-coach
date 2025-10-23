import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AuthService } from '../../services/auth.service';

interface SignupScreenProps {
  onSignupSuccess: (user: any) => void;
  onNavigateToLogin: () => void;
}

export const SignupScreen: React.FC<SignupScreenProps> = ({
  onSignupSuccess,
  onNavigateToLogin,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other' | 'prefer_not_to_say'>('prefer_not_to_say');
  const [isLoading, setIsLoading] = useState(false);

  const validateForm = () => {
    if (!email || !password || !confirmPassword || !firstName || !lastName) {
      Alert.alert('Errore', 'Compila tutti i campi obbligatori');
      return false;
    }

    if (password !== confirmPassword) {
      Alert.alert('Errore', 'Le password non coincidono');
      return false;
    }

    if (password.length < 6) {
      Alert.alert('Errore', 'La password deve essere di almeno 6 caratteri');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Errore', 'Inserisci un indirizzo email valido');
      return false;
    }

    return true;
  };

  const handleSignup = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const { user, error } = await AuthService.signUp(email, password, `${firstName} ${lastName}`);
      
      if (error) {
        Alert.alert('Errore Registrazione', error.message || 'Errore durante la registrazione');
        return;
      }

      if (user) {
        // Aggiorna il profilo con i dati aggiuntivi
        await AuthService.updateUserProfile(user.id, {
          first_name: firstName,
          last_name: lastName,
          full_name: `${firstName} ${lastName}`,
          age: age ? parseInt(age) : undefined,
          gender: gender,
        });

        Alert.alert(
          'Registrazione Completata',
          'Controlla la tua email per confermare l\'account',
          [
            {
              text: 'OK',
              onPress: () => onSignupSuccess(user),
            },
          ]
        );
      }
    } catch (error) {
      Alert.alert('Errore', 'Si è verificato un errore durante la registrazione');
    } finally {
      setIsLoading(false);
    }
  };

  const GenderButton: React.FC<{
    value: 'male' | 'female' | 'other' | 'prefer_not_to_say';
    label: string;
    onPress: () => void;
  }> = ({ value, label, onPress }) => (
    <TouchableOpacity
      style={[
        styles.genderButton,
        gender === value && styles.genderButtonSelected,
      ]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.genderButtonText,
          gender === value && styles.genderButtonTextSelected,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        style={styles.gradient}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.content}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Crea Account</Text>
              <Text style={styles.subtitle}>Inizia il tuo percorso di benessere</Text>
            </View>

            {/* Form */}
            <View style={styles.form}>
              {/* ROW: Nome + Cognome */}
              <View style={styles.row}>
                <View style={[styles.inputContainer, styles.halfWidth]}>
                  <Text style={styles.inputLabel}>Nome *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Nome"
                    placeholderTextColor="#999"
                    value={firstName}
                    onChangeText={setFirstName}
                    autoCapitalize="words"
                  />
                </View>

                <View style={[styles.inputContainer, styles.halfWidth]}>
                  <Text style={styles.inputLabel}>Cognome *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Cognome"
                    placeholderTextColor="#999"
                    value={lastName}
                    onChangeText={setLastName}
                    autoCapitalize="words"
                  />
                </View>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Email *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Inserisci la tua email"
                  placeholderTextColor="#999"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Età</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Inserisci la tua età"
                  placeholderTextColor="#999"
                  value={age}
                  onChangeText={setAge}
                  keyboardType="numeric"
                  maxLength={3}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Genere</Text>
                <View style={styles.genderContainer}>
                  <GenderButton
                    value="male"
                    label="Uomo"
                    onPress={() => setGender('male')}
                  />
                  <GenderButton
                    value="female"
                    label="Donna"
                    onPress={() => setGender('female')}
                  />
                  <GenderButton
                    value="other"
                    label="Altro"
                    onPress={() => setGender('other')}
                  />
                  <GenderButton
                    value="prefer_not_to_say"
                    label="Preferisco non dire"
                    onPress={() => setGender('prefer_not_to_say')}
                  />
                </View>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Password *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Crea una password sicura"
                  placeholderTextColor="#999"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Conferma Password *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Conferma la tua password"
                  placeholderTextColor="#999"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <TouchableOpacity
                style={[styles.signupButton, isLoading && styles.signupButtonDisabled]}
                onPress={handleSignup}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.signupButtonText}>Registrati</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>Hai già un account?</Text>
              <TouchableOpacity onPress={onNavigateToLogin}>
                <Text style={styles.loginLink}>Accedi</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.9,
    textAlign: 'center',
  },
  form: {
    marginBottom: 30,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 20,
  },
  halfWidth: {
    width: '48%',
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#333',
  },
  genderContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  genderButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  genderButtonSelected: {
    backgroundColor: '#fff',
  },
  genderButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  genderButtonTextSelected: {
    color: '#667eea',
  },
  signupButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  signupButtonDisabled: {
    opacity: 0.7,
  },
  signupButtonText: {
    color: '#667eea',
    fontSize: 18,
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    color: '#fff',
    fontSize: 16,
    marginRight: 8,
  },
  loginLink: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
});
