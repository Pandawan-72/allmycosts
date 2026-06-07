import { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import * as Icons from "lucide-react-native";

import { theme } from "@/src/theme";
import { useAuth } from "@/src/contexts/AuthContext";
import { useSubscriptions } from "@/src/contexts/SubscriptionsContext";
import { useFxRatesEUR } from "@/src/hooks/useFxRates";
import { findCurrency } from "@/src/data/currencies";

const API = process.env.EXPO_PUBLIC_BACKEND_URL;
const EUR_PRICES = { monthly: 2.99, yearly: 23.88, lifetime: 69 };
const YEARLY_MONTHLY_EQUIV = 1.99;

type Plan = "monthly" | "yearly" | "lifetime";

function format(amount: number, code: string) {
  return `${amount.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${findCurrency(code).symbol}`;
}

export default function Paywall() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, token, refreshUser } = useAuth();
  const { baseCurrency } = useSubscriptions();
  const { convertFromEur } = useFxRatesEUR();
  const [busy, setBusy] = useState<Plan | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const trialHoursLeft = (() => {
    const te = user?.pro?.trial_end;
    if (!te || user?.pro?.plan !== "trialing") return 0;
    return Math.max(0, Math.ceil((new Date(te).getTime() - Date.now()) / 3600000));
  })();

  const localEur = (plan: Plan) => format(EUR_PRICES[plan], "EUR");
  const localConverted = (eur: number) => baseCurrency === "EUR" ? null : format(convertFromEur(eur, baseCurrency), baseCurrency);

  const start = async (plan: Plan) => {
    setErr(null);
    setBusy(plan);
    try {
      const successUrl = Platform.OS === "web"
        ? `${window.location.origin}/pay-return?plan=${plan}`
        : Linking.createURL(`/pay-return?plan=${plan}`);
      const cancelUrl = Platform.OS === "web"
        ? `${window.location.origin}/(app)/paywall`
        : Linking.createURL(`/(app)/paywall`);

      const res = await fetch(`${API}/api/stripe/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan, success_url: successUrl, cancel_url: cancelUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "Erreur paiement");

      if (data.stub) {
        // Test/stub mode: confirm directly via helper endpoint
        await fetch(`${API}/api/stripe/confirm-stub`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ plan }),
        });
        await refreshUser();
        router.replace("/(app)/home");
        return;
      }

      if (Platform.OS === "web") {
        window.location.href = data.url;
      } else {
        await WebBrowser.openAuthSessionAsync(data.url, successUrl);
        await refreshUser();
      }
    } catch (e: any) {
      setErr(e?.message || "Erreur");
    } finally {
      setBusy(null);
    }
  };

  const features = [t("paywall.feat1"), t("paywall.feat2"), t("paywall.feat3"), t("paywall.feat4"), t("paywall.feat5"), t("paywall.feat6")];

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity testID="close-paywall" onPress={() => router.back()} style={styles.headerBtn}>
          <Icons.X color={theme.text} size={22} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("paywall.title")}</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <Text style={styles.h1}>{t("paywall.title")}</Text>
        <Text style={styles.sub}>{t("paywall.subtitle")}</Text>

        {user?.pro?.plan === "trialing" && trialHoursLeft > 0 ? (
          <View style={styles.trialPill}>
            <Icons.Sparkles color={theme.accent} size={14} />
            <Text style={styles.trialPillText}>{t("paywall.inTrial", { hours: trialHoursLeft })}</Text>
          </View>
        ) : null}
        {user?.pro?.plan === "expired" ? (
          <View style={[styles.trialPill, { backgroundColor: "#FEF2F2", borderColor: theme.danger }]}>
            <Icons.AlertCircle color={theme.danger} size={14} />
            <Text style={[styles.trialPillText, { color: theme.danger }]}>{t("paywall.trialEnded")}</Text>
          </View>
        ) : null}

        <View style={styles.featList}>
          {features.map((f, i) => (
            <View key={i} style={styles.featRow}>
              <Icons.Check color={theme.accent} size={18} strokeWidth={3} />
              <Text style={styles.featText}>{f}</Text>
            </View>
          ))}
        </View>

        {/* Yearly - highlighted */}
        <View style={[styles.planCard, styles.planCardHighlight]}>
          <View style={styles.popularBadge}>
            <Text style={styles.popularBadgeText}>{t("paywall.popular")}</Text>
          </View>
          <View style={styles.saveBadge}>
            <Text style={styles.saveBadgeText}>{t("paywall.save")}</Text>
          </View>
          <Text style={[styles.planName, { color: "#fff" }]}>{t("common.yearly")}</Text>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 4 }}>
            <Text style={[styles.planPrice, { color: "#fff" }]}>{format(YEARLY_MONTHLY_EQUIV, "EUR")}</Text>
            <Text style={[styles.planUnit, { color: "#9CA3AF" }]}>{t("paywall.perMonth")}</Text>
          </View>
          <Text style={styles.planDescDark}>{t("paywall.yearlyDesc", { price: localEur("yearly") })}</Text>
          {localConverted(EUR_PRICES.yearly) ? <Text style={styles.planFxDark}>{t("paywall.inLocal", { amount: localConverted(EUR_PRICES.yearly) })}</Text> : null}
          <TouchableOpacity testID="buy-yearly" onPress={() => start("yearly")} disabled={!!busy}
            style={[styles.planBtn, { backgroundColor: theme.accent }]}>
            {busy === "yearly" ? <ActivityIndicator color="#fff" /> :
              <Text style={[styles.planBtnText, { color: "#fff" }]}>{t("paywall.chooseYearly")}</Text>}
          </TouchableOpacity>
        </View>

        {/* Monthly */}
        <View style={styles.planCard}>
          <Text style={styles.planName}>{t("common.monthly")}</Text>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 4 }}>
            <Text style={styles.planPrice}>{localEur("monthly")}</Text>
            <Text style={styles.planUnit}>{t("paywall.perMonth")}</Text>
          </View>
          <Text style={styles.planDesc}>{t("paywall.monthlyDesc")}</Text>
          {localConverted(EUR_PRICES.monthly) ? <Text style={styles.planFx}>{t("paywall.inLocal", { amount: localConverted(EUR_PRICES.monthly) })}</Text> : null}
          <TouchableOpacity testID="buy-monthly" onPress={() => start("monthly")} disabled={!!busy} style={styles.planBtn}>
            {busy === "monthly" ? <ActivityIndicator color={theme.text} /> :
              <Text style={styles.planBtnText}>{t("paywall.chooseMonthly")}</Text>}
          </TouchableOpacity>
        </View>

        {/* Lifetime */}
        <View style={[styles.planCard, { borderColor: theme.accent, borderStyle: "dashed" }]}>
          <Text style={styles.planName}>{t("common.lifetime")}</Text>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 4 }}>
            <Text style={styles.planPrice}>{localEur("lifetime")}</Text>
            <Text style={styles.planUnit}>{t("paywall.once")}</Text>
          </View>
          <Text style={styles.planDesc}>{t("paywall.lifetimeDesc")}</Text>
          {localConverted(EUR_PRICES.lifetime) ? <Text style={styles.planFx}>{t("paywall.inLocal", { amount: localConverted(EUR_PRICES.lifetime) })}</Text> : null}
          <TouchableOpacity testID="buy-lifetime" onPress={() => start("lifetime")} disabled={!!busy} style={styles.planBtn}>
            {busy === "lifetime" ? <ActivityIndicator color={theme.text} /> :
              <Text style={styles.planBtnText}>{t("paywall.chooseLifetime")}</Text>}
          </TouchableOpacity>
        </View>

        {err ? <Text testID="paywall-error" style={{ color: theme.danger, textAlign: "center", marginTop: 16 }}>{err}</Text> : null}

        <Text style={styles.note}>{t("paywall.restoreNote")}</Text>
        {baseCurrency !== "EUR" ? <Text style={styles.note}>{t("paywall.inFxNote")}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  header: { paddingHorizontal: 12, paddingVertical: 8, flexDirection: "row", justifyContent: "space-between",
            alignItems: "center", borderBottomWidth: 1, borderBottomColor: theme.border },
  headerBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 16, fontWeight: "800", color: theme.text },
  h1: { fontSize: 34, fontWeight: "900", color: theme.text, letterSpacing: -1 },
  sub: { fontSize: 16, color: theme.textMuted, marginTop: 6, marginBottom: 18 },
  trialPill: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start",
               backgroundColor: theme.accentSoft, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
               borderWidth: 1, borderColor: theme.accent, marginBottom: 16 },
  trialPillText: { fontSize: 12, fontWeight: "700", color: theme.accent },
  featList: { marginBottom: 24 },
  featRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  featText: { fontSize: 15, color: theme.text, fontWeight: "500" },
  planCard: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 20,
              padding: 20, marginBottom: 14, position: "relative", overflow: "hidden" },
  planCardHighlight: { backgroundColor: theme.primary, borderColor: theme.primary, paddingTop: 28 },
  popularBadge: { position: "absolute", top: 0, left: 0, backgroundColor: theme.accent,
                  paddingHorizontal: 12, paddingVertical: 4, borderBottomRightRadius: 12 },
  popularBadgeText: { color: "#fff", fontSize: 10, fontWeight: "900", letterSpacing: 1.5 },
  saveBadge: { position: "absolute", top: 0, right: 0, backgroundColor: "#FFFFFF",
               paddingHorizontal: 12, paddingVertical: 4, borderBottomLeftRadius: 12 },
  saveBadgeText: { color: theme.primary, fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  planName: { fontSize: 18, fontWeight: "800", color: theme.text },
  planPrice: { fontSize: 32, fontWeight: "900", color: theme.text, letterSpacing: -1 },
  planUnit: { fontSize: 13, color: theme.textMuted },
  planDesc: { fontSize: 13, color: theme.textMuted, marginTop: 6 },
  planDescDark: { fontSize: 13, color: "#D1D5DB", marginTop: 6 },
  planFx: { fontSize: 12, color: theme.textSubtle, marginTop: 4 },
  planFxDark: { fontSize: 12, color: "#9CA3AF", marginTop: 4 },
  planBtn: { backgroundColor: theme.surfaceAlt, borderRadius: 999, paddingVertical: 14, alignItems: "center", marginTop: 14 },
  planBtnText: { color: theme.text, fontWeight: "800", fontSize: 15 },
  note: { color: theme.textSubtle, fontSize: 12, textAlign: "center", marginTop: 12, lineHeight: 18 },
});
