import React, { useState, useCallback, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Dimensions,
    ActivityIndicator,
    BackHandler,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeOut, Layout } from 'react-native-reanimated';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../hooks/useTranslation';
import { useTabBarVisibility } from '../contexts/TabBarVisibilityContext';

const { width } = Dimensions.get('window');

// Unità di misura disponibili
const UNITS = [
    { value: 'g', label: 'g', labelFull: 'grammi' },
    { value: 'ml', label: 'ml', labelFull: 'millilitri' },
    { value: 'pz', label: 'pz', labelFull: 'pezzi' },
    { value: 'cucchiaio', label: 'cucch.', labelFull: 'cucchiai' },
    { value: 'cucchiaino', label: 'cucch.no', labelFull: 'cucchiaini' },
    { value: 'tazza', label: 'tazza', labelFull: 'tazze' },
    { value: 'fetta', label: 'fetta', labelFull: 'fette' },
    { value: 'porzione', label: 'porz.', labelFull: 'porzioni' },
];

export interface FoodItem {
    id: string;
    name: string;
    quantity: number;
    unit: string;
}

interface FoodReviewScreenProps {
    identifiedFoods: FoodItem[];
    imageUri: string;
    onConfirm: (foods: FoodItem[]) => void;
    onCancel: () => void;
    isAnalyzing?: boolean;
}

const generateId = () => `food-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export const FoodReviewScreen: React.FC<FoodReviewScreenProps> = ({
    identifiedFoods,
    imageUri,
    onConfirm,
    onCancel,
    isAnalyzing = false,
}) => {
    const { colors, mode } = useTheme();
    const isDark = mode === 'dark';
    const { t, language } = useTranslation();
    const { hideTabBar, showTabBar } = useTabBarVisibility();

    const [foods, setFoods] = useState<FoodItem[]>(identifiedFoods);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newFoodName, setNewFoodName] = useState('');
    const [newFoodQuantity, setNewFoodQuantity] = useState('100');
    const [newFoodUnit, setNewFoodUnit] = useState('g');
    const [editingId, setEditingId] = useState<string | null>(null);

    useEffect(() => {
        hideTabBar();
        return () => {
            showTabBar();
        };
    }, [hideTabBar, showTabBar]);

    // Handle back button
    useEffect(() => {
        const onBackPress = () => {
            onCancel();
            return true;
        };
        const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => subscription.remove();
    }, [onCancel]);

    const handleUpdateFood = useCallback((id: string, field: keyof FoodItem, value: string | number) => {
        setFoods(prev => prev.map(food =>
            food.id === id ? { ...food, [field]: value } : food
        ));
    }, []);

    const handleDeleteFood = useCallback((id: string) => {
        setFoods(prev => prev.filter(food => food.id !== id));
        if (editingId === id) {
            setEditingId(null);
        }
    }, [editingId]);

    const handleAddFood = useCallback(() => {
        if (!newFoodName.trim()) return;

        const newFood: FoodItem = {
            id: generateId(),
            name: newFoodName.trim(),
            quantity: parseFloat(newFoodQuantity) || 100,
            unit: newFoodUnit,
        };

        setFoods(prev => [...prev, newFood]);
        setNewFoodName('');
        setNewFoodQuantity('100');
        setNewFoodUnit('g');
        setShowAddForm(false);
    }, [newFoodName, newFoodQuantity, newFoodUnit]);

    const handleConfirm = useCallback(() => {
        if (foods.length === 0) return;
        onConfirm(foods);
    }, [foods, onConfirm]);

    const renderFoodItem = (food: FoodItem, index: number) => {
        const isEditing = editingId === food.id;

        return (
            <Animated.View
                key={food.id}
                entering={FadeIn.delay(index * 50)}
                exiting={FadeOut}
                layout={Layout.springify()}
                style={[
                    styles.foodItem,
                    {
                        backgroundColor: colors.surface,
                        borderColor: isEditing ? colors.primary : colors.border,
                        borderWidth: isEditing ? 2 : 1,
                    }
                ]}
            >
                <View style={styles.foodItemHeader}>
                    <View style={styles.foodNumberBadge}>
                        <Text style={styles.foodNumberText}>{index + 1}</Text>
                    </View>
                    <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => handleDeleteFood(food.id)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <MaterialCommunityIcons name="close" size={18} color={colors.error} />
                    </TouchableOpacity>
                </View>

                <TouchableOpacity
                    style={styles.foodNameContainer}
                    onPress={() => setEditingId(isEditing ? null : food.id)}
                    activeOpacity={0.7}
                >
                    {isEditing ? (
                        <TextInput
                            style={[styles.foodNameInput, { color: colors.text, borderColor: colors.border }]}
                            value={food.name}
                            onChangeText={(text) => handleUpdateFood(food.id, 'name', text)}
                            placeholder={language === 'it' ? 'Nome alimento' : 'Food name'}
                            placeholderTextColor={colors.textTertiary}
                            autoFocus
                        />
                    ) : (
                        <Text style={[styles.foodName, { color: colors.text }]} numberOfLines={2}>
                            {food.name}
                        </Text>
                    )}
                </TouchableOpacity>

                <View style={styles.quantityRow}>
                    <View style={[styles.quantityInputContainer, { borderColor: colors.border }]}>
                        <TextInput
                            style={[styles.quantityInput, { color: colors.text }]}
                            value={food.quantity.toString()}
                            onChangeText={(text) => {
                                const num = parseFloat(text.replace(',', '.')) || 0;
                                handleUpdateFood(food.id, 'quantity', num);
                            }}
                            keyboardType="decimal-pad"
                            selectTextOnFocus
                        />
                    </View>

                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.unitsScroll}
                        contentContainerStyle={styles.unitsContainer}
                    >
                        {UNITS.map(unit => (
                            <TouchableOpacity
                                key={unit.value}
                                style={[
                                    styles.unitChip,
                                    {
                                        backgroundColor: food.unit === unit.value ? colors.primary : colors.surfaceMuted,
                                        borderColor: food.unit === unit.value ? colors.primary : colors.border,
                                    }
                                ]}
                                onPress={() => handleUpdateFood(food.id, 'unit', unit.value)}
                            >
                                <Text style={[
                                    styles.unitChipText,
                                    { color: food.unit === unit.value ? '#fff' : colors.text }
                                ]}>
                                    {unit.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            </Animated.View>
        );
    };

    const renderAddForm = () => {
        if (!showAddForm) {
            return (
                <TouchableOpacity
                    style={[styles.addButton, { borderColor: colors.primary, backgroundColor: colors.surface }]}
                    onPress={() => setShowAddForm(true)}
                >
                    <MaterialCommunityIcons name="plus" size={20} color={colors.primary} />
                    <Text style={[styles.addButtonText, { color: colors.primary }]}>
                        {language === 'it' ? 'Aggiungi alimento' : 'Add food'}
                    </Text>
                </TouchableOpacity>
            );
        }

        return (
            <Animated.View
                entering={FadeIn}
                exiting={FadeOut}
                style={[styles.addForm, { backgroundColor: colors.surface, borderColor: colors.primary }]}
            >
                <View style={styles.addFormHeader}>
                    <Text style={[styles.addFormTitle, { color: colors.text }]}>
                        {language === 'it' ? 'Nuovo alimento' : 'New food'}
                    </Text>
                    <TouchableOpacity onPress={() => setShowAddForm(false)}>
                        <MaterialCommunityIcons name="close" size={20} color={colors.textSecondary} />
                    </TouchableOpacity>
                </View>

                <TextInput
                    style={[styles.addFormInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                    value={newFoodName}
                    onChangeText={setNewFoodName}
                    placeholder={language === 'it' ? 'Nome alimento (es. Pasta al pomodoro)' : 'Food name (e.g. Tomato pasta)'}
                    placeholderTextColor={colors.textTertiary}
                    autoFocus
                />

                <View style={styles.quantityRow}>
                    <View style={[styles.quantityInputContainer, { borderColor: colors.border, backgroundColor: colors.background }]}>
                        <TextInput
                            style={[styles.quantityInput, { color: colors.text }]}
                            value={newFoodQuantity}
                            onChangeText={setNewFoodQuantity}
                            keyboardType="decimal-pad"
                            placeholder="100"
                            placeholderTextColor={colors.textTertiary}
                        />
                    </View>

                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.unitsScroll}
                        contentContainerStyle={styles.unitsContainer}
                    >
                        {UNITS.map(unit => (
                            <TouchableOpacity
                                key={unit.value}
                                style={[
                                    styles.unitChip,
                                    {
                                        backgroundColor: newFoodUnit === unit.value ? colors.primary : colors.surfaceMuted,
                                        borderColor: newFoodUnit === unit.value ? colors.primary : colors.border,
                                    }
                                ]}
                                onPress={() => setNewFoodUnit(unit.value)}
                            >
                                <Text style={[
                                    styles.unitChipText,
                                    { color: newFoodUnit === unit.value ? '#fff' : colors.text }
                                ]}>
                                    {unit.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                <TouchableOpacity
                    style={[
                        styles.addFormConfirm,
                        { backgroundColor: colors.primary, opacity: newFoodName.trim() ? 1 : 0.5 }
                    ]}
                    onPress={handleAddFood}
                    disabled={!newFoodName.trim()}
                >
                    <MaterialCommunityIcons name="check" size={18} color="#fff" />
                    <Text style={styles.addFormConfirmText}>
                        {language === 'it' ? 'Aggiungi' : 'Add'}
                    </Text>
                </TouchableOpacity>
            </Animated.View>
        );
    };

    if (isAnalyzing) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
                <ActivityIndicator size={60} color={colors.primary} />
                <Text style={[styles.loadingTitle, { color: colors.text }]}>
                    {language === 'it' ? 'Analisi nutrizionale in corso...' : 'Nutritional analysis in progress...'}
                </Text>
                <Text style={[styles.loadingSubtitle, { color: colors.textSecondary }]}>
                    {language === 'it' ? 'Calcolo calorie, macronutrienti e raccomandazioni' : 'Calculating calories, macronutrients and recommendations'}
                </Text>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <SafeAreaView style={styles.safeArea} edges={['top']}>
                {/* Header */}
                <View style={[styles.header, { borderBottomColor: colors.border }]}>
                    <TouchableOpacity onPress={onCancel} style={styles.headerButton}>
                        <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <View style={styles.headerTitleContainer}>
                        <Text style={[styles.headerTitle, { color: colors.text }]}>
                            {language === 'it' ? 'Verifica alimenti' : 'Review foods'}
                        </Text>
                        <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                            {language === 'it' ? 'Modifica se necessario' : 'Edit if needed'}
                        </Text>
                    </View>
                    <View style={styles.headerButton} />
                </View>

                {/* Info Banner */}
                <View style={[styles.infoBanner, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.1)' }]}>
                    <MaterialCommunityIcons name="information" size={20} color="#3b82f6" />
                    <Text style={[styles.infoBannerText, { color: isDark ? '#93c5fd' : '#1d4ed8' }]}>
                        {language === 'it'
                            ? 'Controlla e modifica gli alimenti identificati prima di procedere con l\'analisi nutrizionale completa.'
                            : 'Review and edit the identified foods before proceeding with the full nutritional analysis.'}
                    </Text>
                </View>

                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.keyboardView}
                >
                    <ScrollView
                        style={styles.scrollView}
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* Foods List */}
                        <View style={styles.foodsList}>
                            {foods.map((food, index) => renderFoodItem(food, index))}
                            {renderAddForm()}
                        </View>

                        {/* Empty State */}
                        {foods.length === 0 && !showAddForm && (
                            <View style={styles.emptyState}>
                                <MaterialCommunityIcons name="food-off" size={48} color={colors.textTertiary} />
                                <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
                                    {language === 'it'
                                        ? 'Nessun alimento identificato.\nAggiungi manualmente gli alimenti nel tuo pasto.'
                                        : 'No foods identified.\nManually add the foods in your meal.'}
                                </Text>
                            </View>
                        )}

                        {/* Bottom Spacer */}
                        <View style={{ height: 120 }} />
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>

            {/* Bottom Action Bar */}
            <SafeAreaView edges={['bottom']} style={[styles.bottomBar, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
                <View style={styles.bottomBarContent}>
                    <TouchableOpacity
                        style={[styles.cancelButton, { borderColor: colors.border }]}
                        onPress={onCancel}
                    >
                        <Text style={[styles.cancelButtonText, { color: colors.text }]}>
                            {language === 'it' ? 'Annulla' : 'Cancel'}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.confirmButton, { opacity: foods.length === 0 ? 0.5 : 1 }]}
                        onPress={handleConfirm}
                        disabled={foods.length === 0}
                    >
                        <LinearGradient
                            colors={['#10b981', '#059669']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.confirmButtonGradient}
                        >
                            <Text style={styles.confirmButtonText}>
                                {language === 'it' ? 'Conferma e Analizza' : 'Confirm & Analyze'}
                            </Text>
                            <MaterialCommunityIcons name="arrow-right" size={20} color="#fff" />
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    safeArea: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: 32,
    },
    loadingTitle: {
        fontSize: 18,
        fontFamily: 'Figtree_700Bold',
        textAlign: 'center',
    },
    loadingSubtitle: {
        fontSize: 14,
        fontFamily: 'Figtree_500Medium',
        textAlign: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    headerButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitleContainer: {
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 17,
        fontFamily: 'Figtree_700Bold',
    },
    headerSubtitle: {
        fontSize: 12,
        fontFamily: 'Figtree_500Medium',
        marginTop: 2,
    },
    infoBanner: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: 12,
        marginHorizontal: 16,
        marginTop: 12,
        borderRadius: 12,
        gap: 10,
    },
    infoBannerText: {
        flex: 1,
        fontSize: 13,
        fontFamily: 'Figtree_500Medium',
        lineHeight: 18,
    },
    keyboardView: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
    },
    foodsList: {
        gap: 12,
    },
    foodItem: {
        borderRadius: 16,
        padding: 14,
        gap: 10,
    },
    foodItemHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    foodNumberBadge: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#10b981',
        alignItems: 'center',
        justifyContent: 'center',
    },
    foodNumberText: {
        color: '#fff',
        fontSize: 12,
        fontFamily: 'Figtree_700Bold',
    },
    deleteButton: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    foodNameContainer: {
        minHeight: 40,
        justifyContent: 'center',
    },
    foodName: {
        fontSize: 16,
        fontFamily: 'Figtree_600SemiBold',
        lineHeight: 22,
    },
    foodNameInput: {
        fontSize: 16,
        fontFamily: 'Figtree_600SemiBold',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderWidth: 1,
        borderRadius: 8,
    },
    quantityRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    quantityInputContainer: {
        width: 70,
        height: 38,
        borderWidth: 1,
        borderRadius: 8,
        justifyContent: 'center',
    },
    quantityInput: {
        fontSize: 15,
        fontFamily: 'Figtree_600SemiBold',
        textAlign: 'center',
        paddingHorizontal: 8,
    },
    unitsScroll: {
        flex: 1,
    },
    unitsContainer: {
        gap: 6,
        paddingRight: 8,
    },
    unitChip: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
    },
    unitChipText: {
        fontSize: 13,
        fontFamily: 'Figtree_600SemiBold',
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 2,
        borderStyle: 'dashed',
    },
    addButtonText: {
        fontSize: 15,
        fontFamily: 'Figtree_600SemiBold',
    },
    addForm: {
        borderRadius: 16,
        padding: 16,
        gap: 12,
        borderWidth: 2,
    },
    addFormHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    addFormTitle: {
        fontSize: 15,
        fontFamily: 'Figtree_700Bold',
    },
    addFormInput: {
        fontSize: 15,
        fontFamily: 'Figtree_500Medium',
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderWidth: 1,
        borderRadius: 10,
    },
    addFormConfirm: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 12,
        borderRadius: 10,
        marginTop: 4,
    },
    addFormConfirmText: {
        color: '#fff',
        fontSize: 14,
        fontFamily: 'Figtree_600SemiBold',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
        gap: 12,
    },
    emptyStateText: {
        fontSize: 14,
        fontFamily: 'Figtree_500Medium',
        textAlign: 'center',
        lineHeight: 20,
    },
    bottomBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        borderTopWidth: 1,
        paddingTop: 12,
        paddingHorizontal: 16,
        paddingBottom: 8,
    },
    bottomBarContent: {
        flexDirection: 'row',
        gap: 12,
    },
    cancelButton: {
        flex: 1,
        height: 50,
        borderRadius: 25,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelButtonText: {
        fontSize: 15,
        fontFamily: 'Figtree_600SemiBold',
    },
    confirmButton: {
        flex: 2,
        height: 50,
        borderRadius: 25,
        overflow: 'hidden',
    },
    confirmButtonGradient: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    confirmButtonText: {
        color: '#fff',
        fontSize: 15,
        fontFamily: 'Figtree_700Bold',
    },
});

export default FoodReviewScreen;
