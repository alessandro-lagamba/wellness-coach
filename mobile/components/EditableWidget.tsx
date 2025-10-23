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

  // JIGGLE (solo quando in edit mode e non stai trascinando)
  const jiggle = useSharedValue(0);
  useEffect(() => {
    if (editMode && !isDragging) {
      jiggle.value = withRepeat(withTiming(1, { duration: 120 }), -1, true);
    } else {
      jiggle.value = withTiming(0, { duration: 120 });
    }
  }, [editMode, isDragging, jiggle]);

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
    const threshold = 50;

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
      onDragTargetChange && runOnJS(onDragTargetChange)(null);
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
      scale.value = withSpring(1);
    }
  };

  // gestures
  const onGestureEvent = (event: any) => {
    'worklet';
    if (!editMode || !isDraggingSV.value) return;
    translateX.value = event.nativeEvent.translationX;
    translateY.value = event.nativeEvent.translationY;

    const tx = event.nativeEvent.translationX;
    const ty = event.nativeEvent.translationY;

    if (Math.abs(tx) > 50 || Math.abs(ty) > 50) {
      const newPos = computeNewPosition(positionSV.value, tx, ty);
      onDragTargetChange && runOnJS(onDragTargetChange)(newPos);
    } else {
      onDragTargetChange && runOnJS(onDragTargetChange)(null);
    }
  };

  const onHandlerStateChange = (event: any) => {
    'worklet';
    if (event.nativeEvent.state === State.BEGAN) {
      if (editMode) {
        runOnJS(setIsDragging)(true);
        isDraggingSV.value = true;
        scale.value = withSpring(1.05);
      }
    } else if (
      event.nativeEvent.state === State.END ||
      event.nativeEvent.state === State.CANCELLED ||
      event.nativeEvent.state === State.FAILED
    ) {
      if (isDraggingSV.value) {
        const tx = event.nativeEvent.translationX;
        const ty = event.nativeEvent.translationY;
        if (Math.abs(tx) > 50 || Math.abs(ty) > 50) {
          const newPos = computeNewPosition(positionSV.value, tx, ty);
          runOnJS(updateWidgetPosition)(newPos);
        } else {
          runOnJS(setIsDragging)(false);
          isDraggingSV.value = false;
          onDragTargetChange && runOnJS(onDragTargetChange)(null);
          translateX.value = withSpring(0);
          translateY.value = withSpring(0);
          scale.value = withSpring(1);
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
      enabled={true}
      onGestureEvent={onGestureEvent}
      onHandlerStateChange={onHandlerStateChange}
      minDist={10}
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
