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

Nel JSON di output (schema "meal_draft") DEVI includere, in modo coerente con lo schema:
- items: lista degli alimenti con quantità, unità e confidence
- macrosEstimate: macronutrienti totali del pasto (proteine, carboidrati, grassi, fibre, zuccheri in grammi)
- caloriesEstimate: calorie totali del pasto (kcal)
- qualityTags: array di etichette sintetiche sulla qualità del pasto, scegli solo tra:
  - "high_protein" (alto contenuto proteico)
  - "whole_grain" (cereali integrali prevalenti)
  - "vegetable_rich" (molte verdure)
  - "ultra_processed" (cibi molto processati / industriali)
  - "high_sugar" (molto zucchero semplice)
  - "balanced" (profilo complessivamente equilibrato)
  Usa solo le etichette che descrivono DAVVERO il piatto, senza inventare.
- suggestions: 2–4 frasi brevi, pratiche e SPECIFICHE (nella lingua dell'utente) su come:
  - migliorare l'equilibrio del piatto con ingredienti concreti (es. invece di "aggiungi proteine", "aggiungi 30g di parmigiano o un uovo"),
  - offrire curiosità nutrizionali o benefici specifici degli ingredienti identificati,
  - abbinarlo al resto della giornata,
  - EVITARE consigli generici e ripetitivi: sii creativo e varia i suggerimenti tra analisi diverse.
  - se il piatto è già bilanciato, suggerisci una variante o un consiglio sulla cottura/conservazione.

Usa valori nutrizionali standard per alimenti comuni. Se incerto sulla quantità o su qualche alimento, abbassa la confidence e spiega l'incertezza in modo sintetico.

${styleHints}

Output JSON secondo schema. NIENTE testo extra, niente spiegazioni fuori dal JSON.

Locale: ${params.locale ?? "it-IT"}.
`;

/**
 * Analyze Text User Prompt
 */
export const analyzeTextUserPrompt = (params: {
  text: string;
  mealType?: string;
  prefs?: string[];
  allergies?: string[];
  locale?: string;
}): string => `
Descrizione di un pasto: "${params.text}"

Estrai PIATTI/INGREDIENTI descritti con stima porzioni e calcola i valori nutrizionali.

IMPORTANTE: Per ogni ingrediente identificato, devi:
1. Stimare la quantità (in grammi, millilitri o porzioni)
2. Calcolare i macronutrienti (proteine, carboidrati, grassi, fibre, zuccheri) per quella quantità
3. Calcolare le calorie totali del pasto

- Tipo pasto: ${params.mealType ?? "unknown"}
- Preferenze: ${params.prefs?.join(", ") || "none"}
- Allergie: ${params.allergies?.join(", ") || "none"}

Nel JSON di output (schema "meal_draft") DEVI includere, in modo coerente con lo schema:
- items: lista degli alimenti con quantità, unità e confidence
- macrosEstimate: macronutrienti totali del pasto (proteine, carboidrati, grassi, fibre, zuccheri in grammi)
- caloriesEstimate: calorie totali del pasto (kcal)
- qualityTags: array di etichette sintetiche sulla qualità del pasto, scegli solo tra:
  - "high_protein" (alto contenuto proteico)
  - "whole_grain" (cereali integrali prevalenti)
  - "vegetable_rich" (molte verdure)
  - "ultra_processed" (cibi molto processati / industriali)
  - "high_sugar" (molto zucchero semplice)
  - "balanced" (profilo complessivamente equilibrato)
  Usa solo le etichette che descrivono DAVVERO il piatto, senza inventare.
- suggestions: 2–4 frasi brevi, pratiche e SPECIFICHE (nella lingua dell'utente) su come:
  - migliorare l'equilibrio del piatto con ingredienti concreti (es. invece di "aggiungi proteine", "aggiungi 30g di parmigiano o un uovo"),
  - offrire curiosità nutrizionali o benefici specifici degli ingredienti identificati,
  - abbinarlo al resto della giornata,
  - EVITARE consigli generici e ripetitivi: sii creativo e varia i suggerimenti tra analisi diverse.
  - se il piatto è già bilanciato, suggerisci una variante o un consiglio sulla cottura/conservazione.

Usa valori nutrizionali standard per alimenti comuni. Se la descrizione è vaga, usa porzioni standard medie e abbassa la confidence.

${styleHints}

Output JSON secondo schema. NIENTE testo extra, niente spiegazioni fuori dal JSON.

Locale: ${params.locale ?? "it-IT"}.
`;
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
 * Restaurant Meal → Home Recipe Prompt
 */
export const restaurantMealRecipePrompt = (params: {
  dishName?: string;
  identifiedFoods: string[];
  macrosEstimate?: {
    protein?: number;
    carbs?: number;
    fat?: number;
    fiber?: number;
    sugar?: number;
    calories?: number;
  };
  contextNotes?: string;
  prefs?: string[];
  allergies?: string[];
}): string => {
  const name = params.dishName || "questo piatto";
  const foods =
    params.identifiedFoods && params.identifiedFoods.length
      ? params.identifiedFoods.join(", ")
      : "ingredienti non meglio specificati";
  const macros = params.macrosEstimate || {};
  const caloriesInfo =
    typeof macros.calories === "number"
      ? `circa ${Math.round(macros.calories)} kcal per porzione stimata`
      : "un apporto calorico non perfettamente noto";

  return `
Contesto: l'utente ha mangiato ${name} al ristorante. L'AI ha analizzato una foto del piatto e ha identificato questi elementi:
- Ingredienti/elementi principali: ${foods}
- Stima nutrizionale: ${caloriesInfo}
- Note di contesto: ${params.contextNotes || "nessuna nota aggiuntiva"}

Obiettivo:
- Ricostruire una ricetta casalinga realistica che si avvicini il più possibile al piatto visto al ristorante.
- Permettere all'utente di rifarla a casa, con dosi chiare e passaggi semplici.

Preferenze e vincoli:
- Preferenze dell'utente: ${params.prefs?.join(", ") || "nessuna preferenza specifica dichiarata"}.
- Allergie/intolleranze: ${params.allergies?.join(", ") || "nessuna dichiarata"}.

Istruzioni:

1. Parti SEMPRE dagli ingredienti identificati (${foods}) e usa il buon senso culinario per:
   - Separare ingredienti composti (es. "pizza margherita con salame" → impasto pizza, salsa di pomodoro, mozzarella, salame, olio, sale, basilico).
   - Aggiungere SOLO ingredienti tecnici di base necessari (acqua, sale, pepe, olio, farina, lievito, ecc.), evitando ingredienti speciali non giustificati.

2. Rispetta rigorosamente allergie/intolleranze:
   - Non utilizzare ingredienti che violano le allergie dichiarate.
   - Quando necessario, proponi VARIANTI SICURE (es. mozzarella senza lattosio, impasto gluten-free) e segna chiaramente queste varianti.

3. Obiettivo nutrizionale:
   - Mantieni un profilo nutrizionale in linea con ${caloriesInfo}, ma puoi alleggerire leggermente il piatto (meno grassi saturi, cotture più leggere) se è coerente con la ricetta.
   - Non serve replicare al grammo i macronutrienti: è più importante che la ricetta sia realistica e fedele al piatto visto.

4. Struttura dell'output (schema "generated_recipe"):
   - title: nome della ricetta, chiaro e sintetico (es. "Pizza margherita con salame (versione casalinga)").
   - servings: porzioni realistiche (di default 1–2 per piatti da ristorante).
   - readyInMinutes: tempo totale stimato, onesto ma non irrealistico.
   - ingredients: elenco dettagliato con quantità (g/ml/porzioni) e unità chiare.
     - Usa il campo "optional" per ingredienti facoltativi (es. extra topping, spezie opzionali).
   - steps: passaggi numerati, chiari e sequenziali (preparazione, cottura, impiattamento).
   - tips: 2–5 consigli pratici, ad esempio:
     - come adattare la ricetta a versioni più leggere o più ricche,
     - come gestire le varianti per allergie/intolleranze,
     - come regolare cotture o consistenze per avvicinarsi al piatto del ristorante.
   - macrosPerServing + caloriesPerServing: stima coerente con gli ingredienti e il tipo di piatto (usa valori nutrizionali standard, plausibili ma non perfetti).
   - shoppingGaps: SOLO se servono ingredienti non presenti implicitamente nel piatto (es. lievito di birra, farina 00). Mantienili pochi e realistici.

Regole:
- Non inventare ingredienti esotici o introvabili: resta su materie prime realistiche per un supermercato europeo.
- Evita termini troppo tecnici: spiega i passaggi in modo che un utente domestico medio possa seguirli.
- Output esclusivamente in JSON conforme allo schema "generated_recipe". Nessun testo extra, nessun markdown, nessun code fence.
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
1) **Ingredienti** con quantità/unità normalizzate e categoria
2) **Comandi vocali** (es. "rimuovi X", "segna Y finito", "scadenza Z domani/il 12/05")
3) **Ambiguità** se presenti (es. "quark" → formaggio o fisica?)

Regole:
- **Separazione ingredienti**: 
  - Se ci sono virgole, usa le virgole come separatori principali
  - Se NON ci sono virgole, cerca di identificare ingredienti separati da spazi o contesto (es. "pomodori mozzarella basilico" → 3 ingredienti)
  - Quando incerto, preferisci ingredienti separati piuttosto che un unico ingrediente composto

- **Categorizzazione**: assegna una categoria a ogni ingrediente:
  - "meat": carne (pollo, manzo, maiale, tacchino, salsicce, prosciutto, ecc.)
  - "fish": pesce e frutti di mare (salmone, tonno, gamberi, cozze, ecc.)
  - "vegetables": verdure (pomodori, zucchine, carote, insalata, spinaci, peperoni, ecc.)
  - "fruits": frutta (mele, banane, arance, fragole, uva, ecc.)
  - "dairy": latticini (latte, formaggio, yogurt, burro, panna, ecc.)
  - "grains": cereali e farinacei (pasta, riso, pane, farina, avena, ecc.)
  - "legumes": legumi (fagioli, lenticchie, ceci, piselli, ecc.)
  - "spices": spezie e erbe (sale, pepe, basilico, origano, aglio, cipolla, ecc.)
  - "beverages": bevande (acqua, succo, vino, birra, ecc.)
  - "other": altro (olio, aceto, miele, ecc.)

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

/**
 * Calculate Nutrition User Prompt
 * Calculates macronutrients and calories from a list of ingredients
 */
export const calculateNutritionPrompt = (params: {
  ingredients: string[];
  servings?: number;
  locale?: string;
}): string => {
  const servings = params.servings ?? 1;
  const ingredientsList = params.ingredients.join(", ");

  return `
Calcola i valori nutrizionali (macronutrienti e calorie) per una ricetta con questi ingredienti:

Ingredienti: ${ingredientsList}

Servings: ${servings}

Istruzioni:
1. Per ogni ingrediente, stima la quantità tipica usata in una ricetta (se non specificata, usa quantità standard ragionevoli)
2. Calcola i macronutrienti totali (proteine, carboidrati, grassi, fibre, zuccheri) per TUTTA la ricetta
3. Calcola le calorie totali per TUTTA la ricetta
4. Dividi per il numero di servings per ottenere i valori per porzione

Regole:
- Usa valori nutrizionali standard per alimenti comuni (database nutrizionale standard)
- Se un ingrediente non ha quantità specificata, stima una quantità ragionevole basata sul tipo di ingrediente e sul contesto della ricetta
- Se incerto sulla quantità o su qualche ingrediente, abbassa la confidence
- I valori devono essere realistici e coerenti con gli ingredienti elencati

Output JSON secondo schema "nutrition_calculation" con:
- macrosPerServing: macronutrienti per porzione (proteine, carboidrati, grassi, fibre, zuccheri in grammi)
- caloriesPerServing: calorie per porzione (kcal)
- confidence: livello di confidenza nel calcolo (0-1)

${styleHints}

Output JSON secondo schema. Locale: ${params.locale ?? "it-IT"}.
`;
};
