import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { GLView } from 'expo-gl';
import { Renderer } from 'expo-three';
import * as THREE from 'three';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming,
  interpolate 
} from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');

interface AudioOrbVisualProps {
  isListening: boolean;
  isSpeaking: boolean;
  isProcessing: boolean;
  audioLevels?: {
    input: number;
    output: number;
    bass: number;
    mid: number;
    treble: number;
  };
}

export const AudioOrbVisual: React.FC<AudioOrbVisualProps> = ({
  isListening,
  isSpeaking,
  isProcessing,
  audioLevels = {
    input: 0,
    output: 0,
    bass: 0,
    mid: 0,
    treble: 0,
  },
}) => {
  const rendererRef = useRef<Renderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const sphereRef = useRef<
    THREE.Mesh<THREE.IcosahedronGeometry, THREE.MeshStandardMaterial> | null
  >(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const animationRef = useRef<number | undefined>(undefined);
  
  // Animazioni React Native
  const orbScale = useSharedValue(1);
  const orbOpacity = useSharedValue(0.8);
  const pulseScale = useSharedValue(1);
  const rotationX = useSharedValue(0);
  const rotationY = useSharedValue(0);
  const rotationZ = useSharedValue(0);

    // ✅ Inizializza Three.js scene
  const onContextCreate = async (gl: any) => {
    const renderer = new Renderer({ gl });
    renderer.setSize(width, height);
    // 🆕 Sfondo dinamico iniziale basato sullo stato
    const initialBg = isSpeaking ? 0x0a3923 : isListening ? 0x0d1b2e : isProcessing ? 0x2a1f0a : 0x1a0c2a;
    renderer.setClearColor(initialBg, 1.0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    rendererRef.current = renderer;

    // ✅ Crea scene con sfondo dinamico
    const scene = new THREE.Scene();
    // 🆕 Sfondo dinamico basato sullo stato (non più nero fisso)
    const bgColor = isSpeaking ? 0x0a3923 : isListening ? 0x0d1b2e : isProcessing ? 0x2a1f0a : 0x1a0c2a;
    scene.background = new THREE.Color(bgColor);
    sceneRef.current = scene;

    // ✅ Crea camera
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(2, -2, 5);
    cameraRef.current = camera;

    // ✅ Crea sfera principale
    const geometry = new THREE.IcosahedronGeometry(1, 8);
    const material = new THREE.MeshStandardMaterial({
      color: 0x000010,
      metalness: 0.5,
      roughness: 0.1,
      emissive: 0x000010,
      emissiveIntensity: 1.5,
    });

    const sphere = new THREE.Mesh(geometry, material);
    sphere.castShadow = true;
    sphere.receiveShadow = true;
    scene.add(sphere);
    sphereRef.current = sphere;

    // ✅ Aggiungi luci
    const ambientLight = new THREE.AmbientLight(0x404040, 0.3);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    // ✅ Avvia animazione
    animate();
  };

  // ✅ Loop di animazione migliorato - più reattivo
  const animate = () => {
    if (!rendererRef.current || !sceneRef.current || !sphereRef.current || !cameraRef.current) {
      return;
    }

    const time = Date.now() * 0.001;
    
    // 🆕 Animazioni più reattive basate su audio levels REALI
    // Combiniamo input e output per una reattività migliore
    const audioReactivity = Math.max(audioLevels.input, audioLevels.output);
    const scale = 1 + (audioLevels.bass * 0.5) + (audioLevels.mid * 0.3) + (audioLevels.treble * 0.2) + (audioReactivity * 0.4);
    sphereRef.current.scale.setScalar(scale);

    // 🆕 Rotazione più dinamica e reattiva
    const rotSpeed = 0.1 + (audioReactivity * 0.3); // Velocità basata su audio
    rotationX.value = withTiming(time * rotSpeed * (1 + audioLevels.input), { duration: 50 });
    rotationY.value = withTiming(time * rotSpeed * 1.15 * (1 + audioLevels.output), { duration: 50 });
    rotationZ.value = withTiming(time * rotSpeed * 0.5 * (1 + audioLevels.bass), { duration: 50 });

    sphereRef.current.rotation.x = rotationX.value;
    sphereRef.current.rotation.y = rotationY.value;
    sphereRef.current.rotation.z = rotationZ.value;

    // 🆕 Camera più dinamica e reattiva all'audio
    const cameraRadius = 5 - (audioReactivity * 1.5); // Camera si avvicina con audio alto
    const cameraX = Math.cos(time * (0.1 + audioReactivity * 0.1)) * cameraRadius;
    const cameraY = Math.sin(time * (0.1 + audioReactivity * 0.1)) * cameraRadius;
    const cameraZ = 5 + (audioLevels.output * 3) - (audioLevels.input * 1);
    
    cameraRef.current.position.set(cameraX, cameraY, cameraZ);
    cameraRef.current.lookAt(sphereRef.current.position);

    // 🆕 Sfondo dinamico che cambia con lo stato e l'audio
    if (isSpeaking) {
      const intensity = 0x0a3923 + Math.floor(audioLevels.output * 0x002000); // Verde più intenso con output
      sceneRef.current!.background = new THREE.Color(intensity);
      sphereRef.current.material.emissiveIntensity = 2.5 + (audioLevels.output * 3);
      sphereRef.current.material.color.setHex(0x10b981 + Math.floor(audioLevels.output * 0x001010));
    } else if (isListening) {
      const intensity = 0x0d1b2e + Math.floor(audioLevels.input * 0x001010); // Blu più intenso con input
      sceneRef.current!.background = new THREE.Color(intensity);
      sphereRef.current.material.emissiveIntensity = 2.0 + (audioLevels.input * 2.5);
      sphereRef.current.material.color.setHex(0x3b82f6 + Math.floor(audioLevels.input * 0x000808));
    } else if (isProcessing) {
      const intensity = 0x2a1f0a + Math.floor(audioLevels.mid * 0x002010); // Arancione più intenso
      sceneRef.current!.background = new THREE.Color(intensity);
      sphereRef.current.material.emissiveIntensity = 2.2 + (audioLevels.mid * 2.2);
      sphereRef.current.material.color.setHex(0xf59e0b + Math.floor(audioLevels.mid * 0x000800));
    } else {
      sceneRef.current!.background = new THREE.Color(0x1a0c2a); // Viola base
      sphereRef.current.material.emissiveIntensity = 1.5 + (audioReactivity * 0.5);
      sphereRef.current.material.color.setHex(0x6366f1);
    }

    rendererRef.current.render(sceneRef.current, cameraRef.current);
    
    animationRef.current = requestAnimationFrame(animate);
  };

  // ✅ Cleanup
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // ✅ Animazioni React Native per overlay
  useEffect(() => {
    if (isSpeaking) {
      pulseScale.value = withRepeat(
        withTiming(1.2, { duration: 600 }),
        -1,
        true
      );
      orbOpacity.value = withTiming(1, { duration: 300 });
    } else if (isListening) {
      pulseScale.value = withRepeat(
        withTiming(1.15, { duration: 800 }),
        -1,
        true
      );
      orbOpacity.value = withTiming(0.9, { duration: 300 });
    } else if (isProcessing) {
      pulseScale.value = withRepeat(
        withTiming(1.1, { duration: 500 }),
        -1,
        true
      );
      orbOpacity.value = withTiming(0.8, { duration: 300 });
    } else {
      pulseScale.value = withTiming(1, { duration: 400 });
      orbOpacity.value = withTiming(0.7, { duration: 400 });
    }
  }, [isSpeaking, isListening, isProcessing]);

  const orbOverlayStyle = useAnimatedStyle(() => ({
    opacity: orbOpacity.value,
    transform: [{ scale: pulseScale.value }],
  }));

  return (
    <View style={styles.container}>
      {/* ✅ Three.js 3D Scene */}
      <GLView
        style={styles.glView}
        onContextCreate={onContextCreate}
      />
      
      {/* ✅ React Native Overlay per effetti aggiuntivi */}
      <Animated.View style={[styles.orbOverlay, orbOverlayStyle]}>
        <LinearGradient
          colors={[
            isSpeaking ? '#10b981' : isListening ? '#3b82f6' : isProcessing ? '#f59e0b' : '#6366f1',
            'transparent'
          ]}
          style={styles.gradientOverlay}
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // 🆕 Sfondo dinamico (sarà sovrascritto da Three.js scene background)
    backgroundColor: 'transparent',
  },
  glView: {
    flex: 1,
  },
  orbOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradientOverlay: {
    width: 200,
    height: 200,
    borderRadius: 100,
    opacity: 0.3,
  },
});

export default AudioOrbVisual;
