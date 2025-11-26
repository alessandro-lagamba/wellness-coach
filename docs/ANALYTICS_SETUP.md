# Setup Analytics e Crash Reporting

## 📋 Panoramica

L'app usa due sistemi per monitoraggio e debugging:

1. **Sentry** - Crash reporting e error tracking (opzionale)
2. **Analytics Service** - Event tracking privacy-first con Supabase

---

## 🛠️ Setup Sentry (Opzionale)

### 1. Creare Account Sentry

1. Vai su [sentry.io](https://sentry.io)
2. Crea un account gratuito
3. Crea un nuovo progetto "React Native"
4. Copia il DSN (Data Source Name)

### 2. Installare Dipendenze

```bash
cd WellnessCoach/mobile
pnpm add @sentry/react-native
pnpm add -D @sentry/wizard
```

### 3. Configurare Sentry

```bash
# Esegui il wizard di Sentry (configura automaticamente iOS e Android)
npx @sentry/wizard -i reactNative -p ios android
```

### 4. Aggiungere DSN a `.env`

Aggiungi al file `.env` (o `.env.local`):

```bash
EXPO_PUBLIC_SENTRY_DSN=https://your-dsn@sentry.io/project-id
```

### 5. Verificare Configurazione

Il servizio Sentry è già integrato in `services/sentry.service.ts` e viene inizializzato automaticamente all'avvio dell'app.

**Nota**: Sentry è abilitato solo in produzione (non in development) e solo se `EXPO_PUBLIC_SENTRY_DSN` è configurato.

---

## 📊 Setup Analytics (Supabase)

### 1. Creare Tabella in Supabase

Esegui la migration SQL:

```bash
# Via Supabase Dashboard:
# 1. Vai su SQL Editor
# 2. Esegui il contenuto di: WellnessCoach/mobile/migrations/create_analytics_events_table.sql
```

Oppure usa l'MCP di Supabase:

```typescript
// Il file SQL è già pronto in:
// WellnessCoach/mobile/migrations/create_analytics_events_table.sql
```

### 2. Configurare Remote Logging

Per abilitare/disabilitare remote logging, modifica:

**Opzione 1: Environment Variable**

Aggiungi a `.env`:
```bash
EXPO_PUBLIC_ENABLE_ANALYTICS=true  # true per abilitare, false per disabilitare
```

**Opzione 2: Codice**

Modifica `services/analytics.service.ts`:
```typescript
const ENABLE_REMOTE_LOGGING = __DEV__ || process.env.EXPO_PUBLIC_ENABLE_ANALYTICS === 'true';
```

**Nota**: 
- In development (`__DEV__`), il logging è sempre abilitato (solo console)
- In produzione, il remote logging è controllato da `EXPO_PUBLIC_ENABLE_ANALYTICS`

### 3. Verificare Configurazione

Il servizio Analytics è già integrato e viene inizializzato automaticamente all'avvio dell'app in `app/_layout.tsx`.

---

## 📈 Eventi Tracciati

### Analisi

```typescript
// Inizio analisi
AnalyticsService.trackAnalysisStarted('emotion', 'camera');

// Completamento analisi
AnalyticsService.trackAnalysisCompleted('emotion', 5000, 'camera');

// Errore analisi
AnalyticsService.trackAnalysisError('emotion', 'camera_error', 'Failed to capture');
```

### Feature Usage

```typescript
// Uso di una feature
AnalyticsService.trackFeatureUsage('recipe_generation', {
  source: 'fridge',
  meal_type: 'lunch',
});

// Evento generico
AnalyticsService.trackEvent('recipe_saved', {
  recipe_id: 'recipe_123', // Non PII
  meal_type: 'dinner',
});
```

### Errori

```typescript
// Errore API
AnalyticsService.trackError('api_error', 'Failed to fetch recipes', {
  endpoint: '/api/recipes',
  status_code: 500,
});

// Errore database
AnalyticsService.trackError('database_error', 'Failed to save recipe');
```

---

## 🔒 Privacy e Anonimizzazione

### Dati Anonimizzati

- ✅ **User ID Hash**: SHA-256 hash del user_id (non user_id reale)
- ✅ **Device Type**: iOS/Android/Web
- ✅ **App Version**: Versione app
- ✅ **OS Version**: Versione OS
- ✅ **Event Type**: Tipo evento
- ✅ **Properties**: Proprietà evento (senza PII)

### Dati NON Tracciati

- ❌ **Email**: Mai tracciata
- ❌ **Nome**: Mai tracciato
- ❌ **Contenuti**: Chat, journal, analisi non vengono tracciati
- ❌ **Dati Sensibili**: Password, token, API key mai tracciati

### Sanitizzazione

Il servizio Analytics sanitizza automaticamente:
- Email addresses → `[email_redacted]`
- URLs → `[url_redacted]`
- Campi PII (email, name, phone, etc.) → Rimossi

---

## 📊 Query Analytics in Supabase

### Eventi per Tipo

```sql
SELECT 
  event_type,
  COUNT(*) as count
FROM analytics_events
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY event_type
ORDER BY count DESC;
```

### Feature Usage

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

### Errori

```sql
SELECT 
  event_type,
  properties->>'error_type' as error_type,
  COUNT(*) as error_count
FROM analytics_events
WHERE event_type IN ('api_error', 'database_error', 'network_error')
  AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY event_type, error_type
ORDER BY error_count DESC;
```

### Utenti Attivi

```sql
SELECT 
  DATE(created_at) as date,
  COUNT(DISTINCT user_id_hash) as active_users
FROM analytics_events
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

---

## 🧪 Testing

### Test Analytics

```typescript
// In una schermata di test
import { AnalyticsService } from '../services/analytics.service';

// Test evento
await AnalyticsService.trackEvent('test_event', {
  test_property: 'test_value',
});

// Verifica in Supabase
// SELECT * FROM analytics_events WHERE event_type = 'test_event' ORDER BY created_at DESC LIMIT 1;
```

### Test Sentry

```typescript
// In una schermata di test
import { captureException } from '../services/sentry.service';

// Test errore
try {
  throw new Error('Test error');
} catch (error) {
  captureException(error as Error, { test: true });
}

// Verifica in Sentry Dashboard
```

---

## 🚨 Troubleshooting

### Sentry non funziona

1. **Verifica DSN**: Controlla che `EXPO_PUBLIC_SENTRY_DSN` sia configurato
2. **Verifica Build**: Sentry funziona solo in produzione, non in development
3. **Verifica Installazione**: `pnpm list @sentry/react-native`
4. **Verifica Logs**: Controlla console per messaggi `[Sentry]`

### Analytics non funziona

1. **Verifica Tabella**: Controlla che `analytics_events` esista in Supabase
2. **Verifica RLS**: Controlla che le policy RLS siano corrette
3. **Verifica Remote Logging**: Controlla `ENABLE_REMOTE_LOGGING` in `analytics.service.ts`
4. **Verifica Logs**: Controlla console per messaggi `[Analytics]`

### Eventi non appaiono in Supabase

1. **Verifica Permessi**: Controlla che l'app abbia permessi di INSERT
2. **Verifica RLS**: Controlla che la policy "Anyone can insert" sia attiva
3. **Verifica Network**: Controlla che l'app possa raggiungere Supabase
4. **Verifica Logs**: Controlla console per errori `[Analytics]`

---

## 📝 Checklist Setup

- [ ] Account Sentry creato
- [ ] DSN Sentry configurato in `.env`
- [ ] `@sentry/react-native` installato
- [ ] `@sentry/wizard` eseguito
- [ ] Tabella `analytics_events` creata in Supabase
- [ ] RLS policies configurate
- [ ] `EXPO_PUBLIC_ENABLE_ANALYTICS` configurato (opzionale)
- [ ] Test eventi funzionanti
- [ ] Test Sentry funzionante

---

## 🎯 Prossimi Passi

1. **Aggiungere Eventi**: Aggiungi tracking eventi nelle schermate principali
2. **Dashboard**: Crea dashboard Supabase per visualizzare analytics
3. **Alerting**: Configura alert Sentry per errori critici
4. **Performance**: Monitora performance con Sentry Performance Monitoring

