/**
 * AI Prompt Helpers
 * Common prompts and guardrails for nutrition and coach services
 */

export const systemGuardrails = `
You are a nutrition assistant. Output **strict JSON** matching the provided schema.

- Units: prefer grams (g), milliliters (ml) or "serving".

- Be conservative on quantity estimates. If uncertain, lower confidence and note assumptions.

- Respect dietary preferences and allergies strictly.

- Prefer Mediterranean-style defaults unless otherwise specified.

- Language: same as user input. If not specified, use Italian.
`;

export const styleHints = `
Short, concrete, helpful. No fluff. Use everyday foods available in EU markets.
`;

/**
 * Analyze Image User Prompt
 */
export const analyzeImageUserPrompt = (params: {
  mealType?: string;
  prefs?: string[];
  allergies?: string[];
  locale?: string;
}): string => `
Foto di un pasto. Estrai PIATTI/INGREDIENTI VISIBILI con stima porzioni e calcola i valori nutrizionali.

IMPORTANTE: Per ogni ingrediente identificato, devi:
1. Stimare la quantità (in grammi, millilitri o porzioni)
2. Calcolare i macronutrienti (proteine, carboidrati, grassi, fibre, zuccheri) per quella quantità
3. Calcolare le calorie totali del pasto

- Tipo pasto: ${params.mealType ?? "unknown"}

- Preferenze: ${params.prefs?.join(", ") || "none"}

- Allergie: ${params.allergies?.join(", ") || "none"}

Calcola e includi nel JSON:
- macrosEstimate: macronutrienti totali del pasto (proteine, carboidrati, grassi, fibre, zuccheri in grammi)
- caloriesEstimate: calorie totali del pasto

Usa valori nutrizionali standard per alimenti comuni. Se incerto sulla quantità, abbassa la confidence.

${styleHints}

Output JSON secondo schema. Niente testo extra.

Locale: ${params.locale ?? "it-IT"}.
`;

/**
 * Suggest Meal User Prompt
 */
export const suggestMealUserPrompt = (body: {
  remainingCalories: number;
  remainingMacros: Partial<{
    protein: number;
    carbs: number;
    fat: number;
    fiber?: number;
    sugar?: number;
  }>;
  prefs?: string[];
  allergies?: string[];
  pantry?: string[];
  timeOfDay?: string;
  maxReadyInMinutes?: number;
  wantType?: string;
}): string => `
Obiettivo: colmare il gap nutrizionale di oggi.

Gap: kcal=${body.remainingCalories} | macros=${JSON.stringify(body.remainingMacros)}

Vincoli: prefs=${body.prefs?.join(",") || "none"}, allergies=${body.allergies?.join(",") || "none"}, timeOfDay=${body.timeOfDay || "any"}, maxReady=${body.maxReadyInMinutes || 30}min

Dispensa: ${body.pantry?.slice(0, 20).join(", ") || "no data"}

Richiesta tipo: ${body.wantType || "auto"} (se "auto": scegli snack se mancano <=250 kcal, altrimenti pasto).

Genera 3–5 suggerimenti realistici, ingredienti con quantità. Macro targetizzati al gap (±15%).

${styleHints}

Output JSON secondo schema.
`;

/**
 * Recipe From Ingredients User Prompt
 */
export const recipeFromIngredientsPrompt = (body: {
  ingredients: string[];
  targetMacros?: Partial<{
    protein: number;
    carbs: number;
    fat: number;
    fiber?: number;
    sugar?: number;
  }>;
  targetCaloriesPerServing?: number;
  servings?: number;
  prefs?: string[];
  allergies?: string[];
  cuisineHint?: string;
  cuisinePreference?: string;
  favoriteIngredients?: string[];
  avoidIngredients?: string[];
  maxReadyInMinutes?: number;
}): string => {
  const allergiesList = body.allergies && body.allergies.length > 0 
    ? body.allergies.join(", ") 
    : "nessuna";
  const avoidList = body.avoidIngredients && body.avoidIngredients.length > 0
    ? body.avoidIngredients.join(", ")
    : "nessuno";
  const cuisine = body.cuisinePreference || body.cuisineHint || "Mediterranea";
  const favoriteIngredientsList = body.favoriteIngredients && body.favoriteIngredients.length > 0
    ? body.favoriteIngredients.join(", ")
    : "nessuna preferenza specifica";

  return `
Crea una ricetta con gli ingredienti disponibili, rispettando STRICTAMENTE preferenze e allergie.

Ingredienti disponibili: ${body.ingredients.join(", ")}

VINCOLI OBBLIGATORI:
- ALLERGIE/INTOLLERANZE (NON USARE MAI): ${allergiesList}
- INGREDIENTI DA EVITARE: ${avoidList}
- Se un ingrediente disponibile contiene o deriva da allergeni/intolleranze dichiarate, devi specificare quale variante SICURA usare (es. latte → latte senza lattosio, pasta → pasta gluten-free). Se non esiste alternativa sicura, escludilo.

PREFERENZE (da privilegiare quando possibile, ma non obbligatorie):
- Tipo di cucina: ${cuisine} (stile culinario da seguire)
- Ingredienti preferiti: ${favoriteIngredientsList} (privilegia questi ingredienti se disponibili e compatibili con la ricetta, ma non sono obbligatori - usa il buon senso)
- Preferenze dietetiche: ${body.prefs?.join(", ") || "nessuna"}

Target (opzionali): kcal/serv=${body.targetCaloriesPerServing ?? "flex"}, macros=${JSON.stringify(body.targetMacros || {})}

Servings: ${body.servings ?? 2}, Max tempo: ${body.maxReadyInMinutes ?? 25} min

Regole:

- ⚠️ CRITICO: NON includere MAI ingredienti che contengono o derivano da: ${allergiesList}. Se necessario, proponi alternative sicure usando solo ingredienti disponibili o le loro varianti sicure (esplicita sempre la variante).
- Vietato citare ingredienti non presenti nella lista degli ingredienti selezionati per la ricetta. Se serve una consistenza simile, usa solo ciò che è disponibile o descrivi come ottenere la variante sicura dello stesso ingrediente.
- Se mancano ingredienti critici, elencali in "shoppingGaps" e proponi sostituzioni pratiche.
- Privilegia lo stile culinario: ${cuisine} (usa tecniche, spezie e combinazioni tipiche di questa cucina).
- Ingredienti preferiti: quando possibile e appropriato, cerca di includere ${favoriteIngredientsList} nella ricetta, ma solo se hanno senso nel contesto e sono disponibili. Non forzare l'inclusione se non sono compatibili.
- Macro per porzione vicine al target (±20%); se non c'è target, mantenere profilo equilibrato (30/40/30).
- Passi chiari e brevi; dosi in g/ml quando possibile.

${styleHints}

Output JSON secondo schema.
`;
};

/**
 * Coach User Prompt
 */
export const coachPrompt = (state: {
  dateISO: string;
  locale?: string;
  remainingCalories: number;
  remainingMacros: Partial<{
    protein: number;
    carbs: number;
    fat: number;
    fiber?: number;
    sugar?: number;
  }>;
  hydrationMlToday?: number;
  hydrationTargetMl?: number;
  sleepHoursLastNight?: number;
  hrvMorning?: number;
  hrvBaseline?: number;
  stepsToday?: number;
  workoutToday?: boolean;
  prefs?: string[];
  allergies?: string[];
  pantry?: string[];
  upcomingEvents?: { start: string; end: string; title: string }[];
}): string => `
Sei un Health Coach. Fornisci **un solo** consiglio prioritario adesso.

Stato:

- kcal restanti: ${state.remainingCalories}

- macro restanti: ${JSON.stringify(state.remainingMacros)}

- idratazione: ${state.hydrationMlToday ?? 0}/${state.hydrationTargetMl ?? 2000} ml

- sonno: ${state.sleepHoursLastNight ?? "unk"} h | HRV oggi: ${state.hrvMorning ?? "unk"} vs baseline ${state.hrvBaseline ?? "unk"}

- passi: ${state.stepsToday ?? 0} | workout oggi: ${state.workoutToday ? "sì" : "no"}

- preferenze: ${state.prefs?.join(",") || "none"} | allergie: ${state.allergies?.join(",") || "none"}

- dispensa: ${state.pantry?.slice(0, 20).join(", ") || "n/a"}

- eventi prossimi: ${state.upcomingEvents?.length ?? 0}

Regole:

1) Scegli la categoria più urgente (es.: macro gap >250 kcal → nutrition; idratazione <50% a metà giornata → hydration; HRV << baseline → recovery).

2) Messaggio breve e concreto, tono incoraggiante.

3) CTA **eseguibile** con payload utile (es. per SUGGEST_MEAL includi remainingMacros/pantry).

4) Evita di generare promemoria ridondanti.

${styleHints}

Output JSON secondo schema. Locale: ${state.locale ?? "it-IT"}.
`;

/**
 * Parse Ingredients User Prompt
 * Extracts ingredients from voice/text input with normalization
 */
export const parseIngredientsUserPrompt = (params: {
  text: string;
  locale?: string;
}): string => `
Testo dettato dall'utente (può contenere ingredienti, quantità, unità, scadenze, comandi):

"${params.text}"

Estrai:
1) **Ingredienti** con quantità/unità normalizzate
2) **Comandi vocali** (es. "rimuovi X", "segna Y finito", "scadenza Z domani/il 12/05")
3) **Ambiguità** se presenti (es. "quark" → formaggio o fisica?)

Regole:
- **Unità**: normalizza a g/ml/pcs/serving
  - "grammi", "g", "kg" (→ g), "etti", "etto", "hg" (→ 100g), "mezzo chilo" (→ 500g)
  - "millilitri", "ml", "litri", "l" (→ ml), "bicchiere" (→ 200ml), "cucchiaio" (→ 15ml), "cucchiaino" (→ 5ml)
  - "pezzi", "pcs", "x4", "4 uova" (→ pcs), "fetta" (→ 1 pcs)
  - "porzione", "serving" (→ serving)

- **Quantità**: estrai numeri, frazioni ("mezzo" = 0.5), multipli ("x4" = 4)
  - Se manca quantità: usa default ragionevole (uova → 1 pcs, latte → 200ml, pomodori → 200g)

- **Scadenze**: riconosci "domani", "dopodomani", date (DD/MM, DD/MM/YYYY), "tra 3 giorni"
  - Converti in formato YYYY-MM-DD

- **Comandi vocali**:
  - "rimuovi [X]", "elimina [X]", "togli [X]" → command: remove, ingredientName: X
  - "segna [X] finito", "[X] finito", "ho finito [X]" → command: mark_finished, ingredientName: X
  - "scadenza [X] [data]", "[X] scade [data]" → command: update_expiry, ingredientName: X, expiry: [data]

- **Sinonimi alimentari**: riconosci varianti comuni
  - "pomodori pelati" = pomodori pelati (barattolo), "mele golden" = mele, "latte intero" = latte

- **Confidence**: se incerto (es. unità mancante, nome ambiguo), abbassa confidence e aggiungi note

- **Ambiguità**: se un termine può riferirsi a più cose, elencali in "ambiguous"

${styleHints}

Output JSON secondo schema. Locale: ${params.locale ?? "it-IT"}.
`;

