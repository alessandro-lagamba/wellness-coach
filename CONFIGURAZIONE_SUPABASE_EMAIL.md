# Configurazione Supabase per Conferma Email

## 🔍 Problema Risolto

Quando un utente si registra, Supabase invia un'email di conferma. Il link nell'email deve aprire l'app mobile invece di puntare a `localhost:3000`.

## ✅ Soluzione Implementata

### 1. Codice Aggiornato

**File modificato:** `WellnessCoach/mobile/services/auth.service.ts`

Il metodo `signUp` ora include il `redirectTo` corretto:
```typescript
emailRedirectTo: 'wellnesscoach://auth/confirm'
```

**File modificato:** `WellnessCoach/mobile/components/AuthWrapper.tsx`

Aggiunto listener per gestire i deep links quando l'utente clicca sul link nell'email:
- Gestisce `wellnesscoach://auth/confirm` quando l'app si apre
- Verifica automaticamente l'email e completa l'autenticazione

### 2. Configurazione Supabase Dashboard

**⚠️ IMPORTANTE:** Devi configurare il redirect URL nel dashboard di Supabase:

1. **Accedi al Dashboard Supabase:**
   - Vai su: https://supabase.com/dashboard
   - Seleziona il progetto: `nxxuhadbyoznzivktoje`

2. **Configura Redirect URLs:**
   - Vai su: **Authentication** → **URL Configuration**
   - Nella sezione **Redirect URLs**, aggiungi:
     ```
     wellnesscoach://auth/confirm
     ```
   - Clicca **Save**

3. **Configurazione Email Templates (Opzionale):**
   - Vai su: **Authentication** → **Email Templates**
   - Seleziona **Confirm signup**
   - Verifica che il template contenga il link di conferma
   - Il link sarà automaticamente sostituito con `{{ .ConfirmationURL }}`

## 📱 Come Funziona

### Flusso Completo:

1. **Registrazione Utente:**
   - L'utente inserisce email e password nell'app
   - L'app chiama `AuthService.signUp()` con `emailRedirectTo: 'wellnesscoach://auth/confirm'`

2. **Email di Conferma:**
   - Supabase invia un'email all'utente
   - L'email contiene un link con i parametri di autenticazione
   - Il link punta a: `wellnesscoach://auth/confirm#access_token=...&type=...`

3. **Click sul Link:**
   - L'utente clicca sul link nell'email
   - Il sistema operativo apre l'app usando lo schema `wellnesscoach://`
   - L'app riceve il deep link con i parametri hash

4. **Conferma Automatica:**
   - `AuthWrapper` rileva il deep link `auth/confirm`
   - Chiama `supabase.auth.getSession()` che processa automaticamente i parametri hash
   - L'utente viene autenticato automaticamente
   - Il profilo viene creato (se non esiste già)

## 🔧 Verifica Configurazione

### Test Locale (Development):

1. **Verifica Deep Link Schema:**
   ```bash
   # Android
   adb shell am start -W -a android.intent.action.VIEW -d "wellnesscoach://auth/confirm" com.wellnesscoach.app

   # iOS (Simulator)
   xcrun simctl openurl booted "wellnesscoach://auth/confirm"
   ```

2. **Test Email di Conferma:**
   - Registra un nuovo utente nell'app
   - Controlla l'email ricevuta
   - Verifica che il link inizi con `wellnesscoach://auth/confirm`
   - Clicca sul link e verifica che l'app si apra e confermi l'email

### Test Produzione:

1. **Build di Produzione:**
   ```bash
   eas build --platform android --profile production
   eas build --platform ios --profile production
   ```

2. **Installa l'app su un dispositivo fisico**

3. **Registra un nuovo utente**

4. **Verifica l'email e clicca sul link**

5. **L'app dovrebbe aprirsi e confermare automaticamente l'email**

## 🐛 Troubleshooting

### Problema: Il link nell'email punta ancora a `localhost:3000`

**Soluzione:**
1. Verifica che `emailRedirectTo` sia configurato nel codice (già fatto ✅)
2. **IMPORTANTE:** Aggiungi `wellnesscoach://auth/confirm` ai Redirect URLs nel dashboard Supabase
3. Se usi un ambiente di sviluppo, potresti anche aggiungere:
   ```
   exp://localhost:8081/--/auth/confirm
   ```

### Problema: L'app non si apre quando clicco sul link

**Possibili cause:**
1. **Android:** Verifica che lo schema `wellnesscoach` sia configurato in `AndroidManifest.xml` (già fatto ✅)
2. **iOS:** Verifica che lo schema sia in `Info.plist` (già fatto ✅)
3. **App non installata:** L'app deve essere installata sul dispositivo per aprire deep links

### Problema: L'email viene confermata ma l'utente non viene autenticato

**Soluzione:**
1. Verifica che `AuthWrapper` gestisca correttamente il deep link (già implementato ✅)
2. Controlla i log della console per errori
3. Verifica che `supabase.auth.getSession()` venga chiamato correttamente

### Problema: Link non funziona su iOS

**Possibili cause:**
1. **Universal Links:** Se vuoi usare Universal Links invece di Custom URL Schemes, devi configurare un dominio verificato
2. **Custom URL Scheme:** Assicurati che `wellnesscoach://` sia in `Info.plist` (già fatto ✅)
3. **Test:** Prova ad aprire manualmente: `xcrun simctl openurl booted "wellnesscoach://auth/confirm"`

## 📝 Note Aggiuntive

### Redirect URLs Supportati:

- ✅ `wellnesscoach://auth/confirm` - Per conferma email (mobile)
- ✅ `wellnesscoach://reset-password` - Per reset password (già configurato)

### Per Sviluppo Locale:

Se vuoi testare con Expo Go durante lo sviluppo, puoi anche aggiungere:
```
exp://localhost:8081/--/auth/confirm
```

Ma per le build di produzione, usa sempre `wellnesscoach://auth/confirm`.

---

**Ultimo aggiornamento:** Gennaio 2025
**Versione App:** 0.1.0



