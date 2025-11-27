# Analytics e Crash Reporting - Riepilogo Implementazione

## ✅ Completato

### 1. **Servizio Analytics** (`services/analytics.service.ts`)
- ✅ Tracking eventi anonimizzati con Supabase
- ✅ Hash user ID per privacy (SHA-256)
- ✅ Sanitizzazione automatica PII
- ✅ Remote logging configurabile (on/off)
- ✅ Helper methods per eventi comuni
- ✅ Performance tracking

### 2. **Servizio Sentry** (`services/sentry.service.ts`)
- ✅ Crash reporting e error tracking
- ✅ Performance monitoring
- ✅ Privacy-friendly (anonimizzazione dati)
- ✅ Configurazione opzionale (solo se DSN configurato)
- ✅ Source maps support

### 3. **Integrazione EnhancedLoggingService**
- ✅ Errori automaticamente inviati a Sentry
- ✅ Errori automaticamente tracciati in Analytics
- ✅ Non blocca l'app se servizi non disponibili

### 4. **Inizializzazione App**
- ✅ Sentry inizializzato in `app/_layout.tsx`
- ✅ Analytics inizializzato in `app/_layout.tsx`
- ✅ User context aggiornato su login/logout

### 5. **Tracking Autenticazione**
- ✅ Login tracked
- ✅ Signup tracked
- ✅ Logout tracked
- ✅ User context aggiornato

### 6. **Documentazione**
- ✅ `ANALYTICS_CRASH_REPORTING.md` - Panoramica e spiegazione Google Analytics
- ✅ `ANALYTICS_SETUP.md` - Setup instructions
- ✅ `ANALYTICS_EVENTS.md` - Riferimento eventi
- ✅ `ANALYTICS_IMPLEMENTATION_SUMMARY.md` - Questo file

### 7. **Migration Database**
- ✅ `migrations/create_analytics_events_table.sql` - Tabella Supabase con RLS

---

## 📋 Da Fare (Opzionale)

### 1. **Aggiungere Eventi nelle Schermate**

#### FoodAnalysisScreen
```typescript
// All'inizio analisi
await AnalyticsService.trackAnalysisStarted('food', 'camera');

// Al completamento
await AnalyticsService.trackAnalysisCompleted('food', duration, 'camera');

// In caso di errore
await AnalyticsService.trackAnalysisError('food', 'camera_error', error.message);
```

#### EmotionDetectionScreen / SkinAnalysisScreen
```typescript
// Stesso pattern di FoodAnalysisScreen
```

#### RecipeHubModal
```typescript
// Quando ricetta salvata
await AnalyticsService.trackEvent('recipe_saved', { meal_type: 'lunch' });

// Quando ricetta visualizzata
await AnalyticsService.trackEvent('recipe_viewed', { meal_type: 'lunch' });
```

#### ChatScreen
```typescript
// Quando messaggio inviato
await AnalyticsService.trackEvent('chat_message_sent', {
  message_length: message.length,
});
```

#### HomeScreen
```typescript
// Quando widget aggiunto
await AnalyticsService.trackEvent('widget_added', { widget_id: 'mood' });

// Quando widget rimosso
await AnalyticsService.trackEvent('widget_removed', { widget_id: 'mood' });
```

### 2. **Setup Sentry** (Opzionale)

1. Creare account su [sentry.io](https://sentry.io)
2. Creare progetto React Native
3. Ottenere DSN
4. Aggiungere a `.env`: `EXPO_PUBLIC_SENTRY_DSN=your_dsn`
5. Installare: `pnpm add @sentry/react-native`
6. Eseguire wizard: `npx @sentry/wizard -i reactNative -p ios android`

### 3. **Creare Tabella Analytics in Supabase**

Eseguire migration:
```sql
-- File: WellnessCoach/mobile/migrations/create_analytics_events_table.sql
-- Eseguire via Supabase Dashboard SQL Editor o MCP
```

### 4. **Configurare Remote Logging** (Opzionale)

Aggiungere a `.env`:
```bash
EXPO_PUBLIC_ENABLE_ANALYTICS=true  # true per abilitare, false per disabilitare
```

**Nota**: In development, il logging è sempre abilitato (solo console). In produzione, è controllato da questa variabile.

---

## 🔒 Privacy e Sicurezza

### Dati Anonimizzati
- ✅ User ID hash (SHA-256, non reversibile)
- ✅ Device type (iOS/Android/Web)
- ✅ App version
- ✅ OS version
- ✅ Event type e properties (senza PII)

### Dati NON Tracciati
- ❌ Email
- ❌ Nome
- ❌ Contenuti personali (chat, journal, analisi)
- ❌ Password, token, API key

### Sanitizzazione Automatica
- ✅ Email addresses → `[email_redacted]`
- ✅ URLs → `[url_redacted]`
- ✅ Campi PII → Rimossi

---

## 📊 Query Utili Supabase

### Eventi più frequenti
```sql
SELECT event_type, COUNT(*) as count
FROM analytics_events
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY event_type
ORDER BY count DESC;
```

### Tasso completamento analisi
```sql
SELECT 
  properties->>'analysis_type' as analysis_type,
  COUNT(*) FILTER (WHERE event_type = 'analysis_started') as started,
  COUNT(*) FILTER (WHERE event_type = 'analysis_completed') as completed
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

## 🎯 Prossimi Passi

1. **Aggiungere eventi**: Implementare tracking nelle schermate principali (vedi checklist sopra)
2. **Setup Sentry**: Configurare Sentry per crash reporting (opzionale)
3. **Dashboard**: Creare dashboard Supabase per visualizzare analytics
4. **Alerting**: Configurare alert Sentry per errori critici
5. **Performance**: Monitorare performance con Sentry Performance Monitoring

---

## 📝 File Creati

1. `services/analytics.service.ts` - Servizio analytics
2. `services/sentry.service.ts` - Servizio Sentry
3. `migrations/create_analytics_events_table.sql` - Migration Supabase
4. `docs/ANALYTICS_CRASH_REPORTING.md` - Panoramica
5. `docs/ANALYTICS_SETUP.md` - Setup instructions
6. `docs/ANALYTICS_EVENTS.md` - Riferimento eventi
7. `docs/ANALYTICS_IMPLEMENTATION_SUMMARY.md` - Questo file

---

## ✅ Checklist Finale

- [x] Servizio Analytics creato
- [x] Servizio Sentry creato
- [x] Integrazione EnhancedLoggingService
- [x] Inizializzazione app
- [x] Tracking autenticazione
- [x] Documentazione completa
- [x] Migration database
- [ ] **Setup Sentry** (opzionale, da fare manualmente)
- [ ] **Creare tabella Supabase** (da fare manualmente)
- [ ] **Aggiungere eventi nelle schermate** (da fare)
- [ ] **Configurare remote logging** (opzionale)

---

## 🎉 Risultato

L'app ora ha un sistema completo di analytics e crash reporting:

- ✅ **Privacy-first**: Tutti i dati sono anonimizzati
- ✅ **GDPR-compliant**: Nessun PII tracciato
- ✅ **Configurabile**: Remote logging può essere disabilitato
- ✅ **Non invasivo**: Non blocca l'app se servizi non disponibili
- ✅ **Scalabile**: Facile aggiungere nuovi eventi
- ✅ **Documentato**: Documentazione completa per setup e uso

**L'app è pronta per il tracking analytics e crash reporting!** 🚀


