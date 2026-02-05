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
            quantity: 1,
            unit: 'pz',
        };

        setFoods(prev => [...prev, newFood]);
        setNewFoodName('');
        setShowAddForm(false);
    }, [newFoodName]);

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
                            placeholder={t('analysis.food.review.foodName')}
                            placeholderTextColor={colors.textTertiary}
                            autoFocus
                        />
                    ) : (
                        <Text style={[styles.foodName, { color: colors.text }]} numberOfLines={3}>
                            {food.name}
                        </Text>
                    )}
                </TouchableOpacity>
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
                        {t('analysis.food.review.addFood')}
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
                        {t('analysis.food.review.newFood')}
                    </Text>
                    <TouchableOpacity onPress={() => setShowAddForm(false)}>
                        <MaterialCommunityIcons name="close" size={20} color={colors.textSecondary} />
                    </TouchableOpacity>
                </View>

                <TextInput
                    style={[styles.addFormInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                    value={newFoodName}
                    onChangeText={setNewFoodName}
                    placeholder={t('analysis.food.review.foodNamePlaceholder')}
                    placeholderTextColor={colors.textTertiary}
                    autoFocus
                />

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
                        {t('analysis.food.review.add')}
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
                    {t('analysis.food.review.analyzingNutrition')}
                </Text>
                <Text style={[styles.loadingSubtitle, { color: colors.textSecondary }]}>
                    {t('analysis.food.review.calculatingMacros')}
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
                            {t('analysis.food.review.title')}
                        </Text>
                        <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                            {t('analysis.food.review.subtitle')}
                        </Text>
                    </View>
                    <View style={styles.headerButton} />
                </View>

                {/* Action Header (Sostituisce Info Banner e Bottom Bar) */}
                <View style={styles.topActionsContainer}>
                    <TouchableOpacity
                        style={[styles.topCancelButton, { borderColor: colors.border }]}
                        onPress={onCancel}
                    >
                        <Text style={[styles.topCancelButtonText, { color: colors.textSecondary }]}>
                            {t('analysis.food.review.cancel')}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.topConfirmButton, { opacity: foods.length === 0 ? 0.5 : 1 }]}
                        onPress={handleConfirm}
                        disabled={foods.length === 0}
                    >
                        <LinearGradient
                            colors={['#10b981', '#059669']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.topConfirmGradient}
                        >
                            <Text style={styles.topConfirmButtonText}>
                                {t('analysis.food.review.confirmAndAnalyze')}
                            </Text>
                            <MaterialCommunityIcons name="check" size={18} color="#fff" />
                        </LinearGradient>
                    </TouchableOpacity>
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
                                    {t('analysis.food.review.noFoodsIdentified')}
                                </Text>
                            </View>
                        )}

                        {/* Bottom Spacer */}
                        <View style={{ height: 40 }} />
                    </ScrollView>
                </KeyboardAvoidingView>
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
    topActionsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 12,
    },
    topCancelButton: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    topCancelButtonText: {
        fontSize: 14,
        fontFamily: 'Figtree_700Bold',
    },
    topConfirmButton: {
        flex: 1,
        height: 44,
        borderRadius: 12,
        overflow: 'hidden',
    },
    topConfirmGradient: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    topConfirmButtonText: {
        color: '#fff',
        fontSize: 14,
        fontFamily: 'Figtree_700Bold',
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
        padding: 16,
        gap: 10,
    },
    foodItemHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
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
        fontFamily: 'Figtree_700Bold',
        lineHeight: 22,
    },
    foodNameInput: {
        fontSize: 16,
        fontFamily: 'Figtree_700Bold',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderWidth: 1,
        borderRadius: 10,
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
        fontFamily: 'Figtree_700Bold',
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
        fontFamily: 'Figtree_700Bold',
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
});

export default FoodReviewScreen;
