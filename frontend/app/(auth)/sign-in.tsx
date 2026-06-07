import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Platform } from "react-native";
import { KeyboardAvoidingView } from "react-native";
import { Link, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";

import { useAuth } from "@/src/contexts/AuthContext";
import { theme } from "@/src/theme";
import { CoinLogo } from "@/src/components/CoinLogo";
import { BrandLogo } from "@/src/components/BrandLogo";

export default function SignIn() {
  const router = useRouter();
  const { login, loginWithGoogleSession } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr(null);
    if (!email.trim() || !password) {
      setErr("Veuillez renseigner votre e-mail et votre mot de passe.");
      return;
    }
    setBusy(true);
    try {
      await login(email.trim().toLowerCase(), password);
      router.replace("/(app)/home");
    } catch (e: any) {
      setErr(e?.message || "Échec de la connexion.");
    } finally {
      setBusy(false);
    }
  };

  const googleSignIn = async () => {
    setErr(null);
    setBusy(true);
    try {
      const redirectUrl = Linking.createURL("auth");
      const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
      if (result.type === "success" && result.url) {
        const url = result.url;
        let sessionId: string | null = null;
        const hashIdx = url.indexOf("#");
        if (hashIdx >= 0) {
          const hash = url.slice(hashIdx + 1);
          const params = new URLSearchParams(hash);
          sessionId = params.get("session_id");
        }
        if (!sessionId) {
          const qIdx = url.indexOf("?");
          if (qIdx >= 0) {
            const params = new URLSearchParams(url.slice(qIdx + 1));
            sessionId = params.get("session_id");
          }
        }
        if (!sessionId) {
          setErr("Identifiant de session Google manquant.");
          return;
        }
        await loginWithGoogleSession(sessionId);
        router.replace("/(app)/home");
      }
    } catch (e: any) {
      setErr(e?.message || "Échec Google.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <BrandLogo size={56} />
            <Text style={styles.brandName}>All My Costs</Text>
          </View>

          <Text style={styles.title}>Bon retour.</Text>
          <Text style={styles.subtitle}>Suivez vos abonnements en un coup d&apos;œil.</Text>

          <View style={styles.form}>
            <Text style={styles.label}>E-mail</Text>
            <TextInput
              testID="signin-email-input"
              value={email}
              onChangeText={setEmail}
              placeholder="vous@exemple.com"
              placeholderTextColor={theme.textSubtle}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />

            <Text style={[styles.label, { marginTop: 16 }]}>Mot de passe</Text>
            <TextInput
              testID="signin-password-input"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={theme.textSubtle}
              secureTextEntry
              style={styles.input}
            />

            {err ? <Text testID="signin-error" style={styles.error}>{err}</Text> : null}

            <TouchableOpacity
              testID="signin-submit-button"
              onPress={submit}
              disabled={busy}
              style={[styles.primaryBtn, busy && { opacity: 0.6 }]}
            >
              <Text style={styles.primaryBtnText}>{busy ? "Connexion..." : "Se connecter"}</Text>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>ou</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              testID="signin-google-button"
              onPress={googleSignIn}
              disabled={busy}
              style={[styles.outlineBtn, busy && { opacity: 0.6 }]}
            >
              <Text style={styles.outlineBtnText}>Continuer avec Google</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.bottom}>
            <Text style={styles.bottomText}>Pas encore de compte ?</Text>
            <Link href="/(auth)/sign-up" asChild>
              <TouchableOpacity testID="goto-signup-link">
                <Text style={styles.bottomLink}> Créer un compte</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  container: { padding: 24, paddingTop: 16, paddingBottom: 32 },
  brand: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 32 },
  brandName: { fontSize: 18, fontWeight: "800", color: theme.text, letterSpacing: -0.3 },
  title: { fontSize: 36, fontWeight: "900", color: theme.text, letterSpacing: -1 },
  subtitle: { fontSize: 16, color: theme.textMuted, marginTop: 8, marginBottom: 28 },
  form: { gap: 0 },
  label: { fontSize: 12, fontWeight: "700", color: theme.textMuted, marginBottom: 8, letterSpacing: 1, textTransform: "uppercase" },
  input: {
    borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface,
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: theme.text,
  },
  error: { color: theme.danger, marginTop: 12, fontSize: 14 },
  primaryBtn: {
    backgroundColor: theme.primary, borderRadius: 999, paddingVertical: 16, alignItems: "center", marginTop: 24,
  },
  primaryBtnText: { color: theme.primaryInverse, fontWeight: "700", fontSize: 16 },
  divider: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: theme.border },
  dividerText: { color: theme.textMuted, fontSize: 12, textTransform: "uppercase", letterSpacing: 1 },
  outlineBtn: {
    borderWidth: 1, borderColor: theme.border, borderRadius: 999, paddingVertical: 16, alignItems: "center", backgroundColor: theme.surface,
  },
  outlineBtnText: { color: theme.text, fontWeight: "700", fontSize: 16 },
  bottom: { flexDirection: "row", justifyContent: "center", marginTop: 28 },
  bottomText: { color: theme.textMuted },
  bottomLink: { color: theme.text, fontWeight: "700" },
});
