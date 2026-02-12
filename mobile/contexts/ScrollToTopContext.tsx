import React, { createContext, useContext, useRef, useCallback } from 'react';
import { ScrollView, FlatList } from 'react-native';

type ScrollableRef = React.RefObject<ScrollView> | React.RefObject<FlatList<any>> | React.RefObject<any>;

interface ScrollToTopContextType {
    registerScrollView: (screenName: string, ref: ScrollableRef) => void;
    unregisterScrollView: (screenName: string) => void;
    scrollToTop: (screenName: string) => void;
}

const ScrollToTopContext = createContext<ScrollToTopContextType | undefined>(undefined);

export const ScrollToTopProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const scrollRefsMap = useRef<Map<string, ScrollableRef>>(new Map());

    const registerScrollView = useCallback((screenName: string, ref: ScrollableRef) => {
        console.log('[ScrollToTopContext] Registering:', screenName);
        scrollRefsMap.current.set(screenName, ref);
    }, []);

    const unregisterScrollView = useCallback((screenName: string) => {
        console.log('[ScrollToTopContext] Unregistering:', screenName);
        scrollRefsMap.current.delete(screenName);
    }, []);

    const scrollToTop = useCallback((screenName: string) => {
        console.log('[ScrollToTopContext] scrollToTop called for:', screenName);
        const ref = scrollRefsMap.current.get(screenName);
        console.log('[ScrollToTopContext] Ref found:', !!ref?.current);

        if (ref?.current) {
            console.log('[ScrollToTopContext] Attempting to scroll to top...');
            // Try different scroll methods for different component types
            if ('scrollToOffset' in ref.current && typeof ref.current.scrollToOffset === 'function') {
                // FlatList/SectionList
                console.log('[ScrollToTopContext] Using scrollToOffset (FlatList)');
                ref.current.scrollToOffset({ offset: 0, animated: true });
            } else if ('scrollTo' in ref.current && typeof ref.current.scrollTo === 'function') {
                // ScrollView
                console.log('[ScrollToTopContext] Using scrollTo (ScrollView)');
                ref.current.scrollTo({ y: 0, animated: true });
            } else if ('scrollToLocation' in ref.current && typeof ref.current.scrollToLocation === 'function') {
                // SectionList specific
                console.log('[ScrollToTopContext] Using scrollToLocation (SectionList)');
                ref.current.scrollToLocation({ sectionIndex: 0, itemIndex: 0, animated: true });
            } else {
                console.warn('[ScrollToTopContext] Unknown scrollable type, trying scrollTo as fallback');
                try {
                    (ref.current as any).scrollTo?.({ y: 0, animated: true });
                } catch (e) {
                    console.error('[ScrollToTopContext] Failed to scroll:', e);
                }
            }
        } else {
            console.warn('[ScrollToTopContext] No ScrollView ref found for screen:', screenName);
        }
    }, []);

    return (
        <ScrollToTopContext.Provider value={{ registerScrollView, unregisterScrollView, scrollToTop }}>
            {children}
        </ScrollToTopContext.Provider>
    );
};

export const useScrollToTop = () => {
    const context = useContext(ScrollToTopContext);
    if (!context) {
        throw new Error('useScrollToTop must be used within a ScrollToTopProvider');
    }
    return context;
};
