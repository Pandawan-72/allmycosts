import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Platform, Modal, ActivityIndicator } from "react-native";
import { KeyboardAvoidingView } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import * as Icons from "lucide-react-native";

import { useAuth } from "@/src/contexts/AuthContext";
import { useTheme } from "@/src/contexts/ThemeContext";
import { BrandLockup } from "@/src/components/BrandLockup";
import {
  isGoogleNativeSupported,
  nativeGoogleSignIn,
  emergentWebGoogleSignIn,
} from "@/src/lib/googleAuth";
import { firebaseSendPasswordReset } from "@/src/lib/firebaseAuth";

export default function SignIn() {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
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
          <View style={styles.logoWrap}>
            <BrandLockup height={56} />
            <Text style={styles.tagline}>{t("app.tagline")}</Text>
          </View>

          <Text style={styles.title}>{t("auth.signIn")}</Text>

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
            style={[styles.btn, busy && { opacity: 0.6 }]}
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{t("auth.signIn")}</Text>}
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
            style={[styles.googleBtn, busy && { opacity: 0.6 }]}
          >
            {busy
              ? <ActivityIndicator color={theme.text} />
              : <>
                  <Icons.Globe color={theme.text} size={20} />
                  <Text style={styles.googleBtnText}>{t("auth.continueWithGoogle")}</Text>
                </>
            }
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push("/(auth)/sign-up")} style={styles.switchRow}>
            <Text style={styles.switchText}>{t("auth.noAccount")} </Text>
            <Text style={[styles.switchText, { color: theme.accent, fontWeight: "700" }]}>{t("auth.goSignUp")}</Text>
          </TouchableOpacity>
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
                style={[styles.btn, { marginTop: 4 }, resetLoading && { opacity: 0.6 }]}
              >
                {resetLoading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.btnText}>{t("auth.resetSend")}</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowForgot(false)} style={{ alignItems: "center", marginTop: 16 }}>
                <Text style={[styles.switchText, { fontWeight: "700", color: theme.text }]}>{t("common.cancel")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles(theme: any) { return StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  container: { flexGrow: 1, backgroundColor: theme.bg, padding: 24, justifyContent: "center" },
  logoWrap: { alignItems: "center", marginBottom: 40 },
  tagline: { fontSize: 14, color: theme.textMuted, marginTop: 12, textAlign: "center" },
  title: { fontSize: 24, fontWeight: "900", color: theme.text, marginBottom: 24 },
  input: {
    backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border,
    borderRadius: 14, padding: 14, fontSize: 15, color: theme.text, marginBottom: 12,
  },
  error: { color: theme.danger, fontSize: 13, marginBottom: 12 },
  btn: { backgroundColor: theme.cardBg, borderRadius: 14, padding: 16, alignItems: "center", marginTop: 4 },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  divider: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: theme.border },
  dividerText: { color: theme.textMuted, fontSize: 13 },
  googleBtn: {
    backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border,
    borderRadius: 14, padding: 16, flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 10,
  },
  googleBtnText: { color: theme.text, fontWeight: "700", fontSize: 15 },
  switchRow: { flexDirection: "row", justifyContent: "center", marginTop: 24 },
  switchText: { fontSize: 14, color: theme.textMuted },
  forgotLink: { alignSelf: "flex-end", marginTop: -6, marginBottom: 12 },
  forgotLinkText: { color: theme.accent, fontSize: 13, fontWeight: "700" },
  success: { color: theme.accent, fontSize: 13, marginBottom: 12 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 24 },
  modalContent: { backgroundColor: theme.bg, borderRadius: 20, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: "900", color: theme.text, marginBottom: 8 },
  modalDesc: { fontSize: 14, color: theme.textMuted, lineHeight: 20, marginBottom: 16 },
});
}
