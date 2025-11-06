/**
 * Theme Context
 * Gestisce lo stato del tema (light/dark) e fornisce accesso ai colori
 */

import React, { createContext, useContext, useState, useEffect, ReactNode, Fragment } from 'react';
import { useColorScheme, View, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeMode, ThemeColors, themes } from '../constants/Theme';

const THEME_STORAGE_KEY = '@wellness:theme_mode';

interface ThemeContextType {
  mode: ThemeMode;
  colors: ThemeColors;
  toggleTheme: () => Promise<void>;
  setTheme: (mode: ThemeMode) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>('light');

  // 🆕 Carica tema salvato o usa quello di sistema
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (saved === 'dark' || saved === 'light') {
          setMode(saved);
        } else {
          // Usa il tema di sistema
          setMode(systemColorScheme === 'dark' ? 'dark' : 'light');
        }
      } catch (e) {
        console.error('[Theme] Error loading saved theme:', e);
        setMode(systemColorScheme === 'dark' ? 'dark' : 'light');
      }
    };
    
    loadTheme();
  }, [systemColorScheme]);

  // 🆕 Salva tema quando cambia
  const setTheme = async (newMode: ThemeMode) => {
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newMode);
      setMode(newMode);
    } catch (e) {
      console.error('[Theme] Error saving theme:', e);
    }
  };

  // 🆕 Toggle tema
  const toggleTheme = async () => {
    const newMode = mode === 'light' ? 'dark' : 'light';
    await setTheme(newMode);
  };

  const colors = themes[mode];

  // Rende sicuri eventuali nodi stringa al top-level del provider
  const renderChild = (node: ReactNode, key?: string | number): ReactNode => {
    if (typeof node === 'string' || typeof node === 'number') {
      return <Text key={key}>{node}</Text>;
    }
    if (Array.isArray(node)) {
      return (
        <Fragment key={key}>
          {node.map((n, i) => renderChild(n, i))}
        </Fragment>
      );
    }
    return node as ReactNode;
  };

  return (
    <ThemeContext.Provider value={{ mode, colors, toggleTheme, setTheme }}>
      <View style={{ flex: 1, backgroundColor: colors.background }} collapsable={false}>
        {renderChild(children)}
      </View>
    </ThemeContext.Provider>
  );
};

// 🆕 Hook per usare il tema
export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

