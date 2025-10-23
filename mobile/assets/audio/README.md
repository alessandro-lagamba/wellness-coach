# 🎵 File Audio per Breathing Exercise

## 📁 Struttura Cartelle
```
assets/
└── audio/
    ├── breathing-background.mp3  # Musica di background (loop continuo)
    └── README.md
```

## 🎶 Come Aggiungere il File Audio

### **1. Copia il file audio**
Copia il tuo file audio nella cartella `assets/audio/` con questo nome esatto:
- `breathing-background.mp3` - Musica di background (loop continuo)

### **2. Formato Audio Consigliato**
- **Formato**: MP3 (H.264)
- **Qualità**: 128-192 kbps
- **Durata**: 2-5 minuti (si ripete in loop)
- **Volume**: Normalizzato per evitare picchi

### **3. Caratteristiche Audio**

#### **Musica di Background:**
- **Stile**: Ambient, meditativo, new age
- **Strumenti**: Pad, sintetizzatori, campane tibetane
- **Tempo**: Lento (60-80 BPM)
- **Volume**: 40% del massimo (non deve interferire)
- **Loop**: Perfetto, senza interruzioni

### **4. Controlli Separati**
- **Audio**: Toggle per abilitare/disabilitare la musica di background
- **Vibrazione**: Toggle per abilitare/disabilitare il feedback aptico
- **Flessibilità**: Gli utenti possono usare solo audio, solo vibrazioni, entrambi o nessuno

### **5. Feedback Aptico**
- **Inspirazione**: Vibrazione leggera
- **Trattenimento**: Vibrazione media
- **Espirazione**: Vibrazione leggera
- **Pausa**: Vibrazione leggera

### **6. Suggerimenti per la Creazione**

#### **Per il Background:**
- Usa pad lunghi e sostenuti
- Aggiungi texture ambientali sottili
- Evita melodie troppo marcate
- Crea atmosfere zen e meditative
- Progressione armonica: Am - F - C - G
- Tempo: 70 BPM
- Durata: 3-4 minuti

### **7. Test dell'Esperienza**
Dopo aver aggiunto il file, testa l'app per verificare che:
- La musica di background si riproduca correttamente quando abilitata
- Le vibrazioni si attivino al cambio di fase quando abilitate
- I controlli separati funzionino correttamente
- La musica sia udibile ma non invasiva
- Non ci siano interruzioni o glitch
- Il volume sia bilanciato

### **8. Combinazioni Possibili**
- **Solo Audio**: Musica di background senza vibrazioni
- **Solo Vibrazioni**: Feedback aptico senza musica
- **Audio + Vibrazioni**: Esperienza completa
- **Nessuno**: Solo animazioni visive

### **9. Fallback**
Se il file audio non si carica, l'esercizio funzionerà comunque con le vibrazioni e le animazioni visive.

## 🚀 Deploy
I file audio vengono inclusi automaticamente nel build dell'app quando usi `expo build` o `eas build`.
