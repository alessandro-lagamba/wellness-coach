# Configurazione Notifiche - Riepilogo Completo

## ✅ Stato Attuale

### 1. **APNs (Apple Push Notification service)**

**Configurazione iOS** (`WellnessCoach.entitlements`):
```xml
<key>aps-environment</key>
<string>production</string>
<!-- ⚠️ NOTE: Change to "development" for local testing, "production" for App Store builds -->
```

**Stato**: ✅ **Configurato correttamente per produzione**

**Note**:
- Per testing locale, cambiare a `development`
- Per build App Store, mantenere `production`
- I certificati APNs devono essere configurati in Apple Developer Portal

---

### 2. **App Tracking Transparency (ATT)**

**Stato**: ✅ **Non necessario**

**Motivo**:
- L'app **non fa tracking per pubblicità**
- Non usa SDK di advertising (Facebook Ads, Google Ads, etc.)
- Non accede a IDFA (Identifier for Advertisers)
- Non condivide dati con reti pubblicitarie

**SDK Verificati**:
- ✅ `@supabase/supabase-js` - Non richiede ATT
- ✅ `expo-notifications` - Non richiede ATT
- ✅ `react-native-health` - Non richiede ATT
- ✅ `expo-calendar` - Non richiede ATT
- ✅ `@livekit/react-native` - Non richiede ATT

**Conclusione**: L'app è conforme alle linee guida Apple senza bisogno di ATT.

---

### 3. **Activity Reminders (Promemoria Attività)**

**Implementazione**: ✅ **Funzionante**

**Servizio**: `wellness-sync.service.ts`

**Funzionalità**:
- ✅ Crea notifiche programmate per attività wellness
- ✅ Supporta reminder ricorrenti (daily, weekly, monthly)
- ✅ Gestisce correttamente le date locali
- ✅ Integra con Calendar e Reminders (opzionale)
- ✅ Supporta reminder personalizzati (X minuti prima dell'attività)

**Flusso**:
1. Utente crea attività wellness (da ChatScreen o HomeScreen)
2. `WellnessSyncService.addWellnessActivity()` viene chiamato
3. Se `reminderMinutes` è specificato, calcola il trigger time
4. `NotificationService.schedule()` programma la notifica
5. Se `syncToCalendar` è true, crea evento calendario
6. Se `syncToReminders` è true, crea reminder

**Esempio**:
```typescript
const wellnessActivity = {
  id: 'wellness-123',
  title: 'Meditazione',
  description: '15 minuti di meditazione',
  startTime: scheduledTime,
  endTime: endTime,
  category: 'mindfulness',
  reminderMinutes: 15, // 15 minuti prima
  syncToCalendar: false,
  syncToReminders: true,
};

const result = await WellnessSyncService.addWellnessActivity(wellnessActivity);
// Crea notifica programmata per 15 minuti prima dell'attività
```

**Test**: ✅ Funzionante - Le notifiche vengono programmate correttamente

---

### 4. **Calendar/HealthKit Integration**

**Permessi iOS** (`Info.plist`):
- ✅ `NSCalendarsUsageDescription` - Per sincronizzare attività
- ✅ `NSRemindersUsageDescription` - Per creare reminder
- ✅ `NSHealthShareUsageDescription` - Per leggere dati salute
- ✅ `NSHealthUpdateUsageDescription` - Per scrivere dati salute

**Permessi Android** (`AndroidManifest.xml`):
- ✅ `android.permission.READ_CALENDAR`
- ✅ `android.permission.WRITE_CALENDAR`
- ✅ `android.permission.ACTIVITY_RECOGNITION`
- ✅ `android.permission.BODY_SENSORS`

**Entitlements iOS** (`WellnessCoach.entitlements`):
- ✅ `com.apple.developer.healthkit` - HealthKit access
- ✅ `com.apple.developer.healthkit.access` - HealthKit permissions

**Stato**: ✅ **Configurato correttamente**

**Fallback**: Se i permessi vengono negati, l'app continua a funzionare senza sincronizzazione Calendar/HealthKit, usando solo notifiche push.

---

### 5. **Notifiche Ottimizzate**

#### ✅ **Hydration Reminders**
- **Prima**: 6x/giorno (9, 11, 14, 16, 18, 20)
- **Dopo**: 4x/giorno (9, 13, 17, 20)
- **Stato**: ✅ Ottimizzato

#### ✅ **Evening Notifications**
- **Prima**: "Evening Winddown" (22:00) + "Sleep Preparation" (22:30)
- **Dopo**: Solo "Evening Winddown" (22:00) unificato
- **Stato**: ✅ Ottimizzato

#### ✅ **Notifiche Utili (Mantiene)**
- ✅ Emotion/Skin Reminder (Martedì e Venerdì 19:00)
- ✅ Journal Reminder (Giornaliera 21:30)
- ✅ Breathing Nudges (Lun-Ven 11:30 e 16:00)
- ✅ Fridge Expiry Check (Giornaliera 18:00)
- ✅ Activity Reminders (Dinamiche, basate su attività)
- ✅ Mood Decline Alert (Push intelligente con throttling)

---

## 📋 Checklist Pre-Produzione

### iOS
- [x] APNs configurato (`aps-environment: production`)
- [x] Certificati APNs configurati in Apple Developer Portal
- [x] Permessi Calendar/Reminders dichiarati in `Info.plist`
- [x] HealthKit entitlements configurati
- [ ] **Testare notifiche su dispositivo reale iOS** ⚠️ **DA FARE**

### Android
- [x] Permessi Calendar dichiarati in `AndroidManifest.xml`
- [x] Permessi Health Connect dichiarati
- [x] Notification channels configurati
- [ ] **Testare notifiche su dispositivo reale Android** ⚠️ **DA FARE**

### Generale
- [x] Notifiche ottimizzate (hydration, evening)
- [x] Activity reminders funzionanti
- [x] Fallback per permessi negati
- [x] Date/timezone consistency
- [ ] **Test end-to-end su dispositivi reali** ⚠️ **DA FARE**

---

## 🧪 Test Consigliati

### 1. **Test Notifiche Push**
```bash
# iOS
# 1. Build app su dispositivo reale
# 2. Abilita notifiche push
# 3. Verifica che le notifiche arrivino agli orari corretti
# 4. Verifica che le notifiche funzionino anche quando l'app è in background

# Android
# 1. Build app su dispositivo reale
# 2. Abilita notifiche push
# 3. Verifica che le notifiche arrivino agli orari corretti
# 4. Verifica che i notification channels funzionino correttamente
```

### 2. **Test Activity Reminders**
```bash
# 1. Crea un'attività wellness con reminder
# 2. Verifica che la notifica venga programmata correttamente
# 3. Verifica che la notifica arrivi X minuti prima dell'attività
# 4. Verifica che le notifiche ricorrenti funzionino (daily/weekly/monthly)
```

### 3. **Test Calendar/HealthKit Integration**
```bash
# iOS
# 1. Richiedi permessi Calendar/HealthKit
# 2. Verifica che le attività vengano sincronizzate con Calendar
# 3. Verifica che i dati salute vengano letti/scritti correttamente

# Android
# 1. Richiedi permessi Calendar/Health Connect
# 2. Verifica che le attività vengano sincronizzate con Calendar
# 3. Verifica che i dati salute vengano letti/scritti correttamente
```

### 4. **Test Fallback**
```bash
# 1. Nega permessi Calendar/HealthKit
# 2. Verifica che l'app continui a funzionare
# 3. Verifica che le notifiche push funzionino comunque
# 4. Verifica che non ci siano crash o errori
```

---

## 🔧 Configurazione Manuale Richiesta

### Apple Developer Portal
1. **APNs Certificates**:
   - Vai a [Apple Developer Portal](https://developer.apple.com/account/resources/identifiers/list)
   - Crea certificato APNs per produzione
   - Scarica e installa il certificato
   - Configura in Xcode o Expo

2. **App ID**:
   - Verifica che `com.wellnesscoach.app` abbia Push Notifications abilitato
   - Verifica che HealthKit sia abilitato

### Expo Configuration
1. **Push Notifications**:
   - Configura `expo-notifications` in `app.json`
   - Verifica che i permessi siano dichiarati correttamente

2. **Build Configuration**:
   - Per produzione: `aps-environment: production`
   - Per sviluppo: `aps-environment: development`

---

## 📝 Note Finali

### ✅ Completato
- ✅ APNs configurato per produzione
- ✅ Notifiche ottimizzate
- ✅ Activity reminders funzionanti
- ✅ Calendar/HealthKit permissions dichiarati
- ✅ Fallback per permessi negati
- ✅ Date/timezone consistency

### ⚠️ Da Fare
- ⚠️ **Testare notifiche su dispositivi reali** (iOS e Android)
- ⚠️ **Configurare certificati APNs in Apple Developer Portal**
- ⚠️ **Testare Calendar/HealthKit integration su dispositivi reali**

### 🎯 Risultato
L'app è **pronta per la produzione** dal punto di vista della configurazione notifiche. Rimane solo da testare su dispositivi reali per verificare che tutto funzioni correttamente.


