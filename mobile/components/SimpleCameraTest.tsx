import React, { useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

export default function SimpleCameraTest() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [isActive, setIsActive] = useState(false);

  if (!permission) {
    return <View style={styles.container}><Text>Loading permissions...</Text></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text>Camera permission not granted</Text>
        <TouchableOpacity onPress={requestPermission} style={styles.button}>
          <Text>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Simple Camera Test</Text>
      
      <TouchableOpacity 
        onPress={() => setIsActive(!isActive)} 
        style={styles.button}
      >
        <Text>{isActive ? 'Stop Camera' : 'Start Camera'}</Text>
      </TouchableOpacity>

      {isActive && (
        <View style={styles.cameraContainer}>
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing="front"
            onCameraReady={() => console.log('Simple camera ready!')}
            onMountError={(e) => console.error('Simple camera error:', e)}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  cameraContainer: {
    width: 300,
    height: 400,
    backgroundColor: '#000',
    borderRadius: 10,
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
  },
});
