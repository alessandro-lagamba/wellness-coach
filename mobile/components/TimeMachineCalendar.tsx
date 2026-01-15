// @ts-nocheck
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    Dimensions,
    ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

// 🆕 Custom marker type for journal entries
interface DayMarker {
    hasMarker: boolean;
    color?: string;
}

interface TimeMachineCalendarProps {
    visible: boolean;
    onClose: () => void;
    onSelectDate: (date: Date) => void;
    markedDates?: string[]; // Simple format: YYYY-MM-DD (dates with default pink dots)
    getDayMarker?: (dateStr: string) => DayMarker; // Custom marker function for journal
    onMonthChange?: (year: number, month: number) => void; // 🆕 Callback when month changes
    language?: string;
    title?: string;
    subtitle?: string;
    confirmText?: string;
    isDark?: boolean;
    showYearSelector?: boolean;
    headerLabel?: string;
    headerIcon?: string;
}

export const TimeMachineCalendar: React.FC<TimeMachineCalendarProps> = ({
    visible,
    onClose,
    onSelectDate,
    markedDates = [],
    getDayMarker,
    onMonthChange,
    language = 'it',
    title,
    subtitle,
    confirmText,
    isDark = true,
    showYearSelector = false,
    headerLabel,
    headerIcon = 'clock-time-three-outline',
}) => {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);

    // Reset to current month when modal opens and notify parent
    useEffect(() => {
        if (visible) {
            const now = new Date();
            setCurrentMonth(now);
            setSelectedDate(null);
            // Notify parent about initial month
            if (onMonthChange) {
                onMonthChange(now.getFullYear(), now.getMonth());
            }
        }
    }, [visible]);

    // Theme colors
    const colors = isDark ? {
        background: '#1a1a2e',
        surface: '#2d2d3a',
        border: '#444',
        text: '#fff',
        textSecondary: '#888',
        textMuted: '#666',
        textDisabled: '#444',
        accent: '#a855f7',
        accentSecondary: '#ec4899',
        selected: '#a855f7',
        selectedBg: 'rgba(168, 85, 247, 0.2)',
    } : {
        background: '#ffffff',
        surface: '#f8f9fc',
        border: '#e2e8f0',
        text: '#1a1a2e',
        textSecondary: '#64748b',
        textMuted: '#94a3b8',
        textDisabled: '#cbd5e1',
        accent: '#a855f7',
        accentSecondary: '#ec4899',
        selected: '#a855f7',
        selectedBg: 'rgba(168, 85, 247, 0.15)',
    };

    const monthNames = language === 'it'
        ? ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre']
        : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    // Week starts from Monday
    const dayNames = language === 'it'
        ? ['L', 'M', 'M', 'G', 'V', 'S', 'D']
        : ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDayOfWeek = new Date(year, month, 1).getDay();
        // Convert Sunday=0 to Monday=0 (shift: Sun becomes 6, Mon becomes 0, etc.)
        const startOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const days: (number | null)[] = [];
        for (let i = 0; i < startOffset; i++) days.push(null);
        for (let i = 1; i <= daysInMonth; i++) days.push(i);
        return days;
    };

    const formatDateStr = (day: number) => {
        return `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    };

    const getMarkerForDay = (day: number): DayMarker => {
        const dateStr = formatDateStr(day);

        // If custom getDayMarker is provided, use it
        if (getDayMarker) {
            return getDayMarker(dateStr);
        }

        // Otherwise use simple markedDates array
        return {
            hasMarker: markedDates.includes(dateStr),
            color: colors.accentSecondary,
        };
    };

    const isSelected = (day: number) => {
        if (!selectedDate) return false;
        return selectedDate.getDate() === day &&
            selectedDate.getMonth() === currentMonth.getMonth() &&
            selectedDate.getFullYear() === currentMonth.getFullYear();
    };

    const isToday = (day: number) => {
        const today = new Date();
        return today.getDate() === day &&
            today.getMonth() === currentMonth.getMonth() &&
            today.getFullYear() === currentMonth.getFullYear();
    };

    const isFuture = (day: number) => {
        const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return date > today;
    };

    const handleDayPress = (day: number) => {
        if (isFuture(day)) return;
        const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        setSelectedDate(date);
    };

    const handleConfirm = () => {
        if (selectedDate) {
            onSelectDate(selectedDate);
            onClose();
        }
    };

    const prevMonth = () => {
        const prev = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1);
        setCurrentMonth(prev);
        if (onMonthChange) {
            onMonthChange(prev.getFullYear(), prev.getMonth());
        }
    };

    const nextMonth = () => {
        const next = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1);
        const today = new Date();
        if (next.getMonth() <= today.getMonth() || next.getFullYear() < today.getFullYear()) {
            setCurrentMonth(next);
            if (onMonthChange) {
                onMonthChange(next.getFullYear(), next.getMonth());
            }
        }
    };

    const handleYearChange = (year: number) => {
        const newMonth = new Date(year, currentMonth.getMonth(), 1);
        setCurrentMonth(newMonth);
        if (onMonthChange) {
            onMonthChange(year, currentMonth.getMonth());
        }
    };

    const displayTitle = title || (language === 'it' ? 'Seleziona Data' : 'Select Date');
    const displaySubtitle = subtitle || '';
    const displayConfirm = confirmText || (language === 'it' ? 'CONFERMA' : 'CONFIRM');
    const displayHeaderLabel = headerLabel || 'TIME MACHINE';

    // Generate year selector range
    const currentYear = new Date().getFullYear();
    const years = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1, currentYear + 2];

    return (
        <Modal visible={visible} transparent animationType="slide">
            <View style={[styles.overlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.5)' }]}>
                <View style={[styles.container, { backgroundColor: colors.background }]}>
                    {/* Handle bar */}
                    <View style={[styles.handleBar, { backgroundColor: colors.surface }]} />

                    {/* Header */}
                    <View style={styles.header}>
                        <MaterialCommunityIcons name={headerIcon as any} size={20} color={colors.accent} />
                        <Text style={[styles.headerLabel, { color: colors.accent }]}>{displayHeaderLabel}</Text>
                    </View>

                    <Text style={[styles.title, { color: colors.text }]}>{displayTitle}</Text>
                    {displaySubtitle ? (
                        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{displaySubtitle}</Text>
                    ) : null}

                    {/* Year Selector (optional) */}
                    {showYearSelector && (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.yearSelector} contentContainerStyle={styles.yearSelectorContent}>
                            {years.filter(y => y <= currentYear).map(year => {
                                const active = year === currentMonth.getFullYear();
                                return (
                                    <TouchableOpacity
                                        key={year}
                                        style={[
                                            styles.yearBtn,
                                            { backgroundColor: colors.surface, borderColor: colors.border },
                                            active && { backgroundColor: colors.selectedBg, borderColor: colors.accent }
                                        ]}
                                        onPress={() => handleYearChange(year)}
                                    >
                                        <Text style={[styles.yearTxt, { color: colors.textSecondary }, active && { color: colors.accent }]}>{year}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    )}

                    {/* Month Navigation */}
                    <View style={[styles.monthNav, !showYearSelector && { marginTop: 8 }]}>
                        <TouchableOpacity onPress={prevMonth} style={[styles.navButton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            <Feather name="chevron-left" size={24} color={colors.text} />
                        </TouchableOpacity>
                        <Text style={[styles.monthText, { color: colors.text }]}>
                            {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                        </Text>
                        <TouchableOpacity onPress={nextMonth} style={[styles.navButton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            <Feather name="chevron-right" size={24} color={colors.text} />
                        </TouchableOpacity>
                    </View>

                    {/* Day Names */}
                    <View style={styles.dayNamesRow}>
                        {dayNames.map((name, i) => (
                            <Text key={i} style={[styles.dayName, { color: colors.textMuted }]}>{name}</Text>
                        ))}
                    </View>

                    {/* Days Grid */}
                    <View style={styles.daysGrid}>
                        {getDaysInMonth(currentMonth).map((day, index) => {
                            const marker = day ? getMarkerForDay(day) : { hasMarker: false };
                            const selected = day ? isSelected(day) : false;
                            const today = day ? isToday(day) : false;
                            const future = day ? isFuture(day) : false;

                            return (
                                <TouchableOpacity
                                    key={index}
                                    style={[
                                        styles.dayCell,
                                        selected && { backgroundColor: colors.selectedBg, borderRadius: 22, borderWidth: 2, borderColor: colors.selected },
                                    ]}
                                    onPress={() => day && handleDayPress(day)}
                                    disabled={!day || future}
                                >
                                    {day && (
                                        <>
                                            <Text style={[
                                                styles.dayText,
                                                { color: colors.text },
                                                future && { color: colors.textDisabled },
                                                today && { color: colors.accent, fontWeight: '700' },
                                                selected && { color: colors.selected, fontWeight: '700' },
                                            ]}>
                                                {day}
                                            </Text>
                                            {marker.hasMarker && !selected && (
                                                <View style={[styles.markerDot, { backgroundColor: marker.color || colors.accentSecondary }]} />
                                            )}
                                        </>
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {/* Confirm Button */}
                    <TouchableOpacity
                        style={[styles.confirmButton, !selectedDate && styles.confirmDisabled]}
                        onPress={handleConfirm}
                        disabled={!selectedDate}
                    >
                        <LinearGradient
                            colors={selectedDate ? ['#a855f7', '#ec4899'] : [colors.surface, colors.surface]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.confirmGradient}
                        >
                            <MaterialCommunityIcons name="check-circle" size={20} color={selectedDate ? '#fff' : colors.textMuted} />
                            <Text style={[styles.confirmText, { color: selectedDate ? '#fff' : colors.textMuted }]}>{displayConfirm}</Text>
                        </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={onClose} style={styles.cancelButton}>
                        <Text style={[styles.cancelText, { color: colors.textSecondary }]}>{language === 'it' ? 'Annulla' : 'Cancel'}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end' },
    container: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
    handleBar: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 },
    headerLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 2 },
    title: { fontSize: 24, fontWeight: '700', textAlign: 'center' },
    subtitle: { fontSize: 14, textAlign: 'center', marginTop: 8, marginBottom: 16 },
    yearSelector: { marginTop: 16, marginBottom: 8 },
    yearSelectorContent: { flexDirection: 'row', gap: 8, paddingHorizontal: 16 },
    yearBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, borderWidth: 1 },
    yearTxt: { fontSize: 14, fontWeight: '600' },
    monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
    navButton: { padding: 8, borderRadius: 12, borderWidth: 1 },
    monthText: { fontSize: 16, fontWeight: '600' },
    dayNamesRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 12 },
    dayName: { fontSize: 12, fontWeight: '500', width: 36, textAlign: 'center' },
    daysGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    dayCell: { width: '14.28%', height: 44, alignItems: 'center', justifyContent: 'center' },
    dayText: { fontSize: 14 },
    markerDot: { width: 6, height: 6, borderRadius: 3, position: 'absolute', bottom: 4 },
    confirmButton: { marginTop: 24, borderRadius: 16, overflow: 'hidden' },
    confirmDisabled: { opacity: 0.5 },
    confirmGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8 },
    confirmText: { fontSize: 16, fontWeight: '700', letterSpacing: 1 },
    cancelButton: { marginTop: 16, alignItems: 'center' },
    cancelText: { fontSize: 14 },
});

export default TimeMachineCalendar;
