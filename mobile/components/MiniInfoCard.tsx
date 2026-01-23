"use client"

import React, { useMemo } from "react"
import { View, Text, StyleSheet, Platform, Image, ImageSourcePropType } from "react-native"
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons"
import { useTheme } from "../contexts/ThemeContext"

type WidgetSize = "small" | "medium" | "large"

interface Props {
  label: string
  value: string
  subtitle?: string
  icon?: string                 // Deprecated: emoji fallback
  iconImage?: ImageSourcePropType // PNG icon from assets
  color: string                 // es. "#6366f1"
  backgroundColor?: string      // Light bg color (rgba format)
  borderColor?: string          // Border color (rgba format)
  textColor?: string            // Darker text color
  trendValue?: string           // es. "+5%", "Good", "!"
  size?: WidgetSize
  showStatus?: boolean
  status?: "pending" | "completed" | "warning"
  detailChips?: Array<{ icon: string; label: string; value: string }>
  // onPress e onLongPress gestiti da EditableWidget
}

const statusStyles = {
  pending: { bg: "#FEF3C7", text: "#92400E", border: "#FDE68A", icon: "clock-outline" },
  completed: { bg: "#DCFCE7", text: "#065F46", border: "#86EFAC", icon: "check-circle" },
  warning: { bg: "#FEE2E2", text: "#991B1B", border: "#FCA5A5", icon: "alert-circle" },
}

const CARD_HEIGHT = 140

// Helper: separa numero e unità (gestisce anche "Complete" ecc.)
const splitValue = (raw: string): { primary: string; unit: string } => {
  if (!raw) return { primary: "--", unit: "" }
  const m = raw.match(/^([+-]?\d+(?:[\.,]\d+)?)(.*)$/i)
  if (!m) return { primary: raw, unit: "" }
  return { primary: m[1].replace(",", "."), unit: m[2].trim() }
}

const MiniInfoCard: React.FC<Props> = ({
  label,
  value,
  subtitle,
  icon = "📊",
  iconImage,
  color,
  textColor,
  backgroundColor,
  borderColor,
  trendValue,
  size = "small",
  showStatus,
  status = "pending",
  detailChips,
  // onPress e onLongPress gestiti da EditableWidget
}) => {
  const st = statusStyles[status]
  const { colors, mode } = useTheme()
  const isDark = mode === 'dark'

  // Compute effective background color: use provided backgroundColor or fallback to surface
  const effectiveBgColor = useMemo(() => {
    if (!backgroundColor) return colors.surface
    // In dark mode, increase opacity slightly for better visibility
    if (isDark && backgroundColor.includes('rgba')) {
      return backgroundColor.replace(/[\d.]+\)$/, '0.15)')
    }
    return backgroundColor
  }, [backgroundColor, colors.surface, isDark])

  const getTrendColor = () => {
    if (!trendValue) return "#6b7280"
    if (trendValue === "Good" || trendValue === "Excellent" || trendValue === "✓" || trendValue.includes("+"))
      return "#10b981"
    if (trendValue.includes("-") || trendValue === "!") return "#ef4444"
    return "#6b7280"
  }

  // Rimossa la funzione descriptorText - non più necessaria

  const { primary, unit } = splitValue(value)

  /* ==================== RENDER SMALL ==================== */
  const renderSmall = () => (
    <View style={[styles.innerContainer, { backgroundColor: effectiveBgColor }]}>
      {/* 1) Title Full Width at Top */}
      <View style={styles.smallTitleContainer}>
        <Text
          style={[styles.smallLabel, { color: colors.text }]}
          numberOfLines={1}
          ellipsizeMode="tail"
          allowFontScaling={false}
          adjustsFontSizeToFit={true}
          minimumFontScale={0.7}
        >
          {label}
        </Text>
      </View>

      {/* 2) Icon Centered in remaining space */}
      <View style={styles.smallIconContainer}>
        {iconImage && (
          <Image source={iconImage} style={styles.smallIconImage} resizeMode="contain" />
        )}
      </View>

      {/* 3) Values at Bottom */}
      <View style={styles.smallBottomContainer}>
        <View style={styles.smallValueWrapper}>
          <Text
            style={[
              primary.toLowerCase() === "complete" ? styles.smallPrimaryValueComplete : styles.smallPrimaryValue,
              { color: textColor || color },
            ]}
            numberOfLines={1}
            allowFontScaling={false} // 🔒 Fixed font size
          >
            {primary}
          </Text>
          {!!unit && (
            <Text
              style={[styles.smallUnitText, { color: colors.textSecondary }]}
              allowFontScaling={false} // 🔒 Fixed font size
            >
              {unit}
            </Text>
          )}
        </View>

        {!!subtitle && (
          <Text
            style={[styles.smallSubtitle, { color: colors.textSecondary }]}
            numberOfLines={1}
            allowFontScaling={false} // 🔒 Fixed font size
          >
            {subtitle}
          </Text>
        )}
      </View>
    </View>
  )

  /* ==================== RENDER MEDIUM ==================== */
  const renderMedium = () => (
    <View style={[styles.innerContainer, styles.relative, { backgroundColor: effectiveBgColor }]}>
      <View style={styles.miHeaderRow}>
        <View style={styles.miTitleWrap}>
          <View style={[styles.miIconChip, { backgroundColor: `${color}15`, borderColor: `${color}32` }]}>
            {iconImage && (
              <Image source={iconImage} style={styles.miIconImage} resizeMode="contain" />
            )}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              style={[styles.miTitle, { color: colors.text }]}
              numberOfLines={1}
              ellipsizeMode="tail"
              allowFontScaling={false}
              adjustsFontSizeToFit={true}
              minimumFontScale={0.8}
            >
              {label}
            </Text>
          </View>
        </View>
        <Text
          numberOfLines={1}
          style={[styles.miValueTopRight, { color: textColor || color }]}
          allowFontScaling={false}
        >
          {value}
        </Text>
      </View>

      <View style={styles.miBodyRow}>
        <View style={{ flex: 1, minWidth: 0, paddingRight: 145 }}>
          {!!subtitle && (
            <Text
              numberOfLines={3}
              style={[styles.miSubtitle, { color: colors.textSecondary }]}
              allowFontScaling={false}
            >
              {subtitle}
            </Text>
          )}
        </View>
      </View>

      {detailChips?.length ? (
        <View style={[styles.miDetailChipFloat, { borderColor: `${color}20`, backgroundColor: `${color}08` }]}>
          <MaterialCommunityIcons name={detailChips[0].icon as any} size={14} color={color} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              style={[styles.miChipLabel, { color: colors.textSecondary }]}
              numberOfLines={1}
              allowFontScaling={false}
            >
              {detailChips[0].label}
            </Text>
            <Text
              style={[styles.miChipValue, { color }]}
              numberOfLines={1}
              allowFontScaling={false}
            >
              {detailChips[0].value}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  )

  /* ==================== RENDER LARGE ==================== */
  const renderLarge = () => (
    <View
      style={
        [
          styles.innerContainer,
          {
            backgroundColor: effectiveBgColor,
            borderColor: `${color}1F`,
            borderWidth: 1,
          },
        ]}
    >
      <View style={styles.largeHeader}>
        <View style={styles.largeHeaderLeft}>
          <View style={[styles.largeIconChip, { backgroundColor: `${color}18`, borderColor: `${color}35` }]}>
            {iconImage && (
              <Image source={iconImage} style={styles.largeIconImage} resizeMode="contain" />
            )}
          </View>
          <View style={styles.largeHeaderText}>
            <Text
              style={[styles.largeLabel, { color: colors.text }]}
              numberOfLines={1}
              allowFontScaling={false}
              adjustsFontSizeToFit={true}
              minimumFontScale={0.8}
            >
              {label}
            </Text>
            {!!subtitle && (
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
        <Text
          style={[styles.largeValue, { color: textColor || color }]}
          numberOfLines={1}
          allowFontScaling={false}
        >
          {value}
        </Text>
      </View>

      <View style={{ flex: 1 }} />

      {
        !!detailChips?.length && (
          <View style={styles.largeChipsRow}>
            {/* 🔥 FIX: Mostra solo max 2 chips per migliorare leggibilità */}
            {detailChips.slice(0, 2).map((chip) => (
              <View key={`${chip.label}-${chip.value}`} style={[styles.largeDetailChip, { borderColor: `${color}20`, backgroundColor: `${color}08` }]}>
                <MaterialCommunityIcons name={chip.icon as any} size={18} color={color} />
                <View style={styles.largeChipTextContainer}>
                  <Text
                    style={[styles.largeChipLabel, { color: colors.textSecondary }]}
                    numberOfLines={1}
                    allowFontScaling={false}
                  >
                    {chip.label}
                  </Text>
                  <Text
                    style={[styles.largeChipValue, { color }]}
                    numberOfLines={1}
                    allowFontScaling={false}
                  >
                    {chip.value}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )
      }
    </View >
  )

  // TouchableOpacity rimosso - gestito da EditableWidget
  return (
    <View style={[styles.card, { backgroundColor: effectiveBgColor, borderColor: borderColor || (isDark ? 'rgba(255,255,255,0.08)' : colors.border) }]}>
      {size === "small" ? renderSmall() : size === "medium" ? renderMedium() : renderLarge()}
    </View>
  )
}

const styles = StyleSheet.create({
  /* Card */
  card: {
    height: CARD_HEIGHT,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.06)",
  },
  innerContainer: { flex: 1, borderRadius: 18, padding: 13 },
  relative: { position: "relative" },

  /* ========== SMALL (Refined Layout) ========== */
  smallTitleContainer: {
    width: '100%',
    marginBottom: 4,
  },
  smallLabel: {
    fontSize: 16, // Fixed size
    fontFamily: 'Figtree_700Bold',
    // fontWeight: "800",
    color: "#111827",
    letterSpacing: -0.1,
  },

  smallIconContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    // marginVertical: 4, // Optional spacing
  },
  smallIconImage: {
    width: 42,
    height: 42,
  },

  smallBottomContainer: {
    justifyContent: "flex-end",
    // minHeight: 40,
  },
  smallValueWrapper: {
    flexDirection: "row",
    alignItems: "baseline", // Align number and unit
  },

  smallPrimaryValue: {
    fontSize: 20, // Slightly bigger
    lineHeight: 24,
    fontFamily: 'Figtree_700Bold',
    // fontWeight: "800",
    letterSpacing: -0.5,
  },
  smallPrimaryValueComplete: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Figtree_700Bold',
    // fontWeight: "700",
    letterSpacing: -0.2,
  },

  smallUnitText: {
    marginLeft: 4,
    fontSize: 14,
    letterSpacing: -0.2,
    fontFamily: 'Figtree_500Medium',
    // fontWeight: "600",
    color: "#64748b",
  },
  smallSubtitle: {
    marginTop: 2,
    fontSize: 11,
    color: "#475569",
    fontFamily: 'Figtree_500Medium',
    // fontWeight: "600",
  },

  /* ========== MEDIUM (immutato) ========== */
  miHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  miTitleWrap: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1, minWidth: 0 },
  miIconChip: { height: 36, width: 36, borderRadius: 18, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  miIcon: { fontSize: 18, fontWeight: "800" },
  miIconImage: { width: 40, height: 40 },
  miTitle: { flexShrink: 1, fontSize: 18, fontFamily: 'Figtree_700Bold', color: "#0f172a" },

  miBodyRow: { flexDirection: "row", alignItems: "flex-start", flex: 1, marginTop: 4 },
  miValueTopRight: { fontSize: 26, lineHeight: 30, fontFamily: 'Figtree_700Bold', letterSpacing: -0.5 },
  miSubtitle: { fontSize: 15, color: "#475569", fontFamily: 'Figtree_500Medium', lineHeight: 18 },

  // chip flottante in basso a destra
  miDetailChipFloat: {
    position: "absolute",
    right: 12,
    bottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 125,
    maxWidth: "55%",
  },
  miChipEmoji: { fontSize: 12 },
  miChipLabel: { fontSize: 14, color: "#64748b", fontFamily: 'Figtree_500Medium' },
  miChipValue: { fontSize: 15, color: "#0f172a", fontFamily: 'Figtree_700Bold' },

  /* ========== LARGE (fix posizionamenti) ========== */
  largeHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  largeHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 },
  largeHeaderText: { flex: 1, minWidth: 0, justifyContent: "center" },
  largeIconChip: { width: 48, height: 48, borderRadius: 24, borderWidth: 1.5, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  largeIcon: { fontSize: 22 },
  largeIconImage: { width: 48, height: 48 },
  largeLabel: { fontSize: 18, fontFamily: 'Figtree_700Bold', letterSpacing: -0.2 }, // Increased size for Large
  largeSubtitle: { marginTop: 2, fontSize: 16, color: "#6b7280", fontFamily: 'Figtree_500Medium' },

  largeValue: { fontSize: 30, fontFamily: 'Figtree_700Bold', letterSpacing: -0.5, marginLeft: 8 },

  largeChipsRow: { marginTop: "auto", flexDirection: "row", flexWrap: "wrap", gap: 7 },
  largeDetailChip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, borderWidth: 1, gap: 8, flex: 1, minWidth: 120, maxWidth: "50%" },
  largeChipIcon: { fontSize: 15, flexShrink: 0 },
  largeChipTextContainer: { flex: 1, minWidth: 0 },
  largeChipLabel: { fontSize: 14, color: "#64748b", fontFamily: 'Figtree_500Medium' },
  largeChipValue: { fontSize: 15, fontFamily: 'Figtree_700Bold', letterSpacing: -0.2 },
})

export default MiniInfoCard