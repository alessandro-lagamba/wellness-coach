import React, { useEffect, useState } from 'react';
import {
  View,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  Text,
  Pressable,
  GestureResponderEvent,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, withSpring } from 'react-native-reanimated';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { AuthService } from '../services/auth.service';

const USER_PLUS_ICON = require('../assets/user-plus.png');

// Responsive avatar sizing
const { width: screenWidth } = Dimensions.get('window');
const isNarrowScreen = screenWidth < 380;
const AVATAR_SIZE = isNarrowScreen ? 120 : 160;
const AVATAR_INNER_SIZE = isNarrowScreen ? 108 : 144;
const MIC_BUTTON_SIZE = isNarrowScreen ? 40 : 48;


interface AvatarProps {
  onMicPress?: () => void;
  /** URI dell'avatar generato (file locale o remoto) */
  avatarUri?: string | null;
  /** Mostra stato di generazione avatar */
  isGenerating?: boolean;
  /** Mostra loader animato mentre si caricano i dati utente */
  isLoadingUser?: boolean;
  /** Callback per avviare il flusso di creazione avatar */
  onCreateAvatar?: () => void;
  /** Callback per aprire la community di avatar */
  onOpenCommunity?: () => void;
}

export const Avatar: React.FC<AvatarProps> = ({
  onMicPress,
  avatarUri,
  isGenerating = false,
  isLoadingUser = false,
  onCreateAvatar,
  onOpenCommunity,
}) => {
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const floatY = useSharedValue(0);
  const scale = useSharedValue(1);
  const micScale = useSharedValue(1);
  const micOpacity = useSharedValue(1);
  const micRotation = useSharedValue(0);
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.6);

  useEffect(() => {
    floatY.value = withRepeat(withTiming(-6, { duration: 1600 }), -1, true);
  }, [floatY]);

  // 🆕 Animazione pulsante per il loader utente
  useEffect(() => {
    if (isLoadingUser) {
      pulseScale.value = withRepeat(
        withTiming(1.08, { duration: 800 }),
        -1,
        true
      );
      pulseOpacity.value = withRepeat(
        withTiming(1, { duration: 800 }),
        -1,
        true
      );
    } else {
      pulseScale.value = withTiming(1, { duration: 200 });
      pulseOpacity.value = withTiming(0.6, { duration: 200 });
    }
  }, [isLoadingUser, pulseScale, pulseOpacity]);

  useEffect(() => {
    const loadUserEmail = async () => {
      try {
        const user = await AuthService.getCurrentUser();
        if (user?.email) {
          setCurrentUserEmail(user.email);
        }
      } catch (error) {
        console.error('Error loading user email:', error);
      }
    };
    loadUserEmail();
  }, []);

  const floatingStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }],
  }));

  const avatarScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const micScaleStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: micScale.value },
      { rotate: `${micRotation.value}deg` }
    ] as any,
    opacity: micOpacity.value,
  }));

  // 🆕 Stile animato per il loader pulsante
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  const handleMicPress = () => {
    if (onMicPress) {
      onMicPress();
    }

    // Smooth press animation with rotation and opacity
    micScale.value = withSpring(0.85, { damping: 12, stiffness: 200 });
    micRotation.value = withSpring(5, { damping: 15, stiffness: 150 });
    micOpacity.value = withTiming(0.8, { duration: 100 });

    // Reset animation
    setTimeout(() => {
      micScale.value = withSpring(1, { damping: 12, stiffness: 200 });
      micRotation.value = withSpring(0, { damping: 15, stiffness: 150 });
      micOpacity.value = withTiming(1, { duration: 200 });
    }, 150);
  };

  const communityPreview = [
    'https://images.unsplash.com/photo-1544723795-3fb646b5b39?auto=format&fit=crop&w=200&q=80',
    'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=200&q=80',
    'https://images.unsplash.com/photo-1507120410856-1f35574c3b45?auto=format&fit=crop&w=200&q=80',
  ];

  const handleCreateAvatarPress = (event: GestureResponderEvent) => {
    event.stopPropagation();
    onCreateAvatar?.();
  };

  const Placeholder = () => (
    <Pressable
      disabled={!onOpenCommunity}
      onPress={onOpenCommunity}
      style={({ pressed }) => [
        styles.placeholderTapArea,
        pressed ? { transform: [{ scale: 0.98 }] } : null,
      ]}
    >
      <LinearGradient
        colors={['rgba(255,255,255,0.35)', 'rgba(255,255,255,0.12)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.placeholderRing}
      >
        <View style={styles.communityPreviewStack}>
          {communityPreview.map((uri, index) => (
            <Image
              key={uri}
              source={{ uri }}
              style={[
                styles.communityPreviewImage,
                { right: index * 18, zIndex: 10 - index },
              ]}
            />
          ))}
        </View>

        <View style={styles.placeholderCircle}>
          <FontAwesome name="camera" size={24} color="#4c1d95" />
        </View>
        <LinearGradient
          colors={['#f5f3ff', '#ede9fe']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.placeholderBadge}
        >
          <Text style={styles.placeholderBadgeText}>Nuovo</Text>
        </LinearGradient>
      </LinearGradient>

      <View style={styles.placeholderContent}>
        <Text style={styles.placeholderHeadline}>Personalizza il tuo coach</Text>
        <Text style={styles.placeholderSub}>
          Guarda gli avatar della community e crea il tuo stile illustrato personale.
        </Text>
        <View style={styles.placeholderHighlights}>
          <View style={styles.highlightItem}>
            <FontAwesome name="check" size={12} color="#c4b5fd" />
            <Text style={styles.highlightText}>Ispirati alla community</Text>
          </View>
          <View style={styles.highlightItem}>
            <FontAwesome name="check" size={12} color="#c4b5fd" />
            <Text style={styles.highlightText}>Avatar coerente nelle sessioni</Text>
          </View>
        </View>
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.placeholderButton,
          pressed ? { transform: [{ scale: 0.96 }] } : null,
        ]}
        onPress={handleCreateAvatarPress}
      >
        <FontAwesome name="camera" size={14} color="#fff" />
        <Text style={styles.placeholderButtonText}>Scatta una foto</Text>
      </Pressable>

      <View style={styles.tapHint}>
        <FontAwesome name="users" size={12} color="#c4b5fd" />
        <Text style={styles.tapHintText}>Tocca per esplorare gli avatar della community</Text>
      </View>
    </Pressable>
  );

  const renderAvatarContent = () => {
    // 🆕 Mostra loader animato mentre si caricano i dati utente
    if (isLoadingUser) {
      return (
        <LinearGradient
          colors={['#a855f7', '#8b5cf6']}
          style={styles.userPlusBackground}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Animated.View style={[styles.loadingUserContainer, pulseStyle]}>
            <ActivityIndicator size="large" color="#fff" />
          </Animated.View>
        </LinearGradient>
      );
    }

    if (isGenerating) {
      return (
        <View style={styles.generatingWrap}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.generatingText}>Sto creando il tuo avatar…</Text>
        </View>
      );
    }

    // Se c'è un avatar generato, mostralo (ma sarà cliccabile tramite il container esterno)
    if (avatarUri) {
      return <Image source={{ uri: avatarUri }} style={styles.avatarImage} resizeMode="cover" />;
    }

    // Mostra il placeholder user-plus con sfondo viola quando l'avatar non è ancora disponibile
    return (
      <LinearGradient
        colors={['#a855f7', '#8b5cf6']}
        style={styles.userPlusBackground}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Image
          source={USER_PLUS_ICON}
          style={styles.userPlusImage}
          resizeMode="contain"
        />
      </LinearGradient>
    );
  };

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.avatarContainer, floatingStyle]}>
        <Pressable
          onPress={onOpenCommunity}
          disabled={!onOpenCommunity}
          style={({ pressed }) => [
            styles.avatarPressable,
            pressed && styles.avatarPressablePressed,
          ]}
        >
          <LinearGradient
            colors={['#a855f7', '#8b5cf6']}
            style={styles.avatarBackground}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Animated.View style={[styles.avatarImageContainer, avatarScaleStyle]}>
              {renderAvatarContent()}
            </Animated.View>
          </LinearGradient>
        </Pressable>
      </Animated.View>

      <View style={styles.micButtonContainer}>
        <Animated.View style={micScaleStyle as any}>
          <TouchableOpacity
            style={styles.micButton}
            onPress={handleMicPress}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} // Increase touch area
          >
            <FontAwesome name="microphone" size={20} color="white" />
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatarPressable: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  },
  avatarPressablePressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  avatarBackground: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  avatarImageContainer: {
    width: AVATAR_INNER_SIZE,
    height: AVATAR_INNER_SIZE,
    borderRadius: AVATAR_INNER_SIZE / 2,
    overflow: 'hidden',
    borderWidth: isNarrowScreen ? 2 : 3,
    borderColor: 'white',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  placeholderTapArea: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 18,
    width: '100%',
    height: '100%',
  },
  placeholderRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    position: 'relative',
  },
  placeholderCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f5f3ff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
  },
  placeholderBadge: {
    position: 'absolute',
    bottom: -6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(76,29,149,0.15)',
    shadowColor: '#4c1d95',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  placeholderBadgeText: {
    color: '#4c1d95',
    fontWeight: '700',
    fontSize: 10,
    letterSpacing: 0.3,
  },
  placeholderContent: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
    paddingTop: 10,
  },
  placeholderHeadline: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 17,
    textAlign: 'center',
  },
  placeholderSub: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
  placeholderHighlights: {
    gap: 4,
  },
  highlightItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  highlightText: {
    color: 'rgba(235, 229, 255, 0.92)',
    fontSize: 11,
  },
  generatingWrap: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.18)',
    paddingHorizontal: 16,
  },
  generatingText: {
    color: '#fff',
    marginTop: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  placeholderButton: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#7c3aed',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    shadowColor: '#7c3aed',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
  },
  placeholderButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.2,
  },
  communityPreviewStack: {
    position: 'absolute',
    top: -18,
    right: -8,
    flexDirection: 'row',
  },
  communityPreviewImage: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ffffff',
    position: 'absolute',
    backgroundColor: '#fff',
  },
  tapHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  tapHintText: {
    color: 'rgba(235,229,255,0.85)',
    fontSize: 11,
  },
  userPlusContainer: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userPlusBackground: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 72,
  },
  userPlusImage: {
    width: '60%',
    height: '60%',
    tintColor: '#ffffff',
    opacity: 0.9,
  },
  loadingUserContainer: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButtonContainer: {
    position: 'absolute',
    bottom: isNarrowScreen ? -15 : -20,
    alignSelf: 'center',
  },
  micButton: {
    width: MIC_BUTTON_SIZE,
    height: MIC_BUTTON_SIZE,
    borderRadius: MIC_BUTTON_SIZE / 2,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
});
