import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';
import Colors from '../../constants/Colors';
import { useColorScheme } from '../../hooks/useColorScheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import FontAwesome from '@expo/vector-icons/FontAwesome';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
            <Tabs
              screenOptions={{
                tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
                tabBarInactiveTintColor: '#94a3b8',
                headerShown: false,
                tabBarStyle: {
          position: 'absolute',
          bottom: 25,
          marginHorizontal: 30,  // Increased margins to make bar narrower
          backgroundColor: '#ffffff',
          borderRadius: 30,  // Much more rounded for pill shape
          height: 70,  // Reduced height for pill look
          shadowColor: '#000',
          shadowOpacity: 0.15,  // Increased shadow for better visibility
          shadowOffset: {
            width: 0,
            height: 8
          },
          shadowRadius: 20,  // Increased shadow radius
          elevation: 15,  // Increased elevation
          paddingBottom: 8,
          paddingTop: 8,
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
            title: 'Home',
            tabBarIcon: ({ color }) => <FontAwesome name="home" size={24} color={color} />,
          }}
        />
      
      <Tabs.Screen
        name="analysis"
        options={{
          title: 'Emotion',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="emoji-emotions" size={size} color={color} />,
        }}
      />
      
      <Tabs.Screen
        name="skin"
        options={{
          title: 'Skin',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="face" size={size} color={color} />,
        }}
      />
      
      <Tabs.Screen
        name="suggestions"
        options={{
          title: 'Library',
          tabBarIcon: ({ color, size }) => <FontAwesome name="heart-o" size={size} color={color} />,
        }}
      />
      
      <Tabs.Screen
        name="coach"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="chat" size={size} color={color} />,
          tabBarStyle: { display: 'none' }, // Hide bottom navigation for chat
        }}
      />
      
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="settings" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}