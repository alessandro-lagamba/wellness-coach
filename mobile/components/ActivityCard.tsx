import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

const { width } = Dimensions.get('window');

interface ActivityCardProps {
  title: string;
  value: string;
  subtitle: string;
  progress: number;
  icon: string;
  color: string;
  backgroundColor: string;
  trend?: string;
  trendValue?: string;
  onPress?: () => void;
  onLongPress?: () => void;
}

const ActivityCard: React.FC<ActivityCardProps> = ({
  title,
  value,
  subtitle,
  progress,
  icon,
  color,
  backgroundColor,
  trend,
  trendValue,
  onPress,
  onLongPress,
}) => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const handlePressIn = () => {
    scale.value = withTiming(0.95, { duration: 100 });
    opacity.value = withTiming(0.8, { duration: 100 });
  };

  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: 100 });
    opacity.value = withTiming(1, { duration: 100 });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const ProgressCircle = ({ progress, color, size = 80 }: { progress: number; color: string; size?: number }) => {
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
            strokeWidth="6"
            fill="transparent"
          />
          {/* Progress circle */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth="6"
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

  const getProgressColor = () => {
    if (progress >= 80) return '#10b981'; // Green
    if (progress >= 50) return '#f59e0b'; // Orange
    return '#ef4444'; // Red
  };

  return (
    <Animated.View style={[animatedStyle]}>
      <TouchableOpacity
        style={[
          styles.card,
          { backgroundColor }
        ]}
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.9}
      >
        {/* Header with icon and trend */}
        <View style={styles.header}>
          <Text style={styles.icon}>{icon}</Text>
          {trend && trendValue && (
            <View style={[styles.trendBadge, { backgroundColor: `${color}20` }]}>
              <Text style={[styles.trendText, { color }]}>{trendValue}</Text>
            </View>
          )}
        </View>

        {/* Progress Circle */}
        <View style={styles.progressContainer}>
          <ProgressCircle 
            progress={progress} 
            color={getProgressColor()} 
            size={80}
          />
        </View>

        {/* Content */}
        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <Text style={[styles.value, { color }]} numberOfLines={1}>{value}</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 160,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 12,
  },
  icon: {
    fontSize: 20,
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
  progressContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
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
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 28,
  },
  progressUnit: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: -4,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
    textAlign: 'center',
  },
  value: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
    textAlign: 'center',
  },
});

export default ActivityCard;
