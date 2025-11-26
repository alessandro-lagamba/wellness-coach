/**
 * Device Permissions Modal
 * Richiede permessi camera e microfono durante onboarding
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Platform,
  Linking,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../hooks/useTranslation';
import { useCameraPermissions } from 'expo-camera';
import { MicrophonePermissionsService } from '../services/microphone-permissions.service';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

interface DevicePermissionsModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface PermissionStatus {
  id: 'camera' | 'microphone';
  name: string;
  icon: string;
  granted: boolean;
  requesting: boolean;
}

export const DevicePermissionsModal: React.FC<DevicePermissionsModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const { colors, mode } = useTheme();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [permissions, setPermissions] = useState<PermissionStatus[]>([
    { id: 'camera', name: t('onboarding.permissions.camera'), icon: 'camera', granted: false, requesting: false },
    { id: 'microphone', name: t('onboarding.permissions.microphone'), icon: 'microphone', granted: false, requesting: false },
  ]);
  const [isRequesting, setIsRequesting] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (visible) {
      checkPermissions();
    }
  }, [visible, cameraPermission]);

  const checkPermissions = async () => {
    if (!isMountedRef.current) return;

    const updatedPermissions = [...permissions];

    // Check camera permission
    if (cameraPermission) {
      const cameraIndex = updatedPermissions.findIndex(p => p.id === 'camera');
      if (cameraIndex !== -1) {
        updatedPermissions[cameraIndex].granted = cameraPermission.granted;
      }
    }

    // Check microphone permission
    try {
      const micService = MicrophonePermissionsService.getInstance();
      const micStatus = await micService.checkPermissions();
      const micIndex = updatedPermissions.findIndex(p => p.id === 'microphone');
      if (micIndex !== -1) {
        updatedPermissions[micIndex].granted = micStatus.granted;
      }
    } catch (error) {
      console.warn('Error checking microphone permission:', error);
    }

    if (isMountedRef.current) {
      setPermissions(updatedPermissions);
    }
  };

  const handleRequestPermission = async (permissionId: 'camera' | 'microphone') => {
    if (!isMountedRef.current) return;

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    setPermissions(prev => prev.map(p => 
      p.id === permissionId ? { ...p, requesting: true } : p
    ));
    setIsRequesting(true);

    try {
      if (permissionId === 'camera') {
        const result = await requestCameraPermission();
        if (result?.granted) {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } else if (permissionId === 'microphone') {
        const micService = MicrophonePermissionsService.getInstance();
        const result = await micService.requestPermissions();
        if (result.granted) {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }

      await checkPermissions();
    } catch (error) {
      console.error(`Error requesting ${permissionId} permission:`, error);
    } finally {
      if (isMountedRef.current) {
        setPermissions(prev => prev.map(p => 
          p.id === permissionId ? { ...p, requesting: false } : p
        ));
        setIsRequesting(false);
      }
    }
  };

  const handleRequestAll = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    for (const permission of permissions) {
      if (!permission.granted) {
        await handleRequestPermission(permission.id);
      }
    }
  };

  const handleContinue = () => {
    const allGranted = permissions.every(p => p.granted);
    const someGranted = permissions.some(p => p.granted);

    if (allGranted) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSuccess();
    } else if (someGranted) {
      // Some permissions granted, allow to continue
      Alert.alert(
        t('onboarding.permissions.warningTitle'),
        t('onboarding.permissions.warningMessage'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { 
            text: t('onboarding.permissions.openSettings'), 
            onPress: () => Linking.openSettings() 
          },
          { 
            text: t('common.continue'), 
            onPress: () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onSuccess();
            }
          },
        ]
      );
    } else {
      // No permissions granted, show alert
      Alert.alert(
        t('onboarding.permissions.noPermissionsTitle'),
        t('onboarding.permissions.noPermissionsMessage'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { 
            text: t('onboarding.permissions.requestAgain'), 
            onPress: handleRequestAll 
          },
          { 
            text: t('common.continue'), 
            onPress: () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onSuccess();
            }
          },
        ]
      );
    }
  };

  const allGranted = permissions.every(p => p.granted);
  const someGranted = permissions.some(p => p.granted);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <BlurView intensity={20} style={styles.modalContainer}>
        <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
          <LinearGradient
            colors={['#667eea', '#764ba2']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            <MaterialCommunityIcons name="shield-check" size={32} color="#fff" />
            <Text style={styles.headerTitle}>{t('onboarding.permissions.title')}</Text>
            <Text style={styles.headerSubtitle}>{t('onboarding.permissions.subtitle')}</Text>
          </LinearGradient>

          <View style={styles.content}>
            <Text style={[styles.description, { color: colors.textSecondary }]}>
              {t('onboarding.permissions.description')}
            </Text>

            <View style={styles.permissionsList}>
              {permissions.map((permission) => (
                <View
                  key={permission.id}
                  style={[
                    styles.permissionItem,
                    { 
                      backgroundColor: permission.granted 
                        ? colors.surfaceElevated 
                        : colors.surfaceMuted,
                      borderColor: permission.granted 
                        ? '#10b981' 
                        : colors.border,
                    }
                  ]}
                >
                  <View style={styles.permissionLeft}>
                    <MaterialCommunityIcons
                      name={permission.icon as any}
                      size={24}
                      color={permission.granted ? '#10b981' : colors.textSecondary}
                    />
                    <Text style={[styles.permissionName, { color: colors.text }]}>
                      {permission.name}
                    </Text>
                  </View>

                  {permission.granted ? (
                    <MaterialCommunityIcons name="check-circle" size={24} color="#10b981" />
                  ) : (
                    <TouchableOpacity
                      onPress={() => handleRequestPermission(permission.id)}
                      disabled={isRequesting || permission.requesting}
                      style={[
                        styles.requestButton,
                        { backgroundColor: colors.primary },
                        (isRequesting || permission.requesting) && styles.requestButtonDisabled
                      ]}
                    >
                      {permission.requesting ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.requestButtonText}>
                          {t('onboarding.permissions.request')}
                        </Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>

            {!allGranted && (
              <TouchableOpacity
                onPress={handleRequestAll}
                disabled={isRequesting}
                style={[
                  styles.requestAllButton,
                  { backgroundColor: colors.primary },
                  isRequesting && styles.requestButtonDisabled
                ]}
              >
                <Text style={styles.requestAllButtonText}>
                  {t('onboarding.permissions.requestAll')}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.footer}>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.footerButton, { backgroundColor: colors.surfaceMuted }]}
            >
              <Text style={[styles.footerButtonText, { color: colors.textSecondary }]}>
                {t('common.skip')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleContinue}
              style={[
                styles.footerButton,
                styles.footerButtonPrimary,
                { backgroundColor: allGranted ? '#10b981' : colors.primary }
              ]}
            >
              <Text style={styles.footerButtonTextPrimary}>
                {t('common.continue')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </BlurView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: width * 0.9,
    maxWidth: 400,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 24,
  },
  header: {
    padding: 24,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 12,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 8,
    textAlign: 'center',
  },
  content: {
    padding: 24,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
    textAlign: 'center',
  },
  permissionsList: {
    gap: 12,
    marginBottom: 16,
  },
  permissionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
  },
  permissionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  permissionName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  requestButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  requestButtonDisabled: {
    opacity: 0.5,
  },
  requestButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  requestAllButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  requestAllButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  footerButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  footerButtonPrimary: {
    // Override with primary color
  },
  footerButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  footerButtonTextPrimary: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

