import { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import * as Icons from "lucide-react-native";

import { useTheme } from "@/src/contexts/ThemeContext";
import { useAuth } from "@/src/contexts/AuthContext";
import {
  configureRC,
  fetchOfferingPackages,
  isRevenueCatSupported,
  purchaseRCPackage,
  restorePurchasesRC,
  RCPackageInfo,
  RCPlan,
} from "@/src/lib/revenuecat";

// Business model : lifetime uniquement à 5,99€

function format(amount: number) {
  return `${amount.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

export default function Paywall() {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const router = useRouter();
  const { t } = useTranslation();
  const { isPro, refreshPro } = useAuth();
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [packages, setPackages] = useState<RCPackageInfo[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isRevenueCatSupported()) return;
      await configureRC();
      const pkgs = await fetchOfferingPackages();
      if (!cancelled) setPackages(pkgs);
    })();
    return () => { cancelled = true; };
  }, []);

  const findPackageByPlan = (plan: RCPlan): RCPackageInfo | null =>
    packages.find((p) => p.plan === plan) || null;

  const lifetimePrice = packages.find(p => p.plan === "lifetime")?.priceString || "";

  const onPurchase = async () => {
    setErr(null);
    setBusy(true);
    try {
      if (isRevenueCatSupported()) {
        const pkg = findPackageByPlan("lifetime");
        if (!pkg) throw new Error(t("paywall.offerUnavailable"));
        const res = await purchaseRCPackage(pkg.rcPackage);
        if (res.userCancelled) return;
          router.replace("/(app)/home");
      }
    } catch (e: any) {
      setErr(e?.message || t("paywall.purchaseError"));
    } finally {
      setBusy(false);
    }
  };

  const onRestore = async () => {
    setErr(null);
    setRestoring(true);
    try {
      if (isRevenueCatSupported()) {
        await restorePurchasesRC();
      }
    } catch (e: any) {
      setErr(e?.message || t("paywall.genericError"));
    } finally {
      setRestoring(false);
    }
  };



  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity testID="close-paywall" onPress={() => router.back()} style={styles.headerBtn}>
          <Icons.X color={theme.text} size={22} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("paywall.headerTitle")}</Text>
        <TouchableOpacity testID="restore-purchases" onPress={onRestore} style={styles.headerBtn} disabled={restoring}>
          {restoring ? <ActivityIndicator size="small" color={theme.text} /> : <Icons.RotateCcw color={theme.text} size={20} />}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>

        {isPro ? (
          <View style={styles.alreadyPro}>
            <Icons.Crown color={theme.accent} size={20} />
            <Text style={styles.alreadyProTitle}>{t("paywall.alreadyPro")}</Text>
          </View>
        ) : null}

        <Text style={styles.h1}>{t("paywall.unlockEverything")}</Text>
            <Text style={styles.sub}>{t("paywall.onceForever")}</Text>

            {/* Comparaison gratuit vs pro */}
            <View style={styles.compareCard}>
              <View style={styles.compareCol}>
                <Text style={styles.compareTitle}>{t("paywall.free")}</Text>
                <View style={styles.compareRow}>
                  <Icons.Check color={theme.accent} size={16} strokeWidth={3} />
                  <Text style={styles.compareText}>{t("paywall.freeLimitFeature")}</Text>
                </View>
                <View style={styles.compareRow}>
                  <Icons.Check color={theme.accent} size={16} strokeWidth={3} />
                  <Text style={styles.compareText}>{t("paywall.darkModeFeature")}</Text>
                </View>
                <View style={styles.compareRow}>
                  <Icons.X color={theme.danger} size={16} strokeWidth={3} />
                  <Text style={[styles.compareText, { color: theme.textMuted }]}>{t("paywall.statsFeature")}</Text>
                </View>
                <View style={styles.compareRow}>
                  <Icons.X color={theme.danger} size={16} strokeWidth={3} />
                  <Text style={[styles.compareText, { color: theme.textMuted }]}>{t("paywall.pdfFeature")}</Text>
                </View>
                <View style={styles.compareRow}>
                  <Icons.X color={theme.danger} size={16} strokeWidth={3} />
                  <Text style={[styles.compareText, { color: theme.textMuted }]}>{t("paywall.unlimitedCategoriesFeature")}</Text>
                </View>
                <View style={styles.compareRow}>
                  <Icons.X color={theme.danger} size={16} strokeWidth={3} />
                  <Text style={[styles.compareText, { color: theme.textMuted }]}>{t("paywall.backupFeature")}</Text>
                </View>
                <View style={styles.compareRow}>
                  <Icons.X color={theme.danger} size={16} strokeWidth={3} />
                  <Text style={[styles.compareText, { color: theme.textMuted }]}>{t("paywall.receiptScanFeature")}</Text>
                </View>
              </View>

              <View style={styles.compareDivider} />

              <View style={styles.compareCol}>
                <Text style={[styles.compareTitle, { color: theme.accent }]}>{t("paywall.proColumn")}</Text>
                <View style={styles.compareRow}>
                  <Icons.Check color={theme.accent} size={16} strokeWidth={3} />
                  <Text style={styles.compareText}>{t("paywall.unlimitedExpensesFeature")}</Text>
                </View>
                <View style={styles.compareRow}>
                  <Icons.Check color={theme.accent} size={16} strokeWidth={3} />
                  <Text style={styles.compareText}>{t("paywall.darkModeFeature")}</Text>
                </View>
                <View style={styles.compareRow}>
                  <Icons.Check color={theme.accent} size={16} strokeWidth={3} />
                  <Text style={styles.compareText}>{t("paywall.statsFeature")}</Text>
                </View>
                <View style={styles.compareRow}>
                  <Icons.Check color={theme.accent} size={16} strokeWidth={3} />
                  <Text style={styles.compareText}>{t("paywall.pdfFeature")}</Text>
                </View>
                <View style={styles.compareRow}>
                  <Icons.Check color={theme.accent} size={16} strokeWidth={3} />
                  <Text style={styles.compareText}>{t("paywall.unlimitedCategoriesFeature")}</Text>
                </View>
                <View style={styles.compareRow}>
                  <Icons.Check color={theme.accent} size={16} strokeWidth={3} />
                  <Text style={styles.compareText}>{t("paywall.backupFeature")}</Text>
                </View>
                <View style={styles.compareRow}>
                  <Icons.Check color={theme.accent} size={16} strokeWidth={3} />
                  <Text style={styles.compareText}>{t("paywall.receiptScanFeature")}</Text>
                </View>
              </View>
            </View>

            {/* Offre lifetime */}
            <View style={styles.planCard}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{t("paywall.oneTimePayment")}</Text>
              </View>
              <Text style={styles.planName}>{t("paywall.planName")}</Text>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 8 }}>
                <Text style={styles.planPrice}>{lifetimePrice}</Text>
                <Text style={styles.planUnit}>{t("paywall.onceLabel")}</Text>
              </View>
              <Text style={styles.planDesc}>{t("paywall.planDesc")}</Text>

              <TouchableOpacity
                testID="buy-lifetime"
                onPress={onPurchase}
                disabled={busy}
                style={[styles.planBtn, busy && { opacity: 0.6 }]}
              >
                {busy
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.planBtnText}>{t("paywall.buyNow", { price: lifetimePrice })}</Text>
                }
              </TouchableOpacity>
            </View>

            {err ? (
              <Text testID="paywall-error" style={{ color: theme.danger, textAlign: "center", marginTop: 16 }}>{err}</Text>
            ) : null}

            <TouchableOpacity testID="restore-link" onPress={onRestore} disabled={restoring} style={{ marginTop: 14, alignSelf: "center" }}>
              <Text style={{ color: theme.textMuted, fontSize: 13, fontWeight: "700", textDecorationLine: "underline" }}>
                {t("paywall.restore")}
              </Text>
            </TouchableOpacity>

            <Text style={styles.note}>{t("paywall.googlePlayNote")}</Text>
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
  h1: { fontSize: 34, fontWeight: "900", color: theme.text, letterSpacing: -1 },
  sub: { fontSize: 16, color: theme.textMuted, marginTop: 6, marginBottom: 24 },
  alreadyPro: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: theme.accentSoft, borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: theme.accent },
  alreadyProTitle: { fontSize: 16, fontWeight: "800", color: theme.accent },
  compareCard: {
    flexDirection: "row", backgroundColor: theme.surface, borderRadius: 20,
    borderWidth: 1, borderColor: theme.border, padding: 20, marginBottom: 24, gap: 12,
  },
  compareCol: { flex: 1, gap: 10 },
  compareTitle: { fontSize: 14, fontWeight: "800", color: theme.text, marginBottom: 4 },
  compareRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  compareText: { fontSize: 12, color: theme.text, fontWeight: "500" },
  compareDivider: { width: 1, backgroundColor: theme.border },
  planCard: {
    backgroundColor: theme.cardBg, borderRadius: 20, padding: 24,
    position: "relative", overflow: "hidden",
  },
  badge: {
    position: "absolute", top: 0, left: 0,
    backgroundColor: theme.accent, paddingHorizontal: 12, paddingVertical: 4,
    borderBottomRightRadius: 12,
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "900", letterSpacing: 1.5 },
  planName: { color: "#fff", fontSize: 20, fontWeight: "900", marginTop: 16 },
  planPrice: { color: theme.accent, fontSize: 40, fontWeight: "900", letterSpacing: -1 },
  planUnit: { color: "#9CA3AF", fontSize: 13 },
  planDesc: { color: "#D1D5DB", fontSize: 13, marginTop: 8 },
  planBtn: {
    backgroundColor: theme.accent, borderRadius: 999,
    paddingVertical: 16, alignItems: "center", marginTop: 20,
  },
  planBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  note: { color: theme.textSubtle, fontSize: 12, textAlign: "center", marginTop: 16, lineHeight: 18 },
});
}
