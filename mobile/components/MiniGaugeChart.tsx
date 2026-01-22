"use client"

import React, { memo, useMemo, useState } from "react"
import { View, Text, StyleSheet, Platform, useWindowDimensions, LayoutChangeEvent, Image, ImageSourcePropType } from "react-native"
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from "react-native-svg"
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons"
import { useTranslation } from "react-i18next"
import { useTheme } from "../contexts/ThemeContext"

type WidgetSize = "small" | "medium" | "large"

type StepsDetails = { current: number; goal: number; km?: number; calories?: number }
type HydrationDetails = {
  glasses: number; // 🔥 FIX: Ora contiene il valore in unità preferita (non sempre bicchieri)
  goal: number; // 🔥 FIX: Goal in unità preferita
  ml?: number;
  lastDrink?: string;
  preferredUnit?: 'glass' | 'bottle' | 'liter'; // 🆕 Unità preferita
  unitLabel?: string; // 🆕 Etichetta unità (es. "bicchiere", "bottiglia", "litro")
}
type MeditationDetails = { minutes: number; goal: number; sessions?: number; streak?: number; favoriteType?: string }
type CalorieDetails = { current: number; goal: number; carbs: number; protein: number; fat: number }

type AdditionalData =
  | { steps: StepsDetails }
  | { hydration: HydrationDetails }
  | { meditation: MeditationDetails }
  | { calories: CalorieDetails }

interface Props {
  value: number
  maxValue?: number
  label: string
  subtitle?: React.ReactNode
  color: string
  backgroundColor?: string  // Light bg color (rgba format)
  borderColor?: string      // Border color (rgba format)
  textColor?: string        // Darker text color
  trendValue?: string
  icon?: string
  iconImage?: ImageSourcePropType  // PNG icon from assets
  size?: WidgetSize
  additionalData?: AdditionalData
  // onPress e onLongPress gestiti da EditableWidget
}

const CARD_HEIGHT = 140

// 🔥 FIX: Fixed viewBox for consistent coordinates
const VB_SIZE = 50; // ViewBox size - all coordinates relative to this
const VB_CENTER = VB_SIZE / 2; // 25
const VB_RADIUS = 20; // Radius in viewBox units
const VB_STROKE = 4; // Stroke in viewBox units

const MiniGaugeChart: React.FC<Props> = memo(({
  value,
  maxValue = 100,
  label,
  subtitle,
  color,
  backgroundColor,
  borderColor,
  textColor,
  trendValue,
  icon,
  iconImage,
  size = "small",
  additionalData,
  // onPress e onLongPress gestiti da EditableWidget
}) => {
  const { colors, mode } = useTheme()
  const isDark = mode === 'dark'

  // 🔥 FIX: Dynamic sizing using useWindowDimensions
  const { width: windowWidth } = useWindowDimensions();

  // Compute effective background color with dark mode support
  const effectiveBgColor = useMemo(() => {
    if (!backgroundColor) return colors.surface
    if (isDark && backgroundColor.includes('rgba')) {
      return backgroundColor.replace(/[\d.]+\)$/, '0.15)')
    }
    return backgroundColor
  }, [backgroundColor, colors.surface, isDark])

  // Calculate dynamic gauge size based on screen width
  const getGaugeSize = (): number => {
    const baseSize = size === "medium" ? 70 : 54;
    // Scale down for narrow screens (<380px)
    const scale = Math.min(1, windowWidth / 400);
    return Math.max(36, Math.floor(baseSize * scale));
  };

  const gaugeSize = getGaugeSize();

  const pct = Math.max(0, Math.min(100, value))
  // Fixed viewBox calculations
  const circumference = 2 * Math.PI * VB_RADIUS;
  const progress = (pct / maxValue) * circumference;

  const getTrendColor = () => {
    if (!trendValue) return "#6b7280"
    if (trendValue.includes("+") || trendValue === "Good" || trendValue === "Excellent" || trendValue === "✓") return "#10b981"
    if (trendValue.includes("-") || trendValue === "!") return "#ef4444"
    return "#6b7280"
  }

  // Render icon - image or emoji
  // 🔥 FIX: Added localization
  const { t } = useTranslation();

  const detailChips = useMemo(() => {
    if (!additionalData) return []
    if ("steps" in additionalData) {
      const d = additionalData.steps
      const chips = [{ icon: "walk", label: t('home.widgets.steps'), value: `${d.current.toLocaleString()}` }]
      if (size === "large" && d.km) chips.push({ icon: "map-marker-distance", label: t('home.widgets.details.distance'), value: `${d.km.toFixed(1)} ${t('home.widgets.units.km')}` })
      if (size === "large" && d.calories) chips.push({ icon: "fire", label: t('home.widgets.details.calories'), value: `${d.calories}` })
      return chips
    }
    if ("hydration" in additionalData) {
      const d = additionalData.hydration
      // 🔥 FIX: Usa unità preferita e gestisci plurale
      const unitKey = d.preferredUnit || 'glass';
      const unitLabel = t(`home.widgets.units.${unitKey}`, { count: Math.ceil(d.glasses), defaultValue: d.unitLabel || "Glasses" });

      const chips = [{ icon: "cup-water", label: unitLabel, value: `${d.glasses}/${d.goal}` }]
      if (size === "large" && d.ml) chips.push({ icon: "water", label: t('home.widgets.details.volume'), value: `${d.ml} ml` })
      return chips
    }
    if ("meditation" in additionalData) {
      const d = additionalData.meditation
      const chips = [{ icon: "meditation", label: t('home.widgets.details.today'), value: `${d.minutes} ${t('home.widgets.units.min')}` }]
      if (size === "large" && d.sessions) chips.push({ icon: "calendar-check", label: t('home.widgets.details.sessions'), value: `${d.sessions}` })
      if (size === "large" && d.streak) chips.push({ icon: "fire", label: t('home.widgets.details.streak'), value: `${d.streak}${t('home.widgets.units.day')}` })
      return chips
    }
    if ("calories" in additionalData) {
      const d = additionalData.calories
      // For Large size, show only current calories. For Medium, show current/goal.
      const valueDisplay = size === "large" ? `${d.current}` : `${d.current}/${d.goal}`

      const chips = [{ icon: "fire", label: t('home.widgets.details.calories'), value: valueDisplay }]
      if (size === "large" || size === "medium") {
        chips.push({ icon: "barley", label: t('home.widgets.details.carbs'), value: `${d.carbs}g` })
        chips.push({ icon: "food-drumstick", label: t('home.widgets.details.protein'), value: `${d.protein}g` })
        // Only show fat if we have space (Large size usually fits 3 chips comfortably)
        if (size === "large") {
          chips.push({ icon: "oil", label: t('home.widgets.details.fat'), value: `${d.fat}g` })
        }
      }
      return chips
    }
    return []
  }, [additionalData, size, t])

  // Render icon - image or emoji
  const renderIcon = (emojiSize: number, imageStyle: any) => {
    if (iconImage) {
      return <Image source={iconImage} style={imageStyle} resizeMode="contain" />
    }
    return null
  }

  /** ========== SMALL ========== */
  const renderSmall = () => (
    <View style={[styles.innerContainer, { backgroundColor: effectiveBgColor }]}>
      {/* 1) Title Full Width at Top */}
      <View style={styles.smallTitleContainer}>
        <Text
          style={[styles.smallLabel, { color: colors.text }]}
          numberOfLines={1}
          ellipsizeMode="tail"
          allowFontScaling={false}
        >
          {label}
        </Text>
      </View>

      {/* 2) Gauge Centered */}
      <View style={styles.smallGaugeWrapper}>
        <Svg width={gaugeSize} height={gaugeSize} viewBox={`0 0 ${VB_SIZE} ${VB_SIZE}`}>
          <Defs>
            <SvgLinearGradient id={`grad-${color}-s`} x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={color} stopOpacity={0.7} />
              <Stop offset="100%" stopColor={color} stopOpacity={1} />
            </SvgLinearGradient>
          </Defs>
          <Circle cx={VB_CENTER} cy={VB_CENTER} r={VB_RADIUS} stroke="#e5e7eb" strokeWidth={VB_STROKE} fill="none" opacity={0.35} />
          <Circle cx={VB_CENTER} cy={VB_CENTER} r={VB_RADIUS} stroke={`url(#grad-${color}-s)`} strokeWidth={VB_STROKE} fill="none" strokeDasharray={`${progress}, ${circumference}`} strokeLinecap="round" transform={`rotate(-90 ${VB_CENTER} ${VB_CENTER})`} />
        </Svg>
        <View style={styles.gaugeCenterSmall} pointerEvents="none">
          {renderIcon(14, styles.gaugeIconSmall)}
        </View>
      </View>

      {/* 3) Subtitle/Value at Bottom */}
      <View style={styles.smallBottomContainer}>
        {subtitle && (
          <Text
            style={[styles.smallSubtitle, { color: colors.textSecondary }]}
            numberOfLines={1}
            allowFontScaling={false}
          >
            {subtitle}
          </Text>
        )}
      </View>
    </View>
  )

  /** ========== MEDIUM ========== */
  const renderMedium = () => (
    <View style={[styles.innerContainer, { backgroundColor: effectiveBgColor }]}>
      <View style={styles.mHeaderRow}>
        <View style={styles.mTitleWrap}>
          <Text
            style={[styles.mTitle, { color: colors.text }]}
            numberOfLines={1}
            ellipsizeMode="tail"
            allowFontScaling={false}
          >
            {label}
          </Text>
        </View>
      </View>

      <View style={styles.mContentRow}>
        <View style={styles.mGaugeBox}>
          <Svg width={gaugeSize} height={gaugeSize} viewBox={`0 0 ${VB_SIZE} ${VB_SIZE}`}>
            <Defs>
              <SvgLinearGradient id={`grad-${color}-m`} x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor={color} stopOpacity={0.75} />
                <Stop offset="100%" stopColor={color} stopOpacity={1} />
              </SvgLinearGradient>
            </Defs>
            <Circle cx={VB_CENTER} cy={VB_CENTER} r={VB_RADIUS} stroke="#e5e7eb" strokeWidth={VB_STROKE} fill="none" opacity={0.4} />
            <Circle cx={VB_CENTER} cy={VB_CENTER} r={VB_RADIUS} stroke={`url(#grad-${color}-m)`} strokeWidth={VB_STROKE} fill="none" strokeDasharray={`${progress}, ${circumference}`} strokeLinecap="round" transform={`rotate(-90 ${VB_CENTER} ${VB_CENTER})`} />
          </Svg>
          <View style={styles.mGaugeCenter} pointerEvents="none">
            {renderIcon(14, styles.mGaugeIconImage)}
          </View>
        </View>

        <View style={styles.mKpiCol}>
          {detailChips.length > 0 && (
            <View style={[styles.mDetailChip, { borderColor: `${color}20`, backgroundColor: `${color}08` }]}>
              <MaterialCommunityIcons name={detailChips[0].icon as any} size={14} color={color} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={[styles.mChipLabel, { color: colors.textSecondary }]}
                  numberOfLines={1}
                  allowFontScaling={false}
                >
                  {detailChips[0].label}
                </Text>
                <Text
                  style={[styles.mChipValue, { color }]}
                  numberOfLines={1}
                  allowFontScaling={false}
                >
                  {detailChips[0].value}
                </Text>
              </View>
            </View>
          )}
        </View>
      </View>
    </View>
  )

  /** ========== LARGE ========== */
  const renderLarge = () => (
    <View
      style={[
        styles.innerContainer,
        { backgroundColor: effectiveBgColor, borderWidth: 1, borderColor: `${color}1F` },
      ]}
    >
      {/* Header con titolo */}
      <View style={[styles.largeHeader, styles.lPadRight]}>
        <View style={styles.largeHeaderLeft}>
          <View style={[styles.largeIconChip, { backgroundColor: `${color}18`, borderColor: `${color}35` }]}>
            {renderIcon(19, styles.largeIconImage)}
          </View>
          <View style={styles.largeHeaderText}>
            <Text
              style={[styles.largeLabel, { color: colors.text }]}
              numberOfLines={1}
              allowFontScaling={false}
            >
              {label}
            </Text>
            {subtitle && (
              <Text
                style={styles.largeSubtitle}
                numberOfLines={1}
                allowFontScaling={false}
              >
                {subtitle}
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* Gauge fissato in alto a destra */}
      <View style={styles.lGaugeTopRight} pointerEvents="none">
        <Svg width={gaugeSize} height={gaugeSize} viewBox={`0 0 ${VB_SIZE} ${VB_SIZE}`}>
          <Defs>
            <SvgLinearGradient id={`grad-${color}-l`} x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={color} stopOpacity={0.8} />
              <Stop offset="100%" stopColor={color} stopOpacity={1} />
            </SvgLinearGradient>
          </Defs>
          <Circle cx={VB_CENTER} cy={VB_CENTER} r={VB_RADIUS} stroke="#e5e7eb" strokeWidth={VB_STROKE} fill="none" opacity={0.45} />
          <Circle cx={VB_CENTER} cy={VB_CENTER} r={VB_RADIUS} stroke={`url(#grad-${color}-l)`} strokeWidth={VB_STROKE} fill="none" strokeDasharray={`${progress}, ${circumference}`} strokeLinecap="round" transform={`rotate(-90 ${VB_CENTER} ${VB_CENTER})`} />
        </Svg>
        <View style={styles.gaugeCenterLarge} pointerEvents="none">
          {renderIcon(14, styles.gaugeIconSmall)}
        </View>
      </View>


      {/* Pillole info */}
      {detailChips.length > 0 && (
        <View style={styles.metricsRow}>
          {detailChips.map((chip) => (
            <View
              key={chip.label}
              style={[
                styles.metricItem,
                { borderColor: `${color}20`, backgroundColor: `${color}08` },
              ]}
            >
              <MaterialCommunityIcons name={chip.icon as any} size={15} color={color} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={[styles.metricLabel, { color: colors.textSecondary }]}
                  numberOfLines={1}
                  allowFontScaling={false}
                >
                  {chip.label}
                </Text>
                <Text
                  style={[styles.metricValue, { color }]}
                  numberOfLines={1}
                  allowFontScaling={false}
                >
                  {chip.value}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  )

  // TouchableOpacity rimosso - gestito da EditableWidget
  return (
    <View style={[styles.card, { backgroundColor: effectiveBgColor, borderColor: borderColor || (isDark ? 'rgba(255,255,255,0.08)' : colors.border) }]}>
      {size === "small" ? renderSmall() : size === "medium" ? renderMedium() : renderLarge()}
    </View>
  )
})

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    height: CARD_HEIGHT,
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.06)",
  },
  innerContainer: { flex: 1, borderRadius: 18, padding: 13 },

  /* SMALL */
  /* SMALL - Refined Vertical Layout */
  smallTitleContainer: {
    width: '100%',
    marginBottom: 4,
  },
  smallLabel: {
    fontSize: 18,
    fontFamily: 'Figtree_700Bold',
    // fontWeight: "800",
    color: "#111827",
    letterSpacing: -0.1,
  },

  smallGaugeWrapper: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  gaugeCenterSmall: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  gaugeIconSmall: { width: 38, height: 38 },

  smallBottomContainer: {
    marginTop: 4,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  smallSubtitle: {
    fontSize: 15, // Slightly larger for readability
    color: "#475569",
    fontFamily: 'Figtree_500Medium',
    // fontWeight: "700",
    lineHeight: 14,
  },

  /* MEDIUM */
  mHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  mTitleWrap: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1, minWidth: 0 },
  mIconChip: { height: 36, width: 36, borderRadius: 18, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  mIconEmoji: { fontSize: 18 },
  mIconImage: { width: 40, height: 40 },
  mGaugeIconImage: { width: 50, height: 50 },
  mTitle: { flexShrink: 1, fontSize: 18, fontFamily: 'Figtree_700Bold', color: "#0f172a" },
  mContentRow: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  mGaugeBox: { width: 74, height: 74, justifyContent: "center", alignItems: "center", position: "relative" },
  mGaugeCenter: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  mKpiCol: { flex: 1, minWidth: 0, justifyContent: "center" },
  mKpiTitle: { fontSize: 12, fontFamily: 'Figtree_500Medium', color: "#475569" },
  mDetailChip: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, borderWidth: 1 },
  mChipLabel: { fontSize: 14, fontFamily: 'Figtree_500Medium' },
  mChipValue: { fontSize: 18, fontFamily: 'Figtree_700Bold' },
  mSpacer4: { height: 4 },

  /* LARGE (gauge top-right + chips più in alto) */
  lPadRight: { paddingRight: 75 },               // spazio per il gauge in alto a destra
  lGaugeTopRight: { position: "absolute", top: 12, right: 12, alignItems: "center", justifyContent: "center" },

  largeHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6, gap: 8 },
  largeHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 },
  largeHeaderText: { flex: 1, minWidth: 0 },
  largeIconChip: { width: 48, height: 48, borderRadius: 24, borderWidth: 1.5, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  largeIconEmoji: { fontSize: 22 },
  largeIconImage: { width: 48, height: 48 },
  largeLabel: { fontSize: 18, fontFamily: 'Figtree_700Bold', letterSpacing: -0.2 }, // Increased size
  largeSubtitle: { marginTop: 2, fontSize: 15, color: "#6b7280", fontFamily: 'Figtree_500Medium' },

  largeBody: { flexDirection: "row", alignItems: "center", flex: 1, gap: 12 },
  gaugeCenterLarge: { position: "absolute", alignItems: "center", justifyContent: "center" },

  metricsRow: {
    marginTop: "auto",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  metricItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    flex: 1,
    minWidth: 90,
    maxWidth: "32%",
  },
  metricLabel: { fontSize: 14, fontFamily: 'Figtree_500Medium', color: "#64748b" },
  metricValue: { fontSize: 15, fontFamily: 'Figtree_700Bold', letterSpacing: -0.2 },
})

export default MiniGaugeChart