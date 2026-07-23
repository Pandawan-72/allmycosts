import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import "@/src/i18n";
import { AuthProvider } from "@/src/contexts/AuthContext";
import { SubscriptionsProvider } from "@/src/contexts/SubscriptionsContext";
import { LanguageProvider } from "@/src/contexts/LanguageContext";
import { ThemeProvider, useTheme } from "@/src/contexts/ThemeContext";

SplashScreen.preventAutoHideAsync().catch(() => {});

function ThemedStatusBar() {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? "light" : "dark"} />;
}

export default function RootLayout() {
  useEffect(() => {
    // There are no custom fonts to preload. Hide the native splash as soon as
    // the React root is mounted instead of holding startup on an unused font loader.
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <SubscriptionsProvider>
              <ThemedStatusBar />
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#F9FAFB" } }} />
            </SubscriptionsProvider>
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
