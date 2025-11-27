/**
 * Contextual Permission Modal
 * Spiega PERCHÉ servono i permessi quando l'utente prova a usarli
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  Linking,
  Platform,
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
  context: 'emotion' | 'skin' | 'food' | 'voice';
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
  const { colors } = useTheme();

  const getConfig = () => {
    if (type === 'camera') {
      switch (context) {
        case 'emotion':
          return {
            icon: 'emoticon-happy',
            gradient: ['#667eea', '#764ba2'],
            title: t('permissions.camera.emotion.title'),
            description: t('permissions.camera.emotion.description'),
            benefits: [
              t('permissions.camera.emotion.benefit1'),
              t('permissions.camera.emotion.benefit2'),
              t('permissions.camera.emotion.benefit3'),
            ],
          };
        case 'skin':
          return {
            icon: 'face-woman-shimmer',
            gradient: ['#f093fb', '#f5576c'],
            title: t('permissions.camera.skin.title'),
            description: t('permissions.camera.skin.description'),
            benefits: [
              t('permissions.camera.skin.benefit1'),
              t('permissions.camera.skin.benefit2'),
              t('permissions.camera.skin.benefit3'),
            ],
          };
        case 'food':
          return {
            icon: 'food',
            gradient: ['#ff9a56', '#ff6a88'],
            title: t('permissions.camera.food.title'),
            description: t('permissions.camera.food.description'),
            benefits: [
              t('permissions.camera.food.benefit1'),
              t('permissions.camera.food.benefit2'),
              t('permissions.camera.food.benefit3'),
            ],
          };
        default:
          return {
            icon: 'camera',
            gradient: ['#667eea', '#764ba2'],
            title: t('permissions.camera.general.title'),
            description: t('permissions.camera.general.description'),
            benefits: [],
          };
      }
    } else {
      return {
        icon: 'microphone',
        gradient: ['#43e97b', '#38f9d7'],
        title: t('permissions.microphone.title'),
        description: t('permissions.microphone.description'),
        benefits: [
          t('permissions.microphone.benefit1'),
          t('permissions.microphone.benefit2'),
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
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <BlurView intensity={20} tint="dark" style={styles.overlay}>
        <View style={styles.container}>
          <LinearGradient
            colors={config.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons
                name={config.icon as any}
                size={48}
                color="#fff"
              />
            </View>
            <Text style={styles.title}>{config.title}</Text>
            <Text style={styles.subtitle}>{config.description}</Text>
          </LinearGradient>

          <View style={[styles.content, { backgroundColor: colors.surface }]}>
            {config.benefits.length > 0 && (
              <View style={styles.benefitsContainer}>
                {config.benefits.map((benefit, index) => (
                  <View key={index} style={styles.benefitItem}>
                    <MaterialCommunityIcons
                      name="check-circle"
                      size={20}
                      color={config.gradient[0]}
                    />
                    <Text style={[styles.benefitText, { color: colors.text }]}>
                      {benefit}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.actions}>
              <TouchableOpacity
                onPress={handleGrant}
                style={styles.grantButton}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={config.gradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.grantButtonGradient}
                >
                  <Text style={styles.grantButtonText}>
                    {t('permissions.grant')}
                  </Text>
                  <MaterialCommunityIcons name="arrow-right" size={20} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={onClose}
                style={[styles.cancelButton, { borderColor: colors.border }]}
                activeOpacity={0.8}
              >
                <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>
                  {t('permissions.notNow')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleOpenSettings}
                style={styles.settingsButton}
                activeOpacity={0.8}
              >
                <Text style={[styles.settingsButtonText, { color: colors.textSecondary }]}>
                  {t('permissions.openSettings')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
    maxWidth: 400,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    padding: 32,
    paddingBottom: 24,
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 22,
  },
  content: {
    padding: 24,
  },
  benefitsContainer: {
    marginBottom: 24,
    gap: 12,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  benefitText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    gap: 12,
  },
  grantButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  grantButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 8,
  },
  grantButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  settingsButton: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  settingsButtonText: {
    fontSize: 13,
    textDecorationLine: 'underline',
  },
});

