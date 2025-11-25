import { MealType, UserRecipe } from '../services/recipe-library.service';
import { MealPlanMealType } from '../services/meal-plan.service';

export type TimeFilter = 'all' | 'quick' | 'balanced' | 'slow';

export const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export const getDefaultMealType = (recipe?: UserRecipe): MealPlanMealType => {
  if (recipe?.meal_types?.length) {
    const candidate = recipe.meal_types[0] as MealPlanMealType;
    if (MEAL_TYPES.includes(candidate)) {
      return candidate;
    }
  }
  return 'dinner';
};

export const getWeekStart = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day + 6) % 7; // Monday as first day of week
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const addDays = (date: Date, days: number) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

export const formatShortDate = (date: Date, language: string) =>
  new Intl.DateTimeFormat(language === 'it' ? 'it-IT' : 'en-US', {
    weekday: 'short',
    day: 'numeric',
  }).format(date);

export const toISODate = (date: Date) => date.toISOString().split('T')[0];

export const classifyTimeBucket = (minutes?: number | null): TimeFilter => {
  if (!minutes || minutes <= 0) return 'balanced';
  if (minutes <= 20) return 'quick';
  if (minutes <= 40) return 'balanced';
  return 'slow';
};

export const getDefaultRecipe = (mealType: string) => {
  const defaultRecipes: Record<string, any> = {
    breakfast: {
      title: 'Colazione Proteica Completa',
      servings: 1,
      readyInMinutes: 15,
      ingredients: [
        { name: 'Uova', quantity: 2, unit: 'pcs' },
        { name: 'Pane integrale', quantity: 2, unit: 'fette' },
        { name: 'Avocado', quantity: 0.5, unit: 'pcs' },
        { name: 'Pomodori', quantity: 2, unit: 'pcs' },
        { name: "Olio d'oliva", quantity: 5, unit: 'ml' },
      ],
      steps: [
        'Scalda una padella antiaderente e cuoci le uova come preferisci (fritte, strapazzate o in camicia).',
        "Tosta il pane integrale e spalma l'avocado.",
        'Taglia i pomodori a fette e disponili sul pane.',
        "Aggiungi le uova e condisci con olio d'oliva, sale e pepe.",
      ],
      tips: [
        'Per un pasto più saziante, aggiungi una fonte di proteine come formaggio fresco o prosciutto.',
        "L'avocado fornisce grassi sani che aiutano l'assorbimento delle vitamine liposolubili.",
      ],
      macrosPerServing: { protein: 20, carbs: 35, fat: 25 },
      caloriesPerServing: 420,
      shoppingGaps: [],
    },
    lunch: {
      title: 'Insalata Mediterranea con Pollo',
      servings: 1,
      readyInMinutes: 20,
      ingredients: [
        { name: 'Petto di pollo', quantity: 150, unit: 'g' },
        { name: 'Insalata mista', quantity: 100, unit: 'g' },
        { name: 'Pomodori ciliegini', quantity: 100, unit: 'g' },
        { name: 'Cetrioli', quantity: 50, unit: 'g' },
        { name: 'Feta', quantity: 50, unit: 'g' },
        { name: "Olio d'oliva", quantity: 10, unit: 'ml' },
        { name: 'Limone', quantity: 0.5, unit: 'pcs' },
      ],
      steps: [
        "Cuoci il petto di pollo in padella con un filo d'olio per 8-10 minuti per lato.",
        'Taglia il pollo a strisce e lascia raffreddare leggermente.',
        'Prepara l’insalata lavando e tagliando tutti gli ingredienti freschi.',
        'Aggiungi la feta a cubetti e il pollo.',
        'Condisci con olio d’oliva, succo di limone, sale e pepe.',
      ],
      tips: [
        'Puoi preparare il pollo in anticipo e tenerlo in frigorifero per un pasto veloce.',
        'Aggiungi noci o mandorle per aumentare i grassi sani e le proteine.',
      ],
      macrosPerServing: { protein: 45, carbs: 15, fat: 20 },
      caloriesPerServing: 380,
      shoppingGaps: [],
    },
    dinner: {
      title: 'Salmone con Verdure al Forno',
      servings: 1,
      readyInMinutes: 25,
      ingredients: [
        { name: 'Filetto di salmone', quantity: 150, unit: 'g' },
        { name: 'Zucchine', quantity: 150, unit: 'g' },
        { name: 'Peperoni', quantity: 100, unit: 'g' },
        { name: 'Patate dolci', quantity: 100, unit: 'g' },
        { name: "Olio d'oliva", quantity: 15, unit: 'ml' },
        { name: 'Erbe aromatiche', quantity: 5, unit: 'g' },
      ],
      steps: [
        'Preriscalda il forno a 200°C.',
        'Taglia le verdure a cubetti e disponile su una teglia con carta forno.',
        'Condisci le verdure con olio d’oliva, sale, pepe e erbe aromatiche.',
        'Cuoci le verdure per 15 minuti, poi aggiungi il salmone e cuoci per altri 10 minuti.',
        "Servi caldo con un filo d'olio d'oliva.",
      ],
      tips: [
        'Il salmone è ricco di omega-3, importanti per la salute del cuore.',
        'Le patate dolci forniscono carboidrati complessi per energia duratura.',
      ],
      macrosPerServing: { protein: 35, carbs: 40, fat: 22 },
      caloriesPerServing: 480,
      shoppingGaps: [],
    },
    snack: {
      title: 'Smoothie Verde Energizzante',
      servings: 1,
      readyInMinutes: 5,
      ingredients: [
        { name: 'Spinaci freschi', quantity: 50, unit: 'g' },
        { name: 'Banana', quantity: 1, unit: 'pcs' },
        { name: 'Yogurt greco', quantity: 100, unit: 'g' },
        { name: 'Mirtilli', quantity: 50, unit: 'g' },
        { name: 'Miele', quantity: 10, unit: 'ml' },
        { name: 'Acqua o latte', quantity: 100, unit: 'ml' },
      ],
      steps: [
        'Lava gli spinaci e taglia la banana a pezzi.',
        'Aggiungi tutti gli ingredienti in un frullatore.',
        'Frulla per 1-2 minuti fino a ottenere una consistenza liscia.',
        'Versa in un bicchiere e gusta immediatamente.',
      ],
      tips: [
        'Sostituisci il miele con datteri se desideri un dolcificante naturale diverso.',
        'Aggiungi semi di chia per più fibre e omega-3.',
      ],
      macrosPerServing: { protein: 18, carbs: 42, fat: 10 },
      caloriesPerServing: 320,
      shoppingGaps: [],
    },
  };

  return defaultRecipes[mealType] || defaultRecipes.breakfast;
};


