import React, { createContext, useContext, useState, ReactNode } from 'react';

interface TutorialContextType {
  showTutorial: boolean;
  setShowTutorial: (show: boolean) => void;
  startHomeWalkthrough: () => void;
  startFoodWalkthrough: () => void;
  startChatWalkthrough: () => void;
  startSkinWalkthrough: () => void;
}

const TutorialContext = createContext<TutorialContextType | undefined>(undefined);

interface TutorialProviderProps {
  children: ReactNode;
}

export const TutorialProvider: React.FC<TutorialProviderProps> = ({ children }) => {
  const [showTutorial, setShowTutorial] = useState(false);

  // Placeholder functions - will be overridden by screens or managed via events if needed
  // For now, we'll use a simple event emitter pattern or just state if screens consume this context
  // But since Copilot is per-screen, we might just need to trigger it from here.

  // Actually, a better approach is to expose a way to trigger the walkthrough
  // We can use a simple event system or just let the screens check on mount

  const startHomeWalkthrough = () => {
    // This will be handled by the HomeScreen checking the service
    // or we can emit an event here if we want to force start it
    console.log('Requesting Home Walkthrough');
  };

  const startFoodWalkthrough = () => {
    console.log('Requesting Food Walkthrough');
  };

  const startChatWalkthrough = () => {
    console.log('Requesting Chat Walkthrough');
  };

  const startSkinWalkthrough = () => {
    console.log('Requesting Skin Walkthrough');
  };

  return (
    <TutorialContext.Provider value={{
      showTutorial,
      setShowTutorial,
      startHomeWalkthrough,
      startFoodWalkthrough,
      startChatWalkthrough,
      startSkinWalkthrough
    }}>
      {children}
    </TutorialContext.Provider>
  );
};

export const useTutorial = (): TutorialContextType => {
  const context = useContext(TutorialContext);
  if (context === undefined) {
    throw new Error('useTutorial must be used within a TutorialProvider');
  }
  return context;
};

