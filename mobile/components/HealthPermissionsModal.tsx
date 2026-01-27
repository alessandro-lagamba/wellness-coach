import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { useTheme } from '../contexts/ThemeContext';
import { HealthPermissionsService, HealthPermissionsState, HealthPermission } from '../services/health-permissions.service';
import { useTranslation } from '../hooks/useTranslation'; // 🆕 i18n

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
  const { t } = useTranslation(); // 🆕 i18n hook
  const { colors, mode } = useTheme();
  const [state, setState] = useState<HealthPermissionsState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  const hasCheckedPermissionsRef = useRef<boolean>(false); // 🔥 Previene controlli multipli
  // 🔥 FIX: Memory leak - aggiungiamo ref per tracciare se il componente è montato
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // 🔥 RIMOSSO: Il listener AppState causava loop infiniti
  // Se l'utente concede i permessi manualmente in Health Connect, può usare il pulsante "Ricarica permessi"

  const previousGrantedCountRef = useRef<number>(0);
  const isClosingRef = useRef<boolean>(false); // 🔥 Previene chiusura multipla
  const lastHapticTimeRef = useRef<number>(0); // 🔥 Debounce per haptic feedback

  // 🔥 NUOVO: Funzione per sincronizzare i dati dopo aver ottenuto i permessi
  const syncHealthDataAfterPermissions = useCallback(async () => {
    // 🔥 FIX: Verifica se il componente è ancora montato
    if (!isMountedRef.current) return;

    try {
      const { HealthDataService } = await import('../services/health-data.service');
      const healthService = HealthDataService.getInstance();

      // 🔥 CRITICO: PRIMA aggiorna i permessi nel servizio
      // Questo è fondamentale perché syncHealthData controlla this.permissions
      await healthService.refreshPermissions();

      // 🔥 Aspetta un momento per assicurarci che i permessi siano effettivamente disponibili
      await new Promise(resolve => setTimeout(resolve, 300));

      // 🔥 FIX: Forza sincronizzazione immediata bypassando cooldown
      const syncResult = await healthService.syncHealthData(true);
      if (!syncResult.success) {
        console.error('⚠️ Health data sync failed:', syncResult.error);
      }
    } catch (error) {
      console.error('❌ Error syncing health data:', error);
    }
  }, []);

  // Rimosso il polling periodico per evitare loop e consumo risorse.

  // 🔥 FIX: Memoizziamo loadPermissionsState per evitare ricreazioni
  const loadPermissionsState = useCallback(async (showSuccessIfChanged = false) => {
    // 🔥 Previene chiamate multiple mentre si sta chiudendo
    if (isClosingRef.current || !isMountedRef.current) {
      return;
    }

    // 🔥 FIX: Verifica se il componente è ancora montato prima di setState
    if (!isMountedRef.current) return;
    setIsLoading(true);

    try {
      const permissionsState = await HealthPermissionsService.getHealthPermissionsState();

      // 🔥 FIX: Verifica se il componente è ancora montato prima di setState
      if (!isMountedRef.current) return;

      // Conta quanti permessi sono concessi
      const grantedCount = permissionsState.permissions.filter(p => p.granted).length;

      // 🔥 NUOVO: Verifica se tutti i permessi richiesti sono concessi
      const requiredPermissions = permissionsState.permissions.filter(p => p.required);
      const allRequiredGranted = requiredPermissions.length > 0 && requiredPermissions.every(p => p.granted);

      // Se ci sono nuovi permessi concessi rispetto a prima, mostra un messaggio di successo
      if (showSuccessIfChanged && grantedCount > previousGrantedCountRef.current && previousGrantedCountRef.current > 0) {
        const newlyGranted = permissionsState.permissions.filter(
          p => p.granted && !state?.permissions.find(sp => sp.id === p.id && sp.granted)
        );

        if (newlyGranted.length > 0) {
          // 🔥 FIX: Verifica se il componente è ancora montato prima di mostrare Alert
          if (!isMountedRef.current) return;

          // 🔥 Debounce haptic feedback (max una volta ogni 2 secondi)
          const now = Date.now();
          // haptic disabilitato

          // Mostra solo un messaggio di successo, l'utente chiude manualmente
          Alert.alert(
            t('common.success'),
            `${t('modals.healthPermissions.permissionsGranted')}\n\n${newlyGranted.map(p => `✅ ${p.name}`).join('\n')}\n\n${t('modals.healthPermissions.permissionsNowActive')}`,
            [
              {
                text: t('common.ok'),
                onPress: async () => {
                  // Sincronizza i dati dopo aver ottenuto i permessi
                  await syncHealthDataAfterPermissions();
                  // NON chiudere automaticamente - l'utente chiude manualmente
                },
              },
            ]
          );
        }
      }

      // 🔥 RIMOSSO: Auto-chiusura automatica che causava loop infiniti
      // L'utente deve chiudere manualmente il modal dopo aver concesso i permessi

      // 🔥 FIX: Verifica se il componente è ancora montato prima di setState
      if (!isMountedRef.current) return;

      previousGrantedCountRef.current = grantedCount;
      setState(permissionsState);

      // Seleziona automaticamente i permessi richiesti
      const requiredPermissionIds = requiredPermissions.map(p => p.id);
      setSelectedPermissions(requiredPermissionIds);
    } catch (error) {
      // 🔥 FIX: Solo errori critici in console
      console.error('Error loading permissions state:', error);
    } finally {
      // 🔥 FIX: Verifica se il componente è ancora montato prima di setState
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [state, syncHealthDataAfterPermissions, t]);

  useEffect(() => {
    if (visible && !hasCheckedPermissionsRef.current) {
      hasCheckedPermissionsRef.current = true;
      loadPermissionsState();
    } else if (!visible) {
      // Reset quando il modal viene chiuso
      hasCheckedPermissionsRef.current = false;
      isClosingRef.current = false;
    }
  }, [visible, loadPermissionsState]);

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
    // 🔥 FIX: Verifica se il componente è ancora montato
    if (!isMountedRef.current) return;

    // 🔥 SEMPRE richiedi tutti i permessi richiesti, anche se l'utente non li ha selezionati manualmente
    const requiredPermissions = state?.permissions?.filter(p => p.required) || [];
    const requiredPermissionIds = requiredPermissions.map(p => p.id);

    // Combina i permessi richiesti con quelli selezionati manualmente
    const permissionsToRequest = [...new Set([...requiredPermissionIds, ...selectedPermissions])];

    if (permissionsToRequest.length === 0) {
      Alert.alert(t('modals.healthPermissions.warning'), t('modals.healthPermissions.selectAtLeastOne'));
      return;
    }

    // 🔥 FIX: Verifica se il componente è ancora montato prima di setState
    if (!isMountedRef.current) return;
    setIsRequesting(true);

    try {
      // 🔥 FIX: Rimuoviamo console.log eccessivi
      const result = await HealthPermissionsService.requestHealthPermissions(permissionsToRequest);

      // 🔥 FIX: Verifica se il componente è ancora montato prima di continuare
      if (!isMountedRef.current) return;

      if (result.success) {
        await HealthPermissionsService.markSetupCompleted();
        // haptic disabilitato

        // 🔥 iOS FIX: iOS non dice quali permessi sono concessi
        // Proviamo a leggere i dati per verificare se funziona
        if (Platform.OS === 'ios' && result.granted.length === 0 && result.denied.length === 0) {
          console.log('[iOS] Permission status unknown - attempting to verify by reading data...');

          // Tenta di sincronizzare i dati per verificare se abbiamo davvero i permessi
          await syncHealthDataAfterPermissions();

          // 🔥 FIX: Verifica se il componente è ancora montato
          if (!isMountedRef.current) return;

          // Prova a leggere lo stato aggiornato
          const { HealthDataService } = await import('../services/health-data.service');
          const healthService = HealthDataService.getInstance();
          const healthData = healthService.getLastHealthData();

          // Se abbiamo ottenuto dati, i permessi funzionano
          const hasRealData = healthData && (
            (healthData.steps && healthData.steps > 0) ||
            (healthData.heartRate && healthData.heartRate > 0) ||
            (healthData.sleepHours && healthData.sleepHours > 0)
          );

          if (hasRealData) {
            // ✅ Permessi funzionanti - abbiamo dati reali
            Alert.alert(
              t('common.success'),
              t('modals.healthPermissions.iosPermissionsWorking', 'Permessi HealthKit attivi! I tuoi dati salute sono stati sincronizzati.'),
              [{
                text: t('modals.healthPermissions.perfect'),
                onPress: () => { onSuccess(); onClose(); }
              }]
            );
          } else {
            // ❌ Nessun dato - guida l'utente alle impostazioni
            Alert.alert(
              t('modals.healthPermissions.iosPermissionsNeeded', 'Attiva i permessi manualmente'),
              t('modals.healthPermissions.iosManualInstructions',
                'iOS non permette di sapere quali permessi hai concesso.\n\n' +
                'Se hai già concesso i permessi ma i dati non appaiono, vai in:\n\n' +
                '📱 Impostazioni → Privacy e sicurezza → Salute → Wellness Coach\n\n' +
                'E assicurati che tutte le categorie siano attive.'),
              [
                {
                  text: t('common.cancel'),
                  style: 'cancel',
                  onPress: () => { onSuccess(); onClose(); }
                },
                {
                  text: t('modals.healthPermissions.openSettings'),
                  onPress: () => {
                    HealthPermissionsService.openHealthSettings();
                    onSuccess();
                    onClose();
                  }
                },
              ]
            );
          }
          return; // Uscita anticipata per iOS
        }

        // 🔥 Sincronizza i dati dopo aver ottenuto i permessi (Android path)
        await syncHealthDataAfterPermissions();

        // 🔥 FIX: Verifica se il componente è ancora montato prima di mostrare Alert
        if (!isMountedRef.current) return;

        // Costruisci un messaggio più dettagliato se ci sono permessi negati
        let message = t('modals.healthPermissions.successMessage', {
          granted: result.granted.length,
          denied: result.denied.length
        });

        if (result.denied.length > 0) {
          // Mappa i permessi negati ai loro nomi
          const deniedNames = result.denied.map(id => {
            const permission = state.permissions.find(p => p.id === id);
            return permission ? permission.name : id;
          }).join(', ');

          message += `\n\n${t('modals.healthPermissions.deniedPermissions')}: ${deniedNames}\n\n${t('modals.healthPermissions.deniedInstructions')}`;
        }

        Alert.alert(
          result.denied.length > 0 ? t('modals.healthPermissions.partialSuccess') : t('common.success'),
          message,
          [
            ...(result.denied.length > 0 ? [{
              text: t('modals.healthPermissions.openSettings'),
              onPress: () => {
                HealthPermissionsService.openHealthSettings();
                onSuccess();
                onClose();
              },
            }] : []),
            {
              text: t('modals.healthPermissions.perfect'),
              onPress: async () => {
                // 🔥 FIX: Forza una sincronizzazione immediata prima di chiudere
                await syncHealthDataAfterPermissions();
                onSuccess();
                onClose();
              },
            },
          ]
        );
      } else {
        // 🔥 FIX: Verifica se il componente è ancora montato prima di mostrare Alert
        if (!isMountedRef.current) return;

        Alert.alert(
          t('modals.healthPermissions.deniedTitle'),
          t('modals.healthPermissions.deniedMessage'),
          [
            { text: t('common.cancel'), style: 'cancel' },
            {
              text: t('modals.healthPermissions.openSettings'),
              onPress: () => HealthPermissionsService.openHealthSettings()
            },
          ]
        );
      }
    } catch (error) {
      // 🔥 FIX: Solo errori critici in console
      console.error('Error requesting permissions:', error);

      // 🔥 FIX: Verifica se il componente è ancora montato prima di mostrare Alert
      if (isMountedRef.current) {
        Alert.alert(t('common.error'), t('modals.healthPermissions.errorMessage'));
      }
    } finally {
      // 🔥 FIX: Verifica se il componente è ancora montato prima di setState
      if (isMountedRef.current) {
        setIsRequesting(false);
      }
    }
  };

  const handleSkip = async () => {
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
      activity: t('modals.healthPermissions.categories.activity'),
      vitals: t('modals.healthPermissions.categories.vitals'),
      sleep: t('modals.healthPermissions.categories.sleep'),
      nutrition: t('modals.healthPermissions.categories.nutrition'),
      mindfulness: t('modals.healthPermissions.categories.mindfulness'),
    };
    return names[category] || t('modals.healthPermissions.categories.other');
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
        <BlurView intensity={20} tint={mode === 'dark' ? 'dark' : 'light'} style={styles.blurContainer}>
          <View style={styles.modalContainer}>
            {/* 🔥 FIX: Colori più scuri per migliorare la leggibilità del testo */}
            <LinearGradient
              colors={['#1e3a5f', '#0d2137']}
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
                <Text style={styles.title}>{t('modals.healthPermissions.title')}</Text>
                <Text style={styles.subtitle}>
                  {t('modals.healthPermissions.subtitle')}
                </Text>
              </View>

              {/* Content */}
              <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* 🔥 Motivational banner */}
                {(() => {
                  const required = state?.permissions?.filter(p => p.required) || [];
                  const allRequiredGranted = required.length > 0 && required.every(p => p.granted);
                  if (!allRequiredGranted) {
                    return (
                      <View style={styles.motivationBox}>
                        <MaterialCommunityIcons name="shield-check" size={18} color="#16a34a" />
                        <Text style={styles.motivationText}>
                          {t('modals.healthPermissions.importanceMessage') || 'Concedere questi permessi ci permette di mostrarti passi, sonno e frequenza cardiaca reali e darti consigli personalizzati. I dati restano sul tuo dispositivo e puoi revocare i permessi in qualsiasi momento.'}
                        </Text>
                      </View>
                    );
                  }
                  return null;
                })()}
                {isLoading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#fff" />
                    <Text style={styles.loadingText}>{t('modals.healthPermissions.loading')}</Text>
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
                        {t('modals.healthPermissions.platformAvailable', {
                          platform: Platform.OS === 'ios' ? 'HealthKit' : 'Google Fit'
                        })}
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
                        {t('modals.healthPermissions.privacyNote')}
                      </Text>
                    </View>
                  </View>
                )}
              </ScrollView>

              {/* Footer */}
              <View style={styles.footer}>
                {/* 🔥 Pulsante Ricarica Permessi - utile quando l'utente torna da Health Connect */}
                {Platform.OS === 'android' && (
                  <View style={styles.refreshButtonContainer}>
                    <TouchableOpacity
                      onPress={async () => {
                        setIsLoading(true);
                        try {
                          // 🔥 Ricarica lo stato dei permessi
                          await loadPermissionsState(true);

                          // 🔥 Se tutti i required sono concessi, forza refresh e sync immediata
                          const required = state?.permissions?.filter(p => p.required) || [];
                          const allRequiredGranted = required.length > 0 && required.every(p => p.granted);
                          if (allRequiredGranted) {
                            const { HealthDataService } = await import('../services/health-data.service');
                            const svc = HealthDataService.getInstance();

                            // 🔥 CRITICO: PRIMA aggiorna i permessi nel servizio
                            await svc.refreshPermissions();

                            // 🔥 Aspetta un momento per assicurarci che i permessi siano effettivamente disponibili
                            await new Promise(resolve => setTimeout(resolve, 500));

                            // 🔥 Forza sync immediata
                            const res = await svc.syncHealthData(true);
                            if (!res.success) {
                              console.error('⚠️ Forced sync failed:', res.error);
                            } else {
                              // 🔥 Sincronizza anche tramite la funzione del modal
                              await syncHealthDataAfterPermissions();
                            }
                          }
                        } catch (e) {
                          console.error('⚠️ Error reloading permissions:', e);
                        } finally {
                          setIsLoading(false);
                        }
                      }}
                      style={styles.refreshButton}
                      disabled={isLoading}
                    >
                      <MaterialCommunityIcons
                        name="refresh"
                        size={18}
                        color="#fff"
                        style={{ marginRight: 8 }}
                      />
                      <Text style={styles.refreshButtonText}>
                        {t('modals.healthPermissions.reloadPermissions') || 'Ricarica permessi'}
                      </Text>
                    </TouchableOpacity>
                    <Text style={styles.refreshButtonHint}>
                      {t('modals.healthPermissions.reloadPermissionsHint') || 'Usa questo pulsante se hai concesso i permessi manualmente in Health Connect'}
                    </Text>
                  </View>
                )}

                <View style={styles.buttonContainer}>
                  <TouchableOpacity
                    onPress={handleSkip}
                    style={styles.skipButton}
                    disabled={isRequesting}
                  >
                    <Text style={styles.skipButtonText}>{t('modals.healthPermissions.skipForNow')}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleRequestPermissions}
                    style={[styles.requestButton, { opacity: selectedPermissions.length === 0 ? 0.6 : 1 }]}
                    disabled={isRequesting || selectedPermissions.length === 0}
                  >
                    {isRequesting ? (
                      <ActivityIndicator size="small" color="#60a5fa" />
                    ) : (
                      <>
                        <MaterialCommunityIcons name="heart-pulse" size={18} color="#60a5fa" style={{ flexShrink: 0 }} />
                        <Text style={styles.requestButtonText} numberOfLines={1} ellipsizeMode="tail">
                          {t('modals.healthPermissions.requestPermissions', { count: selectedPermissions.length }) || 'Concedi i permessi consigliati'}
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
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
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
    fontFamily: 'Figtree_700Bold', // Was bold
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
    fontFamily: 'Figtree_500Medium', // Was 500
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
    fontFamily: 'Figtree_700Bold', // Was bold
  },
  permissionItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  permissionItemSelected: {
    backgroundColor: 'rgba(96, 165, 250, 0.25)',
    borderColor: '#60a5fa',
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
    fontFamily: 'Figtree_700Bold', // Was 600
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
    backgroundColor: '#60a5fa',
    borderColor: '#60a5fa',
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
  refreshButtonContainer: {
    marginBottom: 12,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  refreshButtonText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Figtree_500Medium', // Was 500
  },
  refreshButtonHint: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
    fontStyle: 'italic',
  },
  motivationBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'rgba(22,163,74,0.15)',
    borderColor: 'rgba(22,163,74,0.35)',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  motivationText: {
    color: '#fff',
    fontSize: 14,
    flex: 1,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  skipButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexShrink: 1,
  },
  skipButtonText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 15,
    fontFamily: 'Figtree_500Medium', // Was 500
  },
  requestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    flex: 1,
    minWidth: 0, // Permette al flex di funzionare correttamente
  },
  requestButtonText: {
    color: '#60a5fa',
    fontSize: 15,
    fontFamily: 'Figtree_700Bold', // Was bold
    marginLeft: 6,
    flexShrink: 1,
    textAlign: 'center',
  },
});