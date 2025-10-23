# Voice Chat Implementation

This module provides platform-agnostic voice chat functionality for the WellnessCoach app.

## Architecture

```
shared/voice/
├── useVoiceChat.ts      # Main hook with platform detection
├── useVoiceChatWeb.ts   # Web implementation (Web Speech API + WebAudio)
├── useVoiceChatMobile.ts # Mobile implementation (Expo AV + Backend STT)
└── README.md           # This file
```

## Usage

```typescript
import { useVoiceChat } from '@wellness-coach/shared/voice/useVoiceChat';

const MyComponent = () => {
  const voiceChat = useVoiceChat({
    onMessage: (transcript) => {
      console.log('Voice message:', transcript);
    },
    onStart: () => console.log('Voice recording started'),
    onStop: () => console.log('Voice recording stopped'),
    silenceTimeoutMs: 2000, // Auto-send after 2s of silence
    language: 'it-IT'
  });

  return (
    <div>
      <button 
        onClick={voiceChat.start}
        disabled={!voiceChat.isSupported || voiceChat.isRecording}
      >
        {voiceChat.isRecording ? 'Recording...' : 'Start Voice Chat'}
      </button>
      
      <div>Level: {Math.round(voiceChat.level * 100)}%</div>
      <div>Transcript: {voiceChat.transcript}</div>
      
      {voiceChat.error && <div>Error: {voiceChat.error}</div>}
    </div>
  );
};
```

## Platform Implementations

### Web (useVoiceChatWeb)

**Features:**
- Web Speech API for speech recognition
- WebAudio API for real-time audio level monitoring
- Automatic silence detection and message sending
- Continuous recognition with auto-restart
- Echo cancellation and noise suppression

**Browser Support:**
- Chrome/Edge: Full support
- Safari: Partial support (may require user gesture)
- Firefox: Limited support

**Technical Details:**
- Uses `webkitSpeechRecognition` or `SpeechRecognition`
- AudioContext with AnalyserNode for level monitoring
- Automatic cleanup of audio resources
- Error handling with auto-recovery

### Mobile (useVoiceChatMobile)

**Current Status:** Stub implementation

**Planned Features:**
- expo-av for audio recording
- Backend STT integration (OpenAI Whisper/Realtime API)
- Real-time audio streaming
- Offline capability (future)

**Implementation Plan:**

1. **Audio Recording:**
   ```typescript
   import { Audio } from 'expo-av';
   
   // Request permissions
   const { status } = await Audio.requestPermissionsAsync();
   
   // Configure recording
   await Audio.setAudioModeAsync({
     allowsRecordingIOS: true,
     playsInSilentModeIOS: true,
   });
   
   // Start recording
   const recording = new Audio.Recording();
   await recording.prepareToRecordAsync(recordingOptions);
   await recording.startAsync();
   ```

2. **Backend STT Integration:**
   ```typescript
   // Stream audio to backend
   const audioUri = recording.getURI();
   const response = await fetch('/api/stt/transcribe', {
     method: 'POST',
     body: audioFormData
   });
   ```

3. **Real-time Features:**
   - Audio level monitoring via expo-av metering
   - Chunk-based streaming for real-time transcription
   - WebSocket connection for low-latency STT

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `onMessage` | `(message: string) => void` | Required | Callback when transcript is ready |
| `onStart` | `() => void` | Optional | Callback when recording starts |
| `onStop` | `() => void` | Optional | Callback when recording stops |
| `silenceTimeoutMs` | `number` | 2000 | Auto-send after silence (ms) |
| `minRecordingDurationMs` | `number` | 500 | Minimum recording duration (ms) |
| `language` | `string` | 'it-IT' | Speech recognition language |

## Return Interface

```typescript
interface UseVoiceChatReturn {
  start(): Promise<void>;     // Start voice recording
  stop(): void;               // Stop voice recording
  isSupported: boolean;       // Platform support status
  isRecording: boolean;       // Current recording state
  transcript: string;         // Current transcript
  level: number;              // Audio level (0-1)
  platform: 'web' | 'mobile'; // Current platform
  error?: string;             // Error message if any
}
```

## Integration with UI Components

### VoiceChat Component
- Uses the hook for all voice functionality
- Handles UI state and visualizations
- Manages assistant speaking state

### ChatInput Component  
- Integrates microphone button
- Shows send button only when typing
- Seamless voice/text input switching

## Error Handling

The hook provides comprehensive error handling:

- **Permission denied:** Clear message to user
- **No speech detected:** Auto-retry mechanism
- **Network errors:** Graceful fallback
- **Browser compatibility:** Feature detection

## Performance Considerations

- **Memory leaks:** Automatic cleanup of audio resources
- **CPU usage:** Optimized audio processing (60fps max)
- **Battery life:** Efficient audio monitoring on mobile
- **Network usage:** Chunked audio streaming

## Testing

```bash
# Web testing
pnpm --filter web-advanced dev
# Test in Chrome/Safari with microphone access

# Mobile testing (future)
pnpm --filter mobile dev
# Test in Expo Go with device microphone
```

## Future Enhancements

1. **Offline Support:** Local STT models
2. **Multiple Languages:** Dynamic language switching
3. **Voice Commands:** Predefined command recognition
4. **Audio Effects:** Real-time voice processing
5. **Noise Cancellation:** Advanced audio filtering
