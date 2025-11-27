# Analytics e Crash Reporting - Guida Completa

## 📊 Come Funziona Google Analytics

### Cos'è Google Analytics?
Google Analytics è un servizio di analytics web/mobile che traccia:
- **Eventi**: Azioni degli utenti (click, apertura schermata, completamento analisi)
- **Sessioni**: Visite degli utenti all'app
- **Utenti**: Numero di utenti unici
- **Conversioni**: Obiettivi raggiunti (es. completamento onboarding)

### Come Funziona Tecnicamente?

1. **SDK Integration**:
   - Installi l'SDK di Google Analytics (es. `@react-native-firebase/analytics`)
   - L'SDK invia eventi a Google tramite API

2. **Event Tracking**:
   ```typescript
   // Esempio: traccia un evento
   analytics().logEvent('food_analysis_started', {
     meal_type: 'lunch',
     source: 'camera'
   });
   ```

3. **Data Collection**:
   - Google raccoglie dati anonimizzati (device ID, OS, versione app)
   - **NON raccoglie dati personali** (nome, email, contenuti sensibili)
   - I dati vengono aggregati e mostrati in dashboard

4. **Privacy Concerns**:
   - ⚠️ Google Analytics è di proprietà di Google
   - ⚠️ I dati vengono inviati a server Google
   - ⚠️ Non è GDPR-compliant di default (richiede consenso esplicito)
   - ⚠️ Non è privacy-first

### Perché NON lo Usiamo?
- **Privacy**: L'app è orientata alla privacy (E2E encryption)
- **GDPR**: Richiede consenso esplicito e può essere problematico
- **Controllo**: Non abbiamo controllo completo sui dati
- **Alternativa**: Possiamo usare Supabase (già presente) per analytics custom

---

## 🛠️ Soluzione Consigliata

### 1. **Crash Reporting: Sentry** ✅

**Perché Sentry?**
- ✅ Supporto nativo per Expo
- ✅ Piano gratuito generoso (5,000 eventi/mese)
- ✅ Source maps per debugging
- ✅ Performance monitoring
- ✅ Privacy-friendly (possiamo anonimizzare dati)
- ✅ Industry standard

**Cosa Traccia?**
- Crash e errori JavaScript
- Performance issues
- Network errors
- User feedback

**Privacy:**
- Possiamo anonimizzare user ID
- Possiamo escludere dati sensibili
- Possiamo disabilitare in produzione se necessario

---

### 2. **Analytics: Custom con Supabase** ✅

**Perché Custom?**
- ✅ Privacy-first (dati su Supabase, nostro controllo)
- ✅ GDPR-compliant (anonimizzato)
- ✅ Nessun vendor esterno
- ✅ Già abbiamo Supabase
- ✅ Possiamo disabilitare facilmente

**Cosa Traccia?**
- Eventi base (inizio analisi, completamento, errori)
- Feature usage (quali feature usano i tester)
- Performance metrics (tempo di risposta)
- **NON traccia dati personali** (contenuti, nomi, email)

**Architettura:**
```
App → AnalyticsService → Supabase (anonimizzato)
```

---

### 3. **Alternativa: PostHog** (Opzionale)

**Perché PostHog?**
- ✅ Open source
- ✅ Privacy-first
- ✅ Self-hostable
- ✅ GDPR-compliant
- ✅ Analytics avanzati

**Quando Usarlo?**
- Se vogliamo analytics più avanzati (funnels, cohorts, etc.)
- Se vogliamo self-hosting completo
- Se vogliamo più features di analytics

**Per ora**: Non necessario, Supabase è sufficiente per le nostre esigenze.

---

## 📋 Implementazione

### Metriche Base da Tracciare

1. **Eventi Analisi**:
   - `analysis_started` (emotion/skin/food)
   - `analysis_completed` (emotion/skin/food)
   - `analysis_error` (emotion/skin/food)

2. **Feature Usage**:
   - `recipe_generated` (da fridge/restaurant)
   - `recipe_saved`
   - `meal_planned`
   - `journal_entry_created`
   - `chat_message_sent`

3. **Onboarding**:
   - `onboarding_started`
   - `onboarding_completed`
   - `onboarding_skipped`

4. **Errori**:
   - Crash automatici (Sentry)
   - Errori API
   - Errori database

---

## 🔒 Privacy e Anonimizzazione

### Dati Anonimizzati
- ✅ User ID hash (non user_id reale)
- ✅ Device type (iOS/Android)
- ✅ App version
- ✅ Event name
- ✅ Timestamp
- ❌ NO contenuti personali
- ❌ NO nomi, email, dati sensibili
- ❌ NO contenuti di chat/journal

### Remote Logging
- ✅ Abilitato solo se anonimizzato
- ✅ Possibilità di disabilitare in produzione
- ✅ Configurabile via environment variable

---

## 📦 Dipendenze

### Sentry
```bash
pnpm add @sentry/react-native
```

### Supabase (già presente)
- Usiamo la tabella `analytics_events` per eventi anonimizzati

---

## 🚀 Setup

### 1. Sentry Setup
1. Crea account su [sentry.io](https://sentry.io)
2. Crea progetto React Native
3. Ottieni DSN
4. Configura in `app.json` e codice

### 2. Analytics Setup
1. Crea tabella `analytics_events` in Supabase
2. Configura RLS (Row Level Security)
3. Abilita/disabilita via environment variable

---

## 📊 Dashboard

### Sentry Dashboard
- Crash reports
- Error trends
- Performance metrics
- User feedback

### Supabase Dashboard (Custom)
- Event counts
- Feature usage
- Error rates
- User engagement

---

## ✅ Checklist

- [ ] Installare Sentry
- [ ] Configurare Sentry DSN
- [ ] Creare tabella `analytics_events` in Supabase
- [ ] Implementare `AnalyticsService`
- [ ] Integrare con `EnhancedLoggingService`
- [ ] Aggiungere eventi base (analisi, feature usage)
- [ ] Testare anonimizzazione
- [ ] Configurare remote logging on/off
- [ ] Documentare eventi tracciati


