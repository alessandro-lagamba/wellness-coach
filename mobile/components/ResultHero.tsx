import React from 'react';
import { View, Text, StyleSheet, Image, Dimensions, Platform, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';

const { width } = Dimensions.get('window');

interface ResultHeroProps {
    title: string;
    subtitle: string;
    score?: number;
    color?: string;
    imageUri?: any;
    style?: any;
}

export const ResultHero: React.FC<ResultHeroProps> = ({
    title,
    subtitle,
    score,
    color = '#3b82f6',
    imageUri,
    style,
}) => {
    const { mode, colors } = useTheme();
    const insets = useSafeAreaInsets();
    const isDark = mode === 'dark';

    // Helper to convert hex to rgba
    const hexToRgba = (hex: string, alpha: number): string => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    // 🔥 FIX: Altezza ridotta su iOS, considera insets.top solo per il padding interno
    const heroHeight = Platform.OS === 'ios' ? 240 : 280;

    return (
        <View style={[styles.container, { height: heroHeight + insets.top, paddingTop: insets.top }, style]}>
            {imageUri ? (
                <Image source={imageUri} style={styles.image} resizeMode="cover" />
            ) : (
                // 🔥 FIX: Gradiente che sfuma verso trasparente in alto per fondersi con qualsiasi sfondo
                <LinearGradient
                    colors={['transparent', hexToRgba(color, 0.2), hexToRgba(color, 0.5), color]}
                    locations={[0, 0.3, 0.6, 1]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={styles.gradient}
                />
            )}

            {/* Premium Overlay Gradient - sfuma verso il basso */}
            <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.6)']}
                locations={[0, 0.5, 1]}
                style={styles.overlay}
            />

            <View style={[styles.content, { bottom: Platform.OS === 'ios' ? 30 : 50 }]}>
                <BlurView intensity={40} tint="dark" style={styles.scoreContainer}>
                    {score !== undefined ? (
                        <Text style={styles.score} allowFontScaling={false}>{score}</Text>
                    ) : (
                        <View style={[styles.scorePlaceholder, { backgroundColor: color }]} />
                    )}
                </BlurView>
                <View style={styles.textContainer}>
                    <Text style={styles.subtitle} allowFontScaling={false}>{subtitle}</Text>
                    <Text style={styles.title} allowFontScaling={false}>{title}</Text>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: width,
        backgroundColor: 'transparent', // 🔥 FIX: Trasparente per fondersi con lo sfondo
        overflow: 'hidden',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    gradient: {
        width: '100%',
        height: '100%',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
    },
    content: {
        position: 'absolute',
        bottom: 50,
        left: 24,
        right: 24,
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 20,
    },
    scoreContainer: {
        width: 88,
        height: 88,
        borderRadius: 44,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    score: {
        fontSize: 36,
        fontFamily: 'Figtree_700Bold', // Was 800
        color: '#fff',
        letterSpacing: -1,
    },
    scorePlaceholder: {
        width: 44,
        height: 44,
        borderRadius: 22,
    },
    textContainer: {
        flex: 1,
        paddingBottom: 6,
    },
    subtitle: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.9)',
        marginBottom: 6,
        textTransform: 'uppercase',
        letterSpacing: 1.5,
        fontFamily: 'Figtree_700Bold', // Was 600
        textShadowColor: 'rgba(0,0,0,0.3)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    title: {
        fontSize: 32,
        fontFamily: 'Figtree_700Bold', // Was 800
        color: '#fff',
        letterSpacing: -0.5,
        textShadowColor: 'rgba(0,0,0,0.3)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },
});
