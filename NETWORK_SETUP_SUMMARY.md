# 🌐 Network Setup - Riepilogo Completo

## ✅ **COSA ABBIAMO FATTO**

### **1️⃣ Auto-Discovery Dinamico**
Implementato un sistema intelligente che:
- ✅ Rileva automaticamente quando cambi rete WiFi
- ✅ Scansiona la rete locale per trovare il backend
- ✅ Usa il nome mDNS del Mac invece dell'IP (più affidabile)
- ✅ Fallback automatico se il backend non risponde

### **2️⃣ Modalità Sviluppo vs Produzione**
Il sistema riconosce automaticamente l'ambiente:

**🛠️ SVILUPPO:**
- Usa mDNS: `http://MacBook-Pro-di-Alessandro-3.local:3000`
- Se cambi rete, l'app rileva il cambio e riprova a connettersi
- Se mDNS fallisce, scansiona la subnet locale

**🚀 PRODUZIONE:**
- Usa URL HTTPS fisso: `https://your-backend.onrender.com`
- Nessuna scansione di rete
- Performance ottimizzate

### **3️⃣ File Creati/Modificati**

| File | Cosa fa |
|------|---------|
| `mobile/constants/env.ts` | Gestisce URL backend con auto-discovery |
| `mobile/services/network-discovery.service.ts` | Scansiona rete e trova backend |
| `mobile/.env` | Configurato con mDNS del tuo Mac |
| `get-mac-ip.sh` | Script helper per trovare IP/mDNS |
| `DEPLOYMENT_GUIDE.md` | Guida completa al deploy |
| `QUICK_START.md` | Quick start per sviluppo |

---

## 🎯 **LA TUA CONFIGURAZIONE ATTUALE**

```bash
# Mac mDNS: MacBook-Pro-di-Alessandro-3.local
# IP WiFi: 192.168.1.56
# Subnet: 192.168.1.x
# Backend Port: 3000
```

**File `mobile/.env` configurato con:**
```bash
EXPO_PUBLIC_BACKEND_URL=http://MacBook-Pro-di-Alessandro-3.local:3000
```

---

## 🔄 **COME FUNZIONA IL CAMBIO RETE**

### **Scenario: Cambio da WiFi Casa a WiFi Ufficio**

**❌ PRIMA (Problema):**
```
1. A casa: Mac ha IP 192.168.1.56
2. App configurata con: http://192.168.1.56:3000
3. Vai in ufficio: Mac ha IP 10.0.0.42
4. App prova: http://192.168.1.56:3000 → ❌ ERRORE
5. Devi manualmente aggiornare .env con nuovo IP
```

**✅ ADESSO (Soluzione):**
```
1. A casa: Mac = MacBook-Pro-di-Alessandro-3.local (IP 192.168.1.56)
2. App configurata con: http://MacBook-Pro-di-Alessandro-3.local:3000
3. Vai in ufficio: Mac = MacBook-Pro-di-Alessandro-3.local (IP 10.0.0.42)
4. App risolve automaticamente MacBook-Pro-di-Alessandro-3.local → 10.0.0.42
5. ✅ FUNZIONA! Nessuna modifica necessaria
```

### **Cosa Succede Dietro le Quinte:**

```typescript
// 1. L'app rileva il cambio di rete (NetInfo)
NetInfo.addEventListener(state => {
  if (state.isConnected) {
    console.log('🔄 Network changed!');
    invalidateBackendURLCache();  // Invalida cache
    initializeBackendURL();       // Riprova a connettersi
  }
});

// 2. Prova a risolvere mDNS
const url = 'http://MacBook-Pro-di-Alessandro-3.local:3000';
const isWorking = await testBackendConnection(url);

// 3. Se mDNS funziona → usa quello
if (isWorking) return url;

// 4. Se mDNS fallisce → scansiona rete locale
const workingBackend = await findWorkingBackend(3000);
// Prova: 192.168.1.100, 192.168.1.101, ..., 192.168.1.254
```

---

## 🚀 **PROSSIMI PASSI**

### **Per Continuare lo Sviluppo:**
1. ✅ Nessuna azione necessaria!
2. Il backend è già configurato correttamente
3. Quando cambi rete, l'app si adatterà automaticamente

### **Per il Deploy in Produzione:**

**Step 1: Deploy Backend su Render.com**
```bash
# Vedi guida completa: DEPLOYMENT_GUIDE.md

1. Crea account su render.com
2. Connetti repo GitHub
3. Deploy backend → ottieni URL: https://your-backend.onrender.com
```

**Step 2: Configura App per Produzione**
```bash
cd mobile

# Crea file .env.production
echo "EXPO_PUBLIC_BACKEND_URL=https://your-backend.onrender.com" > .env.production
```

**Step 3: Build e Submit**
```bash
# Build iOS
eas build --platform ios --profile production

# Submit ad App Store
eas submit --platform ios
```

---

## 🐛 **TROUBLESHOOTING**

### **Problema: "Cannot connect to backend" dopo cambio rete**

**Soluzione Automatica:**
1. Aspetta 2-5 secondi - l'app sta cercando il backend
2. Guarda i logs: dovrebbe mostrare "🔄 Network changed, invalidating cache..."
3. Se dopo 10 secondi non funziona → **Riavvia l'app**

**Soluzione Manuale:**
```bash
# 1. Verifica IP del Mac sulla nuova rete
./get-mac-ip.sh

# 2. Testa che il backend risponda
curl http://MacBook-Pro-di-Alessandro-3.local:3000/api/health

# 3. Se mDNS non funziona, usa IP fisso temporaneamente
echo "EXPO_PUBLIC_BACKEND_URL=http://192.168.1.56:3000" > mobile/.env

# 4. Riavvia app Expo
cd mobile && npx expo start -c
```

---

### **Problema: mDNS non funziona (raro)**

Alcune reti aziendali bloccano mDNS/Bonjour.

**Soluzione: Usa IP Statico sul Mac**
```bash
# 1. Impostazioni di Sistema → Rete → WiFi → Dettagli
# 2. Tab TCP/IP → Configura IPv4: Manualmente
# 3. IP: 192.168.1.100 (o altro IP fisso)
# 4. Gateway: 192.168.1.1 (IP del router)
# 5. Subnet mask: 255.255.255.0

# 6. Aggiorna .env
echo "EXPO_PUBLIC_BACKEND_URL=http://192.168.1.100:3000" > mobile/.env
```

---

### **Problema: Firewall blocca connessioni**

```bash
# Disabilita temporaneamente il Firewall
# Impostazioni di Sistema → Rete → Firewall → OFF

# OPPURE aggiungi eccezione per porta 3000
# Firewall → Opzioni Firewall → Aggiungi app "Node"
```

---

## 📊 **CONFRONTO SOLUZIONI**

| Soluzione | Affidabilità | Setup | Cambio Rete | Produzione |
|-----------|--------------|-------|-------------|------------|
| **mDNS (attuale)** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ✅ Automatico | ✅ Configurabile |
| **IP Statico** | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⚠️ Manuale | ✅ Configurabile |
| **Auto-Discovery** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ✅ Automatico | ✅ Configurabile |
| **IP Dinamico** | ⭐⭐ | ⭐⭐⭐⭐⭐ | ❌ Non funziona | ✅ Configurabile |

**CONSIGLIO:** Usa **mDNS** (soluzione attuale) per sviluppo, è la più affidabile!

---

## 📞 **COMANDI RAPIDI**

```bash
# 🔍 Trova info di rete
./get-mac-ip.sh

# 🔄 Riavvia tutto
cd backend && pnpm run dev &
cd mobile && npx expo start -c

# 🧪 Testa connessione backend
curl http://MacBook-Pro-di-Alessandro-3.local:3000/api/health

# 📝 Vedi logs app mobile
# (nell'app Expo, scuoti il telefono → "Remote JS Debugging")

# 🚀 Deploy rapido
git push origin main  # Se hai auto-deploy su Render
```

---

## ✅ **CHECKLIST FINALE**

**Sviluppo:**
- [x] Backend configurato con mDNS
- [x] App mobile configurata con mDNS
- [x] Auto-discovery implementato
- [x] Network change detection attivo
- [x] Firewall configurato (o disabilitato)

**Produzione:**
- [ ] Backend deployato su Render/Railway
- [ ] `.env.production` con URL HTTPS
- [ ] CORS configurato per dominio produzione
- [ ] SSL/TLS attivo (HTTPS)
- [ ] Error logging configurato (Sentry)

---

**🎉 Tutto configurato! Il sistema ora si adatta automaticamente ai cambi di rete.**

**Domande?** Leggi le guide:
- 📖 [QUICK_START.md](./QUICK_START.md) - Setup veloce
- 📚 [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) - Deploy completo

