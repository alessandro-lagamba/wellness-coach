import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, View, useColorScheme as RNUseColorScheme } from 'react-native';
import Colors from '../../constants/Colors';
import { useColorScheme } from '../../hooks/useColorScheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useTranslation } from '../../hooks/useTranslation';
import { useTheme } from '../../contexts/ThemeContext';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const systemColorScheme = RNUseColorScheme();
  // 🔥 FIX: Fallback color basato su useColorScheme per evitare flash bianco
  const fallbackBackground = systemColorScheme === 'dark' ? '#1a1625' : '#f8fafc';
  const backgroundColor = colors?.background || fallbackBackground;
  const surfaceColor = colors?.surface || (systemColorScheme === 'dark' ? '#2d2542' : '#ffffff');
  const borderColor = colors?.border || (systemColorScheme === 'dark' ? '#3a2f4f' : '#e2e8f0');
  const primaryColor = colors?.primary || '#6366f1';
  const textTertiaryColor = colors?.textTertiary || (systemColorScheme === 'dark' ? '#a78bfa' : '#94a3b8');

  return (
            <Tabs
              screenOptions={{
                tabBarActiveTintColor: primaryColor,
                tabBarInactiveTintColor: textTertiaryColor,
                headerShown: false,
                // 🔥 FIX: Usa backgroundColor con fallback per evitare flash bianco
                sceneStyle: {
                  backgroundColor,
                },
                tabBarStyle: {
          position: 'absolute',
          bottom: 25,
          marginHorizontal: 30,  // Increased margins to make bar narrower
          backgroundColor: surfaceColor,  // 🔥 FIX: Usa surfaceColor con fallback
          borderRadius: 30,  // Much more rounded for pill shape
          height: 70,  // Reduced height for pill look
          shadowColor: colors?.shadowColor || '#000000',
          shadowOpacity: 0.15,  // Increased shadow for better visibility
          shadowOffset: {
            width: 0,
            height: 8
          },
          shadowRadius: 20,  // Increased shadow radius
          elevation: 15,  // Increased elevation
          paddingBottom: 8,
          paddingTop: 8,
          borderTopColor: borderColor,  // 🔥 FIX: Usa borderColor con fallback
        },
        tabBarItemStyle: {
          height: 54,  // Centered height within the pill
          justifyContent: 'center',
          alignItems: 'center',
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
          marginTop: 2,
        },
      }}>
      
        <Tabs.Screen
          name="index"
          options={{
            title: t('tabs.home'),
            tabBarIcon: ({ color }) => <FontAwesome name="home" size={24} color={color} />,
          }}
        />
      
      <Tabs.Screen
        name="analysis"
        options={{
          title: t('tabs.emotion'),
          tabBarIcon: ({ color, size }) => <MaterialIcons name="emoji-emotions" size={size} color={color} />,
        }}
      />
      
      <Tabs.Screen
        name="skin"
        options={{
          title: t('tabs.skin'),
          tabBarIcon: ({ color, size }) => <MaterialIcons name="face" size={size} color={color} />,
        }}
      />
      
      <Tabs.Screen
        name="food"
        options={{
          title: t('tabs.food'),
          tabBarIcon: ({ color, size }) => <MaterialIcons name="restaurant" size={size} color={color} />,
        }}
      />
      
      <Tabs.Screen
        name="suggestions"
        options={{
          title: t('tabs.library'),
          tabBarIcon: ({ color, size }) => <FontAwesome name="heart-o" size={size} color={color} />,
        }}
      />
      
      <Tabs.Screen
        name="coach"
        options={{
          title: t('tabs.chat'),
          tabBarIcon: ({ color, size }) => <MaterialIcons name="chat" size={size} color={color} />,
          tabBarStyle: { display: 'none' }, // Hide bottom navigation for chat
        }}
      />
      
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
          tabBarIcon: ({ color, size }) => <MaterialIcons name="settings" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}