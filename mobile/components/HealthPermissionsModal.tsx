import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
  ScrollView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { HealthPermissionsService, HealthPermissionsState, HealthPermission } from '../services/health-permissions.service';

const { width, height } = Dimensions.get('window');

interface HealthPermissionsModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const HealthPermissionsModal: React.FC<HealthPermissionsModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const [state, setState] = useState<HealthPermissionsState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  useEffect(() => {
    if (visible) {
      loadPermissionsState();
    }
  }, [visible]);

  const loadPermissionsState = async () => {
    setIsLoading(true);
    try {
      const permissionsState = await HealthPermissionsService.getHealthPermissionsState();
      setState(permissionsState);
      
      // Seleziona automaticamente i permessi richiesti
      const requiredPermissions = permissionsState.permissions
        .filter(p => p.required)
        .map(p => p.id);
      setSelectedPermissions(requiredPermissions);
    } catch (error) {
      console.error('Error loading permissions state:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePermissionToggle = (permissionId: string) => {
    setSelectedPermissions(prev => {
      if (prev.includes(permissionId)) {
        return prev.filter(id => id !== permissionId);
      } else {
        return [...prev, permissionId];
      }
    });
  };

  const handleRequestPermissions = async () => {
    if (selectedPermissions.length === 0) {
      Alert.alert('Attenzione', 'Seleziona almeno un permesso per continuare');
      return;
    }

    setIsRequesting(true);
    try {
      const result = await HealthPermissionsService.requestHealthPermissions(selectedPermissions);
      
      if (result.success) {
        await HealthPermissionsService.markSetupCompleted();
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        
        Alert.alert(
          'Successo!',
          `Permessi concessi: ${result.granted.length}\nPermessi negati: ${result.denied.length}`,
          [
            {
              text: 'Perfetto!',
              onPress: () => {
                onSuccess();
                onClose();
              },
            },
          ]
        );
      } else {
        Alert.alert(
          'Permessi negati',
          'Alcuni permessi sono stati negati. Puoi configurarli manualmente nelle impostazioni di salute del tuo dispositivo.',
          [
            { text: 'Annulla', style: 'cancel' },
            { 
              text: 'Apri Impostazioni', 
              onPress: () => HealthPermissionsService.openHealthSettings() 
            },
          ]
        );
      }
    } catch (error) {
      console.error('Error requesting permissions:', error);
      Alert.alert('Errore', 'Si è verificato un errore durante la richiesta dei permessi');
    } finally {
      setIsRequesting(false);
    }
  };

  const handleSkip = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  const getCategoryIcon = (category: string) => {
    const icons: { [key: string]: string } = {
      activity: '🏃',
      vitals: '❤️',
      sleep: '😴',
      nutrition: '🍎',
      mindfulness: '🧘',
    };
    return icons[category] || '📊';
  };

  const getCategoryName = (category: string) => {
    const names: { [key: string]: string } = {
      activity: 'Attività',
      vitals: 'Parametri Vitali',
      sleep: 'Sonno',
      nutrition: 'Nutrizione',
      mindfulness: 'Mindfulness',
    };
    return names[category] || 'Altro';
  };

  if (!visible || !state) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <BlurView intensity={20} style={styles.blurContainer}>
          <View style={styles.modalContainer}>
            <LinearGradient
              colors={['#4facfe', '#00f2fe']}
              style={styles.modalGradient}
            >
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.iconContainer}>
                  <MaterialCommunityIcons 
                    name="heart-pulse" 
                    size={32} 
                    color="#fff" 
                  />
                </View>
                <Text style={styles.title}>Permessi di Salute</Text>
                <Text style={styles.subtitle}>
                  Connetti i tuoi dati di salute per un monitoraggio completo del benessere
                </Text>
              </View>

              {/* Content */}
              <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {isLoading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#fff" />
                    <Text style={styles.loadingText}>Caricamento permessi...</Text>
                  </View>
                ) : (
                  <View style={styles.permissionsContainer}>
                    {/* Platform Info */}
                    <View style={styles.platformInfo}>
                      <MaterialCommunityIcons 
                        name={Platform.OS === 'ios' ? 'apple' : 'android'} 
                        size={20} 
                        color="#fff" 
                      />
                      <Text style={styles.platformText}>
                        {Platform.OS === 'ios' ? 'HealthKit' : 'Google Fit'} disponibile
                      </Text>
                    </View>

                    {/* Permissions by Category */}
                    {Object.entries(
                      state.permissions.reduce((acc, permission) => {
                        if (!acc[permission.category]) {
                          acc[permission.category] = [];
                        }
                        acc[permission.category].push(permission);
                        return acc;
                      }, {} as { [key: string]: HealthPermission[] })
                    ).map(([category, permissions]) => (
                      <View key={category} style={styles.categoryContainer}>
                        <View style={styles.categoryHeader}>
                          <Text style={styles.categoryIcon}>
                            {getCategoryIcon(category)}
                          </Text>
                          <Text style={styles.categoryName}>
                            {getCategoryName(category)}
                          </Text>
                        </View>

                        {permissions.map((permission) => (
                          <TouchableOpacity
                            key={permission.id}
                            style={[
                              styles.permissionItem,
                              selectedPermissions.includes(permission.id) && styles.permissionItemSelected,
                              permission.required && styles.permissionItemRequired,
                            ]}
                            onPress={() => handlePermissionToggle(permission.id)}
                            disabled={permission.required}
                          >
                            <View style={styles.permissionContent}>
                              <Text style={styles.permissionIcon}>{permission.icon}</Text>
                              <View style={styles.permissionTextContainer}>
                                <Text style={styles.permissionName}>
                                  {permission.name}
                                  {permission.required && ' *'}
                                </Text>
                                <Text style={styles.permissionDescription}>
                                  {permission.description}
                                </Text>
                              </View>
                              <View style={[
                                styles.checkbox,
                                selectedPermissions.includes(permission.id) && styles.checkboxChecked,
                                permission.required && styles.checkboxRequired,
                              ]}>
                                {selectedPermissions.includes(permission.id) && (
                                  <MaterialCommunityIcons name="check" size={16} color="#fff" />
                                )}
                              </View>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </View>
                    ))}

                    {/* Info Note */}
                    <View style={styles.infoNote}>
                      <MaterialCommunityIcons name="information" size={16} color="#4ade80" />
                      <Text style={styles.infoText}>
                        I tuoi dati di salute sono protetti e utilizzati solo per fornirti insights personalizzati
                      </Text>
                    </View>
                  </View>
                )}
              </ScrollView>

              {/* Footer */}
              <View style={styles.footer}>
                <View style={styles.buttonContainer}>
                  <TouchableOpacity
                    onPress={handleSkip}
                    style={styles.skipButton}
                    disabled={isRequesting}
                  >
                    <Text style={styles.skipButtonText}>Salta per ora</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    onPress={handleRequestPermissions}
                    style={styles.requestButton}
                    disabled={isRequesting || selectedPermissions.length === 0}
                  >
                    {isRequesting ? (
                      <ActivityIndicator size="small" color="#4facfe" />
                    ) : (
                      <>
                        <MaterialCommunityIcons name="heart-pulse" size={20} color="#4facfe" />
                        <Text style={styles.requestButtonText}>
                          Richiedi Permessi ({selectedPermissions.length})
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </LinearGradient>
          </View>
        </BlurView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  blurContainer: {
    width: width * 0.95,
    maxWidth: 500,
    maxHeight: height * 0.9,
    borderRadius: 20,
    overflow: 'hidden',
  },
  modalContainer: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  modalGradient: {
    padding: 24,
    maxHeight: height * 0.9,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 22,
  },
  content: {
    flex: 1,
    marginBottom: 20,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 12,
  },
  permissionsContainer: {
    // Container for permissions
  },
  platformInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
  },
  platformText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  categoryContainer: {
    marginBottom: 24,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  categoryName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  permissionItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  permissionItemSelected: {
    backgroundColor: 'rgba(79, 172, 254, 0.2)',
    borderColor: '#4facfe',
  },
  permissionItemRequired: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  permissionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  permissionIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  permissionTextContainer: {
    flex: 1,
  },
  permissionName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  permissionDescription: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    lineHeight: 18,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#4facfe',
    borderColor: '#4facfe',
  },
  checkboxRequired: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderColor: 'rgba(255, 255, 255, 0.7)',
  },
  infoNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(74, 222, 128, 0.2)',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.3)',
    marginTop: 16,
  },
  infoText: {
    color: '#fff',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  footer: {
    // Footer container
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skipButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  skipButtonText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
    fontWeight: '500',
  },
  requestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  requestButtonText: {
    color: '#4facfe',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});