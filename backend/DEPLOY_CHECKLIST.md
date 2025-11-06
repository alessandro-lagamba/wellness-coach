# ✅ Checklist Pre-Deploy Railway

## 🔴 CRITICO - Prima del deploy

### 1. Variabili d'ambiente
- [x] ✅ Validazione OPENAI_API_KEY all'avvio (implementato)
- [ ] Imposta tutte le variabili con `fly secrets set`
- [ ] Verifica che tutte le variabili critiche siano presenti

**Comando:**
```bash
fly secrets set OPENAI_API_KEY=your_key
fly secrets set SUPABASE_URL=your_url
fly secrets set SUPABASE_ANON_KEY=your_key
# ... tutte le altre da env.example
```

### 2. Timeout e retry
- [x] ✅ Fetch con timeout nel mobile (implementato)
- [ ] Testa timeout con backend offline
- [ ] Verifica retry logic funziona

### 3. Fallback backend down
- [x] ✅ Safe fetch con gestione errori (implementato)
- [ ] Testa app mobile con backend offline
- [ ] Verifica messaggi utente chiari

### 4. Rate limiting
- [x] ✅ Rate limiting base implementato
- [ ] Testa rate limit (100 richieste/15min)
- [ ] Verifica response 429 funziona

## 🟡 IMPORTANTE - Prima della produzione

### 5. Logging strutturato
- [ ] Installa Winston o Pino
- [ ] Sostituisci console.log con logger strutturato
- [ ] Configura log levels (info, warn, error)

### 6. Monitoring
- [ ] Setup Sentry o simile per error tracking
- [ ] Configura alert per errori critici
- [ ] Monitora performance

### 7. Test base
- [ ] Test health check endpoint
- [ ] Test endpoint critici (chat, TTS, etc.)
- [ ] Test con variabili mancanti

## 🟢 OTTIMIZZAZIONI - Dopo deploy iniziale

### 8. Validazione input
- [ ] Aggiungi validazione robusta (es. Zod)
- [ ] Sanitizza input utente
- [ ] Limita dimensione payload

### 9. Retry con backoff
- [ ] Implementa exponential backoff
- [ ] Circuit breaker per servizi esterni
- [ ] Cache per richieste frequenti

### 10. Test automatizzati
- [ ] Setup Jest/Vitest
- [ ] Test unitari servizi critici
- [ ] Test integrazione API

## 📋 Comandi Deploy

### Primo deploy
1. Vai su https://railway.app
2. **New Project** → **Deploy from GitHub repo**
3. Seleziona il repo del backend
4. Dashboard → **Variables** → aggiungi tutte le variabili
5. Railway fa deploy automatico

### Aggiornamenti
```bash
git add .
git commit -m "Update"
git push
# Railway fa deploy automatico
```

### Verifica
- Dashboard Railway → **Deployments** → **View Logs**
- Testa: `curl https://tuo-progetto.up.railway.app/api/health`

## ⚠️ Note

- **Non deployare in produzione** senza completare almeno i punti CRITICI
- **Testa sempre** in staging prima di produzione
- **Monitora logs** dopo ogni deploy
- **Backup Supabase** già configurato (cloud)
