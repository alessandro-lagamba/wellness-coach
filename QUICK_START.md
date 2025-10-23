# ⚡ Quick Start Guide

## 🛠️ SVILUPPO (Setup Iniziale)

### **Step 1: Trova l'IP del Mac**

```bash
cd WellnessCoach
./get-mac-ip.sh
```

Questo script ti mostrerà:
- 📡 **Nome mDNS** (es: `alessandros-MacBook-Pro.local`) ⭐ **CONSIGLIATO**
- 📶 **IP WiFi** (es: `192.168.1.100`)
- 🌐 **Subnet** (es: `192.168.1.x`)

---

### **Step 2: Configura il Backend**

```bash
cd backend

# Copia e configura le env vars
cp .env.example .env
# Apri .env e aggiungi le tue API keys

# Installa dipendenze
pnpm install

# Avvia il backend
pnpm run dev
```

Il backend sarà disponibile su `http://localhost:3000` (o l'IP del Mac sulla porta 3000)

---

### **Step 3: Configura l'App Mobile**

**Opzione A: Usa mDNS (CONSIGLIATO)**
```bash
cd mobile

# Crea .env con il nome del Mac
echo "EXPO_PUBLIC_BACKEND_URL=http://$(hostname):3000" > .env
```

**Opzione B: Usa IP Fisso**
```bash
# Sostituisci con l'IP del tuo Mac
echo "EXPO_PUBLIC_BACKEND_URL=http://192.168.1.100:3000" > .env
```

**Opzione C: Auto-Discovery**
```bash
# Lascia vuoto - l'app scannerà la rete
echo "# EXPO_PUBLIC_BACKEND_URL=" > .env
```

---

### **Step 4: Avvia l'App Mobile**

```bash
cd mobile

# Installa dipendenze
npm install

# Avvia Expo
npx expo start
```

Poi:
1. Scansiona il QR code con l'app **Expo Go** (iOS) o **Expo** (Android)
2. Oppure premi **`i`** per iOS Simulator / **`a`** per Android Emulator

---

## 🔄 **Problema: Cambio di Rete WiFi**

### **Se usi mDNS:**
✅ **Nessuna azione necessaria!** Il nome del Mac funziona su qualsiasi rete.

### **Se usi IP fisso:**
1. Trova il nuovo IP: `./get-mac-ip.sh`
2. Aggiorna `mobile/.env` con il nuovo IP
3. Riavvia l'app Expo

### **Se usi Auto-Discovery:**
✅ **L'app rileva automaticamente il cambio** e cerca il backend sulla nuova rete.

---

## 🚀 **PRODUZIONE (Deploy)**

Vedi la guida completa: [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)

**TL;DR:**
1. Deploy backend su **Render.com** (gratis/7$/mese)
2. Configura `EXPO_PUBLIC_BACKEND_URL=https://your-backend.onrender.com`
3. Build app con EAS: `eas build --platform ios`
4. Submit su App Store: `eas submit --platform ios`

---

## 🐛 **Troubleshooting**

### **"Cannot connect to backend"**

**1. Verifica che il backend sia avviato:**
```bash
cd backend
pnpm run dev
```

**2. Verifica che Mac e iPhone siano sulla STESSA rete WiFi:**
```bash
# Sul Mac
./get-mac-ip.sh

# Sull'iPhone
# Impostazioni → WiFi → (i) accanto alla rete
# Verifica che l'IP inizi con lo stesso prefisso (es: 192.168.1.x)
```

**3. Testa il backend dal Mac:**
```bash
curl http://localhost:3000/api/health
# Dovrebbe rispondere: {"status":"ok"}
```

**4. Testa dal network del Mac:**
```bash
# Sostituisci con il tuo IP
curl http://192.168.1.100:3000/api/health
```

**5. Disabilita il Firewall del Mac temporaneamente:**
```
Impostazioni di Sistema → Rete → Firewall → OFF
```

---

### **"Network request failed"**

- ✅ Verifica che `mobile/.env` abbia il backend URL corretto
- ✅ Riavvia l'app Expo (Cmd+R sull'app)
- ✅ Cancella cache Expo: `npx expo start -c`

---

### **Backend risponde ma l'app non riceve dati**

- ✅ Verifica CORS nel backend (`backend/src/server.ts`)
- ✅ Assicurati che `ALLOWED_ORIGINS` includa `exp://` e `http://`

---

## 📝 **Comandi Utili**

```bash
# 🔍 Trova IP del Mac
./get-mac-ip.sh

# 🔄 Riavvia backend
cd backend && pnpm run dev

# 🔄 Riavvia app mobile (con clear cache)
cd mobile && npx expo start -c

# 📦 Build per iOS
cd mobile && eas build --platform ios

# 📦 Build per Android
cd mobile && eas build --platform android

# 🚀 Deploy backend su Render
git push origin main
# (se hai configurato auto-deploy su Render)

# 🧹 Pulisci tutto e reinstalla
cd backend && rm -rf node_modules && pnpm install
cd mobile && rm -rf node_modules && npm install
```

---

## ✅ **Checklist**

Prima di iniziare lo sviluppo:

- [ ] Backend avviato (`pnpm run dev`)
- [ ] Mac e iPhone sulla stessa rete WiFi
- [ ] File `mobile/.env` configurato
- [ ] App Expo avviata (`npx expo start`)
- [ ] Firewall Mac non blocca porta 3000

Prima del deploy:

- [ ] Tutte le API keys configurate
- [ ] Backend testato localmente
- [ ] App funziona in modalità produzione locale
- [ ] Backend deployato su Render/Railway
- [ ] `EXPO_PUBLIC_BACKEND_URL` punta al backend di produzione
- [ ] Build iOS/Android completata
- [ ] App testata su dispositivo reale

---

**Pronto? Buon sviluppo! 🚀**

