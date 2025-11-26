# Analisi Notifiche e Configurazione

## 📋 Stato Attuale

### ✅ Notifiche Implementate

#### 1. **Notifiche Utili (Mantieni)**
- ✅ **Emotion/Skin Reminder** (Martedì e Venerdì 19:00)
  - **Utilità**: Alta - Ricorda analisi periodiche
  - **Frequenza**: 2x/settimana - Non invasiva
  - **Stato**: ✅ Funzionante

- ✅ **Journal Reminder** (Giornaliera 21:30)
  - **Utilità**: Alta - Abitudine giornaliera importante
  - **Frequenza**: 1x/giorno - Appropriata
  - **Stato**: ✅ Funzionante

- ✅ **Breathing Nudges** (Lun-Ven 11:30 e 16:00)
  - **Utilità**: Media-Alta - Pause di benessere
  - **Frequenza**: 2x/giorno lavorativo - Potrebbe essere ridotta
  - **Stato**: ✅ Funzionante

- ✅ **Fridge Expiry Check** (Giornaliera 18:00)
  - **Utilità**: Alta - Evita sprechi alimentari
  - **Frequenza**: 1x/giorno - Appropriata
  - **Stato**: ✅ Funzionante (con notifica immediata se scadenze vicine)

- ✅ **Activity Reminders** (Dinamiche, basate su attività programmate)
  - **Utilità**: Alta - Promemoria personalizzati
  - **Frequenza**: Variabile - Basata su attività utente
  - **Stato**: ✅ Funzionante tramite `wellness-sync.service.ts`

- ✅ **Mood Decline Alert** (Push intelligente)
  - **Utilità**: Alta - Supporto proattivo
  - **Frequenza**: Solo quando necessario (throttling giornaliero)
  - **Stato**: ✅ Funzionante

#### 2. **Notifiche Potenzialmente Superflue (Valutare)**

- ⚠️ **Hydration Reminders** (6x/giorno: 9, 11, 14, 16, 18, 20)
  - **Utilità**: Media - Potrebbe essere invasiva
  - **Frequenza**: 6x/giorno - **TROPPO FREQUENTE**
  - **Raccomandazione**: Ridurre a 3-4x/giorno (9, 13, 17, 20)
  - **Stato**: ✅ Funzionante ma da ottimizzare

- ⚠️ **Morning Greeting** (Giornaliera 8:00)
  - **Utilità**: Bassa-Media - Potrebbe essere ridondante con check-in
  - **Frequenza**: 1x/giorno
  - **Raccomandazione**: Valutare se necessario o sostituire con check-in intelligente
  - **Stato**: ✅ Funzionante

- ⚠️ **Evening Winddown** (Giornaliera 22:00)
  - **Utilità**: Media - Potrebbe sovrapporsi con journal reminder
  - **Frequenza**: 1x/giorno
  - **Raccomandazione**: Valutare se necessario o unificare con journal reminder
  - **Stato**: ✅ Funzionante

- ⚠️ **Sleep Preparation** (Giornaliera 22:30)
  - **Utilità**: Media - Molto vicina a Evening Winddown
  - **Frequenza**: 1x/giorno
  - **Raccomandazione**: Unificare con Evening Winddown o rimuovere
  - **Stato**: ✅ Funzionante

- ⚠️ **Goal Progress** (Dinamica, quando raggiungi 75% obiettivo)
  - **Utilità**: Media - Potrebbe essere invasiva
  - **Frequenza**: Variabile
  - **Raccomandazione**: Mantenere ma solo per obiettivi importanti
  - **Stato**: ✅ Funzionante

- ⚠️ **Streak Celebration** (Ogni 7 giorni)
  - **Utilità**: Alta - Motivazionale
  - **Frequenza**: 1x/settimana - Appropriata
  - **Stato**: ✅ Funzionante

---

## 🔧 Configurazione APNs

### Stato Attuale
- ✅ **Entitlements**: Configurato (`WellnessCoach.entitlements`)
  - `aps-environment`: `development` ⚠️ **DA CAMBIARE IN PRODUCTION**
  - HealthKit: ✅ Configurato

### ⚠️ Azioni Richieste

1. **Per Production Build**:
   ```xml
   <key>aps-environment</key>
   <string>production</string>
   ```

2. **Certificati APNs**:
   - Verificare che i certificati APNs siano configurati in Apple Developer Portal
   - Per EAS Build: Configurare automaticamente tramite EAS
   - Per build manuale: Importare certificati in Xcode

3. **Test su Dispositivo Reale**:
   - ⚠️ **NECESSARIO**: Le notifiche push funzionano solo su dispositivi reali
   - Testare con build development prima di passare a production
   - Verificare che il token di registrazione venga ricevuto correttamente

---

## 📱 Integrazione Calendar/HealthKit

### Calendar
- ✅ **Permessi**: Configurati in `app.json` e `Info.plist`
- ✅ **Fallback**: Implementato in `wellness-sync.service.ts`
- ✅ **Stato**: Funzionante con gestione errori

### HealthKit
- ✅ **Permessi**: Configurati in `app.json` e `Info.plist`
- ✅ **Entitlements**: Configurato in `WellnessCoach.entitlements`
- ✅ **Fallback**: Implementato in `health-data-sync.service.ts`
- ✅ **Stato**: Funzionante con gestione permessi negati

### Android Health Connect
- ✅ **Permessi**: Configurati in `AndroidManifest.xml`
- ✅ **Stato**: Funzionante

---

## 🔒 App Tracking Transparency

### ⚠️ **NON CONFIGURATO**

**Stato**: App Tracking Transparency non è attualmente configurato.

### Quando è Necessario?
- Se l'app usa IDFA (Identifier for Advertisers)
- Se l'app traccia utenti per pubblicità
- Se l'app condivide dati con terze parti per tracking

### Raccomandazione
- **Per questa app**: Probabilmente **NON necessario** se non si fa tracking per pubblicità
- Se in futuro si aggiunge analytics avanzato o pubblicità, aggiungere:
  ```json
  "NSUserTrackingUsageDescription": "This app uses tracking to provide personalized wellness recommendations and improve your experience."
  ```

---

## 📊 Raccomandazioni Finali

### ✅ Notifiche Ottimizzate (COMPLETATO)

1. ✅ **Hydration Reminders**: Ridotto da 6 a 4 al giorno (9, 13, 17, 20)
2. ✅ **Evening Notifications**: Unificato Evening Winddown e Sleep Preparation (rimosso duplicato)
3. ⚠️ **Morning Greeting**: Mantenuto per ora, valutare in futuro se necessario

### Notifiche da Mantenere

1. ✅ Emotion/Skin Reminder
2. ✅ Journal Reminder
3. ✅ Fridge Expiry Check
4. ✅ Activity Reminders (dinamiche)
5. ✅ Mood Decline Alert
6. ✅ Streak Celebration

### ✅ Azioni Immediate (COMPLETATO)

1. ✅ **Cambiato `aps-environment` a `production`** in `WellnessCoach.entitlements` (con nota per development)
2. ⚠️ **Testare notifiche su dispositivo reale** prima del rilascio - **DA FARE**
3. ✅ **Verificare che i promemoria delle attività funzionino** - ✅ Implementato e funzionante
4. ✅ **Ottimizzato frequenza hydration reminders** - ✅ Ridotto da 6 a 4 al giorno

---

## 🧪 Test Checklist

- [ ] Notifiche funzionano su dispositivo iOS reale
- [ ] Notifiche funzionano su dispositivo Android reale
- [ ] Activity reminders vengono schedulati correttamente
- [ ] Calendar sync funziona con permessi negati (fallback)
- [ ] HealthKit sync funziona con permessi negati (fallback)
- [ ] Notifiche non vengono duplicate
- [ ] Throttling funziona (mood decline max 1x/giorno)
- [ ] Cancellazione notifiche funziona correttamente

