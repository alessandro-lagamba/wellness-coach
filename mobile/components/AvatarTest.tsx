import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AvatarChat } from './avatar/AvatarChat';

interface AvatarTestProps {
  userId: string;
}

/**
 * Componente di test per l'avatar nella chat
 */
export const AvatarTest: React.FC<AvatarTestProps> = ({ userId }) => {
  const [showAvatar, setShowAvatar] = useState(false);

  return (
    <View style={styles.container}>
      {showAvatar ? (
        <AvatarChat
          userId={userId}
          isVisible={true}
          onToggle={() => setShowAvatar(false)}
        />
      ) : (
        <TouchableOpacity 
          style={styles.toggleButton} 
          onPress={() => setShowAvatar(true)}
        >
          <MaterialCommunityIcons name="robot" size={24} color="#6366f1" />
          <Text style={styles.toggleText}>Mostra Avatar</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
    alignItems: 'center',
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  toggleText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#6366f1',
    fontWeight: '500',
  },
});
