import { useState, useEffect, useCallback } from 'react';
import { AvatarProfile, AvatarFeatures } from '../../types/avatar.types';
import { FaceAnalysisService } from '../../../services/avatar/FaceAnalysisService';

/**
 * Hook per la gestione del profilo avatar
 */
export const useAvatarProfile = (userId?: string) => {
  const [profile, setProfile] = useState<AvatarProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Carica il profilo avatar esistente
   */
  const loadProfile = useCallback(async () => {
    if (!userId) return;

    try {
      setIsLoading(true);
      setError(null);

      // TODO: Carica da AsyncStorage o Supabase
      const savedProfile = await loadFromStorage(userId);
      
      if (savedProfile) {
        setProfile(savedProfile);
        console.log('[useAvatarProfile] ✅ Profilo caricato:', savedProfile.name);
      } else {
        // Crea profilo di default
        const defaultProfile = createDefaultProfile(userId);
        setProfile(defaultProfile);
        console.log('[useAvatarProfile] 🆕 Profilo default creato');
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore caricamento profilo');
      console.error('[useAvatarProfile] ❌ Errore:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  /**
   * Crea avatar da foto
   */
  const createFromPhoto = useCallback(async (photoUri: string) => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('[useAvatarProfile] 📸 Creando avatar da foto...');
      
      // Estrai caratteristiche dalla foto
      const features = await FaceAnalysisService.extractFeatures(photoUri);
      
      // Valida caratteristiche
      if (!FaceAnalysisService.validateFeatures(features)) {
        throw new Error('Caratteristiche estratte non valide');
      }

      // Crea profilo
      const newProfile = FaceAnalysisService.featuresToProfile(features, userId || 'user');
      
      setProfile(newProfile as AvatarProfile);
      
      // Salva profilo
      await saveToStorage(newProfile as AvatarProfile);
      
      console.log('[useAvatarProfile] ✅ Avatar creato da foto');
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore creazione avatar');
      console.error('[useAvatarProfile] ❌ Errore creazione:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  /**
   * Aggiorna caratteristiche avatar
   */
  const updateProfile = useCallback(async (updates: Partial<AvatarProfile>) => {
    if (!profile) return;

    try {
      const updatedProfile = {
        ...profile,
        ...updates,
        updatedAt: new Date(),
      };

      setProfile(updatedProfile);
      await saveToStorage(updatedProfile);
      
      console.log('[useAvatarProfile] ✅ Profilo aggiornato');
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore aggiornamento profilo');
      console.error('[useAvatarProfile] ❌ Errore aggiornamento:', err);
    }
  }, [profile]);

  /**
   * Reset profilo
   */
  const resetProfile = useCallback(async () => {
    if (!userId) return;

    try {
      const defaultProfile = createDefaultProfile(userId);
      setProfile(defaultProfile);
      await saveToStorage(defaultProfile);
      
      console.log('[useAvatarProfile] 🔄 Profilo resettato');
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore reset profilo');
      console.error('[useAvatarProfile] ❌ Errore reset:', err);
    }
  }, [userId]);

  /**
   * Carica profilo da storage (placeholder)
   */
  const loadFromStorage = async (userId: string): Promise<AvatarProfile | null> => {
    // TODO: Implementare AsyncStorage
    return null;
  };

  /**
   * Salva profilo in storage (placeholder)
   */
  const saveToStorage = async (profile: AvatarProfile): Promise<void> => {
    // TODO: Implementare AsyncStorage
    console.log('[useAvatarProfile] 💾 Salvataggio profilo:', profile.name);
  };

  /**
   * Crea profilo di default
   */
  const createDefaultProfile = (userId: string): AvatarProfile => {
    return {
      id: `avatar_${userId}`,
      name: 'My Avatar',
      skin: '#fdbcb4',
      hair: '#8b4513',
      eyes: '#4a5568',
      jaw: 0.5,
      cheeks: 0.5,
      chin: 0.5,
      glasses: false,
      beard: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  };

  // Carica profilo all'inizializzazione
  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  return {
    profile,
    isLoading,
    error,
    createFromPhoto,
    updateProfile,
    resetProfile,
    reload: loadProfile,
  };
};
