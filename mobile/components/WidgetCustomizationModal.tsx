import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useWidgetConfig, WidgetConfig } from '../services/widget-config.service';
import { useTranslation } from '../hooks/useTranslation';

interface WidgetCustomizationModalProps {
  visible: boolean;
  onClose: () => void;
}

export const WidgetCustomizationModal: React.FC<WidgetCustomizationModalProps> = ({
  visible,
  onClose,
}) => {
  const { t } = useTranslation();
  const { config, toggleWidget, changeSize, reorderWidgets, addWidget } = useWidgetConfig();
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // 🔥 Lista di tutti i widget disponibili
  const ALL_AVAILABLE_WIDGETS = ['steps', 'meditation', 'hydration', 'sleep', 'hrv', 'analyses'];

  // 🔥 Filtra i widget NON ancora aggiunti O disabilitati
  // Mostra solo i widget che NON sono abilitati nella config
  const availableWidgetsToAdd = ALL_AVAILABLE_WIDGETS.filter(widgetId => {
    const widgetInConfig = config.find(w => w.id === widgetId);
    // Mostra solo se NON è presente nella config OPPURE è disabilitato
    // Se è presente ma disabilitato, mostralo comunque
    if (!widgetInConfig) {
      return true; // Non presente nella config, può essere aggiunto
    }
    // Se è presente ma disabilitato, può essere riabilitato
    return !widgetInConfig.enabled;
  });

  // 🔥 FIX: Rimuoviamo console.log eccessivi

  const handleToggleWidget = async (widgetId: string) => {
    try {
      await toggleWidget(widgetId);
    } catch (error) {
      Alert.alert(t('widgetCustomization.error'), t('widgetCustomization.toggleError'));
    }
  };

  const handleChangeSize = async (widgetId: string, currentSize: 'small' | 'large') => {
    try {
      const newSize = currentSize === 'small' ? 'large' : 'small';
      await changeSize(widgetId, newSize);
    } catch (error) {
      Alert.alert(t('widgetCustomization.error'), t('widgetCustomization.sizeError'));
    }
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragEnd = async (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;

    try {
      const newConfig = [...config];
      const [draggedItem] = newConfig.splice(fromIndex, 1);
      newConfig.splice(toIndex, 0, draggedItem);
      
      // Update positions
      newConfig.forEach((item, index) => {
        item.position = index;
      });

      await reorderWidgets(newConfig);
    } catch (error) {
      Alert.alert(t('widgetCustomization.error'), t('widgetCustomization.reorderError'));
    } finally {
      setDraggedIndex(null);
    }
  };

  const getWidgetIcon = (widgetId: string) => {
    const icons: { [key: string]: string } = {
      steps: 'walk',
      meditation: 'meditation',
      hydration: 'cup-water',
      sleep: 'sleep',
      hrv: 'heart-pulse',
      analyses: 'chart-line',
    };
    return icons[widgetId] || 'widgets';
  };

  const getWidgetTitle = (widgetId: string) => {
    const titles: { [key: string]: string } = {
      steps: t('widgets.steps'),
      meditation: t('widgets.meditation'),
      hydration: t('widgets.hydration'),
      sleep: t('widgets.sleep'),
      hrv: t('widgets.hrv'),
      analyses: t('widgets.analyses'),
    };
    return titles[widgetId] || widgetId;
  };

  const handleAddWidget = async (widgetId: string) => {
    try {
      // 🔥 FIX: Rimuoviamo console.log eccessivi
      
      // Trova la prima posizione disponibile
      const occupiedPositions = new Set(
        config.filter(w => w.enabled).map(w => w.position)
      );
      
      // 🔥 FIX: Rimuoviamo console.log eccessivi
      
      let availablePosition = 0;
      for (let i = 0; i < 6; i++) {
        if (!occupiedPositions.has(i)) {
          availablePosition = i;
          break;
        }
      }

      // 🔥 FIX: Rimuoviamo console.log eccessivi

      await addWidget(widgetId, 'small', availablePosition);
      
      // 🔥 FIX: Rimuoviamo console.log eccessivi
      
      // Non mostrare alert, il widget verrà aggiunto automaticamente e la lista si aggiornerà
      // Alert.alert(
      //   t('widgetCustomization.success') || 'Successo',
      //   t('widgetCustomization.widgetAdded') || `Widget "${getWidgetTitle(widgetId)}" aggiunto con successo!`
      // );
    } catch (error) {
      // 🔥 FIX: Solo errori critici in console
      console.error('❌ Error adding widget:', error);
      Alert.alert(t('widgetCustomization.error'), t('widgetCustomization.addError') || 'Errore durante l\'aggiunta del widget');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('widgetCustomization.title')}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <MaterialCommunityIcons name="close" size={24} color="#374151" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          <Text style={styles.sectionTitle}>{t('widgetCustomization.sectionTitle')}</Text>
          <Text style={styles.sectionSubtitle}>
            {t('widgetCustomization.sectionSubtitle')}
          </Text>

          {/* Widget già configurati */}
          {config.filter(w => w.enabled).map((widget, index) => (
            <View key={widget.id} style={styles.widgetItem}>
              <View style={styles.widgetInfo}>
                <MaterialCommunityIcons
                  name={getWidgetIcon(widget.id) as any}
                  size={24}
                  color="#10b981"
                />
                <View style={styles.widgetDetails}>
                  <Text style={styles.widgetTitle}>
                    {getWidgetTitle(widget.id)}
                  </Text>
                  <Text style={styles.widgetSubtitle}>
                    {widget.size === 'large' ? t('widgets.large') : widget.size === 'medium' ? t('widgets.medium') || 'Medium' : t('widgets.small')}
                  </Text>
                </View>
              </View>

              <View style={styles.widgetControls}>
                <TouchableOpacity
                  style={[styles.toggleButton, styles.toggleButtonActive]}
                  onPress={() => handleToggleWidget(widget.id)}
                >
                  <MaterialCommunityIcons
                    name="eye"
                    size={20}
                    color="#ffffff"
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.sizeButton, widget.size === 'large' && styles.sizeButtonActive]}
                  onPress={() => handleChangeSize(widget.id, widget.size)}
                >
                  <MaterialCommunityIcons
                    name="resize"
                    size={20}
                    color={widget.size === 'large' ? '#ffffff' : '#6b7280'}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.dragHandle}
                  onPressIn={() => handleDragStart(index)}
                >
                  <MaterialCommunityIcons name="drag" size={20} color="#9ca3af" />
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {/* Sezione: Aggiungi Widget */}
          <View style={styles.separator} />
          <Text style={styles.addSectionTitle}>
            {t('widgetCustomization.addSectionTitle') || 'Aggiungi Widget'}
          </Text>
          <Text style={styles.addSectionSubtitle}>
            {t('widgetCustomization.addSectionSubtitle') || 'Widget disponibili da aggiungere'}
          </Text>

          {availableWidgetsToAdd.length > 0 ? (
            availableWidgetsToAdd.map((widgetId) => (
              <View key={widgetId} style={[styles.widgetItem, styles.addWidgetItem]}>
                <View style={styles.widgetInfo}>
                  <MaterialCommunityIcons
                    name={getWidgetIcon(widgetId) as any}
                    size={24}
                    color="#9ca3af"
                  />
                  <View style={styles.widgetDetails}>
                    <Text style={styles.widgetTitle}>
                      {getWidgetTitle(widgetId)}
                    </Text>
                    <Text style={styles.widgetSubtitle}>
                      {t('widgetCustomization.notAdded') || 'Non ancora aggiunto'}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.addButton}
                  onPress={() => handleAddWidget(widgetId)}
                >
                  <MaterialCommunityIcons name="plus" size={20} color="#ffffff" />
                  <Text style={styles.addButtonText}>
                    {t('widgetCustomization.add') || 'Aggiungi'}
                  </Text>
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="check-circle" size={48} color="#9ca3af" />
              <Text style={styles.emptyStateText}>
                {t('widgetCustomization.allWidgetsAdded') || 'Tutti i widget disponibili sono già stati aggiunti!'}
              </Text>
              <Text style={styles.emptyStateSubtext}>
                {t('widgetCustomization.disableToReAdd') || 'Disabilita un widget per riaggiungerlo qui.'}
              </Text>
            </View>
          )}

          <View style={styles.helpSection}>
            <Text style={styles.helpTitle}>{t('widgetCustomization.helpTitle')}</Text>
            <Text style={styles.helpText}>
              {t('widgetCustomization.help1')}
            </Text>
            <Text style={styles.helpText}>
              {t('widgetCustomization.help2')}
            </Text>
            <Text style={styles.helpText}>
              {t('widgetCustomization.help3')}
            </Text>
            <Text style={styles.helpText}>
              {t('widgetCustomization.help4')}
            </Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
  },
  closeButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginTop: 20,
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 20,
  },
  widgetItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    marginBottom: 12,
  },
  widgetInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  widgetDetails: {
    marginLeft: 12,
    flex: 1,
  },
  widgetTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  disabledText: {
    color: '#9ca3af',
  },
  widgetSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  widgetControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toggleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#10b981',
  },
  sizeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sizeButtonActive: {
    backgroundColor: '#3b82f6',
  },
  dragHandle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  helpSection: {
    marginTop: 30,
    padding: 20,
    backgroundColor: '#f0f9ff',
    borderRadius: 12,
    marginBottom: 20,
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0369a1',
    marginBottom: 12,
  },
  helpText: {
    fontSize: 14,
    color: '#0369a1',
    marginBottom: 6,
  },
  separator: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 24,
  },
  addSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginTop: 8,
    marginBottom: 8,
  },
  addSectionSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
  },
  addWidgetItem: {
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#3b82f6',
    borderRadius: 20,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 8,
    textAlign: 'center',
  },
});

export default WidgetCustomizationModal;
