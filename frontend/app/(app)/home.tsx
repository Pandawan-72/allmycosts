import { useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import * as Icons from "lucide-react-native";
import { CoinLogo } from "@/src/components/CoinLogo";
import { theme } from "@/src/theme";
import { useAuth } from "@/src/contexts/AuthContext";
import { useSubscriptions } from "@/src/contexts/SubscriptionsContext";
import { findCategory, DEFAULT_CATEGORIES } from "@/src/data/categories";
import { findCurrency, formatAmount } from "@/src/data/currencies";

function CatIcon({ name, color, size = 22 }: { name: string; color: string; size?: number }) {
  const Cmp = (Icons as any)[name] || (Icons as any).Tag;
  return <Cmp color={color} size={size} strokeWidth={2} />;
}

export default function Home() {
  const router = useRouter();
  const { user } = useAuth();
  const { subscriptions, customCategories, baseCurrency, monthlyTotal, yearlyTotal, deleteSubscription } = useSubscriptions();
  const [view, setView] = useState<"monthly" | "yearly">("monthly");

  const allCats = useMemo(() => [...DEFAULT_CATEGORIES, ...customCategories], [customCategories]);
  const totalsCurrency = findCurrency(baseCurrency);
  const totalAmount = view === "monthly" ? monthlyTotal : yearlyTotal;

  const exportPdf = async () => {
    if (subscriptions.length === 0) {
      Alert.alert("Aucun abonnement", "Ajoutez d'abord des abonnements pour exporter un PDF.");
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
      Alert.alert("Erreur", e?.message || "Impossible de générer le PDF.");
    }
  };

  const renderItem = ({ item }: any) => {
    const cat = findCategory(item.categoryId, customCategories);
    const cycleLabel = item.cycle === "monthly" ? "Mensuel" : "Annuel";
    return (
      <TouchableOpacity
        testID={`subscription-item-${item.name}`}
        onPress={() => router.push({ pathname: "/(app)/subscription", params: { id: item.id } })}
        onLongPress={() =>
          Alert.alert(item.name, "Que voulez-vous faire ?", [
            { text: "Annuler", style: "cancel" },
            { text: "Modifier", onPress: () => router.push({ pathname: "/(app)/subscription", params: { id: item.id } }) },
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
          <Text style={styles.subPrice}>{formatAmount(item.price, item.currency)}</Text>
          <Text style={styles.subCycle}>{cycleLabel}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <CoinLogo size={36} />
          <Text style={styles.brand}>All My Costs</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
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
            <View style={styles.heroCard}>
              <View style={styles.heroToggle}>
                <TouchableOpacity
                  testID="toggle-monthly"
                  onPress={() => setView("monthly")}
                  style={[styles.toggleBtn, view === "monthly" && styles.toggleBtnActive]}
                >
                  <Text style={[styles.toggleText, view === "monthly" && styles.toggleTextActive]}>Mensuel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID="toggle-yearly"
                  onPress={() => setView("yearly")}
                  style={[styles.toggleBtn, view === "yearly" && styles.toggleBtnActive]}
                >
                  <Text style={[styles.toggleText, view === "yearly" && styles.toggleTextActive]}>Annuel</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.heroLabel}>{view === "monthly" ? "TOTAL MENSUEL" : "TOTAL ANNUEL"}</Text>
              <Text testID="total-cost-display" style={styles.heroAmount}>
                {formatAmount(totalAmount, baseCurrency)}
              </Text>
              <Text style={styles.heroHint}>
                {subscriptions.filter((s) => s.currency === baseCurrency).length} abonnement(s) en {totalsCurrency.code}
              </Text>
            </View>
            <Text style={styles.sectionTitle}>Vos abonnements</Text>
            {subscriptions.length === 0 ? (
              <Text style={styles.empty}>Aucun abonnement pour l&apos;instant. Touchez le bouton + pour en ajouter un.</Text>
            ) : null}
          </View>
        }
      />

      <TouchableOpacity
        testID="add-subscription-button"
        onPress={() => router.push("/(app)/subscription")}
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
  fab: {
    position: "absolute", right: 20, bottom: 24, width: 60, height: 60, borderRadius: 30,
    backgroundColor: theme.primary, alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
});
