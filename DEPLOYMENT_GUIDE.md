# 🚀 Guida al Deploy di WellnessCoach

## 📱 **SVILUPPO vs PRODUZIONE**

### **🛠️ SVILUPPO (Mac + iPhone sulla stessa rete)**

Durante lo sviluppo, l'app mobile sul tuo iPhone si connette al backend che gira sul tuo Mac.

#### **Problema: Cambio di Rete WiFi**
Quando cambi rete WiFi, l'IP del Mac cambia e l'app non trova più il backend.

#### **✅ Soluzione 1: IP Statico (Semplice)**

**Sul Mac:**
1. Vai in **Impostazioni di Sistema → Rete → WiFi → Dettagli**
2. Tab **TCP/IP**
3. Cambia **Configura IPv4** da "Usando DHCP" a "Manualmente"
4. Imposta un IP statico (es: `192.168.1.100`)
5. Gateway: IP del router (es: `192.168.1.1`)
6. Subnet mask: `255.255.255.0`

**Nel codice:**
```bash
# WellnessCoach/mobile/.env
EXPO_PUBLIC_BACKEND_URL=http://192.168.1.100:3000
```

**PRO:** Sempre lo stesso IP, anche cambiando rete
**CONTRO:** Devi riconfigurare per ogni rete WiFi diversa

---

#### **✅ Soluzione 2: mDNS/Bonjour (Consigliato)**

Usa il **nome del Mac** invece dell'IP. Il Mac si annuncia sulla rete come `nome-mac.local`.

**Trova il nome del tuo Mac:**
```bash
# Nel terminale del Mac
hostname
# Output esempio: alessandros-MacBook-Pro.local
```

**Nel codice:**
```bash
# WellnessCoach/mobile/.env
EXPO_PUBLIC_BACKEND_URL=http://alessandros-MacBook-Pro.local:3000
```

**PRO:** 
- ✅ Funziona automaticamente su qualsiasi rete WiFi
- ✅ Non devi sapere l'IP del Mac
- ✅ Zero configurazione

**CONTRO:**
- ⚠️ Richiede che mDNS/Bonjour sia attivo (di default lo è su Mac)
- ⚠️ Potrebbe non funzionare su alcune reti aziendali

---

#### **✅ Soluzione 3: Auto-Discovery (Implementato)**

L'app scansiona automaticamente la rete locale per trovare il backend.

**Come funziona:**
1. L'app prova prima gli IP più comuni (`192.168.1.100`, `192.168.0.100`, ecc.)
2. Se non trova nulla, scansiona tutta la subnet locale
3. Testa ogni IP con una richiesta a `/api/health`
4. Usa il primo backend che risponde

**PRO:**
- ✅ Completamente automatico
- ✅ Funziona anche se cambi rete WiFi
- ✅ Rileva automaticamente cambi di rete

**CONTRO:**
- ⚠️ Impiega 5-10 secondi al primo avvio
- ⚠️ Consuma un po' di batteria durante la scansione

---

### **🚀 PRODUZIONE (App deployata su App Store)**

Quando pubblichi l'app, il backend deve essere online 24/7 su un server.

#### **Opzioni per il Backend:**

| Servizio | Costo | Difficoltà | Consigliato |
|----------|-------|------------|-------------|
| **Render.com** | Gratis/7$/mese | ⭐⭐ Facile | ✅ **Sì** (per iniziare) |
| **Railway.app** | Pay-as-you-go (~5$/mese) | ⭐⭐ Facile | ✅ **Sì** |
| **Heroku** | 7$/mese | ⭐⭐⭐ Medio | ⚠️ Ok |
| **DigitalOcean** | 6$/mese | ⭐⭐⭐⭐ Difficile | ⚠️ Solo se sai cosa fai |
| **AWS EC2** | 5-10$/mese | ⭐⭐⭐⭐⭐ Molto difficile | ❌ Troppo complesso |

---

## 📦 **DEPLOY STEP-BY-STEP (Render.com)**

### **1️⃣ Prepara il Backend**

```bash
cd WellnessCoach/backend

# Assicurati che ci sia un file start script
# Il backend deve partire con: node dist/server.js
```

**Verifica `package.json`:**
```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/server.js",
    "dev": "nodemon src/server.ts"
  }
}
```

---

### **2️⃣ Carica su GitHub**

```bash
# Se non l'hai già fatto
cd WellnessCoach
git init
git add .
git commit -m "Initial commit"

# Crea un repo su GitHub e poi:
git remote add origin https://github.com/TUO-USERNAME/wellnesscoach.git
git push -u origin main
```

---

### **3️⃣ Deploy su Render.com**

1. Vai su [render.com](https://render.com) e crea un account
2. Clicca **"New +"** → **"Web Service"**
3. Connetti il tuo repository GitHub
4. Configura:

| Campo | Valore |
|-------|--------|
| **Name** | `wellnesscoach-backend` |
| **Region** | Europe (più vicino a te) |
| **Branch** | `main` |
| **Root Directory** | `WellnessCoach/backend` |
| **Runtime** | `Node` |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm start` |
| **Instance Type** | Free (o Starter $7/mese) |

5. **Environment Variables:**

Clicca "Advanced" e aggiungi:

```bash
NODE_ENV=production
PORT=3000

# OpenAI
OPENAI_API_KEY=sk-your-key-here

# Google Gemini
GEMINI_API_KEY=your-gemini-key

# ElevenLabs
ELEVENLABS_API_KEY=your-elevenlabs-key
ELEVENLABS_VOICE_ID=your-voice-id

# Database (se usi MongoDB)
MONGODB_URI=mongodb+srv://...

# CORS
ALLOWED_ORIGINS=https://your-app-url.com,exp://your-expo-url
```

6. Clicca **"Create Web Service"**
7. Aspetta 5-10 minuti per il deploy
8. Copia l'URL del backend (es: `https://wellnesscoach-backend.onrender.com`)

---

### **4️⃣ Configura l'App Mobile**

```bash
cd WellnessCoach/mobile

# Crea/modifica .env.production
echo "EXPO_PUBLIC_BACKEND_URL=https://wellnesscoach-backend.onrender.com" > .env.production
```

---

### **5️⃣ Build dell'App per Produzione**

**iOS (App Store):**
```bash
# Assicurati di avere un Apple Developer Account ($99/anno)
eas build --platform ios --profile production

# Dopo il build:
eas submit --platform ios
```

**Android (Google Play):**
```bash
# Crea un Google Play Developer Account ($25 una tantum)
eas build --platform android --profile production

# Dopo il build:
eas submit --platform android
```

---

## 🔒 **SICUREZZA**

### **⚠️ IMPORTANTE per PRODUZIONE:**

1. **HTTPS Obbligatorio:** Render.com fornisce HTTPS gratis
2. **Variabili d'ambiente:** Mai committare API keys su GitHub
3. **CORS:** Configura solo le origini autorizzate
4. **Rate Limiting:** Limita le richieste API per evitare abusi
5. **Autenticazione:** Implementa JWT o session-based auth

---

## 💰 **COSTI STIMATI**

| Servizio | Sviluppo | Produzione |
|----------|----------|------------|
| **Backend (Render)** | Gratis | $7/mese |
| **Database (MongoDB Atlas)** | Gratis (512MB) | $9/mese (2GB) |
| **OpenAI API** | ~$5/mese | ~$20-50/mese |
| **Google Gemini** | Gratis (fino a quota) | ~$10/mese |
| **ElevenLabs** | Gratis (10k chars/mese) | $5-22/mese |
| **Apple Developer** | - | $99/anno |
| **Google Play** | - | $25 una tantum |

**TOTALE:** ~$30-50/mese + $99/anno per iOS

---

## 🐛 **TROUBLESHOOTING**

### **Problema: "Cannot connect to backend"**

**Sviluppo:**
```bash
# 1. Verifica che il backend sia avviato
cd WellnessCoach/backend
npm run dev

# 2. Verifica l'IP del Mac
ifconfig | grep "inet "

# 3. Verifica che Mac e iPhone siano sulla STESSA rete WiFi

# 4. Disabilita il firewall temporaneamente
# Impostazioni → Sicurezza e Privacy → Firewall
```

**Produzione:**
```bash
# 1. Verifica che il backend sia online
curl https://your-backend.onrender.com/api/health

# 2. Verifica le env vars
# Render.com → Service → Environment
```

---

### **Problema: "CORS error"**

**Backend:**
```typescript
// WellnessCoach/backend/src/server.ts
app.use(cors({
  origin: [
    'exp://localhost:8081',  // Sviluppo Expo
    'http://localhost:8081',  // Sviluppo Expo
    'https://your-production-url.com'  // Produzione
  ]
}));
```

---

## 📞 **SUPPORTO**

- **Render Docs:** https://render.com/docs
- **Expo Docs:** https://docs.expo.dev
- **EAS Build:** https://docs.expo.dev/build/introduction

---

## ✅ **CHECKLIST PRE-DEPLOY**

- [ ] Tutte le API keys sono in variabili d'ambiente
- [ ] Il backend risponde a `/api/health`
- [ ] CORS è configurato correttamente
- [ ] L'app funziona in modalità `production` locale
- [ ] Hai testato il backend su Render
- [ ] L'app mobile si connette al backend di produzione
- [ ] Hai configurato error logging (es: Sentry)
- [ ] Hai testato su dispositivi reali (non solo emulatore)

---

**Pronto per il deploy? 🚀**

