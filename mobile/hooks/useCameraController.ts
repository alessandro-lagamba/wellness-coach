import { useEffect, useMemo, useRef, useState } from 'react';
import { useCameraPermissions, CameraView } from 'expo-camera';

// Global camera ref storage for persistence across re-renders
let globalCameraRef: CameraView | null = null;

export function useCameraController({ isScreenFocused }: { isScreenFocused: boolean }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [active, setActive] = useState(false);
  const [ready, setReady] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<CameraView | null>(null);

  const permissionLoading = !permission || permission.status === 'undetermined';
  const permissionGranted = !!permission?.granted;

  useEffect(() => {
    console.log('🎥 Camera controller screen focus changed:', isScreenFocused);
    if (!isScreenFocused) {
      console.log('🎥 Screen not focused, stopping camera');
      setActive(false);
      setReady(false);
      setDetecting(false);
    }
  }, [isScreenFocused]);

  const ensurePermission = async () => {
    console.log('🔐 Current permission state:', permission);
    if (permissionGranted) {
      console.log('🔐 Permission already granted');
      return true;
    }
    console.log('🔐 Requesting camera permission...');
    const res = await requestPermission();
    console.log('🔐 Permission request result:', res);
    return !!res?.granted;
  };

  const startCamera = async () => {
    console.log('🎥 Starting camera...');
    const granted = await ensurePermission();
    console.log('🎥 Permission granted:', granted);
    if (!granted) {
      setError('Camera permission denied');
      return false;
    }
    
    console.log('🎥 Setting camera state: active=true, ready=false');
    setActive(true);
    setReady(false);
    setDetecting(false);
    setError(null);
    return true;
  };

  const stopCamera = () => {
    console.log('🎥 Stopping camera');
    setActive(false);
    setReady(false);
    setDetecting(false);
    setError(null);
  };

  // Add method to check if camera is properly initialized
  const isCameraReady = () => {
    // Try to restore ref from global storage if local ref is null
    if (!ref.current && globalCameraRef) {
      console.log('🎥 Restoring camera ref from global storage');
      ref.current = globalCameraRef;
    }
    
    const cameraReady = !!ref.current && ready && permissionGranted && !error;
    console.log('🎥 isCameraReady check:', {
      hasRef: !!ref.current,
      hasGlobalRef: !!globalCameraRef,
      ready,
      permissionGranted,
      error,
      result: cameraReady,
    });
    return cameraReady;
  };

  // Store ref globally when it's set
  useEffect(() => {
    if (ref.current) {
      globalCameraRef = ref.current;
      console.log('🎥 Stored camera ref globally');
    }
  }, []);

  // Add method to recover camera ref if it becomes null
  const recoverCameraRef = () => {
    console.log('🎥 Attempting to recover camera ref...');
    if (!ref.current) {
      console.log('🎥 Camera ref is null, cannot recover automatically');
      return false;
    }
    return true;
  };

  return {
    ref,
    active,
    ready,
    detecting,
    error,
    setActive,
    setReady,
    setDetecting,
    setError,
    ensurePermission,
    startCamera,
    stopCamera,
    permissionLoading,
    permissionGranted,
    isCameraReady,
    recoverCameraRef,
  };
}
