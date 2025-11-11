# 🚀 Railway Deploy - Quick Start Guide

## ✅ Prerequisiti completati

- ✅ Repository su GitHub: `lbp-management/wellness-coach`
- ✅ Dockerfile configurato
- ✅ Server usa `PORT` env var
- ✅ Health check endpoint `/api/health`

## 📋 Step-by-Step Deploy

### Step 1: Crea account Railway

1. Vai su **https://railway.app**
2. Clicca **"Start a New Project"** o **"Login"**
3. Seleziona **"Login with GitHub"**
4. Autorizza Railway ad accedere ai tuoi repository

### Step 2: Crea nuovo progetto

1. Nel dashboard Railway, clicca **"New Project"**
2. Seleziona **"Deploy from GitHub repo"**
3. Cerca e seleziona: **`lbp-management/wellness-coach`**
4. Clicca **"Deploy Now"**

### Step 3: Configura Root Directory (IMPORTANTE!)

Railway deve deployare solo la cartella `backend/`:

1. Nel progetto Railway, clicca sul servizio appena creato
2. Vai su **"Settings"** (icona ingranaggio)
3. Scorri fino a **"Root Directory"**
4. Inserisci: **`backend`**
5. Clicca **"Save"**

**Perché?** Il repository contiene tutta la cartella `WellnessCoach`, ma Railway deve buildare solo `backend/`.

### Step 4: Configura variabili d'ambiente

1. Nel progetto Railway, clicca su **"Variables"** (tab in alto)
2. Aggiungi le variabili critiche:

**Variabili OBBLIGATORIE (senza queste il backend non parte):**
```
OPENAI_API_KEY=sk-...
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

**Variabili IMPORTANTI (per funzionalità complete):**
```
CARTESIA_API_KEY=...
DEEPGRAM_API_KEY=...
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
LIVEKIT_URL=wss://...
```

**Variabili OPZIONALI (aggiungi se le usi):**
```
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
SIMLI_API_KEY=...
RPM_KEY=...
PINECONE_API_KEY=...
WEATHER_API_KEY=...
NUTRITION_API_KEY=...
```

**Nota:** Railway imposta automaticamente:
- `PORT` (non impostarla manualmente)
- `NODE_ENV=production` (non impostarla manualmente)

### Step 5: Verifica deploy

1. Railway fa deploy automatico dopo ogni modifica
2. Vai su **"Deployments"** per vedere lo stato
3. Clicca su un deployment per vedere i **logs**
4. Attendi che il build finisca (2-5 minuti)

### Step 6: Ottieni URL pubblico

1. Nel progetto Railway, clicca su **"Settings"**
2. Vai su **"Networking"**
3. Clicca **"Generate Domain"**
4. Copia l'URL (es: `https://wellness-coach-production.up.railway.app`)

### Step 7: Testa il deploy

Apri il browser o usa curl:
```bash
curl https://tuo-url.up.railway.app/api/health
```

Dovresti vedere:
```json
{
  "success": true,
  "message": "WellnessCoach Backend is healthy",
  "timestamp": "...",
  "environment": "production"
}
```

## 🔄 Aggiornamenti futuri

Dopo ogni `git push` su GitHub:
1. Railway rileva automaticamente il push
2. Fa rebuild e redeploy
3. Zero-downtime deployment
4. Vedi logs in tempo reale

## 🐛 Troubleshooting

### Deploy fallisce

1. **Vedi logs:**
   - Dashboard → **Deployments** → clicca deployment → **View Logs**
   - Cerca errori di build o runtime

2. **Verifica Root Directory:**
   - Settings → Root Directory deve essere `backend`

3. **Verifica variabili:**
   - Variables → assicurati che `OPENAI_API_KEY` sia presente

### "No health check passed"

1. Verifica che il server usi `process.env.PORT`
2. Verifica che il server ascolti su `0.0.0.0`
3. Controlla logs per errori di avvio

### Variabili mancanti

1. Aggiungi variabile mancante in **Variables**
2. Railway riavvia automaticamente il servizio

## 📱 Aggiorna app mobile

Nel file `.env` del mobile:
```env
EXPO_PUBLIC_BACKEND_URL=https://tuo-url.up.railway.app
```

Poi rebuilda l'app mobile.

## ✅ Checklist finale

- [ ] Account Railway creato
- [ ] Progetto Railway creato e collegato a GitHub
- [ ] Root Directory impostato a `backend`
- [ ] Variabili critiche aggiunte (OPENAI_API_KEY, SUPABASE_*)
- [ ] Deploy completato con successo
- [ ] Health check risponde correttamente
- [ ] URL pubblico ottenuto
- [ ] App mobile aggiornata con nuovo URL

## 🎉 Fatto!

Il backend è ora sempre online e raggiungibile da qualsiasi dispositivo!



