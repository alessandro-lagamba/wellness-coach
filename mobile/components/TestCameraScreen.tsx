// TestCameraScreen.tsx
// @ts-nocheck
import { View, Text, TouchableOpacity } from 'react-native';
import React, { useState } from 'react';
import { CameraView, useCameraPermissions } from 'expo-camera';

export default function TestCameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [on, setOn] = useState(false);

  if (!permission) return null;

  if (!permission.granted) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <Text>Camera permission is required</Text>
        <TouchableOpacity onPress={requestPermission} style={{ padding: 12, backgroundColor: '#ddd' }}>
          <Text>Grant permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {on && (
        <CameraView
          key={`test-${on}`}
          style={{ flex: 1 }}
          facing="front"
          onCameraReady={() => console.log('TestCamera: ready')}
          onMountError={(e) => console.log('TestCamera: mount error', e?.nativeEvent ?? e)}
        />
      )}
      <TouchableOpacity
        onPress={() => setOn((v) => !v)}
        style={{ position: 'absolute', bottom: 40, left: 20, right: 20, padding: 16, backgroundColor: '#00000088' }}
      >
        <Text style={{ color: '#fff', textAlign: 'center' }}>{on ? 'Turn OFF' : 'Turn ON'}</Text>
      </TouchableOpacity>
    </View>
  );
}
