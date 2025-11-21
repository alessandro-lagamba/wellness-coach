import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

interface TabBarVisibilityContextValue {
  isVisible: boolean;
  hideTabBar: () => void;
  showTabBar: () => void;
  setTabBarVisible: (visible: boolean) => void;
}

const TabBarVisibilityContext = createContext<TabBarVisibilityContextValue | undefined>(undefined);

export const TabBarVisibilityProvider = ({ children }: { children: React.ReactNode }) => {
  const [hiddenCount, setHiddenCount] = useState(0);

  const hideTabBar = useCallback(() => {
    setHiddenCount((count) => count + 1);
  }, []);

  const showTabBar = useCallback(() => {
    setHiddenCount((count) => {
      if (count <= 0) return 0;
      return count - 1;
    });
  }, []);

  const setTabBarVisible = useCallback((visible: boolean) => {
    setHiddenCount(visible ? 0 : 1);
  }, []);

  const value = useMemo<TabBarVisibilityContextValue>(() => ({
    isVisible: hiddenCount === 0,
    hideTabBar,
    showTabBar,
    setTabBarVisible,
  }), [hiddenCount, hideTabBar, showTabBar, setTabBarVisible]);

  return (
    <TabBarVisibilityContext.Provider value={value}>
      {children}
    </TabBarVisibilityContext.Provider>
  );
};

export const useTabBarVisibility = () => {
  const context = useContext(TabBarVisibilityContext);
  if (!context) {
    throw new Error('useTabBarVisibility must be used within a TabBarVisibilityProvider');
  }
  return context;
};

