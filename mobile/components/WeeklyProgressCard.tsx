import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { MiniTrendChart } from './MiniTrendChart';
import { useTheme } from '../contexts/ThemeContext';
import { ChartType } from '../services/chart-config.service';

const { width } = Dimensions.get('window');
const CHART_WIDTH = Math.min(400, width - 150);

export interface WeeklyProgressCardProps {
    id: ChartType;
    title: string;
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    color: string;
    valueText: string;
    unitText?: string;
    subtitleText: string;
    trendData: number[];
    maxValue: number;
    formatValue?: (v: number) => string;
    onPress?: () => void;
    editMode?: boolean;
    onDisable?: () => void;
    disabled?: boolean;
}

export const WeeklyProgressCard: React.FC<WeeklyProgressCardProps> = ({
    id,
    title,
    icon,
    color,
    valueText,
    unitText,
    subtitleText,
    trendData,
    maxValue,
    formatValue = (v) => v.toString(),
    onPress,
    editMode = false,
    onDisable,
    disabled = false,
}) => {
    const { colors: themeColors } = useTheme();

    return (
        <TouchableOpacity
            key={id}
            style={[styles.progressCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
            onPress={() => !editMode && !disabled && onPress?.()}
            activeOpacity={editMode ? 1 : 0.7}
            disabled={editMode || disabled}
        >
            <View style={styles.progressCardHeader}>
                <MaterialCommunityIcons name={icon} size={24} color={color} />
                <Text style={[styles.progressCardTitle, { color: themeColors.text }]}>
                    {title}
                </Text>
                {editMode && onDisable && (
                    <TouchableOpacity
                        onPress={onDisable}
                        style={[styles.chartEditButton, { backgroundColor: themeColors.error + '20' }]}
                    >
                        <FontAwesome name="times" size={14} color={themeColors.error} />
                    </TouchableOpacity>
                )}
            </View>
            <View style={styles.progressCardContent}>
                <View style={styles.progressCardLeft}>
                    <View style={styles.valueContainer}>
                        <Text style={[styles.progressCardValue, { color: themeColors.text }]}>
                            {valueText}
                        </Text>
                        {unitText && (
                            <Text style={[styles.progressCardUnit, { color: themeColors.textSecondary }]}>
                                {unitText}
                            </Text>
                        )}
                    </View>
                    <Text
                        style={[styles.progressCardSubtitle, { color: themeColors.textSecondary }]}
                        numberOfLines={2}
                    >
                        {subtitleText}
                    </Text>
                </View>
                <View style={styles.progressCardRight}>
                    <MiniTrendChart
                        data={trendData}
                        color={color}
                        maxValue={maxValue}
                        formatValue={formatValue}
                        width={CHART_WIDTH}
                    />
                </View>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    progressCard: {
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    progressCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    progressCardTitle: {
        fontSize: 15,
        fontWeight: '600',
        marginLeft: 10,
        flex: 1,
    },
    chartEditButton: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    progressCardContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
    },
    progressCardLeft: {
        flex: 1,
        paddingRight: 12,
    },
    valueContainer: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    progressCardValue: {
        fontSize: 28,
        fontWeight: '700',
    },
    progressCardUnit: {
        fontSize: 14,
        fontWeight: '500',
        marginLeft: 4,
    },
    progressCardSubtitle: {
        fontSize: 12,
        marginTop: 4,
        lineHeight: 16,
    },
    progressCardRight: {
        width: CHART_WIDTH,
        alignItems: 'flex-end',
    },
});

export default WeeklyProgressCard;
