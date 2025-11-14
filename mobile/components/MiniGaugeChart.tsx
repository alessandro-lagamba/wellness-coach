"use client"

import React, { memo, useMemo } from "react"
import { View, Text, StyleSheet, Platform } from "react-native"
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from "react-native-svg"
import { LinearGradient } from "expo-linear-gradient"
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons"
import { useTheme } from "../contexts/ThemeContext"

type WidgetSize = "small" | "medium" | "large"

type StepsDetails = { current: number; goal: number; km?: number; calories?: number }
type HydrationDetails = { glasses: number; goal: number; ml?: number; lastDrink?: string }
type MeditationDetails = { minutes: number; goal: number; sessions?: number; streak?: number; favoriteType?: string }

type AdditionalData =
  | { steps: StepsDetails }
  | { hydration: HydrationDetails }
  | { meditation: MeditationDetails }

interface Props {
  value: number
  maxValue?: number
  label: string
  subtitle?: string
  color: string
  backgroundColor?: string
  trendValue?: string
  icon?: string
  size?: WidgetSize
  additionalData?: AdditionalData
  // onPress e onLongPress gestiti da EditableWidget
}

const CARD_HEIGHT = 140

const GAUGE_SIZES: Record<WidgetSize, number> = { small: 52, medium: 70, large: 82 }

const MiniGaugeChart: React.FC<Props> = memo(({
  value,
  maxValue = 100,
  label,
  subtitle,
  color,
  backgroundColor = "#ffffff",
  trendValue,
  icon,
  size = "small",
  additionalData,
  // onPress e onLongPress gestiti da EditableWidget
}) => {
  const { colors } = useTheme()
  const pct = Math.max(0, Math.min(100, value))
  const gaugeSize = GAUGE_SIZES[size]
  const stroke = size === "small" ? 5 : size === "medium" ? 5.5 : 6
  const R = (gaugeSize - stroke) / 2
  const C = 2 * Math.PI * R
  const progress = (pct / maxValue) * C

  const getTrendColor = () => {
    if (!trendValue) return "#6b7280"
    if (trendValue.includes("+") || trendValue === "Good" || trendValue === "Excellent" || trendValue === "✓") return "#10b981"
    if (trendValue.includes("-") || trendValue === "!") return "#ef4444"
    return "#6b7280"
  }

  // Rimossa la funzione descriptor - non più necessaria

  const detailChips = useMemo(() => {
    if (!additionalData) return []
    if ("steps" in additionalData) {
      const d = additionalData.steps
      const chips = [{ icon: "walk", label: "Steps", value: `${d.current.toLocaleString()}` }]
      if (size === "large" && d.km) chips.push({ icon: "map-marker-distance", label: "Distance", value: `${d.km.toFixed(1)} km` })
      if (size === "large" && d.calories) chips.push({ icon: "fire", label: "Calories", value: `${d.calories}` })
      return chips
    }
    if ("hydration" in additionalData) {
      const d = additionalData.hydration
      const chips = [{ icon: "cup-water", label: "Glasses", value: `${d.glasses}/${d.goal}` }]
      if (size === "large" && d.ml) chips.push({ icon: "water", label: "Volume", value: `${d.ml} ml` })
      return chips
    }
    if ("meditation" in additionalData) {
      const d = additionalData.meditation
      const chips = [{ icon: "meditation", label: "Today", value: `${d.minutes} min` }]
      if (size === "large" && d.sessions) chips.push({ icon: "calendar-check", label: "Sessions", value: `${d.sessions}` })
      if (size === "large" && d.streak) chips.push({ icon: "fire", label: "Streak", value: `${d.streak}d` })
      return chips
    }
    return []
  }, [additionalData, size])

  /** ========== SMALL (immutata) ========== */
  const renderSmall = () => (
    <LinearGradient colors={[colors.surface, colors.surface]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.innerGradient}>
      <View style={styles.smallHeader}>
        <Text style={[styles.smallLabel, { color: colors.text }]} numberOfLines={1}>{label}</Text>
      </View>

      <View style={styles.smallContent}>
        <View style={styles.smallNumberSection}>
          {subtitle && <Text style={[styles.smallSubtitle, { color: colors.textSecondary }]} numberOfLines={2}>{subtitle}</Text>}
        </View>

        <View style={styles.smallGaugeWrapper}>
          <Svg width={gaugeSize} height={gaugeSize} viewBox={`0 0 ${gaugeSize} ${gaugeSize}`}>
            <Defs>
              <SvgLinearGradient id={`grad-${color}-s`} x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor={color} stopOpacity={0.7} />
                <Stop offset="100%" stopColor={color} stopOpacity={1} />
              </SvgLinearGradient>
            </Defs>
            <Circle cx={gaugeSize / 2} cy={gaugeSize / 2} r={R} stroke="#e5e7eb" strokeWidth={stroke} fill="none" opacity={0.35} />
            <Circle cx={gaugeSize / 2} cy={gaugeSize / 2} r={R} stroke={`url(#grad-${color}-s)`} strokeWidth={stroke} fill="none" strokeDasharray={`${progress}, ${C}`} strokeLinecap="round" transform={`rotate(-90 ${gaugeSize / 2} ${gaugeSize / 2})`} />
          </Svg>
          <View style={styles.gaugeCenterSmall} pointerEvents="none">
            <Text style={styles.gaugeEmojiSmall}>{icon ?? "📊"}</Text>
          </View>
        </View>
      </View>
    </LinearGradient>
  )

  /** ========== MEDIUM (immutata) ========== */
  const renderMedium = () => (
    <LinearGradient colors={[colors.surface, colors.surface]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.innerGradient}>
      <View style={styles.mHeaderRow}>
        <View style={styles.mTitleWrap}>
          <View style={[styles.mIconChip, { backgroundColor: `${color}15`, borderColor: `${color}32` }]}>
            <Text style={styles.mIconEmoji}>{icon ?? "📊"}</Text>
          </View>
          <Text style={[styles.mTitle, { color: colors.text }]} numberOfLines={1} ellipsizeMode="tail">{label}</Text>
        </View>
      </View>

      <View style={styles.mContentRow}>
        <View style={styles.mGaugeBox}>
          <Svg width={gaugeSize} height={gaugeSize} viewBox={`0 0 ${gaugeSize} ${gaugeSize}`}>
            <Defs>
              <SvgLinearGradient id={`grad-${color}-m`} x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor={color} stopOpacity={0.75} />
                <Stop offset="100%" stopColor={color} stopOpacity={1} />
              </SvgLinearGradient>
            </Defs>
            <Circle cx={gaugeSize / 2} cy={gaugeSize / 2} r={R} stroke="#e5e7eb" strokeWidth={stroke} fill="none" opacity={0.4} />
            <Circle cx={gaugeSize / 2} cy={gaugeSize / 2} r={R} stroke={`url(#grad-${color}-m)`} strokeWidth={stroke} fill="none" strokeDasharray={`${progress}, ${C}`} strokeLinecap="round" transform={`rotate(-90 ${gaugeSize / 2} ${gaugeSize / 2})`} />
          </Svg>
          <View style={styles.mGaugeCenter} pointerEvents="none">
            <Text style={styles.gaugeEmojiSmall}>{icon ?? "📊"}</Text>
          </View>
        </View>

        <View style={styles.mKpiCol}>
          {subtitle ? (<><Text style={[styles.mKpiTitle, { color: colors.textSecondary }]} numberOfLines={1}>{subtitle}</Text><View style={styles.mSpacer4} /></>) : null}
          {detailChips.length > 0 && (
            <View style={[styles.mDetailChip, { borderColor: `${color}22`, backgroundColor: colors.surfaceMuted }]}>
              <MaterialCommunityIcons name={detailChips[0].icon as any} size={14} color={color} />
              <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.mChipLabel, { color: colors.textSecondary }]} numberOfLines={1}>{detailChips[0].label}</Text>
                <Text style={[styles.mChipValue, { color }]} numberOfLines={1}>{detailChips[0].value}</Text>
              </View>
            </View>
          )}
        </View>
      </View>
    </LinearGradient>
  )

  /** ========== LARGE (toccata qui: gauge in alto a destra) ========== */
  const renderLarge = () => (
    <LinearGradient
      colors={[`${color}14`, colors.surface, `${color}06`]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      // padding destro extra per non sovrapporre il gauge al testo
      style={[styles.innerGradient, styles.lPadRight]}
    >
      {/* Header con titolo */}
      <View style={styles.largeHeader}>
        <View style={styles.largeHeaderLeft}>
          <View style={[styles.largeIconChip, { backgroundColor: `${color}18`, borderColor: `${color}35` }]}>
            <Text style={styles.largeIconEmoji}>{icon ?? "📊"}</Text>
          </View>
          <View style={styles.largeHeaderText}>
            <Text style={[styles.largeLabel, { color: colors.text }]} numberOfLines={1}>{label}</Text>
          </View>
        </View>
      </View>

      {/* Gauge fissato in alto a destra */}
      <View style={styles.lGaugeTopRight} pointerEvents="none">
        <Svg width={gaugeSize} height={gaugeSize} viewBox={`0 0 ${gaugeSize} ${gaugeSize}`}>
          <Defs>
            <SvgLinearGradient id={`grad-${color}-l`} x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={color} stopOpacity={0.8} />
              <Stop offset="100%" stopColor={color} stopOpacity={1} />
            </SvgLinearGradient>
          </Defs>
          <Circle cx={gaugeSize / 2} cy={gaugeSize / 2} r={R} stroke="#e5e7eb" strokeWidth={stroke} fill="none" opacity={0.45} />
          <Circle cx={gaugeSize / 2} cy={gaugeSize / 2} r={R} stroke={`url(#grad-${color}-l)`} strokeWidth={stroke} fill="none" strokeDasharray={`${progress}, ${C}`} strokeLinecap="round" transform={`rotate(-90 ${gaugeSize / 2} ${gaugeSize / 2})`} />
        </Svg>
        <View style={styles.gaugeCenterLarge} pointerEvents="none">
          <Text style={styles.gaugeEmojiSmall}>{icon ?? "📊"}</Text>
        </View>
      </View>

      {/* Corpo solo testuale (guadagna spazio in alto) */}
      <View style={[styles.largeBody, { marginBottom: 2 }]}>
        {subtitle && (
          <View style={styles.largeSubtitleBox}>
            <Text style={styles.largeSubtitle} numberOfLines={2}>{subtitle}</Text>
          </View>
        )}
      </View>

      {/* Pillole info un pelo più in alto */}
      {detailChips.length > 0 && (
        <View style={styles.largeChipsRowTighter}>
          {detailChips.map((chip) => (
            <View key={chip.label} style={[styles.largeDetailChip, { borderColor: `${color}25`, backgroundColor: colors.surfaceMuted }]}>
              <MaterialCommunityIcons name={chip.icon as any} size={15} color={color} />
              <View style={styles.largeChipTextContainer}>
                <Text style={[styles.largeChipLabel, { color: colors.textSecondary }]} numberOfLines={1}>{chip.label}</Text>
                <Text style={[styles.largeChipValue, { color }]} numberOfLines={1}>{chip.value}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </LinearGradient>
  )

  // TouchableOpacity rimosso - gestito da EditableWidget
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
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
    ...Platform.select({ ios: { shadowColor: "#000", shadowOpacity: 0.07, shadowOffset: { width: 0, height: 6 }, shadowRadius: 14 }, android: { elevation: 3 } }),
  },
  innerGradient: { flex: 1, borderRadius: 18, padding: 13 },

  /* SMALL */
  smallHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, paddingTop: 2 },
  smallLabel: { fontSize: 14, fontWeight: "700", color: "#111827", letterSpacing: -0.1, flex: 1 },
  smallContent: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  smallNumberSection: { flex: 1, justifyContent: "center" },
  smallSubtitle: { fontSize: 10, color: "#475569", fontWeight: "600", lineHeight: 14 },
  smallGaugeWrapper: { position: "relative", alignItems: "center", justifyContent: "center" },
  gaugeCenterSmall: { position: "absolute", alignItems: "center", justifyContent: "center" },
  gaugeEmojiSmall: { fontSize: 16, fontWeight: "400" },

  /* MEDIUM */
  mHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  mTitleWrap: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1, minWidth: 0 },
  mIconChip: { height: 28, width: 28, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  mIconEmoji: { fontSize: 16 },
  mTitle: { flexShrink: 1, fontSize: 15, fontWeight: "800", color: "#0f172a" },
  mContentRow: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  mGaugeBox: { width: 74, height: 74, justifyContent: "center", alignItems: "center" },
  mGaugeCenter: { position: "absolute", alignItems: "center", justifyContent: "center" },
  mKpiCol: { flex: 1, minWidth: 0, justifyContent: "center" },
  mKpiTitle: { fontSize: 12, fontWeight: "700", color: "#475569" },
  mDetailChip: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, borderWidth: 1 },
  mChipLabel: { fontSize: 10, fontWeight: "700" },
  mChipValue: { fontSize: 12, fontWeight: "900" },
  mSpacer4: { height: 4 },

  /* LARGE (gauge top-right + chips più in alto) */
  lPadRight: { paddingRight: 118 },               // spazio per il gauge in alto a destra
  lGaugeTopRight: { position: "absolute", top: 10, right: 10, alignItems: "center", justifyContent: "center" },

  largeHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6, gap: 8 },
  largeHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 },
  largeHeaderText: { flex: 1, minWidth: 0 },
  largeIconChip: { width: 42, height: 42, borderRadius: 21, borderWidth: 1.5, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  largeIconEmoji: { fontSize: 19 },
  largeLabel: { fontSize: 15, fontWeight: "700", letterSpacing: -0.2 },

  largeBody: { flexDirection: "row", alignItems: "center", flex: 1, gap: 12 },
  gaugeCenterLarge: { position: "absolute", alignItems: "center", justifyContent: "center" },

  largeSubtitleBox: { flex: 1, minWidth: 0 },
  largeSubtitle: { fontSize: 12.5, color: "#374151", fontWeight: "600", lineHeight: 16 },

  largeChipsRowTighter: { marginTop: 6, flexDirection: "row", flexWrap: "wrap", gap: 7 },
  largeDetailChip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, borderWidth: 1, gap: 8, flex: 1, minWidth: 90, maxWidth: "48%" },
  largeChipTextContainer: { flex: 1, minWidth: 0 },
  largeChipLabel: { fontSize: 10, color: "#64748b", fontWeight: "600" },
  largeChipValue: { fontSize: 12, fontWeight: "700", letterSpacing: -0.2 },
})

export default MiniGaugeChart