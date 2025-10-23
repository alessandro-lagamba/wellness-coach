import React, { createContext, useContext, useState, ReactNode } from 'react';

interface TutorialContextType {
  showTutorial: boolean;
  setShowTutorial: (show: boolean) => void;
}

const TutorialContext = createContext<TutorialContextType | undefined>(undefined);

interface TutorialProviderProps {
  children: ReactNode;
}

export const TutorialProvider: React.FC<TutorialProviderProps> = ({ children }) => {
  const [showTutorial, setShowTutorial] = useState(false);

  return (
    <TutorialContext.Provider value={{ showTutorial, setShowTutorial }}>
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

