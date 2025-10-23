// @ts-nocheck
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Platform } from 'react-native';
import CameraCapture from './CameraCapture';
import { useCameraController } from '../hooks/useCameraController';

export default function CameraCaptureTest() {
  const cameraController = useCameraController({ isScreenFocused: true });
  const [captureResult, setCaptureResult] = useState<string | null>(null);

  const testCapture = async () => {
    console.log('🧪 Testing camera capture...');
    
    try {
      if (!cameraController.isCameraReady()) {
        Alert.alert('Camera Not Ready', `Camera state: ${JSON.stringify({
          hasRef: !!cameraController.ref.current,
          ready: cameraController.ready,
          error: cameraController.error,
          permissionGranted: cameraController.permissionGranted,
        })}`);
        return;
      }

      console.log('🧪 Taking test picture...');
      
      // Add timeout for camera capture
      const capturePromise = cameraController.ref.current.takePictureAsync({
        quality: 0.85,
        base64: true,
        skipProcessing: Platform.OS === 'android',
        exif: false,
      });

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Camera capture timeout')), 10000);
      });

      const photo = await Promise.race([capturePromise, timeoutPromise]);

      console.log('🧪 Test photo captured:', {
        hasUri: !!photo?.uri,
        hasBase64: !!photo?.base64,
        width: photo?.width,
        height: photo?.height,
        uriLength: photo?.uri?.length,
        base64Length: photo?.base64?.length,
      });

      if (!photo) {
        throw new Error('Camera returned null photo');
      }

      if (!photo?.base64) {
        throw new Error('Camera returned empty data');
      }

      setCaptureResult(`✅ Capture successful! Base64 length: ${photo.base64.length}`);
      Alert.alert('Success', 'Photo captured successfully!');
      
    } catch (error: any) {
      console.error('🧪 Test capture error:', error);
      const errorMsg = error?.message || 'Unknown error';
      setCaptureResult(`❌ Capture failed: ${errorMsg}`);
      Alert.alert('Capture Failed', errorMsg);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Camera Capture Test</Text>
      
      <CameraCapture
        isScreenFocused={true}
        controller={cameraController}
        facing="front"
        instructionText="Test camera capture functionality"
      />
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={[styles.button, !cameraController.isCameraReady() && styles.buttonDisabled]} 
          onPress={testCapture}
          disabled={!cameraController.isCameraReady()}
        >
          <Text style={styles.buttonText}>
            {cameraController.isCameraReady() ? 'Test Capture' : 'Camera Loading...'}
          </Text>
        </TouchableOpacity>
      </View>
      
      {captureResult && (
        <Text style={styles.resultText}>{captureResult}</Text>
      )}
      
      <View style={styles.debugContainer}>
        <Text style={styles.debugTitle}>Debug Info:</Text>
        <Text style={styles.debugText}>
          Has Ref: {String(!!cameraController.ref.current)}
        </Text>
        <Text style={styles.debugText}>
          Ready: {String(cameraController.ready)}
        </Text>
        <Text style={styles.debugText}>
          Permission: {String(cameraController.permissionGranted)}
        </Text>
        <Text style={styles.debugText}>
          Error: {cameraController.error || 'None'}
        </Text>
        <Text style={styles.debugText}>
          Is Camera Ready: {String(cameraController.isCameraReady())}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    paddingTop: 50,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: 20,
  },
  buttonContainer: {
    padding: 20,
    alignItems: 'center',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    minWidth: 200,
  },
  buttonDisabled: {
    backgroundColor: '#666',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  resultText: {
    color: 'white',
    fontSize: 14,
    textAlign: 'center',
    marginHorizontal: 20,
    marginTop: 10,
  },
  debugContainer: {
    margin: 20,
    padding: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
  },
  debugTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  debugText: {
    color: 'white',
    fontSize: 12,
    marginBottom: 5,
  },
});
