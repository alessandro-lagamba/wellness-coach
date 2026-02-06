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

// ---------------- Custom Wheel Time Picker ----------------
const WheelTimePicker = ({
    visible,
    onClose,
    initialTime,
    onConfirm
}: {
    visible: boolean;
    onClose: () => void;
    initialTime: Date;
    onConfirm: (date: Date) => void;
}) => {
    const { colors } = useTheme();
    const [selectedHour, setSelectedHour] = useState(initialTime.getHours());
    const [selectedMinute, setSelectedMinute] = useState(initialTime.getMinutes());

    const hours = Array.from({ length: 24 }, (_, i) => i);
    const minutes = Array.from({ length: 60 }, (_, i) => i);

    const ITEM_HEIGHT = 44;
    const VISIBLE_ITEMS = 5;

    const renderItem = (item: number, isHour: boolean) => {
        const isSelected = isHour ? item === selectedHour : item === selectedMinute;
        return (
            <View style={{ height: ITEM_HEIGHT, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{
                    fontSize: isSelected ? 22 : 18,
                    fontFamily: isSelected ? 'Figtree_700Bold' : 'Figtree_500Medium',
                    color: isSelected ? colors.primary : colors.textTertiary,
                    opacity: isSelected ? 1 : 0.5
                }}>
                    {item < 10 ? `0${item}` : item}
                </Text>
            </View>
        );
    };

    const handleConfirm = () => {
        const newDate = new Date();
        newDate.setHours(selectedHour);
        newDate.setMinutes(selectedMinute);
        onConfirm(newDate);
        onClose();
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.modalBackdrop}>
                <TouchableOpacity style={{ flex: 1 }} onPress={onClose} activeOpacity={1} />
                <View style={[styles.wheelModalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.pickerHeader}>
                        <TouchableOpacity onPress={onClose}>
                            <Text style={{ color: colors.textSecondary, fontFamily: 'Figtree_500Medium', fontSize: 16 }}>Annulla</Text>
                        </TouchableOpacity>
                        <Text style={{ color: colors.text, fontFamily: 'Figtree_700Bold', fontSize: 18 }}>Imposta Orario</Text>
                        <TouchableOpacity onPress={handleConfirm}>
                            <Text style={{ color: colors.primary, fontFamily: 'Figtree_700Bold', fontSize: 16 }}>Applica</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={[styles.wheelArea, { height: ITEM_HEIGHT * VISIBLE_ITEMS }]}>
                        <View style={[styles.selectionOverlay, { height: ITEM_HEIGHT, backgroundColor: colors.primaryMuted }]} />
                        <View style={{ width: 80 }}>
                            <FlatList
                                data={hours}
                                keyExtractor={(item) => `hour-${item}`}
                                renderItem={({ item }) => renderItem(item, true)}
                                showsVerticalScrollIndicator={false}
                                snapToInterval={ITEM_HEIGHT}
                                onMomentumScrollEnd={(e) => {
                                    const index = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
                                    setSelectedHour(hours[index]);
                                }}
                                initialScrollIndex={selectedHour}
                                getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
                                contentContainerStyle={{ paddingVertical: ITEM_HEIGHT * 2 }}
                            />
                        </View>
                        <Text style={[styles.separator, { color: colors.text }]}>:</Text>
                        <View style={{ width: 80 }}>
                            <FlatList
                                data={minutes}
                                keyExtractor={(item) => `min-${item}`}
                                renderItem={({ item }) => renderItem(item, false)}
                                showsVerticalScrollIndicator={false}
                                snapToInterval={ITEM_HEIGHT}
                                onMomentumScrollEnd={(e) => {
                                    const index = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
                                    setSelectedMinute(minutes[index]);
                                }}
                                initialScrollIndex={selectedMinute}
                                getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
                                contentContainerStyle={{ paddingVertical: ITEM_HEIGHT * 2 }}
                            />
                        </View>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

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
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('settings.notificationsCategories') || 'Categorie'}</Text>

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

            <WheelTimePicker
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
        marginBottom: 40, // Ensure it's not cut off
    },
    buttonIcon: {
        marginRight: 8,
    },
    saveButtonText: {
        fontSize: 16,
        fontFamily: 'Figtree_700Bold',
    },
    // Modal styles
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
    },
    wheelModalContent: {
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        paddingBottom: 40,
        paddingTop: 20,
        borderWidth: 1,
    },
    pickerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        marginBottom: 20
    },
    wheelArea: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    selectionOverlay: {
        position: 'absolute',
        width: '80%',
        borderRadius: 12,
        opacity: 0.1
    },
    separator: {
        fontSize: 24,
        fontFamily: 'Figtree_700Bold',
        marginHorizontal: 10,
        marginTop: -4
    }
});
