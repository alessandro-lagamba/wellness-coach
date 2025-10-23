// @ts-nocheck
import React from 'react';
import { View, ActivityIndicator, StyleSheet, Dimensions, Platform, Text } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

const { width } = Dimensions.get('window');
const PREVIEW_ASPECT = 3 / 4;
const PREVIEW_HEIGHT = Math.round(width / PREVIEW_ASPECT);

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
  const [cameraMounted, setCameraMounted] = React.useState(false);

  // Enhanced ref management with aggressive persistence
  const setCameraRef = React.useCallback((ref: CameraView | null) => {
    console.log('📷 [CameraCapture] setCameraRef called. New ref:', !!ref, 'Previous ref.current:', !!cameraRef.current, 'Controller ref.current:', !!controller.ref.current, 'Mounted:', cameraMounted);
    
    // Don't clear refs if we're just getting a new ref and the old one was valid
    if (ref && cameraRef.current && cameraRef.current === ref) {
      console.log('📷 [CameraCapture] Same ref received, no action needed');
      return;
    }
    
    cameraRef.current = ref;
    
    if (ref) {
      controller.ref.current = ref;
      setRefSet(true);
      setCameraMounted(true);
      console.log('📷 [CameraCapture] Camera ref set successfully and persisted');
      
      // Store globally for persistence
      (globalThis as any).globalCameraRef = ref;
      
      // More aggressive ref restoration
      const restoreRefs = () => {
        if (controller.ref.current !== ref) {
          console.log('📷 [CameraCapture] Ref was lost, restoring...');
          controller.ref.current = ref;
        }
        if ((globalThis as any).globalCameraRef !== ref) {
          console.log('📷 [CameraCapture] Global ref was lost, restoring...');
          (globalThis as any).globalCameraRef = ref;
        }
      };
      
      // Immediate restoration
      restoreRefs();
      
      // Delayed restoration to catch any async issues
      setTimeout(restoreRefs, 100);
      setTimeout(restoreRefs, 500);
    } else {
      // Only clear refs if we're actually unmounting, not just switching
      if (!isScreenFocused) {
        console.log('📷 [CameraCapture] Screen not focused, clearing refs');
        controller.ref.current = null;
        setRefSet(false);
        setCameraMounted(false);
      } else {
        console.log('📷 [CameraCapture] Ref became null but screen is focused, keeping refs');
      }
    }
  }, [controller, cameraMounted, isScreenFocused]);

  // Aggressive ref sync - runs on every render
  React.useEffect(() => {
    if (cameraRef.current && cameraRef.current !== controller.ref.current) {
      console.log('📷 Aggressive sync: restoring camera ref');
      controller.ref.current = cameraRef.current;
    }
  });

  // Prevent unmounting during critical operations
  React.useEffect(() => {
    const handleBeforeUnload = () => {
      if (controller.detecting) {
        console.log('📷 Preventing unmount during detection');
        return false;
      }
    };
    
    // Add cleanup protection
    return () => {
      // Only cleanup if not detecting and not analyzing
      if (!controller.detecting && !controller.ready) {
        console.log('📷 CameraCapture unmounting, clearing ref');
        controller.ref.current = null;
      } else {
        console.log('📷 CameraCapture unmounting but keeping ref (detecting:', controller.detecting, 'ready:', controller.ready, ')');
      }
    };
  }, [controller.detecting, controller.ready]);

  // Auto-start camera when component mounts
  React.useEffect(() => {
    const initCamera = async () => {
      if (!permission?.granted) {
        console.log('🔐 Requesting camera permission...');
        const result = await requestPermission();
        console.log('🔐 Permission request result:', result);
        if (!result?.granted) {
          setCameraError('Camera permission denied');
        }
      }
    };
    initCamera();
  }, []);

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
      console.log('📷 CameraCapture unmounting, clearing ref');
      cameraRef.current = null;
      controller.ref.current = null;
      setRefSet(false);
      setCameraMounted(false);
    };
  }, [controller]);

  console.log('📷 CameraCapture render state:', {
    isScreenFocused,
    permission: permission?.granted,
    cameraReady,
    cameraError,
    controllerReady: controller.ready,
  });

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
            console.log('📷 Camera ready callback triggered, ref exists:', !!controller.ref.current, 'refSet:', refSet, 'mounted:', cameraMounted);
            setCameraReady(true);
            controller.setReady(true);
            controller.setError(null);
            
            // Ensure ref is still set after camera is ready
            if (cameraRef.current && !controller.ref.current) {
              console.log('📷 Ref lost during ready, restoring...');
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
  wrap: { marginHorizontal: 20, marginTop: 24, marginBottom: 24 },
  preview: {
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
