import React, { useState } from 'react';
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    TouchableWithoutFeedback,
    StyleSheet,
    ScrollView,
    TextInput,
    ActivityIndicator,
    Dimensions,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../hooks/useTranslation';
import { UserRecipe, MealType } from '../services/recipe-library.service';
import { MealPlanEntry, MealPlanMealType } from '../services/meal-plan.service';

const { width } = Dimensions.get('window');

export type TimeFilter = 'all' | 'quick' | 'balanced' | 'slow';

interface RecipeHubModalProps {
    visible: boolean;
    onClose: () => void;

    // Recipe Library Props
    recipes: UserRecipe[];
    recipesLoading: boolean;
    recipeSearch: string;
    setRecipeSearch: (text: string) => void;
    ingredientFilter: string;
    setIngredientFilter: (text: string) => void;
    mealTypeFilter: Record<string, boolean>;
    toggleMealTypeFilter: (type: string) => void;
    timeFilter: TimeFilter;
    setTimeFilter: (filter: TimeFilter) => void;
    favoriteOnly: boolean;
    setFavoriteOnly: (value: boolean | ((prev: boolean) => boolean)) => void;
    filteredRecipes: UserRecipe[];
    handleRecipeFavoriteToggle: (recipe: UserRecipe) => void;
    setSelectedRecipe: (recipe: UserRecipe) => void;
    onEditRecipe: (recipe: UserRecipe) => void;
    onCreateRecipe: () => void;

    // Meal Planner Actions
    openSlotPicker: (date: string, mealType: MealPlanMealType) => void;
    toISODate: (date: Date) => string;
    getDefaultMealType: (recipe?: UserRecipe) => MealPlanMealType;

    // Navigation
    onOpenFridge: () => void;
}

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export const RecipeHubModal: React.FC<RecipeHubModalProps> = ({
    visible,
    onClose,
    recipes,
    recipesLoading,
    recipeSearch,
    setRecipeSearch,
    ingredientFilter,
    setIngredientFilter,
    mealTypeFilter,
    toggleMealTypeFilter,
    timeFilter,
    setTimeFilter,
    favoriteOnly,
    setFavoriteOnly,
    filteredRecipes,
    handleRecipeFavoriteToggle,
    setSelectedRecipe,
    onEditRecipe,
    onCreateRecipe,
    onOpenFridge,
    openSlotPicker,
    toISODate,
    getDefaultMealType,
}) => {
    const { colors } = useTheme();
    const { t, language } = useTranslation();
    const [activeTab, setActiveTab] = useState<'library' | 'suggestions'>('library');
    const selectedMeals = MEAL_TYPES.filter((type) => mealTypeFilter[type]);
    const mealSummary =
        selectedMeals.length === MEAL_TYPES.length
            ? t('analysis.food.recipes.filters.mealAll') || 'All meals'
            : selectedMeals.length > 0
            ? selectedMeals.map((type) => t(`analysis.food.mealTypes.${type}`)).join(', ')
            : t('analysis.food.recipes.filters.mealAll') || 'All meals';
    const timeSummary =
        t(`analysis.food.recipes.filters.time.${timeFilter}`) ||
        t('analysis.food.recipes.filters.time.all') ||
        'All times';
    const [mealSelectorVisible, setMealSelectorVisible] = useState(false);
    const [timeSelectorVisible, setTimeSelectorVisible] = useState(false);

    const renderTabs = () => (
        <View style={[styles.tabContainer, { backgroundColor: colors.surfaceElevated }]}>
            <TouchableOpacity
                style={[styles.tabButton, activeTab === 'library' && { backgroundColor: colors.surface }]}
                onPress={() => setActiveTab('library')}
            >
                <Text style={[styles.tabText, { color: activeTab === 'library' ? colors.primary : colors.textSecondary }]}>
                    {t('analysis.food.recipes.libraryTitle') || 'Library'}
                </Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[styles.tabButton, activeTab === 'suggestions' && { backgroundColor: colors.surface }]}
                onPress={() => setActiveTab('suggestions')}
            >
                <Text style={[styles.tabText, { color: activeTab === 'suggestions' ? colors.primary : colors.textSecondary }]}>
                    {t('analysis.food.recipes.suggestions') || 'Suggestions'}
                </Text>
            </TouchableOpacity>
        </View>
    );

    const renderLibrary = () => (
        <View>
            {/* Filters */}
            <View style={[styles.recipeFiltersCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.filterInput, { borderColor: colors.border }]}>
                    <MaterialCommunityIcons name="magnify" size={18} color={colors.textSecondary} />
                    <TextInput
                        style={[styles.filterTextInput, { color: colors.text }]}
                        value={recipeSearch}
                        onChangeText={setRecipeSearch}
                        placeholder={t('analysis.food.recipes.filters.searchPlaceholder')}
                        placeholderTextColor={colors.textTertiary}
                    />
                </View>
                <View style={[styles.filterInput, { borderColor: colors.border }]}>
                    <MaterialCommunityIcons name="sprout-outline" size={18} color={colors.textSecondary} />
                    <TextInput
                        style={[styles.filterTextInput, { color: colors.text }]}
                        value={ingredientFilter}
                        onChangeText={setIngredientFilter}
                        placeholder={t('analysis.food.recipes.filters.ingredientsPlaceholder')}
                        placeholderTextColor={colors.textTertiary}
                    />
                </View>
                <View style={styles.filterRow}>
                    <TouchableOpacity
                        style={[
                            styles.selectorButton,
                            { borderColor: colors.border, backgroundColor: colors.surfaceElevated },
                        ]}
                        onPress={() => setMealSelectorVisible(true)}
                    >
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.selectorLabel, { color: colors.textSecondary }]}>
                                {t('analysis.food.recipes.filters.mealTypeLabel')}
                            </Text>
                            <Text
                                style={[styles.selectorValue, { color: colors.text }]}
                                numberOfLines={1}
                            >
                                {mealSummary}
                            </Text>
                        </View>
                        <MaterialCommunityIcons name="chevron-down" size={18} color={colors.textSecondary} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.selectorButton,
                            { borderColor: colors.border, backgroundColor: colors.surfaceElevated },
                        ]}
                        onPress={() => setTimeSelectorVisible(true)}
                    >
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.selectorLabel, { color: colors.textSecondary }]}>
                                {t('analysis.food.recipes.filters.timeLabel')}
                            </Text>
                            <Text style={[styles.selectorValue, { color: colors.text }]}>
                                {timeSummary}
                            </Text>
                        </View>
                        <MaterialCommunityIcons name="chevron-down" size={18} color={colors.textSecondary} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.favoriteButton,
                            {
                                backgroundColor: favoriteOnly ? colors.warning + '22' : colors.surfaceElevated,
                                borderColor: favoriteOnly ? colors.warning : colors.border,
                            },
                        ]}
                        onPress={() => setFavoriteOnly((prev) => !prev)}
                    >
                        <MaterialCommunityIcons
                            name={favoriteOnly ? 'star' : 'star-outline'}
                            size={18}
                            color={favoriteOnly ? colors.warning : colors.textSecondary}
                        />
                    </TouchableOpacity>
                </View>

                <View style={styles.filterActions}>
                    <TouchableOpacity
                        style={[styles.addManualButton, { borderColor: colors.primary }]}
                        onPress={onCreateRecipe}
                    >
                        <MaterialCommunityIcons name="plus-circle-outline" size={18} color={colors.primary} />
                        <Text style={[styles.addManualButtonText, { color: colors.primary }]}>
                            {t('analysis.food.recipes.addManual')}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Recipe List */}
            {recipesLoading ? (
                <View style={styles.recipeLoadingState}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={{ color: colors.textSecondary, marginTop: 8 }}>
                        {t('analysis.food.recipes.loading')}
                    </Text>
                </View>
            ) : filteredRecipes.length > 0 ? (
                <View style={styles.recipeCardList}>
                    {filteredRecipes.map((recipe) => (
                        <View
                            key={recipe.id}
                            style={[styles.recipeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                        >
                            <View style={styles.recipeCardHeader}>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.recipeCardTitle, { color: colors.text }]}>
                                        {recipe.title}
                                    </Text>
                                    <Text style={[styles.recipeCardMeta, { color: colors.textSecondary }]}>
                                        {(recipe.ready_in_minutes || recipe.total_minutes || 0) > 0
                                            ? `${recipe.ready_in_minutes || recipe.total_minutes} ${t('analysis.food.fridge.minutes')}`
                                            : t('analysis.food.recipes.timeUnknown')}
                                    </Text>
                                </View>
                                <TouchableOpacity onPress={() => handleRecipeFavoriteToggle(recipe)}>
                                    <MaterialCommunityIcons
                                        name={recipe.favorite ? 'star' : 'star-outline'}
                                        size={20}
                                        color={recipe.favorite ? colors.warning : colors.textSecondary}
                                    />
                                </TouchableOpacity>
                            </View>

                            {recipe.tags?.length > 0 && (
                                <View style={styles.recipeTagsRow}>
                                    {recipe.tags.slice(0, 3).map((tag) => (
                                        <View key={`${recipe.id}-${tag}`} style={[styles.recipeTag, { backgroundColor: colors.surfaceElevated }]}>
                                            <Text style={[styles.recipeTagText, { color: colors.textSecondary }]}>{tag}</Text>
                                        </View>
                                    ))}
                                </View>
                            )}

                            <View style={styles.recipeActionsRow}>
                                <TouchableOpacity
                                    style={[styles.recipeActionButton, { borderColor: colors.border }]}
                                    onPress={() => setSelectedRecipe(recipe)}
                                >
                                    <MaterialCommunityIcons name="eye-outline" size={16} color={colors.textSecondary} />
                                    <Text style={[styles.recipeActionText, { color: colors.text }]}>
                                        {t('common.view')}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.recipeActionButton, { borderColor: colors.primary }]}
                                    onPress={() => onEditRecipe(recipe)}
                                >
                                    <MaterialCommunityIcons name="pencil-outline" size={16} color={colors.primary} />
                                    <Text style={[styles.recipeActionText, { color: colors.primary }]}>
                                        {t('common.edit')}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.recipeActionButton, { borderColor: colors.accent }]}
                                    onPress={() => openSlotPicker(toISODate(new Date()), getDefaultMealType(recipe))}
                                >
                                    <MaterialCommunityIcons name="calendar-plus" size={16} color={colors.accent} />
                                    <Text style={[styles.recipeActionText, { color: colors.accent }]}>
                                        {t('analysis.food.mealPlanner.addToPlan')}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))}
                </View>
            ) : (
                <View style={[styles.emptyRecipeState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <MaterialCommunityIcons name="chef-hat" size={28} color={colors.textSecondary} />
                    <Text style={[styles.emptyRecipeTitle, { color: colors.text }]}>{t('analysis.food.recipes.emptyTitle')}</Text>
                    <Text style={[styles.emptyRecipeSubtitle, { color: colors.textSecondary }]}>
                        {t('analysis.food.recipes.emptySubtitle')}
                    </Text>
                </View>
            )}
        </View>
    );



    const renderSuggestions = () => (
        <View style={styles.insightList}>
            {[
                {
                    id: 'breakfast',
                    title: t('analysis.food.recipes.breakfast.title'),
                    description: t('analysis.food.recipes.breakfast.description'),
                    image: 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?auto=format&fit=crop&w=1200&q=80',
                },
                {
                    id: 'lunch',
                    title: t('analysis.food.recipes.lunch.title'),
                    description: t('analysis.food.recipes.lunch.description'),
                    image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1200&q=80',
                },
                {
                    id: 'dinner',
                    title: t('analysis.food.recipes.dinner.title'),
                    description: t('analysis.food.recipes.dinner.description'),
                    image: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=1200&q=80',
                },
                {
                    id: 'snack',
                    title: t('analysis.food.recipes.snack.title'),
                    description: t('analysis.food.recipes.snack.description'),
                    image: 'https://images.unsplash.com/photo-1505253716362-afaea1d3d1af?auto=format&fit=crop&w=1200&q=80',
                },
            ].map((item) => (
                <TouchableOpacity key={item.id} style={[styles.insightCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Image source={{ uri: item.image }} style={styles.insightImage} />
                    <View style={styles.insightContent}>
                        <Text style={[styles.insightTitle, { color: colors.text }]}>{item.title}</Text>
                        <Text style={[styles.insightDescription, { color: colors.textSecondary }]}>
                            {item.description}
                        </Text>
                        <View style={[styles.insightAction, { backgroundColor: colors.primary + '15' }]}>
                            <Text style={[styles.insightActionText, { color: colors.primary }]}>
                                {t('common.view')}
                            </Text>
                            <MaterialCommunityIcons name="arrow-right" size={16} color={colors.primary} />
                        </View>
                    </View>
                </TouchableOpacity>
            ))}
        </View>
    );

    return (
        <>
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <SafeAreaView edges={['bottom']} style={styles.safeArea}>
                    <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        {/* Header */}
                        <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                            <View>
                                <Text style={[styles.modalTitle, { color: colors.text }]}>
                                    {t('analysis.food.recipes.hubTitle') || 'Ricettario'}
                                </Text>
                                <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                                    {t('analysis.food.recipes.hubSubtitle') || 'Gestisci libreria, pianificazione dei pasti e suggerimenti AI in un unico posto.'}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                                <MaterialCommunityIcons name="close" size={24} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        {/* Fridge Button */}
                        <TouchableOpacity
                            style={[styles.fridgeButton, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
                            onPress={onOpenFridge}
                        >
                            <MaterialCommunityIcons name="fridge-outline" size={20} color={colors.primary} />
                            <Text style={[styles.fridgeButtonText, { color: colors.primary }]}>
                                {t('analysis.food.fridge.openButton') || 'Open Fridge & Generate'}
                            </Text>
                        </TouchableOpacity>

                        {/* Tabs */}
                        {renderTabs()}

                        {/* Content */}
                        <ScrollView
                            style={styles.scrollView}
                            contentContainerStyle={styles.scrollViewContent}
                            showsVerticalScrollIndicator={false}
                        >
                            {activeTab === 'library' && renderLibrary()}
                            {activeTab === 'suggestions' && renderSuggestions()}
                        </ScrollView>
                    </View>
                </SafeAreaView>
            </View>
        </Modal>
        <Modal
            visible={mealSelectorVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setMealSelectorVisible(false)}
        >
            <TouchableWithoutFeedback onPress={() => setMealSelectorVisible(false)}>
                <View style={styles.selectorOverlay}>
                    <TouchableWithoutFeedback onPress={() => {}}>
                        <View style={[styles.selectorCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            <Text style={[styles.selectorTitle, { color: colors.text }]}>
                                {t('analysis.food.recipes.filters.mealTypeLabel')}
                            </Text>
                            {MEAL_TYPES.map((type) => {
                                const active = mealTypeFilter[type];
                                return (
                                    <TouchableOpacity
                                        key={type}
                                        style={[
                                            styles.selectorOption,
                                            {
                                                borderColor: active ? colors.primary : colors.border,
                                                backgroundColor: active ? colors.primary + '10' : colors.surface,
                                            },
                                        ]}
                                        onPress={() => toggleMealTypeFilter(type)}
                                    >
                                        <Text style={[styles.selectorOptionText, { color: colors.text }]}>
                                            {t(`analysis.food.mealTypes.${type}`)}
                                        </Text>
                                        {active && (
                                            <MaterialCommunityIcons name="check-bold" size={16} color={colors.primary} />
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                            <View style={styles.selectorFooter}>
                                <TouchableOpacity
                                    style={[styles.selectorDoneButton, { backgroundColor: colors.primary }]}
                                    onPress={() => setMealSelectorVisible(false)}
                                >
                                    <Text style={[styles.selectorDoneText, { color: colors.textInverse }]}>
                                        {t('common.done')}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
        <Modal
            visible={timeSelectorVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setTimeSelectorVisible(false)}
        >
            <TouchableWithoutFeedback onPress={() => setTimeSelectorVisible(false)}>
                <View style={styles.selectorOverlay}>
                    <TouchableWithoutFeedback onPress={() => {}}>
                        <View style={[styles.selectorCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            <Text style={[styles.selectorTitle, { color: colors.text }]}>
                                {t('analysis.food.recipes.filters.timeLabel')}
                            </Text>
                            {(['all', 'quick', 'balanced', 'slow'] as TimeFilter[]).map((bucket) => {
                                const active = timeFilter === bucket;
                                return (
                                    <TouchableOpacity
                                        key={bucket}
                                        style={[
                                            styles.selectorOption,
                                            {
                                                borderColor: active ? colors.accent : colors.border,
                                                backgroundColor: active ? colors.accent + '15' : colors.surface,
                                            },
                                        ]}
                                        onPress={() => {
                                            setTimeFilter(bucket);
                                            setTimeSelectorVisible(false);
                                        }}
                                    >
                                        <Text style={[styles.selectorOptionText, { color: colors.text }]}>
                                            {t(`analysis.food.recipes.filters.time.${bucket}`)}
                                        </Text>
                                        {active && (
                                            <MaterialCommunityIcons name="check-bold" size={16} color={colors.accent} />
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
        </>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    safeArea: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    modalContent: {
        flex: 1,
        marginTop: 50,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        borderWidth: 1,
        overflow: 'hidden',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        padding: 20,
        borderBottomWidth: 1,
        position: 'relative',
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: '700',
        marginBottom: 4,
    },
    modalSubtitle: {
        fontSize: 14,
    },
    closeButton: {
        position: 'absolute',
        top: 16,
        right: 16,
        padding: 8,
    },
    fridgeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        margin: 16,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        gap: 8,
    },
    fridgeButtonText: {
        fontWeight: '600',
        fontSize: 14,
    },
    tabContainer: {
        flexDirection: 'row',
        marginHorizontal: 16,
        marginBottom: 16,
        padding: 4,
        borderRadius: 12,
    },
    tabButton: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 8,
    },
    tabText: {
        fontWeight: '600',
        fontSize: 14,
    },
    scrollView: {
        flex: 1,
    },
    scrollViewContent: {
        padding: 16,
        paddingBottom: 40,
    },

    // Filters
    recipeFiltersCard: {
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        gap: 12,
    },
    filterInput: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 44,
        gap: 8,
    },
    filterRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 8,
    },
    selectorButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        gap: 12,
    },
    selectorLabel: {
        fontSize: 11,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    selectorValue: {
        fontSize: 13,
        fontWeight: '600',
        marginTop: 2,
    },
    filterTextInput: {
        flex: 1,
        fontSize: 14,
    },
    filterChipsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    filterChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
    },
    filterChipText: {
        fontSize: 12,
        fontWeight: '600',
    },
    timeChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
    },
    favoriteButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    filterActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginTop: 12,
    },
    addManualButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: 1,
    },
    addManualButtonText: {
        fontSize: 12,
        fontWeight: '700',
    },

    // Recipe List
    recipeLoadingState: {
        padding: 40,
        alignItems: 'center',
    },
    recipeCardList: {
        gap: 12,
    },
    recipeCard: {
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        gap: 12,
    },
    recipeCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    recipeCardTitle: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 4,
    },
    recipeCardMeta: {
        fontSize: 12,
    },
    recipeTagsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    recipeTag: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    recipeTagText: {
        fontSize: 10,
        fontWeight: '500',
    },
    recipeActionsRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 4,
    },
    recipeActionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        gap: 4,
    },
    recipeActionText: {
        fontSize: 12,
        fontWeight: '600',
    },
    emptyRecipeState: {
        alignItems: 'center',
        padding: 32,
        borderRadius: 16,
        borderWidth: 1,
        borderStyle: 'dashed',
    },
    emptyRecipeTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginTop: 12,
        marginBottom: 4,
    },
    emptyRecipeSubtitle: {
        fontSize: 14,
        textAlign: 'center',
    },

    // Planner
    mealPlannerCard: {
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
    },
    weekNavigator: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    navButton: {
        padding: 8,
    },
    weekLabel: {
        fontSize: 14,
        fontWeight: '600',
    },
    mealPlannerColumn: {
        width: width * 0.4,
        marginRight: 12,
    },
    mealPlannerDay: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
        textAlign: 'center',
    },
    mealCell: {
        height: 80,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 8,
        padding: 8,
        justifyContent: 'center',
    },
    mealCellTitle: {
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 2,
    },
    mealCellMeta: {
        fontSize: 10,
    },
    emptyMealCell: {
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
    },
    emptyMealCellText: {
        fontSize: 10,
    },
    mealSummaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
    },
    summaryItem: {
        alignItems: 'center',
    },
    summaryLabel: {
        fontSize: 10,
        marginBottom: 2,
    },
    summaryValue: {
        fontSize: 12,
        fontWeight: '700',
    },

    // Suggestions
    insightList: {
        gap: 16,
    },
    insightCard: {
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
    },
    insightImage: {
        width: '100%',
        height: 140,
    },
    insightContent: {
        padding: 16,
    },
    insightTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 8,
    },
    insightDescription: {
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 16,
    },
    insightAction: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 8,
        gap: 8,
    },
    insightActionText: {
        fontSize: 14,
        fontWeight: '600',
    },
    selectorOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'flex-end',
        padding: 16,
    },
    selectorCard: {
        borderRadius: 20,
        borderWidth: 1,
        padding: 20,
        gap: 12,
    },
    selectorTitle: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 4,
    },
    selectorOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 12,
        marginBottom: 8,
    },
    selectorOptionText: {
        fontSize: 14,
        fontWeight: '600',
    },
    selectorFooter: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginTop: 4,
    },
    selectorDoneButton: {
        paddingHorizontal: 18,
        paddingVertical: 10,
        borderRadius: 999,
    },
    selectorDoneText: {
        fontSize: 13,
        fontWeight: '700',
    },
});
