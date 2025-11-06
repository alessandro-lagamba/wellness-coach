import React, { useEffect, useMemo, useState } from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withTiming,
  runOnJS,
  useAnimatedReaction,
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useWidgetConfig } from '../services/widget-config.service';

interface EditableWidgetProps {
  children: React.ReactNode;
  widgetId: string;
  widgetTitle: string;

  onPress?: () => void;
  onLongPress?: () => void;
  onEnterEditMode?: () => void;
  onDragTargetChange?: (position: number | null) => void;

  onResize?: (newSize: 'small' | 'medium' | 'large') => void;
  onRemove?: () => void;

  editMode?: boolean;
}

export const EditableWidget: React.FC<EditableWidgetProps> = ({
  children,
  widgetId,
  widgetTitle,
  onPress,
  onLongPress,
  onEnterEditMode,
  onDragTargetChange,
  onResize,
  onRemove,
  editMode = false,
}) => {
  const { config, reorderWidgets } = useWidgetConfig();

  const [isDragging, setIsDragging] = useState(false);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const isDraggingSV = useSharedValue(false);
  const lastTargetPositionSV = useSharedValue<number | null>(null); // 🆕 Traccia ultima posizione per evitare chiamate duplicate
  const targetPositionSV = useSharedValue<number | null>(null); // 🆕 Posizione target calcolata (usata per throttling)

  // 🆕 Throttle le chiamate a onDragTargetChange usando useAnimatedReaction
  useAnimatedReaction(
    () => targetPositionSV.value,
    (currentPos, previousPos) => {
      // Solo se la posizione è cambiata, chiama runOnJS
      if (currentPos !== previousPos && isDraggingSV.value) {
        lastTargetPositionSV.value = currentPos;
        if (onDragTargetChange) {
          runOnJS(onDragTargetChange)(currentPos);
        }
      }
    },
    [onDragTargetChange]
  );

  // JIGGLE (solo quando in edit mode e non stai trascinando)
  const jiggle = useSharedValue(0);
  
  // Gestisce jiggle quando cambia editMode o isDragging
  useEffect(() => {
    if (editMode && !isDragging) {
      jiggle.value = withRepeat(withTiming(1, { duration: 120 }), -1, true);
    } else {
      jiggle.value = withTiming(0, { duration: 120 });
    }
  }, [editMode, isDragging]);

  const widgetConfig = useMemo(
    () => config.find(w => w.id === widgetId),
    [config, widgetId]
  );
  const isEnabled = widgetConfig?.enabled ?? true;
  const currentPosition = widgetConfig?.position ?? 0;

  const positionSV = useSharedValue(currentPosition);
  useEffect(() => {
    positionSV.value = currentPosition;
  }, [currentPosition]);

  const computeNewPosition = (fromPos: number, tx: number, ty: number) => {
    const curRow = Math.floor(fromPos / 3);
    const curCol = fromPos % 3;
    const threshold = 60; // 🆕 Aumentata threshold per ridurre cambiamenti frequenti

    let newCol = curCol;
    if (Math.abs(tx) > threshold) newCol = tx > 0 ? Math.min(2, curCol + 1) : Math.max(0, curCol - 1);

    let newRow = curRow;
    if (Math.abs(ty) > threshold) newRow = ty > 0 ? Math.min(1, curRow + 1) : Math.max(0, curRow - 1);

    return newRow * 3 + newCol;
  };

  const updateWidgetPosition = async (newPosition: number) => {
    try {
      const next = [...config];
      const i = next.findIndex(w => w.id === widgetId);
      if (i < 0) return;
      const from = next[i].position;
      if (from === newPosition) return;

      const j = next.findIndex(w => w.id !== widgetId && w.enabled && w.position === newPosition);
      if (j >= 0) {
        next[i].position = newPosition;
        next[j].position = from;
      } else {
        next[i].position = newPosition;
      }
      await reorderWidgets(next);
    } finally {
      // reset visual
      runOnJS(setIsDragging)(false);
      isDraggingSV.value = false;
      lastTargetPositionSV.value = null; // 🆕 Reset
      targetPositionSV.value = null; // 🆕 Reset
      onDragTargetChange && runOnJS(onDragTargetChange)(null);
      translateX.value = withSpring(0, { damping: 20, stiffness: 300 });
      translateY.value = withSpring(0, { damping: 20, stiffness: 300 });
      scale.value = withSpring(1, { damping: 20, stiffness: 300 });
    }
  };

  // gestures
  const onGestureEvent = (event: any) => {
    'worklet';
    if (!editMode || !isDraggingSV.value) return;
    
    // 🆕 Aggiorna direttamente i valori animati (worklet thread, nessun bridge)
    translateX.value = event.nativeEvent.translationX;
    translateY.value = event.nativeEvent.translationY;

    const tx = event.nativeEvent.translationX;
    const ty = event.nativeEvent.translationY;

    // 🆕 Calcola nuova posizione solo quando necessario (threshold aumentata)
    if (Math.abs(tx) > 80 || Math.abs(ty) > 80) {
      const newPos = computeNewPosition(positionSV.value, tx, ty);
      // 🆕 Aggiorna solo se diversa dall'ultima (evita calcoli inutili)
      if (targetPositionSV.value !== newPos) {
        targetPositionSV.value = newPos;
      }
    } else {
      // 🆕 Resetta solo se non era già null
      if (targetPositionSV.value !== null) {
        targetPositionSV.value = null;
      }
    }
  };

  const onHandlerStateChange = (event: any) => {
    'worklet';
    if (event.nativeEvent.state === State.BEGAN) {
      if (editMode) {
        runOnJS(setIsDragging)(true);
        isDraggingSV.value = true;
        scale.value = withSpring(1.05, { damping: 15, stiffness: 300 }); // 🆕 Animazione più veloce
        lastTargetPositionSV.value = null; // 🆕 Reset al inizio del drag
        targetPositionSV.value = null; // 🆕 Reset
      }
    } else if (
      event.nativeEvent.state === State.END ||
      event.nativeEvent.state === State.CANCELLED ||
      event.nativeEvent.state === State.FAILED
    ) {
      if (isDraggingSV.value) {
        const tx = event.nativeEvent.translationX;
        const ty = event.nativeEvent.translationY;
        if (Math.abs(tx) > 60 || Math.abs(ty) > 60) {
          const newPos = computeNewPosition(positionSV.value, tx, ty);
          runOnJS(updateWidgetPosition)(newPos);
        } else {
          runOnJS(setIsDragging)(false);
          isDraggingSV.value = false;
          lastTargetPositionSV.value = null; // 🆕 Reset
          targetPositionSV.value = null; // 🆕 Reset
          onDragTargetChange && runOnJS(onDragTargetChange)(null);
          translateX.value = withSpring(0, { damping: 20, stiffness: 300 });
          translateY.value = withSpring(0, { damping: 20, stiffness: 300 });
          scale.value = withSpring(1, { damping: 20, stiffness: 300 });
        }
      }
    }
  };

  // anim
  const animatedStyle = useAnimatedStyle(() => {
    const jiggleDeg = editMode && !isDraggingSV.value ? (jiggle.value - 0.5) * 3 /* -1.5..+1.5deg */ : 0;
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
        { rotateZ: `${jiggleDeg}deg` },
      ],
      zIndex: isDraggingSV.value ? 20 : 1,
      elevation: isDraggingSV.value ? 10 : 1,
      shadowColor: isDraggingSV.value ? '#000' : 'transparent',
      shadowOffset: isDraggingSV.value ? { width: 0, height: 6 } : { width: 0, height: 0 },
      shadowOpacity: isDraggingSV.value ? 0.25 : 0,
      shadowRadius: isDraggingSV.value ? 10 : 0,
    } as any;
  });

  const handleTap = () => {
    if (editMode) return;
    onPress?.();
  };

  const handleLongPress = () => {
    onEnterEditMode?.();
    onLongPress?.();
  };

  const cycleSize = () => {
    const sizes: Array<'small' | 'medium' | 'large'> = ['small', 'medium', 'large'];
    const idx = sizes.indexOf((widgetConfig?.size ?? 'small') as any);
    const next = sizes[(idx + 1) % sizes.length];
    onResize?.(next);
  };

  return (
    <PanGestureHandler
      enabled={editMode}
      onGestureEvent={onGestureEvent}
      onHandlerStateChange={onHandlerStateChange}
      activeOffsetY={[-10, 10]}
    >
      <Animated.View style={animatedStyle}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handleTap}
          onLongPress={handleLongPress}
          delayLongPress={450}
          style={[
            { opacity: isEnabled ? 1 : 0.5 },
            editMode && styles.editModeIndicator,
          ]}
        >
          {children}

          {editMode && (
            <>
              <TouchableOpacity
                onPress={onRemove}
                style={[styles.bubble, styles.remove]}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons name="minus" size={16} color="#fff" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={cycleSize}
                style={[styles.bubble, styles.resize]}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons name="arrow-left-right" size={16} color="#fff" />
              </TouchableOpacity>
            </>
          )}
        </TouchableOpacity>
      </Animated.View>
    </PanGestureHandler>
  );
};

const styles = StyleSheet.create({
  bubble: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  remove: {
    top: 8,
    right: 8,
    backgroundColor: '#ef4444',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  resize: {
    bottom: 8,
    right: 8,
    backgroundColor: '#6366f1',
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  editModeIndicator: {
    borderWidth: 2.5,
    borderColor: '#818cf8',
    borderStyle: 'dashed',
    borderRadius: 22,
  },
});

export default EditableWidget;
