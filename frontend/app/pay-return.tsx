import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Icons from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { theme } from "@/src/theme";
import { useAuth } from "@/src/contexts/AuthContext";

export default function PayReturn() {
  const router = useRouter();
  const { plan } = useLocalSearchParams<{ plan?: string }>();
  const { user, refreshUser, loading } = useAuth();
  const { t } = useTranslation();
  const [tries, setTries] = useState(0);

  const isPaid = ["active_monthly", "active_yearly", "lifetime"].includes(user?.pro?.plan || "");

  // Poll for the webhook to land — try a few times.
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      for (let i = 0; i < 8; i++) {
        if (cancelled) return;
        await refreshUser();
        if (cancelled) return;
        setTries(i + 1);
        await new Promise((r) => setTimeout(r, 1500));
      }
    };
    if (!loading && user) run();
    return () => { cancelled = true; };
  }, [loading, user, refreshUser]);

  // Once paid, auto-redirect home after a beat.
  useEffect(() => {
    if (isPaid) {
      const id = setTimeout(() => router.replace("/(app)/home"), 1200);
      return () => clearTimeout(id);
    }
  }, [isPaid, router]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.center}>
        <View style={[styles.iconWrap, isPaid && { backgroundColor: theme.accentSoft, borderColor: theme.accent }]}>
          {isPaid ? (
            <Icons.Check color={theme.accent} size={36} strokeWidth={3} />
          ) : (
            <ActivityIndicator color={theme.text} size="large" />
          )}
        </View>
        <Text style={styles.title}>
          {isPaid ? (t("paywall.successTitle") || "Bienvenue dans Pro !") : "Finalisation du paiement…"}
        </Text>
        <Text style={styles.sub}>
          {isPaid
            ? (t("paywall.successDesc") || "Toutes les fonctionnalités sont débloquées.")
            : `Activation en cours${plan ? ` (${plan})` : ""}… ${tries}/8`}
        </Text>
        {!isPaid && tries >= 6 ? (
          <TouchableOpacity onPress={() => router.replace("/(app)/home")} style={styles.btn}>
            <Text style={styles.btnText}>Continuer</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  iconWrap: {
    width: 88, height: 88, borderRadius: 44, borderWidth: 2, borderColor: theme.border,
    backgroundColor: theme.surface, alignItems: "center", justifyContent: "center", marginBottom: 24,
  },
  title: { fontSize: 24, fontWeight: "900", color: theme.text, textAlign: "center", letterSpacing: -0.5 },
  sub: { fontSize: 14, color: theme.textMuted, textAlign: "center", marginTop: 10, lineHeight: 20 },
  btn: { marginTop: 28, backgroundColor: theme.primary, borderRadius: 999, paddingVertical: 14, paddingHorizontal: 28 },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
});
