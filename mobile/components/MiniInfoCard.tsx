"use client"

import React, { useMemo } from "react"
import { View, Text, StyleSheet, TouchableOpacity, Platform } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons"

type WidgetSize = "small" | "medium" | "large"

interface Props {
  label: string
  value: string
  subtitle?: string
  icon?: string                 // emoji o singolo carattere
  color: string                 // es. "#6366f1"
  backgroundColor?: string      // es. "#ffffff"
  trendValue?: string           // es. "+5%", "Good", "!"
  size?: WidgetSize
  showStatus?: boolean
  status?: "pending" | "completed" | "warning"
  detailChips?: Array<{ icon: string; label: string; value: string }>
  onPress?: () => void
  onLongPress?: () => void
}

const statusStyles = {
  pending:   { bg: "#FEF3C7", text: "#92400E", border: "#FDE68A", icon: "clock-outline" },
  completed: { bg: "#DCFCE7", text: "#065F46", border: "#86EFAC", icon: "check-circle" },
  warning:   { bg: "#FEE2E2", text: "#991B1B", border: "#FCA5A5", icon: "alert-circle" },
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
  color,
  backgroundColor = "#ffffff",
  trendValue,
  size = "small",
  showStatus,
  status = "pending",
  detailChips,
  onPress,
  onLongPress,
}) => {
  const st = statusStyles[status]

  const getTrendColor = () => {
    if (!trendValue) return "#6b7280"
    if (trendValue === "Good" || trendValue === "Excellent" || trendValue === "✓" || trendValue.includes("+"))
      return "#10b981"
    if (trendValue.includes("-") || trendValue === "!") return "#ef4444"
    return "#6b7280"
  }

  const descriptorText = useMemo(() => {
    if (showStatus) {
      if (status === "completed") return "🎉 Completed"
      if (status === "warning") return "⚠️ Attention needed"
      return "⏳ Pending"
    }
    const lower = label.toLowerCase()
    if (lower.includes("sleep")) return "😴 Rest quality"
    if (lower.includes("hrv")) return "💓 Recovery status"
    if (lower.includes("check")) return "🗒️ Wellness check"
    return "✨ Keep going"
  }, [label, showStatus, status])

  const { primary, unit } = splitValue(value)

  /* ==================== RENDER SMALL (immutato) ==================== */
  const renderSmall = () => (
    <LinearGradient
      colors={[`${color}10`, backgroundColor, `${color}04`]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.innerGradient}
    >
      <View style={styles.smallHeader}>
        <Text style={styles.smallLabel} numberOfLines={1}>{label}</Text>
        {showStatus ? (
          <View style={[styles.smallStatusBadge, { backgroundColor: st.bg, borderColor: st.border }]}>
            <MaterialCommunityIcons name={st.icon as any} size={11} color={st.text} />
          </View>
        ) : trendValue ? (
          <View style={[styles.smallTrendBadge, { backgroundColor: `${getTrendColor()}14`, borderColor: `${getTrendColor()}28` }]}>
            <MaterialCommunityIcons
              name={trendValue.includes("+") ? "trending-up" : trendValue.includes("-") ? "trending-down" : "minus"}
              size={11}
              color={getTrendColor()}
            />
          </View>
        ) : null}
      </View>

      <View style={styles.smallContent}>
        <View style={styles.smallValueRow}>
          <View style={{ flexDirection: "row", alignItems: "flex-end", flex: 1 }}>
            <Text
              style={[
                primary.toLowerCase() === "complete" ? styles.smallPrimaryValueComplete : styles.smallPrimaryValue,
                { color },
              ]}
              numberOfLines={1}
            >
              {primary}
            </Text>
            {!!unit && <Text style={styles.smallUnitText}>{unit}</Text>}
          </View>
          <Text style={styles.smallValueEmoji}>{icon}</Text>
        </View>

        {!!subtitle && (
          <Text style={styles.smallSubtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        )}
      </View>
    </LinearGradient>
  )

  /* ==================== RENDER MEDIUM (immutato) ==================== */
  const renderMedium = () => (
    <LinearGradient
      colors={[`${color}12`, backgroundColor, `${color}05`]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.innerGradient, styles.relative]}
    >
      <View style={styles.miHeaderRow}>
        <View style={styles.miTitleWrap}>
          <View style={[styles.miIconChip, { backgroundColor: `${color}15`, borderColor: `${color}32` }]}>
            <Text style={styles.miIcon}>{icon}</Text>
          </View>
          <Text style={styles.miTitle} numberOfLines={1} ellipsizeMode="tail">
            {label}
          </Text>
        </View>

        {showStatus ? (
          <View style={[styles.miStatusBadge, { backgroundColor: st.bg, borderColor: st.border }]}>
            <MaterialCommunityIcons name={st.icon as any} size={13} color={st.text} />
          </View>
        ) : trendValue ? (
          <View style={[styles.miTrendBadge, { backgroundColor: `${getTrendColor()}14`, borderColor: `${getTrendColor()}30` }]}>
            <MaterialCommunityIcons
              name={trendValue.includes("+") ? "trending-up" : trendValue.includes("-") ? "trending-down" : "minus"}
              size={12}
              color={getTrendColor()}
            />
            <Text style={[styles.miTrendText, { color: getTrendColor() }]} numberOfLines={1}>
              {trendValue}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.miBodyRow, styles.miBodyWithRightPadding]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={[styles.miValue, { color }]}>
            {value}
          </Text>
          {!!subtitle && (
            <Text numberOfLines={1} style={styles.miSubtitle}>
              {subtitle}
            </Text>
          )}
          <Text style={styles.miDescriptor} numberOfLines={1}>
            {descriptorText}
          </Text>
        </View>

        {showStatus && (
          <View style={[styles.miStatusPill, { backgroundColor: st.bg, borderColor: st.border }]}>
            <Text style={[styles.miStatusPillText, { color: st.text }]}>{status === "completed" ? "✓" : status === "warning" ? "!" : "…"}</Text>
          </View>
        )}
      </View>

      {detailChips?.length ? (
        <View style={[styles.miDetailChipFloat, { borderColor: `${color}22` }]}>
          <Text style={styles.miChipEmoji}>{detailChips[0].icon}</Text>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.miChipLabel} numberOfLines={1}>
              {detailChips[0].label}
            </Text>
            <Text style={[styles.miChipValue, { color }]} numberOfLines={1}>
              {detailChips[0].value}
            </Text>
          </View>
        </View>
      ) : null}
    </LinearGradient>
  )

  /* ==================== RENDER LARGE (fix: blocchi più in alto) ==================== */
  const renderLarge = () => (
    <LinearGradient
      colors={[`${color}14`, backgroundColor, `${color}06`]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.innerGradient}
    >
      <View style={styles.largeHeader}>
        <View style={styles.largeHeaderLeft}>
          <View style={[styles.largeIconChip, { backgroundColor: `${color}18`, borderColor: `${color}35` }]}>
            <Text style={styles.largeIcon}>{icon}</Text>
          </View>
          <View style={styles.largeHeaderText}>
            <Text style={styles.largeLabel} numberOfLines={1}>
              {label}
            </Text>
            <Text style={styles.largeDescriptor} numberOfLines={1}>
              {descriptorText}
            </Text>
          </View>
        </View>

        {showStatus ? (
          <View style={[styles.largeStatusBadge, { backgroundColor: st.bg, borderColor: st.border }]}>
            <MaterialCommunityIcons name={st.icon as any} size={15} color={st.text} />
          </View>
        ) : trendValue ? (
          <View style={[styles.largeTrendBadge, { backgroundColor: `${getTrendColor()}16`, borderColor: `${getTrendColor()}32` }]}>
            <MaterialCommunityIcons
              name={trendValue.includes("+") ? "trending-up" : trendValue.includes("-") ? "trending-down" : "minus"}
              size={13}
              color={getTrendColor()}
            />
            <Text style={[styles.largeTrendText, { color: getTrendColor() }]}>{trendValue}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.largeBody}>
        <View style={styles.largeValueBox}>
          <Text style={[styles.largeValue, { color }]} numberOfLines={1}>
            {value}
          </Text>
          {!!subtitle && (
            <Text style={styles.largeSubtitle} numberOfLines={2}>
              {subtitle}
            </Text>
          )}
        </View>

        {showStatus && (
          <View style={[styles.largeStatusPill, { backgroundColor: st.bg, borderColor: st.border }]}>
            <Text style={[styles.largeStatusText, { color: st.text }]}>{status === "completed" ? "✓" : status === "warning" ? "!" : "…"}</Text>
          </View>
        )}
      </View>

      {!!detailChips?.length && (
        <View style={styles.largeChipsRow}>
          {detailChips.map((chip) => (
            <View key={`${chip.label}-${chip.value}`} style={[styles.largeDetailChip, { borderColor: `${color}25` }]}>
              <Text style={styles.largeChipIcon}>{chip.icon}</Text>
              <View style={styles.largeChipTextContainer}>
                <Text style={styles.largeChipLabel} numberOfLines={1}>
                  {chip.label}
                </Text>
                <Text style={[styles.largeChipValue, { color }]} numberOfLines={1}>
                  {chip.value}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </LinearGradient>
  )

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={450}
      style={[styles.card, { backgroundColor }]}
    >
      {size === "small" ? renderSmall() : size === "medium" ? renderMedium() : renderLarge()}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  /* Card */
  card: {
    height: CARD_HEIGHT,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.06)",
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOpacity: 0.07, shadowOffset: { width: 0, height: 6 }, shadowRadius: 14 },
      android: { elevation: 3 },
    }),
  },
  innerGradient: { flex: 1, borderRadius: 18, padding: 13 },
  relative: { position: "relative" },

  /* ========== SMALL (immutato) ========== */
  smallHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, paddingTop: 2 },
  smallLabel: { fontSize: 14, fontWeight: "700", color: "#111827", letterSpacing: -0.1, flex: 1 },
  smallStatusBadge: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: -8, marginRight: -8 },
  smallTrendBadge: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: -8, marginRight: -8 },
  smallContent: { flex: 1, justifyContent: "center" },
  smallValueRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 2 },
  smallPrimaryValue: { fontSize: 26, lineHeight: 28, fontWeight: "800", letterSpacing: -0.2 },
  smallPrimaryValueComplete: { fontSize: 13, lineHeight: 20, fontWeight: "700", letterSpacing: -0.2 },
  smallValueEmoji: { fontSize: 18, fontWeight: "400", marginLeft: 8 },
  smallUnitText: { marginLeft: 3, marginBottom: 3, fontSize: 13, fontWeight: "600", color: "#64748b" },
  smallSubtitle: { marginTop: 4, fontSize: 10, color: "#475569", fontWeight: "600", lineHeight: 14 },

  /* ========== MEDIUM (immutato) ========== */
  miHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  miTitleWrap: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1, minWidth: 0 },
  miIconChip: { height: 28, width: 28, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  miIcon: { fontSize: 16, fontWeight: "800" },
  miTitle: { flexShrink: 1, fontSize: 15, fontWeight: "800", color: "#0f172a" },
  miTrendBadge: { height: 26, paddingHorizontal: 8, borderRadius: 13, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 4 },
  miTrendText: { fontSize: 11, fontWeight: "800" },
  miStatusBadge: { minWidth: 28, height: 26, borderRadius: 13, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },

  miBodyRow: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  miBodyWithRightPadding: { paddingRight: 96 },
  miValue: { fontSize: 20, lineHeight: 24, fontWeight: "900", color: "#0f172a" },
  miSubtitle: { marginTop: 4, fontSize: 12, color: "#475569", fontWeight: "700" },
  miDescriptor: { marginTop: 4, fontSize: 12, color: "#1f2937", fontWeight: "700" },

  miStatusPill: { minWidth: 36, height: 32, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 10, alignSelf: "flex-start" },
  miStatusPillText: { fontSize: 14, fontWeight: "900" },

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
    backgroundColor: "#ffffffc7",
    minWidth: 110,
    maxWidth: "55%",
  },
  miChipEmoji: { fontSize: 14 },
  miChipLabel: { fontSize: 10, color: "#64748b", fontWeight: "700" },
  miChipValue: { fontSize: 12, color: "#0f172a", fontWeight: "900" },

  /* ========== LARGE (fix posizionamenti) ========== */
  largeHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8, gap: 8 },
  largeHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 },
  largeHeaderText: { flex: 1, minWidth: 0 },
  largeIconChip: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.2, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  largeIcon: { fontSize: 18 },
  largeLabel: { fontSize: 15, fontWeight: "700", color: "#111827", letterSpacing: -0.2 },
  largeDescriptor: { marginTop: 1, fontSize: 11.5, fontWeight: "600", color: "#64748b", letterSpacing: -0.1 },

  largeTrendBadge: { height: 28, paddingHorizontal: 10, borderRadius: 14, borderWidth: 1.2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, flexShrink: 0 },
  largeTrendText: { fontSize: 11.5, fontWeight: "700" },
  largeStatusBadge: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.2, alignItems: "center", justifyContent: "center", flexShrink: 0 },

  // ⬆️ alzo il contenuto visivo per dare più respiro ai valori
  largeBody: { flexDirection: "row", alignItems: "center", flex: 1, gap: 12, marginTop: -2 },
  largeValueBox: { flex: 1, minWidth: 0 },
  largeValue: { fontSize: 26, fontWeight: "800", letterSpacing: -0.2, lineHeight: 28 },
  largeSubtitle: { marginTop: 4, fontSize: 12.5, color: "#374151", fontWeight: "600", lineHeight: 16 },

  // ✅ stili aggiunti che mancavano (evitano errori)
  largeStatusPill: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  largeStatusText: { fontSize: 15, fontWeight: "800" },

  largeChipsRow: { marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 7 },
  largeDetailChip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, borderWidth: 1, backgroundColor: "#ffffff96", gap: 8, flex: 1, minWidth: 90, maxWidth: "48%" },
  largeChipIcon: { fontSize: 15, flexShrink: 0 },
  largeChipTextContainer: { flex: 1, minWidth: 0 },
  largeChipLabel: { fontSize: 10, color: "#64748b", fontWeight: "600" },
  largeChipValue: { fontSize: 12, fontWeight: "700", letterSpacing: -0.2 },
})

export default MiniInfoCard