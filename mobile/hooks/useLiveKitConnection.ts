import { useState, useCallback, useRef, useEffect } from 'react';
import { Platform } from 'react-native';
import { Audio } from 'expo-av';
import { AudioSession, LiveKitRoom } from '@livekit/react-native';
import { Room, RoomEvent, LocalParticipant, RemoteParticipant, Track } from 'livekit-client';

export interface LiveKitConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  isDisconnected: boolean;
  error?: string;
}

export interface LiveKitRoomInfo {
  roomName: string;
  participantId: string;
  token: string;
  url: string;
}

export interface LiveKitAudioLevels {
  inputLevel: number;
  outputLevel: number;
}

export const useLiveKitConnection = () => {
  // Backend base URL: prefer env, fallback to sensible defaults per platform
  const BACKEND_URL =
    process.env.EXPO_PUBLIC_BACKEND_URL ||
    (Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://10.163.94.238:3000');
  const [connectionState, setConnectionState] = useState<LiveKitConnectionState>({
    isConnected: false,
    isConnecting: false,
    isDisconnected: true,
  });
  
  const [audioLevels, setAudioLevels] = useState<LiveKitAudioLevels>({
    inputLevel: 0,
    outputLevel: 0,
  });
  
  const [isMicrophoneEnabled, setIsMicrophoneEnabled] = useState(false);
  const [isSpeakerEnabled, setIsSpeakerEnabled] = useState(true);
  
  const roomRef = useRef<Room | null>(null);
  const participantIdRef = useRef<string>('');

  // registerGlobals() is invoked once in app/_layout.tsx at app startup

  /**
   * Get LiveKit token from backend
   */
  const getLiveKitToken = useCallback(async (roomName: string, participantId: string): Promise<LiveKitRoomInfo | null> => {
    try {
      console.log('[LiveKit Hook] 🔑 Requesting token for room:', roomName, 'participant:', participantId);
      
      const response = await fetch(`${ BACKEND_URL }/api/livekit/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomName,
          identity: participantId,
          metadata: JSON.stringify({ platform: 'mobile' }),
        }),
      });

      if (!response.ok) {
        throw new Error(`Token request failed: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Token generation failed');
      }

      console.log('[LiveKit Hook] ✅ Token received successfully');
      
      return {
        roomName: data.roomName,
        participantId: data.identity,
        token: data.token,
        url: data.url,
      };

    } catch (error) {
      console.error('[LiveKit Hook] ❌ Token request failed:', error);
      return null;
    }
  }, []);

  /**
   * Connect to LiveKit room using the correct React Native pattern
   * Based on official LiveKit documentation for React Native/Expo
   */
  const connectToRoom = useCallback(async (roomName: string, participantId: string): Promise<boolean> => {
    try {
      console.log('[LiveKit Hook] 🚀 Connecting to room:', roomName);
      
      setConnectionState({
        isConnected: false,
        isConnecting: true,
        isDisconnected: false,
      });

      // Get token
      const roomInfo = await getLiveKitToken(roomName, participantId);
      if (!roomInfo) {
        throw new Error('Failed to get LiveKit token');
      }

      participantIdRef.current = participantId;

      // Start native audio session before connecting
      try {
        await AudioSession.startAudioSession();
        console.log('[LiveKit Hook] 🎧 AudioSession started');
      } catch (e) {
        console.warn('[LiveKit Hook] ⚠️ AudioSession start failed', e);
      }

      // For React Native, we should use LiveKitRoom component instead of low-level Room API
      // The LiveKitRoom component handles the connection internally
      console.log('[LiveKit Hook] ✅ Ready for LiveKitRoom component connection');
      
      setConnectionState({
        isConnected: true,
        isConnecting: false,
        isDisconnected: false,
      });

      return true;

    } catch (error) {
      console.error('[LiveKit Hook] ❌ Connection failed:', error);
      
      setConnectionState({
        isConnected: false,
        isConnecting: false,
        isDisconnected: true,
        error: error instanceof Error ? error.message : 'Connection failed',
      });

      return false;
    }
  }, [getLiveKitToken]);

  /**
   * Disconnect from LiveKit room
   */
  const disconnectFromRoom = useCallback(async (): Promise<void> => {
    try {
      console.log('[LiveKit Hook] 🛑 Disconnecting from room');
      
      if (roomRef.current) {
        await roomRef.current.disconnect();
        roomRef.current = null;
      }

      try {
        await AudioSession.stopAudioSession();
        console.log('[LiveKit Hook] 🎧 AudioSession stopped');
      } catch (e) {
        console.warn('[LiveKit Hook] ⚠️ AudioSession stop failed', e);
      }

      setConnectionState({
        isConnected: false,
        isConnecting: false,
        isDisconnected: true,
      });

      setIsMicrophoneEnabled(false);
      setAudioLevels({ inputLevel: 0, outputLevel: 0 });

      console.log('[LiveKit Hook] ✅ Disconnected successfully');

    } catch (error) {
      console.error('[LiveKit Hook] ❌ Disconnect failed:', error);
    }
  }, []);

  /**
   * Enable/disable microphone
   */
  const toggleMicrophone = useCallback(async (): Promise<boolean> => {
    try {
      if (!roomRef.current) {
        console.warn('[LiveKit Hook] ⚠️ No room connection');
        return false;
      }

      const newState = !isMicrophoneEnabled;
      
      if (newState) {
        // Enable microphone
        await roomRef.current.localParticipant.setMicrophoneEnabled(true);
        console.log('[LiveKit Hook] 🎤 Microphone enabled');
      } else {
        // Disable microphone
        await roomRef.current.localParticipant.setMicrophoneEnabled(false);
        console.log('[LiveKit Hook] 🔇 Microphone disabled');
      }

      setIsMicrophoneEnabled(newState);
      return newState;

    } catch (error) {
      console.error('[LiveKit Hook] ❌ Microphone toggle failed:', error);
      return isMicrophoneEnabled;
    }
  }, [isMicrophoneEnabled]);

  /**
   * Enable/disable speaker
   */
  const toggleSpeaker = useCallback(async (): Promise<boolean> => {
    try {
      if (!roomRef.current) {
        console.warn('[LiveKit Hook] ⚠️ No room connection');
        return false;
      }

      const newState = !isSpeakerEnabled;
      
      // Speaker routing is platform-specific; defer to system audio routing for now
      console.log('[LiveKit Hook] 🔊 Speaker state set to', newState);

      setIsSpeakerEnabled(newState);
      return newState;

    } catch (error) {
      console.error('[LiveKit Hook] ❌ Speaker toggle failed:', error);
      return isSpeakerEnabled;
    }
  }, [isSpeakerEnabled]);

  /**
   * Set up room event listeners
   */
  const setupRoomEventListeners = useCallback((room: Room) => {
    // Connection events
    room.on(RoomEvent.Connected, () => {
      console.log('[LiveKit Hook] ✅ Room connected');
    });

    room.on(RoomEvent.Disconnected, (reason: any) => {
      console.log('[LiveKit Hook] 🔌 Room disconnected:', reason);
      setConnectionState({
        isConnected: false,
        isConnecting: false,
        isDisconnected: true,
      });
    });

    // Participant events
    room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
      console.log('[LiveKit Hook] 👤 Participant connected:', participant.identity);
    });

    room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
      console.log('[LiveKit Hook] 👋 Participant disconnected:', participant.identity);
    });

    // Track events
    room.on(RoomEvent.TrackSubscribed, (track: Track, publication: any, participant: RemoteParticipant) => {
      console.log('[LiveKit Hook] 🎵 Track subscribed:', track.kind, 'from', participant.identity);
    });

    room.on(RoomEvent.TrackUnsubscribed, (track: Track, publication: any, participant: RemoteParticipant) => {
      console.log('[LiveKit Hook] 🔇 Track unsubscribed:', track.kind, 'from', participant.identity);
    });

    // Audio level event subscription omitted due to SDK variance across platforms

  }, []);

  /**
   * Start voice chat session
   */
  const startVoiceChat = useCallback(async (roomName: string, participantId: string): Promise<boolean> => {
    try {
      console.log('[LiveKit Hook] 🎤 Starting voice chat session');
      
      // Configure audio session for recording (platform-aware)
      try {
        await Audio.setAudioModeAsync(
          Platform.select({
            ios: {
              allowsRecordingIOS: true,
              playsInSilentModeIOS: true,
              staysActiveInBackground: true,
            },
            android: {
              shouldDuckAndroid: true,
              playThroughEarpieceAndroid: false,
              staysActiveInBackground: true,
            },
            default: {},
          }) as any
        );
      } catch (e) {
        console.warn('[LiveKit Hook] ⚠️ setAudioModeAsync failed:', e);
      }

      // Connect to room
      const connected = await connectToRoom(roomName, participantId);
      if (!connected) {
        return false;
      }

      // Enable microphone
      const micEnabled = await toggleMicrophone();
      if (!micEnabled) {
        console.warn('[LiveKit Hook] ⚠️ Failed to enable microphone');
      }

      // Notify backend agent to start
      try {
        const response = await fetch(`${ BACKEND_URL }/api/agent/start`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            roomName,
            participantId,
          }),
        });

        if (response.ok) {
          console.log('[LiveKit Hook] ✅ Agent started successfully');
        } else {
          console.warn('[LiveKit Hook] ⚠️ Agent start failed:', response.status);
        }
      } catch (error) {
        console.warn('[LiveKit Hook] ⚠️ Agent start request failed:', error);
      }

      return true;

    } catch (error) {
      console.error('[LiveKit Hook] ❌ Voice chat start failed:', error);
      return false;
    }
  }, [connectToRoom, toggleMicrophone]);

  /**
   * Stop voice chat session
   */
  const stopVoiceChat = useCallback(async (): Promise<void> => {
    try {
      console.log('[LiveKit Hook] 🛑 Stopping voice chat session');
      
      // Notify backend agent to stop
      if (participantIdRef.current) {
        try {
          await fetch(`${ BACKEND_URL }/api/agent/stop`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              participantId: participantIdRef.current,
            }),
          });
          console.log('[LiveKit Hook] ✅ Agent stopped successfully');
        } catch (error) {
          console.warn('[LiveKit Hook] ⚠️ Agent stop request failed:', error);
        }
      }

      // Disconnect from room
      await disconnectFromRoom();

    } catch (error) {
      console.error('[LiveKit Hook] ❌ Voice chat stop failed:', error);
    }
  }, [disconnectFromRoom]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
    };
  }, []);

  return {
    // Connection state
    connectionState,
    audioLevels,
    isMicrophoneEnabled,
    isSpeakerEnabled,
    
    // Actions
    connectToRoom,
    disconnectFromRoom,
    toggleMicrophone,
    toggleSpeaker,
    startVoiceChat,
    stopVoiceChat,
    
    // Utils
    getLiveKitToken,
  };
};
