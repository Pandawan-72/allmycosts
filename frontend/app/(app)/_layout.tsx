import { useEffect } from "react";
import { Stack } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { configureRC } from "@/src/lib/revenuecat";
import { useAuth } from "@/src/contexts/AuthContext";
import { useTheme } from "@/src/contexts/ThemeContext";

export default function AppLayout() {
  const { loading } = useAuth();
  const { theme } = useTheme();

  useEffect(() => { configureRC(); }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={theme.accent} size="large" />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
