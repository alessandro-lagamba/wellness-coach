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
    // 🔥 FIX: Rimuoviamo console.log eccessivi
    if (!isScreenFocused) {
      setActive(false);
      setReady(false);
      setDetecting(false);
    }
  }, [isScreenFocused]);

  const ensurePermission = async () => {
    // 🔥 FIX: Rimuoviamo console.log eccessivi
    if (permissionGranted) {
      return true;
    }
    // If permission was denied, return false immediately (don't request again)
    if (permission?.status === 'denied') {
      return false;
    }
    const res = await requestPermission();
    return !!res?.granted;
  };

  const startCamera = async () => {
    // 🔥 FIX: Evita di avviare la camera se è già attiva
    if (active) {
      return true;
    }
    
    // 🔥 FIX: Rimuoviamo console.log eccessivi
    const granted = await ensurePermission();
    if (!granted) {
      setError('Camera permission denied');
      return false;
    }
    
    setActive(true);
    setReady(false);
    setDetecting(false);
    setError(null);
    return true;
  };

  const stopCamera = () => {
    // 🔥 FIX: Rimuoviamo console.log eccessivi
    setActive(false);
    setReady(false);
    setDetecting(false);
    setError(null);
  };

  // Add method to check if camera is properly initialized
  const isCameraReady = () => {
    // Try to restore ref from global storage if local ref is null
    if (!ref.current && globalCameraRef) {
      ref.current = globalCameraRef;
    }
    
    const cameraReady = !!ref.current && ready && permissionGranted && !error;
    // 🔥 FIX: Rimuoviamo console.log eccessivi
    return cameraReady;
  };

  // Store ref globally when it's set
  useEffect(() => {
    if (ref.current) {
      globalCameraRef = ref.current;
      // 🔥 FIX: Rimuoviamo console.log eccessivi
    }
  }, []);

  // Add method to recover camera ref if it becomes null
  const recoverCameraRef = () => {
    // 🔥 FIX: Rimuoviamo console.log eccessivi
    if (!ref.current) {
      return false;
    }
    return true;
  };

  const permissionDenied = permission?.status === 'denied';
  const needsPermission = !permissionGranted && !permissionLoading;

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
    requestPermission, // 🔥 FIX: Esposto per aprire direttamente il popup nativo
    startCamera,
    stopCamera,
    permissionLoading,
    permissionGranted,
    permissionDenied,
    needsPermission,
    isCameraReady,
    recoverCameraRef,
  };
}
