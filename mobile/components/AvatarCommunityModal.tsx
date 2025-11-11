import React, { useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Image,
  ScrollView,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
  InteractionManager,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDecay,
  useDerivedValue,
  SharedValue,
} from 'react-native-reanimated';
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
  avatars: CommunityAvatar[];
  currentUserAvatarUri?: string | null;
  currentUserName?: string;
  onAvatarPress?: (avatar: CommunityAvatar) => void;
};

type SphereNode = {
  id: string;
  imageUrl: string;
  displayName: string;
  theta: number;
  phi: number;
};

const LAYERS = [
  { phi: 42, countMultiplier: 0.35 },
  { phi: 90, countMultiplier: 0.5 },
  { phi: 138, countMultiplier: 0.35 },
];

const normalizeAngle = (angle: number) => {
  'worklet';
  let value = angle;
  while (value > 360) value -= 360;
  while (value < 0) value += 360;
  return value;
};

const AvatarCommunityModal: React.FC<AvatarCommunityModalProps> = ({
  visible,
  onClose,
  onCreateAvatar,
  avatars,
  currentUserAvatarUri,
  currentUserName,
  onAvatarPress,
}) => {
  const rotationY = useSharedValue(0);
  const rotationX = useSharedValue(0);
  const rotationYMod = useDerivedValue(() => normalizeAngle(rotationY.value));
  const rotationXClamped = useDerivedValue(() =>
    Math.max(-45, Math.min(45, rotationX.value))
  );

  useEffect(() => {
    if (visible) {
      rotationY.value = 0;
      rotationY.value = withRepeat(
        withTiming(360, { duration: 150000 }),
        -1,
        false
      );
    } else {
      rotationY.value = 0;
    }
  }, [visible, rotationY]);

  // Aggiungi l'avatar dell'utente corrente all'inizio se esiste
  const allAvatars = useMemo(() => {
    if (currentUserAvatarUri && currentUserName) {
      return [
        {
          id: 'current-user',
          imageUrl: currentUserAvatarUri,
          displayName: currentUserName,
          streak: undefined,
          hasAvatar: true,
        },
        ...avatars,
      ];
    }
    return avatars;
  }, [avatars, currentUserAvatarUri, currentUserName]);

  const nodes = useMemo<SphereNode[]>(() => {
    if (!allAvatars.length) return [];
    const prepared: SphereNode[] = [];
    const total = allAvatars.length;
    const layers = LAYERS.length;

    allAvatars.forEach((avatar, index) => {
      const layerIndex = index % layers;
      const layer = LAYERS[layerIndex];
      const countOnLayer = Math.max(4, Math.round(total * layer.countMultiplier));
      const repeats = Math.ceil(total / countOnLayer);
      const theta = (index * (360 / countOnLayer)) % 360;

      prepared.push({
        id: avatar.id,
        imageUrl: avatar.imageUrl || '',
        displayName: avatar.displayName,
        theta,
        phi: layer.phi,
      });
    });

    return prepared;
  }, [allAvatars]);

  const gestureStartRotationY = React.useRef(0);
  const gestureStartRotationX = React.useRef(0);

  const handlePanGrant = (_event: GestureResponderEvent, _state: PanResponderGestureState) => {
    gestureStartRotationY.current = rotationY.value;
    gestureStartRotationX.current = rotationX.value;
  };

  const handlePanMove = (_event: GestureResponderEvent, state: PanResponderGestureState) => {
    rotationY.value = gestureStartRotationY.current + state.dx * 0.45;
    rotationX.value = gestureStartRotationX.current - state.dy * 0.35;
  };

  const handlePanRelease = (_event: GestureResponderEvent, state: PanResponderGestureState) => {
    rotationY.value = withDecay({
      velocity: state.vx * 55,
      deceleration: 0.995,
    });
    rotationX.value = withDecay({
      velocity: -state.vy * 45,
      deceleration: 0.995,
    });
  };

  const panResponder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: handlePanGrant,
        onPanResponderMove: handlePanMove,
        onPanResponderRelease: handlePanRelease,
        onPanResponderTerminate: handlePanRelease,
      }),
    []
  );

  const radius = Math.min(SCREEN_WIDTH * 0.6, 260);
  const avatarBaseSize = radius * 0.28;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <LinearGradient
        colors={['rgba(26,14,48,0.95)', 'rgba(54,18,98,0.92)']}
        style={styles.modalContainer}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Avatar della community</Text>
          <Text style={styles.subtitle}>
            {currentUserAvatarUri
              ? 'Esplora gli avatar della community, confronta i tuoi progressi e trova ispirazione per migliorare il tuo stile.'
              : 'Scopri gli stili creati dagli altri utenti e trova ispirazione per il tuo avatar.'}
          </Text>
          {currentUserAvatarUri && (
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{allAvatars.length}</Text>
                <Text style={styles.statLabel}>Membri</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {Math.round(
                    allAvatars.filter((a) => a.streak && a.streak > 0).reduce((sum, a) => sum + (a.streak || 0), 0) /
                      Math.max(1, allAvatars.filter((a) => a.streak && a.streak > 0).length)
                  )}
                </Text>
                <Text style={styles.statLabel}>Media Streak</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {allAvatars.filter((a) => a.hasAvatar || a.imageUrl).length}
                </Text>
                <Text style={styles.statLabel}>Con Avatar</Text>
              </View>
            </View>
          )}
        </View>

        <Animated.View style={styles.sphereWrapper} {...panResponder.panHandlers}>
          {nodes.map((node, index) => {
            const avatar = allAvatars.find(a => a.id === node.id);
            return (
              <SphereAvatar
                key={node.id}
                node={node}
                rotationY={rotationYMod}
                rotationX={rotationXClamped}
                radius={radius}
                baseSize={avatarBaseSize}
                index={index}
                isCurrentUser={node.id === 'current-user'}
                onPress={avatar && onAvatarPress ? () => onAvatarPress(avatar) : undefined}
              />
            );
          })}
        </Animated.View>

        <ScrollView
          contentContainerStyle={styles.communityInfoContainer}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {allAvatars.slice(0, 6).map((avatar) => {
            const hasImage = avatar.imageUrl && avatar.imageUrl.trim() !== '';
            return (
              <View key={`chip-${avatar.id}`} style={styles.communityChip}>
                {hasImage ? (
                  <Image source={{ uri: avatar.imageUrl }} style={styles.communityChipImage} />
                ) : (
                  <LinearGradient
                    colors={['#a855f7', '#8b5cf6']}
                    style={styles.communityChipImageGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Image
                      source={USER_PLUS_ICON}
                      style={styles.communityChipUserPlus}
                      resizeMode="contain"
                    />
                  </LinearGradient>
                )}
                <View style={styles.communityChipTextContainer}>
                  <Text numberOfLines={1} style={styles.communityChipName}>
                    {avatar.displayName}
                  </Text>
                  {avatar.streak ? (
                    <Text style={styles.communityChipStreak}>
                      🔥 {avatar.streak} giorni di serie
                    </Text>
                  ) : (
                    <Text style={styles.communityChipStreak}>Nuovo membro</Text>
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>

        <View style={styles.actionsContainer}>
          {currentUserAvatarUri ? (
            <TouchableOpacity
              style={styles.secondaryButton}
              activeOpacity={0.85}
              onPress={() => {
                // Chiudi il modal e poi apri la camera dopo che tutte le interazioni sono complete
                onClose();
                InteractionManager.runAfterInteractions(() => {
                  // Aggiungi un piccolo delay aggiuntivo per sicurezza
                  setTimeout(() => {
                    onCreateAvatar();
                  }, 200);
                });
              }}
            >
              <LinearGradient
                colors={['rgba(124,58,237,0.3)', 'rgba(147,51,234,0.3)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.secondaryButtonGradient}
              >
                <FontAwesome name="refresh" size={14} color="#fff" />
                <Text style={styles.secondaryButtonText}>Cambia avatar</Text>
              </LinearGradient>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={[styles.primaryButton, currentUserAvatarUri && styles.primaryButtonWithSecondary]}
            activeOpacity={0.85}
            onPress={() => {
              // Chiudi il modal e poi apri la camera dopo che tutte le interazioni sono complete
              onClose();
              InteractionManager.runAfterInteractions(() => {
                // Aggiungi un piccolo delay aggiuntivo per sicurezza
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
              <FontAwesome name="camera" size={16} color="#fff" />
              <Text style={styles.primaryButtonText}>
                {currentUserAvatarUri ? 'Crea nuovo avatar' : 'Scatta la tua foto ora'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <FontAwesome name="close" size={20} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>
    </Modal>
  );
};

type SphereAvatarProps = {
  node: SphereNode;
  rotationY: SharedValue<number>;
  rotationX: SharedValue<number>;
  radius: number;
  baseSize: number;
  index: number;
  isCurrentUser?: boolean;
  onPress?: () => void;
};

const SphereAvatar: React.FC<SphereAvatarProps> = ({
  node,
  rotationY,
  rotationX,
  radius,
  baseSize,
  isCurrentUser = false,
  onPress,
}) => {
  const style = useAnimatedStyle(() => {
    const totalTheta = normalizeAngle(rotationY.value + node.theta);
    const thetaRad = (totalTheta * Math.PI) / 180;
    const phiAdjusted = Math.max(12, Math.min(168, node.phi + rotationX.value));
    const phiRad = (phiAdjusted * Math.PI) / 180;

    const x = radius * Math.sin(phiRad) * Math.cos(thetaRad);
    const y = radius * Math.cos(phiRad);
    const z = radius * Math.sin(phiRad) * Math.sin(thetaRad);

    const depth = (z + radius) / (2 * radius);
    // Scala più dinamica: da 0.4 a 1.2 (invece di 0.55 a 1.1)
    const scale = 0.4 + depth * 0.8;
    const opacity = 0.3 + depth * 0.7;

    return {
      transform: [
        { translateX: x },
        { translateY: y * 0.6 },
        { scale },
      ] as any,
      opacity,
      zIndex: Math.round(depth * 1000),
    };
  });

  const sizeStyle = useAnimatedStyle(() => {
    const totalTheta = normalizeAngle(rotationY.value + node.theta);
    const thetaRad = (totalTheta * Math.PI) / 180;
    const phiAdjusted = Math.max(12, Math.min(168, node.phi + rotationX.value));
    const phiRad = (phiAdjusted * Math.PI) / 180;

    const z = radius * Math.sin(phiRad) * Math.sin(thetaRad);
    const depth = (z + radius) / (2 * radius);
    const scale = 0.4 + depth * 0.8;
    const dynamicSize = baseSize * scale;

    return {
      width: dynamicSize,
      height: dynamicSize,
    };
  });

  const hasImage = node.imageUrl && node.imageUrl.trim() !== '';

  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.7 : 1}
      onPress={onPress}
      disabled={!onPress}
    >
      <Animated.View
        style={[
          styles.sphereAvatar,
          sizeStyle,
          style,
          isCurrentUser && styles.currentUserAvatar,
        ]}
      >
        {hasImage ? (
          <>
            <View style={styles.avatarShadow} />
            <Image source={{ uri: node.imageUrl }} style={styles.sphereAvatarImage} />
            {isCurrentUser && (
              <View style={styles.currentUserBadge}>
                <Text style={styles.currentUserBadgeText}>Tu</Text>
              </View>
            )}
          </>
        ) : (
          <Animated.View style={[styles.userPlusBackground, sizeStyle]}>
            <LinearGradient
              colors={['#a855f7', '#8b5cf6']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Image
                source={USER_PLUS_ICON}
                style={styles.userPlusImage}
                resizeMode="contain"
              />
            </LinearGradient>
          </Animated.View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

export default AvatarCommunityModal;

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 40,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  header: {
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 12,
  },
  sphereWrapper: {
    width: SCREEN_WIDTH * 0.82,
    maxWidth: 340,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  sphereAvatar: {
    position: 'absolute',
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sphereAvatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarShadow: {
    position: 'absolute',
    width: '110%',
    height: '110%',
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.12)',
    top: '10%',
  },
  userPlusBackground: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  userPlusImage: {
    width: '60%',
    height: '60%',
    tintColor: '#ffffff',
    opacity: 0.9,
  },
  communityInfoContainer: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    gap: 12,
    marginBottom: 32,
  },
  communityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 10,
  },
  communityChipImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  communityChipImageGradient: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  communityChipUserPlus: {
    width: '60%',
    height: '60%',
    tintColor: '#ffffff',
    opacity: 0.9,
  },
  communityChipTextContainer: {
    maxWidth: 120,
  },
  communityChipName: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  communityChipStreak: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    marginTop: 2,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    gap: 16,
  },
  statItem: {
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.75)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '600',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  currentUserAvatar: {
    borderWidth: 4,
    borderColor: '#fbbf24',
    shadowColor: '#fbbf24',
    shadowOpacity: 0.8,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  currentUserBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#fbbf24',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 2,
    borderColor: '#ffffff',
    zIndex: 10,
  },
  currentUserBadgeText: {
    color: '#1f2937',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  actionsContainer: {
    width: '100%',
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  primaryButton: {
    flex: 1,
  },
  primaryButtonWithSecondary: {
    flex: 1,
  },
  secondaryButton: {
    flex: 1,
  },
  secondaryButtonGradient: {
    borderRadius: 999,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  secondaryButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
    letterSpacing: 0.2,
  },
  primaryButtonGradient: {
    borderRadius: 999,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#7c3aed',
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 16,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.2,
  },
  closeButton: {
    position: 'absolute',
    top: 56,
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
});

