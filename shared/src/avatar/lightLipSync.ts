/**
 * Light Lip-Sync Service
 * Generates approximate mouth animations for fluid avatar speech
 */

// Simple interfaces for lip sync
interface MouthAnimation {
  startTime: number;
  endTime: number;
  mouthShape: string;
  intensity: number;
  shape?: string; // Alias for mouthShape for compatibility
  transition?: string; // Animation transition type
}

// Simple type alias for mouth shapes
type MouthShape = string;

interface LipSyncData {
  animations: MouthAnimation[];
  duration: number;
  text?: string;
  phonemes?: any[];
}

// ========================================
// PHONEME TO MOUTH SHAPE MAPPING
// ========================================

const PHONEME_MOUTH_MAPPING: Record<string, MouthShape> = {
  // Vowels - open mouth shapes
  'a': 'open',
  'e': 'open',
  'i': 'wide',
  'o': 'pucker',
  'u': 'pucker',
  
  // Consonants - various shapes
  'b': 'closed',
  'p': 'closed',
  'm': 'closed',
  'f': 'narrow',
  'v': 'narrow',
  'th': 'narrow',
  's': 'smile',
  'z': 'smile',
  'sh': 'pucker',
  'ch': 'pucker',
  'j': 'pucker',
  'l': 'wide',
  'r': 'wide',
  'n': 'neutral',
  't': 'neutral',
  'd': 'neutral',
  'k': 'neutral',
  'g': 'neutral',
  
  // Default
  'silence': 'neutral'
};

// Italian-specific phoneme patterns
const ITALIAN_PATTERNS: Record<string, MouthShape> = {
  'gl': 'wide',    // "gli"
  'gn': 'neutral', // "gnocchi"
  'sc': 'smile',   // "scienza"
  'qu': 'pucker',  // "quando"
  'ch': 'neutral', // "che"
  'gh': 'neutral'  // "ghetto"
};

// ========================================
// LIGHT LIP-SYNC SERVICE
// ========================================

export class LightLipSyncService {
  private readonly defaultTransitionTime = 0.1; // 100ms transitions
  private readonly minMouthHoldTime = 0.15; // 150ms minimum hold
  
  /**
   * Generate mouth animations from text and audio duration
   */
  generateMouthAnimations(text: string, audioDuration: number): LipSyncData {
    const words = this.tokenizeText(text);
    const animations = this.generateAnimationsFromWords(words, audioDuration);
    
    return {
      text,
      duration: audioDuration,
      animations,
      phonemes: this.extractPhonemes(text, audioDuration)
    };
  }

  /**
   * Generate animations from audio buffer analysis
   */
  generateFromAudioBuffer(
    text: string, 
    audioBuffer: ArrayBuffer
  ): LipSyncData {
    const duration = this.estimateAudioDuration(audioBuffer);
    return this.generateMouthAnimations(text, duration);
  }

  /**
   * Generate real-time mouth shapes for streaming
   */
  generateStreamingAnimations(
    text: string,
    currentTime: number,
    totalDuration: number
  ): MouthShape {
    const progress = currentTime / totalDuration;
    const words = this.tokenizeText(text);
    const currentWordIndex = Math.floor(progress * words.length);
    const currentWord = words[currentWordIndex] || '';
    
    return this.getWordMouthShape(currentWord);
  }

  // ========================================
  // PRIVATE METHODS
  // ========================================

  private tokenizeText(text: string): string[] {
    // Clean and split text into words
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 0);
  }

  private generateAnimationsFromWords(
    words: string[],
    totalDuration: number
  ): MouthAnimation[] {
    if (words.length === 0) {
      return [{
        startTime: 0,
        endTime: totalDuration,
        mouthShape: 'neutral',
        intensity: 0.3,
        transition: 'ease-in-out'
      }];
    }

    const animations: MouthAnimation[] = [];
    const baseTimePerWord = totalDuration / words.length;
    
    // Add opening animation
    animations.push({
      startTime: 0,
      endTime: this.defaultTransitionTime,
      mouthShape: 'neutral',
      intensity: 0.5,
      transition: 'ease-in'
    });

    // Generate word-based animations
    words.forEach((word, index) => {
      const wordStartTime = (index * baseTimePerWord) + this.defaultTransitionTime;
      const wordEndTime = Math.min(
        ((index + 1) * baseTimePerWord),
        totalDuration - this.defaultTransitionTime
      );
      
      const wordDuration = wordEndTime - wordStartTime;
      const syllables = this.getSyllables(word);
      
      if (syllables.length === 1) {
        // Single syllable word
        animations.push({
          startTime: wordStartTime,
          endTime: wordEndTime,
          mouthShape: this.getWordMouthShape(word),
          intensity: this.getWordIntensity(word),
          transition: 'ease-in-out'
        });
      } else {
        // Multi-syllable word - create sub-animations
        const timePerSyllable = wordDuration / syllables.length;
        
        syllables.forEach((syllable, syllableIndex) => {
          const syllableStart = wordStartTime + (syllableIndex * timePerSyllable);
          const syllableEnd = syllableStart + Math.max(timePerSyllable, this.minMouthHoldTime);
          
          animations.push({
            startTime: syllableStart,
            endTime: Math.min(syllableEnd, wordEndTime),
            mouthShape: this.getSyllableMouthShape(syllable),
            intensity: this.getSyllableIntensity(syllable, syllableIndex === 0),
            transition: 'ease-in-out'
          });
        });
      }
    });

    // Add closing animation
    animations.push({
      startTime: totalDuration - this.defaultTransitionTime,
      endTime: totalDuration,
      mouthShape: 'neutral',
      intensity: 0.3,
      transition: 'ease-out'
    });

    return this.optimizeAnimations(animations);
  }

  private getWordMouthShape(word: string): MouthShape {
    // Check Italian-specific patterns first
    for (const [pattern, shape] of Object.entries(ITALIAN_PATTERNS)) {
      if (word.includes(pattern)) {
        return shape;
      }
    }

    // Find dominant vowel/consonant pattern
    const vowels = word.match(/[aeiou]/g) || [];
    const consonants = word.match(/[bcdfghjklmnpqrstvwxyz]/g) || [];
    
    if (vowels.length > consonants.length) {
      // Vowel-heavy word
      const dominantVowel = this.getDominantVowel(vowels);
      return PHONEME_MOUTH_MAPPING[dominantVowel] || 'open';
    } else {
      // Consonant-heavy word
      const firstConsonant = word.charAt(0);
      return PHONEME_MOUTH_MAPPING[firstConsonant] || 'neutral';
    }
  }

  private getSyllables(word: string): string[] {
    // Simple syllable detection for Italian
    // This is a simplified approach - production could use more sophisticated algorithms
    const vowelGroups = word.split(/[bcdfghjklmnpqrstvwxyz]+/).filter(Boolean);
    
    if (vowelGroups.length === 0) {
      return [word];
    }
    
    if (vowelGroups.length === 1) {
      return [word];
    }
    
    // For multi-vowel words, split roughly by vowel groups
    return vowelGroups.length > 1 ? vowelGroups : [word];
  }

  private getSyllableMouthShape(syllable: string): MouthShape {
    const vowels = syllable.match(/[aeiou]/g);
    if (vowels && vowels.length > 0) {
      return PHONEME_MOUTH_MAPPING[vowels[0]] || 'open';
    }
    return 'neutral';
  }

  private getDominantVowel(vowels: string[]): string {
    // Count vowel frequency
    const counts: Record<string, number> = {};
    vowels.forEach(vowel => {
      counts[vowel] = (counts[vowel] || 0) + 1;
    });
    
    // Return most frequent vowel
    return Object.entries(counts).reduce((a, b) => 
      a[1] > b[1] ? a : b
    )[0];
  }

  private getWordIntensity(word: string): number {
    // Longer words get higher intensity
    const baseIntensity = 0.6;
    const lengthBonus = Math.min(0.3, word.length * 0.05);
    return Math.min(1, baseIntensity + lengthBonus);
  }

  private getSyllableIntensity(syllable: string, isFirst: boolean): number {
    const baseIntensity = isFirst ? 0.7 : 0.5; // First syllable is emphasized
    const vowelCount = (syllable.match(/[aeiou]/g) || []).length;
    const vowelBonus = vowelCount * 0.1;
    
    return Math.min(1, baseIntensity + vowelBonus);
  }

  private optimizeAnimations(animations: MouthAnimation[]): MouthAnimation[] {
    // Remove very short animations and merge similar consecutive ones
    const optimized: MouthAnimation[] = [];
    
    for (let i = 0; i < animations.length; i++) {
      const current = animations[i];
      const duration = current.endTime - current.startTime;
      
      // Skip animations that are too short
      if (duration < 0.05) continue;
      
      // Check if we can merge with previous animation
      const previous = optimized[optimized.length - 1];
      if (previous && 
          previous.mouthShape === current.mouthShape && 
          Math.abs(previous.intensity - current.intensity) < 0.2) {
        // Extend previous animation instead of adding new one
        previous.endTime = current.endTime;
      } else {
        optimized.push(current);
      }
    }
    
    return optimized;
  }

  private extractPhonemes(text: string, duration: number): LipSyncData['phonemes'] {
    // Simple phoneme extraction - this is a placeholder for more sophisticated analysis
    const words = this.tokenizeText(text);
    const phonemes: NonNullable<LipSyncData['phonemes']> = [];
    
    const timePerWord = duration / words.length;
    
    words.forEach((word, wordIndex) => {
      const wordStartTime = wordIndex * timePerWord;
      const wordEndTime = (wordIndex + 1) * timePerWord;
      
      // Simple: treat each word as a single phoneme unit
      phonemes.push({
        phoneme: word,
        startTime: wordStartTime,
        endTime: wordEndTime,
        mouthShape: this.getWordMouthShape(word)
      });
    });
    
    return phonemes;
  }

  private estimateAudioDuration(audioBuffer: ArrayBuffer): number {
    // Rough estimation based on buffer size
    // Assumes 16-bit PCM at 16kHz (2 bytes per sample, 16000 samples per second)
    const bytesPerSecond = 2 * 16000; // 32,000 bytes per second
    const estimatedDuration = (audioBuffer.byteLength / bytesPerSecond) * 1000; // milliseconds
    
    return Math.max(500, estimatedDuration); // Minimum 500ms
  }
}

// ========================================
// SINGLETON INSTANCE
// ========================================

let lipSyncServiceInstance: LightLipSyncService | null = null;

export function getLipSyncService(): LightLipSyncService {
  if (!lipSyncServiceInstance) {
    lipSyncServiceInstance = new LightLipSyncService();
  }
  
  return lipSyncServiceInstance;
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

export function generateQuickMouthAnimation(
  text: string,
  duration: number
): MouthAnimation[] {
  return getLipSyncService().generateMouthAnimations(text, duration).animations;
}

export function getCurrentMouthShape(
  text: string,
  currentTime: number,
  totalDuration: number
): MouthShape {
  return getLipSyncService().generateStreamingAnimations(text, currentTime, totalDuration);
}
