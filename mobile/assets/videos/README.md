# 🎥 Video Assets per WellnessCoach

## 📁 Struttura Cartelle
```
assets/
└── videos/
    ├── emotion-detection-video.mp4
    ├── skin-analysis-video.mp4
    └── README.md
```

## 🎬 Come Aggiungere i Video

### **1. Copia i tuoi video**
Copia i tuoi video nella cartella `assets/videos/` con questi nomi:
- `emotion-detection-video.mp4` - Video per la pagina Emotion Detection
- `skin-analysis-video.mp4` - Video per la pagina Skin Analysis

### **2. Formato Video Consigliato**
- **Formato**: MP4 (H.264)
- **Risoluzione**: 1080p (1920x1080) o superiore
- **Durata**: 10-30 secondi (per loop)
- **Aspect Ratio**: 16:9 o 4:3
- **Dimensione**: < 50MB per video

### **3. Caratteristiche Video**

#### **Emotion Detection Video:**
- Mostra persone che esprimono diverse emozioni
- Dimostra il processo di cattura con la fotocamera
- Include animazioni o effetti visivi legati alle emozioni
- Colori: tonalità blu/viola per coerenza con il design

#### **Skin Analysis Video:**
- Mostra il processo di analisi della pelle
- Dimostra come posizionare il viso per la cattura
- Include visualizzazioni di metriche della pelle
- Colori: tonalità cyan/blu per coerenza con il design

### **4. Test dei Video**
Dopo aver aggiunto i video, testa l'app per verificare che:
- I video si carichino correttamente
- Il loop funzioni senza interruzioni
- I controlli play/pause funzionino
- Le dimensioni siano appropriate per il layout

### **5. Fallback**
Se i video non si caricano, l'app mostrerà automaticamente le immagini di fallback originali.

## 🔧 Personalizzazione

### **Modificare i Percorsi Video**
Se vuoi usare nomi diversi per i video, aggiorna questi file:
- `components/EmotionDetectionScreen.tsx` (riga 91)
- `components/SkinAnalysisScreen.tsx` (riga 74)

### **Modificare le Impostazioni Video**
Nel componente `VideoHero.tsx` puoi modificare:
- `autoPlay`: true/false per avvio automatico
- `loop`: true/false per il loop
- `muted`: true/false per l'audio
- `showPlayButton`: true/false per mostrare il pulsante play

## 📱 Compatibilità
I video sono compatibili con:
- iOS (tutti i dispositivi supportati da Expo)
- Android (tutti i dispositivi supportati da Expo)
- Expo Go (per il testing)
- Build standalone (per la distribuzione)

## 🚀 Deploy
I video vengono inclusi automaticamente nel build dell'app quando usi `expo build` o `eas build`.

