import { useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import * as Icons from "lucide-react-native";
import { CoinLogo } from "@/src/components/CoinLogo";
import { BrandLogo } from "@/src/components/BrandLogo";
import { theme } from "@/src/theme";
import { useAuth } from "@/src/contexts/AuthContext";
import { useSubscriptions } from "@/src/contexts/SubscriptionsContext";
import { findCategory, DEFAULT_CATEGORIES } from "@/src/data/categories";
import { findCurrency, formatAmount } from "@/src/data/currencies";
import { useFxRatesEUR } from "@/src/hooks/useFxRates";
import { confirmAction } from "@/src/utils/confirm";
import { useTranslation } from "react-i18next";

const FREE_SUB_LIMIT = 3;

function CatIcon({ name, color, size = 22 }: { name: string; color: string; size?: number }) {
  const Cmp = (Icons as any)[name] || (Icons as any).Tag;
  return <Cmp color={color} size={size} strokeWidth={2} />;
}

export default function Home() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { subscriptions, customCategories, baseCurrency, deleteSubscription } = useSubscriptions();
  const { convert } = useFxRatesEUR();
  const [view, setView] = useState<"monthly" | "yearly">("monthly");

  const allCats = useMemo(() => [...DEFAULT_CATEGORIES, ...customCategories], [customCategories]);
  const totalsCurrency = findCurrency(baseCurrency);

  // Convert all subscriptions to base currency via FX rates
  const totals = useMemo(() => {
    let m = 0;
    for (const s of subscriptions) {
      const monthly = s.cycle === "monthly" ? s.price : s.price / 12;
      const conv = convert(monthly, s.currency, baseCurrency);
      m += conv;
    }
    return { monthly: m, yearly: m * 12 };
  }, [subscriptions, baseCurrency, convert]);

  const monthlyTotal = totals.monthly;
  const yearlyTotal = totals.yearly;
  const totalAmount = view === "monthly" ? monthlyTotal : yearlyTotal;

  const isPro = !!user?.pro?.is_pro;
  const trialHoursLeft = (() => {
    const te = user?.pro?.trial_end;
    if (!te || user?.pro?.plan !== "trialing") return 0;
    return Math.max(0, Math.ceil((new Date(te).getTime() - Date.now()) / 3600000));
  })();
  const showPaywallGate = !isPro;

  const exportPdf = async () => {
    if (!isPro) {
      router.push("/(app)/paywall");
      return;
    }
    if (subscriptions.length === 0) {
      if (Platform.OS === "web") window.alert("Ajoutez d'abord des abonnements pour exporter un PDF.");
      else Alert.alert("Aucun abonnement", "Ajoutez d'abord des abonnements pour exporter un PDF.");
      return;
    }

    // ----- Aggregate per category (in base currency) -----
    const catMap = new Map<string, number>();
    let monthlyBase = 0;
    for (const s of subscriptions) {
      const monthly = s.cycle === "monthly" ? s.price : s.price / 12;
      const base = convert(monthly, s.currency, baseCurrency);
      monthlyBase += base;
      catMap.set(s.categoryId, (catMap.get(s.categoryId) || 0) + base);
    }
    const yearlyBase = monthlyBase * 12;
    const segments = Array.from(catMap.entries())
      .map(([id, amount]) => {
        const cat = findCategory(id, customCategories);
        return { id, label: cat.label, color: cat.color, amount };
      })
      .sort((a, b) => b.amount - a.amount);

    // ----- SVG donut -----
    const SIZE = 200;
    const STROKE = 26;
    const R = (SIZE - STROKE) / 2;
    const CX = SIZE / 2;
    const CY = SIZE / 2;
    const CIRC = 2 * Math.PI * R;
    let acc = 0;
    const donutArcs = segments.map((s) => {
      const len = monthlyBase > 0 ? (s.amount / monthlyBase) * CIRC : 0;
      const offset = -acc;
      acc += len;
      return `<circle cx="${CX}" cy="${CY}" r="${R}" stroke="${s.color}" stroke-width="${STROKE}" fill="none" stroke-dasharray="${len.toFixed(2)} ${(CIRC - len).toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}" />`;
    }).join("");

    // ----- Subscription rows (sorted by monthly cost desc, all in base currency) -----
    const subsSorted = [...subscriptions].sort((a, b) => {
      const aM = (a.cycle === "monthly" ? a.price : a.price / 12);
      const bM = (b.cycle === "monthly" ? b.price : b.price / 12);
      return convert(bM, b.currency, baseCurrency) - convert(aM, a.currency, baseCurrency);
    });

    const rows = subsSorted.map((s) => {
      const cat = findCategory(s.categoryId, customCategories);
      const monthlyOwn = s.cycle === "monthly" ? s.price : s.price / 12;
      const monthlyB = convert(monthlyOwn, s.currency, baseCurrency);
      const yearlyB = monthlyB * 12;
      return `<tr>
        <td>
          <div class="sub-name">${escapeHtml(s.name)}</div>
          <div class="sub-meta"><span class="dot" style="background:${cat.color}"></span>${escapeHtml(cat.label)}</div>
        </td>
        <td class="num">${formatAmount(monthlyB, baseCurrency)}</td>
        <td class="num">${formatAmount(yearlyB, baseCurrency)}</td>
      </tr>`;
    }).join("");

    const legend = segments.map((s) => {
      const pct = monthlyBase > 0 ? (s.amount / monthlyBase * 100) : 0;
      return `<div class="legend-row">
        <div class="legend-left">
          <span class="dot" style="background:${s.color}"></span>
          <span class="legend-label">${escapeHtml(s.label)}</span>
        </div>
        <div class="legend-right">
          <div class="legend-amount">${formatAmount(s.amount, baseCurrency)}</div>
          <div class="legend-pct">${pct.toFixed(0)}%</div>
        </div>
      </div>`;
    }).join("");

    const generatedOn = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });

    const html = `<!doctype html><html><head><meta charset="utf-8" />
      <style>
        @page { margin: 28px 32px; }
        * { box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
          color: #111827; margin: 0; padding: 0;
          -webkit-print-color-adjust: exact; print-color-adjust: exact;
        }
        .header { display: flex; align-items: center; gap: 16px; padding-bottom: 18px; border-bottom: 1px solid #E5E7EB; }
        .logo {
          width: 56px; height: 56px; border-radius: 50%;
          background: #FFFFFF; border: 2px solid #111827;
          display: flex; align-items: center; justify-content: center;
          position: relative; flex-shrink: 0;
        }
        .logo::before {
          content: ""; position: absolute; top: 6px; left: 6px; right: 6px; bottom: 6px;
          border-radius: 50%; border: 1px solid #111827; opacity: .35;
        }
        .logo span { font-size: 30px; font-weight: 900; line-height: 1; color: #111827; }
        .brand-name { font-size: 24px; font-weight: 900; letter-spacing: -0.6px; margin: 0; }
        .brand-sub { font-size: 12px; color: #6B7280; margin: 4px 0 0 0; }

        .totals { display: flex; gap: 14px; margin: 24px 0 28px 0; }
        .total-card {
          flex: 1; background: #F9FAFB; border: 1px solid #E5E7EB;
          border-radius: 14px; padding: 18px 20px;
        }
        .total-card .label { font-size: 10px; letter-spacing: 1.8px; color: #6B7280; font-weight: 700; }
        .total-card .value { font-size: 28px; font-weight: 900; color: #111827; letter-spacing: -1px; margin-top: 6px; }
        .total-card.dark { background: #111827; border-color: #111827; }
        .total-card.dark .label { color: #9CA3AF; }
        .total-card.dark .value { color: #10B981; }

        h2 {
          font-size: 11px; letter-spacing: 1.8px; color: #6B7280; font-weight: 700; text-transform: uppercase;
          margin: 8px 0 14px 0; padding-bottom: 8px; border-bottom: 1px solid #E5E7EB;
        }

        table { width: 100%; border-collapse: collapse; }
        thead th {
          text-align: left; font-size: 10px; letter-spacing: 1.2px; text-transform: uppercase;
          color: #9CA3AF; font-weight: 700; padding: 6px 10px;
        }
        thead th.num, tbody td.num { text-align: right; }
        tbody td { padding: 12px 10px; border-bottom: 1px solid #F3F4F6; vertical-align: middle; font-size: 13px; }
        tbody tr:last-child td { border-bottom: none; }
        .sub-name { font-weight: 700; color: #111827; font-size: 14px; }
        .sub-meta { font-size: 11px; color: #6B7280; margin-top: 2px; }
        .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; vertical-align: middle; }
        td.num { font-weight: 700; color: #111827; white-space: nowrap; }

        .stats { margin-top: 30px; display: flex; gap: 28px; align-items: center; }
        .donut-wrap { position: relative; width: 200px; height: 200px; flex-shrink: 0; }
        .donut-center { position: absolute; top: 0; left: 0; right: 0; bottom: 0;
                        display: flex; flex-direction: column; align-items: center; justify-content: center; }
        .donut-center .label { font-size: 9px; letter-spacing: 1.5px; color: #6B7280; font-weight: 700; }
        .donut-center .value { font-size: 16px; font-weight: 900; color: #111827; letter-spacing: -0.5px; margin-top: 4px; }
        .legend { flex: 1; }
        .legend-row { display: flex; align-items: center; justify-content: space-between; padding: 9px 0; border-bottom: 1px solid #F3F4F6; }
        .legend-row:last-child { border-bottom: none; }
        .legend-label { font-size: 13px; color: #111827; font-weight: 600; }
        .legend-right { text-align: right; }
        .legend-amount { font-size: 13px; font-weight: 700; color: #111827; }
        .legend-pct { font-size: 11px; color: #6B7280; margin-top: 2px; }

        .footer { margin-top: 32px; padding-top: 14px; border-top: 1px solid #E5E7EB;
                  color: #9CA3AF; font-size: 10px; display: flex; justify-content: space-between; }
      </style></head><body>

      <div class="header">
        <div class="logo"><span>?</span></div>
        <div>
          <h1 class="brand-name">All My Costs</h1>
          <p class="brand-sub">${escapeHtml(user?.name || "")}</p>
        </div>
      </div>

      <div class="totals">
        <div class="total-card">
          <div class="label">TOTAL MENSUEL</div>
          <div class="value">${formatAmount(monthlyBase, baseCurrency)}</div>
        </div>
        <div class="total-card dark">
          <div class="label">TOTAL ANNUEL</div>
          <div class="value">${formatAmount(yearlyBase, baseCurrency)}</div>
        </div>
      </div>

      <h2>Détail des abonnements</h2>
      <table>
        <thead><tr>
          <th>Abonnement</th>
          <th class="num">Mensuel</th>
          <th class="num">Annuel</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>

      <h2>Répartition par catégorie</h2>
      <div class="stats">
        <div class="donut-wrap">
          <svg width="200" height="200" viewBox="0 0 200 200">
            <g transform="rotate(-90 ${CX} ${CY})">
              <circle cx="${CX}" cy="${CY}" r="${R}" stroke="#F3F4F6" stroke-width="${STROKE}" fill="none" />
              ${donutArcs}
            </g>
          </svg>
          <div class="donut-center">
            <div class="label">MENSUEL</div>
            <div class="value">${formatAmount(monthlyBase, baseCurrency)}</div>
          </div>
        </div>
        <div class="legend">${legend}</div>
      </div>

      <div class="footer">
        <span>Généré le ${generatedOn}</span>
        <span>Devise : ${baseCurrency}</span>
      </div>

      </body></html>`;

    try {
      const { uri } = await Print.printToFileAsync({
        html,
        base64: false,
        useMarkupFormatter: true,
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          UTI: "com.adobe.pdf",
          dialogTitle: "All My Costs — Export PDF",
        });
      } else if (Platform.OS === "web") {
        // Web fallback: trigger a download
        if (typeof window !== "undefined") {
          const a = document.createElement("a");
          a.href = uri;
          a.download = `all-my-costs-${new Date().toISOString().slice(0, 10)}.pdf`;
          a.click();
        }
      } else {
        Alert.alert("PDF généré", uri);
      }
    } catch (e: any) {
      if (Platform.OS === "web") window.alert(e?.message || "Impossible de générer le PDF.");
      else Alert.alert("Erreur", e?.message || "Impossible de générer le PDF.");
    }
  };

  const renderItem = ({ item }: any) => {
    const cat = findCategory(item.categoryId, customCategories);
    // Compute the monthly equivalent in the subscription's own currency, then scale to the toggle.
    const monthlyOwn = item.cycle === "monthly" ? item.price : item.price / 12;
    const displayOwn = view === "monthly" ? monthlyOwn : monthlyOwn * 12;
    // Convert to user's base currency for the secondary line.
    const displayBase = convert(displayOwn, item.currency, baseCurrency);
    const cycleLabel = view === "monthly" ? t("common.monthly") : t("common.yearly");
    return (
      <TouchableOpacity
        testID={`subscription-item-${item.name}`}
        onPress={() => router.push({ pathname: "/(app)/subscription", params: { id: item.id } })}
        onLongPress={() =>
          confirmAction(item.name, "Supprimer cet abonnement ?", [
            { text: "Annuler", style: "cancel" },
            { text: "Supprimer", style: "destructive", onPress: () => deleteSubscription(item.id) },
          ])
        }
        style={styles.subItem}
      >
        <View style={[styles.subIcon, { backgroundColor: cat.color + "22" }]}>
          <CatIcon name={cat.icon} color={cat.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.subName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.subCat} numberOfLines={1}>{cat.label}</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={styles.subPrice}>{formatAmount(displayOwn, item.currency)}</Text>
          <Text style={styles.subCycle}>{cycleLabel}</Text>
          {item.currency !== baseCurrency ? (
            <Text style={styles.subFx}>≈ {formatAmount(displayBase, baseCurrency)}</Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.headerBrandRow}>
          <BrandLogo size={36} />
          <Text
            style={styles.brand}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
            allowFontScaling={false}
          >
            All My Costs
          </Text>
        </View>
        <View style={styles.headerActionsRow}>
          <TouchableOpacity testID="stats-button" onPress={() => router.push("/(app)/stats")} style={styles.iconBtn}>
            <Icons.PieChart color={theme.text} size={20} strokeWidth={2} />
          </TouchableOpacity>
          <TouchableOpacity testID="export-pdf-button" onPress={exportPdf} style={styles.iconBtn}>
            <Icons.FileDown color={theme.text} size={20} strokeWidth={2} />
          </TouchableOpacity>
          <TouchableOpacity testID="settings-button" onPress={() => router.push("/(app)/settings")} style={styles.iconBtn}>
            <Icons.Settings color={theme.text} size={20} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={subscriptions}
        keyExtractor={(s) => s.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: 20 }}
        ListHeaderComponent={
          <View>
            {user?.pro?.plan === "trialing" && trialHoursLeft > 0 ? (
              <TouchableOpacity testID="trial-banner" onPress={() => router.push("/(app)/paywall")} style={styles.trialBanner}>
                <Icons.Sparkles color={theme.accent} size={16} />
                <Text style={styles.trialBannerText}>{t("home.trialBanner", { hours: trialHoursLeft })}</Text>
                <Icons.ChevronRight color={theme.accent} size={16} />
              </TouchableOpacity>
            ) : null}
            {(user?.pro?.plan === "expired" || (user?.pro?.plan === "free" && user?.pro?.has_used_trial)) ? (
              <TouchableOpacity testID="upgrade-banner" onPress={() => router.push("/(app)/paywall")} style={[styles.trialBanner, { backgroundColor: "#FEF2F2", borderColor: theme.danger }]}>
                <Icons.AlertCircle color={theme.danger} size={16} />
                <Text style={[styles.trialBannerText, { color: theme.danger }]}>{t("home.trialEnded")}</Text>
                <Text style={{ color: theme.danger, fontWeight: "800" }}>{t("home.upgrade")}</Text>
              </TouchableOpacity>
            ) : null}
            <View style={styles.heroCard}>
              <View style={styles.heroToggle}>
                <TouchableOpacity
                  testID="toggle-monthly"
                  onPress={() => setView("monthly")}
                  style={[styles.toggleBtn, view === "monthly" && styles.toggleBtnActive]}
                >
                  <Text style={[styles.toggleText, view === "monthly" && styles.toggleTextActive]}>{t("common.monthly")}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID="toggle-yearly"
                  onPress={() => setView("yearly")}
                  style={[styles.toggleBtn, view === "yearly" && styles.toggleBtnActive]}
                >
                  <Text style={[styles.toggleText, view === "yearly" && styles.toggleTextActive]}>{t("common.yearly")}</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.heroLabel}>{view === "monthly" ? t("home.totalMonthly") : t("home.totalYearly")}</Text>
              <Text testID="total-cost-display" style={styles.heroAmount}>
                {formatAmount(totalAmount, baseCurrency)}
              </Text>
              <Text style={styles.heroHint}>
                {t("home.subsCount", { count: subscriptions.length, currency: totalsCurrency.code })}
              </Text>
            </View>
            <Text style={styles.sectionTitle}>{t("home.yourSubs")}</Text>
            {subscriptions.length === 0 ? (
              <Text style={styles.empty}>{t("home.empty")}</Text>
            ) : null}
          </View>
        }
      />

      <TouchableOpacity
        testID="add-subscription-button"
        onPress={() => {
          if (showPaywallGate && subscriptions.length >= FREE_SUB_LIMIT) {
            router.push("/(app)/paywall");
          } else {
            router.push("/(app)/subscription");
          }
        }}
        style={styles.fab}
      >
        <Icons.Plus color="#fff" size={28} strokeWidth={2.5} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]!));
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  header: {
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8,
  },
  headerBrandRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
  },
  headerActionsRow: {
    flexDirection: "row", justifyContent: "center", gap: 14, marginTop: 12,
  },
  brand: { fontSize: 20, fontWeight: "800", color: theme.text, letterSpacing: -0.3, flexShrink: 1 },
  iconBtn: {
    width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center",
    backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border,
  },
  heroCard: {
    backgroundColor: theme.primary, borderRadius: 24, padding: 24, marginTop: 8, marginBottom: 24, overflow: "hidden",
  },
  heroToggle: {
    flexDirection: "row", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 999, padding: 4, alignSelf: "flex-start", marginBottom: 16,
  },
  toggleBtn: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 999 },
  toggleBtnActive: { backgroundColor: "#fff" },
  toggleText: { color: "#9CA3AF", fontSize: 12, fontWeight: "700" },
  toggleTextActive: { color: theme.text },
  heroLabel: { color: "#9CA3AF", fontSize: 11, letterSpacing: 2, fontWeight: "700" },
  heroAmount: { color: theme.accent, fontSize: 44, fontWeight: "900", letterSpacing: -1.5, marginTop: 6 },
  heroHint: { color: "#9CA3AF", fontSize: 12, marginTop: 8 },
  sectionTitle: { fontSize: 13, color: theme.textMuted, fontWeight: "700", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 },
  empty: { color: theme.textMuted, paddingVertical: 24, textAlign: "center" },
  subItem: {
    flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  subIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  subName: { fontSize: 16, fontWeight: "700", color: theme.text },
  subCat: { fontSize: 13, color: theme.textMuted, marginTop: 2 },
  subPrice: { fontSize: 16, fontWeight: "800", color: theme.text },
  subCycle: { fontSize: 11, color: theme.textSubtle, marginTop: 2 },
  subFx: { fontSize: 11, color: theme.textMuted, marginTop: 2, fontStyle: "italic" },
  fab: {
    position: "absolute", right: 20, bottom: 24, width: 60, height: 60, borderRadius: 30,
    backgroundColor: theme.primary, alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
  trialBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: theme.accentSoft, borderColor: theme.accent, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, marginTop: 8,
  },
  trialBannerText: { flex: 1, fontSize: 13, fontWeight: "700", color: theme.accent },
});
