import React, { useState, useEffect } from 'react';
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    ScrollView,
    Alert,
    ActivityIndicator,
    Modal,
    Platform,
    BackHandler,
    Switch,
    FlatList
} from 'react-native';
import { FontAwesome, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from '../../hooks/useTranslation';
import { useTheme } from '../../contexts/ThemeContext';

import { TimePickerModal } from '../TimePickerModal';

// ---------------- Notifications Settings Screen ----------------
export const NotificationsSettingsScreen = ({ onBack }: { onBack: () => void }) => {
    const { t } = useTranslation();
    const { colors } = useTheme();
    const [loading, setLoading] = useState(false);

    const [emotionSkin, setEmotionSkin] = useState(true);
    const [diary, setDiary] = useState(true);
    const [fridgeExpiry, setFridgeExpiry] = useState(true);
    const [breathing, setBreathing] = useState(true);
    const [hydration, setHydration] = useState(false);
    const [morningGreeting, setMorningGreeting] = useState(false);
    const [eveningWinddown, setEveningWinddown] = useState(false);
    const [sleepPreparation, setSleepPreparation] = useState(false);

    const [showDiaryTimePicker, setShowDiaryTimePicker] = useState(false);
    const [diaryTime, setDiaryTime] = useState(new Date(2024, 0, 1, 21, 30));

    useEffect(() => {
        const onBackPress = () => {
            onBack();
            return true;
        };
        const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => subscription.remove();
    }, [onBack]);

    const format2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);

    const handleSave = async () => {
        try {
            setLoading(true);
            const { NotificationService } = await import('../../services/notifications.service');
            await NotificationService.initialize();
            await NotificationService.cancelAll();

            if (emotionSkin) await NotificationService.scheduleEmotionSkinWeekly();
            if (diary) {
                await NotificationService.schedule(
                    'journal_reminder',
                    t('settings.notifications.diaryTitle') || 'Diario',
                    t('settings.notifications.diaryBody') || 'Ti va di scrivere una breve voce nel diario?',
                    { hour: diaryTime.getHours(), minute: diaryTime.getMinutes(), repeats: true },
                    { screen: 'journal' }
                );
            }
            if (fridgeExpiry) await NotificationService.scheduleFridgeExpiryCheck();
            if (breathing) await NotificationService.scheduleBreathingNudges();
            if (hydration) await NotificationService.scheduleHydrationReminders();
            if (morningGreeting) await NotificationService.scheduleMorningGreeting();
            if (eveningWinddown) await NotificationService.scheduleEveningWinddown();
            if (sleepPreparation) await NotificationService.scheduleSleepPreparation();

            Alert.alert(t('common.success'), t('settings.notifications.saved') || 'Notifiche aggiornate');
            onBack();
        } catch (e) {
            Alert.alert(t('common.error'), (e as any)?.message || 'Impossibile aggiornare le notifiche');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <ScrollView
                style={styles.flex}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Header - Identical to PersonalInformationScreen */}
                <View style={[styles.header, { borderBottomColor: colors.border }]}>
                    <TouchableOpacity style={styles.backButton} onPress={onBack}>
                        <FontAwesome name="arrow-left" size={20} color={colors.primary} />
                    </TouchableOpacity>
                    <Text style={[styles.title, { color: colors.text }]}>{t('settings.notificationsTitle')}</Text>
                    <View style={styles.placeholder} />
                </View>

                <View style={styles.form}>
                    <View style={{ marginBottom: 24 }}>
                        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                            {t('settings.notificationsDescription')}
                        </Text>
                    </View>

                    <View style={styles.section}>
                        {[
                            { id: 'emotionSkin', label: t('settings.notifications.emotionSkin') || 'Analisi Emozioni/Pelle', value: emotionSkin, setter: setEmotionSkin },
                            { id: 'diary', label: t('settings.notifications.diary') || 'Diario', value: diary, setter: setDiary },
                            { id: 'fridge', label: t('settings.notifications.fridgeExpiry') || 'Ingredienti in scadenza', value: fridgeExpiry, setter: setFridgeExpiry },
                            { id: 'breathing', label: t('settings.notifications.breathing') || 'Pausa/Respirazione', value: breathing, setter: setBreathing },
                            { id: 'hydration', label: t('settings.notifications.hydration') || 'Idratazione', value: hydration, setter: setHydration },
                            { id: 'morning', label: t('settings.notifications.morningGreeting') || 'Saluto mattutino', value: morningGreeting, setter: setMorningGreeting },
                            { id: 'evening', label: t('settings.notifications.eveningWinddown') || 'Buona serata', value: eveningWinddown, setter: setEveningWinddown },
                            { id: 'sleep', label: t('settings.notifications.sleepPreparation') || 'Preparazione al sonno', value: sleepPreparation, setter: setSleepPreparation },
                        ].map((row) => (
                            <View key={row.id} style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                <View style={styles.rowCopy}>
                                    <Text style={[styles.rowTitle, { color: colors.text }]}>{row.label}</Text>
                                </View>
                                <Switch
                                    value={row.value}
                                    onValueChange={() => row.setter(!row.value)}
                                    trackColor={{ false: colors.border, true: colors.primaryMuted }}
                                    thumbColor={row.value ? colors.primary : colors.textSecondary}
                                />
                            </View>
                        ))}
                    </View>

                    {diary && (
                        <View style={styles.section}>
                            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('settings.notifications.diaryTimeTitle') || 'Orario Diario'}</Text>
                            <TouchableOpacity
                                onPress={() => setShowDiaryTimePicker(true)}
                                style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border, justifyContent: 'space-between' }]}
                                activeOpacity={0.7}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <MaterialCommunityIcons name="clock-outline" size={20} color={colors.primary} style={{ marginRight: 12 }} />
                                    <Text style={[styles.rowTitle, { color: colors.text, marginBottom: 0 }]}>
                                        {format2(diaryTime.getHours())}:{format2(diaryTime.getMinutes())}
                                    </Text>
                                </View>
                                <FontAwesome name="chevron-right" size={14} color={colors.textTertiary} />
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Save Button */}
                    <TouchableOpacity
                        style={[styles.saveButton, { backgroundColor: colors.primary }]}
                        onPress={handleSave}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <>
                                <FontAwesome name="check" size={18} color="#fff" style={styles.buttonIcon} />
                                <Text style={[styles.saveButtonText, { color: '#fff' }]}>{t('common.save')}</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </ScrollView>

            <TimePickerModal
                visible={showDiaryTimePicker}
                onClose={() => setShowDiaryTimePicker(false)}
                initialTime={diaryTime}
                onConfirm={setDiaryTime}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    flex: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 60,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 30,
        borderBottomWidth: 1,
    },
    backButton: {
        padding: 8,
    },
    title: {
        fontSize: 20,
        fontFamily: 'Figtree_700Bold',
    },
    placeholder: {
        width: 36,
    },
    form: {
        paddingHorizontal: 20,
        paddingTop: 30,
    },
    subtitle: {
        fontSize: 16,
        lineHeight: 24,
        fontFamily: 'Figtree_500Medium',
    },
    section: {
        marginBottom: 32,
    },
    sectionTitle: {
        fontSize: 18,
        fontFamily: 'Figtree_700Bold',
        marginBottom: 16,
        letterSpacing: -0.3,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 16,
        paddingVertical: 16,
        paddingHorizontal: 20,
        marginBottom: 12,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 2,
    },
    rowCopy: {
        flex: 1,
    },
    rowTitle: {
        fontSize: 16,
        fontFamily: 'Figtree_700Bold',
    },
    saveButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        paddingVertical: 16,
        marginTop: 30,
        marginBottom: 80, // Increased from 40 for better spacing at the bottom
    },
    buttonIcon: {
        marginRight: 8,
    },
    saveButtonText: {
        fontSize: 16,
        fontFamily: 'Figtree_700Bold',
    },
});
