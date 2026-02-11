import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
  Animated,
  Dimensions,
  StatusBar,
  Image,
  Modal,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Svg, {
  Defs,
  RadialGradient,
  LinearGradient,
  Rect,
  Stop,
  Circle,
  G
} from 'react-native-svg';
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from 'react-native-reanimated';
import { useKeyboardHandler } from 'react-native-keyboard-controller';
import { AuthService } from '../../services/auth.service';
import { useTranslation } from '../../hooks/useTranslation';
import { useTheme } from '../../contexts/ThemeContext';
import { TimeMachineCalendar } from '../TimeMachineCalendar';

const { width, height } = Dimensions.get('window');

interface AuthScreenProps {
  onAuthSuccess: (user: any) => void;
}

type AuthMode = 'login' | 'signup';
type GenderOption = 'female' | 'male' | 'non_binary' | 'prefer_not_to_say';

const MINIMUM_AGE = 16;
const GDPR_BLOCK_MESSAGE = "In conformità alla normativa vigente in materia di protezione dei dati personali, l’utilizzo dell’app è consentito esclusivamente a utenti di età pari o superiore a 16 anni. Non è possibile dunque procedere con la registrazione";
const TERMS_URL = 'https://www.yachai.net/terms';
const PRIVACY_URL = 'https://www.yachai.net/privacy';
const CONSENT_VERSION = '2026-02-11-v1';

// --- Components ---

const MeshBackground = ({ mode }: { mode: 'light' | 'dark' }) => {
  // Base background from root layout to ensure seamlessness at the top
  // Using pure white for light mode to match system bars, Slate-950 for dark
  const bgBase = mode === 'dark' ? '#0f172a' : '#ffffff';

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Base Color always behind to avoid any bleed */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: bgBase }]} />

      <Svg height="100%" width="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          {/* Main vertical gradient: Truly transparent at top -> Colored at bottom */}
          <LinearGradient id="mainGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={bgBase} stopOpacity="0" />
            <Stop offset="60%" stopColor={mode === 'dark' ? '#1e1b4b' : '#ede9fe'} stopOpacity="0.5" />
            <Stop offset="100%" stopColor={mode === 'dark' ? '#312e81' : '#ddd6fe'} stopOpacity="1" />
          </LinearGradient>

          {/* Accent glow at bottom right for depth */}
          <RadialGradient id="bottomAccent" cx="100%" cy="100%" rx="60%" ry="50%" fx="100%" fy="100%">
            <Stop offset="0%" stopColor={mode === 'dark' ? '#4338ca' : '#c4b5fd'} stopOpacity="0.3" />
            <Stop offset="100%" stopColor={bgBase} stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* Fill the whole screen with the vertical fade */}
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#mainGrad)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#bottomAccent)" />
      </Svg>
    </View>
  );
};

// Refined Premium Logo with Meditating Image and Ethereal Glow
const PetalLogo = () => {
  const { mode } = useTheme();

  // Theme-aware colors
  const primaryGlow = mode === 'dark' ? '#8B5CF6' : '#A78BFA';

  return (
    <View style={{ width: 160, height: 160, alignItems: 'center', justifyContent: 'center' }}>
      {/* 
          Dynamic SVG Glow - Single Layer for maximum softness
          Increased SVG size to ensure the gradient doesn't clip at the edges
      */}
      <Svg height="320" width="320" style={{ position: 'absolute' }}>
        <Defs>
          <RadialGradient id="mainGlow" cx="50%" cy="50%" rx="50%" ry="50%" fx="50%" fy="50%">
            <Stop offset="0%" stopColor={primaryGlow} stopOpacity={mode === 'dark' ? "0.5" : "0.4"} />
            <Stop offset="100%" stopColor={primaryGlow} stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* Ethereal Aura - Single large circle with gradient */}
        <Circle cx="160" cy="160" r="120" fill="url(#mainGlow)" />
      </Svg>

      {/* Meditating Image - Zentered in the aura */}
      <Image
        source={require('../../assets/images/yachai-variants/meditating.png')}
        style={{
          width: 110,
          height: 110,
          resizeMode: 'contain',
          zIndex: 10
        }}
      />
    </View>
  );
};


export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthSuccess }) => {
  const { t } = useTranslation();
  const { mode: themeMode } = useTheme();

  const [mode, setMode] = useState<AuthMode>('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState<GenderOption | null>(null);
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [showGenderModal, setShowGenderModal] = useState(false);
  const [showBirthDateCalendar, setShowBirthDateCalendar] = useState(false);
  const [termsConsentAccepted, setTermsConsentAccepted] = useState(false);
  const [healthConsentAccepted, setHealthConsentAccepted] = useState(false);

  // Password visibility state
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Theme-derived colors for Inputs to be perfectly "clean"
  const inputBg = themeMode === 'dark' ? '#1E293B' : '#FFFFFF';
  const inputBorder = themeMode === 'dark' ? '#334155' : '#E2E8F0';
  const placeholderColor = themeMode === 'dark' ? '#94A3B8' : '#CBD5E1';
  const textColor = themeMode === 'dark' ? '#F8FAFC' : '#0F172A';
  const iconColor = themeMode === 'dark' ? '#94A3B8' : '#94A3B8';

  // Toggle Colors - More differentiation
  // Inactive bg slightly darker than container to look "pressed in" or just separate
  const toggleContainerBg = themeMode === 'dark' ? '#0f172a' : '#E2E8F0';
  const toggleContainerBorder = themeMode === 'dark' ? '#334155' : '#CBD5E1';
  const toggleActiveBg = themeMode === 'dark' ? '#1E293B' : '#FFFFFF';
  const toggleInactiveText = themeMode === 'dark' ? '#64748B' : '#64748B';
  const toggleActiveText = themeMode === 'dark' ? '#F8FAFC' : '#0F172A'; // Dark/Black for active on light

  // Header Text Colors
  const headerTitleColor = themeMode === 'dark' ? '#F8FAFC' : '#0F172A';

  // Animations
  const fadeAnimation = useRef(new Animated.Value(1)).current;
  const slideAnimation = useRef(new Animated.Value(0)).current;

  // Check for existing user
  useEffect(() => {
    const checkExistingUser = async () => {
      try {
        const isAuth = await AuthService.isAuthenticated();
        const currentUser = await AuthService.getCurrentUser();
        if (isAuth && currentUser) {
          onAuthSuccess(currentUser);
        }
      } catch (error) {
        console.error('Error checking existing user:', error);
      }
    };
    checkExistingUser();
  }, []);

  const calculateAge = (date: Date): number => {
    const today = new Date();
    let age = today.getFullYear() - date.getFullYear();
    const monthDelta = today.getMonth() - date.getMonth();
    const hasHadBirthday =
      monthDelta > 0 || (monthDelta === 0 && today.getDate() >= date.getDate());
    if (!hasHadBirthday) age -= 1;
    return age;
  };

  const formatBirthDate = (date: Date | null): string => {
    if (!date) return 'Seleziona data';
    return date.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const genderOptions: Array<{ value: GenderOption; label: string }> = [
    { value: 'female', label: 'Donna' },
    { value: 'male', label: 'Uomo' },
    { value: 'non_binary', label: 'Non binario' },
    { value: 'prefer_not_to_say', label: 'Preferisco non dirlo' },
  ];
  const selectedGenderLabel =
    genderOptions.find((option) => option.value === gender)?.label ?? 'Seleziona';
  const currentYear = new Date().getFullYear();
  const birthYearStart = currentYear - 100;
  const birthYearEnd = currentYear;
  const birthCalendarYearRange: any = {
    yearStart: birthYearStart,
    yearEnd: birthYearEnd,
  };
  const isSignupButtonEnabled = mode === 'signup'
    ? termsConsentAccepted && healthConsentAccepted
    : true;

  // Keyboard handling (reanimated)
  const keyboardHeight = useSharedValue(0);

  useKeyboardHandler(
    {
      onMove: (event) => {
        'worklet';
        keyboardHeight.value = event.height;
      },
    },
    []
  );

  const fakeViewStyle = useAnimatedStyle(() => ({
    height: Math.abs(keyboardHeight.value),
  }));

  const switchMode = (newMode: AuthMode) => {
    if (mode === newMode) return;
    if (newMode === 'login') {
      setShowGenderModal(false);
      setShowBirthDateCalendar(false);
      setTermsConsentAccepted(false);
      setHealthConsentAccepted(false);
    }

    Animated.parallel([
      Animated.timing(fadeAnimation, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnimation, {
        toValue: newMode === 'signup' ? 1 : 0,
        duration: 300,
        useNativeDriver: true,
      })
    ]).start(() => {
      setMode(newMode);
      Animated.timing(fadeAnimation, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    });
  };

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert(t('auth.error'), t('auth.fillAllFields'));
      return;
    }
    if (mode === 'signup' && (!firstName || !lastName || !gender || !birthDate || password !== confirmPassword)) {
      Alert.alert(t('auth.error'), t('auth.fillAllFields'));
      return;
    }
    if (mode === 'signup' && (!termsConsentAccepted || !healthConsentAccepted)) {
      Alert.alert(
        'Consenso richiesto',
        "Per completare la registrazione devi accettare sia i Termini e Condizioni/Privacy sia il consenso al trattamento dei dati salute."
      );
      return;
    }
    if (mode === 'signup' && birthDate) {
      const age = calculateAge(birthDate);
      if (age < MINIMUM_AGE) {
        Alert.alert('Registrazione non consentita', GDPR_BLOCK_MESSAGE);
        return;
      }
    }

    setIsLoading(true);
    try {
      if (mode === 'login') {
        const { user, error } = await AuthService.signIn(email, password, rememberMe);
        if (error) {
          let msg = error.message;
          if (msg.includes('Invalid login credentials')) msg = t('auth.wrongCredentials');
          Alert.alert(t('auth.loginError'), msg);
        } else if (user) {
          onAuthSuccess(user);
        }
      } else {
        const computedAge = birthDate ? calculateAge(birthDate) : undefined;
        const birthDateISO = birthDate
          ? new Date(Date.UTC(birthDate.getFullYear(), birthDate.getMonth(), birthDate.getDate()))
            .toISOString()
            .split('T')[0]
          : undefined;

        const consentAcceptedAt = new Date().toISOString();
        const consentIp = await AuthService.getPublicIpAddress();

        const { user, error } = await AuthService.signUpWithMetadata(email, password, {
          first_name: firstName,
          last_name: lastName,
          full_name: `${firstName} ${lastName}`,
          age: computedAge,
          gender,
          birth_date: birthDateISO,
          terms_consent_accepted: true,
          terms_consent_accepted_at: consentAcceptedAt,
          terms_consent_ip: consentIp,
          health_consent_accepted: true,
          health_consent_accepted_at: consentAcceptedAt,
          health_consent_ip: consentIp,
          consent_version: CONSENT_VERSION,
        });
        if (error) {
          Alert.alert(t('auth.signupError'), error.message);
        } else if (user) {
          Alert.alert(t('auth.signupCompleted'), t('auth.checkEmail'), [
            { text: 'OK', onPress: () => onAuthSuccess(user) }
          ]);
        }
      }
    } catch {
      Alert.alert(t('common.error'), t('auth.operationError'));
    } finally {
      setIsLoading(false);
    }
  };

  const openExternalDocument = async (url: string, label: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert('Link non disponibile', `Impossibile aprire ${label} in questo momento.`);
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert('Errore', `Impossibile aprire ${label}. Riprova più tardi.`);
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'apple') => {
    setIsLoading(true);
    try {
      const { error, data } = await AuthService.signInWithOAuth(provider);
      if (data?.cancelled) {
        return;
      }
      if (data?.user) {
        onAuthSuccess(data.user);
        return;
      }
      if (error) {
        Alert.alert(
          'Social Login',
          error.message || 'Configurazione OAuth non valida.'
        );
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      Alert.alert(t('common.error'), t('auth.enterEmailFirst'));
      return;
    }
    await AuthService.resetPassword(email);
    Alert.alert(t('auth.emailSent'), t('auth.checkEmailForInstructions'));
  }


  return (
    <View style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle={themeMode === 'dark' ? 'light-content' : 'dark-content'} />
      <MeshBackground mode={themeMode === 'dark' ? 'dark' : 'light'} />

      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerContainer}>
            <PetalLogo />

            <Text style={[styles.titleText, { color: headerTitleColor }]}>
              {t('auth.welcomePrefix')}
              <Text style={styles.gradientText}>Yachai!</Text>
            </Text>
          </View>

          {/* Toggle Card - Improved Contrast */}
          <View style={[styles.toggleContainer, { backgroundColor: toggleContainerBg, borderColor: toggleContainerBorder }]}>
            <Animated.View style={[
              styles.toggleIndicator,
              {
                backgroundColor: toggleActiveBg,
                transform: [{
                  translateX: slideAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [2, (width - 48) / 2 - 2]
                  })
                }]
              }
            ]} />
            <TouchableOpacity style={styles.toggleBtn} onPress={() => switchMode('login')}>
              <Text style={[styles.toggleBtnText, { color: mode === 'login' ? toggleActiveText : toggleInactiveText }]}>Accedi</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.toggleBtn} onPress={() => switchMode('signup')}>
              <Text style={[styles.toggleBtnText, { color: mode === 'signup' ? toggleActiveText : toggleInactiveText }]}>Registrati</Text>
            </TouchableOpacity>
          </View>

          {/* Form */}
          <Animated.View style={[styles.formContainer, { opacity: fadeAnimation }]}>
            {mode === 'signup' && (
              <>
                <View style={styles.row}>
                  <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
                    <Text style={[styles.label, { color: iconColor }]}>NOME *</Text>
                    <View style={[styles.inputWrapper, { backgroundColor: inputBg, borderColor: inputBorder }]}>
                      <FontAwesome name="user" size={16} color={iconColor} style={{ marginRight: 10 }} />
                      <TextInput
                        style={[styles.input, { color: textColor }]}
                        placeholder="Nome"
                        placeholderTextColor={placeholderColor}
                        value={firstName}
                        onChangeText={setFirstName}
                      />
                    </View>
                  </View>
                  <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
                    <Text style={[styles.label, { color: iconColor }]}>COGNOME *</Text>
                    <View style={[styles.inputWrapper, { backgroundColor: inputBg, borderColor: inputBorder }]}>
                      <FontAwesome name="user" size={16} color={iconColor} style={{ marginRight: 10 }} />
                      <TextInput
                        style={[styles.input, { color: textColor }]}
                        placeholder="Cognome"
                        placeholderTextColor={placeholderColor}
                        value={lastName}
                        onChangeText={setLastName}
                      />
                    </View>
                  </View>
                </View>
                <View style={styles.inlineFieldsRow}>
                  <View style={[styles.inlineField, { marginRight: 8 }]}>
                    <Text style={[styles.label, { color: iconColor }]}>SESSO *</Text>
                    <TouchableOpacity
                      style={[styles.inputWrapper, { backgroundColor: inputBg, borderColor: inputBorder }]}
                      onPress={() => setShowGenderModal(true)}
                      activeOpacity={0.8}
                    >
                      <MaterialCommunityIcons name="account-outline" size={20} color={iconColor} style={{ marginRight: 10 }} />
                      <Text style={[styles.birthDateText, { color: gender ? textColor : placeholderColor }]}>
                        {selectedGenderLabel}
                      </Text>
                      <MaterialCommunityIcons name="chevron-down" size={20} color={iconColor} />
                    </TouchableOpacity>
                  </View>
                  <View style={[styles.inlineField, { marginLeft: 8 }]}>
                    <Text style={[styles.label, { color: iconColor }]}>DATA DI NASCITA *</Text>
                    <TouchableOpacity
                      style={[styles.inputWrapper, { backgroundColor: inputBg, borderColor: inputBorder }]}
                      onPress={() => setShowBirthDateCalendar(true)}
                      activeOpacity={0.8}
                    >
                      <MaterialCommunityIcons name="calendar-month-outline" size={20} color={iconColor} style={{ marginRight: 10 }} />
                      <Text style={[styles.birthDateText, { color: birthDate ? textColor : placeholderColor }]}>
                        {formatBirthDate(birthDate)}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            )}

            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: iconColor }]}>EMAIL *</Text>
              <View style={[styles.inputWrapper, { backgroundColor: inputBg, borderColor: inputBorder }]}>
                <MaterialCommunityIcons name="email-outline" size={20} color={iconColor} style={{ marginRight: 10 }} />
                <TextInput
                  style={[styles.input, { color: textColor }]}
                  placeholder="Inserisci la tua email"
                  placeholderTextColor={placeholderColor}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: iconColor }]}>PASSWORD *</Text>
              <View style={[styles.inputWrapper, { backgroundColor: inputBg, borderColor: inputBorder }]}>
                <MaterialCommunityIcons name="lock-outline" size={20} color={iconColor} style={{ marginRight: 10 }} />
                <TextInput
                  style={[styles.input, { color: textColor }]}
                  placeholder="Inserisci la tua password"
                  placeholderTextColor={placeholderColor}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <MaterialCommunityIcons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color={iconColor}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {mode === 'signup' && (
              <View style={styles.inputContainer}>
                <Text style={[styles.label, { color: iconColor }]}>CONFERMA PASSWORD *</Text>
                <View style={[styles.inputWrapper, { backgroundColor: inputBg, borderColor: inputBorder }]}>
                  <MaterialCommunityIcons name="lock-outline" size={20} color={iconColor} style={{ marginRight: 10 }} />
                  <TextInput
                    style={[styles.input, { color: textColor }]}
                    placeholder="Ripeti password"
                    placeholderTextColor={placeholderColor}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirmPassword}
                  />
                  <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <MaterialCommunityIcons
                      name={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
                      size={20}
                      color={iconColor}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {mode === 'signup' && (
              <View style={styles.consentContainer}>
                <TouchableOpacity
                  style={styles.consentRow}
                  activeOpacity={0.85}
                  onPress={() => setTermsConsentAccepted((prev) => !prev)}
                >
                  <View style={[styles.consentCheckbox, { borderColor: inputBorder }, termsConsentAccepted && styles.consentCheckboxChecked]}>
                    {termsConsentAccepted ? <MaterialCommunityIcons name="check" size={14} color="#fff" /> : null}
                  </View>
                  <View style={styles.consentTextWrap}>
                    <Text style={[styles.consentText, { color: textColor }]}>
                      Accetto i Termini e Condizioni d'uso e dichiaro di aver letto l'Informativa Privacy.
                    </Text>
                    <View style={styles.linksRow}>
                      <TouchableOpacity onPress={() => openExternalDocument(TERMS_URL, 'Termini e Condizioni')}>
                        <Text style={styles.consentLink}>[Termini]</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => openExternalDocument(PRIVACY_URL, 'Informativa Privacy')}>
                        <Text style={styles.consentLink}>[Privacy Policy]</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={[styles.consentHint, { color: iconColor }]}>
                      Puoi consultare in ogni momento i documenti dalla sezione Impostazioni.
                    </Text>
                  </View>
                </TouchableOpacity>

                <Text style={[styles.healthConsentTitle, { color: textColor }]}>Consenso all'uso dei dati salute</Text>
                <Text style={[styles.healthConsentBody, { color: iconColor }]}>
                  Per offrirti raccomandazioni personalizzate di benessere, abbiamo bisogno di accedere ai tuoi dati salute (peso, altezza, sonno, battito cardiaco, passi, ecc.) tramite Apple Health / Google Fit.
                  {'\n\n'}
                  Questi dati sono "particolari" secondo il GDPR e vengono trattati solo con il tuo consenso esplicito. Li useremo per:
                  {'\n'}- Generare insight e suggerimenti personalizzati
                  {'\n'}- Analizzare automaticamente i tuoi progressi (profilazione)
                  {'\n'}- Migliorare la tua esperienza nell'app
                  {'\n\n'}
                  Puoi revocare questo consenso in qualsiasi momento dalle Impostazioni, ma alcune funzionalità potrebbero non essere più disponibili.
                </Text>

                <TouchableOpacity
                  style={styles.consentRow}
                  activeOpacity={0.85}
                  onPress={() => setHealthConsentAccepted((prev) => !prev)}
                >
                  <View style={[styles.consentCheckbox, { borderColor: inputBorder }, healthConsentAccepted && styles.consentCheckboxChecked]}>
                    {healthConsentAccepted ? <MaterialCommunityIcons name="check" size={14} color="#fff" /> : null}
                  </View>
                  <View style={styles.consentTextWrap}>
                    <Text style={[styles.consentText, { color: textColor }]}>
                      Acconsento al trattamento dei miei dati relativi alla salute per ricevere raccomandazioni personalizzate e profilazione automatizzata, come descritto nell'Informativa Privacy.
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}

            {mode === 'login' && (
              <View style={styles.optionsRow}>
                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => setRememberMe(!rememberMe)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <View style={[
                    styles.checkbox,
                    { borderColor: inputBorder, backgroundColor: inputBg },
                    rememberMe && styles.checkboxActive
                  ]}>
                    {rememberMe && <FontAwesome name="check" size={10} color="#fff" />}
                  </View>
                  <Text style={[styles.checkboxLabel, { color: iconColor }]}>Ricordami</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleForgotPassword}>
                  <Text style={styles.forgotPassText}>Password dimenticata?</Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              style={[styles.mainButton, !isSignupButtonEnabled && styles.mainButtonDisabled]}
              onPress={handleAuth}
              disabled={isLoading || !isSignupButtonEnabled}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <MaterialCommunityIcons name="login" size={20} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.mainButtonText}>{mode === 'login' ? 'Accedi' : 'Crea Account'}</Text>
                </>
              )}
            </TouchableOpacity>

          </Animated.View>

          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={[styles.dividerText]}>{t('chat.orContinueWith')}</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.socialRow}>
            <TouchableOpacity
              style={[styles.socialBtn, { backgroundColor: inputBg, borderColor: inputBorder }]}
              onPress={() => handleSocialLogin('google')}
              disabled={isLoading}
            >
              <Image
                source={require('../../assets/images/google_logo.png')}
                style={{ width: 24, height: 24, marginRight: 8 }}
              />
              <Text style={[styles.socialBtnText, { color: textColor }]}>Google</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.socialBtn, { backgroundColor: inputBg, borderColor: inputBorder }]}
              onPress={() => handleSocialLogin('apple')}
              disabled={isLoading}
            >
              <FontAwesome name="apple" size={24} color={textColor} style={{ marginRight: 8 }} />
              <Text style={[styles.socialBtnText, { color: textColor }]}>Apple</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        <TimeMachineCalendar
          visible={showBirthDateCalendar}
          onClose={() => setShowBirthDateCalendar(false)}
          onSelectDate={(date) => setBirthDate(date)}
          language="it"
          title="Seleziona la data di nascita"
          subtitle={`L'accesso è consentito solo agli utenti con almeno ${MINIMUM_AGE} anni`}
          confirmText="CONFERMA DATA"
          isDark={themeMode === 'dark'}
          showYearSelector={true}
          headerLabel="DATA DI NASCITA"
          headerIcon="calendar-month-outline"
          {...birthCalendarYearRange}
        />

        <Modal
          visible={showGenderModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowGenderModal(false)}
        >
          <View style={styles.genderModalOverlay}>
            <View style={[styles.genderModalCard, { backgroundColor: inputBg, borderColor: inputBorder }]}>
              <Text style={[styles.genderModalTitle, { color: textColor }]}>Seleziona il sesso</Text>
              {genderOptions.map((option) => {
                const selected = gender === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.genderModalOption,
                      { borderColor: inputBorder },
                      selected && styles.genderModalOptionSelected,
                    ]}
                    onPress={() => {
                      setGender(option.value);
                      setShowGenderModal(false);
                    }}
                  >
                    <Text style={[styles.genderModalOptionText, { color: selected ? '#ffffff' : textColor }]}>
                      {option.label}
                    </Text>
                    {selected && (
                      <MaterialCommunityIcons name="check" size={18} color="#ffffff" />
                    )}
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                style={[styles.genderModalCancel, { borderColor: inputBorder }]}
                onPress={() => setShowGenderModal(false)}
              >
                <Text style={[styles.genderModalCancelText, { color: iconColor }]}>Annulla</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Keyboard spacer */}
        <Reanimated.View style={fakeViewStyle} />
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingTop: 48,
    paddingBottom: 40,
  },

  // Header
  headerContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  titleText: {
    fontSize: 34,
    fontFamily: 'PlayfairDisplay_400Regular',
    textAlign: 'center',
    lineHeight: 42,
    marginBottom: 0,
  },
  gradientText: {
    color: '#8B5CF6',
  },
  subtitleText: {
    fontSize: 16, // Reduced from 18
    fontFamily: 'Figtree_400Regular',
    textAlign: 'center',
    lineHeight: 24, // Adjusted from 26
  },

  // Premium Petal
  premiumPetal: {
    position: 'absolute',
    borderRadius: 10,
  },

  // Toggle
  toggleContainer: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 4,
    height: 52,
    borderWidth: 1,
    marginBottom: 40,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleIndicator: {
    position: 'absolute',
    width: '50%',
    height: 48,
    top: 3,
    left: 0,
    borderRadius: 12,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  toggleBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    zIndex: 10,
  },
  toggleBtnText: {
    fontSize: 15,
    fontFamily: 'Figtree_700Bold',
    // Color handled inline
  },

  // Form
  formContainer: {
    marginBottom: 32,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 12, // Reduced from 16
  },
  inputContainer: {
    marginBottom: 24,
  },
  inlineFieldsRow: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  inlineField: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    fontFamily: 'Figtree_700Bold',
    marginBottom: 6, // Reduced from 8
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    height: 52, // Reduced from 56
    paddingHorizontal: 16,
    // Removed shadow/elevation to fix "box in box" look
  },
  input: {
    flex: 1,
    fontSize: 15, // Reduced from 16
    fontFamily: 'Figtree_500Medium',
    height: '100%',
  },
  birthDateText: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Figtree_500Medium',
  },

  // Options
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  checkboxActive: {
    backgroundColor: '#8B5CF6',
    borderColor: '#8B5CF6',
  },
  checkboxLabel: {
    fontSize: 14,
    fontFamily: 'Figtree_500Medium',
  },
  forgotPassText: {
    fontSize: 14,
    fontFamily: 'Figtree_600SemiBold',
    color: '#8B5CF6',
  },

  // Main Button
  mainButton: {
    height: 52, // Reduced from 56
    backgroundColor: '#8B5CF6',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  mainButtonDisabled: {
    opacity: 0.6,
  },
  mainButtonText: {
    fontSize: 16,
    fontFamily: 'Figtree_700Bold',
    color: '#fff',
  },

  // Divider
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(203, 213, 225, 0.5)',
  },
  dividerText: {
    paddingHorizontal: 12,
    fontSize: 13,
    fontFamily: 'Figtree_500Medium',
    color: '#64748B',
  },

  // Social
  socialRow: {
    flexDirection: 'row',
    gap: 12,
  },
  socialBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    // Removed shadow/elevation
  },
  socialBtnText: {
    fontSize: 14,
    fontFamily: 'Figtree_600SemiBold',
    // Color handled inline
  },
  consentContainer: {
    marginBottom: 22,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.22)',
    borderRadius: 14,
    padding: 12,
    backgroundColor: 'rgba(30,41,59,0.18)',
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  consentCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    marginRight: 10,
    backgroundColor: 'transparent',
  },
  consentCheckboxChecked: {
    backgroundColor: '#8B5CF6',
    borderColor: '#8B5CF6',
  },
  consentTextWrap: {
    flex: 1,
  },
  consentText: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Figtree_500Medium',
  },
  linksRow: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 8,
    marginBottom: 4,
  },
  consentLink: {
    color: '#8B5CF6',
    fontSize: 13,
    fontFamily: 'Figtree_700Bold',
  },
  consentHint: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: 'Figtree_400Regular',
  },
  healthConsentTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Figtree_700Bold',
    marginBottom: 6,
  },
  healthConsentBody: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: 'Figtree_400Regular',
    marginBottom: 10,
  },
  genderModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 24,
  },
  genderModalCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
  },
  genderModalTitle: {
    fontSize: 18,
    fontFamily: 'Figtree_700Bold',
    marginBottom: 12,
  },
  genderModalOption: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  genderModalOptionSelected: {
    backgroundColor: '#8B5CF6',
    borderColor: '#8B5CF6',
  },
  genderModalOptionText: {
    fontSize: 14,
    fontFamily: 'Figtree_600SemiBold',
  },
  genderModalCancel: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  genderModalCancelText: {
    fontSize: 14,
    fontFamily: 'Figtree_600SemiBold',
  },
});
