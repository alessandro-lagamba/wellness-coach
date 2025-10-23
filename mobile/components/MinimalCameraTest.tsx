// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

const { width, height } = Dimensions.get('window');

export default function MinimalCameraTest() {
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);

  useEffect(() => {
    const initCamera = async () => {
      if (!permission?.granted) {
        console.log('🔐 Requesting camera permission...');
        const result = await requestPermission();
        console.log('🔐 Permission result:', result);
      }
    };
    initCamera();
  }, []);

  console.log('📷 MinimalCameraTest render:', {
    permission: permission?.granted,
    cameraReady,
  });

  if (!permission?.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Camera permission not granted</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.debugText}>
        MINIMAL CAMERA TEST
        {'\n'}Permission: {String(permission?.granted)}
        {'\n'}Ready: {String(cameraReady)}
      </Text>
      
      <View style={styles.cameraContainer}>
        <CameraView
          style={styles.camera}
          facing="front"
          onCameraReady={() => {
            console.log('📷 Minimal camera ready!');
            setCameraReady(true);
          }}
          onMountError={(error) => {
            console.error('📷 Minimal camera error:', error);
          }}
        />
        
        {!cameraReady && (
          <View style={styles.loadingOverlay}>
            <Text style={styles.loadingText}>Loading camera...</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    padding: 20,
  },
  debugText: {
    backgroundColor: 'rgba(255, 0, 0, 0.8)',
    color: 'white',
    padding: 10,
    marginBottom: 20,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: 'bold',
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 255, 0, 0.3)', // Green background
    borderRadius: 20,
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  text: {
    fontSize: 18,
    textAlign: 'center',
    marginTop: 50,
  },
});
