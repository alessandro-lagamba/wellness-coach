import React from 'react';
import { Stack } from 'expo-router';
import { ChatOnlyScreen } from '../components/ChatOnlyScreen';
import { AuthService } from '../services/auth.service';
import { useEffect, useState } from 'react';
import { View, StyleSheet, useColorScheme } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

export default function ChatRoute() {
    const [user, setUser] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const { colors } = useTheme();
    const systemColorScheme = useColorScheme();
    const fallbackBackground = systemColorScheme === 'dark' ? '#1a1625' : '#f8fafc';
    const backgroundColor = colors?.background || fallbackBackground;

    useEffect(() => {
        const getCurrentUser = async () => {
            const currentUser = await AuthService.getCurrentUser();
            setUser(currentUser);
            setIsLoading(false);
        };
        getCurrentUser();

        const { data: { subscription } } = AuthService.onAuthStateChange((event, session) => {
            setUser(session?.user || null);
        });

        return () => subscription.unsubscribe();
    }, []);

    if (isLoading) {
        return <View style={[styles.loadingContainer, { backgroundColor }]} />;
    }

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <ChatOnlyScreen user={user} />
        </>
    );
}

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
    },
});
