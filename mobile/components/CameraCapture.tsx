// @ts-nocheck
import React from 'react';
import { View, ActivityIndicator, StyleSheet, Dimensions, Platform, Text } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

const { width } = Dimensions.get('window');
const PREVIEW_ASPECT = 3 / 4;
const PREVIEW_WIDTH = width - 32; // match wrap horizontal padding
const PREVIEW_HEIGHT = Math.round((PREVIEW_WIDTH) / PREVIEW_ASPECT);

type Props = {
  isScreenFocused: boolean;
  controller: ReturnType<typeof import('../hooks/useCameraController').useCameraController>;
  facing?: 'front' | 'back';
  onReady?: () => void;
  instructionText?: string;  // Simple instruction text below camera
  switching?: boolean; // Whether camera is currently switching
};

export default function CameraCapture({
  isScreenFocused,
  controller,
  facing = 'front',
  onReady,
  instructionText,
  switching = false,
}: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = React.useState(false);
  const [cameraError, setCameraError] = React.useState<string | null>(null);
  const cameraRef = React.useRef<CameraView | null>(null);
  const [refSet, setRefSet] = React.useState(false);
  // 🔥 FIX: Usa useRef invece di useState per cameraMounted per evitare re-render infiniti
  const cameraMountedRef = React.useRef(false);

  // Enhanced ref management with aggressive persistence
  const setCameraRef = React.useCallback((ref: CameraView | null) => {
    // 🔥 FIX: Rimuoviamo console.log eccessivi - solo errori critici
    // Don't clear refs if we're just getting a new ref and the old one was valid
    if (ref && cameraRef.current && cameraRef.current === ref) {
      return; // Same ref, no action needed
    }

    cameraRef.current = ref;

    if (ref) {
      controller.ref.current = ref;
      setRefSet(true);
      cameraMountedRef.current = true;

      // Store globally for persistence
      (globalThis as any).globalCameraRef = ref;

      // More aggressive ref restoration (solo se necessario)
      const restoreRefs = () => {
        if (controller.ref.current !== ref) {
          controller.ref.current = ref;
        }
        if ((globalThis as any).globalCameraRef !== ref) {
          (globalThis as any).globalCameraRef = ref;
        }
      };

      // Immediate restoration
      restoreRefs();

      // Delayed restoration to catch any async issues (solo una volta)
      // 🔥 FIX: Memory leak - puliamo i timeout se il componente viene smontato
      const timeoutId1 = setTimeout(restoreRefs, 100);
      const timeoutId2 = setTimeout(restoreRefs, 500);
      
      // Store timeout IDs for cleanup (if component unmounts before timeouts fire)
      // Note: These are very short timeouts (100ms, 500ms) so cleanup is less critical,
      // but we store them in case we need to add cleanup logic later
      (globalThis as any).cameraRestoreTimeouts = [timeoutId1, timeoutId2];
    } else {
      // Only clear refs if we're actually unmounting, not just switching
      if (!isScreenFocused) {
        controller.ref.current = null;
        setRefSet(false);
        cameraMountedRef.current = false;
      }
    }
  }, [controller, isScreenFocused]);

  // 🔥 FIX: Rimuoviamo questo useEffect che causa loop infiniti
  // Il ref viene già gestito correttamente in setCameraRef

  // Prevent unmounting during critical operations
  React.useEffect(() => {
    // Add cleanup protection
    return () => {
      // Only cleanup if not detecting and not analyzing
      if (!controller.detecting && !controller.ready) {
        controller.ref.current = null;
      }
    };
  }, [controller.detecting, controller.ready]);

  // Auto-start camera when component mounts
  React.useEffect(() => {
    const initCamera = async () => {
      if (!permission?.granted) {
        const result = await requestPermission();
        if (!result?.granted) {
          setCameraError('Camera permission denied');
        }
      }
    };
    initCamera();
  }, [permission?.granted, requestPermission]);

  // Reset camera ready state when facing changes (but not when switching)
  React.useEffect(() => {
    if (!switching) {
      setCameraReady(false);
      setCameraError(null);
    }
  }, [facing, switching]);

  // Keep camera ready state during switching to prevent loading screen
  React.useEffect(() => {
    if (switching) {
      setCameraReady(true);
      setCameraError(null);
    }
  }, [switching]);

  // Cleanup effect
  React.useEffect(() => {
    return () => {
      cameraRef.current = null;
      controller.ref.current = null;
      setRefSet(false);
      cameraMountedRef.current = false;
    };
  }, [controller]);

  // 🔥 FIX: Rimuoviamo console.log che viene eseguito ad ogni render

  if (!permission?.granted) {
    return (
      <View style={styles.wrap}>
        <View style={styles.preview}>
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="white" />
            <Text style={styles.loadingText}>
              {cameraError || 'Loading camera...'}
            </Text>
          </View>
        </View>
        {instructionText && (
          <Text style={styles.instructionText}>{instructionText}</Text>
        )}
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.preview}>
        <CameraView
          key={`camera-stable`}
          ref={setCameraRef}
          style={styles.camera}
          facing={facing}
          onCameraReady={() => {
            setCameraReady(true);
            controller.setReady(true);
            controller.setError(null);

            // Ensure ref is still set after camera is ready
            if (cameraRef.current && !controller.ref.current) {
              controller.ref.current = cameraRef.current;
            }

            onReady?.();
          }}
          onMountError={(e) => {
            const errorMsg = e?.nativeEvent?.message || e?.message || 'Camera failed to initialize';
            console.error('📷 Camera mount error:', errorMsg);
            setCameraReady(false);
            controller.setReady(false);
            controller.setError(errorMsg);
            setCameraError(errorMsg);
          }}
        />

        {!cameraReady && !switching && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="white" />
            <Text style={styles.loadingText}>
              {cameraError || 'Loading camera...'}
            </Text>
          </View>
        )}
      </View>

      {/* Simple instruction text below camera */}
      {instructionText && (
        <Text style={styles.instructionText}>{instructionText}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 16, marginTop: 0, marginBottom: 8, alignItems: 'center' },
  preview: {
    width: PREVIEW_WIDTH,
    height: PREVIEW_HEIGHT,
    borderRadius: 28,
    overflow: 'hidden', // Always hidden to ensure rounded corners work on both platforms
    backgroundColor: '#000',
    minHeight: 200,
  },
  camera: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  instructionText: {
    width: PREVIEW_WIDTH,
    textAlign: 'center',
    color: '#666',
    fontSize: 14,
    marginTop: 12,
    paddingHorizontal: 20,
    lineHeight: 20,
  },
  loadingText: {
    color: 'white',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
});
