import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Image,
    TouchableOpacity,
    Dimensions,
    Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

const { width } = Dimensions.get('window');

const GlowBackground = ({ size = 300, color = '#a855f7', opacity = 0.4 }) => (
    <View style={[styles.glowContainer, { width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2 }]}>
        <Svg height="100%" width="100%">
            <Defs>
                <RadialGradient id="glowGrad" cx="50%" cy="50%" rx="50%" ry="50%">
                    <Stop offset="0%" stopColor={color} stopOpacity={opacity} />
                    <Stop offset="50%" stopColor={color} stopOpacity={opacity * 0.4} />
                    <Stop offset="100%" stopColor={color} stopOpacity="0" />
                </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#glowGrad)" />
        </Svg>
    </View>
);

export default function YachaiInfo() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { colors, mode } = useTheme();
    const { t } = useTranslation();
    const isDark = mode === 'dark';

    const sections = [
        {
            title: t('yachaiInfo.integration.health.title'),
            content: t('yachaiInfo.integration.health.content'),
            image: require('../assets/images/yachai-variants/stretching.png'),
        },
        {
            title: t('yachaiInfo.integration.emotions.title'),
            content: t('yachaiInfo.integration.emotions.content'),
            image: require('../assets/images/yachai-variants/in-love.png'),
        },
        {
            title: t('yachaiInfo.integration.skin.title'),
            content: t('yachaiInfo.integration.skin.content'),
            image: require('../assets/images/yachai-variants/upsidedown.png'),
        },
        {
            title: t('yachaiInfo.integration.food.title'),
            content: t('yachaiInfo.integration.food.content'),
            image: require('../assets/images/yachai-variants/one-leg.png'),
        },
        {
            title: t('yachaiInfo.integration.diary.title'),
            content: t('yachaiInfo.integration.diary.content'),
            image: require('../assets/images/yachai-variants/idea.png'),
        },
    ];

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <LinearGradient
                colors={isDark ? ['#1a1625', '#2d2438'] : ['#f8fafc', '#f1f5f9']}
                style={StyleSheet.absoluteFill}
            />

            <View style={[styles.header, { top: insets.top + (Platform.OS === 'ios' ? 0 : 10) }]}>
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={[styles.backButton, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }]}
                >
                    <Ionicons name="chevron-back" size={28} color={colors.text} />
                </TouchableOpacity>
            </View>

            <ScrollView
                contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 60 }]}
                showsVerticalScrollIndicator={false}
            >
                {/* Hero Section */}
                <View style={styles.heroSection}>
                    <View style={styles.heroImageContainer}>
                        <GlowBackground
                            size={width * 1.0}
                            color={isDark ? colors.primary : colors.primaryLight}
                            opacity={isDark ? 0.45 : 0.65}
                        />
                        <Image
                            source={require('../assets/images/yachai-variants/meditating.png')}
                            style={styles.heroImage}
                            resizeMode="contain"
                        />
                    </View>
                    <Text style={[styles.title, { color: colors.text }]} allowFontScaling={false}>
                        {t('yachaiInfo.hero.title')}
                    </Text>
                    <Text style={[styles.subtitle, { color: colors.textSecondary }]} allowFontScaling={false}>
                        {t('yachaiInfo.hero.subtitle').split('Yachai').map((part, i, arr) => (
                            <React.Fragment key={i}>
                                {part}
                                {i < arr.length - 1 && (
                                    <Text style={{ color: colors.primary, fontFamily: 'Figtree_700Bold' }} allowFontScaling={false}>Yachai</Text>
                                )}
                            </React.Fragment>
                        ))}
                    </Text>
                </View>

                {/* Meaning Section */}
                <View style={[styles.card, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.cardTitle, { color: colors.primary, marginBottom: 12 }]} allowFontScaling={false}>
                        {t('yachaiInfo.meaning.title')}
                    </Text>
                    <Text style={[styles.cardText, { color: colors.textSecondary }]} allowFontScaling={false}>
                        {t('yachaiInfo.meaning.definition').split(/(quechua)/i).map((part, i) => (
                            part.toLowerCase() === 'quechua' ? (
                                <Text key={i} style={[styles.italicHighlight, { color: colors.text, fontWeight: 'bold' }]} allowFontScaling={false}>
                                    {part}
                                </Text>
                            ) : (
                                part
                            )
                        ))}
                        {"\n\n"}
                        {t('yachaiInfo.meaning.description')}
                    </Text>
                    <Text style={[styles.cardText, { color: colors.textSecondary, marginBottom: 0 }]} allowFontScaling={false}>
                        {t('yachaiInfo.meaning.philosophy').split('intelligenza integrata').map((part, i, arr) => (
                            <React.Fragment key={i}>
                                {part}
                                {i < arr.length - 1 && (
                                    <Text style={{ color: colors.text, fontFamily: 'Figtree_700Bold' }} allowFontScaling={false}>intelligenza integrata</Text>
                                )}
                            </React.Fragment>
                        ))}
                    </Text>
                </View>

                {/* AI Section */}
                <View style={[styles.card, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.cardTitle, { color: isDark ? '#fff' : '#000', fontSize: 22, marginBottom: 12 }]} allowFontScaling={false}>
                        {t('yachaiInfo.ai.title')}
                    </Text>
                    <Text style={[styles.cardText, { color: colors.textSecondary, marginBottom: 0 }]} allowFontScaling={false}>
                        {t('yachaiInfo.ai.description').split(/(osservare|comprendere e interpretare)/i).map((part, i) => (
                            (part.toLowerCase() === 'osservare' || part.toLowerCase() === 'comprendere e interpretare') ? (
                                <Text key={i} style={{ fontFamily: 'Figtree_700Bold', color: colors.text }} allowFontScaling={false}>{part}</Text>
                            ) : (
                                part
                            )
                        ))}
                    </Text>
                </View>

                {/* Concept Section */}
                <View style={styles.conceptSection}>
                    <Text style={[styles.sectionTitle, { color: colors.primary }]} allowFontScaling={false}>
                        {t('yachaiInfo.concept.title')}
                    </Text>
                    <Text style={[styles.conceptText, { color: colors.textSecondary }]} allowFontScaling={false}>
                        {t('yachaiInfo.concept.description').split(t('yachaiInfo.concept.highlight')).map((part, i, arr) => (
                            <React.Fragment key={i}>
                                {part}
                                {i < arr.length - 1 && (
                                    <Text style={{ color: colors.text, fontFamily: 'Figtree_700Bold' }} allowFontScaling={false}>
                                        {t('yachaiInfo.concept.highlight')}
                                    </Text>
                                )}
                            </React.Fragment>
                        ))}
                    </Text>
                </View>

                {/* Integration Grid */}
                <View style={styles.grid}>
                    <Text style={[styles.gridTitle, { color: colors.text }]} allowFontScaling={false}>
                        {t('yachaiInfo.integration.title')}
                    </Text>
                    {sections.map((item, index) => (
                        <View
                            key={index}
                            style={[
                                styles.gridItem,
                                {
                                    backgroundColor: colors.surface,
                                },
                                !isDark && styles.gridItemShadow
                            ]}
                        >
                            <View style={[styles.gridImageContainer, { backgroundColor: isDark ? 'rgba(168, 85, 247, 0.1)' : 'rgba(99, 102, 241, 0.08)' }]}>
                                <Image source={item.image} style={styles.gridImage} resizeMode="contain" />
                            </View>
                            <View style={styles.gridTextContent}>
                                <View style={styles.gridHeader}>
                                    <Text style={[styles.gridItemTitle, { color: colors.text }]} allowFontScaling={false}>{item.title}</Text>
                                </View>
                                <Text style={[styles.gridItemText, { color: colors.textSecondary }]} allowFontScaling={false}>{item.content}</Text>
                            </View>
                        </View>
                    ))}
                </View>

                {/* Footer Philosophy */}
                <View style={styles.footer}>
                    <View style={styles.footerImageContainer}>
                        <GlowBackground
                            size={width * 0.8}
                            color={isDark ? colors.primary : colors.primaryLight}
                            opacity={isDark ? 0.45 : 0.65}
                        />
                        <Image
                            source={require('../assets/images/yachai-variants/t-pose.png')}
                            style={styles.footerImage}
                            resizeMode="contain"
                        />
                    </View>
                    <View style={[styles.philosophyBox, {
                        backgroundColor: isDark ? 'rgba(168, 85, 247, 0.05)' : 'rgba(99, 102, 241, 0.03)',
                    }]}>
                        <Text style={[styles.philosophyText, { color: colors.textSecondary }]} allowFontScaling={false}>
                            {t('yachaiInfo.footer.philosophy1')}
                        </Text>
                        <Text style={[styles.italic, { color: colors.text }]} allowFontScaling={false}>
                            {t('yachaiInfo.footer.italic1')}
                        </Text>

                        <View style={styles.philosophySeparator} />

                        <Text style={[styles.philosophyText, { color: colors.textSecondary }]} allowFontScaling={false}>
                            {t('yachaiInfo.footer.philosophy2')}
                        </Text>
                        <Text style={[styles.italic, { color: colors.text }]} allowFontScaling={false}>
                            {t('yachaiInfo.footer.italic2')}
                        </Text>

                        <View style={styles.philosophySeparator} />

                        <Text style={[styles.philosophyText, styles.lastPhilosophy, { color: colors.text }]} allowFontScaling={false}>
                            {t('yachaiInfo.footer.last')}
                        </Text>
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        position: 'absolute',
        left: 16,
        zIndex: 10,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    glowContainer: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        zIndex: -1,
    },
    heroSection: {
        alignItems: 'center',
        marginTop: 0,
        marginBottom: 30,
        position: 'relative',
        overflow: 'visible',
    },
    heroImageContainer: {
        width: width * 0.6,
        height: width * 0.6,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
        position: 'relative',
        overflow: 'visible',
    },
    heroImage: {
        width: '100%',
        height: '100%',
    },
    title: {
        fontSize: 42,
        fontFamily: 'Figtree_700Bold',
        letterSpacing: -1,
    },
    subtitle: {
        fontSize: 18,
        fontFamily: 'Figtree_500Medium',
        textAlign: 'center',
        marginTop: 8,
        lineHeight: 26,
        paddingHorizontal: 10,
    },
    card: {
        borderRadius: 40,
        paddingHorizontal: 28,
        paddingVertical: 22,
        marginBottom: 20,
    },
    cardTitle: {
        fontSize: 24,
        fontFamily: 'Figtree_700Bold',
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    cardText: {
        fontSize: 18,
        fontFamily: 'Figtree_500Medium',
        lineHeight: 26,
        marginBottom: 12,
        textAlign: 'justify',
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    conceptSection: {
        marginTop: 20,
        marginBottom: 30,
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingTop: 10,
    },
    sectionTitle: {
        fontSize: 32,
        fontFamily: 'Figtree_700Bold',
        marginBottom: 12,
        textAlign: 'center',
    },
    conceptText: {
        fontSize: 18,
        fontFamily: 'Figtree_500Medium',
        textAlign: 'center',
        lineHeight: 28,
    },
    grid: {
        marginBottom: 30,
    },
    gridTitle: {
        fontSize: 22,
        fontFamily: 'Figtree_700Bold',
        marginBottom: 20,
        marginLeft: 4,
    },
    gridItem: {
        flexDirection: 'row',
        borderRadius: 35,
        paddingHorizontal: 24,
        paddingVertical: 14,
        marginBottom: 16,
        alignItems: 'center',
    },
    gridItemShadow: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 4,
    },
    gridImageContainer: {
        width: 80,
        height: 80,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 20,
    },
    gridImage: {
        width: 60,
        height: 60,
    },
    gridTextContent: {
        flex: 1,
    },
    gridHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    gridItemTitle: {
        fontSize: 20,
        fontFamily: 'Figtree_700Bold',
        marginBottom: 2,
    },
    gridItemText: {
        fontSize: 15.5,
        fontFamily: 'Figtree_500Medium',
        lineHeight: 20,
    },
    footer: {
        alignItems: 'center',
        marginTop: 20,
    },
    footerImageContainer: {
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
        width: 200,
        height: 180,
        marginBottom: 10,
        overflow: 'visible',
    },
    footerImage: {
        width: 160,
        height: 160,
        zIndex: 1,
    },
    philosophyBox: {
        borderRadius: 40,
        padding: 30,
        width: '100%',
    },
    philosophyText: {
        fontSize: 18,
        fontFamily: 'Figtree_500Medium',
        textAlign: 'center',
        lineHeight: 26,
    },
    italic: {
        fontFamily: 'PlayfairDisplay_600SemiBold_Italic',
        fontSize: 18,
        textAlign: 'center',
        lineHeight: 28,
    },
    italicHighlight: {
        fontFamily: 'PlayfairDisplay_600SemiBold_Italic',
        fontSize: 18,
    },
    philosophySeparator: {
        height: 24,
    },
    lastPhilosophy: {
        marginTop: 0,
        fontFamily: 'Figtree_700Bold',
        marginBottom: 0,
    },
});
