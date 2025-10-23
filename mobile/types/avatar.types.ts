// Avatar Types
export interface AvatarProfile {
  id: string;
  name: string;
  // Caratteristiche fisiche
  skin: string;
  hair: string;
  eyes: string;
  // Forma viso (0-1)
  jaw?: number;
  cheeks?: number;
  chin?: number;
  // Accessori
  glasses?: boolean;
  beard?: boolean;
  // Timestamp
  createdAt: Date;
  updatedAt: Date;
}

export interface AvatarFeatures {
  skin: string;
  hair: string;
  eyes: string;
  jaw: number;
  cheeks: number;
  chin: number;
  glasses: boolean;
  beard: boolean;
}

export interface AvatarBehavior {
  mood: 'happy' | 'concerned' | 'energetic' | 'calm' | 'neutral';
  expression: 'smile' | 'frown' | 'neutral' | 'surprised' | 'worried';
  gesture: 'nod' | 'shake' | 'point' | 'wave' | 'idle';
}

export interface AvatarAnimation {
  type: 'idle' | 'speaking' | 'listening' | 'thinking' | 'celebrating';
  intensity: number; // 0-1
  duration?: number; // ms
}

export interface AudioLevel {
  level: number; // 0-1
  timestamp: number;
}

// Morph targets disponibili nel modello GLB
export interface MorphTargets {
  mouthOpen: number;
  blinkLeft: number;
  blinkRight: number;
  smile: number;
  frown: number;
  jawOpen: number;
  eyebrowRaise: number;
  eyebrowFrown: number;
}

// Configurazione avatar
export interface AvatarConfig {
  modelPath: string;
  scale: number;
  position: [number, number, number];
  rotation: [number, number, number];
  enableLipsync: boolean;
  enableIdleAnimations: boolean;
  enableGestures: boolean;
}
