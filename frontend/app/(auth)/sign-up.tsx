import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Platform, KeyboardAvoidingView } from "react-native";
import { Link, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/src/contexts/AuthContext";
import { theme } from "@/src/theme";
import { CoinLogo } from "@/src/components/CoinLogo";
import { BrandLogo } from "@/src/components/BrandLogo";

export default function SignUp() {
  const router = useRouter();
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr(null);
    if (!name.trim() || !email.trim() || !password) {
      setErr("Tous les champs sont requis.");
      return;
    }
    if (password.length < 6) {
      setErr("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    setBusy(true);
    try {
      await register(name.trim(), email.trim().toLowerCase(), password);
      router.replace("/(app)/home");
    } catch (e: any) {
      setErr(e?.message || "Échec de la création du compte.");
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

          <Text style={styles.title}>Créer un compte.</Text>
          <Text style={styles.subtitle}>Maîtrisez vos dépenses récurrentes.</Text>

          <View>
            <Text style={styles.label}>Nom</Text>
            <TextInput
              testID="signup-name-input"
              value={name}
              onChangeText={setName}
              placeholder="Votre nom"
              placeholderTextColor={theme.textSubtle}
              style={styles.input}
              autoCapitalize="words"
            />

            <Text style={[styles.label, { marginTop: 16 }]}>E-mail</Text>
            <TextInput
              testID="signup-email-input"
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
              testID="signup-password-input"
              value={password}
              onChangeText={setPassword}
              placeholder="6 caractères minimum"
              placeholderTextColor={theme.textSubtle}
              secureTextEntry
              style={styles.input}
            />

            {err ? <Text testID="signup-error" style={styles.error}>{err}</Text> : null}

            <TouchableOpacity
              testID="signup-submit-button"
              onPress={submit}
              disabled={busy}
              style={[styles.primaryBtn, busy && { opacity: 0.6 }]}
            >
              <Text style={styles.primaryBtnText}>{busy ? "Création..." : "Créer mon compte"}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.bottom}>
            <Text style={styles.bottomText}>Déjà un compte ?</Text>
            <Link href="/(auth)/sign-in" asChild>
              <TouchableOpacity testID="goto-signin-link">
                <Text style={styles.bottomLink}> Se connecter</Text>
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
  label: { fontSize: 12, fontWeight: "700", color: theme.textMuted, marginBottom: 8, letterSpacing: 1, textTransform: "uppercase" },
  input: {
    borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface,
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: theme.text,
  },
  error: { color: theme.danger, marginTop: 12, fontSize: 14 },
  primaryBtn: { backgroundColor: theme.primary, borderRadius: 999, paddingVertical: 16, alignItems: "center", marginTop: 24 },
  primaryBtnText: { color: theme.primaryInverse, fontWeight: "700", fontSize: 16 },
  bottom: { flexDirection: "row", justifyContent: "center", marginTop: 28 },
  bottomText: { color: theme.textMuted },
  bottomLink: { color: theme.text, fontWeight: "700" },
});
