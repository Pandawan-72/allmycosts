import { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Svg, { Circle, G, Rect, Text as SvgText } from "react-native-svg";
import { useTranslation } from "react-i18next";
import * as Icons from "lucide-react-native";

import { theme } from "@/src/theme";
import { useAuth } from "@/src/contexts/AuthContext";
import { useSubscriptions } from "@/src/contexts/SubscriptionsContext";
import { useFxRatesEUR } from "@/src/hooks/useFxRates";
import { DEFAULT_CATEGORIES, findCategory, getCategoryLabel } from "@/src/data/categories";
import { findCurrency, formatAmount } from "@/src/data/currencies";

function CatIcon({ name, color, size = 16 }: { name: string; color: string; size?: number }) {
  const Cmp = (Icons as any)[name] || (Icons as any).Tag;
  return <Cmp color={color} size={size} strokeWidth={2} />;
}

// Génère les 12 derniers mois sous forme de labels courts
function getLast12Months(): string[] {
  const months = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d.toLocaleString("fr-FR", { month: "short" }));
  }
  return months;
}

export default function Stats() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { subscriptions, customCategories, baseCurrency } = useSubscriptions();
  const { convert } = useFxRatesEUR();

  const isPro = !!user?.pro?.is_pro;
  const cur = findCurrency(baseCurrency);

  // ─── Agrégation par catégorie ───────────────────────────────────────────
  const { groups, total } = useMemo(() => {
    const map = new Map<string, number>();
    let totalSum = 0;
    for (const s of subscriptions) {
      const monthly = s.cycle === "monthly" ? s.price : s.price / 12;
      const baseMonthly = convert(monthly, s.currency, baseCurrency);
      map.set(s.categoryId, (map.get(s.categoryId) || 0) + baseMonthly);
      totalSum += baseMonthly;
    }
    const arr = Array.from(map.entries())
      .map(([id, amount]) => {
        const cat = findCategory(id, customCategories);
        return { id, label: getCategoryLabel(cat, t), color: cat.color, icon: cat.icon, amount };
      })
      .sort((a, b) => b.amount - a.amount);
    return { groups: arr, total: totalSum };
  }, [subscriptions, customCategories, baseCurrency, convert, t]);

  // ─── Top 3 dépenses les plus chères ────────────────────────────────────
  const top3 = useMemo(() => {
    return [...subscriptions]
      .map((s) => {
        const monthly = s.cycle === "monthly" ? s.price : s.price / 12;
        const baseMonthly = convert(monthly, s.currency, baseCurrency);
        return { ...s, baseMonthly };
      })
      .sort((a, b) => b.baseMonthly - a.baseMonthly)
      .slice(0, 3);
  }, [subscriptions, baseCurrency, convert]);

  // ─── Simulation évolution 12 mois (basée sur abonnements actuels) ──────
  const monthlyData = useMemo(() => {
    const months = getLast12Months();
    // On simule : le total actuel est constant sur les 12 mois
    // (les abonnements créés après un mois ne sont pas comptés avant)
    const now = new Date();
    return months.map((label, i) => {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      // N'inclure que les abonnements créés avant ou pendant ce mois
      let monthTotal = 0;
      for (const s of subscriptions) {
        const createdAt = new Date(s.createdAt);
        if (createdAt <= new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0)) {
          const monthly = s.cycle === "monthly" ? s.price : s.price / 12;
          monthTotal += convert(monthly, s.currency, baseCurrency);
        }
      }
      return { label, value: monthTotal };
    });
  }, [subscriptions, baseCurrency, convert]);

  // ─── Comparaison mois précédent ─────────────────────────────────────────
  const { currentMonth, prevMonth, diff, diffPct } = useMemo(() => {
    const current = monthlyData[11]?.value || 0;
    const prev = monthlyData[10]?.value || 0;
    const d = current - prev;
    const pct = prev > 0 ? (d / prev) * 100 : 0;
    return { currentMonth: current, prevMonth: prev, diff: d, diffPct: pct };
  }, [monthlyData]);

  // ─── Prévision annuelle ──────────────────────────────────────────────────
  const annualForecast = useMemo(() => total * 12, [total]);

  // ─── Donut ───────────────────────────────────────────────────────────────
  const top = groups.slice(0, 5);
  const otherSum = groups.slice(5).reduce((s, g) => s + g.amount, 0);
  const displayGroups = otherSum > 0
    ? [...top, { id: "_other", label: t("categories.other") || "Autre", color: "#9CA3AF", icon: "MoreHorizontal", amount: otherSum }]
    : top;

  const SIZE = 220, STROKE = 26;
  const radius = (SIZE - STROKE) / 2;
  const cx = SIZE / 2, cy = SIZE / 2;
  const circumference = 2 * Math.PI * radius;
  let acc = 0;
  const segments = displayGroups.map((g) => {
    const proportion = total > 0 ? g.amount / total : 0;
    const length = proportion * circumference;
    const offset = -acc;
    acc += length;
    return { ...g, length, offset, proportion };
  });

  // ─── Bar chart ────────────────────────────────────────────────────────────
  const maxVal = Math.max(...monthlyData.map((d) => d.value), 0.01);
  const CHART_W = 320, CHART_H = 120, BAR_W = 18, GAP = (CHART_W - 12 * BAR_W) / 13;

  if (!isPro) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
            <Icons.ChevronLeft color={theme.text} size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t("stats.title")}</Text>
          <View style={styles.headerBtn} />
        </View>
        <View style={{ padding: 24, alignItems: "center", marginTop: 60 }}>
          <Icons.Lock color={theme.text} size={36} />
          <Text style={[styles.h1, { textAlign: "center", marginTop: 16 }]}>{t("stats.lockedTitle")}</Text>
          <Text style={{ color: theme.textMuted, textAlign: "center", marginTop: 8 }}>{t("stats.lockedDesc")}</Text>
          <TouchableOpacity testID="stats-go-paywall" onPress={() => router.push("/(app)/paywall")} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>{t("home.upgrade")}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity testID="stats-back" onPress={() => router.back()} style={styles.headerBtn}>
          <Icons.ChevronLeft color={theme.text} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("stats.title")}</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <Text style={styles.h1}>{t("stats.subtitle")}</Text>
        <Text style={styles.sub}>{t("stats.helper")}</Text>

        {groups.length === 0 ? (
          <Text style={styles.empty}>{t("home.empty")}</Text>
        ) : (
          <>
            {/* ─── Top 3 dépenses ─── */}
            <Text style={[styles.section, { marginTop: 24 }]}>TOP 3 DES DÉPENSES</Text>
            {top3.map((s, i) => {
              const cat = findCategory(s.categoryId, customCategories);
              return (
                <View key={s.id} style={styles.top3Row}>
                  <View style={styles.top3Badge}>
                    <Text style={styles.top3Num}>{i + 1}</Text>
                  </View>
                  <View style={[styles.rowIcon, { backgroundColor: cat.color + "22" }]}>
                    <CatIcon name={cat.icon} color={cat.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowLabel} numberOfLines={1}>{s.name}</Text>
                    <Text style={styles.rowPct}>{getCategoryLabel(cat, t)}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.rowAmount}>{formatAmount(s.baseMonthly, baseCurrency)}</Text>
                    <Text style={styles.rowPct}>/mois</Text>
                  </View>
                </View>
              );
            })}

            {/* ─── Donut par catégorie ─── */}
            <Text style={[styles.section, { marginTop: 24 }]}>{t("stats.breakdown")}</Text>
            <View style={styles.donutWrap}>
              <Svg width={SIZE} height={SIZE}>
                <G rotation={-90} originX={cx} originY={cy}>
                  <Circle cx={cx} cy={cy} r={radius} stroke={theme.surfaceAlt} strokeWidth={STROKE} fill="none" />
                  {segments.map((s, idx) => (
                    <Circle
                      key={idx}
                      cx={cx} cy={cy} r={radius}
                      stroke={s.color}
                      strokeWidth={STROKE}
                      fill="none"
                      strokeDasharray={`${s.length} ${circumference - s.length}`}
                      strokeDashoffset={s.offset}
                      strokeLinecap="butt"
                    />
                  ))}
                </G>
              </Svg>
              <View style={styles.donutCenter} pointerEvents="none">
                <Text style={styles.donutLabel}>{t("home.totalMonthly")}</Text>
                <Text testID="stats-total" style={styles.donutAmount}>{formatAmount(total, baseCurrency)}</Text>
                <Text style={styles.donutHint}>{groups.length} {t("stats.categoriesCount")}</Text>
              </View>
            </View>

            {segments.map((g) => {
              const pct = (g.proportion * 100).toFixed(0);
              return (
                <View key={g.id} testID={`stats-row-${g.id}`} style={styles.row}>
                  <View style={[styles.rowIcon, { backgroundColor: g.color + "22" }]}>
                    <CatIcon name={g.icon} color={g.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.rowHeader}>
                      <Text style={styles.rowLabel} numberOfLines={1}>{g.label}</Text>
                      <Text style={styles.rowAmount}>{formatAmount(g.amount, baseCurrency)}</Text>
                    </View>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { width: `${Math.max(2, g.proportion * 100)}%`, backgroundColor: g.color }]} />
                    </View>
                    <Text style={styles.rowPct}>{pct}% · {formatAmount(g.amount * 12, baseCurrency)} / {t("common.yearly").toLowerCase()}</Text>
                  </View>
                </View>
              );
            })}

            {/* ─── Comparaison mois précédent ─── */}
            <View style={styles.compRow}>
              <View style={[styles.compCard, { flex: 1 }]}>
                <Text style={styles.compLabel}>CE MOIS</Text>
                <Text style={styles.compAmount}>{formatAmount(currentMonth, baseCurrency)}</Text>
              </View>
              <View style={[styles.compCard, { flex: 1, alignItems: "center" }]}>
                <Text style={styles.compLabel}>VS MOIS PRÉC.</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  {diff > 0
                    ? <Icons.TrendingUp color={theme.danger} size={16} />
                    : diff < 0
                    ? <Icons.TrendingDown color="#10B981" size={16} />
                    : <Icons.Minus color={theme.textMuted} size={16} />
                  }
                  <Text style={[styles.compAmount, { color: diff > 0 ? theme.danger : diff < 0 ? "#10B981" : theme.text }]}>
                    {diff >= 0 ? "+" : ""}{diffPct.toFixed(0)}%
                  </Text>
                </View>
              </View>
              <View style={[styles.compCard, { flex: 1, alignItems: "flex-end" }]}>
                <Text style={styles.compLabel}>PRÉVISION AN</Text>
                <Text style={styles.compAmount}>{formatAmount(annualForecast, baseCurrency)}</Text>
              </View>
            </View>

            {/* ─── Graphique 12 mois ─── */}
            <Text style={styles.section}>ÉVOLUTION 12 MOIS</Text>
            <View style={styles.chartCard}>
              <Svg width={CHART_W} height={CHART_H + 20}>
                {monthlyData.map((d, i) => {
                  const barH = maxVal > 0 ? (d.value / maxVal) * CHART_H : 2;
                  const x = GAP + i * (BAR_W + GAP);
                  const y = CHART_H - barH;
                  const isLast = i === 11;
                  return (
                    <G key={i}>
                      <Rect
                        x={x}
                        y={y}
                        width={BAR_W}
                        height={Math.max(barH, 2)}
                        rx={4}
                        fill={isLast ? theme.accent : theme.surfaceAlt}
                        opacity={isLast ? 1 : 0.6}
                      />
                      <SvgText
                        x={x + BAR_W / 2}
                        y={CHART_H + 16}
                        fontSize={8}
                        fill={theme.textSubtle}
                        textAnchor="middle"
                      >
                        {d.label}
                      </SvgText>
                    </G>
                  );
                })}
              </Svg>
            </View>

            {/* ─── Tip ─── */}
            <View style={styles.tipCard}>
              <Icons.Lightbulb color={theme.accent} size={18} />
              <View style={{ flex: 1 }}>
                <Text style={styles.tipTitle}>{t("stats.tipTitle")}</Text>
                <Text style={styles.tipText}>
                  {t("stats.tipText", { amount: formatAmount(total * 12, baseCurrency), currency: cur.code })}
                </Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  header: {
    paddingHorizontal: 12, paddingVertical: 8,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  headerBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 16, fontWeight: "800", color: theme.text },
  h1: { fontSize: 28, fontWeight: "900", color: theme.text, letterSpacing: -0.8 },
  sub: { fontSize: 14, color: theme.textMuted, marginTop: 6, marginBottom: 20 },
  empty: { color: theme.textMuted, textAlign: "center", paddingVertical: 40 },

  // Comparaison
  compRow: { flexDirection: "row", gap: 10, marginBottom: 24 },
  compCard: {
    backgroundColor: theme.surface, borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: theme.border,
  },
  compLabel: { fontSize: 9, color: theme.textMuted, fontWeight: "700", letterSpacing: 1.2, marginBottom: 4 },
  compAmount: { fontSize: 15, fontWeight: "900", color: theme.text, letterSpacing: -0.5 },

  // Chart
  section: { fontSize: 11, color: theme.textMuted, fontWeight: "700", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 12 },
  chartCard: {
    backgroundColor: theme.surface, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: theme.border, alignItems: "center", marginBottom: 8,
  },

  // Top 3
  top3Row: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  top3Badge: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: theme.primary,
    alignItems: "center", justifyContent: "center",
  },
  top3Num: { color: "#fff", fontSize: 12, fontWeight: "900" },

  // Donut
  donutWrap: { alignItems: "center", justifyContent: "center", marginTop: 8, marginBottom: 24 },
  donutCenter: { position: "absolute", alignItems: "center", justifyContent: "center" },
  donutLabel: { fontSize: 10, color: theme.textMuted, letterSpacing: 2, fontWeight: "700" },
  donutAmount: { fontSize: 26, fontWeight: "900", color: theme.text, letterSpacing: -1, marginTop: 4 },
  donutHint: { fontSize: 12, color: theme.textSubtle, marginTop: 4 },

  // Rows
  row: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  rowIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  rowHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  rowLabel: { fontSize: 14, fontWeight: "700", color: theme.text, flex: 1, marginRight: 8 },
  rowAmount: { fontSize: 14, fontWeight: "800", color: theme.text },
  barTrack: { height: 6, backgroundColor: theme.surfaceAlt, borderRadius: 3, overflow: "hidden", marginTop: 6 },
  barFill: { height: 6, borderRadius: 3 },
  rowPct: { fontSize: 11, color: theme.textMuted, marginTop: 4 },

  // Tip
  tipCard: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    padding: 16, backgroundColor: theme.accentSoft, borderRadius: 16, marginTop: 12,
    borderWidth: 1, borderColor: theme.accent,
  },
  tipTitle: { fontSize: 13, fontWeight: "800", color: theme.accent, marginBottom: 4 },
  tipText: { fontSize: 13, color: theme.text, lineHeight: 18 },
  primaryBtn: { backgroundColor: theme.primary, borderRadius: 999, paddingVertical: 16, paddingHorizontal: 32, marginTop: 24 },
  primaryBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
});
