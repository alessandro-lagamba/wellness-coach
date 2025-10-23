# Skin Analysis Module

## Overview

Il modulo Skin Analysis fornisce analisi real-time della salute della pelle utilizzando la webcam e MediaPipe Face Landmarker. È integrato nel sistema esistente di emotion detection per riutilizzare lo stesso stream video e i landmarks facciali.

## Features

### 🎯 **Metriche Principali**
- **Texture (Uniformità)**: 0-100 - Analizza la consistenza della pelle usando varianza Laplaciana
- **Redness (Rossore)**: 0-100 - Calcola il rapporto R/(G+B+ε) sulle guance
- **Shine (Lucentezza)**: 0-100 - Rileva highlights in HSV (V alto + S basso)
- **Overall**: 0-100 - Media pesata (40% texture + 30% redness + 30% shine)
- **Confidence**: 0-100 - Qualità dell'analisi basata su illuminazione e presenza volto

### 🔧 **Tecnologie**
- **MediaPipe Face Landmarker**: Per ROI detection (guance sinistra/destra, fronte)
- **Canvas Offscreen**: Processing a 256-320px per performance
- **EMA Smoothing**: α=0.3 per stabilità dei valori
- **Fallback Analysis**: Quando landmarks non disponibili

### ⚡ **Performance**
- **FPS**: 2 FPS (500ms intervals) per evitare overhead
- **Memory**: Riutilizzo buffer ImageData, nessuna allocazione continua
- **CPU**: Ottimizzato con sampling ogni 4px e kernel 3x3

## Architettura

### File Structure
```
web-advanced/src/
├── services/
│   └── skinAnalysis.ts          # Core analysis functions
├── components/
│   └── SkinPanel.tsx            # UI component
└── app/
    └── page.tsx                 # Integration in dashboard
```

### Integration Flow
1. **Emotion Detection** avvia webcam e MediaPipe
2. **Landmarks** vengono estratti e passati a Skin Analysis
3. **ROI Extraction** usa landmarks per definire regioni (guance, fronte)
4. **Image Processing** analizza texture, redness, shine
5. **EMA Smoothing** stabilizza i valori nel tempo
6. **UI Update** mostra metriche in tempo reale

## API Reference

### `startSkinAnalysis(options, onUpdate)`
```typescript
interface SkinAnalysisOptions {
  videoEl: HTMLVideoElement;
  landmarks?: number[][];  // MediaPipe face landmarks
  targetFps?: number;      // default 2 (500ms intervals)
  enableOverlay?: boolean;
}

interface SkinMetrics {
  texture: number;      // 0-100 (uniformity)
  redness: number;      // 0-100 (skin redness)
  shine: number;        // 0-100 (skin shine/oiliness)
  overall: number;      // 0-100 (weighted average)
  confidence: number;   // 0-100 (analysis confidence)
  source: 'mediapipe' | 'fallback';
}
```

### `extractROIsFromLandmarks(landmarks, width, height)`
Estrae regioni di interesse dai landmarks MediaPipe:
- **Left Cheek**: Punti 116-147
- **Right Cheek**: Punti 345-376  
- **Forehead**: Punti 10, 151, 9, 8, 107, 55, 65, 52, 53, 46, 124, 35, 41, 42, 31, 228, 229, 230

### `calculateSkinMetrics(imageData, rois, width, height)`
Calcola le metriche principali:
- **Texture**: Varianza locale usando kernel Laplaciano
- **Redness**: Media R/(G+B+ε) sulle guance
- **Shine**: Ratio highlights in HSV (V>0.7, S<0.3)

## UI Components

### SkinPanel
- **Start/Stop Analysis**: Controlli per avviare/fermare
- **Score Display**: 3 metriche principali + overall
- **Confidence Indicator**: Barra di qualità analisi
- **Overlay Toggle**: Mostra/nasconde ROI sul video
- **FPS Counter**: Performance monitoring
- **Status Messages**: Feedback utente

### Layout Integration
- Posizionato nella **colonna sinistra** sotto Emotion Panel
- **Condivide** video stream e landmarks con emotion detection
- **Responsive** design con indicatori colorati

## Acceptance Criteria ✅

- [x] **UI fluida**: Nessun blocco durante analisi
- [x] **3 score stabili**: Texture, redness, shine + overall + confidence
- [x] **Overlay toggle**: On/off senza glitch
- [x] **Start/Stop pulito**: Nessun memory leak
- [x] **Integrazione**: Riuso webcam e landmarks esistenti
- [x] **Performance**: 2 FPS, CPU ottimizzato
- [x] **Fallback**: Funziona anche senza landmarks

## Usage

1. **Avvia Emotion Detection** per inizializzare webcam
2. **Clicca "Start Skin Analysis"** nel SkinPanel
3. **Monitora metriche** in tempo reale
4. **Toggle overlay** per vedere ROI
5. **Stop analysis** quando completato

## Troubleshooting

### Low Confidence
- **Illuminazione**: Assicurati buona luce naturale
- **Posizione**: Volto centrato e ben visibile
- **Distanza**: Non troppo vicino/lontano dalla webcam

### Performance Issues
- **FPS**: Riduci targetFps se necessario
- **Resolution**: Diminuisci maxSize in skinAnalysis.ts
- **Browser**: Usa Chrome/Firefox per migliori performance

### No Landmarks
- **Fallback**: Il sistema usa analisi semplificata
- **Confidence**: Sarà più bassa ma funzionale
- **ROI**: Usa regione centrale dell'immagine

## Future Enhancements

- **ML Models**: Integrazione CoreML/TFLite per analisi avanzate
- **Skin Conditions**: Rilevamento acne, rughe, macchie
- **Recommendations**: Suggerimenti basati su metriche
- **History**: Tracking metriche nel tempo
- **Export**: Salvataggio report e immagini
