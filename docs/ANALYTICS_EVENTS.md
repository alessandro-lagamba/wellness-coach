# Eventi Analytics - Riferimento Completo

## 📊 Eventi Implementati

### Analisi

#### `analysis_started`
Traccia quando un'analisi viene avviata.

**Proprietà**:
- `analysis_type`: `'emotion' | 'skin' | 'food'`
- `source`: `'camera' | 'gallery' | 'manual'` (opzionale)

**Esempio**:
```typescript
AnalyticsService.trackAnalysisStarted('emotion', 'camera');
```

#### `analysis_completed`
Traccia quando un'analisi viene completata con successo.

**Proprietà**:
- `analysis_type`: `'emotion' | 'skin' | 'food'`
- `duration_ms`: Durata in millisecondi (opzionale)
- `source`: `'camera' | 'gallery' | 'manual'` (opzionale)

**Esempio**:
```typescript
AnalyticsService.trackAnalysisCompleted('emotion', 5000, 'camera');
```

#### `analysis_error`
Traccia quando un'analisi fallisce.

**Proprietà**:
- `analysis_type`: `'emotion' | 'skin' | 'food'`
- `error_type`: Tipo di errore (es. `'camera_error'`, `'api_error'`)
- `error_message`: Messaggio di errore (anonimizzato)

**Esempio**:
```typescript
AnalyticsService.trackAnalysisError('emotion', 'camera_error', 'Failed to capture');
```

#### `analysis_cancelled`
Traccia quando un'analisi viene cancellata dall'utente.

**Proprietà**:
- `analysis_type`: `'emotion' | 'skin' | 'food'`
- `source`: `'camera' | 'gallery' | 'manual'` (opzionale)

**Esempio**:
```typescript
AnalyticsService.trackEvent('analysis_cancelled', {
  analysis_type: 'emotion',
  source: 'camera',
});
```

---

### Feature Usage

#### `recipe_generated`
Traccia quando una ricetta viene generata.

**Proprietà**:
- `source`: `'fridge' | 'restaurant' | 'manual'`
- `meal_type`: `'breakfast' | 'lunch' | 'dinner' | 'snack'` (opzionale)

**Esempio**:
```typescript
AnalyticsService.trackEvent('recipe_generated', {
  source: 'fridge',
  meal_type: 'lunch',
});
```

#### `recipe_saved`
Traccia quando una ricetta viene salvata.

**Proprietà**:
- `meal_type`: `'breakfast' | 'lunch' | 'dinner' | 'snack'` (opzionale)
- `source`: `'generated' | 'manual' | 'restaurant'` (opzionale)

**Esempio**:
```typescript
AnalyticsService.trackEvent('recipe_saved', {
  meal_type: 'dinner',
  source: 'generated',
});
```

#### `recipe_viewed`
Traccia quando una ricetta viene visualizzata.

**Proprietà**:
- `meal_type`: `'breakfast' | 'lunch' | 'dinner' | 'snack'` (opzionale)

**Esempio**:
```typescript
AnalyticsService.trackEvent('recipe_viewed', {
  meal_type: 'lunch',
});
```

#### `meal_planned`
Traccia quando un pasto viene aggiunto al meal planner.

**Proprietà**:
- `meal_type`: `'breakfast' | 'lunch' | 'dinner' | 'snack'`
- `source`: `'analysis' | 'recipe' | 'manual'` (opzionale)

**Esempio**:
```typescript
AnalyticsService.trackEvent('meal_planned', {
  meal_type: 'lunch',
  source: 'analysis',
});
```

#### `journal_entry_created`
Traccia quando una entry del diario viene creata.

**Proprietà**:
- `has_ai_analysis`: `boolean` (opzionale)

**Esempio**:
```typescript
AnalyticsService.trackEvent('journal_entry_created', {
  has_ai_analysis: true,
});
```

#### `chat_message_sent`
Traccia quando un messaggio chat viene inviato.

**Proprietà**:
- `message_length`: Lunghezza del messaggio in caratteri (opzionale)
- `has_attachment`: `boolean` (opzionale)

**Esempio**:
```typescript
AnalyticsService.trackEvent('chat_message_sent', {
  message_length: 50,
  has_attachment: false,
});
```

#### `widget_added`
Traccia quando un widget viene aggiunto alla home.

**Proprietà**:
- `widget_id`: ID del widget (es. `'mood'`, `'sleep'`, `'cycle'`)

**Esempio**:
```typescript
AnalyticsService.trackEvent('widget_added', {
  widget_id: 'mood',
});
```

#### `widget_removed`
Traccia quando un widget viene rimosso dalla home.

**Proprietà**:
- `widget_id`: ID del widget

**Esempio**:
```typescript
AnalyticsService.trackEvent('widget_removed', {
  widget_id: 'mood',
});
```

---

### Onboarding

#### `onboarding_started`
Traccia quando l'onboarding viene avviato.

**Proprietà**:
- `source`: `'signup' | 'first_launch'` (opzionale)

**Esempio**:
```typescript
AnalyticsService.trackEvent('onboarding_started', {
  source: 'signup',
});
```

#### `onboarding_completed`
Traccia quando l'onboarding viene completato.

**Proprietà**:
- `steps_completed`: Numero di step completati (opzionale)

**Esempio**:
```typescript
AnalyticsService.trackEvent('onboarding_completed', {
  steps_completed: 5,
});
```

#### `onboarding_skipped`
Traccia quando l'onboarding viene saltato.

**Proprietà**:
- `step_skipped`: Step saltato (opzionale)

**Esempio**:
```typescript
AnalyticsService.trackEvent('onboarding_skipped', {
  step_skipped: 'permissions',
});
```

---

### Navigation

#### `screen_viewed`
Traccia quando una schermata viene visualizzata.

**Proprietà**:
- `feature`: Nome della feature/schermata (es. `'home'`, `'food_analysis'`, `'chat'`)

**Esempio**:
```typescript
AnalyticsService.trackFeatureUsage('food_analysis');
// o
AnalyticsService.trackEvent('screen_viewed', {
  feature: 'food_analysis',
});
```

---

### Errori

#### `api_error`
Traccia errori API.

**Proprietà**:
- `error_type`: Tipo di errore (es. `'network'`, `'timeout'`, `'server_error'`)
- `error_message`: Messaggio di errore (anonimizzato)
- `metadata`: Metadati aggiuntivi (opzionale)

**Esempio**:
```typescript
AnalyticsService.trackError('api_error', 'Failed to fetch recipes', {
  endpoint: '/api/recipes',
  status_code: 500,
});
```

#### `database_error`
Traccia errori database.

**Proprietà**:
- `error_type`: Tipo di errore (es. `'insert_failed'`, `'query_failed'`)
- `error_message`: Messaggio di errore (anonimizzato)
- `metadata`: Metadati aggiuntivi (opzionale)

**Esempio**:
```typescript
AnalyticsService.trackError('database_error', 'Failed to save recipe');
```

#### `network_error`
Traccia errori di rete.

**Proprietà**:
- `error_type`: Tipo di errore (es. `'timeout'`, `'connection_failed'`)
- `error_message`: Messaggio di errore (anonimizzato)
- `metadata`: Metadati aggiuntivi (opzionale)

**Esempio**:
```typescript
AnalyticsService.trackError('network_error', 'Connection timeout');
```

---

### Performance

#### `slow_operation`
Traccia operazioni lente.

**Proprietà**:
- `feature`: Nome dell'operazione (es. `'food_analysis'`, `'recipe_generation'`)
- `duration_ms`: Durata in millisecondi
- `metadata`: Metadati aggiuntivi (opzionale)

**Esempio**:
```typescript
AnalyticsService.trackPerformanceIssue('food_analysis', 5000, 3000);
```

#### `timeout_error`
Traccia errori di timeout.

**Proprietà**:
- `feature`: Nome dell'operazione
- `timeout_ms`: Timeout in millisecondi
- `metadata`: Metadati aggiuntivi (opzionale)

**Esempio**:
```typescript
AnalyticsService.trackEvent('timeout_error', {
  feature: 'food_analysis',
  timeout_ms: 30000,
});
```

---

## 🔧 Integrazione nelle Schermate

### Esempio: FoodAnalysisScreen

```typescript
import { AnalyticsService } from '../services/analytics.service';

// All'inizio dell'analisi
const startAnalysis = async () => {
  await AnalyticsService.trackAnalysisStarted('food', 'camera');
  // ... resto del codice
};

// Al completamento
const completeAnalysis = async (duration: number) => {
  await AnalyticsService.trackAnalysisCompleted('food', duration, 'camera');
  // ... resto del codice
};

// In caso di errore
const handleError = async (error: Error) => {
  await AnalyticsService.trackAnalysisError('food', 'camera_error', error.message);
  // ... resto del codice
};
```

### Esempio: RecipeHubModal

```typescript
import { AnalyticsService } from '../services/analytics.service';

// Quando una ricetta viene salvata
const saveRecipe = async () => {
  await AnalyticsService.trackEvent('recipe_saved', {
    meal_type: 'lunch',
    source: 'generated',
  });
  // ... resto del codice
};

// Quando una ricetta viene visualizzata
const viewRecipe = async () => {
  await AnalyticsService.trackEvent('recipe_viewed', {
    meal_type: 'lunch',
  });
  // ... resto del codice
};
```

---

## 📊 Query Utili

### Eventi più frequenti (ultimi 7 giorni)

```sql
SELECT 
  event_type,
  COUNT(*) as count
FROM analytics_events
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY event_type
ORDER BY count DESC;
```

### Tasso di completamento analisi

```sql
SELECT 
  properties->>'analysis_type' as analysis_type,
  COUNT(*) FILTER (WHERE event_type = 'analysis_started') as started,
  COUNT(*) FILTER (WHERE event_type = 'analysis_completed') as completed,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE event_type = 'analysis_completed') / 
    NULLIF(COUNT(*) FILTER (WHERE event_type = 'analysis_started'), 0),
    2
  ) as completion_rate
FROM analytics_events
WHERE event_type IN ('analysis_started', 'analysis_completed')
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY properties->>'analysis_type';
```

### Feature più usate

```sql
SELECT 
  properties->>'feature' as feature,
  COUNT(*) as usage_count
FROM analytics_events
WHERE event_type = 'screen_viewed'
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY feature
ORDER BY usage_count DESC;
```

---

## 🎯 Best Practices

1. **Traccia eventi significativi**: Non tracciare ogni click, solo eventi importanti
2. **Usa proprietà consistenti**: Usa sempre gli stessi nomi per le proprietà
3. **Non tracciare PII**: Mai tracciare email, nome, contenuti personali
4. **Usa helper methods**: Usa `trackAnalysisStarted()` invece di `trackEvent()` quando possibile
5. **Gestisci errori**: Non bloccare l'app se analytics fallisce

---

## 📝 Checklist Implementazione

- [ ] Aggiungere `trackAnalysisStarted()` in tutte le schermate di analisi
- [ ] Aggiungere `trackAnalysisCompleted()` in tutte le schermate di analisi
- [ ] Aggiungere `trackAnalysisError()` in tutti i catch blocks
- [ ] Aggiungere `trackFeatureUsage()` nelle schermate principali
- [ ] Aggiungere `trackEvent()` per feature usage (recipe, meal plan, etc.)
- [ ] Testare eventi in development
- [ ] Verificare eventi in Supabase
- [ ] Creare dashboard Supabase per visualizzare analytics


