import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AvatarCanvas } from './AvatarCanvas';
import { useAvatarProfile } from './hooks/useAvatarProfile';
import { useAudioLevel } from './hooks/useAudioLevel';

interface AvatarChatProps {
  userId: string;
  audioUri?: string;
  isVisible?: boolean;
  onToggle?: () => void;
}

/**
 * Componente avatar per la chat
 */
export const AvatarChat: React.FC<AvatarChatProps> = ({
  userId,
  audioUri,
  isVisible = true,
  onToggle,
}) => {
  const { profile, isLoading, error, createFromPhoto } = useAvatarProfile(userId);
  const { audioLevel, isPlaying } = useAudioLevel(audioUri);

  const handleCreateFromPhoto = () => {
    // TODO: Integrare con camera/photo picker
    console.log('[AvatarChat] 📸 Creazione avatar da foto');
  };

  if (!isVisible) {
    return (
      <TouchableOpacity style={styles.toggleButton} onPress={onToggle}>
        <MaterialCommunityIcons name="robot" size={24} color="#6366f1" />
      </TouchableOpacity>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <MaterialCommunityIcons name="loading" size={32} color="#6366f1" />
          <Text style={styles.loadingText}>Caricamento avatar...</Text>
        </View>
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons name="alert-circle" size={32} color="#ef4444" />
          <Text style={styles.errorText}>Errore caricamento avatar</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleCreateFromPhoto}>
            <Text style={styles.retryText}>Riprova</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AvatarCanvas
        profile={profile}
        audioLevel={audioLevel}
        config={{
          scale: 0.8,
          position: [0, -0.2, 0],
          enableLipsync: isPlaying,
          enableIdleAnimations: true,
        }}
      />
      
      {/* Controlli */}
      <View style={styles.controls}>
        <TouchableOpacity style={styles.controlButton} onPress={handleCreateFromPhoto}>
          <MaterialCommunityIcons name="camera" size={20} color="#6366f1" />
        </TouchableOpacity>
        
        {onToggle && (
          <TouchableOpacity style={styles.controlButton} onPress={onToggle}>
            <MaterialCommunityIcons name="close" size={20} color="#6b7280" />
          </TouchableOpacity>
        )}
      </View>

      {/* Status indicator */}
      {isPlaying && (
        <View style={styles.statusIndicator}>
          <MaterialCommunityIcons name="microphone" size={16} color="#10b981" />
          <Text style={styles.statusText}>Parlante</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 240,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  toggleButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: '#6b7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    padding: 16,
  },
  errorText: {
    marginTop: 8,
    fontSize: 14,
    color: '#dc2626',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#6366f1',
    borderRadius: 8,
  },
  retryText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  controls: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    gap: 8,
  },
  controlButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  statusIndicator: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    marginLeft: 4,
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '500',
  },
});
