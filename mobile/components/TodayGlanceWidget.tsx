import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
} from 'react-native';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withTiming,
  withSpring 
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Svg, { Circle } from 'react-native-svg';
import { WidgetData } from '../services/today-glance.service';

const { width } = Dimensions.get('window');

interface TodayGlanceWidgetProps {
  widget: WidgetData;
  onPress: (widgetId: string) => void;
  onLongPress: (widgetId: string) => void;
}

const TodayGlanceWidget: React.FC<TodayGlanceWidgetProps> = ({
  widget,
  onPress,
  onLongPress
}) => {
  const [isPressed, setIsPressed] = useState(false);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const handlePressIn = () => {
    setIsPressed(true);
    scale.value = withSpring(0.95, { damping: 15, stiffness: 150 });
    opacity.value = withTiming(0.8, { duration: 100 });
  };

  const handlePressOut = () => {
    setIsPressed(false);
    scale.value = withSpring(1, { damping: 15, stiffness: 150 });
    opacity.value = withTiming(1, { duration: 100 });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const getWidgetSize = () => {
    // Tutti i widget sono narrow ora (3 per riga)
    return { width: (width - 60) / 3, height: 120 };
  };

  const getGradientColors = () => {
    const baseColor = widget.color;
    const lightColor = `${baseColor}20`;
    return [lightColor, '#ffffff'];
  };

  const ProgressCircle = ({ progress, color, size = 60 }: { progress: number; color: string; size?: number }) => {
    const radius = (size - 8) / 2;
    const circumference = 2 * Math.PI * radius;
    const strokeDasharray = circumference;
    const strokeDashoffset = circumference - (progress / 100) * circumference;

    return (
      <View style={styles.progressCircleContainer}>
        <Svg width={size} height={size} style={styles.progressCircleSvg}>
          {/* Background circle */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#f1f5f9"
            strokeWidth="4"
            fill="transparent"
          />
          {/* Progress circle */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth="4"
            fill="transparent"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
        <View style={styles.progressCenter}>
          <Text style={[styles.progressValue, { color }]}>{Math.round(progress)}</Text>
          <Text style={styles.progressUnit}>%</Text>
        </View>
      </View>
    );
  };

  const getProgressBarColor = () => {
    if (widget.progress && widget.progress >= 80) return '#10b981';
    if (widget.progress && widget.progress >= 50) return '#f59e0b';
    return '#ef4444';
  };

  const widgetSize = getWidgetSize();

  return (
    <Animated.View style={[animatedStyle]}>
      <TouchableOpacity
        style={[
          styles.widget,
          {
            width: widgetSize.width,
            height: widgetSize.height,
            backgroundColor: widget.backgroundColor,
          }
        ]}
        onPress={() => onPress(widget.id)}
        onLongPress={() => onLongPress(widget.id)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.9}
      >
        <View style={styles.widgetContainer}>
          {/* Header with icon and trend */}
          <View style={styles.widgetHeader}>
            <Text style={styles.widgetIcon}>{widget.icon}</Text>
            {widget.trend && (
              <View style={[
                styles.trendBadge,
                { backgroundColor: `${widget.color}15` }
              ]}>
                <Text style={[
                  styles.trendText,
                  { color: widget.color }
                ]}>
                  {widget.trendValue}
                </Text>
              </View>
            )}
          </View>

          {/* Progress Circle */}
          {widget.progress !== undefined && (
            <View style={styles.progressContainer}>
              <ProgressCircle 
                progress={widget.progress} 
                color={getProgressBarColor()} 
                size={70}
              />
            </View>
          )}

          {/* Title and Value */}
          <View style={styles.widgetContent}>
            <Text style={styles.widgetTitle} numberOfLines={1}>{widget.title}</Text>
            <Text style={[styles.widgetValue, { color: widget.color }]}>
              {widget.value}
            </Text>
            <Text style={styles.widgetSubtitle}>{widget.subtitle}</Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  widget: {
    borderRadius: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  widgetContainer: {
    flex: 1,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  widgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
  },
  widgetIcon: {
    fontSize: 18,
  },
  trendBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  trendText: {
    fontSize: 12,
    fontWeight: '600',
  },
  widgetContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  widgetTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
    textAlign: 'center',
  },
  widgetValue: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
    textAlign: 'center',
  },
  widgetSubtitle: {
    fontSize: 10,
    color: '#6b7280',
    fontWeight: '500',
    textAlign: 'center',
  },
  progressContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  progressCircleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  progressCircleSvg: {
    position: 'absolute',
  },
  progressCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressValue: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 20,
  },
  progressUnit: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: -2,
  },
});

export default TodayGlanceWidget;
