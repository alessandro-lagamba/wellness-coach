import { Asset } from 'expo-asset';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';
import { AvatarConfig } from '../../types/avatar.types';

/**
 * Servizio per la gestione dei modelli 3D dell'avatar
 */
export class AvatarModelService {
  private static modelCache = new Map<string, THREE.Group>();

  /**
   * Carica un modello GLB dall'asset bundle
   */
  static async loadModel(modelPath: string): Promise<THREE.Group> {
    try {
      // Controlla cache
      if (this.modelCache.has(modelPath)) {
        console.log('[AvatarModel] 📦 Modello dalla cache:', modelPath);
        return this.modelCache.get(modelPath)!.clone();
      }

      console.log('[AvatarModel] 📥 Caricando modello:', modelPath);
      
      // Carica asset
      const asset = Asset.fromModule(require('../../assets/avatar/models/base_avatar.glb'));
      await asset.downloadAsync();

      // Carica GLB
      const loader = new GLTFLoader();
      const gltf = await new Promise<THREE.Group>((resolve, reject) => {
        loader.load(
          asset.localUri!,
          (gltf) => resolve(gltf.scene),
          undefined,
          reject
        );
      });

      // Cache del modello
      this.modelCache.set(modelPath, gltf);
      
      console.log('[AvatarModel] ✅ Modello caricato:', {
        path: modelPath,
        children: gltf.children.length,
        hasMorphTargets: this.hasMorphTargets(gltf)
      });

      return gltf.clone();
      
    } catch (error) {
      console.error('[AvatarModel] ❌ Errore caricamento modello:', error);
      throw new Error(`Impossibile caricare il modello: ${modelPath}`);
    }
  }

  /**
   * Verifica se il modello ha morph targets
   */
  static hasMorphTargets(model: THREE.Group): boolean {
    const faceMesh = model.getObjectByName('FaceMesh') as THREE.Mesh;
    return !!(faceMesh?.morphTargetDictionary && faceMesh?.morphTargetInfluences);
  }

  /**
   * Applica configurazione al modello
   */
  static applyConfig(model: THREE.Group, config: AvatarConfig): THREE.Group {
    model.scale.setScalar(config.scale);
    model.position.set(...config.position);
    model.rotation.set(...config.rotation);
    
    return model;
  }

  /**
   * Trova la mesh del viso nel modello
   */
  static getFaceMesh(model: THREE.Group): THREE.Mesh | null {
    return model.getObjectByName('FaceMesh') as THREE.Mesh;
  }

  /**
   * Ottiene i morph targets disponibili
   */
  static getMorphTargets(model: THREE.Group): Record<string, number> {
    const faceMesh = this.getFaceMesh(model);
    if (!faceMesh?.morphTargetDictionary) {
      return {};
    }

    const targets: Record<string, number> = {};
    Object.keys(faceMesh.morphTargetDictionary).forEach(key => {
      targets[key] = 0;
    });

    return targets;
  }

  /**
   * Applica morph targets alla mesh del viso
   */
  static applyMorphTargets(model: THREE.Group, targets: Record<string, number>): void {
    const faceMesh = this.getFaceMesh(model);
    if (!faceMesh?.morphTargetDictionary || !faceMesh?.morphTargetInfluences) {
      return;
    }

    Object.entries(targets).forEach(([name, value]) => {
      const index = faceMesh.morphTargetDictionary[name];
      if (index !== undefined) {
        faceMesh.morphTargetInfluences[index] = Math.max(0, Math.min(value, 1));
      }
    });
  }

  /**
   * Applica colori ai materiali
   */
  static applyColors(model: THREE.Group, colors: { skin?: string; hair?: string; eyes?: string }): void {
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const material = child.material as THREE.MeshStandardMaterial;
        
        if (child.name.includes('Skin') && colors.skin) {
          material.color.setHex(colors.skin.replace('#', '0x'));
        } else if (child.name.includes('Hair') && colors.hair) {
          material.color.setHex(colors.hair.replace('#', '0x'));
        } else if (child.name.includes('Eyes') && colors.eyes) {
          material.color.setHex(colors.eyes.replace('#', '0x'));
        }
        
        material.needsUpdate = true;
      }
    });
  }

  /**
   * Pulisce la cache dei modelli
   */
  static clearCache(): void {
    this.modelCache.clear();
    console.log('[AvatarModel] 🗑️ Cache modelli pulita');
  }
}
