import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Canvas, useFrame } from '@react-three/fiber/native';
import { AvatarProfile, AvatarConfig, MorphTargets } from '../../types/avatar.types';
import { AvatarModelService } from '../../services/avatar/AvatarModelService';

interface AvatarCanvasProps {
  profile: AvatarProfile;
  audioLevel?: number;
  config?: Partial<AvatarConfig>;
  onModelLoaded?: (model: THREE.Group) => void;
}

/**
 * Componente principale dell'avatar 3D
 */
export const AvatarCanvas: React.FC<AvatarCanvasProps> = ({
  profile,
  audioLevel = 0,
  config = {},
  onModelLoaded,
}) => {
  const [model, setModel] = useState<THREE.Group | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Configurazione di default
  const defaultConfig: AvatarConfig = {
    modelPath: 'models/base_avatar.glb',
    scale: 1,
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    enableLipsync: true,
    enableIdleAnimations: true,
    enableGestures: true,
    ...config,
  };

  // Carica modello
  useEffect(() => {
    const loadModel = async () => {
      try {
        setIsLoading(true);
        setError(null);

        console.log('[AvatarCanvas] 📥 Caricando modello avatar...');
        
        const loadedModel = await AvatarModelService.loadModel(defaultConfig.modelPath);
        
        // Applica configurazione
        AvatarModelService.applyConfig(loadedModel, defaultConfig);
        
        // Applica colori del profilo
        AvatarModelService.applyColors(loadedModel, {
          skin: profile.skin,
          hair: profile.hair,
          eyes: profile.eyes,
        });

        setModel(loadedModel);
        onModelLoaded?.(loadedModel);
        
        console.log('[AvatarCanvas] ✅ Modello caricato');
        
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Errore caricamento modello');
        console.error('[AvatarCanvas] ❌ Errore:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadModel();
  }, [defaultConfig.modelPath, profile, onModelLoaded]);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          {/* TODO: Aggiungere loading spinner */}
        </View>
      </View>
    );
  }

  if (error || !model) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          {/* TODO: Aggiungere error state */}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Canvas
        camera={{ 
          position: [0, 1.2, 2.2], 
          fov: 35 
        }}
        style={styles.canvas}
      >
        <ambientLight intensity={0.9} />
        <directionalLight position={[2, 3, 2]} intensity={0.8} />
        
        <AvatarRig 
          model={model} 
          audioLevel={audioLevel}
          enableLipsync={defaultConfig.enableLipsync}
          enableIdleAnimations={defaultConfig.enableIdleAnimations}
        />
      </Canvas>
    </View>
  );
};

/**
 * Componente per la logica di animazione dell'avatar
 */
interface AvatarRigProps {
  model: THREE.Group;
  audioLevel: number;
  enableLipsync: boolean;
  enableIdleAnimations: boolean;
}

const AvatarRig: React.FC<AvatarRigProps> = ({
  model,
  audioLevel,
  enableLipsync,
  enableIdleAnimations,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const faceMeshRef = useRef<THREE.Mesh | null>(null);
  const [morphTargets, setMorphTargets] = useState<MorphTargets>({
    mouthOpen: 0,
    blinkLeft: 0,
    blinkRight: 0,
    smile: 0,
    frown: 0,
    jawOpen: 0,
    eyebrowRaise: 0,
    eyebrowFrown: 0,
  });

  // Trova la mesh del viso
  useEffect(() => {
    const faceMesh = AvatarModelService.getFaceMesh(model);
    faceMeshRef.current = faceMesh;
    
    if (faceMesh) {
      const availableTargets = AvatarModelService.getMorphTargets(model);
      setMorphTargets(prev => ({ ...prev, ...availableTargets }));
      console.log('[AvatarRig] 🎭 Morph targets disponibili:', Object.keys(availableTargets));
    }
  }, [model]);

  // Animazione frame
  useFrame((state, delta) => {
    if (!groupRef.current || !faceMeshRef.current) return;

    const time = state.clock.getElapsedTime();

    // Lipsync
    if (enableLipsync && faceMeshRef.current.morphTargetDictionary) {
      const mouthIndex = faceMeshRef.current.morphTargetDictionary['mouthOpen'];
      if (mouthIndex !== undefined) {
        const targetMouth = Math.max(0, Math.min(audioLevel * 1.2, 1));
        const currentMouth = faceMeshRef.current.morphTargetInfluences[mouthIndex];
        faceMeshRef.current.morphTargetInfluences[mouthIndex] = 
          currentMouth + (targetMouth - currentMouth) * 0.1;
      }
    }

    // Animazioni idle
    if (enableIdleAnimations) {
      // Micro-movimenti del capo
      groupRef.current.rotation.y = Math.sin(time * 0.5) * 0.03;
      groupRef.current.position.y = Math.sin(time * 0.8) * 0.01;

      // Blinking casuale
      if (Math.random() < 0.01) { // 1% probabilità per frame
        const blinkIndex = faceMeshRef.current.morphTargetDictionary['blinkLeft'];
        if (blinkIndex !== undefined) {
          faceMeshRef.current.morphTargetInfluences[blinkIndex] = 1;
          setTimeout(() => {
            if (faceMeshRef.current) {
              faceMeshRef.current.morphTargetInfluences[blinkIndex] = 0;
            }
          }, 150);
        }
      }
    }
  });

  return (
    <group ref={groupRef}>
      <primitive object={model} />
    </group>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 240,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#f8fafc',
  },
  canvas: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fee2e2',
  },
});
