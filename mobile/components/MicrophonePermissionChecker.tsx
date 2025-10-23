import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import MicrophonePermissionsService from '../services/microphone-permissions.service';

interface MicrophonePermissionCheckerProps {
  onPermissionGranted?: () => void;
  onPermissionDenied?: () => void;
}

const MicrophonePermissionChecker: React.FC<MicrophonePermissionCheckerProps> = ({
  onPermissionGranted,
  onPermissionDenied
}) => {
  const [permissionStatus, setPermissionStatus] = useState<string>('checking');
  const [isChecking, setIsChecking] = useState(false);
  const permissionsService = MicrophonePermissionsService.getInstance();

  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    setIsChecking(true);
    try {
      const result = await permissionsService.checkPermissions();
      setPermissionStatus(result.status);
      
      if (result.granted) {
        onPermissionGranted?.();
      } else {
        onPermissionDenied?.();
      }
    } catch (error) {
      console.error('Error checking permissions:', error);
      setPermissionStatus('error');
    } finally {
      setIsChecking(false);
    }
  };

  const requestPermissions = async () => {
    setIsChecking(true);
    try {
      const result = await permissionsService.requestAllPermissions();
      
      if (result.granted) {
        setPermissionStatus('granted');
        onPermissionGranted?.();
        Alert.alert(
          'Permessi Concessi',
          'Il microfono è ora autorizzato per la chat vocale!',
          [{ text: 'OK' }]
        );
      } else {
        setPermissionStatus('denied');
        onPermissionDenied?.();
        Alert.alert(
          'Permessi Negati',
          'Senza l\'accesso al microfono non è possibile utilizzare la chat vocale. Puoi modificare i permessi nelle impostazioni del dispositivo.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error requesting permissions:', error);
      setPermissionStatus('error');
      Alert.alert(
        'Errore',
        'Si è verificato un errore durante la richiesta dei permessi.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsChecking(false);
    }
  };

  const getStatusIcon = () => {
    switch (permissionStatus) {
      case 'granted':
        return <FontAwesome name="check-circle" size={20} color="#10b981" />;
      case 'denied':
        return <FontAwesome name="times-circle" size={20} color="#ef4444" />;
      case 'undetermined':
        return <FontAwesome name="question-circle" size={20} color="#f59e0b" />;
      case 'error':
        return <FontAwesome name="exclamation-triangle" size={20} color="#ef4444" />;
      default:
        return <FontAwesome name="spinner" size={20} color="#6366f1" />;
    }
  };

  const getStatusText = () => {
    return permissionsService.getPermissionStatusMessage(permissionStatus);
  };

  const getButtonText = () => {
    if (isChecking) return 'Controllando...';
    switch (permissionStatus) {
      case 'granted':
        return 'Permessi OK';
      case 'denied':
      case 'undetermined':
        return 'Richiedi Permessi';
      case 'error':
        return 'Riprova';
      default:
        return 'Controlla';
    }
  };

  const isButtonDisabled = () => {
    return isChecking || permissionStatus === 'granted';
  };

  return (
    <View style={styles.container}>
      <View style={styles.statusContainer}>
        {getStatusIcon()}
        <Text style={styles.statusText}>{getStatusText()}</Text>
      </View>
      
      <TouchableOpacity
        style={[
          styles.button,
          isButtonDisabled() && styles.buttonDisabled
        ]}
        onPress={permissionStatus === 'granted' ? checkPermissions : requestPermissions}
        disabled={isButtonDisabled()}
      >
        <FontAwesome 
          name={isChecking ? "spinner" : "microphone"} 
          size={16} 
          color={isButtonDisabled() ? "#94a3b8" : "#ffffff"} 
        />
        <Text style={[
          styles.buttonText,
          isButtonDisabled() && styles.buttonTextDisabled
        ]}>
          {getButtonText()}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginVertical: 8,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366f1',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  buttonDisabled: {
    backgroundColor: '#e2e8f0',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonTextDisabled: {
    color: '#94a3b8',
  },
});

export default MicrophonePermissionChecker;
