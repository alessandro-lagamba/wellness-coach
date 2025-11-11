# 🚀 Guida Deploy Railway - Wellness Coach Backend

## ✅ Cosa è già pronto

- ✅ `Dockerfile` - Configurazione container (aggiornato per Railway)
- ✅ `railway.json` - Configurazione Railway (opzionale)
- ✅ `.dockerignore` - File esclusi dal build
- ✅ Server usa `process.env.PORT` (già compatibile)
- ✅ Server ascolta su `0.0.0.0` (già compatibile)
- ✅ Validazione variabili d'ambiente all'avvio
- ✅ Rate limiting implementato
- ✅ Health check endpoint `/api/health`

## 📋 Requisiti per il deploy

### 1. Account Railway

1. Vai su https://railway.app
2. Crea account gratuito (GitHub login)
3. Verifica email

### 2. Repository GitHub

Il backend deve essere su GitHub (Railway si collega a GitHub).

**Se non hai ancora il repo:**
```bash
cd WellnessCoach/backend
git init
git add .
git commit -m "Initial commit"
# Crea repo su GitHub, poi:
git remote add origin https://github.com/tuo-username/tuo-repo.git
git push -u origin main
```

## 🚀 Deploy (prima volta)

### Step 1: Crea nuovo progetto Railway

1. Vai su https://railway.app
2. Clicca **"New Project"**
3. Seleziona **"Deploy from GitHub repo"**
4. Autorizza Railway ad accedere ai tuoi repo GitHub
5. Seleziona il repository del backend

### Step 2: Configura build

Railway rileva automaticamente:
- ✅ Node.js da `package.json`
- ✅ Build command: `npm run build`
- ✅ Start command: `node dist/server.js`
- ✅ Port: usa `PORT` env var automaticamente

**Se usa Dockerfile:**
- Railway userà automaticamente il `Dockerfile` presente

### Step 3: Imposta variabili d'ambiente

1. Nel dashboard Railway → **Variables**
2. Aggiungi tutte le variabili da `env.example`:

**Variabili critiche (obbligatorie):**
```
OPENAI_API_KEY=your_key_here
SUPABASE_URL=your_url_here
SUPABASE_ANON_KEY=your_key_here
SUPABASE_SERVICE_ROLE_KEY=your_key_here
```

**Variabili importanti:**
```
CARTESIA_API_KEY=your_key_here
DEEPGRAM_API_KEY=your_key_here
LIVEKIT_API_KEY=your_key_here
LIVEKIT_API_SECRET=your_secret_here
# ... tutte le altre da env.example
```

**Variabili di sistema (Railway le imposta automaticamente):**
```
PORT=3000 (automatico)
NODE_ENV=production (automatico)
```

### Step 4: Deploy!

Railway fa deploy automatico:
1. ✅ Rileva il repo
2. ✅ Build del container
3. ✅ Deploy e avvio
4. ✅ Assegnazione URL pubblico

**URL sarà:** `https://tuo-progetto.up.railway.app`

### Step 5: Verifica

1. **Vedi logs:**
   - Dashboard Railway → **Deployments** → **View Logs**

2. **Testa health check:**
   ```bash
   curl https://tuo-progetto.up.railway.app/api/health
   ```

3. **Vedi URL pubblico:**
   - Dashboard Railway → **Settings** → **Networking** → **Generate Domain**

## 🔄 Aggiornamenti (dopo modifiche)

### Metodo 1: Git push (automatico)

```bash
cd WellnessCoach/backend
git add .
git commit -m "Update backend"
git push
```

Railway:
- ✅ Rileva automaticamente il push
- ✅ Fa rebuild e redeploy
- ✅ Zero-downtime deployment
- ✅ Health check automatico

**Tempo:** 2-5 minuti

### Metodo 2: Deploy manuale

1. Dashboard Railway → **Deployments**
2. Clicca **"Redeploy"** sull'ultimo deployment

### Metodo 3: Aggiorna solo variabili

1. Dashboard Railway → **Variables**
2. Modifica variabile
3. Railway riavvia automaticamente il servizio

## 📱 Aggiorna app mobile

Nel file `.env` del mobile:
```env
EXPO_PUBLIC_BACKEND_URL=https://tuo-progetto.up.railway.app
```

## 🛠️ Comandi utili Railway

### Railway CLI (opzionale)

```bash
# Installa CLI
npm i -g @railway/cli

# Login
railway login

# Link progetto
railway link

# Vedi logs
railway logs

# Vedi variabili
railway variables

# Aggiungi variabile
railway variables set KEY=value

# Deploy manuale
railway up
```

## 🔍 Troubleshooting

### Deploy fallisce

1. **Vedi logs:**
   - Dashboard → **Deployments** → **View Logs**
   - Cerca errori di build o runtime

2. **Verifica variabili:**
   - Dashboard → **Variables**
   - Assicurati che `OPENAI_API_KEY` sia presente

3. **Verifica build locale:**
   ```bash
   docker build -t test .
   docker run -p 3000:3000 test
   ```

### App non risponde

1. **Verifica health check:**
   ```bash
   curl https://tuo-progetto.up.railway.app/api/health
   ```

2. **Vedi logs errori:**
   - Dashboard → **Deployments** → **View Logs**
   - Cerca errori runtime

3. **Verifica variabili:**
   - Dashboard → **Variables**
   - Controlla che tutte le variabili critiche siano presenti

### Variabili d'ambiente mancanti

1. **Aggiungi variabile:**
   - Dashboard → **Variables** → **New Variable**
   - Railway riavvia automaticamente

2. **Verifica validazione:**
   - Vedi logs per errori di validazione all'avvio

## 💰 Costi Railway

- **Free tier**: $5 crediti/mese gratis
- **Hobby plan**: $5/mese - più crediti
- **Per test**: Free tier è sufficiente!

**Consumo stimato:**
- Backend base: ~$2-3/mese
- Con traffico moderato: ~$5-10/mese

## ✨ Prossimi step

1. ✅ Deploy fatto
2. ✅ URL pubblico ottenuto
3. ✅ Aggiorna `.env` mobile
4. ✅ Testa app mobile con nuovo backend
5. ✅ Condividi APK con amici per feedback

## 🎯 Best Practices

- **Variabili sensibili**: usa sempre Railway Variables (non commitare in git)
- **Health check**: già configurato in `server.ts`
- **Logs**: monitora con Railway Dashboard
- **Backup**: configura Supabase backup (già cloud)
- **Monitoring**: usa Railway Dashboard per metriche

## 📝 Note

- Railway rileva automaticamente Node.js e usa `npm start`
- Se usi Dockerfile, Railway lo userà automaticamente
- Port è gestito automaticamente da Railway (usa `PORT` env var)
- HTTPS è automatico e gratuito



