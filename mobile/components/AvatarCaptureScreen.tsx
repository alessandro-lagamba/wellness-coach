import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../hooks/useTranslation';
import CameraCapture from './CameraCapture';
import { useCameraController } from '../hooks/useCameraController';
import { AvatarService } from '../services/avatar.service';
import { AuthService } from '../services/auth.service';

export const AvatarCaptureScreen: React.FC = () => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const cameraController = useCameraController({ isScreenFocused: true });
  const [capturing, setCapturing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    // Avvia la camera quando il componente viene montato
    const initCamera = async () => {
      await cameraController.startCamera();
    };
    initCamera();
    return () => {
      isMountedRef.current = false;
      cameraController.stopCamera();
    };
  }, []);

  const capturePhoto = async () => {
    if (!cameraController.ref.current || !cameraController.ready) {
      Alert.alert(
        t('common.error') || 'Errore',
        t('avatar.cameraNotReady') || 'La fotocamera non è pronta. Attendi qualche istante.'
      );
      return;
    }

    // Verifica che takePictureAsync sia disponibile
    if (typeof cameraController.ref.current.takePictureAsync !== 'function') {
      Alert.alert(
        t('common.error') || 'Errore',
        t('avatar.cameraNotReady') || 'La fotocamera non è pronta. Attendi qualche istante.'
      );
      return;
    }

    try {
      setCapturing(true);
      
      // Cattura la foto
      const photo = await cameraController.ref.current.takePictureAsync({
        quality: 0.9,
        base64: false,
        skipProcessing: false,
      });

      if (!photo || !photo.uri) {
        throw new Error('Failed to capture photo');
      }

      setCapturing(false);
      setGenerating(true);

      // Ottieni l'utente corrente
      const currentUser = await AuthService.getCurrentUser();
      if (!currentUser?.id) {
        throw new Error('User not authenticated');
      }

      // Genera l'avatar dal backend
      const result = await AvatarService.generateFromPhoto(photo.uri, {
        userId: currentUser.id,
        mimeType: 'image/jpeg',
      });

      // Salva l'avatar URI
      await AsyncStorage.setItem('user:avatarUri', result.avatarUri);

      if (isMountedRef.current) {
        setGenerating(false);
        // Naviga di ritorno alla home
        router.back();
      }
    } catch (error) {
      console.error('❌ Error capturing/generating avatar:', error);
      if (isMountedRef.current) {
        setCapturing(false);
        setGenerating(false);
        Alert.alert(
          t('common.error') || 'Errore',
          error instanceof Error 
            ? error.message 
            : t('avatar.generationError') || 'Errore durante la generazione dell\'avatar. Riprova.'
        );
      }
    }
  };

  const handleCancel = () => {
    cameraController.stopCamera();
    router.back();
  };

  // Il bottone è disabilitato solo se stiamo già catturando o generando
  // Non disabilitiamo se la camera non è pronta - mostriamo solo un messaggio
  const captureDisabled = capturing || generating;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleCancel} style={styles.cancelButton}>
            <FontAwesome name="times" size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {t('avatar.captureTitle') || 'Crea il tuo avatar'}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Camera */}
        <View style={styles.cameraContainer}>
          <CameraCapture
            isScreenFocused={true}
            controller={cameraController}
            facing="front"
            instructionText={t('avatar.captureInstruction') || 'Posiziona il viso al centro del frame'}
          />
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          {generating ? (
            <View style={styles.generatingContainer}>
              <ActivityIndicator size="large" color="#7c3aed" />
              <Text style={[styles.generatingText, { color: colors.text }]}>
                {t('avatar.generating') || 'Sto creando il tuo avatar...'}
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={capturePhoto}
              disabled={captureDisabled}
              style={[
                styles.captureButtonContainer,
                captureDisabled && { opacity: 0.5 },
                !cameraController.ready && { opacity: 0.6 }
              ]}
            >
              <LinearGradient
                colors={cameraController.ready ? ['#7c3aed', '#9333ea'] : ['#9ca3af', '#6b7280']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.captureButton}
              >
                {capturing ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <FontAwesome name="camera" size={20} color="#ffffff" />
                    <Text style={styles.captureButtonText}>
                      {!cameraController.ready 
                        ? (t('avatar.cameraNotReady') || 'Attendere...')
                        : (t('avatar.capture') || 'Scatta foto')
                      }
                    </Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  cancelButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  cameraContainer: {
    flex: 1,
    marginHorizontal: 20,
    marginTop: 20,
  },
  controls: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 20,
  },
  captureButtonContainer: {
    width: '100%',
  },
  captureButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 10,
    shadowColor: '#7c3aed',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
  captureButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  generatingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 12,
  },
  generatingText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

