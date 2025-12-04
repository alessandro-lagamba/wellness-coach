# Guida alla Distribuzione Interna - Wellness Coach App

## 📱 Panoramica Generale

Questa guida descrive i passaggi necessari per distribuire l'app Wellness Coach ai colleghi per test interni su dispositivi Android e iOS.

---

## 🟢 Android - Test Immediato

### Vantaggi
- ✅ **Nessun account a pagamento** richiesto
- ✅ **Installazione diretta** tramite APK o link di download
- ✅ **Funziona su tutti i dispositivi Android** (fisici e emulatori)
- ✅ **Processo semplice e veloce**

### Step per la Distribuzione Android

#### 1. Creare la Build Android

**Opzione A: Build APK (per installazione diretta)**
```bash
cd WellnessCoach/mobile
eas build --platform android --profile preview
```

**Opzione B: Build AAB (per Google Play Store - futuro)**
```bash
eas build --platform android --profile production
```

#### 2. Ottenere il Link di Download

- EAS genererà automaticamente un link di download
- Il link sarà disponibile su: https://expo.dev/accounts/lbp_manager/projects/wellness-coach/builds
- Il link sarà simile a: `https://expo.dev/artifacts/eas/xxxxx.apk`

#### 3. Distribuire ai Colleghi

**Metodo 1: Link Diretto (Consigliato)**
- Inviare il link via email/Slack/WhatsApp
- I colleghi aprono il link sul loro dispositivo Android
- Il browser scaricherà automaticamente l'APK
- Tappare sul file scaricato per installare

**Metodo 2: Download Manuale**
- Scaricare l'APK dal link
- Condividere il file APK via email/cloud storage
- I colleghi devono scaricare e installare manualmente

#### 4. Abilitare "Origini Sconosciute" (Prima Installazione)

I colleghi devono abilitare l'installazione da fonti sconosciute:

**Android 8.0+ (Oreo):**
1. Impostazioni → Sicurezza → Origini sconosciute
2. Abilitare per il browser utilizzato (Chrome, Firefox, ecc.)

**Android 9.0+ (Pie):**
1. Durante l'installazione, apparirà un prompt
2. Tappare "Impostazioni" → Abilitare "Consenti da questa fonte"

**Nota:** Questo è necessario solo per la prima installazione. Le installazioni successive non richiederanno questo passaggio.

---

## 🍎 iOS - Test con Apple Developer Program

### Requisiti Necessari

- ❌ **Richiede certificati Apple** per installare app su dispositivi fisici
- ✅ **Account Apple Developer Program** (Organization/Company) - **$99 USD/anno** (~€99/anno)
- ✅ **Apple ID aziendale dedicato** (es: `developer@labellapartners.com`)
- ✅ **Rappresentante legale** che conferma l'identità ad Apple
- ✅ **Carta di credito/debito aziendale** per il pagamento

**⚠️ Nota Importante:** Questo è il processo standard richiesto da Apple per tutte le aziende che sviluppano app iOS. Non è possibile bypassare questo requisito.

### Step per la Distribuzione iOS

#### A. Attivare Apple Developer Program (Una Tantum)

**1. Verificare D-U-N-S Number**
- Il D-U-N-S Number è un identificativo univoco dell'azienda
- Verificare se l'azienda ha già un D-U-N-S Number su: https://www.dnb.com/duns-number.html
- Se non esiste, richiederlo (può richiedere 1-2 settimane)

**2. Creare Apple ID Aziendale**
- Creare un nuovo Apple ID dedicato: `developer@labellapartners.com` (o simile)
- **Non usare** un Apple ID personale esistente
- Usare un'email aziendale dedicata

**3. Registrare l'Account Apple Developer**
- Andare su: https://developer.apple.com/programs/
- Cliccare "Enroll" → "Start Your Enrollment"
- Selezionare "Organization" (non "Individual")
- Inserire:
  - D-U-N-S Number
  - Informazioni aziendali
  - Informazioni del rappresentante legale
  - Metodo di pagamento ($99 USD/anno)

**4. Verifica Identità**
- Apple contatterà il rappresentante legale via telefono
- Verificherà l'identità dell'azienda
- Questo processo può richiedere 1-3 giorni lavorativi

**5. Attivazione Account**
- Una volta verificato, l'account sarà attivo
- Riceverai conferma via email
- L'account è valido per 1 anno (rinnovo automatico)

#### B. Configurare EAS con Credenziali Aziendali

**1. Installare EAS CLI (se non già installato)**
```bash
npm install -g eas-cli
```

**2. Accedere a EAS**
```bash
eas login
```

**3. Collegare il Progetto**
```bash
cd WellnessCoach/mobile
eas build:configure
```

**4. Configurare Credenziali iOS**
```bash
eas credentials
```
- Selezionare "iOS"
- Selezionare "Set up credentials for iOS"
- EAS gestirà automaticamente:
  - Certificati di distribuzione
  - Provisioning profiles
  - App Store Connect API Key (se necessario)

**5. Aggiornare `eas.json` (se necessario)**
Il file `eas.json` è già configurato correttamente:
```json
{
  "build": {
    "preview": {
      "distribution": "internal"
    }
  }
}
```

#### C. Aggiungere Colleghi come Developer/Testers

**1. Accedere ad App Store Connect**
- Andare su: https://appstoreconnect.apple.com
- Accedere con l'Apple ID aziendale

**2. Aggiungere Utenti**
- Andare su "Users and Access"
- Cliccare "+" → "Invite Users"
- Inserire email dei colleghi
- Selezionare ruolo:
  - **App Manager**: Può gestire app e builds
  - **Developer**: Può sviluppare e testare
  - **Marketing**: Può gestire marketing e analytics
  - **Customer Support**: Accesso limitato

**3. Inviti Email**
- I colleghi riceveranno un invito via email
- Devono accettare l'invito
- Creare un Apple ID se non ne hanno uno

#### D. Creare Build iOS per Test Interni

**Opzione 1: Build Development (Consigliato per Test Interni)**
```bash
cd WellnessCoach/mobile
eas build --platform ios --profile preview
```

**Opzione 2: Build Production (per TestFlight)**
```bash
eas build --platform ios --profile production
```

#### E. Distribuire ai Colleghi

**Metodo 1: Link Diretto Expo (Più Semplice)**

1. EAS genererà un link di download
2. Il link sarà disponibile su: https://expo.dev/accounts/lbp_manager/projects/wellness-coach/builds
3. I colleghi aprono il link sul loro iPhone
4. Tappare "Installa" → L'app si installerà automaticamente
5. **Prima installazione:** Andare su Impostazioni → Generale → Gestione profili → Fidati del certificato

**Metodo 2: TestFlight (Più Professionale)**

1. **Inviare Build a TestFlight:**
   ```bash
   eas submit --platform ios --profile production
   ```

2. **Aggiungere Testers Interni:**
   - Andare su App Store Connect → TestFlight
   - Selezionare la build
   - Aggiungere colleghi come "Internal Testers"
   - I colleghi riceveranno un invito automatico

3. **Installazione:**
   - I colleghi scaricano l'app TestFlight dall'App Store
   - Accettano l'invito
   - Installano l'app direttamente da TestFlight

**Vantaggi TestFlight:**
- ✅ Distribuzione più professionale
- ✅ Aggiornamenti automatici
- ✅ Feedback integrato
- ✅ Statistiche di utilizzo
- ✅ Nessun certificato da fidarsi manualmente

---

## 📋 Checklist Completa

### Per Android
- [ ] EAS CLI installato e configurato
- [ ] Build APK creata con `eas build --platform android --profile preview`
- [ ] Link di download condiviso con i colleghi
- [ ] Istruzioni per abilitare "Origini sconosciute" fornite

### Per iOS
- [ ] D-U-N-S Number verificato/richiesto
- [ ] Apple ID aziendale creato
- [ ] Apple Developer Program attivato ($99 USD/anno)
- [ ] Rappresentante legale verificato da Apple
- [ ] Colleghi aggiunti su App Store Connect
- [ ] EAS configurato con credenziali iOS
- [ ] Build iOS creata con `eas build --platform ios --profile preview`
- [ ] Link di download condiviso OPPURE build inviata a TestFlight

---

## 🔧 Comandi Utili

### Verificare Stato Build
```bash
eas build:list
```

### Visualizzare Logs Build
```bash
eas build:view [BUILD_ID]
```

### Cancellare Build in Corso
```bash
eas build:cancel [BUILD_ID]
```

### Aggiornare Credenziali
```bash
eas credentials
```

---

## 💡 Note Importanti

1. **Android:** Le build APK possono essere installate su qualsiasi dispositivo Android senza restrizioni (tranne la prima installazione che richiede "Origini sconosciute").

2. **iOS:** Le build iOS possono essere installate solo su dispositivi registrati nel provisioning profile. Con EAS, questo viene gestito automaticamente.

3. **TestFlight:** È il metodo standard utilizzato da tutte le aziende per distribuire app iOS in fase di test. Non richiede pubblicazione sull'App Store pubblico.

4. **Sicurezza:** Le build di sviluppo/preview hanno una durata limitata (circa 90 giorni per iOS). Per distribuzioni a lungo termine, usare TestFlight o produzione.

5. **Costi:**
   - Android: **Gratuito**
   - iOS: **$99 USD/anno** (Apple Developer Program)
   - EAS Build: **Gratuito** per account Expo (con limiti ragionevoli)

---

## 🆘 Supporto

Per problemi o domande:
- Documentazione EAS: https://docs.expo.dev/build/introduction/
- Documentazione Apple Developer: https://developer.apple.com/documentation/
- Supporto Expo: https://expo.dev/support

---

**Ultimo aggiornamento:** Gennaio 2025
**Versione App:** 0.1.0
**Bundle ID:** com.wellnesscoach.app



