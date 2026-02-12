import { useEffect, useRef } from 'react';
import { useScrollToTop as useScrollToTopContext } from '../contexts/ScrollToTopContext';

/**
 * Hook per registrare automaticamente uno ScrollView/FlatList per scroll-to-top.
 * 
 * @param screenName Nome univoco della schermata (es: 'home', 'settings')
 * @returns Ref da assegnare allo ScrollView/FlatList
 * 
 * @example
 * ```tsx
 * const scrollRef = useAutoScrollToTop('settings');
 * return <ScrollView ref={scrollRef}>...</ScrollView>
 * ```
 */
export function useAutoScrollToTop<T = any>(screenName: string) {
    const scrollRef = useRef<T>(null);
    const { registerScrollView, unregisterScrollView } = useScrollToTopContext();

    useEffect(() => {
        console.log(`[useAutoScrollToTop] Registering ${screenName}`);
        registerScrollView(screenName, scrollRef as any);

        return () => {
            console.log(`[useAutoScrollToTop] Unregistering ${screenName}`);
            unregisterScrollView(screenName);
        };
    }, [screenName, registerScrollView, unregisterScrollView]);

    return scrollRef;
}
