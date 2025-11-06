import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, View } from 'react-native';
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

  return (
            <Tabs
              screenOptions={{
                tabBarActiveTintColor: colors.primary,
                tabBarInactiveTintColor: colors.textTertiary,
                headerShown: false,
                // ✅ colore di fondo coerente per tutte le scene/ transizioni
                sceneContainerStyle: { 
                  backgroundColor: colors.background,
                  flex: 1,
                },
                tabBarStyle: {
          position: 'absolute',
          bottom: 25,
          marginHorizontal: 30,  // Increased margins to make bar narrower
          backgroundColor: colors.surface,
          borderRadius: 30,  // Much more rounded for pill shape
          height: 70,  // Reduced height for pill look
          shadowColor: colors.shadowColor,
          shadowOpacity: 0.15,  // Increased shadow for better visibility
          shadowOffset: {
            width: 0,
            height: 8
          },
          shadowRadius: 20,  // Increased shadow radius
          elevation: 15,  // Increased elevation
          paddingBottom: 8,
          paddingTop: 8,
          borderTopColor: colors.border,  // ✅ Colore bordo coerente con il tema
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