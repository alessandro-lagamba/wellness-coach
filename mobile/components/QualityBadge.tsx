import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ConfidenceInfo } from '../services/quality.service';

interface QualityBadgeProps {
  confidence: ConfidenceInfo;
  qualityMessage?: string;
  onRetakePress?: () => void;
  showRetakeButton?: boolean;
  compact?: boolean;
}

export const QualityBadge: React.FC<QualityBadgeProps> = ({
  confidence,
  qualityMessage,
  onRetakePress,
  showRetakeButton = false,
  compact = false,
}) => {
  const getConfidenceIcon = (level: string) => {
    switch (level) {
      case 'high': return 'check-circle';
      case 'medium': return 'alert-circle';
      case 'low': return 'close-circle';
      default: return 'help-circle';
    }
  };

  const getConfidenceColor = (level: string) => {
    switch (level) {
      case 'high': return '#10b981';
      case 'medium': return '#f59e0b';
      case 'low': return '#ef4444';
      default: return '#6b7280';
    }
  };

  if (compact) {
    return (
      <View style={[styles.compactContainer, { backgroundColor: getConfidenceColor(confidence.level) + '20' }]}>
        <MaterialCommunityIcons
          name={getConfidenceIcon(confidence.level) as any}
          size={16}
          color={getConfidenceColor(confidence.level)}
        />
        <Text style={[styles.compactText, { color: getConfidenceColor(confidence.level) }]} allowFontScaling={false}>
          {confidence.label}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Confidence Badge */}
      <View style={[styles.confidenceContainer, { backgroundColor: getConfidenceColor(confidence.level) + '20' }]}>
        <MaterialCommunityIcons
          name={getConfidenceIcon(confidence.level) as any}
          size={20}
          color={getConfidenceColor(confidence.level)}
        />
        <View style={styles.confidenceInfo}>
          <Text style={[styles.confidenceLabel, { color: getConfidenceColor(confidence.level) }]} allowFontScaling={false}>
            {confidence.label}
          </Text>
          <Text style={styles.confidenceScore} allowFontScaling={false}>
            {Math.round(confidence.score * 100)}%
          </Text>
        </View>
        <Text style={styles.confidenceDescription}>
          {confidence.description}
        </Text>
      </View>

      {/* Quality Message */}
      {qualityMessage && (
        <View style={styles.qualityMessageContainer}>
          <View style={styles.qualityMessageHeader}>
            <MaterialCommunityIcons name="camera" size={16} color="#6b7280" />
            <Text style={styles.qualityMessageTitle} allowFontScaling={false}>Qualità Foto</Text>
          </View>
          <Text style={styles.qualityMessageText}>{qualityMessage}</Text>

          {showRetakeButton && onRetakePress && (
            <TouchableOpacity
              style={styles.retakeButton}
              onPress={onRetakePress}
            >
              <MaterialCommunityIcons name="camera-retake" size={16} color="#ffffff" />
              <Text style={styles.retakeButtonText} allowFontScaling={false}>Riprova</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  compactText: {
    fontSize: 12,
    fontFamily: 'Figtree_700Bold', // Was 600
    marginLeft: 4,
  },
  confidenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  confidenceInfo: {
    flex: 1,
    marginLeft: 8,
  },
  confidenceLabel: {
    fontSize: 14,
    fontFamily: 'Figtree_700Bold', // Was 600
  },
  confidenceScore: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
    fontFamily: 'Figtree_500Medium',
  },
  confidenceDescription: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 8,
    flex: 1,
    fontFamily: 'Figtree_500Medium',
  },
  qualityMessageContainer: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  qualityMessageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  qualityMessageTitle: {
    fontSize: 14,
    fontFamily: 'Figtree_700Bold', // Was 600
    color: '#374151',
    marginLeft: 6,
  },
  qualityMessageText: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 12,
    lineHeight: 20,
    fontFamily: 'Figtree_500Medium',
  },
  retakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f59e0b',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  retakeButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: 'Figtree_700Bold', // Was 600
    marginLeft: 6,
  },
});
