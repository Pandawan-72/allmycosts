import { useMemo, useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import Svg, { Circle, G, Rect, Text as SvgText } from "react-native-svg";
import { useTranslation } from "react-i18next";
import * as Icons from "lucide-react-native";

import { useTheme } from "@/src/contexts/ThemeContext";
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
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { subscriptions, expenses, customCategories, baseCurrency } = useSubscriptions();
  const { convert } = useFxRatesEUR();

  // Mode d'affichage des statistiques : récurrent (abonnements), ponctuel
  // (dépenses), ou cumulé (les deux combinés dans les mêmes totaux/graphiques).
  const [dataMode, setDataMode] = useState<"recurring" | "oneoff" | "combined">("recurring");
  const [refreshKey, setRefreshKey] = useState(0);

  // Force un recalcul complet à chaque fois que l'écran reprend le focus,
  // pour refléter les suppressions/ajouts effectués depuis l'accueil.
  useFocusEffect(useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []));

  const isPro = !!user?.pro?.is_pro;
  const cur = findCurrency(baseCurrency);

  // ─── Normalisation : convertit subscriptions et expenses vers un montant
  // mensuel commun en devise de base, pour pouvoir les agréger ensemble. ───
  type NormalizedEntry = { id: string; name: string; categoryId: string; monthlyAmount: number; createdAt: string };

  const normalizedSubs: NormalizedEntry[] = useMemo(() => subscriptions.map((s) => {
    const monthly = s.cycle === "monthly" ? s.price : s.price / 12;
    return { id: s.id, name: s.name, categoryId: s.categoryId, monthlyAmount: convert(monthly, s.currency, baseCurrency), createdAt: s.createdAt };
  }), [subscriptions, baseCurrency, convert, refreshKey]);

  // Pour les dépenses ponctuelles, on utilise le montant réel (pas de notion
  // "mensuelle" récurrente) — chaque dépense compte pour son propre mois.
  const normalizedExpenses: NormalizedEntry[] = useMemo(() => expenses.map((e) => ({
    id: e.id, name: e.name, categoryId: e.categoryId, monthlyAmount: convert(e.price, e.currency, baseCurrency), createdAt: e.date,
  })), [expenses, baseCurrency, convert, refreshKey]);

  // Liste active selon le mode sélectionné — alimente donut/top3/graphique.
  const activeEntries: NormalizedEntry[] = useMemo(() => {
    if (dataMode === "recurring") return normalizedSubs;
    if (dataMode === "oneoff") return normalizedExpenses;
    return [...normalizedSubs, ...normalizedExpenses];
  }, [dataMode, normalizedSubs, normalizedExpenses]);

  // ─── Agrégation par catégorie ───────────────────────────────────────────
  const { groups, total } = useMemo(() => {
    const map = new Map<string, number>();
    let totalSum = 0;
    for (const e of activeEntries) {
      map.set(e.categoryId, (map.get(e.categoryId) || 0) + e.monthlyAmount);
      totalSum += e.monthlyAmount;
    }
    const arr = Array.from(map.entries())
      .map(([id, amount]) => {
        const cat = findCategory(id, customCategories);
        return { id, label: getCategoryLabel(cat, t), color: cat.color, icon: cat.icon, amount };
      })
      .sort((a, b) => b.amount - a.amount);
    return { groups: arr, total: totalSum };
  }, [activeEntries, customCategories, t]);

  // ─── Top 3 dépenses les plus chères ────────────────────────────────────
  const top3 = useMemo(() => {
    return [...activeEntries]
      .map((e) => ({ ...e, baseMonthly: e.monthlyAmount }))
      .sort((a, b) => b.baseMonthly - a.baseMonthly)
      .slice(0, 3);
  }, [activeEntries]);

  // ─── Évolution sur 12 mois, calculée différemment selon le mode :
  // - Récurrent : abonnements actifs ce mois-là (créés avant la fin du mois),
  //   montant mensuel constant tant que l'abonnement existe (simulation).
  // - Ponctuel : somme réelle des dépenses datées dans ce mois précis.
  // - Cumulé : les deux additionnés. ─────────────────────────────────────
  const monthlyData = useMemo(() => {
    const months = getLast12Months();
    const now = new Date();
    return months.map((label, i) => {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);

      let recurringTotal = 0;
      if (dataMode === "recurring" || dataMode === "combined") {
        for (const s of subscriptions) {
          const createdAt = new Date(s.createdAt);
          if (createdAt <= monthEnd) {
            const monthly = s.cycle === "monthly" ? s.price : s.price / 12;
            recurringTotal += convert(monthly, s.currency, baseCurrency);
          }
        }
      }

      let oneoffTotal = 0;
      if (dataMode === "oneoff" || dataMode === "combined") {
        for (const e of expenses) {
          const d = new Date(e.date);
          if (d.getFullYear() === monthDate.getFullYear() && d.getMonth() === monthDate.getMonth()) {
            oneoffTotal += convert(e.price, e.currency, baseCurrency);
          }
        }
      }

      return { label, value: recurringTotal + oneoffTotal };
    });
  }, [subscriptions, expenses, baseCurrency, convert, dataMode]);

  // ─── Comparaison mois précédent ─────────────────────────────────────────
  const { currentMonth, prevMonth, diff, diffPct } = useMemo(() => {
    const current = monthlyData[11]?.value || 0;
    const prev = monthlyData[10]?.value || 0;
    const d = current - prev;
    const pct = prev > 0 ? (d / prev) * 100 : 0;
    return { currentMonth: current, prevMonth: prev, diff: d, diffPct: pct };
  }, [monthlyData]);

  // ─── Prévision annuelle ──────────────────────────────────────────────────
  // Prévision annuelle : pour le récurrent, projection (total mensuel × 12)
  // cohérente car les abonnements se répètent. Pour le ponctuel et le cumulé,
  // on utilise la somme réelle des 12 derniers mois — une projection × 12
  // sur des dépenses non récurrentes n'aurait aucun sens.
  const annualForecast = useMemo(() => {
    if (dataMode === "recurring") return total * 12;
    return monthlyData.reduce((sum, m) => sum + m.value, 0);
  }, [dataMode, total, monthlyData]);

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
        <Text style={styles.h1}>
          {dataMode === "recurring" ? t("stats.subtitle") : dataMode === "oneoff" ? t("stats.subtitleOneoff") : t("stats.subtitleCombined")}
        </Text>
        <Text style={styles.sub}>{t("stats.helper")}</Text>

        <View style={styles.dataModeRow}>
          <TouchableOpacity
            testID="stats-datamode-recurring"
            onPress={() => setDataMode("recurring")}
            style={[styles.dataModeBtn, dataMode === "recurring" && styles.dataModeBtnActive]}
          >
            <Text style={[styles.dataModeText, dataMode === "recurring" && styles.dataModeTextActive]}>{t("home.recurringMode")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="stats-datamode-oneoff"
            onPress={() => setDataMode("oneoff")}
            style={[styles.dataModeBtn, dataMode === "oneoff" && styles.dataModeBtnActive]}
          >
            <Text style={[styles.dataModeText, dataMode === "oneoff" && styles.dataModeTextActive]}>{t("home.oneoffMode")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="stats-datamode-combined"
            onPress={() => setDataMode("combined")}
            style={[styles.dataModeBtn, dataMode === "combined" && styles.dataModeBtnActive]}
          >
            <Text style={[styles.dataModeText, dataMode === "combined" && styles.dataModeTextActive]}>{t("home.combinedMode")}</Text>
          </TouchableOpacity>
        </View>

        {groups.length === 0 ? (
          <Text style={styles.empty}>{t("home.empty")}</Text>
        ) : (
          <>
            {/* ─── Top 3 dépenses ─── */}
            <Text style={[styles.section, { marginTop: 4 }]}>{t("stats.top3")}</Text>
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
                    <Text style={styles.rowPct}>{t("stats.perMonth")}</Text>
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
                <Text style={styles.compLabel}>{t("stats.thisMonth")}</Text>
                <Text style={styles.compAmount}>{formatAmount(currentMonth, baseCurrency)}</Text>
              </View>
              <View style={[styles.compCard, { flex: 1, alignItems: "center" }]}>
                <Text style={styles.compLabel}>{t("stats.vsPrevMonth")}</Text>
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
                <Text style={styles.compLabel}>
                  {dataMode === "recurring" ? t("stats.annualForecast") : t("stats.annualForecastReal")}
                </Text>
                <Text style={styles.compAmount}>{formatAmount(annualForecast, baseCurrency)}</Text>
              </View>
            </View>

            {/* ─── Graphique 12 mois ─── */}
            <Text style={[styles.section, { marginTop: 24 }]}>{t("stats.evolution12")}</Text>
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
                        x={x} y={y}
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
            {dataMode === "recurring" ? (
              <View style={styles.tipCard}>
                <Icons.Lightbulb color={theme.accent} size={18} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.tipTitle}>{t("stats.tipTitle")}</Text>
                  <Text style={styles.tipText}>
                    {t("stats.tipText", { amount: formatAmount(total * 12, baseCurrency), currency: cur.code })}
                  </Text>
                </View>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(theme: any) { return StyleSheet.create({
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

  dataModeRow: {
    flexDirection: "row", backgroundColor: theme.cardBg, borderRadius: 999, padding: 4, marginBottom: 24,
  },
  dataModeBtn: { flex: 1, paddingVertical: 9, borderRadius: 999, alignItems: "center" },
  dataModeBtnActive: { backgroundColor: "#fff" },
  dataModeText: { color: "#9CA3AF", fontSize: 12, fontWeight: "700" },
  dataModeTextActive: { color: "#111827" },

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
    width: 24, height: 24, borderRadius: 12, backgroundColor: theme.cardBg,
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
  primaryBtn: { backgroundColor: theme.cardBg, borderRadius: 999, paddingVertical: 16, paddingHorizontal: 32, marginTop: 24 },
  primaryBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
});
}
