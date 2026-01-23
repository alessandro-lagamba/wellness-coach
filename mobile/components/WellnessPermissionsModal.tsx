import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Dimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../hooks/useTranslation';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface WellnessPermissionsModalProps {
  visible: boolean;
  onEnable: () => void;
  onSkip: () => void;
  loading?: boolean;
  missingCalendar?: boolean;
  missingNotifications?: boolean;
}

export const WellnessPermissionsModal: React.FC<WellnessPermissionsModalProps> = ({
  visible,
  onEnable,
  onSkip,
  loading = false,
  missingCalendar = true,
  missingNotifications = true,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  if (!visible) {
    return null;
  }

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            style={styles.scrollView}
          >
            <Text style={[styles.title, { color: colors.text }]}>
              {t('home.permissions.modalTitle')}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {t('home.permissions.modalDescription')}
            </Text>

            {missingCalendar && (
              <View style={[styles.row, { borderColor: colors.border }]}>
                <View style={[styles.iconWrapper, { backgroundColor: `${colors.primary}15` }]}>
                  <MaterialCommunityIcons name="calendar-check" size={20} color={colors.primary} />
                </View>
                <View style={styles.rowText}>
                  <Text style={[styles.rowTitle, { color: colors.text }]}>{t('home.permissions.calendarTitle')}</Text>
                  <Text style={[styles.rowDescription, { color: colors.textSecondary }]}>
                    {t('home.permissions.calendarDescription')}
                  </Text>
                </View>
              </View>
            )}

            {missingNotifications && (
              <View style={[styles.row, { borderColor: colors.border }]}>
                <View style={[styles.iconWrapper, { backgroundColor: `${colors.primary}15` }]}>
                  <MaterialCommunityIcons name="bell-alert" size={20} color={colors.primary} />
                </View>
                <View style={styles.rowText}>
                  <Text style={[styles.rowTitle, { color: colors.text }]}>{t('home.permissions.notificationsTitle')}</Text>
                  <Text style={[styles.rowDescription, { color: colors.textSecondary }]}>
                    {t('home.permissions.notificationsDescription')}
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.primary }]}
              onPress={onEnable}
              disabled={loading}
              activeOpacity={0.9}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>{t('home.permissions.enable')}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={onSkip}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={[styles.secondaryButtonText, { color: colors.textSecondary }]}>
                {t('home.permissions.skip')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxHeight: SCREEN_HEIGHT * 0.85,
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
  },
  scrollView: {
    paddingHorizontal: 24,
  },
  scrollContent: {
    paddingTop: 24,
    paddingBottom: 16,
  },
  footer: {
    padding: 24,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 22,
    fontFamily: 'Figtree_700Bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
    fontFamily: 'Figtree_500Medium',
  },
  row: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 12,
    alignItems: 'center',
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 15,
    fontFamily: 'Figtree_700Bold',
    marginBottom: 2,
  },
  rowDescription: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: 'Figtree_500Medium',
  },
  primaryButton: {
    marginTop: 12,
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Figtree_700Bold',
  },
  secondaryButton: {
    marginTop: 10,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontFamily: 'Figtree_500Medium',
  },
});

export default WellnessPermissionsModal;






