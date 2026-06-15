import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Platform, Modal, ActivityIndicator } from "react-native";
import { KeyboardAvoidingView } from "react-native";
import { Link, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/src/contexts/AuthContext";
import { theme } from "@/src/theme";
import { BrandLockup } from "@/src/components/BrandLockup";
import {
  isGoogleNativeSupported,
  nativeGoogleSignIn,
  emergentWebGoogleSignIn,
} from "@/src/lib/googleAuth";
import { firebaseSendPasswordReset } from "@/src/lib/firebaseAuth";

export default function SignIn() {
  const router = useRouter();
  const { t } = useTranslation();
  const { login, loginWithGoogleSession, loginWithGoogleIdToken } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMsg, setResetMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const submit = async () => {
    setErr(null);
    if (!email.trim() || !password) {
      setErr(t("auth.fillCreds"));
      return;
    }
    setBusy(true);
    try {
      await login(email.trim().toLowerCase(), password);
      router.replace("/(app)/home");
    } catch (e: any) {
      setErr(e?.message || t("auth.signInFailed"));
    } finally {
      setBusy(false);
    }
  };

  const googleSignIn = async () => {
    setErr(null);
    setBusy(true);
    try {
      if (isGoogleNativeSupported()) {
        // Native iOS/Android flow via Google Sign-In SDK
        const idToken = await nativeGoogleSignIn();
        if (!idToken) return; // user cancelled
        await loginWithGoogleIdToken(idToken);
        router.replace("/(app)/home");
      } else {
        // Web fallback via Emergent OAuth (session_id flow)
        const sessionId = await emergentWebGoogleSignIn();
        if (!sessionId) return; // user cancelled or pending redirect
        await loginWithGoogleSession(sessionId);
        router.replace("/(app)/home");
      }
    } catch (e: any) {
      setErr(e?.message || t("auth.googleFailed"));
    } finally {
      setBusy(false);
    }
  };

  const onResetPassword = async () => {
    if (!resetEmail) return;
    setResetLoading(true);
    setResetMsg(null);
    try {
      await firebaseSendPasswordReset(resetEmail.trim());
      setResetMsg({ type: "success", text: t("auth.resetSuccess") });
    } catch {
      setResetMsg({ type: "error", text: t("auth.resetError") });
    } finally {
      setResetLoading(false);
    }
  };

  const openForgotPassword = () => {
    setResetEmail(email);
    setResetMsg(null);
    setShowForgot(true);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <BrandLockup height={56} />
          </View>

          <Text style={styles.title}>{t("auth.welcome")}</Text>
          <Text style={styles.subtitle}>{t("app.tagline")}</Text>

          <View style={styles.form}>
            <Text style={styles.label}>{t("auth.email")}</Text>
            <TextInput
              testID="signin-email-input"
              value={email}
              onChangeText={setEmail}
              placeholder={t("auth.emailPh")}
              placeholderTextColor={theme.textSubtle}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />

            <Text style={[styles.label, { marginTop: 16 }]}>{t("auth.password")}</Text>
            <TextInput
              testID="signin-password-input"
              value={password}
              onChangeText={setPassword}
              placeholder={t("auth.passwordPh")}
              placeholderTextColor={theme.textSubtle}
              secureTextEntry
              style={styles.input}
            />

            <TouchableOpacity testID="forgot-password-link" onPress={openForgotPassword} style={styles.forgotLink}>
              <Text style={styles.forgotLinkText}>{t("auth.forgotPassword")}</Text>
            </TouchableOpacity>

            {err ? <Text testID="signin-error" style={styles.error}>{err}</Text> : null}

            <TouchableOpacity
              testID="signin-submit-button"
              onPress={submit}
              disabled={busy}
              style={[styles.primaryBtn, busy && { opacity: 0.6 }]}
            >
              <Text style={styles.primaryBtnText}>{busy ? t("auth.signingIn") : t("auth.signIn")}</Text>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{t("auth.or")}</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              testID="signin-google-button"
              onPress={googleSignIn}
              disabled={busy}
              style={[styles.outlineBtn, busy && { opacity: 0.6 }]}
            >
              <Text style={styles.outlineBtnText}>{t("auth.continueWithGoogle")}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.bottom}>
            <Text style={styles.bottomText}>{t("auth.noAccount")}</Text>
            <Link href="/(auth)/sign-up" asChild>
              <TouchableOpacity testID="goto-signup-link">
                <Text style={styles.bottomLink}> {t("auth.goSignUp")}</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </ScrollView>

        <Modal visible={showForgot} transparent animationType="slide" onRequestClose={() => setShowForgot(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{t("auth.resetTitle")}</Text>
              <Text style={styles.modalDesc}>{t("auth.resetDesc")}</Text>
              <TextInput
                value={resetEmail}
                onChangeText={setResetEmail}
                placeholder={t("auth.emailPh")}
                placeholderTextColor={theme.textSubtle}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
              />
              {resetMsg ? (
                <Text style={resetMsg.type === "error" ? styles.error : styles.success}>{resetMsg.text}</Text>
              ) : null}
              <TouchableOpacity
                onPress={onResetPassword}
                disabled={resetLoading}
                style={[styles.primaryBtn, { marginTop: 16 }, resetLoading && { opacity: 0.6 }]}
              >
                {resetLoading
                  ? <ActivityIndicator color={theme.primaryInverse} />
                  : <Text style={styles.primaryBtnText}>{t("auth.resetSend")}</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowForgot(false)} style={{ alignItems: "center", marginTop: 16 }}>
                <Text style={styles.bottomLink}>{t("common.cancel")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
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
  forgotLink: { alignSelf: "flex-end", marginTop: 12 },
  forgotLinkText: { color: theme.text, fontSize: 13, fontWeight: "700" },
  success: { color: theme.text, marginTop: 12, fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 24 },
  modalContent: { backgroundColor: theme.bg, borderRadius: 20, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: "900", color: theme.text, marginBottom: 8 },
  modalDesc: { fontSize: 14, color: theme.textMuted, lineHeight: 20, marginBottom: 16 },
});
