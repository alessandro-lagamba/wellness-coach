import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions, Animated } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface SpotlightArea {
  x: number;      // Posizione X relativa (0-1)
  y: number;      // Posizione Y relativa (0-1)
  width: number;  // Larghezza relativa (0-1)
  height: number; // Altezza relativa (0-1)
  borderRadius?: number; // Border radius in pixel
}

interface SpotlightOverlayProps {
  visible: boolean;
  spotlightArea?: SpotlightArea | null;
  overlayOpacity?: number; // Opacità overlay scuro (default 0.5)
  spotlightIntensity?: number; // Intensità alone luminoso (default 0.3)
  animationDuration?: number; // Durata animazione (default 400ms)
}

export const SpotlightOverlay: React.FC<SpotlightOverlayProps> = ({
  visible,
  spotlightArea,
  overlayOpacity = 0.5,
  spotlightIntensity = 0.4,
  animationDuration = 400,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const spotlightScaleAnim = useRef(new Animated.Value(0.85)).current;
  const spotlightOpacityAnim = useRef(new Animated.Value(0)).current;
  const borderOpacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible && spotlightArea) {
      // Anima l'overlay in entrata
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: animationDuration,
          useNativeDriver: true,
        }),
        Animated.spring(spotlightScaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(spotlightOpacityAnim, {
          toValue: 1,
          duration: animationDuration * 0.8,
          useNativeDriver: true,
        }),
        Animated.timing(borderOpacityAnim, {
          toValue: 1,
          duration: animationDuration * 0.9,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Anima l'overlay in uscita
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: animationDuration * 0.6,
          useNativeDriver: true,
        }),
        Animated.timing(spotlightScaleAnim, {
          toValue: 0.85,
          duration: animationDuration * 0.6,
          useNativeDriver: true,
        }),
        Animated.timing(spotlightOpacityAnim, {
          toValue: 0,
          duration: animationDuration * 0.6,
          useNativeDriver: true,
        }),
        Animated.timing(borderOpacityAnim, {
          toValue: 0,
          duration: animationDuration * 0.6,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, spotlightArea, animationDuration]);

  if (!visible || !spotlightArea) return null;

  // Calcola le dimensioni assolute dello spotlight
  const spotlightX = spotlightArea.x * SCREEN_WIDTH;
  const spotlightY = spotlightArea.y * SCREEN_HEIGHT;
  const spotlightWidth = spotlightArea.width * SCREEN_WIDTH;
  const spotlightHeight = spotlightArea.height * SCREEN_HEIGHT;
  const spotlightRadius = Math.max(spotlightWidth, spotlightHeight) * 0.7; // Raggio per l'alone (più grande)
  const centerX = spotlightX + spotlightWidth / 2;
  const centerY = spotlightY + spotlightHeight / 2;

  // Genera un ID univoco per il gradiente SVG per evitare conflitti
  const gradientId = `glowGradient-${spotlightArea.x}-${spotlightArea.y}`;

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        styles.overlay,
        { opacity: fadeAnim },
      ]}
      pointerEvents="none"
    >
      {/* Overlay scuro di base */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(0,0,0,${overlayOpacity})` }]} />

      {/* Alone luminoso animato (usando SVG con gradiente radiale) */}
      <Animated.View
        style={[
          styles.glowContainer,
          {
            left: centerX - spotlightRadius * 1.2,
            top: centerY - spotlightRadius * 1.2,
            width: spotlightRadius * 2.4,
            height: spotlightRadius * 2.4,
            opacity: spotlightOpacityAnim,
            transform: [{ scale: spotlightScaleAnim }],
          },
        ]}
      >
        <Svg width={spotlightRadius * 2.4} height={spotlightRadius * 2.4}>
          <Defs>
            <RadialGradient id={gradientId} cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="rgba(255,255,255,0.5)" stopOpacity="0.8" />
              <Stop offset="25%" stopColor="rgba(255,255,255,0.3)" stopOpacity="0.5" />
              <Stop offset="50%" stopColor="rgba(255,255,255,0.15)" stopOpacity="0.3" />
              <Stop offset="75%" stopColor="rgba(255,255,255,0.05)" stopOpacity="0.1" />
              <Stop offset="100%" stopColor="rgba(255,255,255,0)" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle
            cx={spotlightRadius * 1.2}
            cy={spotlightRadius * 1.2}
            r={spotlightRadius}
            fill={`url(#${gradientId})`}
          />
        </Svg>
      </Animated.View>

      {/* Bordo luminoso intorno all'area evidenziata */}
      <Animated.View
        style={[
          styles.highlightBorder,
          {
            left: spotlightX - 3,
            top: spotlightY - 3,
            width: spotlightWidth + 6,
            height: spotlightHeight + 6,
            borderRadius: spotlightArea.borderRadius || 16,
            opacity: borderOpacityAnim,
          },
        ]}
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9998,
  },
  glowContainer: {
    position: 'absolute',
    overflow: 'hidden',
  },
  highlightBorder: {
    position: 'absolute',
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.7)',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 10,
  },
});

