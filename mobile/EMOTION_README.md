# Mobile Emotion Detection - Implementation Options

This document outlines the two main approaches for implementing emotion detection on mobile platforms (iOS/Android) using React Native/Expo.

## 🎯 **Current Status**

- **Web**: ✅ MediaPipe Tasks with blendshapes implemented
- **Mobile**: 📋 Two implementation paths available (choose one)

## 🛤️ **Option A: Rapid & Consistent (WebView)**

### Overview
Load the web emotion detection engine inside a WebView and communicate via message passing.

### Architecture
```
React Native App
├── WebView Component
│   ├── Loads: localhost:3000/emotion-engine
│   ├── Runs: MediaPipe Tasks + emotion mapping
│   └── Posts: window.ReactNativeWebView.postMessage(metrics)
├── Native Message Handler
│   ├── Receives: EmotionMetrics JSON
│   └── Updates: React Native state
└── UI Components
    ├── Avatar rendering
    ├── Emotion charts
    └── Chat interface
```

### Implementation Steps
1. **Create WebView Emotion Engine Page**
   ```typescript
   // web-advanced/src/app/emotion-engine/page.tsx
   - Minimal UI (just video preview)
   - MediaPipe Tasks running
   - Message posting: postMessage(JSON.stringify(metrics))
   ```

2. **React Native WebView Integration**
   ```typescript
   // mobile/components/emotion/EmotionWebView.tsx
   import { WebView } from 'react-native-webview';
   
   const handleMessage = (event) => {
     const metrics = JSON.parse(event.nativeEvent.data);
     onEmotionUpdate(metrics);
   };
   
   <WebView
     source={{ uri: 'http://localhost:3000/emotion-engine' }}
     onMessage={handleMessage}
     mediaPlaybackRequiresUserAction={false}
     allowsInlineMediaPlayback={true}
   />
   ```

3. **Camera Permissions**
   ```json
   // app.json
   "permissions": ["CAMERA"]
   ```

### Pros & Cons
- ✅ **Pros**: Single codebase, rapid deployment, consistent behavior
- ✅ **Pros**: Immediate MediaPipe Tasks support
- ⚠️ **Cons**: Slightly lower performance on low-end devices
- ⚠️ **Cons**: Requires network connection for localhost

---

## 🛤️ **Option B: Maximum Performance (Native Bridge)**

### Overview
Integrate MediaPipe Tasks natively and pass blendshapes to the shared emotion mapping.

### Architecture
```
React Native App
├── Native Modules (iOS/Android)
│   ├── iOS: MediaPipe Tasks (Swift/Objective-C)
│   ├── Android: MediaPipe Tasks (Kotlin/Java)
│   └── Bridge: Exposes blendshapes to JS
├── Shared Emotion Mapping
│   ├── @wellnesscoach/shared/emotionMapping.ts
│   └── mapBlendshapesToEmotionMetrics()
└── React Native Components
    ├── EmotionDetector (native module)
    └── UI rendering
```

### Implementation Steps
1. **iOS Native Module**
   ```swift
   // ios/EmotionDetector.swift
   import MediaPipeTasksVision
   
   @objc(EmotionDetector)
   class EmotionDetector: RCTEventEmitter {
     private var faceLandmarker: FaceLandmarker?
     
     @objc func startDetection() {
       // Initialize MediaPipe Tasks
       // Process camera frames
       // Extract blendshapes
       // Send to JS: sendEvent("onBlendshapes", blendshapes)
     }
   }
   ```

2. **Android Native Module**
   ```kotlin
   // android/src/main/java/EmotionDetectorModule.kt
   import com.google.mediapipe.tasks.vision.facelandmarker.FaceLandmarker
   
   class EmotionDetectorModule : ReactContextBaseJavaModule() {
     private var faceLandmarker: FaceLandmarker? = null
     
     @ReactMethod
     fun startDetection() {
       // Initialize MediaPipe Tasks
       // Process camera frames  
       // Extract blendshapes
       // Send to JS: sendEvent("onBlendshapes", blendshapes)
     }
   }
   ```

3. **JavaScript Bridge**
   ```typescript
   // mobile/services/EmotionDetector.ts
   import { NativeEventEmitter, NativeModules } from 'react-native';
   import { mapBlendshapesToEmotionMetrics } from '@wellnesscoach/shared';
   
   const { EmotionDetector } = NativeModules;
   const eventEmitter = new NativeEventEmitter(EmotionDetector);
   
   eventEmitter.addListener('onBlendshapes', (blendshapes) => {
     const metrics = mapBlendshapesToEmotionMetrics(blendshapes, 1.0);
     onEmotionUpdate(metrics);
   });
   ```

### Pros & Cons
- ✅ **Pros**: Maximum performance, native camera access
- ✅ **Pros**: Offline capability, lower battery usage
- ⚠️ **Cons**: Platform-specific code (iOS + Android)
- ⚠️ **Cons**: Longer development time, more complexity

---

## 📱 **Recommended Dependencies**

### Option A (WebView)
```json
{
  "react-native-webview": "^13.6.4",
  "expo-camera": "~15.0.11"
}
```

### Option B (Native – deprecated)
> ⚠️ The previous native approach relied on `react-native-vision-camera` and on-device MediaPipe models. The project now uses Expo Camera plus backend inference, so this configuration is no longer recommended.

---

## 🎯 **Recommendation**

**Start with Option A (WebView)** for rapid prototyping and testing:

1. ✅ **Immediate Results**: Get emotion detection working in hours, not days
2. ✅ **Code Reuse**: Leverage existing web MediaPipe implementation
3. ✅ **Easy Testing**: Test on both platforms simultaneously
4. 🔄 **Future Migration**: Can migrate to Option B later if performance is critical

**Migrate to Option B** if you encounter:
- Performance issues on target devices
- Battery life concerns
- Need for offline operation
- Advanced camera features requirements

---

## 🚀 **Next Steps**

1. **Implement Option A** for immediate functionality
2. **Test on target devices** (iPhone/Android mid-range)
3. **Measure performance** (FPS, battery usage, accuracy)
4. **Decide on Option B migration** based on real-world testing

**Implementation Priority:**
- Sprint 1: Option A (WebView) - Get it working
- Sprint 2: Performance optimization & UI polish
- Sprint 3: Option B (Native) if needed

---

## 📊 **Performance Targets**

- **Frame Rate**: 10-15 FPS (acceptable for emotion detection)
- **Battery Impact**: <5% additional drain per hour
- **Accuracy**: Comparable to web MediaPipe implementation
- **Startup Time**: <3 seconds from app launch to first emotion reading

The WebView approach should easily meet these targets on modern devices (iPhone 12+, Android 10+).
