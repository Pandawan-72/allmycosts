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
    if (subscriptions.length === 0) {
      if (Platform.OS === "web") window.alert("Ajoutez d'abord des abonnements pour exporter un PDF.");
      else Alert.alert("Aucun abonnement", "Ajoutez d'abord des abonnements pour exporter un PDF.");
      return;
    }
    const rows = subscriptions
      .map((s) => {
        const cat = findCategory(s.categoryId, customCategories);
        const monthly = s.cycle === "monthly" ? s.price : s.price / 12;
        return `<tr>
          <td>${escapeHtml(s.name)}</td>
          <td>${escapeHtml(cat.label)}</td>
          <td>${s.cycle === "monthly" ? "Mensuel" : "Annuel"}</td>
          <td style="text-align:right">${formatAmount(s.price, s.currency)}</td>
          <td style="text-align:right">${formatAmount(monthly, s.currency)}</td>
        </tr>`;
      })
      .join("");

    const html = `<!doctype html><html><head><meta charset="utf-8" />
      <style>
        * { font-family: -apple-system, system-ui, sans-serif; color: #111827; }
        body { padding: 32px; }
        h1 { font-size: 28px; letter-spacing: -0.5px; margin: 0 0 8px 0; }
        .sub { color: #6B7280; margin-bottom: 24px; }
        .totals { display: flex; gap: 16px; margin-bottom: 24px; }
        .card { flex: 1; background: #111827; color: #fff; padding: 20px; border-radius: 16px; }
        .card .label { font-size: 11px; letter-spacing: 1.5px; color: #9CA3AF; text-transform: uppercase; }
        .card .val { font-size: 28px; font-weight: 800; color: #10B981; margin-top: 6px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 12px 8px; border-bottom: 1px solid #E5E7EB; font-size: 13px; text-align: left; }
        th { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #6B7280; }
        .footer { margin-top: 24px; color: #9CA3AF; font-size: 11px; }
      </style></head><body>
      <h1>All My Costs</h1>
      <div class="sub">Récapitulatif des abonnements — ${escapeHtml(user?.name || "")}</div>
      <div class="totals">
        <div class="card"><div class="label">Total mensuel</div><div class="val">${formatAmount(monthlyTotal, baseCurrency)}</div></div>
        <div class="card"><div class="label">Total annuel</div><div class="val">${formatAmount(yearlyTotal, baseCurrency)}</div></div>
      </div>
      <table>
        <thead><tr><th>Nom</th><th>Catégorie</th><th>Cycle</th><th style="text-align:right">Prix</th><th style="text-align:right">Équivalent mensuel</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="footer">Généré le ${new Date().toLocaleString("fr-FR")} — Devise principale : ${totalsCurrency.code}</div>
      </body></html>`;

    try {
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "Exporter le PDF" });
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
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <BrandLogo size={36} />
          <Text style={styles.brand}>All My Costs</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
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
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  brand: { fontSize: 18, fontWeight: "800", color: theme.text, letterSpacing: -0.3 },
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
