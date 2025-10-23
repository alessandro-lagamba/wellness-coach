import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface WidgetEditOverlayProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  actions?: Array<{ icon: string; label: string; onPress: () => void; color?: string }>;
}

const WidgetEditOverlay: React.FC<WidgetEditOverlayProps> = ({
  visible,
  title,
  onClose,
  actions = [],
}) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 0, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.overlay, { opacity: opacityAnim }]}>
      <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <TouchableOpacity onPress={onClose} style={styles.close}>
            <MaterialCommunityIcons name="close" size={20} color="#6b7280" />
          </TouchableOpacity>
        </View>

        <View style={styles.actions}>
          {actions.map((a, i) => (
            <TouchableOpacity
              key={i}
              onPress={a.onPress}
              style={[styles.action, { backgroundColor: a.color || '#111827' }]}
              activeOpacity={0.9}
            >
              <MaterialCommunityIcons name={a.icon as any} size={18} color="#fff" />
              <Text style={styles.actionLabel}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  card: {
    width: '86%', maxWidth: 360, borderRadius: 16, padding: 18, backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12,
  },
  title: { fontSize: 16, fontWeight: '700', color: '#111827' },
  close: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6', borderRadius: 10 },
  actions: { gap: 10 },
  action: {
    paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, flexDirection: 'row', gap: 8, alignItems: 'center',
  },
  actionLabel: { color: '#fff', fontWeight: '600' },
});

export default WidgetEditOverlay;
