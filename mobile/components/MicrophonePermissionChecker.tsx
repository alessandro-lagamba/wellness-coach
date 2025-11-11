import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import MicrophonePermissionsService from '../services/microphone-permissions.service';
import { useTranslation } from '../hooks/useTranslation';

interface MicrophonePermissionCheckerProps {
  onPermissionGranted?: () => void;
  onPermissionDenied?: () => void;
}

const MicrophonePermissionChecker: React.FC<MicrophonePermissionCheckerProps> = ({
  onPermissionGranted,
  onPermissionDenied
}) => {
  const { t } = useTranslation();
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
          t('microphonePermissions.grantedTitle'),
          t('microphonePermissions.grantedMessage'),
          [{ text: t('common.ok') }]
        );
      } else {
        setPermissionStatus('denied');
        onPermissionDenied?.();
        Alert.alert(
          t('microphonePermissions.deniedTitle'),
          t('microphonePermissions.deniedMessage'),
          [{ text: t('common.ok') }]
        );
      }
    } catch (error) {
      console.error('Error requesting permissions:', error);
      setPermissionStatus('error');
      Alert.alert(
        t('microphonePermissions.errorTitle'),
        t('microphonePermissions.errorMessage'),
        [{ text: t('common.ok') }]
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
    if (isChecking) return t('microphonePermissions.checking');
    switch (permissionStatus) {
      case 'granted':
        return t('microphonePermissions.permissionsOk');
      case 'denied':
      case 'undetermined':
        return t('microphonePermissions.requestPermissions');
      case 'error':
        return t('microphonePermissions.retry');
      default:
        return t('microphonePermissions.check');
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
