import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

interface BottomNavigationProps {}

type TabPath =
  | '/(tabs)'
  | '/(tabs)/analysis'
  | '/(tabs)/skin'
  | '/(tabs)/coach'
  | '/(tabs)/settings';

export const BottomNavigation: React.FC<BottomNavigationProps> = () => {
  const router = useRouter();
  const pathname = usePathname();
  
  const isActive = (path: TabPath) => {
    if (path === '/(tabs)') {
      return pathname === '/' || pathname === '/(tabs)';
    }

    return pathname === path;
  };

  const navigateTo = (path: TabPath) => {
    router.push(path);
  };

  const navItems: Array<{ path: TabPath; icon: string; label: string }> = [
    { path: '/(tabs)', icon: 'home', label: 'Home' },
    { path: '/(tabs)/analysis', icon: 'line-chart', label: 'Emotion' },
    { path: '/(tabs)/skin', icon: 'leaf', label: 'Skin' },
    { path: '/(tabs)/coach', icon: 'android', label: 'Coach' },
    { path: '/(tabs)/settings', icon: 'cog', label: 'Settings' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.navigation}>
        {navItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={styles.navItem}
            onPress={() => navigateTo(item.path)}
            activeOpacity={0.7}
          >
            <View style={[
              styles.iconContainer,
              isActive(item.path) && styles.activeIconContainer
            ]}>
              <FontAwesome
                name={item.icon as any}
                size={22}
                color={isActive(item.path) ? '#6366f1' : '#6b7280'}
              />
            </View>
            <Text style={[
              styles.label,
              isActive(item.path) && styles.activeLabel
            ]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB', // HeroUI border-default-100
    backgroundColor: 'white', // HeroUI bg-content1
    paddingVertical: 8, // HeroUI py-2
    paddingHorizontal: 16, // HeroUI px-4
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 8,
  },
  navigation: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  navItem: {
    alignItems: 'center',
    paddingVertical: 4, // HeroUI py-1
    flex: 1,
  },
  iconContainer: {
    padding: 8, // HeroUI p-2
    borderRadius: 20, // HeroUI rounded-full
  },
  activeIconContainer: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)', // HeroUI bg-primary/10
  },
  label: {
    fontSize: 10, // HeroUI text-xs
    marginTop: 4, // HeroUI mt-1
    color: '#6b7280', // HeroUI text-default-500
    fontWeight: '400',
  },
  activeLabel: {
    color: '#6366f1', // HeroUI text-primary
    fontWeight: '500', // HeroUI font-medium
  },
});
