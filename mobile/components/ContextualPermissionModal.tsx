/**
 * Unified Camera Permission Modal
 * Design unificato e moderno per richiedere i permessi della fotocamera
 */

import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  Linking,
  Platform,
  Animated,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../hooks/useTranslation';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

interface ContextualPermissionModalProps {
  visible: boolean;
  type: 'camera' | 'microphone';
  context?: 'emotion' | 'skin' | 'food' | 'voice'; // Opzionale per retrocompatibilità
  onClose: () => void;
  onGrant: () => void;
}

export const ContextualPermissionModal: React.FC<ContextualPermissionModalProps> = ({
  visible,
  type,
  context,
  onClose,
  onGrant,
}) => {
  const { t } = useTranslation();
  const { colors, mode } = useTheme();
  const isDark = mode === 'dark';
  
  // Animazioni
  const scaleAnim = React.useRef(new Animated.Value(0)).current;
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const iconScaleAnim = React.useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    if (visible) {
      // Animazione di entrata
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(iconScaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Reset animazioni
      scaleAnim.setValue(0);
      fadeAnim.setValue(0);
      iconScaleAnim.setValue(0.8);
    }
  }, [visible]);

  const getConfig = () => {
    if (type === 'camera') {
      // 🔥 Design unificato per tutte le analisi con fotocamera
      return {
        icon: 'camera-outline',
        gradient: isDark 
          ? ['#667eea', '#764ba2', '#f093fb'] // Gradiente viola/blu per dark mode
          : ['#667eea', '#764ba2'], // Gradiente viola/blu per light mode
        title: t('permissions.camera.unified.title') || 'Permesso Fotocamera Necessario',
        description: t('permissions.camera.unified.description') || 
          'Per analizzare la tua salute e il tuo benessere, abbiamo bisogno dell\'accesso alla fotocamera.',
        benefits: [
          t('permissions.camera.unified.benefit1') || 'Analisi dettagliate di pelle, emozioni e cibo',
          t('permissions.camera.unified.benefit2') || 'Consigli personalizzati basati sui tuoi dati',
          t('permissions.camera.unified.benefit3') || 'Monitoraggio dei miglioramenti nel tempo',
        ],
      };
    } else {
      return {
        icon: 'microphone-outline',
        gradient: ['#43e97b', '#38f9d7'],
        title: t('permissions.microphone.title') || 'Permesso Microfono Necessario',
        description: t('permissions.microphone.description') || 
          'Per utilizzare la chat vocale, abbiamo bisogno dell\'accesso al microfono.',
        benefits: [
          t('permissions.microphone.benefit1') || 'Chat vocale fluida e naturale',
          t('permissions.microphone.benefit2') || 'Dettatura di ingredienti e note',
        ],
      };
    }
  };

  const config = getConfig();

  const handleGrant = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onGrant();
  };

  const handleOpenSettings = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
    onClose();
  };

  if (!visible) return null;

  const animatedStyle = {
    transform: [{ scale: scaleAnim }],
    opacity: fadeAnim,
  };

  const iconAnimatedStyle = {
    transform: [{ scale: iconScaleAnim }],
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <BlurView 
        intensity={isDark ? 30 : 20} 
        tint={isDark ? 'dark' : 'light'} 
        style={styles.overlay}
      >
        <Animated.View style={[styles.container, animatedStyle]}>
          {/* Header con gradiente */}
          <LinearGradient
            colors={config.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            {/* Icona animata */}
            <Animated.View style={[styles.iconContainer, iconAnimatedStyle]}>
              <View style={styles.iconBackground}>
                <MaterialCommunityIcons
                  name={config.icon as any}
                  size={56}
                  color="#fff"
                />
              </View>
            </Animated.View>
            
            <Text style={styles.title}>{config.title}</Text>
            <Text style={styles.subtitle}>{config.description}</Text>
          </LinearGradient>

          {/* Contenuto */}
          <View style={[styles.content, { backgroundColor: colors.surface }]}>
            {/* Lista benefici */}
            {config.benefits.length > 0 && (
              <View style={styles.benefitsContainer}>
                {config.benefits.map((benefit, index) => (
                  <View key={index} style={styles.benefitItem}>
                    <View style={[styles.checkIcon, { backgroundColor: config.gradient[0] + '20' }]}>
                      <MaterialCommunityIcons
                        name="check-circle"
                        size={24}
                        color={config.gradient[0]}
                      />
                    </View>
                    <Text style={[styles.benefitText, { color: colors.text }]}>
                      {benefit}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Azioni */}
            <View style={styles.actions}>
              {/* Bottone principale - Concedi permesso */}
              <TouchableOpacity
                onPress={handleGrant}
                style={styles.grantButton}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={config.gradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.grantButtonGradient}
                >
                  <Text style={styles.grantButtonText}>
                    {t('permissions.grant') || 'Concedi Permesso'}
                  </Text>
                  <MaterialCommunityIcons name="arrow-right" size={22} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>

              {/* Bottone secondario - Non ora */}
              <TouchableOpacity
                onPress={onClose}
                style={[styles.cancelButton, { 
                  borderColor: colors.border,
                  backgroundColor: colors.surfaceElevated || colors.surface,
                }]}
                activeOpacity={0.7}
              >
                <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>
                  {t('permissions.notNow') || 'Non ora'}
                </Text>
              </TouchableOpacity>

              {/* Link - Apri Impostazioni */}
              <TouchableOpacity
                onPress={handleOpenSettings}
                style={styles.settingsButton}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons 
                  name="cog-outline" 
                  size={16} 
                  color={colors.textTertiary} 
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.settingsButtonText, { color: colors.textTertiary }]}>
                  {t('permissions.openSettings') || 'Apri Impostazioni'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </BlurView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 15,
  },
  header: {
    padding: 40,
    paddingBottom: 32,
    alignItems: 'center',
    position: 'relative',
  },
  iconContainer: {
    marginBottom: 20,
  },
  iconBackground: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.95)',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 8,
  },
  content: {
    padding: 28,
    paddingTop: 32,
  },
  benefitsContainer: {
    marginBottom: 28,
    gap: 16,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  checkIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  benefitText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
  actions: {
    gap: 14,
  },
  grantButton: {
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  grantButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 32,
    gap: 10,
  },
  grantButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
  },
  cancelButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  settingsButtonText: {
    fontSize: 14,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
});
