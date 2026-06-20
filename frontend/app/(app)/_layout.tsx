import { useEffect } from "react";
import { Stack, useRouter } from "expo-router";
import { useAuth } from "@/src/contexts/AuthContext";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useTheme } from "@/src/contexts/ThemeContext";
import { configureRC, loginRC } from "@/src/lib/revenuecat";

export default function AppLayout() {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/(auth)/sign-in");
    }
  }, [loading, user, router]);

  // Configure RevenueCat and bind App User ID to the authenticated user
  useEffect(() => {
    if (!user?.user_id) return;
    (async () => {
      await configureRC(user.user_id);
      await loginRC(user.user_id);
    })();
  }, [user?.user_id]);

  if (loading || !user) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.text} />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

function makeStyles(theme: any) { return StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.bg },
});
}
