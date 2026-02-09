// Wellness Suggestions Data Structure
export interface WellnessSuggestion {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: WellnessCategory;
  duration?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
  longDescription: string;
  tips: string[];
}

export interface WellnessCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  colors: {
    primary: string;
    secondary: string;
    light: string;
    gradient: [string, string];
  };
}

export const WELLNESS_CATEGORIES: WellnessCategory[] = [
  {
    id: 'mind-body',
    name: 'Mind & Body',
    description: 'Mental wellness and physical movement',
    icon: 'heartbeat',
    colors: {
      primary: '#10b981', // emerald-500
      secondary: '#059669', // emerald-600
      light: '#d1fae5', // emerald-100
      gradient: ['#10b981', '#059669']
    }
  },
  {
    id: 'nutrition',
    name: 'Nutrition',
    description: 'Healthy eating and hydration',
    icon: 'leaf',
    colors: {
      primary: '#f59e0b', // amber-500
      secondary: '#d97706', // amber-600
      light: '#fef3c7', // amber-100
      gradient: ['#f59e0b', '#d97706']
    }
  },
  {
    id: 'recovery',
    name: 'Recovery',
    description: 'Sleep and relaxation routines',
    icon: 'moon-o',
    colors: {
      primary: '#8b5cf6', // violet-500
      secondary: '#7c3aed', // violet-600
      light: '#ede9fe', // violet-100
      gradient: ['#8b5cf6', '#7c3aed']
    }
  },
  {
    id: 'mindfulness',
    name: 'Mindfulness',
    description: 'Meditation and mental clarity',
    icon: 'lightbulb-o',
    colors: {
      primary: '#3b82f6', // blue-500
      secondary: '#2563eb', // blue-600
      light: '#dbeafe', // blue-100
      gradient: ['#3b82f6', '#2563eb']
    }
  },
  {
    id: 'energy',
    name: 'Energy',
    description: 'Boosting vitality and motivation',
    icon: 'bolt',
    colors: {
      primary: '#ef4444', // red-500
      secondary: '#dc2626', // red-600
      light: '#fee2e2', // red-100
      gradient: ['#ef4444', '#dc2626']
    }
  }
];

export const WELLNESS_SUGGESTIONS: WellnessSuggestion[] = [
  // Mind & Body
  {
    id: 'breathing-exercises',
    title: 'Breathing Exercises',
    description: 'Practice mindful breathing to reduce stress and regain focus',
    icon: 'leaf',
    category: WELLNESS_CATEGORIES[0], // Mind & Body
    duration: '5 minutes',
    difficulty: 'easy',
    tags: ['stress', 'focus', 'calm'],
    longDescription: 'Deep breathing exercises help activate your parasympathetic nervous system, effectively reducing stress levels and promoting a state of calm. This practice can improve focus and emotional regulation.',
    tips: ['Inhale for 4 seconds', 'Hold for 7 seconds', 'Exhale for 8 seconds']
  },
  {
    id: 'take-a-walk',
    title: 'Take a Walk',
    description: 'Enjoy a brisk walk outdoors to boost mood and circulation',
    icon: 'road',
    category: WELLNESS_CATEGORIES[0], // Mind & Body
    duration: '15 minutes',
    difficulty: 'easy',
    tags: ['mood', 'circulation', 'outdoor'],
    longDescription: 'Walking is a simple yet powerful way to clear your mind and improve physical health. A 15-minute brisk walk can boost your energy for up to two hours.',
    tips: ['Maintain a brisk pace', 'Swing your arms naturally', 'Keep your head up']
  },
  {
    id: 'stretching',
    title: 'Gentle Stretching',
    description: 'Release tension with gentle stretches for your neck and shoulders',
    icon: 'hand-paper-o',
    category: WELLNESS_CATEGORIES[0], // Mind & Body
    duration: '10 minutes',
    difficulty: 'easy',
    tags: ['tension', 'flexibility', 'relaxation'],
    longDescription: 'Gentle stretching increases blood flow to your muscles and can help reduce stiffness and pain associated with poor posture.',
    tips: ['Hold each stretch for 15-30 seconds', 'Do not bounce', 'Breathe deeply']
  },
  {
    id: 'posture-reset',
    title: 'Posture Reset',
    description: 'Riallinea la postura.',
    icon: 'hand-paper-o',
    category: WELLNESS_CATEGORIES[0], // Mind & Body
    duration: '3 minutes',
    difficulty: 'easy',
    tags: ['posture', 'relaxation'],
    longDescription: 'A quick posture check can prevent back pain and improve breathing. Align your ears with your shoulders and your shoulders with your hips.',
    tips: ['Stand against a wall', 'Tuck your chin slightly', 'Engage your core']
  },
  {
    id: 'yoga-flow',
    title: 'Yoga Flow',
    description: 'Connect mind and body with a gentle yoga sequence',
    icon: 'heart',
    category: WELLNESS_CATEGORIES[0], // Mind & Body
    duration: '20 minutes',
    difficulty: 'medium',
    tags: ['flexibility', 'strength', 'balance'],
    longDescription: 'Yoga combines physical postures, breathing techniques, and meditation. It promotes physical strength and mental relaxation.',
    tips: ['Focus on your breath', 'Listen to your body', 'Move with intention']
  },

  // Nutrition
  {
    id: 'hydration',
    title: 'Hydration',
    description: 'Sip water steadily throughout the day to keep skin luminous',
    icon: 'tint',
    category: WELLNESS_CATEGORIES[1], // Nutrition
    duration: 'Ongoing',
    difficulty: 'easy',
    tags: ['skin', 'health', 'hydration'],
    longDescription: 'Proper hydration is essential for digestion, skin health, and energy levels. Aim for 8 glasses of water a day.',
    tips: ['Keep a water bottle nearby', 'Set reminders to drink', 'Infuse with fruit for flavor']
  },
  {
    id: 'healthy-snack',
    title: 'Healthy Snack',
    description: 'Choose nutrient-rich snacks like nuts or fresh fruit',
    icon: 'apple',
    category: WELLNESS_CATEGORIES[1], // Nutrition
    duration: '5 minutes',
    difficulty: 'easy',
    tags: ['nutrition', 'energy', 'health'],
    longDescription: 'Smart snacking maintains blood sugar levels and prevents overeating at meals. Choose whole foods over processed snacks.',
    tips: ['Pair protein with fiber', 'Plan snacks ahead', 'Eat mindfully']
  },
  {
    id: 'green-tea',
    title: 'Green Tea Break',
    description: 'Enjoy antioxidant-rich green tea for a calming moment',
    icon: 'coffee',
    category: WELLNESS_CATEGORIES[1], // Nutrition
    duration: '10 minutes',
    difficulty: 'easy',
    tags: ['antioxidants', 'calm', 'health'],
    longDescription: 'Green tea contains L-theanine, which promotes relaxation without drowsiness. It is also packed with antioxidants.',
    tips: ['Brew at 80°C', 'Steep for 3 minutes', 'Avoid sweeteners if possible']
  },

  // Recovery
  {
    id: 'evening-routine',
    title: 'Evening Routine',
    description: 'Dim the lights and avoid screens 60 minutes before bedtime',
    icon: 'moon-o',
    category: WELLNESS_CATEGORIES[2], // Recovery
    duration: '60 minutes',
    difficulty: 'medium',
    tags: ['sleep', 'routine', 'rest'],
    longDescription: 'A consistent evening routine signals to your body that it is time to wind down, improving sleep quality.',
    tips: ['Avoid blue light', 'Read a paper book', 'Prepare for the next day']
  },
  {
    id: 'progressive-relaxation',
    title: 'Progressive Relaxation',
    description: 'Tense and release each muscle group for deep relaxation',
    icon: 'bed',
    category: WELLNESS_CATEGORIES[2], // Recovery
    duration: '15 minutes',
    difficulty: 'easy',
    tags: ['relaxation', 'sleep', 'tension'],
    longDescription: 'PMR helps you distinguish between tension and relaxation, effectively reducing physical stress and anxiety.',
    tips: ['Start from your feet', 'Tense for 5 seconds', 'Release for 10 seconds']
  },
  {
    id: 'sleep-meditation',
    title: 'Sleep Meditation',
    description: 'Guided meditation to prepare your mind for restful sleep',
    icon: 'moon-o',
    category: WELLNESS_CATEGORIES[2], // Recovery
    duration: '20 minutes',
    difficulty: 'easy',
    tags: ['meditation', 'sleep', 'calm'],
    longDescription: 'Sleep meditation helps quiet the racing mind and relax the body, making it easier to fall asleep.',
    tips: ['Lie comfortably', 'Close your eyes', 'Let go of the day']
  },

  // Mindfulness
  {
    id: 'mindfulness-meditation',
    title: 'Mindfulness Meditation',
    description: 'Focus on the present moment with guided mindfulness practice',
    icon: 'lightbulb-o',
    category: WELLNESS_CATEGORIES[3], // Mindfulness
    duration: '10 minutes',
    difficulty: 'medium',
    tags: ['mindfulness', 'present', 'awareness'],
    longDescription: 'Mindfulness improves mental clarity and emotional intelligence by training your attention to the present moment.',
    tips: ['Observe your thoughts', 'Do not judge', 'Return to your breath']
  },
  {
    id: 'gratitude-practice',
    title: 'Gratitude Practice',
    description: 'Reflect on three things you\'re grateful for today',
    icon: 'heart',
    category: WELLNESS_CATEGORIES[3], // Mindfulness
    duration: '5 minutes',
    difficulty: 'easy',
    tags: ['gratitude', 'positivity', 'reflection'],
    longDescription: 'Practicing gratitude shifts your focus from what is lacking to what you have, boosting overall happiness.',
    tips: ['Be specific', 'Feel the emotion', 'Write it down']
  },
  {
    id: 'body-scan',
    title: 'Body Scan',
    description: 'Bring awareness to each part of your body for relaxation',
    icon: 'user',
    category: WELLNESS_CATEGORIES[3], // Mindfulness
    duration: '15 minutes',
    difficulty: 'medium',
    tags: ['awareness', 'relaxation', 'body'],
    longDescription: 'A body scan meditation promotes body awareness and releases physical tension you might not be aware of.',
    tips: ['Start at toes', 'Move slowly up', 'Notice sensations']
  },

  // Energy
  {
    id: 'morning-energy',
    title: 'Morning Energy Boost',
    description: 'Start your day with energizing movements and positive affirmations',
    icon: 'sun-o',
    category: WELLNESS_CATEGORIES[4], // Energy
    duration: '10 minutes',
    difficulty: 'easy',
    tags: ['morning', 'energy', 'motivation'],
    longDescription: 'Starting your day with movement wakes up your metabolism and sets a positive tone for the day ahead.',
    tips: ['Drink water first', 'Stretch upwards', 'Set an intention']
  },
  {
    id: 'power-breathing',
    title: 'Power Breathing',
    description: 'Energizing breathing exercises to boost alertness and focus',
    icon: 'fire',
    category: WELLNESS_CATEGORIES[4], // Energy
    duration: '5 minutes',
    difficulty: 'easy',
    tags: ['energy', 'focus', 'alertness'],
    longDescription: 'Rapid, rhythmic breathing can invigorate your nervous system and increase oxygen flow to the brain.',
    tips: ['Sit upright', 'Breathe through nose', 'Keep a steady rhythm']
  },
  {
    id: 'dance-break',
    title: 'Dance Break',
    description: 'Move your body to your favorite music for an instant energy boost',
    icon: 'music',
    category: WELLNESS_CATEGORIES[4], // Energy
    duration: '5 minutes',
    difficulty: 'easy',
    tags: ['fun', 'energy', 'movement'],
    longDescription: 'Dancing releases endorphins and gets your heart rate up, making it a perfect quick energy booster.',
    tips: ['Pick an upbeat song', 'Don\'t worry about looks', 'Have fun']
  }
];

// Helper functions
export const getSuggestionsByCategory = (categoryId: string): WellnessSuggestion[] => {
  return WELLNESS_SUGGESTIONS.filter(suggestion => suggestion.category.id === categoryId);
};

export const getSuggestionById = (id: string): WellnessSuggestion | undefined => {
  return WELLNESS_SUGGESTIONS.find(suggestion => suggestion.id === id);
};

export const getSuggestionsByTags = (tags: string[]): WellnessSuggestion[] => {
  return WELLNESS_SUGGESTIONS.filter(suggestion =>
    tags.some(tag => suggestion.tags.includes(tag))
  );
};

export const getRandomSuggestion = (): WellnessSuggestion => {
  const randomIndex = Math.floor(Math.random() * WELLNESS_SUGGESTIONS.length);
  return WELLNESS_SUGGESTIONS[randomIndex];
};

export const getSuggestionsByDifficulty = (difficulty: 'easy' | 'medium' | 'hard'): WellnessSuggestion[] => {
  return WELLNESS_SUGGESTIONS.filter(suggestion => suggestion.difficulty === difficulty);
};