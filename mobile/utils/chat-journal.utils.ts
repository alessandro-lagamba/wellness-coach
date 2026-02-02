/**
 * Shared utilities and types for Chat and Journal screens
 */

import { StyleSheet } from 'react-native';

// ==================== TYPES ====================

export interface Message {
    id: string;
    text: string;
    sender: 'user' | 'ai';
    timestamp: Date;
    sessionId?: string;
    emotionContext?: any;
    wellnessSuggestionId?: string;
}

export interface JournalPromptContext {
    mood?: number | null;
    moodNote?: string | null;
    sleepHours?: number | null;
    sleepQuality?: number | null;
    sleepNote?: string | null;
    energy?: string | null;
    focus?: string | null;
}

export interface WellnessSuggestionCategory {
    id: string;
    name: string;
    description: string;
    icon: string;
    colors: {
        primary: string;
        secondary: string;
        light: string;
        gradient: string[];
    };
}

export interface WellnessSuggestion {
    id: string;
    title: string;
    description: string;
    icon: string;
    category: WellnessSuggestionCategory;
    duration: string;
    difficulty: string;
    tags: string[];
    content: string;
}

// ==================== CONSTANTS ====================

export const WELLNESS_CATEGORIES: Record<string, WellnessSuggestionCategory> = {
    mind_body: {
        id: 'mind-body',
        name: 'Mind & Body',
        description: 'Mental wellness and physical movement',
        icon: 'heartbeat',
        colors: {
            primary: '#10b981',
            secondary: '#059669',
            light: '#d1fae5',
            gradient: ['#10b981', '#059669'],
        },
    },
    nutrition: {
        id: 'nutrition',
        name: 'Nutrition',
        description: 'Healthy eating and hydration',
        icon: 'leaf',
        colors: {
            primary: '#f59e0b',
            secondary: '#d97706',
            light: '#fef3c7',
            gradient: ['#f59e0b', '#d97706'],
        },
    },
};

export const WELLNESS_SUGGESTIONS: Record<string, WellnessSuggestion> = {
    'gentle-stretching': {
        id: 'gentle-stretching',
        title: 'Gentle Stretching',
        description: 'Allungamenti per collo e spalle per rilasciare tensione',
        icon: 'leaf',
        category: WELLNESS_CATEGORIES.mind_body,
        duration: '10 minutes',
        difficulty: 'easy',
        tags: ['stress', 'tension'],
        content: 'Pratica allungamenti dolci per 10 minuti per rilasciare la tensione accumulata nel corpo.',
    },
    'posture-reset': {
        id: 'posture-reset',
        title: 'Posture Reset',
        description: 'Riallinea la postura.',
        icon: 'leaf',
        category: WELLNESS_CATEGORIES.mind_body,
        duration: '3 minutes',
        difficulty: 'easy',
        tags: ['stress', 'tension', 'circulation'],
        content: 'Allunga la schiena, apri il petto e riallinea la postura (perfetto da scrivania).',
    },
    'green-tea-break': {
        id: 'green-tea-break',
        title: 'Green Tea Break',
        description: 'Pausa con tè verde per antiossidanti e calma',
        icon: 'coffee',
        category: WELLNESS_CATEGORIES.nutrition,
        duration: '5 minutes',
        difficulty: 'easy',
        tags: ['relaxation', 'antioxidants'],
        content: 'Prenditi una pausa di 5 minuti con una tazza di tè verde per godere dei benefici antiossidanti e rilassanti.',
    },
    'breathing-exercises': {
        id: 'breathing-exercises',
        title: 'Breathing Exercises',
        description: 'Pratica respirazione consapevole per ridurre stress',
        icon: 'leaf',
        category: WELLNESS_CATEGORIES.mind_body,
        duration: '5 minutes',
        difficulty: 'easy',
        tags: ['stress', 'focus', 'calm'],
        content: 'Pratica esercizi di respirazione per 5 minuti per ridurre lo stress e calmare la mente.',
    },
    'take-a-walk': {
        id: 'take-a-walk',
        title: 'Camminata Quotidiana',
        description: 'Attività fisica leggera per il benessere generale',
        icon: 'road',
        category: WELLNESS_CATEGORIES.mind_body,
        duration: '15 minutes',
        difficulty: 'easy',
        tags: ['mood', 'circulation', 'outdoor'],
        content: "Fai una camminata di 15 minuti all'aperto per migliorare umore e circolazione.",
    },
};

// ==================== UTILITY FUNCTIONS ====================

/**
 * Check if a journal prompt is a legacy format that should be regenerated
 */
export const isLegacyJournalPrompt = (prompt?: string | null): boolean => {
    if (!prompt) return false;
    const normalized = prompt.toLowerCase();
    return (
        normalized.includes('suggerimento per il diario') ||
        normalized.includes('suggestion for the journal') ||
        normalized.includes('rispondi con una domanda') ||
        normalized.includes('answer with a prompt')
    );
};

/**
 * Extract wellness suggestion from AI response text
 */
export const extractSuggestionFromAIResponse = (aiResponse: string): WellnessSuggestion | null => {
    const response = aiResponse.toLowerCase();

    for (const [key, suggestion] of Object.entries(WELLNESS_SUGGESTIONS)) {
        if (response.includes(key) || response.includes(suggestion.title.toLowerCase())) {
            return suggestion;
        }
    }

    return null;
};

/**
 * Format time for display
 */
export const formatTime = (date: Date): string => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

/**
 * Get today's date key in YYYY-MM-DD format
 */
export const getTodayKey = (): string => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * Helper to create ISO date without timezone issues
 */
export const toISODateSafe = (year: number, month: number, day: number): string => {
    const m = String(month + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${year}-${m}-${d}`;
};

/**
 * Check if a date is in the future
 */
export const isFutureDate = (isoDate: string): boolean => {
    return isoDate > getTodayKey();
};

/**
 * Check if a date is in the past
 */
export const isPastDate = (isoDate: string): boolean => {
    return isoDate < getTodayKey();
};

/**
 * Map activity category to wellness category
 */
export const getCategoryForActivity = (
    activityId: string,
    fallbackCategory?: string
): 'mindfulness' | 'movement' | 'nutrition' | 'recovery' => {
    const categoryMap: Record<string, 'mindfulness' | 'movement' | 'nutrition' | 'recovery'> = {
        'breathing-exercises': 'mindfulness',
        meditation: 'mindfulness',
        'gentle-stretching': 'movement',
        stretching: 'movement',
        walk: 'movement',
        exercise: 'movement',
        water: 'nutrition',
        hydration: 'nutrition',
        sleep: 'recovery',
        rest: 'recovery',
    };

    const normalizedId = activityId?.toLowerCase() || '';
    let category = categoryMap[normalizedId];

    // Keyword-based fallback
    if (!category) {
        if (normalizedId.includes('stretch') || normalizedId.includes('allungamento')) {
            category = 'movement';
        } else if (
            normalizedId.includes('breath') ||
            normalizedId.includes('meditation') ||
            normalizedId.includes('mindful')
        ) {
            category = 'mindfulness';
        } else if (
            normalizedId.includes('water') ||
            normalizedId.includes('hydration') ||
            normalizedId.includes('nutrition')
        ) {
            category = 'nutrition';
        } else if (
            normalizedId.includes('sleep') ||
            normalizedId.includes('rest') ||
            normalizedId.includes('recovery')
        ) {
            category = 'recovery';
        }
    }

    // Use fallback if provided and valid
    if (!category && fallbackCategory) {
        const validCategories = ['mindfulness', 'movement', 'nutrition', 'recovery'];
        if (validCategories.includes(fallbackCategory)) {
            category = fallbackCategory as 'mindfulness' | 'movement' | 'nutrition' | 'recovery';
        }
    }

    return category || 'mindfulness';
};

// ==================== SHARED STYLES ====================

export const sharedChatJournalStyles = StyleSheet.create({
    container: {
        flex: 1,
    },
    flex: {
        flex: 1,
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
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerContent: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    segmentedControl: {
        flexDirection: 'row',
        borderRadius: 10,
        padding: 4,
        gap: 4,
    },
    segmentBtn: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
    },
    segmentBtnActive: {
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
    },
    segmentText: {
        fontSize: 14,
    },
    scrollArea: {
        flex: 1,
    },
});
