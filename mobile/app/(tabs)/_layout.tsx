import { Tabs } from 'expo-router';
import React, { useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  useColorScheme as RNUseColorScheme,
  ViewStyle,
  StyleProp,
  Animated,
  Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { useColorScheme } from '../../hooks/useColorScheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useTranslation } from '../../hooks/useTranslation';
import { useTheme } from '../../contexts/ThemeContext';
import { useTabBarVisibility } from '../../contexts/TabBarVisibilityContext';
import { useScrollToTop } from '../../contexts/ScrollToTopContext';

export default function TabLayout() {
  return <TabNavigator />;
}

function TabNavigator() {
  const colorScheme = useColorScheme();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const systemColorScheme = RNUseColorScheme();
  const insets = useSafeAreaInsets();
  const { isVisible } = useTabBarVisibility();
  const { scrollToTop } = useScrollToTop();
  const { mode } = useTheme(); // Use app theme mode
  const isDark = mode === 'dark'; // Derive isDark from app theme

  const fallbackBackground = isDark ? '#050612' : '#f3f4f6';
  const backgroundColor = colors?.background || fallbackBackground;

  const primaryColor = colors?.primary || '#6366f1';
  // Force darker color for better visibility in light mode, ignoring theme default
  const inactiveTintColor = isDark
    ? (colors?.textSecondary || '#9ca3af')
    : '#1f2937'; // Gray 800 - Very dark grey for maximum visibility

  //
  // ---- TAB ICON COMPONENT (icon + label always visible) ----
  //
  const TabIcon = ({
    focused,
    children,
  }: {
    focused: boolean;
    children: React.ReactNode;
  }) => {
    const circleAnim = useRef(new Animated.Value(focused ? 1 : 0)).current;

    useEffect(() => {
      Animated.timing(circleAnim, {
        toValue: focused ? 1 : 0,
        duration: 200,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    }, [focused]);

    const scale = circleAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.9, 1],
    });

    const opacity = circleAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.5, 1], // Increased from 0.2 to 0.7 for better visibility of inactive icons
    });

    return (
      <View
        style={{
          // flex: 1, // REMOVED to allow better centering control from parent
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Animated.View
          style={{
            padding: focused ? 2 : 0,
            borderRadius: 999,
            borderWidth: focused ? 1 : 0,
            borderColor: focused
              ? isDark
                ? 'rgba(191,219,254,0.9)'
                : 'rgba(129,140,248,0.9)'
              : 'transparent',
            transform: [{ scale }],
            opacity,
            backgroundColor: focused
              ? isDark
                ? 'rgba(88,28,135,0.45)'
                : 'rgba(129,140,248,0.18)'
              : 'transparent',
            marginBottom: 0, // Removed spacing since no label
          }}
        >
          <View
            style={{
              width: 44, // Increased from 32
              height: 44, // Increased from 32
              borderRadius: 22, // Increased from 16
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            {children}
          </View>
        </Animated.View>

      </View>
    );
  };

  //
  // ---- TAB BAR STYLE ----
  //
  const baseTabBarStyle = useMemo<ViewStyle>(
    () => ({
      position: 'absolute',
      bottom: insets.bottom + 8,
      marginHorizontal: 10,
      borderRadius: 26,
      backgroundColor: 'transparent',
      height: 68,

      paddingHorizontal: 10,
      paddingVertical: 0,

      shadowColor: isDark ? '#000' : '#0f172a',
      shadowOpacity: isDark ? 0.45 : 0.18,
      shadowOffset: { width: 0, height: 12 },
      shadowRadius: isDark ? 26 : 18,
      elevation: isDark ? 20 : 14,

      borderWidth: 1,
      borderColor: isDark
        ? 'rgba(255,255,255,0.1)' // Lighter border for dark mode
        : 'rgba(15,23,42,0.06)',
    }),
    [insets.bottom, isDark],
  );

  const tabBarStyle = useMemo<StyleProp<ViewStyle>>(
    () => (isVisible ? baseTabBarStyle : [baseTabBarStyle, { display: 'none' as const }]),
    [baseTabBarStyle, isVisible],
  );

  const renderTab = (
    label: string,
    focused: boolean,
    icon: React.ReactNode,
  ) => (
    <View style={{
      alignItems: 'center',
      justifyContent: 'center',
      top: 14, // Added to push icons down to center
      height: '100%',
    }}>
      <TabIcon focused={focused}>{icon}</TabIcon>
      {/* Label removed */}
    </View>
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor },
        tabBarHideOnKeyboard: true,

        tabBarActiveTintColor: primaryColor,
        tabBarInactiveTintColor: inactiveTintColor,

        //
        // ---- BACKGROUND LIGHT / DARK ----
        //
        tabBarBackground: () => (
          <View
            style={{
              flex: 1,
              borderRadius: 26,
              overflow: 'hidden',
              backgroundColor: isDark ? 'rgba(20,20,30,0.6)' : 'transparent', // Fallback/base for dark
            }}
          >
            {isDark ? (
              <BlurView
                intensity={80} // Increased from 40
                tint="dark"
                style={{
                  flex: 1,
                  backgroundColor: 'rgba(30,30,45,0.9)', // Increased opacity from 0.65
                }}
              />
            ) : (
              <BlurView
                intensity={80} // Increased from 35
                tint="light"
                style={{
                  flex: 1,
                  backgroundColor: 'rgba(255,255,255,0.96)', // Increased opacity from 0.9
                }}
              />
            )}
          </View>
        ),

        tabBarStyle,

        tabBarItemStyle: {
          height: 68, // stessa altezza della barra = centraggio perfetto
          justifyContent: 'center',
          alignItems: 'center',
        },

        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ color, focused }) => (
            renderTab(
              t('tabs.home'),
              focused,
              <FontAwesome
                name="home"
                size={30} // Increased from 20
                color={focused ? primaryColor : color}
              />,
            )
          ),
        }}
        listeners={{
          tabPress: () => {
            console.log('[TabLayout] Home tab pressed');
            // Scroll to top when home tab is pressed
            scrollToTop('home');
          },
        }}
      />

      <Tabs.Screen
        name="analysis"
        options={{
          title: t('tabs.emotion'),
          tabBarIcon: ({ color, focused }) => (
            renderTab(
              t('tabs.emotion'),
              focused,
              <MaterialIcons
                name="emoji-emotions"
                size={30} // Increased from 20
                color={focused ? primaryColor : color}
              />,
            )
          ),
        }}
        listeners={{
          tabPress: () => {
            console.log('[TabLayout] Analysis tab pressed');
            scrollToTop('analysis');
          },
        }}
      />

      <Tabs.Screen
        name="skin"
        options={{
          title: t('tabs.skin'),
          tabBarIcon: ({ color, focused }) => (
            renderTab(
              t('tabs.skin'),
              focused,
              <MaterialIcons
                name="face"
                size={30} // Increased from 20
                color={focused ? primaryColor : color}
              />,
            )
          ),
        }}
        listeners={{
          tabPress: () => {
            console.log('[TabLayout] Skin tab pressed');
            scrollToTop('skin');
          },
        }}
      />

      <Tabs.Screen
        name="food"
        options={{
          title: t('tabs.food'),
          tabBarIcon: ({ color, focused }) => (
            renderTab(
              t('tabs.food'),
              focused,
              <MaterialIcons
                name="restaurant"
                size={30} // Increased from 20
                color={focused ? primaryColor : color}
              />,
            )
          ),
        }}
        listeners={{
          tabPress: () => {
            console.log('[TabLayout] Food tab pressed');
            scrollToTop('food');
          },
        }}
      />

      <Tabs.Screen
        name="suggestions"
        options={{
          title: t('tabs.library'),
          tabBarIcon: ({ color, focused }) => (
            renderTab(
              t('tabs.library'),
              focused,
              <FontAwesome
                name="heart-o"
                size={30} // Increased from 20
                color={focused ? primaryColor : color}
              />,
            )
          ),
        }}
        listeners={{
          tabPress: () => {
            console.log('[TabLayout] Suggestions tab pressed');
            scrollToTop('suggestions');
          },
        }}
      />

      <Tabs.Screen
        name="coach"
        options={{
          title: t('tabs.chat'),
          href: null, // Hidden - Chat is accessed from HeroSection
          tabBarIcon: ({ color, focused }) => (
            renderTab(
              t('tabs.chat'),
              focused,
              <MaterialIcons
                name="chat"
                size={30} // Increased from 20
                color={focused ? primaryColor : color}
              />,
            )
          ),
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
          tabBarIcon: ({ color, focused }) => (
            renderTab(
              t('tabs.settings'),
              focused,
              <MaterialIcons
                name="settings"
                size={30} // Increased from 20
                color={focused ? primaryColor : color}
              />,
            )
          ),
        }}
        listeners={{
          tabPress: () => {
            console.log('[TabLayout] Settings tab pressed');
            scrollToTop('settings');
          },
        }}
      />
    </Tabs>
  );
}