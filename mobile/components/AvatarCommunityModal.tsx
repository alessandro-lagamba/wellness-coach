import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Image,
  InteractionManager,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const USER_PLUS_ICON = require('../assets/user-plus.png');

type CommunityAvatar = {
  id: string;
  imageUrl?: string | null;
  displayName: string;
  streak?: number;
  hasAvatar?: boolean;
};

type AvatarCommunityModalProps = {
  visible: boolean;
  onClose: () => void;
  onCreateAvatar: () => void;
  // Kept for prop compatibility
  avatars?: CommunityAvatar[];
  currentUserAvatarUri?: string | null;
  currentUserName?: string;
  onAvatarPress?: (avatar: CommunityAvatar) => void;
};

const AvatarCommunityModal: React.FC<AvatarCommunityModalProps> = ({
  visible,
  onClose,
  onCreateAvatar,
  currentUserAvatarUri,
}) => {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <LinearGradient
        colors={['rgba(26,14,48,0.95)', 'rgba(54,18,98,0.98)']}
        style={styles.modalContainer}
      >
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <FontAwesome name="close" size={20} color="#fff" />
        </TouchableOpacity>

        <View style={styles.contentContainer}>
          <Text style={styles.title}>Il tuo Avatar</Text>

          <View style={styles.avatarContainer}>
            {currentUserAvatarUri ? (
              <Image source={{ uri: currentUserAvatarUri }} style={styles.avatarImage} />
            ) : (
              <View style={styles.placeholderAvatar}>
                <Image
                  source={USER_PLUS_ICON}
                  style={styles.placeholderIcon}
                  resizeMode="contain"
                />
              </View>
            )}
          </View>

          <Text style={styles.description}>
            {currentUserAvatarUri
              ? "Ecco il tuo avatar attuale. Puoi crearne uno nuovo in qualsiasi momento per rispecchiare il tuo stile."
              : "Non hai ancora un avatar. Creane uno ora per personalizzare la tua esperienza!"}
          </Text>
        </View>

        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.primaryButton}
            activeOpacity={0.85}
            onPress={() => {
              onClose();
              InteractionManager.runAfterInteractions(() => {
                setTimeout(() => {
                  onCreateAvatar();
                }, 200);
              });
            }}
          >
            <LinearGradient
              colors={['#7c3aed', '#9333ea']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.primaryButtonGradient}
            >
              <FontAwesome name="camera" size={18} color="#fff" />
              <Text style={styles.primaryButtonText}>
                {currentUserAvatarUri ? 'Crea nuovo avatar' : 'Crea il tuo avatar'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </Modal>
  );
};

export default AvatarCommunityModal;

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 50,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeButton: {
    position: 'absolute',
    top: 60,
    right: 24,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
    zIndex: 1000,
  },
  contentContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 40,
  },
  avatarContainer: {
    width: SCREEN_WIDTH * 0.7,
    height: SCREEN_WIDTH * 0.7,
    maxWidth: 300,
    maxHeight: 300,
    borderRadius: 150,
    borderWidth: 4,
    borderColor: '#ffffff',
    overflow: 'hidden',
    marginBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
    backgroundColor: '#2a1b4e',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  placeholderAvatar: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  placeholderIcon: {
    width: '50%',
    height: '50%',
    tintColor: 'rgba(255,255,255,0.5)',
  },
  description: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: '90%',
  },
  actionsContainer: {
    width: '100%',
    paddingBottom: 20,
  },
  primaryButton: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#7c3aed',
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 10,
  },
  primaryButtonGradient: {
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 18,
    letterSpacing: 0.5,
  },
});
