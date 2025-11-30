import React, { useState, useEffect, useRef } from 'react';
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
  Animated,
  Dimensions,
  Modal,
  Keyboard,
  StatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { AuthService } from '../../services/auth.service';
import { useTranslation } from '../../hooks/useTranslation'; // 🆕 i18n
import { useTheme } from '../../contexts/ThemeContext'; // 🆕 Theme

const { width } = Dimensions.get('window');

interface AuthScreenProps {
  onAuthSuccess: (user: any) => void;
}

type AuthMode = 'login' | 'signup';

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthSuccess }) => {
  const { t } = useTranslation(); // 🆕 i18n hook
  const { mode: themeMode, colors } = useTheme(); // 🆕 Theme colors
  const [mode, setMode] = useState<AuthMode>('login');
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other' | 'prefer_not_to_say'>('prefer_not_to_say');

  const [isLoading, setIsLoading] = useState(false);
  const [showGenderModal, setShowGenderModal] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // --- Animazioni toggle / form
  const slideAnimation = useState(new Animated.Value(0))[0];
  const fadeAnimation = useState(new Animated.Value(1))[0];
  const formHeight = useState(new Animated.Value(200))[0];

  // Check for existing user on mount - NO BIOMETRIC CHECK HERE
  useEffect(() => {
    const checkExistingUser = async () => {
      try {
        // 🔥 FIX: Rimossi log eccessivi

        // Check if user is already authenticated
        const isAuth = await AuthService.isAuthenticated();
        const currentUser = await AuthService.getCurrentUser();

        if (isAuth && currentUser) {
          // User is authenticated, proceed directly to app
          onAuthSuccess(currentUser);
        }
      } catch (error) {
        console.error('❌ Error checking existing user:', error);
      }
    };

    checkExistingUser();
  }, []);

  // larghezza interna del toggle (serve per muovere l'indicatore senza numeri magici)
  const [toggleInnerW, setToggleInnerW] = useState(0);

  // Animazione per la tastiera
  const keyboardHeight = useState(new Animated.Value(0))[0];

  // Ref per ScrollView e gestione scroll intelligente
  const scrollViewRef = useRef<ScrollView>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeightValue, setKeyboardHeightValue] = useState(0);
  const [screenHeight, setScreenHeight] = useState(Dimensions.get('window').height);
  // No status bar side-effects here (original behavior)

  const validateForm = () => {
    if (!email || !password || (mode === 'signup' && (!firstName || !lastName))) {
      Alert.alert(t('auth.error'), t('auth.fillAllFields'));
      return false;
    }

    if (mode === 'signup') {
      if (password !== confirmPassword) {
        Alert.alert(t('auth.error'), t('auth.passwordsDoNotMatch'));
        return false;
      }
      if (password.length < 6) {
        Alert.alert(t('auth.error'), t('auth.passwordMinLength'));
        return false;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        Alert.alert(t('auth.error'), t('auth.invalidEmail'));
        return false;
      }
    }
    return true;
  };

  const handleAuth = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      if (mode === 'login') {
        const { user, error } = await AuthService.signIn(email, password, rememberMe);
        if (error) {
          Alert.alert(t('auth.loginError'), error.message || t('auth.invalidCredentials'));
          return;
        }
        if (user) {
          // 🔥 FIX: Rimuoviamo l'alert di successo - è ridondante, l'utente vede già che il login è riuscito
          // quando viene portato alla schermata principale. Questo rende il login più veloce e fluido.
          onAuthSuccess(user);
        }
      } else {
        // 🔥 FIX: Quando un utente si registra, resettiamo sempre onboarding e tutorial
        // Questo garantisce che ogni nuovo utente veda l'onboarding, anche se i flag sono già salvati in AsyncStorage
        const { OnboardingService } = await import('../../services/onboarding.service');
        await OnboardingService.resetOnboarding();
        console.log('🔄 Onboarding and tutorial reset for new signup');

        const { user, error } = await AuthService.signUp(email, password, `${firstName} ${lastName}`);
        if (error) {
          Alert.alert(t('auth.signupError'), error.message || t('auth.signupFailed'));
          return;
        }
        if (user) {
          // 🔥 FIX: Non creiamo il profilo durante la registrazione
          // Il profilo verrà creato automaticamente quando l'utente verifica l'email
          // I dati aggiuntivi (first_name, last_name, age, gender) vengono salvati
          // nei metadata dell'utente per essere applicati quando il profilo viene creato
          
          // Salva i dati aggiuntivi nei metadata dell'utente
          try {
            const { supabase } = await import('../../lib/supabase');
            await supabase.auth.updateUser({
              data: {
                full_name: `${firstName} ${lastName}`,
                first_name: firstName,
                last_name: lastName,
                age: age ? parseInt(age) : undefined,
                gender: gender,
              }
            });
            console.log('✅ User metadata saved for profile creation after email verification');
          } catch (metadataError) {
            console.warn('⚠️ Failed to save user metadata (non-critical):', metadataError);
            // Non blocchiamo la registrazione se il salvataggio dei metadata fallisce
          }

          Alert.alert(
            t('auth.signupCompleted'),
            t('auth.checkEmail'),
            [{ text: t('common.ok'), onPress: () => onAuthSuccess(user) }],
          );
        }
      }
    } catch {
      Alert.alert(t('common.error'), t('auth.operationError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      Alert.alert(t('common.error'), t('auth.enterEmailFirst'));
      return;
    }
    try {
      const { error } = await AuthService.resetPassword(email);
      if (error) {
        Alert.alert(t('common.error'), error.message || t('auth.resetPasswordError'));
        return;
      }
      Alert.alert(t('auth.emailSent'), t('auth.checkEmailForInstructions'));
    } catch {
      Alert.alert(t('common.error'), t('auth.genericError'));
    }
  };

  const switchMode = (newMode: AuthMode) => {
    // Evita animazioni multiple se già in corso
    if (mode === newMode) return;

    const newHeight = newMode === 'signup' ? 560 : 200;
    const slideValue = newMode === 'signup' ? 1 : 0;

    Animated.parallel([
      Animated.timing(fadeAnimation, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true
      }),
      Animated.timing(slideAnimation, {
        toValue: slideValue,
        duration: 300,
        useNativeDriver: true
      }),
      Animated.timing(formHeight, {
        toValue: newHeight,
        duration: 300,
        useNativeDriver: false
      }),
    ]).start(() => {
      setMode(newMode);
      Animated.timing(fadeAnimation, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true
      }).start();
    });
  };

  const getGenderLabel = (value: string) => {
    switch (value) {
      case 'male': return t('auth.gender.male');
      case 'female': return t('auth.gender.female');
      case 'other': return t('auth.gender.other');
      case 'prefer_not_to_say': return t('auth.gender.preferNotToSay');
      default: return t('auth.gender.select');
    }
  };

  const slideInterpolate = slideAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -30],
  });

  // Gestione eventi tastiera - solo per aggiornare lo stato
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (event) => {
        setKeyboardVisible(true);
        setKeyboardHeightValue(event.endCoordinates.height);
      }
    );

    const keyboardDidHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      (event) => {
        setKeyboardVisible(false);
        setKeyboardHeightValue(0);

        // Solo quando la tastiera si nasconde, torna in cima
        setTimeout(() => {
          scrollViewRef.current?.scrollTo({ y: 0, animated: true });
        }, Platform.OS === 'ios' ? event.duration || 250 : 100);
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  // Biometric capabilities check removed - only AuthWrapper handles biometrics

  // Funzione intelligente per gestire il focus degli input
  const handleInputFocus = (inputName: string) => {
    setIsKeyboardVisible(true);

    // Calcola se il campo è già visibile
    const availableHeight = screenHeight - keyboardHeightValue;
    const shouldScroll = shouldScrollToInput(inputName, availableHeight);

    if (shouldScroll) {
      setTimeout(() => {
        scrollToInput(inputName);
      }, Platform.OS === 'ios' ? 300 : 100);
    }
  };

  const handleInputBlur = () => {
    setIsKeyboardVisible(false);
  };

  // Determina se serve scroll per un input specifico
  const shouldScrollToInput = (inputName: string, availableHeight: number) => {
    // Altezza approssimativa dei campi prima dell'input target
    const fieldHeights = {
      'firstName': 0, // Primo campo, non serve scroll
      'lastName': 0, // Primo campo, non serve scroll
      'gender': 100, // Nome + cognome + spazio
      'age': 100, // Stesso livello di genere
      'email': mode === 'signup' ? 200 : 0, // Dipende dalla modalità
      'password': mode === 'signup' ? 300 : 100,
      'confirmPassword': 400
    };

    const fieldHeight = fieldHeights[inputName as keyof typeof fieldHeights] || 0;
    const headerHeight = 200; // Header + toggle
    const totalContentHeight = headerHeight + fieldHeight + 100; // +100 per il campo stesso

    return totalContentHeight > availableHeight;
  };

  // Scroll specifico per ogni input
  const scrollToInput = (inputName: string) => {
    const scrollPositions = {
      'firstName': 0,
      'lastName': 0,
      'gender': 50,
      'age': 50,
      'email': mode === 'signup' ? 150 : 0,
      'password': mode === 'signup' ? 250 : 100,
      'confirmPassword': 350
    };

    const scrollY = scrollPositions[inputName as keyof typeof scrollPositions] || 0;
    scrollViewRef.current?.scrollTo({ y: scrollY, animated: true });
  };

  const styles = createStyles(colors, themeMode);

  return (
    <View style={styles.container}>
      <StatusBar 
        translucent 
        backgroundColor="transparent" 
        barStyle={themeMode === 'dark' ? 'light-content' : 'dark-content'} 
      />
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={[
            styles.scrollContainer,
            { paddingTop: Math.max(insets.top, 24) + 24 },
            keyboardVisible && { paddingBottom: keyboardHeightValue + 20 }
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={true}
        >
          <View style={styles.content}>
            {/* Header */}
            <View style={styles.header}>
              <View style={[styles.logoContainer, { backgroundColor: colors.surface, shadowColor: colors.shadowColor }]}>
                <FontAwesome name="heart" size={32} color={colors.primary} />
              </View>
              <Text style={[styles.title, { color: colors.text }]}>{mode === 'login' ? t('auth.welcome') : t('auth.createAccount')}</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {mode === 'login' ? t('auth.loginSubtitle') : t('auth.signupSubtitle')}
              </Text>
            </View>

            {/* Toggle */}
            <View style={styles.toggleContainer}>
              <View
                style={styles.toggleBackground}
                onLayout={(e) => {
                  // larghezza effettiva disponibile per l’indicatore (tolto padding 6+6)
                  setToggleInnerW(e.nativeEvent.layout.width - 12);
                }}
              >
                <Animated.View
                  style={[
                    styles.toggleIndicator,
                    {
                      width: toggleInnerW / 2,
                      transform: [{
                        translateX: slideAnimation.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, toggleInnerW / 2],
                        }),
                      }],
                    },
                  ]}
                />
                <TouchableOpacity style={styles.toggleButton} onPress={() => switchMode('login')}>
                  <Text style={[
                    styles.toggleText, 
                    { color: mode === 'login' ? colors.primary : colors.textSecondary }
                  ]}>{t('auth.login')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.toggleButton} onPress={() => switchMode('signup')}>
                  <Text style={[
                    styles.toggleText, 
                    { color: mode === 'signup' ? colors.primary : colors.textSecondary }
                  ]}>{t('auth.signup')}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Form */}
            <Animated.View style={[styles.formContainer, { minHeight: formHeight }]}>
              <Animated.View style={[styles.form, { opacity: fadeAnimation, transform: [{ translateY: slideInterpolate }] }]}>
                {mode === 'signup' && (
                  <>
                    {/* ROW: Nome + Cognome */}
                    <View style={styles.row}>
                      <View style={[styles.inputContainer, styles.halfWidth]}>
                        <Text style={styles.inputLabel}>{t('auth.firstName')} *</Text>
                        <View style={styles.inputWrapperTransparent}>
                          <FontAwesome name="user" size={16} color={colors.textSecondary} style={styles.inputIcon} />
                          <TextInput
                            style={styles.inputTransparent}
                            placeholder={t('auth.firstName')}
                            placeholderTextColor={colors.textTertiary}
                            value={firstName}
                            onChangeText={setFirstName}
                            autoCapitalize="words"
                            onFocus={() => handleInputFocus('firstName')}
                            onBlur={handleInputBlur}
                          />
                        </View>
                      </View>

                      <View style={[styles.inputContainer, styles.halfWidth]}>
                        <Text style={styles.inputLabel}>{t('auth.lastName')} *</Text>
                        <View style={styles.inputWrapperTransparent}>
                          <FontAwesome name="user" size={16} color={colors.textSecondary} style={styles.inputIcon} />
                          <TextInput
                            style={styles.inputTransparent}
                            placeholder={t('auth.lastName')}
                            placeholderTextColor={colors.textTertiary}
                            value={lastName}
                            onChangeText={setLastName}
                            autoCapitalize="words"
                            onFocus={() => handleInputFocus('lastName')}
                            onBlur={handleInputBlur}
                          />
                        </View>
                      </View>
                    </View>

                    {/* ROW: Genere + Età */}
                    <View style={styles.row}>
                      <View style={[styles.inputContainer, styles.fieldHalf, { marginBottom: 0 }]}>
                        <Text style={styles.inputLabel}>{t('auth.gender.label')}</Text>
                        <TouchableOpacity style={styles.inputWrapperTransparent} onPress={() => setShowGenderModal(true)}>
                          <FontAwesome name="venus-mars" size={16} color={colors.textSecondary} style={styles.inputIcon} />
                          <Text style={[styles.inputTransparent, { color: colors.text }]}>
                            {getGenderLabel(gender)}
                          </Text>
                          <FontAwesome name="chevron-down" size={14} color={colors.textTertiary} />
                        </TouchableOpacity>
                      </View>

                      <View style={[styles.inputContainer, styles.fieldHalf, { marginBottom: 0 }]}>
                        <Text style={styles.inputLabel}>{t('auth.age')}</Text>
                        <View style={styles.inputWrapperTransparent}>
                          <FontAwesome name="calendar" size={16} color={colors.textSecondary} style={styles.inputIcon} />
                          <TextInput
                            style={styles.inputTransparent}
                            placeholder={t('auth.agePlaceholder')}
                            placeholderTextColor={colors.textTertiary}
                            value={age}
                            onChangeText={setAge}
                            keyboardType="numeric"
                            maxLength={3}
                            onFocus={() => handleInputFocus('age')}
                            onBlur={handleInputBlur}
                          />
                        </View>
                      </View>
                    </View>
                  </>
                )}

                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>{t('auth.email')} *</Text>
                  <View style={styles.inputWrapperTransparent}>
                    <FontAwesome name="envelope" size={16} color={colors.textSecondary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.inputTransparent}
                      placeholder={t('auth.emailPlaceholder')}
                      placeholderTextColor={colors.textTertiary}
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      onFocus={() => handleInputFocus('email')}
                      onBlur={handleInputBlur}
                    />
                  </View>
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>{t('auth.password')} *</Text>
                  <View style={styles.inputWrapperTransparent}>
                    <FontAwesome name="lock" size={16} color={colors.textSecondary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.inputTransparent}
                      placeholder={mode === 'login' ? t('auth.passwordPlaceholder') : t('auth.passwordPlaceholderSignup')}
                      placeholderTextColor={colors.textTertiary}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                      autoCapitalize="none"
                      autoCorrect={false}
                      onFocus={() => handleInputFocus('password')}
                      onBlur={handleInputBlur}
                    />
                  </View>
                </View>

                {mode === 'login' && (
                  <View style={styles.rememberMeContainer}>
                    <TouchableOpacity
                      style={styles.rememberMeCheckbox}
                      onPress={() => setRememberMe(!rememberMe)}
                    >
                      <View style={[
                        styles.checkbox,
                        rememberMe && styles.checkboxChecked
                      ]}>
                        {rememberMe && (
                          <FontAwesome name="check" size={12} color={colors.textInverse} />
                        )}
                      </View>
                      <Text style={styles.rememberMeText}>{t('auth.rememberMe')}</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {mode === 'signup' && (
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>{t('auth.confirmPassword')} *</Text>
                    <View style={styles.inputWrapperTransparent}>
                      <FontAwesome name="lock" size={16} color={colors.textSecondary} style={styles.inputIcon} />
                      <TextInput
                        style={styles.inputTransparent}
                        placeholder={t('auth.confirmPasswordPlaceholder')}
                        placeholderTextColor={colors.textTertiary}
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        secureTextEntry
                        autoCapitalize="none"
                        autoCorrect={false}
                        onFocus={() => handleInputFocus('confirmPassword')}
                        onBlur={handleInputBlur}
                      />
                    </View>
                  </View>
                )}

                {mode === 'login' && (
                  <TouchableOpacity style={styles.forgotPassword} onPress={handleForgotPassword}>
                    <Text style={styles.forgotPasswordText}>{t('auth.forgotPassword')}</Text>
                  </TouchableOpacity>
                )}
              </Animated.View>
            </Animated.View>

            {/* Biometric Login Button - REMOVED: Only AuthWrapper handles biometrics for authenticated users */}

            {/* Button */}
            <TouchableOpacity style={[styles.authButton, isLoading && styles.authButtonDisabled]} onPress={handleAuth} disabled={isLoading}>
              {isLoading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <FontAwesome name={mode === 'login' ? 'sign-in' : 'user-plus'} size={18} color="#ffffff" style={styles.buttonIcon} />
                  <Text style={styles.authButtonText}>{mode === 'login' ? t('auth.login') : t('auth.signup')}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Modal Genere */}
        <Modal visible={showGenderModal} transparent animationType="fade" onRequestClose={() => setShowGenderModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t('auth.gender.selectTitle')}</Text>
                <TouchableOpacity onPress={() => setShowGenderModal(false)} style={styles.modalCloseButton}>
                  <FontAwesome name="times" size={20} color="#666" />
                </TouchableOpacity>
              </View>

              <View style={styles.genderOptions}>
                {[
                  { value: 'male', label: t('auth.gender.male'), icon: 'male' },
                  { value: 'female', label: t('auth.gender.female'), icon: 'female' },
                  { value: 'other', label: t('auth.gender.other'), icon: 'question' },
                  { value: 'prefer_not_to_say', label: t('auth.gender.preferNotToSay'), icon: 'eye-slash' },
                ].map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.genderOption, gender === option.value && styles.genderOptionSelected]}
                    onPress={() => {
                      setGender(option.value as any);
                      setShowGenderModal(false);
                    }}
                  >
                    <FontAwesome name={option.icon as any} size={20} color={gender === option.value ? colors.primary : colors.textTertiary} style={styles.genderOptionIcon} />
                    <Text style={[styles.genderOptionText, gender === option.value && styles.genderOptionTextSelected]}>
                      {option.label}
                    </Text>
                    {gender === option.value && <FontAwesome name="check" size={16} color={colors.primary} />}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
};

// Styles dinamici basati sul tema
const createStyles = (colors: any, themeMode: 'light' | 'dark') => StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: colors.background,
  },
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    paddingBottom: 40, // Extra padding per la tastiera
    minHeight: '100%'
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
    paddingBottom: 20, // Padding extra per evitare che i campi vengano nascosti
  },

  header: { alignItems: 'center', marginBottom: 40 },
  logoContainer: {
    width: 80, height: 80, borderRadius: 40, marginBottom: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.shadowColor, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 12,
  },
  title: { fontSize: 32, fontWeight: 'bold', color: colors.text, marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 16, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },

  // --- Toggle
  toggleContainer: { marginBottom: 50, alignItems: 'center' },
  toggleBackground: {
    flexDirection: 'row',
    backgroundColor: themeMode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
    borderRadius: 30,
    paddingHorizontal: 6,
    width: 300,
    height: 60,
    position: 'relative',
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  toggleIndicator: {
    position: 'absolute',
    top: 6,
    bottom: 6,
    left: 6,
    backgroundColor: colors.surface,
    borderRadius: 24,
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  toggleButton: { flex: 1, height: '100%', justifyContent: 'center', alignItems: 'center', zIndex: 1 },
  toggleText: { fontSize: 16, fontWeight: '600' },

  // --- Form
  formContainer: { marginBottom: 20, flexShrink: 1 },
  form: { paddingBottom: 20 },

  // riga con due campi
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 20 },
  fieldHalf: { width: '48%' },
  halfWidth: { width: '48%' },

  inputContainer: { marginBottom: 20 },
  inputLabel: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 8 },

  // INPUT con tema
  inputWrapperTransparent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: themeMode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 4,
    height: 56,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputIcon: { marginRight: 12, width: 16 },
  inputTransparent: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
  },

  forgotPassword: { alignSelf: 'flex-end', marginBottom: 20 },
  forgotPasswordText: { color: colors.primary, fontSize: 14, textDecorationLine: 'underline', fontWeight: '500' },

  // Button
  authButton: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 12,
  },
  authButtonDisabled: { opacity: 0.7 },
  buttonIcon: { marginRight: 8 },
  authButtonText: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: {
    backgroundColor: colors.surface, borderRadius: 20, paddingTop: 20, paddingBottom: 40, paddingHorizontal: 20, maxHeight: '60%', width: '90%',
    shadowColor: colors.shadowColor, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 20,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: colors.text },
  modalCloseButton: { padding: 8 },
  genderOptions: { paddingTop: 20 },
  genderOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 16, borderRadius: 12, marginBottom: 8, backgroundColor: colors.surfaceMuted },
  genderOptionSelected: { backgroundColor: colors.primaryMuted },
  genderOptionIcon: { marginRight: 12, width: 20 },
  genderOptionText: { flex: 1, fontSize: 16, color: colors.text },
  genderOptionTextSelected: { color: colors.primary, fontWeight: '600' },

  // Remember Me
  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  rememberMeCheckbox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  rememberMeText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },

  // Biometric Button
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  biometricButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  biometricButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    opacity: 0.6,
  },
  biometricButtonTextDisabled: {
    color: '#999',
  },
});
