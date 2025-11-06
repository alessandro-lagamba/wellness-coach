/**
 * StatusBar Context
 * Permette alle schermate di override il colore della status bar
 */

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface StatusBarContextType {
  statusBarColor: string | null;
  setStatusBarColor: (color: string | null) => void;
}

const StatusBarContext = createContext<StatusBarContextType | undefined>(undefined);

interface StatusBarProviderProps {
  children: ReactNode;
}

export const StatusBarProvider: React.FC<StatusBarProviderProps> = ({ children }) => {
  // 🆕 Inizializza con il colore del gradiente perché l'app inizia sempre con loading/AuthScreen
  const [statusBarColor, setStatusBarColor] = useState<string | null>('#667eea');

  return (
    <StatusBarContext.Provider value={{ statusBarColor, setStatusBarColor }}>
      {children}
    </StatusBarContext.Provider>
  );
};

export const useStatusBarColor = (): StatusBarContextType => {
  const context = useContext(StatusBarContext);
  if (!context) {
    throw new Error('useStatusBarColor must be used within StatusBarProvider');
  }
  return context;
};

